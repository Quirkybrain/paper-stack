import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'

import {
  PaperStackError,
  createInternalErrorPayload,
  invokeCommand,
  isErrorPayload,
  toErrorPayload,
} from './invoke'
import type { ErrorPayload } from './types'

const invokeMock = vi.mocked(invoke)

const payload: ErrorPayload = {
  code: 'PS_IO_NOT_FOUND',
  category: 'io',
  messageKey: 'error.io.notFound',
  retryable: true,
  sourceRange: { startByte: 3, endByte: 9 },
  details: { path: '/tmp/doc.md', attempt: 2, truncated: false },
}

describe('invokeCommand and PaperStackError normalization', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('resolves the typed response and forwards command + args', async () => {
    invokeMock.mockResolvedValue({ items: [] })
    const result = await invokeCommand<{ items: unknown[] }>('open_documents', { req: { paths: [] } })
    expect(result).toEqual({ items: [] })
    expect(invokeMock).toHaveBeenCalledWith('open_documents', { req: { paths: [] } })
  })

  it('normalizes a contract ErrorPayload rejection into PaperStackError', async () => {
    invokeMock.mockRejectedValue(payload)
    const error = await invokeCommand('read_document').catch((thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(PaperStackError)
    const stackError = error as PaperStackError
    expect(stackError).toBeInstanceOf(Error)
    expect(stackError.name).toBe('PaperStackError')
    expect(stackError.message).toBe('error.io.notFound')
    expect(stackError.code).toBe('PS_IO_NOT_FOUND')
    expect(stackError.category).toBe('io')
    expect(stackError.messageKey).toBe('error.io.notFound')
    expect(stackError.retryable).toBe(true)
    expect(stackError.sourceRange).toEqual({ startByte: 3, endByte: 9 })
    expect(stackError.details).toEqual({ path: '/tmp/doc.md', attempt: 2, truncated: false })
    expect(stackError.toPayload()).toEqual(payload)
  })

  it('flags PS_TASK_CANCELLED as cancellation, not failure', () => {
    const cancelled = new PaperStackError({
      code: 'PS_TASK_CANCELLED',
      category: 'internal',
      messageKey: 'error.internal.cancelled',
      retryable: false,
    })
    expect(cancelled.isCancelled).toBe(true)
    expect(
      new PaperStackError({ ...payload, code: 'PS_INTERNAL' }).isCancelled,
    ).toBe(false)
  })

  it('rethrows an existing PaperStackError unchanged', async () => {
    const original = new PaperStackError(payload)
    invokeMock.mockRejectedValue(original)
    const error = await invokeCommand('x').catch((thrown: unknown) => thrown)
    expect(error).toBe(original)
  })

  it('falls back to PS_INTERNAL for non-contract rejections', async () => {
    for (const rejection of ['boom', new Error('boom'), null, 42, {}]) {
      invokeMock.mockRejectedValue(rejection)
      const error = (await invokeCommand('x').catch((thrown: unknown) => thrown)) as PaperStackError
      expect(error).toBeInstanceOf(PaperStackError)
      expect(error.code).toBe('PS_INTERNAL')
      expect(error.category).toBe('internal')
      expect(error.messageKey).toBe('error.internal.unexpected')
      expect(error.retryable).toBe(true)
    }
  })

  it('rejects payloads with malformed fields and falls back to PS_INTERNAL', async () => {
    const malformed = [
      { ...payload, category: 'nope' },
      { ...payload, code: '' },
      { ...payload, retryable: 'yes' },
      { ...payload, sourceRange: { startByte: 'a', endByte: 1 } },
      { ...payload, details: { nested: { a: 1 } } },
    ]
    for (const candidate of malformed) {
      expect(isErrorPayload(candidate)).toBe(false)
      invokeMock.mockRejectedValue(candidate)
      const error = (await invokeCommand('x').catch((thrown: unknown) => thrown)) as PaperStackError
      expect(error.code).toBe('PS_INTERNAL')
    }
  })

  it('toErrorPayload returns the contract payload or the internal fallback', () => {
    expect(toErrorPayload(payload)).toEqual(payload)
    const wrapped = new PaperStackError(payload)
    expect(toErrorPayload(wrapped)).toEqual(payload)
    expect(toErrorPayload('nope')).toEqual(createInternalErrorPayload())
  })

  it('isErrorPayload accepts minimal valid payloads and optional fields', () => {
    expect(
      isErrorPayload({
        code: 'PS_INTERNAL',
        category: 'internal',
        messageKey: 'error.internal.unexpected',
        retryable: true,
      }),
    ).toBe(true)
    expect(isErrorPayload(null)).toBe(false)
    expect(isErrorPayload([])).toBe(false)
  })
})
