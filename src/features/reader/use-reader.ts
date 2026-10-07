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
import type { ParseDocumentOptions } from '../../document/types'
import { isWriteBackSuppressed, resumeSuppressedWrites } from '../../app/write-suppression'
import {
  PaperStackError,
  app,
  files,
  settings,
  storage,
  toErrorPayload,
  tree,
  watch,
} from '../../services'
import type {
  DirectoryRoot,
  ErrorPayload,
  OpenEntry,
  OpenOutcome,
  OpenRequest,
  RecentEntry,
  SaveResult,
  SyntaxMode,
  UpdateMode,
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
  tabDocReplace,
  tabOpen,
  tabPhase,
  tabSessionAction,
  tabView,
  type ReaderAction,
  type ReaderState,
  type ReaderTab,
  type ReaderViewMode,
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

/** Result of an in-tab document-link navigation (models §5.2). */
export interface NavigateDocumentResult {
  docId: string
  anchorId: string | null
}

export interface ReaderControls {
  state: ReaderState
  openErrors: OpenFailure[]
  clearOpenErrors(): void
  /** True when the quit-time session save failed and the window was kept open. */
  closeSaveFailed: boolean
  /** Currently opened directory root for the file tree (one at a time). */
  directory: DirectoryRoot | null
  /** Message key of the last relink outcome (welcome “原文件不可用” flow). */
  relinkNotice: string | null
  clearRelinkNotice(): void
  pickAndOpen(): Promise<void>
  pickDirectory(): Promise<void>
  openPaths(paths: readonly string[], entry: OpenEntry): Promise<void>
  /**
   * Cross-file link navigation in the current tab (models §5.2; R15/R16): the
   * target replaces this tab's document, never opening a new tab. Returns null
   * (and records the failure) when the target is rejected/cancelled, so the
   * caller can leave the history stack untouched.
   */
  navigateDocument(
    tabId: string,
    canonicalPath: string,
    anchorId: string | null,
  ): Promise<NavigateDocumentResult | null>
  openRequest(request: OpenRequest): Promise<void>
  relinkRecent(entry: RecentEntry): Promise<void>
  activateTab(tabId: string): void
  closeTab(tabId: string): void
  closeActiveTab(): void
  cycleTab(delta: number): void
  cancelTab(tabId: string): void
  retryTab(tabId: string): void
  setBannerCollapsed(tabId: string, collapsed: boolean): void
  setViewMode(tabId: string, mode: ReaderViewMode): void
  /** Settings change: re-parse the displayed version in place (no disk read). */
  applySyntaxMode(mode: SyntaxMode): void
  /** Session-scoped inline-dollar switch (ui-spec §3.7), default true. */
  inlineMathFor(tabId: string): boolean
  setInlineMath(tabId: string, enabled: boolean): void
  /** Session-scoped update-mode override; `null` = follow the global default. */
  updateModeOverrideFor(tabId: string): UpdateMode | null
  setUpdateModeOverride(tabId: string, mode: UpdateMode): void
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
const DEFAULT_SYNTAX_MODE: SyntaxMode = 'technical'

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
  const [directory, setDirectory] = useState<DirectoryRoot | null>(null)
  const [relinkNotice, setRelinkNotice] = useState<string | null>(null)
  const syntaxModeRef = useRef<SyntaxMode>(DEFAULT_SYNTAX_MODE)
  const inlineMathRef = useRef(new Map<string, boolean>())
  const [inlineMathByTab, setInlineMathByTab] = useState<Record<string, boolean>>({})
  const [updateModeByTab, setUpdateModeByTab] = useState<Record<string, UpdateMode>>({})
  const refreshingRef = useRef(new Set<string>())
  const closeAttemptedRef = useRef(false)

  /**
   * Per-tab parse options for the single pipeline: the global syntax mode
   * plus the current document's inline-dollar override (ui-spec §3.7). The
   * inline map mirrors into the ref so async parse callbacks always read the
   * latest value; the state copy drives the settings UI re-render.
   */
  const parseOptionsFor = useCallback(
    (tabId: string): ParseDocumentOptions => ({
      mode: syntaxModeRef.current,
      inlineMath: inlineMathRef.current.get(tabId) ?? true,
    }),
    [],
  )

  // Settings: syntax mode feeds the parse options; a failure keeps defaults.
  useEffect(() => {
    let cancelled = false
    void settings
      .getSettings()
      .then((bundle) => {
        if (cancelled) return
        syntaxModeRef.current = bundle.global.syntaxMode
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
    async (
      tabId: string,
      docId: string,
      text: string,
      version: VersionInfo,
      generation: number,
    ) => {
      const taskId = nextTaskId('parse')
      const token = { docId, version: version.contentHash, generation, taskId }
      try {
        const { result } = await parseDocumentWithFallback(
          text,
          { taskId, generation, docId },
          parseOptionsFor(tabId),
        )
        dispatchSession(
          tabId,
          sessionTaskSucceeded(token, version, { text, data: { parseResult: result } }),
        )
      } catch (error) {
        if (error instanceof TaskAbortedError) return
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [dispatchSession, parseOptionsFor],
  )

  /**
   * Re-renders the currently displayed version with the latest syntax
   * options. It parses the cached in-memory text for the same
   * `displayVersion`/generation, so no disk read happens and the commit rule
   * (§6.3) treats it as a display-bound result of the same version.
   */
  const reparseTab = useCallback(
    async (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      const version = tab?.session.displayVersion ?? null
      if (!tab || version === null) return
      const rawText = documentModelCache.get(tab.docId, version.contentHash)?.rawText ?? null
      if (rawText === null) return
      const taskId = nextTaskId('reparse')
      const token: TaskToken = {
        docId: tab.docId,
        version: version.contentHash,
        generation: tab.session.generation,
        taskId,
      }
      try {
        const { result } = await parseDocumentWithFallback(
          rawText,
          { taskId, generation: tab.session.generation, docId: tab.docId },
          parseOptionsFor(tabId),
        )
        dispatchSession(
          tabId,
          sessionTaskSucceeded(token, version, { text: rawText, data: { parseResult: result } }),
        )
      } catch (error) {
        if (error instanceof TaskAbortedError) return
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [dispatchSession, parseOptionsFor],
  )

  /** Settings syntax change: re-render every displayed version in place (R08). */
  const applySyntaxMode = useCallback(
    (mode: SyntaxMode) => {
      if (syntaxModeRef.current === mode) return
      syntaxModeRef.current = mode
      for (const tab of stateRef.current.tabs) {
        if (tab.session.displayVersion !== null) void reparseTab(tab.tabId)
      }
    },
    [reparseTab],
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
      let acceptedAny = false
      for (const outcome of result.items) {
        const docId = outcomeDocId(outcome)
        if (outcome.status === 'rejected') {
          if (outcome.error) failures.push({ path: outcome.path, error: outcome.error })
          continue
        }
        if (!docId) continue
        acceptedAny = true
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
      // Explicit open (entry != restore) lifts the cleared-category write
      // suppression, exactly like models §9.1 (`resume_recording` alternative).
      if (acceptedAny && entry !== 'restore') resumeSuppressedWrites()
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

  /**
   * “打开目录” (Ctrl+Shift+O): the picker result never authorizes by itself;
   * `tree.openDirectory` creates the session-scoped root used by the file
   * tree service (contracts §8/§9, R25). Cancel changes nothing.
   */
  const pickDirectory = useCallback(async () => {
    try {
      const picked = await files.pickDirectory()
      if (picked.cancelled || picked.paths.length === 0) return
      const root = await tree.openDirectory({ path: picked.paths[0], persist: false })
      setDirectory(root)
    } catch (error) {
      setOpenErrors([{ path: '', error: toErrorPayload(error) }])
    }
  }, [])

  /**
   * Unavailable recents relink (ui-spec §3.1): re-select through the system
   * picker, attempt `relink_document` for the known docId when the document is
   * still registered, and always open the chosen file afterwards. Cancel
   * leaves every state unchanged.
   */
  const relinkRecent = useCallback(
    async (entry: RecentEntry) => {
      let picked
      try {
        picked = await files.pickFiles()
      } catch (error) {
        setOpenErrors([{ path: '', error: toErrorPayload(error) }])
        return
      }
      if (picked.cancelled || picked.paths.length === 0) return
      const newPath = picked.paths[0]
      try {
        const result = await files.relinkDocument({ docId: entry.docId, newPath })
        setRelinkNotice(
          result.status === 'reassociated'
            ? 'document.relink.reassociated'
            : 'document.relink.newVersion',
        )
      } catch {
        // The record may come from an earlier session; the explicit
        // re-selection below is still the user's decision.
        setRelinkNotice(null)
      }
      await openPaths([newPath], 'recent')
    },
    [openPaths],
  )

  const openRequest = useCallback(
    async (request: OpenRequest) => {
      await openPaths(request.paths, request.source === 'cli' ? 'cli' : 'system')
    },
    [openPaths],
  )

  /**
   * Current-tab document navigation for relative links and history restore
   * (models §5.2; "跨文档相对链接：默认当前标签导航"). The target is validated
   * through the same `open_documents` entry point as every other open; a
   * rejected target consumes no history and changes nothing.
   */
  const navigateDocument = useCallback(
    async (
      tabId: string,
      canonicalPath: string,
      anchorId: string | null,
    ): Promise<NavigateDocumentResult | null> => {
      let result
      try {
        result = await files.openDocuments({ paths: [canonicalPath], entry: 'system' })
      } catch (error) {
        setOpenErrors([{ path: canonicalPath, error: toErrorPayload(error) }])
        return null
      }
      const outcome = result.items[0]
      if (!outcome || outcome.status === 'rejected') {
        if (outcome?.error) setOpenErrors([{ path: canonicalPath, error: outcome.error }])
        return null
      }
      const docId = outcome.docId ?? outcome.duplicateOfDocId
      if (!docId) return null
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return null
      if (tab.docId === docId) return { docId, anchorId }

      // A duplicate outcome omits the identity; the already-open tab holds it.
      const existing = stateRef.current.tabs.find((candidate) => candidate.docId === docId)
      const identity =
        outcome.identity ??
        (existing
          ? { canonicalPath: existing.canonicalPath, displayName: existing.displayName }
          : null)
      if (!identity) return null

      const generation = tab.session.generation + 1 // session/opened advances §6.1
      send(
        tabDocReplace(tabId, {
          docId,
          canonicalPath: identity.canonicalPath,
          displayName: identity.displayName,
        }),
      )
      void startRead(tabId, docId, 'initial', generation)
      return { docId, anchorId }
    },
    [send, startRead],
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

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      send(tabClose(tabId))
      inlineMathRef.current.delete(tabId)
      setInlineMathByTab((previous) => {
        if (!(tabId in previous)) return previous
        const next = { ...previous }
        delete next[tabId]
        return next
      })
      setUpdateModeByTab((previous) => {
        if (!(tabId in previous)) return previous
        const next = { ...previous }
        delete next[tabId]
        return next
      })
      if (tab) void watch.unwatchDocument(tab.docId).catch(() => undefined)
    },
    [send],
  )

  const closeActiveTab = useCallback(() => {
    const active = selectActiveTab(stateRef.current)
    if (active) closeTab(active.tabId)
  }, [closeTab])

  const cycleTab = useCallback(
    (delta: number) => {
      const tabId = selectCycleTabId(stateRef.current, delta)
      if (tabId) send(tabActivate(tabId))
    },
    [send],
  )

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

  const setViewMode = useCallback(
    (tabId: string, mode: ReaderViewMode) => {
      send(tabView(tabId, mode))
    },
    [send],
  )

  /** Inline-dollar switch for the current document (session-scoped). */
  const setInlineMath = useCallback(
    (tabId: string, enabled: boolean) => {
      inlineMathRef.current.set(tabId, enabled)
      setInlineMathByTab((previous) => ({ ...previous, [tabId]: enabled }))
      void reparseTab(tabId)
    },
    [reparseTab],
  )

  const inlineMathFor = useCallback(
    (tabId: string): boolean => inlineMathByTab[tabId] ?? true,
    [inlineMathByTab],
  )

  /** Update-mode override for the current document (session-scoped). */
  const setUpdateModeOverride = useCallback((tabId: string, mode: UpdateMode) => {
    setUpdateModeByTab((previous) => ({ ...previous, [tabId]: mode }))
  }, [])

  const updateModeOverrideFor = useCallback(
    (tabId: string): UpdateMode | null => updateModeByTab[tabId] ?? null,
    [updateModeByTab],
  )

  const clearRelinkNotice = useCallback(() => setRelinkNotice(null), [])

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
    // Cleared-session suppression (models §9.1): no write, no error — the
    // quit path must not rebuild what the user just cleared (INV-WB-02).
    if (isWriteBackSuppressed('session')) return { saved: false }
    try {
      return await storage.saveSession({ tabs: buildSessionTabs(stateRef.current) })
    } catch (error) {
      return { saved: false, error: toErrorPayload(error) }
    }
  }, [])

  const handleCloseRequested = useCallback(
    async (event: { preventDefault(): void }) => {
      const result = await saveSession()
      if (!result.saved && result.error !== undefined && !closeAttemptedRef.current) {
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
    directory,
    relinkNotice,
    clearRelinkNotice,
    pickAndOpen,
    pickDirectory,
    openPaths,
    navigateDocument,
    openRequest,
    relinkRecent,
    activateTab,
    closeTab,
    closeActiveTab,
    cycleTab,
    cancelTab,
    retryTab,
    setBannerCollapsed,
    setViewMode,
    applySyntaxMode,
    inlineMathFor,
    setInlineMath,
    updateModeOverrideFor,
    setUpdateModeOverride,
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
