import { parseDocument } from '../pipeline'
import type { DocumentDiagnostic, ParseDocumentOptions, ParseDocumentResult } from '../types'

/**
 * Worker task protocol (rendering-pipeline §6; ADR-002 §5). `taskId` +
 * `generation` form the abort/obsolescence token carried by every request;
 * cancel or a newer task only discards stale results — the worker is not
 * required to interrupt computation itself.
 */

export interface ParseTaskRequest {
  type: 'parse'
  taskId: string
  generation: number
  docId: string
  text: string
  options?: ParseDocumentOptions
}

export interface CancelTaskRequest {
  type: 'cancel'
  taskId: string
}

export type WorkerRequest = ParseTaskRequest | CancelTaskRequest

export interface ParsedTaskResponse {
  type: 'parsed'
  taskId: string
  generation: number
  docId: string
  result: ParseDocumentResult
}

export interface FailedTaskResponse {
  type: 'failed'
  taskId: string
  generation: number
  docId: string
  error: Pick<DocumentDiagnostic, 'code' | 'category' | 'messageKey' | 'retryable'>
}

export type WorkerResponse = ParsedTaskResponse | FailedTaskResponse

export interface MessageEventLike {
  data: WorkerRequest
}

export interface WorkerScopeLike {
  postMessage(message: WorkerResponse): void
  addEventListener(type: 'message', listener: (event: MessageEventLike) => void): void
}

/** Run one parse task; never throws — unexpected errors become `failed`. */
export async function runPipelineTask(request: ParseTaskRequest): Promise<WorkerResponse> {
  try {
    const result = await parseDocument(request.text, request.options)
    return {
      type: 'parsed',
      taskId: request.taskId,
      generation: request.generation,
      docId: request.docId,
      result,
    }
  } catch {
    return {
      type: 'failed',
      taskId: request.taskId,
      generation: request.generation,
      docId: request.docId,
      error: {
        code: 'PS_INTERNAL',
        category: 'internal',
        messageKey: 'error.internal.unexpected',
        retryable: true,
      },
    }
  }
}

export interface WorkerHandler {
  /** Resolves to `null` when the result is stale (cancelled or superseded). */
  handle(request: WorkerRequest): Promise<WorkerResponse | null>
}

/**
 * Stateful request handler: only the newest task may post a result, and
 * cancelled tasks are dropped even when they finish later.
 */
export function createWorkerHandler(): WorkerHandler {
  let latestTaskId: string | null = null
  const cancelled = new Set<string>()

  return {
    async handle(request: WorkerRequest): Promise<WorkerResponse | null> {
      if (request.type === 'cancel') {
        cancelled.add(request.taskId)
        if (latestTaskId === request.taskId) latestTaskId = null
        return null
      }

      latestTaskId = request.taskId
      const response = await runPipelineTask(request)
      if (latestTaskId !== request.taskId || cancelled.has(request.taskId)) return null
      return response
    },
  }
}

/** Wire a handler to a worker-like scope (`parse.worker.ts` uses `self`). */
export function installParseWorker(
  scope: WorkerScopeLike,
  handler: WorkerHandler = createWorkerHandler(),
): void {
  scope.addEventListener('message', (event) => {
    void handler.handle(event.data).then((response) => {
      if (response) scope.postMessage(response)
    })
  })
}
