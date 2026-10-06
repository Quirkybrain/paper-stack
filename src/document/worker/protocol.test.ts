import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseDocument } from '../pipeline'
import type { ParsedTaskResponse, WorkerResponse } from './protocol'
import {
  createWorkerHandler,
  installParseWorker,
  runPipelineTask,
  type ParseTaskRequest,
  type WorkerRequest,
} from './protocol'
import {
  createPipelineWorkerClient,
  parseDocumentWithFallback,
  resetPipelineWorkerClient,
  TaskAbortedError,
  WorkerUnavailableError,
  type PipelineWorkerClient,
} from './client'

class FakeWorker {
  static instances: FakeWorker[] = []

  readonly posted: WorkerRequest[] = []
  terminated = false
  private readonly listeners = new Map<string, Array<(event: { data: WorkerResponse }) => void>>()

  constructor() {
    FakeWorker.instances.push(this)
  }

  addEventListener(type: string, listener: (event: { data: WorkerResponse }) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  postMessage(message: WorkerRequest): void {
    this.posted.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(response: WorkerResponse): void {
    for (const listener of this.listeners.get('message') ?? []) listener({ data: response })
  }
}

afterEach(() => {
  resetPipelineWorkerClient()
  vi.unstubAllGlobals()
  FakeWorker.instances = []
})

const SAMPLE = '# 标题\n\nalpha *beta* gamma 😀\n\n- [x] done\n'

function request(overrides: Partial<ParseTaskRequest> = {}): ParseTaskRequest {
  return {
    type: 'parse',
    taskId: 't1',
    generation: 1,
    docId: 'd1',
    text: SAMPLE,
    options: { mode: 'technical' },
    ...overrides,
  }
}

function token(taskId = 't9', generation = 2) {
  return { taskId, generation, docId: 'd1' }
}

describe('worker task protocol', () => {
  it('runs the pipeline and returns a structured-cloneable parsed envelope', async () => {
    const response = await runPipelineTask(request())
    expect(response.type).toBe('parsed')
    const parsed = response as ParsedTaskResponse
    expect(parsed.taskId).toBe('t1')
    expect(parsed.generation).toBe(1)
    expect(parsed.result.status).toBe('ok')
    expect(parsed.result.blocks.length).toBeGreaterThan(0)
    expect(() => structuredClone(parsed)).not.toThrow()
  })

  it('drops a cancelled task even when it finishes later', async () => {
    const handler = createWorkerHandler()
    const pending = handler.handle(request({ taskId: 'slow' }))
    await handler.handle({ type: 'cancel', taskId: 'slow' })
    expect(await pending).toBeNull()
  })

  it('supersedes earlier tasks with the newest one', async () => {
    const handler = createWorkerHandler()
    const first = handler.handle(request({ taskId: 'first' }))
    const second = handler.handle(request({ taskId: 'second' }))
    expect(await first).toBeNull()
    const response = await second
    expect(response?.type).toBe('parsed')
    expect(response?.taskId).toBe('second')
  })

  it('posts only current results to an installed worker scope', async () => {
    const messages: WorkerResponse[] = []
    const listeners: Array<(event: { data: WorkerRequest }) => void> = []
    const scope = {
      postMessage(message: WorkerResponse) {
        messages.push(message)
      },
      addEventListener(_type: 'message', listener: (event: { data: WorkerRequest }) => void) {
        listeners.push(listener)
      },
    }

    installParseWorker(scope)
    listeners[0]({ data: request({ taskId: 'scope-1' }) })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(messages).toHaveLength(1)
    expect(messages[0].taskId).toBe('scope-1')
    expect(messages[0].type).toBe('parsed')
  })
})

describe('main-thread fallback', () => {
  it('produces the same tree, outline, blocks and segments with PS_WORKER_FAILED', async () => {
    const workerResponse = await runPipelineTask(request())
    if (workerResponse.type !== 'parsed') throw new Error('worker envelope failed')
    const workerResult = workerResponse.result

    const fallback = await parseDocumentWithFallback(
      SAMPLE,
      token(),
      { mode: 'technical' },
      {
        createClient: () => {
          throw new WorkerUnavailableError()
        },
      },
    )

    expect(fallback.usedWorker).toBe(false)
    expect(fallback.result.hast).toEqual(workerResult.hast)
    expect(fallback.result.outline).toEqual(workerResult.outline)
    expect(fallback.result.blocks).toEqual(workerResult.blocks)
    expect(fallback.result.segments).toEqual(workerResult.segments)
    expect(fallback.result.diagnostics.map((entry) => entry.code)).toContain('PS_WORKER_FAILED')
  })

  it('falls back when an existing client rejects', async () => {
    const failing: PipelineWorkerClient = {
      parse: () => Promise.reject(new WorkerUnavailableError('worker crashed')),
      cancel: () => {},
      dispose: () => {},
    }
    const fallback = await parseDocumentWithFallback(
      SAMPLE,
      token(),
      {},
      { createClient: () => failing },
    )
    expect(fallback.usedWorker).toBe(false)
    expect(fallback.result.status).toBe('ok')
    expect(fallback.result.diagnostics.map((entry) => entry.code)).toContain('PS_WORKER_FAILED')
  })

  it('uses the worker result unchanged when the client succeeds', async () => {
    const envelope = (await runPipelineTask(request())) as ParsedTaskResponse
    const client: PipelineWorkerClient = {
      parse: () => Promise.resolve(envelope),
      cancel: () => {},
      dispose: () => {},
    }
    const outcome = await parseDocumentWithFallback(
      SAMPLE,
      token(),
      {},
      { createClient: () => client },
    )
    expect(outcome.usedWorker).toBe(true)
    expect(outcome.result).toEqual(envelope.result)
    expect(outcome.result.diagnostics).toEqual([])
  })

  it('rethrows cancellation instead of silently parsing in-process', async () => {
    const client: PipelineWorkerClient = {
      parse: () => Promise.reject(new TaskAbortedError('t9')),
      cancel: () => {},
      dispose: () => {},
    }
    await expect(
      parseDocumentWithFallback(SAMPLE, token(), {}, { createClient: () => client }),
    ).rejects.toBeInstanceOf(TaskAbortedError)
  })

  it('keeps the in-process path identical to parseDocument', async () => {
    const direct = await parseDocument(SAMPLE)
    const fallback = await parseDocumentWithFallback(
      SAMPLE,
      token(),
      {},
      {
        createClient: () => {
          throw new WorkerUnavailableError()
        },
      },
    )
    expect(fallback.result.hast).toEqual(direct.hast)
    expect(fallback.result.blocks).toEqual(direct.blocks)
  })

  it('fails clearly when no Worker implementation exists', () => {
    if (typeof Worker !== 'undefined') return
    expect(() => createPipelineWorkerClient()).toThrow(WorkerUnavailableError)
  })
})

describe('worker client', () => {
  it('resolves parsed responses, posts the request and terminates on dispose', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const client = createPipelineWorkerClient()
    const promise = client.parse(request())
    const fake = FakeWorker.instances[0]
    expect(fake.posted).toEqual([request()])

    const envelope = (await runPipelineTask(request())) as ParsedTaskResponse
    fake.emit(envelope)
    await expect(promise).resolves.toEqual(envelope)

    client.dispose()
    expect(fake.terminated).toBe(true)
  })

  it('rejects cancelled tasks and ignores their late response', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const client = createPipelineWorkerClient()
    const promise = client.parse(request({ taskId: 'cancel-me' }))
    client.cancel('cancel-me')
    await expect(promise).rejects.toBeInstanceOf(TaskAbortedError)

    const envelope = (await runPipelineTask(request({ taskId: 'cancel-me' }))) as ParsedTaskResponse
    FakeWorker.instances[0].emit(envelope)
  })

  it('rejects with WorkerUnavailableError on a failed worker envelope', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const client = createPipelineWorkerClient()
    const promise = client.parse(request({ taskId: 'bad' }))
    FakeWorker.instances[0].emit({
      type: 'failed',
      taskId: 'bad',
      generation: 1,
      docId: 'd1',
      error: {
        code: 'PS_INTERNAL',
        category: 'internal',
        messageKey: 'error.internal.unexpected',
        retryable: true,
      },
    })
    await expect(promise).rejects.toBeInstanceOf(WorkerUnavailableError)
  })

  it('routes parseDocumentWithFallback through the worker when it responds', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const envelope = (await runPipelineTask(request({ taskId: 't9' }))) as ParsedTaskResponse
    const outcomePromise = parseDocumentWithFallback(SAMPLE, token(), { mode: 'technical' })
    await vi.waitFor(() => expect(FakeWorker.instances[0]?.posted.length).toBe(1))
    FakeWorker.instances[0].emit(envelope)

    const outcome = await outcomePromise
    expect(outcome.usedWorker).toBe(true)
    expect(outcome.result).toEqual(envelope.result)
  })
})
