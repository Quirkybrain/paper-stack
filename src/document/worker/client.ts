import { parseDocument } from '../pipeline'
import type { DocumentDiagnostic, ParseDocumentResult } from '../types'
import type { ParseTaskRequest, ParsedTaskResponse, WorkerResponse } from './protocol'

/**
 * Main-thread worker client and the degraded fallback path
 * (rendering-pipeline §6). When a Worker is unavailable or the worker dies,
 * the exact same `parseDocument` runs in-process and the result carries a
 * `PS_WORKER_FAILED` diagnostic — the tree/outline/blocks/segments stay
 * identical to the worker product. A fatal error drops only that client:
 * later parses retry a rebuilt worker instead of blacklisting it for the
 * rest of the session.
 */

export class TaskAbortedError extends Error {
  readonly code = 'PS_TASK_CANCELLED'

  constructor(taskId: string) {
    super(`parse task ${taskId} was cancelled`)
    this.name = 'TaskAbortedError'
  }
}

export class WorkerUnavailableError extends Error {
  readonly code = 'PS_WORKER_FAILED'

  constructor(message = 'Web Worker is not available in this environment') {
    super(message)
    this.name = 'WorkerUnavailableError'
  }
}

export interface PipelineWorkerClient {
  parse(request: ParseTaskRequest): Promise<ParsedTaskResponse>
  cancel(taskId: string): void
  dispose(): void
  /** True once the worker failed at startup or on a fatal error; never reuse it. */
  readonly failed: boolean
}

export interface PipelineWorkerClientOptions {
  /** Called exactly once when the worker reports an unrecoverable error. */
  onFatalError?: () => void
}

export function createPipelineWorkerClient(
  options: PipelineWorkerClientOptions = {},
): PipelineWorkerClient {
  if (typeof Worker === 'undefined') throw new WorkerUnavailableError()

  const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<
    string,
    { resolve: (response: ParsedTaskResponse) => void; reject: (error: Error) => void }
  >()
  let failed = false

  const fail = (message: string): void => {
    if (failed) return
    failed = true
    const error = new WorkerUnavailableError(message)
    for (const entry of pending.values()) entry.reject(error)
    pending.clear()
    options.onFatalError?.()
  }

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const entry = pending.get(response.taskId)
    if (!entry) return
    pending.delete(response.taskId)
    if (response.type === 'parsed') {
      entry.resolve(response)
    } else {
      // An unexpected worker-side failure: the caller may retry in-process.
      entry.reject(new WorkerUnavailableError(`parse worker failed: ${response.error.code}`))
    }
  })

  worker.addEventListener('error', () => {
    fail('parse worker failed')
  })

  return {
    get failed() {
      return failed
    },
    parse(request: ParseTaskRequest): Promise<ParsedTaskResponse> {
      if (failed) {
        return Promise.reject(new WorkerUnavailableError('parse worker is unavailable'))
      }
      return new Promise<ParsedTaskResponse>((resolve, reject) => {
        pending.set(request.taskId, { resolve, reject })
        worker.postMessage(request)
      })
    },
    cancel(taskId: string): void {
      if (!failed) worker.postMessage({ type: 'cancel', taskId })
      const entry = pending.get(taskId)
      if (entry) {
        pending.delete(taskId)
        entry.reject(new TaskAbortedError(taskId))
      }
    },
    dispose(): void {
      failed = true
      const error = new WorkerUnavailableError('parse worker client was disposed')
      for (const entry of pending.values()) entry.reject(error)
      pending.clear()
      worker.terminate()
    },
  }
}

let sharedClient: PipelineWorkerClient | null = null

/**
 * A failed client is dropped so that the *next* parse can start a fresh worker
 * again (rendering-pipeline §6 allows terminating and rebuilding the worker;
 * a session-permanent blacklist would keep the in-process fallback forever
 * even when the worker becomes runnable). Failure stays per parse: every parse
 * either uses a worker or degrades to the in-process pipeline with a
 * `PS_WORKER_FAILED` diagnostic.
 */
function dropSharedClient(): void {
  const client = sharedClient
  sharedClient = null
  client?.dispose()
}

function getSharedClient(): PipelineWorkerClient | null {
  if (!sharedClient || sharedClient.failed) {
    if (sharedClient?.failed) dropSharedClient()
    try {
      sharedClient = createPipelineWorkerClient({ onFatalError: dropSharedClient })
    } catch {
      // Worker construction failed for this parse only; the caller falls back
      // and a later parse may retry (e.g. after a transient environment limit).
      return null
    }
  }
  return sharedClient
}

/** Test/hot-reload helper: drop the lazily created shared worker client. */
export function resetPipelineWorkerClient(): void {
  sharedClient?.dispose()
  sharedClient = null
}

export interface ParseTaskToken {
  taskId: string
  generation: number
  docId: string
}

export interface ParseWithFallbackDeps {
  createClient?: () => PipelineWorkerClient
  parseInProcess?: (
    text: string,
    options?: ParseTaskRequest['options'],
  ) => Promise<ParseDocumentResult>
}

export interface ParseWithFallbackResult {
  result: ParseDocumentResult
  usedWorker: boolean
}

const WORKER_FAILED_DIAGNOSTIC: DocumentDiagnostic = {
  code: 'PS_WORKER_FAILED',
  category: 'internal',
  messageKey: 'error.internal.worker',
  retryable: true,
}

function withWorkerDiagnostic(result: ParseDocumentResult): ParseDocumentResult {
  if (result.diagnostics.some((diagnostic) => diagnostic.code === 'PS_WORKER_FAILED')) return result
  return { ...result, diagnostics: [...result.diagnostics, { ...WORKER_FAILED_DIAGNOSTIC }] }
}

/**
 * Parse through the worker when possible, otherwise in-process with the same
 * pipeline. Cancellation (`TaskAbortedError`) is rethrown and never silently
 * converted into a fallback parse.
 */
export async function parseDocumentWithFallback(
  text: string,
  token: ParseTaskToken,
  options: ParseTaskRequest['options'] = {},
  deps: ParseWithFallbackDeps = {},
): Promise<ParseWithFallbackResult> {
  const parseInProcess = deps.parseInProcess ?? parseDocument
  const request: ParseTaskRequest = {
    type: 'parse',
    taskId: token.taskId,
    generation: token.generation,
    docId: token.docId,
    text,
    options,
  }

  const runFallback = async (): Promise<ParseWithFallbackResult> => {
    const result = await parseInProcess(text, options)
    return { result: withWorkerDiagnostic(result), usedWorker: false }
  }

  let client: PipelineWorkerClient | null = null
  try {
    if (deps.createClient) client = deps.createClient()
    else if (typeof Worker !== 'undefined') client = getSharedClient()
  } catch {
    client = null
  }
  if (!client || client.failed) return runFallback()

  try {
    const response = await client.parse(request)
    return { result: response.result, usedWorker: true }
  } catch (error) {
    if (error instanceof TaskAbortedError) throw error
    return runFallback()
  }
}
