import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  documentModelCache,
  sessionInvalidated,
  sessionReadSucceeded,
  sessionTaskFailed,
  sessionTaskSucceeded,
  sessionUnavailable,
  type SessionAction,
  type TaskToken,
} from '../../app/session'
import { TaskAbortedError, parseDocumentWithFallback } from '../../document/worker/client'
import type { PipelineMode } from '../../document/types'
import { PaperStackError, app, files, settings, storage, toErrorPayload, watch } from '../../services'
import type {
  ErrorPayload,
  OpenEntry,
  OpenOutcome,
  OpenRequest,
  SaveResult,
  VersionInfo,
  WatchChangedPayload,
} from '../../services/types'
import {
  INITIAL_READER_STATE,
  buildSessionTabs,
  createReaderTab,
  readerReducer,
  selectActiveTab,
  selectCycleTabId,
  selectTabByDocId,
  tabActivate,
  tabBanner,
  tabClose,
  tabOpen,
  tabPhase,
  tabSessionAction,
  type ReaderAction,
  type ReaderState,
  type ReaderTab,
} from './reader-state'

/**
 * Reader orchestration for wp-19 (ui-spec §3.2 minimal; models §1/§2/§7):
 * opening initial documents (startup queue + dialog + drop/event), reading via
 * `read_document`, parsing through the Worker pipeline, the loading/error
 * phases, tab lifecycle and the best-effort session save used by the quit
 * path.
 *
 * All commits go through the wp-16 session reducer (contract §6): late reads,
 * parses and refreshes are dropped without visible effect. The update banner
 * only records `pendingVersion` (keep mode); submitting an update belongs to
 * wp-29 and is not faked here.
 */

export interface OpenFailure {
  path: string
  error: ErrorPayload
}

export interface ReaderControls {
  state: ReaderState
  openErrors: OpenFailure[]
  clearOpenErrors(): void
  /** True when the quit-time session save failed and the window was kept open. */
  closeSaveFailed: boolean
  pickAndOpen(): Promise<void>
  openPaths(paths: readonly string[], entry: OpenEntry): Promise<void>
  openRequest(request: OpenRequest): Promise<void>
  activateTab(tabId: string): void
  closeTab(tabId: string): void
  closeActiveTab(): void
  cycleTab(delta: number): void
  cancelTab(tabId: string): void
  retryTab(tabId: string): void
  setBannerCollapsed(tabId: string, collapsed: boolean): void
  handleWatchChanged(payload: WatchChangedPayload): void
  recheckActive(): void
  saveSession(): Promise<SaveResult>
  handleCloseRequested(event: { preventDefault(): void }): Promise<void>
}

let tabSequence = 0
let taskSequence = 0

function nextTabId(): string {
  tabSequence += 1
  return `tab-${tabSequence}`
}

function nextTaskId(prefix: string): string {
  taskSequence += 1
  return `${prefix}-${taskSequence}`
}

/** Default syntax options until settings are loaded (contract §3.5 defaults). */
const DEFAULT_SYNTAX: { mode: PipelineMode; inlineMath: boolean } = {
  mode: 'technical',
  inlineMath: true,
}

export function useReader(): ReaderControls {
  const [state, dispatch] = useReducer(readerReducer, INITIAL_READER_STATE)
  const stateRef = useRef(state)
  /**
   * Single dispatch entry: the ref advances synchronously with the same pure
   * reducer, so promise callbacks always observe the latest committed-or-
   * dispatched state (React may batch a preceding dispatch past an `await`).
   */
  const send = useCallback((action: ReaderAction) => {
    stateRef.current = readerReducer(stateRef.current, action)
    dispatch(action)
  }, [])
  const [openErrors, setOpenErrors] = useState<OpenFailure[]>([])
  const [closeSaveFailed, setCloseSaveFailed] = useState(false)
  const syntaxRef = useRef(DEFAULT_SYNTAX)
  const refreshingRef = useRef(new Set<string>())
  const closeAttemptedRef = useRef(false)

  // Settings: syntax mode feeds the parse options; a failure keeps defaults.
  useEffect(() => {
    let cancelled = false
    void settings
      .getSettings()
      .then((bundle) => {
        if (cancelled) return
        syntaxRef.current = {
          mode: bundle.global.syntaxMode,
          inlineMath: true,
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const dispatchSession = useCallback(
    (tabId: string, action: SessionAction) => {
      send(tabSessionAction(tabId, action))
    },
    [send],
  )

  const startParse = useCallback(
    async (tabId: string, docId: string, text: string, version: VersionInfo, generation: number) => {
      const taskId = nextTaskId('parse')
      const token = { docId, version: version.contentHash, generation, taskId }
      try {
        const { result } = await parseDocumentWithFallback(
          text,
          { taskId, generation, docId },
          syntaxRef.current,
        )
        dispatchSession(tabId, sessionTaskSucceeded(token, version, { text, data: { parseResult: result } }))
      } catch (error) {
        if (error instanceof TaskAbortedError) return
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [dispatchSession],
  )

  const startRead = useCallback(
    async (tabId: string, docId: string, purpose: 'initial' | 'refresh', generation: number) => {
      const token: TaskToken = { docId, version: null, generation, taskId: nextTaskId('read') }
      if (purpose === 'initial') send(tabPhase(tabId, 'reading', null))
      try {
        const snapshot = await files.readDocument({ docId, purpose })
        const current = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
        if (!current || current.session.generation !== generation) return
        dispatchSession(tabId, sessionReadSucceeded(token, snapshot.version, snapshot.text))
        if (purpose === 'initial') {
          void watch.watchDocument({ docId }).catch(() => undefined)
          void startParse(tabId, docId, snapshot.text, snapshot.version, generation)
        }
      } catch (error) {
        if (PaperStackError.is(error) && error.isCancelled) return
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [dispatchSession, startParse, send],
  )

  const openPaths = useCallback(
    async (paths: readonly string[], entry: OpenEntry) => {
      if (paths.length === 0) return
      let result
      try {
        result = await files.openDocuments({ paths: [...paths], entry })
      } catch (error) {
        setOpenErrors([{ path: '', error: toErrorPayload(error) }])
        return
      }
      const failures: OpenFailure[] = []
      let activationUsed = false
      for (const outcome of result.items) {
        const docId = outcomeDocId(outcome)
        if (outcome.status === 'rejected') {
          if (outcome.error) failures.push({ path: outcome.path, error: outcome.error })
          continue
        }
        if (!docId) continue
        const existing = stateRef.current.tabs.find((tab) => tab.docId === docId)
        if (existing) {
          if (!activationUsed) {
            activationUsed = true
            send(tabActivate(existing.tabId))
          }
          continue
        }
        if (!outcome.identity) continue
        const tab = createReaderTab({
          tabId: nextTabId(),
          docId,
          canonicalPath: outcome.identity.canonicalPath,
          displayName: outcome.identity.displayName,
        })
        const activate = !activationUsed
        if (activate) activationUsed = true
        send(tabOpen(tab, activate))
        void startRead(tab.tabId, docId, 'initial', tab.session.generation)
      }
      setOpenErrors(failures)
    },
    [startRead, send],
  )

  const pickAndOpen = useCallback(async () => {
    try {
      const picked = await files.pickFiles()
      if (picked.cancelled) return
      await openPaths(picked.paths, 'dialog')
    } catch (error) {
      setOpenErrors([{ path: '', error: toErrorPayload(error) }])
    }
  }, [openPaths])

  const openRequest = useCallback(
    async (request: OpenRequest) => {
      await openPaths(request.paths, request.source === 'cli' ? 'cli' : 'system')
    },
    [openPaths],
  )

  // Startup queue: drained exactly once; later requests arrive as events.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const pending = await app.takePendingOpenRequests()
        if (cancelled) return
        for (const request of pending) await openRequest(request)
      } catch (error) {
        if (!cancelled) setOpenErrors([{ path: '', error: toErrorPayload(error) }])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openRequest])

  const activateTab = useCallback(
    (tabId: string) => {
      send(tabActivate(tabId))
    },
    [send],
  )

  const closeTab = useCallback((tabId: string) => {
    const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
    send(tabClose(tabId))
    if (tab) void watch.unwatchDocument(tab.docId).catch(() => undefined)
  }, [send])

  const closeActiveTab = useCallback(() => {
    const active = selectActiveTab(stateRef.current)
    if (active) closeTab(active.tabId)
  }, [closeTab])

  const cycleTab = useCallback((delta: number) => {
    const tabId = selectCycleTabId(stateRef.current, delta)
    if (tabId) send(tabActivate(tabId))
  }, [send])

  const cancelTab = useCallback(
    (tabId: string) => {
      dispatchSession(tabId, sessionInvalidated())
      send(tabPhase(tabId, 'cancelled', null))
    },
    [dispatchSession, send],
  )

  const retryTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
      send(tabPhase(tabId, 'reading', null))
      void startRead(tabId, tab.docId, 'initial', tab.session.generation)
    },
    [startRead, send],
  )

  const setBannerCollapsed = useCallback(
    (tabId: string, collapsed: boolean) => {
      send(tabBanner(tabId, collapsed))
    },
    [send],
  )

  const refreshTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
      if (refreshingRef.current.has(tabId)) return
      refreshingRef.current.add(tabId)
      void startRead(tabId, tab.docId, 'refresh', tab.session.generation).finally(() =>
        refreshingRef.current.delete(tabId),
      )
    },
    [startRead],
  )

  const handleWatchChanged = useCallback(
    (payload: WatchChangedPayload) => {
      const tab = selectTabByDocId(stateRef.current, payload.docId)
      if (!tab) return
      // Resource-only changes re-mount one block later (wp-26/wp-29); they
      // never produce a document update banner (INV-VC-07).
      if (payload.kind === 'resource') return
      if (payload.kind === 'removed') {
        dispatchSession(tab.tabId, sessionUnavailable())
        return
      }
      refreshTab(tab.tabId)
    },
    [dispatchSession, refreshTab],
  )

  const recheckActive = useCallback(() => {
    const active = selectActiveTab(stateRef.current)
    if (!active) return
    if (active.session.status === 'loading' || active.phase === 'reading') return
    refreshTab(active.tabId)
  }, [refreshTab])

  const saveSession = useCallback(async (): Promise<SaveResult> => {
    try {
      return await storage.saveSession({ tabs: buildSessionTabs(stateRef.current) })
    } catch (error) {
      return { saved: false, error: toErrorPayload(error) }
    }
  }, [])

  const handleCloseRequested = useCallback(
    async (event: { preventDefault(): void }) => {
      const result = await saveSession()
      if (!result.saved && !closeAttemptedRef.current) {
        // Surface the failure honestly and keep the window open; the next
        // close request proceeds (records are best-effort, R27/NF08).
        closeAttemptedRef.current = true
        event.preventDefault()
        setCloseSaveFailed(true)
        return
      }
      closeAttemptedRef.current = false
    },
    [saveSession],
  )

  const clearOpenErrors = useCallback(() => setOpenErrors([]), [])

  return {
    state,
    openErrors,
    clearOpenErrors,
    closeSaveFailed,
    pickAndOpen,
    openPaths,
    openRequest,
    activateTab,
    closeTab,
    closeActiveTab,
    cycleTab,
    cancelTab,
    retryTab,
    setBannerCollapsed,
    handleWatchChanged,
    recheckActive,
    saveSession,
    handleCloseRequested,
  }
}

function outcomeDocId(outcome: OpenOutcome): string | undefined {
  return outcome.docId ?? outcome.duplicateOfDocId
}

/** Cache lookup used by the view layer (heavy artifacts out of React state). */
export function displayDocumentModel(
  tab: ReaderTab,
): { rawText: string; parseResult: unknown } | undefined {
  const hash = tab.session.displayVersion?.contentHash
  if (!hash) return undefined
  const entry = documentModelCache.get(tab.docId, hash)
  if (!entry || entry.rawText === null) return undefined
  return { rawText: entry.rawText, parseResult: entry.data.parseResult }
}
