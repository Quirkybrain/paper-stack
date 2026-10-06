import { invoke } from '@tauri-apps/api/core'

import type { ErrorCategory, ErrorPayload, SourceRange } from './types'

/**
 * Single IPC entry point for the whole frontend (contracts §5/§8).
 *
 * Every `src/services/*` wrapper calls `invokeCommand`, so error normalization
 * happens in exactly one place: a rejected command becomes a `PaperStackError`
 * carrying the stable `code`, `category`, `messageKey`, `retryable`,
 * `sourceRange?` and sanitized `details?`. The UI must only render the text
 * for `messageKey` (plus the error code); `details` belongs to the folded
 * "technical details" view (contracts §5 rules).
 */

const ERROR_CATEGORIES: readonly ErrorCategory[] = [
  'io',
  'encoding',
  'auth',
  'resource',
  'parse',
  'storage',
  'limit',
  'internal',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSourceRange(value: unknown): value is SourceRange {
  return (
    isRecord(value) &&
    typeof value.startByte === 'number' &&
    typeof value.endByte === 'number' &&
    Number.isFinite(value.startByte) &&
    Number.isFinite(value.endByte)
  )
}

function isDetails(value: unknown): value is Record<string, string | number | boolean> {
  if (!isRecord(value)) return false
  return Object.values(value).every(
    (item) =>
      typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
  )
}

/** Shape guard for the contract §3.7 `ErrorPayload`. */
export function isErrorPayload(value: unknown): value is ErrorPayload {
  if (!isRecord(value)) return false
  return (
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.category === 'string' &&
    (ERROR_CATEGORIES as readonly string[]).includes(value.category) &&
    typeof value.messageKey === 'string' &&
    value.messageKey.length > 0 &&
    typeof value.retryable === 'boolean' &&
    (value.sourceRange === undefined || isSourceRange(value.sourceRange)) &&
    (value.details === undefined || isDetails(value.details))
  )
}

/** Fallback for a rejection that is not a contract `ErrorPayload` (contracts §5). */
export function createInternalErrorPayload(): ErrorPayload {
  return {
    code: 'PS_INTERNAL',
    category: 'internal',
    messageKey: 'error.internal.unexpected',
    retryable: true,
  }
}

export class PaperStackError extends Error {
  readonly code: string
  readonly category: ErrorCategory
  readonly messageKey: string
  readonly retryable: boolean
  readonly sourceRange?: SourceRange
  readonly details?: Record<string, string | number | boolean>

  constructor(payload: ErrorPayload) {
    super(payload.messageKey)
    this.name = 'PaperStackError'
    this.code = payload.code
    this.category = payload.category
    this.messageKey = payload.messageKey
    this.retryable = payload.retryable
    this.sourceRange = payload.sourceRange
    this.details = payload.details
  }

  /** `PS_TASK_CANCELLED` is not a failure and must not be shown as one (§5). */
  get isCancelled(): boolean {
    return this.code === 'PS_TASK_CANCELLED'
  }

  toPayload(): ErrorPayload {
    const payload: ErrorPayload = {
      code: this.code,
      category: this.category,
      messageKey: this.messageKey,
      retryable: this.retryable,
    }
    if (this.sourceRange !== undefined) payload.sourceRange = this.sourceRange
    if (this.details !== undefined) payload.details = { ...this.details }
    return payload
  }

  static is(value: unknown): value is PaperStackError {
    return value instanceof PaperStackError
  }

  static from(error: unknown): PaperStackError {
    if (error instanceof PaperStackError) return error
    if (isErrorPayload(error)) return new PaperStackError(error)
    return new PaperStackError(createInternalErrorPayload())
  }
}

/** Normalizes any thrown value into a contract `ErrorPayload`. */
export function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof PaperStackError) return error.toPayload()
  if (isErrorPayload(error)) return error
  return createInternalErrorPayload()
}

/** Typed single-invoke helper: resolves `Response` or rejects `PaperStackError`. */
export async function invokeCommand<Response>(
  command: string,
  args?: Record<string, unknown>,
): Promise<Response> {
  try {
    return await invoke<Response>(command, args)
  } catch (error) {
    throw PaperStackError.from(error)
  }
}
