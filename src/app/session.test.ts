import { beforeEach, describe, expect, it } from 'vitest'

import {
  DOCUMENT_MODEL_VERSION_LIMIT,
  canCommit,
  createSessionState,
  createTaskToken,
  documentModelCache,
  selectHasPendingUpdate,
  selectIsDisplayPrepared,
  sessionClosed,
  sessionDisplayReplaced,
  sessionInvalidated,
  sessionOpened,
  sessionReadSucceeded,
  sessionReducer,
  sessionTaskFailed,
  sessionTaskSucceeded,
  sessionUpdateCommitted,
} from './session'
import type { DocumentSessionState, SessionAction, TaskToken } from './session'
import type { ErrorPayload, VersionInfo } from '../services/types'

function version(hash: string): VersionInfo {
  return { contentHash: hash, sizeBytes: 10, modifiedAtMs: 100, observedAtMs: 200 }
}

function run(state: DocumentSessionState, ...actions: SessionAction[]): DocumentSessionState {
  let current = state
  for (const action of actions) current = sessionReducer(current, action)
  return current
}

function readySession(): { state: DocumentSessionState; display: VersionInfo } {
  const start = createSessionState('d-a')
  const token = createTaskToken(start, 'read-0', 'discovery') as TaskToken
  const display = version('v0')
  const state = sessionReducer(start, sessionReadSucceeded(token, display, 'v0 text'))
  return { state, display }
}

const failure: ErrorPayload = {
  code: 'PS_IO_READ_FAILED',
  category: 'io',
  messageKey: 'error.io.readFailed',
  retryable: true,
}

describe('document session commit rule (contracts §6)', () => {
  beforeEach(() => {
    documentModelCache.clear()
  })

  it('commits the initial read to the display and caches its raw text', () => {
    const state = createSessionState('d-a')
    expect(state.status).toBe('loading')
    expect(state.generation).toBe(1)

    const token = createTaskToken(state, 'read-0', 'discovery')
    expect(token).toEqual({ docId: 'd-a', version: null, generation: 1, taskId: 'read-0' })

    const next = run(state, sessionReadSucceeded(token as TaskToken, version('v0'), 'hello'))
    expect(next.status).toBe('ready')
    expect(next.displayVersion?.contentHash).toBe('v0')
    expect(next.observedVersion?.contentHash).toBe('v0')
    expect(next.pendingVersion).toBeNull()
    expect(documentModelCache.get('d-a', 'v0')?.rawText).toBe('hello')
  })

  it('processes slow v1 before/after fast v2 without ever regressing the display (AT22)', () => {
    const { state } = readySession()

    // Stable read observes v1 and the parse task binds to the pending candidate.
    const readV1 = createTaskToken(state, 'read-v1', 'discovery') as TaskToken
    const withV1 = sessionReducer(state, sessionReadSucceeded(readV1, version('v1'), 'v1 text'))
    expect(withV1.pendingVersion?.contentHash).toBe('v1')
    expect(withV1.generation).toBe(1)
    expect(selectHasPendingUpdate(withV1)).toBe(true)

    const parseV1 = createTaskToken(withV1, 'parse-v1', 'pending') as TaskToken
    expect(parseV1.version).toBe('v1')
    expect(parseV1.generation).toBe(1)

    // A newer candidate v2 replaces v1; v1's tasks are now stale by version.
    const readV2 = createTaskToken(withV1, 'read-v2', 'discovery') as TaskToken
    const withV2 = sessionReducer(withV1, sessionReadSucceeded(readV2, version('v2'), 'v2 text'))
    expect(withV2.pendingVersion?.contentHash).toBe('v2')
    expect(withV2.generation).toBe(1)

    // User accepts v2: display switches, generation increments.
    const committed = sessionReducer(withV2, sessionUpdateCommitted('approx'))
    expect(committed.displayVersion?.contentHash).toBe('v2')
    expect(committed.pendingVersion).toBeNull()
    expect(committed.generation).toBe(2)
    expect(committed.updatePosition).toBe('approx')
    expect(selectHasPendingUpdate(committed)).toBe(false)

    // Fast v2 parse commits against the new display target.
    const parseV2 = createTaskToken(committed, 'parse-v2') as TaskToken
    expect(parseV2.version).toBe('v2')
    expect(parseV2.generation).toBe(2)
    const prepared = sessionReducer(
      committed,
      sessionTaskSucceeded(parseV2, version('v2'), { data: { hast: 'stub' } }),
    )
    expect(selectIsDisplayPrepared(prepared)).toBe(true)
    expect(documentModelCache.get('d-a', 'v2')?.data).toEqual({ hast: 'stub' })

    // Slow v1 parse finishes late: discarded with zero visible effect.
    const frozen = prepared
    const afterLateV1 = sessionReducer(frozen, sessionTaskSucceeded(parseV1, version('v1'), {
      data: { hast: 'stale' },
    }))
    expect(afterLateV1).toBe(frozen)
    expect(afterLateV1.displayVersion?.contentHash).toBe('v2') // INV-VC-01
    expect(selectIsDisplayPrepared(afterLateV1)).toBe(true)
    // The stale parse result did not write its payload; only the discovery
    // raw text for v1 lives in the cache (LRU holdover).
    expect(documentModelCache.get('d-a', 'v1')?.data).toEqual({})
  })

  it('early v1 prefetch result cannot override the newer v2 candidate (INV-VC-09)', () => {
    const { state } = readySession()
    const readV1 = createTaskToken(state, 'read-v1', 'discovery') as TaskToken
    const withV1 = sessionReducer(state, sessionReadSucceeded(readV1, version('v1'), 'v1 text'))
    const parseV1 = createTaskToken(withV1, 'parse-v1', 'pending') as TaskToken

    // v1 prefetch commits while v1 is still the pending candidate.
    const prefetched = sessionReducer(
      withV1,
      sessionTaskSucceeded(parseV1, version('v1'), { data: { outline: 'v1' } }),
    )
    expect(documentModelCache.get('d-a', 'v1')?.data).toEqual({ outline: 'v1' })
    expect(selectIsDisplayPrepared(prefetched)).toBe(false)

    // v2 replaces v1, then is accepted; display never shows v1.
    const readV2 = createTaskToken(prefetched, 'read-v2', 'discovery') as TaskToken
    const withV2 = sessionReducer(prefetched, sessionReadSucceeded(readV2, version('v2')))
    const committed = sessionReducer(withV2, sessionUpdateCommitted('exact'))
    expect(committed.displayVersion?.contentHash).toBe('v2')
    expect(selectIsDisplayPrepared(committed)).toBe(false)
  })

  it('rejects results from a stale generation (INV-VC-02)', () => {
    const { state } = readySession()
    const parse = createTaskToken(state, 'parse-v0') as TaskToken

    const invalidated = sessionReducer(state, sessionInvalidated())
    expect(invalidated.generation).toBe(2)

    const frozen = invalidated
    expect(sessionReducer(frozen, sessionTaskSucceeded(parse, version('v0')))).toBe(frozen)
    expect(sessionReducer(frozen, sessionTaskFailed(parse, failure))).toBe(frozen)

    expect(canCommit(frozen, parse)).toBe(false)
    expect(canCommit(frozen, { ...parse, generation: 2 })).toBe(true)
    expect(canCommit(frozen, { ...parse, generation: 2, docId: 'd-other' })).toBe(false)
    expect(canCommit(frozen, { ...parse, generation: 2, version: 'nope' })).toBe(false)
    expect(canCommit(frozen, { ...parse, generation: 2, version: null })).toBe(true)
  })

  it('ignores every late result after a tab is closed (R05/INV-VC-06)', () => {
    const { state } = readySession()
    const inFlight = createTaskToken(state, 'parse-in-flight') as TaskToken

    const closed = sessionReducer(state, sessionClosed())
    expect(closed.status).toBe('closed')
    expect(closed.generation).toBe(2)
    expect(documentModelCache.sizeFor('d-a')).toBe(0)

    const frozen = closed
    const lateRead = createTaskToken(state, 'read-late', 'discovery') as TaskToken
    expect(sessionReducer(frozen, sessionReadSucceeded(lateRead, version('v9'), 'late'))).toBe(frozen)
    expect(sessionReducer(frozen, sessionTaskSucceeded(inFlight, version('v0')))).toBe(frozen)
    expect(documentModelCache.sizeFor('d-a')).toBe(0)

    // Reopen: a fresh session with a strictly larger generation.
    const reopened = sessionReducer(closed, sessionOpened('d-a'))
    expect(reopened.status).toBe('loading')
    expect(reopened.displayVersion).toBeNull()
    expect(reopened.generation).toBe(3)
    expect(canCommit(reopened, inFlight)).toBe(false)
  })

  it('keeps a pending candidate through same-hash reads and clears it on hash match (INV-VC-08)', () => {
    const { state } = readySession()
    const readV1 = createTaskToken(state, 'read-v1', 'discovery') as TaskToken
    const withV1 = sessionReducer(state, sessionReadSucceeded(readV1, version('v1')))

    // Re-observing the same pending hash keeps the candidate.
    const readV1Again = createTaskToken(withV1, 'read-v1b', 'discovery') as TaskToken
    const stillPending = sessionReducer(withV1, sessionReadSucceeded(readV1Again, version('v1')))
    expect(stillPending.pendingVersion?.contentHash).toBe('v1')

    // Observing the display hash again clears pending without a new version.
    const readDisplay = createTaskToken(withV1, 'read-v0', 'discovery') as TaskToken
    const cleared = sessionReducer(withV1, sessionReadSucceeded(readDisplay, version('v0')))
    expect(cleared.pendingVersion).toBeNull()
    expect(selectHasPendingUpdate(cleared)).toBe(false)
  })

  it('shows only current-task failures and keeps stale/pending failures invisible (INV-VC-10)', () => {
    const { state } = readySession()

    const displayTask = createTaskToken(state, 'parse-v0') as TaskToken
    const failed = sessionReducer(state, sessionTaskFailed(displayTask, failure))
    expect(failed.error).toEqual(failure)
    expect(failed.status).toBe('ready')

    const stale = sessionReducer(failed, sessionTaskFailed({ ...displayTask, generation: 0 }, failure))
    expect(stale).toBe(failed)

    const readV1 = createTaskToken(state, 'read-v1', 'discovery') as TaskToken
    const withV1 = sessionReducer(state, sessionReadSucceeded(readV1, version('v1')))
    const pendingTask = createTaskToken(withV1, 'parse-v1', 'pending') as TaskToken
    const silent = sessionReducer(withV1, sessionTaskFailed(pendingTask, failure))
    expect(silent).toBe(withV1)
  })

  it('marks an empty initial session as loadFailed on the first failure', () => {
    const state = createSessionState('d-a')
    const token = createTaskToken(state, 'read-0', 'discovery') as TaskToken
    const failed = sessionReducer(state, sessionTaskFailed(token, failure))
    expect(failed.status).toBe('loadFailed')
    expect(failed.error).toEqual(failure)
  })

  it('requires a pending candidate to commit an update', () => {
    const { state } = readySession()
    expect(sessionReducer(state, sessionUpdateCommitted('exact'))).toBe(state)
  })

  it('adopts a relinked version with a generation bump and clears pending state', () => {
    const { state } = readySession()
    const readV1 = createTaskToken(state, 'read-v1', 'discovery') as TaskToken
    const withV1 = sessionReducer(state, sessionReadSucceeded(readV1, version('v1')))

    const replaced = sessionReducer(withV1, sessionDisplayReplaced(version('v9'), 'v9 text'))
    expect(replaced.displayVersion?.contentHash).toBe('v9')
    expect(replaced.observedVersion?.contentHash).toBe('v9')
    expect(replaced.pendingVersion).toBeNull()
    expect(replaced.generation).toBe(2)
    expect(replaced.updatePosition).toBeNull()
    expect(documentModelCache.get('d-a', 'v9')?.rawText).toBe('v9 text')
  })

  it('returns null for a pending-bound token when no candidate exists', () => {
    const { state } = readySession()
    expect(createTaskToken(state, 'parse', 'pending')).toBeNull()
    expect(createTaskToken(state, 'parse', 'display')?.version).toBe('v0')
  })

  it('keeps up to two versions per document in the DocumentModel cache (LRU)', () => {
    expect(DOCUMENT_MODEL_VERSION_LIMIT).toBe(2)
    documentModelCache.put({ docId: 'd-a', contentHash: 'v1', rawText: 'one', data: {} })
    documentModelCache.put({ docId: 'd-a', contentHash: 'v2', rawText: 'two', data: {} })
    expect(documentModelCache.sizeFor('d-a')).toBe(2)

    // Touch v1, then insert v3: the least recently used (v2) is evicted.
    expect(documentModelCache.get('d-a', 'v1')?.rawText).toBe('one')
    documentModelCache.put({ docId: 'd-a', contentHash: 'v3', rawText: 'three', data: {} })
    expect(documentModelCache.sizeFor('d-a')).toBe(2)
    expect(documentModelCache.has('d-a', 'v1')).toBe(true)
    expect(documentModelCache.has('d-a', 'v2')).toBe(false)
    expect(documentModelCache.has('d-a', 'v3')).toBe(true)

    // Entries from another document are independent; release drops one doc.
    documentModelCache.put({ docId: 'd-b', contentHash: 'w1', rawText: 'other', data: {} })
    expect(documentModelCache.sizeFor('d-b')).toBe(1)
    documentModelCache.release('d-a')
    expect(documentModelCache.sizeFor('d-a')).toBe(0)
    expect(documentModelCache.has('d-b', 'w1')).toBe(true)
  })

  it('merges repeated puts for the same version', () => {
    documentModelCache.put({ docId: 'd-a', contentHash: 'v1', rawText: 'text', data: { a: 1 } })
    documentModelCache.put({ docId: 'd-a', contentHash: 'v1', rawText: null, data: { b: 2 } })
    const entry = documentModelCache.get('d-a', 'v1')
    expect(entry?.rawText).toBe('text')
    expect(entry?.data).toEqual({ a: 1, b: 2 })
    expect(documentModelCache.sizeFor('d-a')).toBe(1)
  })
})
