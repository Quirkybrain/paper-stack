import type { ErrorPayload, VersionInfo } from '../services/types'

/**
 * Per-tab document session state and the single implementation of the
 * contract §6 version/generation commit rule (ADR-003 option C, T-22).
 *
 * Normative references (contracts `paperstack-ipc-r1`):
 * - §1.6 / §6.2: every task crossing an async boundary is dispatched with a
 *   `TaskToken {docId, version: string | null, generation, taskId}`.
 * - §6.3: a result commits to user-visible state only when (a) its `docId`
 *   still matches, (b) its `generation` still matches, and (c) for
 *   version-bound results its `version` matches the tab's current target
 *   (`displayVersion`, or the accepted `pendingVersion`).
 * - §6.4/§6.5/§6.6: superseded results are discarded with zero visible effect;
 *   late results must not rebuild a closed tab; stale errors stay invisible.
 * - §6.1: `generation` increases monotonically on every accepted target
 *   change: open/reopen, adopting a pending candidate into the display
 *   (`updateCommitted`), relink adoption (`displayReplaced`), close and
 *   authorization revocation. Replacing the *pending candidate* (v1 → v2)
 *   does not bump the generation: the §2.2(a) sequence keeps `g1` until v2 is
 *   accepted, and stale pending-bound tasks are rejected by condition (c).
 *
 * Heavy document artifacts live outside React in the module-level
 * `documentModelCache` (ADR-003; `docId+version` keyed, LRU ≤2 versions per
 * document). The reducer writes committed raw text/data there; React state
 * only holds lightweight handles.
 */

/** Contract §1.6 TaskToken. `version` is `null` for discovery-type tasks. */
export interface TaskToken {
  docId: string
  version: string | null
  generation: number
  taskId: string
}

/** D1 lifecycle of a tab (models §1.1; `loadFailed`/`closed` are UI-internal). */
export type SessionStatus = 'loading' | 'ready' | 'loadFailed' | 'unavailable' | 'closed'

/** Position outcome paired with an update commit (INV-VC-11 / INV-UM-08). */
export type UpdatePositionResult = 'exact' | 'approx'

export interface DocumentSessionState {
  docId: string
  status: SessionStatus
  /** Version the user sees; version key = `contentHash`. */
  displayVersion: VersionInfo | null
  /** Most recent stable read of the disk; not necessarily displayed. */
  observedVersion: VersionInfo | null
  /** Stable candidate newer than `displayVersion`, not yet adopted. */
  pendingVersion: VersionInfo | null
  /** Version whose version-bound (parse/render) result committed to the display. */
  preparedVersion: VersionInfo | null
  /** Monotonic; see §6.1. Never decreases, including across close/reopen. */
  generation: number
  /** Current visible task error (stale errors never land here; §6.6). */
  error: ErrorPayload | null
  /** Position outcome of the last accepted update commit. */
  updatePosition: UpdatePositionResult | null
}

export interface DocumentModelEntry {
  docId: string
  contentHash: string
  rawText: string | null
  /** Feature-level artifacts (hast/outline/blocks/line index) keyed by name. */
  data: Record<string, unknown>
}

/** ADR-003: LRU ≤2 versions per document in the module-level model cache. */
export const DOCUMENT_MODEL_VERSION_LIMIT = 2

const KEY_SEPARATOR = '\u0000'

class DocumentModelCache {
  readonly limit = DOCUMENT_MODEL_VERSION_LIMIT
  #entries = new Map<string, DocumentModelEntry>()
  #countByDoc = new Map<string, number>()

  #key(docId: string, contentHash: string): string {
    return `${docId}${KEY_SEPARATOR}${contentHash}`
  }

  has(docId: string, contentHash: string): boolean {
    return this.#entries.has(this.#key(docId, contentHash))
  }

  get(docId: string, contentHash: string): DocumentModelEntry | undefined {
    const key = this.#key(docId, contentHash)
    const entry = this.#entries.get(key)
    if (entry === undefined) return undefined
    // Refresh recency: re-insert at the tail of the insertion-ordered map.
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry
  }

  put(entry: DocumentModelEntry): DocumentModelEntry {
    const key = this.#key(entry.docId, entry.contentHash)
    const existing = this.#entries.get(key)
    const stored: DocumentModelEntry = existing
      ? {
          docId: entry.docId,
          contentHash: entry.contentHash,
          rawText: entry.rawText ?? existing.rawText,
          data: { ...existing.data, ...entry.data },
        }
      : {
          docId: entry.docId,
          contentHash: entry.contentHash,
          rawText: entry.rawText,
          data: { ...entry.data },
        }
    if (existing === undefined) {
      this.#countByDoc.set(entry.docId, (this.#countByDoc.get(entry.docId) ?? 0) + 1)
    }
    this.#entries.set(key, stored)
    this.#evict(entry.docId)
    return stored
  }

  #evict(docId: string): void {
    const prefix = `${docId}${KEY_SEPARATOR}`
    let count = this.#countByDoc.get(docId) ?? 0
    for (const key of this.#entries.keys()) {
      if (count <= this.limit) break
      if (key.startsWith(prefix)) {
        this.#entries.delete(key)
        count -= 1
      }
    }
    this.#countByDoc.set(docId, count)
  }

  /** Releases every version of a document (close tab; models §1.2 T11). */
  release(docId: string): void {
    const prefix = `${docId}${KEY_SEPARATOR}`
    for (const key of [...this.#entries.keys()]) {
      if (key.startsWith(prefix)) this.#entries.delete(key)
    }
    this.#countByDoc.delete(docId)
  }

  get size(): number {
    return this.#entries.size
  }

  sizeFor(docId: string): number {
    return this.#countByDoc.get(docId) ?? 0
  }

  clear(): void {
    this.#entries.clear()
    this.#countByDoc.clear()
  }
}

export const documentModelCache = new DocumentModelCache()

// ---------------------------------------------------------------------------
// Actions and action creators
// ---------------------------------------------------------------------------

export type SessionAction =
  | { type: 'session/opened'; docId: string }
  | { type: 'session/closed' }
  | { type: 'session/readSucceeded'; token: TaskToken; version: VersionInfo; text?: string }
  | {
      type: 'session/taskSucceeded'
      token: TaskToken
      version: VersionInfo
      text?: string
      data?: Record<string, unknown>
    }
  | { type: 'session/taskFailed'; token: TaskToken; error: ErrorPayload }
  | { type: 'session/updateCommitted'; position?: UpdatePositionResult }
  | { type: 'session/displayReplaced'; version: VersionInfo; text?: string }
  | { type: 'session/unavailable' }
  | { type: 'session/recovered' }
  | { type: 'session/invalidated' }

export const sessionOpened = (docId: string): SessionAction => ({
  type: 'session/opened',
  docId,
})

export const sessionClosed = (): SessionAction => ({ type: 'session/closed' })

export const sessionReadSucceeded = (
  token: TaskToken,
  version: VersionInfo,
  text?: string,
): SessionAction => ({
  type: 'session/readSucceeded',
  token,
  version,
  ...(text === undefined ? {} : { text }),
})

export const sessionTaskSucceeded = (
  token: TaskToken,
  version: VersionInfo,
  options: { text?: string; data?: Record<string, unknown> } = {},
): SessionAction => ({
  type: 'session/taskSucceeded',
  token,
  version,
  ...(options.text === undefined ? {} : { text: options.text }),
  ...(options.data === undefined ? {} : { data: options.data }),
})

export const sessionTaskFailed = (token: TaskToken, error: ErrorPayload): SessionAction => ({
  type: 'session/taskFailed',
  token,
  error,
})

/** Adopts `pendingVersion` into the display; pairs with the position outcome (INV-VC-11). */
export const sessionUpdateCommitted = (position?: UpdatePositionResult): SessionAction => ({
  type: 'session/updateCommitted',
  ...(position === undefined ? {} : { position }),
})

/** Relink/user adoption of a new displayed version (R07). */
export const sessionDisplayReplaced = (version: VersionInfo, text?: string): SessionAction => ({
  type: 'session/displayReplaced',
  version,
  ...(text === undefined ? {} : { text }),
})

export const sessionUnavailable = (): SessionAction => ({ type: 'session/unavailable' })

export const sessionRecovered = (): SessionAction => ({ type: 'session/recovered' })

/** Authorization revoked or tasks cancelled: increments generation (§6.5). */
export const sessionInvalidated = (): SessionAction => ({ type: 'session/invalidated' })

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export type TaskTarget = 'display' | 'pending' | 'discovery'

/**
 * Builds the dispatch token for the requested target with the *current*
 * generation and version. Returns `null` for `pending` when there is no
 * pending candidate to bind to.
 */
export function createTaskToken(
  state: DocumentSessionState,
  taskId: string,
  target: TaskTarget = 'display',
): TaskToken | null {
  const base = { docId: state.docId, generation: state.generation, taskId }
  if (target === 'discovery') return { ...base, version: null }
  if (target === 'pending') {
    if (state.pendingVersion === null) return null
    return { ...base, version: state.pendingVersion.contentHash }
  }
  return { ...base, version: state.displayVersion?.contentHash ?? null }
}

// ---------------------------------------------------------------------------
// Commit rule (contract §6.3)
// ---------------------------------------------------------------------------

/** True when the result token is allowed to commit to this tab (contract §6.3). */
export function canCommit(state: DocumentSessionState, token: TaskToken): boolean {
  if (state.status === 'closed') return false
  if (token.docId !== state.docId) return false // (a)
  if (token.generation !== state.generation) return false // (b)
  if (token.version === null) return true // discovery task
  return isCurrentTarget(state, token.version) // (c)
}

function isCurrentTarget(state: DocumentSessionState, versionHash: string): boolean {
  return (
    versionHash === state.displayVersion?.contentHash ||
    versionHash === state.pendingVersion?.contentHash
  )
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function createSessionState(docId: string): DocumentSessionState {
  return {
    docId,
    status: 'loading',
    displayVersion: null,
    observedVersion: null,
    pendingVersion: null,
    preparedVersion: null,
    generation: 1,
    error: null,
    updatePosition: null,
  }
}

export function sessionReducer(
  state: DocumentSessionState,
  action: SessionAction,
): DocumentSessionState {
  if (action.type === 'session/opened') {
    // Reopen after close: generation keeps increasing (§6.1, INV-VC-03).
    const generation = state.generation + 1
    return { ...createSessionState(action.docId), generation }
  }

  // A closed tab never comes back through any other action (INV-VC-06).
  if (state.status === 'closed') return state

  switch (action.type) {
    case 'session/closed': {
      documentModelCache.release(state.docId)
      return { ...state, status: 'closed', generation: state.generation + 1 }
    }

    case 'session/readSucceeded': {
      if (!canCommit(state, action.token)) return state
      // Stable-read discoveries are dispatched with version=null (models §2.3).
      if (action.token.version !== null) return state
      const observed = action.version
      let displayVersion = state.displayVersion
      let pendingVersion = state.pendingVersion
      if (displayVersion === null) {
        displayVersion = observed
        pendingVersion = null
      } else if (observed.contentHash === displayVersion.contentHash) {
        pendingVersion = null // INV-VC-08: same hash is not a new version
      } else if (pendingVersion?.contentHash === observed.contentHash) {
        // Same candidate re-observed: nothing changes.
      } else {
        // A newer candidate replaces the previous one (models §4.3).
        pendingVersion = observed
      }
      if (action.text !== undefined) {
        documentModelCache.put({
          docId: state.docId,
          contentHash: observed.contentHash,
          rawText: action.text,
          data: {},
        })
      }
      return {
        ...state,
        status: 'ready',
        displayVersion,
        observedVersion: observed,
        pendingVersion,
        error: null,
      }
    }

    case 'session/taskSucceeded': {
      if (!canCommit(state, action.token)) return state
      // Version-bound results must carry the exact target version.
      if (action.token.version === null || action.version.contentHash !== action.token.version) {
        return state
      }
      const isDisplayTarget = action.token.version === state.displayVersion?.contentHash
      const isPendingTarget = action.token.version === state.pendingVersion?.contentHash
      if (!isDisplayTarget && !isPendingTarget) return state
      if (action.text !== undefined || action.data !== undefined) {
        documentModelCache.put({
          docId: state.docId,
          contentHash: action.version.contentHash,
          rawText: action.text ?? null,
          data: action.data ?? {},
        })
      }
      if (!isDisplayTarget) {
        // Pending prefetch: stored for later, zero user-visible change.
        return state
      }
      return { ...state, preparedVersion: action.version, error: null }
    }

    case 'session/taskFailed': {
      if (!canCommit(state, action.token)) return state
      const isDisplayTarget =
        action.token.version === null ||
        action.token.version === state.displayVersion?.contentHash
      if (!isDisplayTarget) return state // stale pending prefetch failure: silent
      const failed: DocumentSessionState = { ...state, error: action.error }
      if (state.displayVersion === null) failed.status = 'loadFailed'
      return failed
    }

    case 'session/updateCommitted': {
      if (state.pendingVersion === null) return state
      const displayVersion = state.pendingVersion
      const preparedVersion =
        state.preparedVersion?.contentHash === displayVersion.contentHash
          ? state.preparedVersion
          : null
      return {
        ...state,
        status: 'ready',
        displayVersion,
        pendingVersion: null,
        preparedVersion,
        generation: state.generation + 1,
        error: null,
        updatePosition: action.position ?? null,
      }
    }

    case 'session/displayReplaced': {
      documentModelCache.put({
        docId: state.docId,
        contentHash: action.version.contentHash,
        rawText: action.text ?? null,
        data: {},
      })
      return {
        ...state,
        status: 'ready',
        displayVersion: action.version,
        observedVersion: action.version,
        pendingVersion: null,
        preparedVersion: null,
        generation: state.generation + 1,
        error: null,
        updatePosition: null,
      }
    }

    case 'session/unavailable': {
      // INV-DS-06: keep the last displayed version; stop trusting new reads.
      return { ...state, status: 'unavailable' }
    }

    case 'session/recovered': {
      return { ...state, status: 'ready', error: null }
    }

    case 'session/invalidated': {
      return { ...state, generation: state.generation + 1 }
    }

    default: {
      return state
    }
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectDocId = (state: DocumentSessionState): string => state.docId

export const selectStatus = (state: DocumentSessionState): SessionStatus => state.status

export const selectGeneration = (state: DocumentSessionState): number => state.generation

export const selectDisplayVersion = (state: DocumentSessionState): VersionInfo | null =>
  state.displayVersion

export const selectObservedVersion = (state: DocumentSessionState): VersionInfo | null =>
  state.observedVersion

export const selectPendingVersion = (state: DocumentSessionState): VersionInfo | null =>
  state.pendingVersion

/** INV-VC-05: the "new version" marker is visible iff pending ≠ display. */
export const selectHasPendingUpdate = (state: DocumentSessionState): boolean =>
  state.pendingVersion !== null &&
  state.pendingVersion.contentHash !== state.displayVersion?.contentHash

/** True once the display version's version-bound render result has committed. */
export const selectIsDisplayPrepared = (state: DocumentSessionState): boolean =>
  state.displayVersion !== null &&
  state.preparedVersion?.contentHash === state.displayVersion.contentHash

export const selectError = (state: DocumentSessionState): ErrorPayload | null => state.error

export const selectUpdatePosition = (
  state: DocumentSessionState,
): UpdatePositionResult | null => state.updatePosition
