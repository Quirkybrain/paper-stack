import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { t } from '../../app/i18n'
import {
  createTaskToken,
  documentModelCache,
  sessionDisplayReplaced,
  sessionInvalidated,
  sessionReadSucceeded,
  sessionRecovered,
  sessionTaskFailed,
  sessionTaskSucceeded,
  sessionUnavailable,
  sessionUpdateCommitted,
  selectHasPendingUpdate,
  type SessionAction,
  type TaskToken,
  type UpdatePositionResult,
} from '../../app/session'
import { TaskAbortedError, parseDocumentWithFallback } from '../../document/worker/client'
import {
  classifyLargeDocument,
  isOverComplexityBudget,
  resolveLargeDocChoice,
  type LargeDocChoice,
  type LargeDocPromptReason,
} from '../../document/modes/modes'
import type { ParseDocumentOptions, ParseDocumentResult } from '../../document/types'
import { isWriteBackSuppressed, resumeSuppressedWrites } from '../../app/write-suppression'
import {
  PaperStackError,
  app,
  files,
  remote,
  settings,
  storage,
  toErrorPayload,
  tree,
  watch,
} from '../../services'
import type {
  AnchorRecord,
  DirectoryRoot,
  ErrorPayload,
  OpenEntry,
  OpenOutcome,
  OpenRequest,
  RecentEntry,
  RelinkResult,
  SaveResult,
  SessionSnapshot,
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
  tabLargeDoc,
  tabOpen,
  tabPhase,
  tabSessionAction,
  tabView,
  type ReaderAction,
  type ReaderState,
  type ReaderTab,
  type ReaderViewMode,
} from './reader-state'
import {
  buildAnchorRecord,
  createPositionController,
  restorePosition,
  LayoutStabilizer,
  type PositionController,
  type RestoreResult,
} from './position/position'
import {
  effectiveUpdateMode,
  positionMessageKey,
  resolveUpdateDecision,
  updatePositionForRestore,
} from './update/update-model'
import {
  drainPendingOpenRequests,
  openFromDirectoryDialog,
  openFromDrop,
  openFromFileDialog,
  openFromRequest,
  planOpenBatch,
  type OpenEntryHandlers,
  type OpenEntryServices,
} from './open/entry'
import { resourceAuth } from './resources/resource-auth'
import { resourceInvalidation } from './view/resource-invalidation'

/**
 * Reader orchestration (ui-spec §3.2; models §1/§2/§4/§6/§7):
 * opening initial documents (startup queue + dialog + drop/event), reading via
 * `read_document`, parsing through the Worker pipeline, the loading/error
 * phases, tab lifecycle, the best-effort session save used by the quit path,
 * and the wp-28/wp-29 flows consolidated here:
 *
 * - large-document modes (T-51/T-52): open-time size prompt, hard-limit
 *   source-window mode, simplified-reading subset and cancel;
 * - update flow (T-53): keep/follow decisions, banner state, explicit /
 *   automatic commits with paired position results;
 * - version correctness wiring (T-55): resource-only invalidation, relink
 *   adoption, close-during-task discard;
 * - anchor save/restore (T-54): throttled writes through the suppression
 *   mirror and the §6 decision tree.
 *
 * All commits go through the wp-16 session reducer (contract §6): late reads,
 * parses and refreshes are dropped without visible effect. The update policy
 * (`update-model.ts`) decides *when* to commit; it never bypasses the token /
 * generation rule.
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

/** Open-time large-document prompt state (rendering-pipeline §5). */
export interface LargeDocPromptState {
  sizeBytes: number
  reason: LargeDocPromptReason
  /** `open` cancels by closing the tab; `complexity` keeps the full render. */
  origin: 'open' | 'complexity'
}

/** Paired update-commit outcome (INV-VC-11 / INV-UM-08). */
export interface UpdateCommitOutcome {
  position: UpdatePositionResult
  blockId: string | null
  messageKey: 'update.position.exact' | 'update.position.approx'
}

export interface UpdateCommitNotice extends UpdateCommitOutcome {
  /** Bumped per commit so the view can re-run its one-shot scroll effect. */
  nonce: number
}

export interface ReaderControls {
  state: ReaderState
  openErrors: OpenFailure[]
  clearOpenErrors(): void
  /** Records a surface-level command failure (e.g. authorization dialogs). */
  reportOpenError(error: ErrorPayload): void
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
  /** Drag-and-drop entry (`tauri://drag-drop`): validated per item, never a command on its own. */
  openDrop(paths: readonly string[]): Promise<void>
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
  /**
   * Unavailable-source relink for an open tab (ui-spec §3.8; R07; AT07):
   * picker → `relink_document` → adopt, or same-tab navigation when the
   * document is not registered yet. Cancel changes nothing.
   */
  relinkTab(tabId: string): Promise<void>
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
  /** Effective mode for the tab: override or global default (INV-UM-07). */
  updateModeFor(tabId: string): UpdateMode
  /** Global settings sync from the settings host (default mode + records). */
  syncGlobalSettings(next: { updateModeDefault?: UpdateMode; rememberRecords?: boolean }): void
  handleWatchChanged(payload: WatchChangedPayload): void
  /**
   * Window-focus compensation (contracts §7.5; models §3.2 W7): stat-check
   * the active tab and every open document, since a watch event may have been
   * missed while the window was unfocused. Background candidates stay staged
   * until activation (INV-UM-04).
   */
  recheckOpenTabs(): void
  saveSession(): Promise<SaveResult>
  handleCloseRequested(event: { preventDefault(): void }): Promise<void>

  // -------------------------------------------------------------------------
  // Large-document modes (T-51/T-52)
  // -------------------------------------------------------------------------
  largeDocPromptFor(tabId: string): LargeDocPromptState | null
  chooseLargeDoc(tabId: string, choice: LargeDocChoice): void
  cancelLargeDoc(tabId: string): void

  // -------------------------------------------------------------------------
  // Update flow (T-53)
  // -------------------------------------------------------------------------
  /** A non-empty document selection currently exists (INV-UM-03). */
  selectionPresent: boolean
  setInspectLayerActive(tabId: string, active: boolean): void
  inspectLayerActiveFor(tabId: string): boolean
  isPauseDismissed(tabId: string): boolean
  dismissUpdatePause(tabId: string): void
  /**
   * Commits the tab's pending candidate through the §6 commit rule. `clearSelection`
   * is only set by the explicit "更新并清除选区" action. Returns null when the
   * candidate is gone or a stale parse result arrived (zero visible effect).
   */
  commitUpdate(
    tabId: string,
    options?: { clearSelection?: boolean },
  ): Promise<UpdateCommitOutcome | null>
  commitNoticeFor(tabId: string): UpdateCommitNotice | null
  dismissCommitNotice(tabId: string): void

  // -------------------------------------------------------------------------
  // Anchors / positions (T-54)
  // -------------------------------------------------------------------------
  observePosition(tabId: string, anchor: AnchorRecord): void
  flushPosition(tabId: string): void
  /** Latest in-memory anchor (layout correction landing point). */
  positionAnchorFor(tabId: string): AnchorRecord | null
  /** One-shot restart position restore from a committed record (AT19). */
  takePendingPositionRestore(tabId: string): RestoreResult | null
  /** Bumped when a restart position restore is queued for the view. */
  positionRestoreNonce: number
  /** Latest position-save failure, shown with a retry action (INV-AR-07). */
  positionError: ErrorPayload | null
  clearPositionError(): void
  retryPositionSave(tabId: string): void
  /** Single layout-stabilization correction signal (INV-AR-05). */
  layoutCorrectionTick: number
  notifyLayoutChange(): void
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

/**
 * Injected command surface for the entry adapters (contracts commands 1, 2, 4,
 * 9, 35). Module-level so the adapters and the startup drain keep stable
 * identities across renders.
 */
const ENTRY_SERVICES: OpenEntryServices = {
  pickFiles: () => files.pickFiles(),
  pickDirectory: () => files.pickDirectory(),
  openDocuments: (request) => files.openDocuments(request),
  openDirectory: (request) => tree.openDirectory(request),
  takePendingOpenRequests: () => app.takePendingOpenRequests(),
}

function documentSelectionPresent(): boolean {
  if (typeof window === 'undefined') return false
  return (window.getSelection()?.toString() ?? '').length > 0
}

function clearDocumentSelection(): void {
  if (typeof window === 'undefined') return
  window.getSelection()?.removeAllRanges()
}

/** Synthetic error for a restored source that cannot be resolved/opened. */
function missingSourceError(): ErrorPayload {
  return {
    code: 'PS_IO_NOT_FOUND',
    category: 'io',
    messageKey: 'error.io.notFound',
    retryable: true,
  }
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
  const [directory, setDirectory] = useState<DirectoryRoot | null>(null)
  const [relinkNotice, setRelinkNotice] = useState<string | null>(null)
  const syntaxModeRef = useRef<SyntaxMode>(DEFAULT_SYNTAX_MODE)
  const rememberRecordsRef = useRef(true)
  const updateModeDefaultRef = useRef<UpdateMode>('keep')
  const inlineMathRef = useRef(new Map<string, boolean>())
  const [inlineMathByTab, setInlineMathByTab] = useState<Record<string, boolean>>({})
  const [updateModeByTab, setUpdateModeByTab] = useState<Record<string, UpdateMode>>({})
  const updateModeByTabRef = useRef(updateModeByTab)
  const [updateModeDefault, setUpdateModeDefaultState] = useState<UpdateMode>('keep')
  const refreshingRef = useRef(new Set<string>())
  const closeAttemptedRef = useRef(false)

  // -------------------------------------------------------------------------
  // wp-28/wp-29 state: large-document prompts, update conditions, positions
  // -------------------------------------------------------------------------

  const [largeDocPrompts, setLargeDocPrompts] = useState<Record<string, LargeDocPromptState>>({})
  const largeDocPromptsRef = useRef(largeDocPrompts)
  const complexityDeclinedRef = useRef(new Set<string>())

  const [selectionPresent, setSelectionPresent] = useState(false)
  const selectionRef = useRef(false)
  const inspectLayerRef = useRef(new Set<string>())
  const [inspectLayerNonce, setInspectLayerNonce] = useState(0)
  const pauseDismissedRef = useRef(new Set<string>())
  const [pauseNonce, setPauseNonce] = useState(0)
  const [commitNotices, setCommitNotices] = useState<Record<string, UpdateCommitNotice>>({})

  const [positionError, setPositionError] = useState<ErrorPayload | null>(null)
  /**
   * Restart position restores computed from committed `PositionRecord`s
   * (models §6/§10; AT19). Entries are one-shot: the view consumes each the
   * first time the owning tab is active and ready.
   */
  const [positionRestoreNonce, setPositionRestoreNonce] = useState(0)
  const pendingPositionRestoresRef = useRef(new Map<string, RestoreResult>())
  // Created in an effect (never during render) so the controller owns timers
  // without reading refs while rendering; callbacks access it through the ref.
  const positionControllerRef = useRef<PositionController | null>(null)
  useEffect(() => {
    const controller = createPositionController({
      savePosition: (request) => storage.savePosition(request),
      isSuppressed: () => isWriteBackSuppressed('positions'),
      rememberRecords: () => rememberRecordsRef.current,
      onError: (error) => setPositionError(error),
    })
    positionControllerRef.current = controller
    return () => {
      positionControllerRef.current = null
      controller.dispose()
    }
  }, [])

  const [layoutCorrectionTick, setLayoutCorrectionTick] = useState(0)
  const stabilizerRef = useRef<LayoutStabilizer | null>(null)
  useEffect(() => {
    const stabilizer = new LayoutStabilizer()
    stabilizerRef.current = stabilizer
    const unsubscribe = stabilizer.onCorrect(() => setLayoutCorrectionTick((tick) => tick + 1))
    return () => {
      unsubscribe()
      stabilizer.dispose()
      stabilizerRef.current = null
    }
  }, [])
  const notifyLayoutChange = useCallback(() => {
    stabilizerRef.current?.request()
  }, [])

  const maybeAutoCommitRef = useRef<(tabId: string) => void>(() => {})

  const setPrompt = useCallback(
    (tabId: string, prompt: LargeDocPromptState) => {
      largeDocPromptsRef.current = { ...largeDocPromptsRef.current, [tabId]: prompt }
      setLargeDocPrompts(largeDocPromptsRef.current)
    },
    [setLargeDocPrompts],
  )

  const removePrompt = useCallback(
    (tabId: string) => {
      if (!(tabId in largeDocPromptsRef.current)) return
      const next = { ...largeDocPromptsRef.current }
      delete next[tabId]
      largeDocPromptsRef.current = next
      setLargeDocPrompts(next)
    },
    [setLargeDocPrompts],
  )

  /**
   * Per-tab parse options for the single pipeline: the global syntax mode,
   * the current document's inline-dollar override (ui-spec §3.7), the
   * simplified-reading subset when that mode was chosen (R29), and the
   * localized GFM footnote label (B-03: generated UI text never hardcodes an
   * English default).
   */
  const parseOptionsFor = useCallback(
    (tabId: string): ParseDocumentOptions => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      return {
        mode: syntaxModeRef.current,
        inlineMath: inlineMathRef.current.get(tabId) ?? true,
        simplified: tab?.largeDocMode === 'simplified',
        footnoteLabel: t('document.footnoteLabel'),
      }
    },
    [],
  )

  // Settings: syntax mode feeds the parse options; update defaults and the
  // records preference feed the update/anchor flows. A failure keeps defaults.
  useEffect(() => {
    let cancelled = false
    void settings
      .getSettings()
      .then((bundle) => {
        if (cancelled) return
        syntaxModeRef.current = bundle.global.syntaxMode
        rememberRecordsRef.current = bundle.global.rememberRecords
        updateModeDefaultRef.current = bundle.global.updateModeDefault
        setUpdateModeDefaultState(bundle.global.updateModeDefault)
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

  /**
   * Consumes the committed `PositionRecord` of a restored tab (models §6/§10;
   * R19/AT19). The §6.2 decision tree decides exact vs approximate against the
   * *displayed* version's blocks; the outcome is queued for the view, which
   * scrolls and labels it honestly. `rememberRecords=false` keeps positions
   * in memory only, so no stored record is restored (INV-AR-08).
   */
  const applyStoredPosition = useCallback(
    async (
      tabId: string,
      docId: string,
      version: VersionInfo,
      parseResult: ParseDocumentResult | undefined,
    ) => {
      if (!rememberRecordsRef.current) return
      let record
      try {
        record = await storage.loadPosition(docId)
      } catch {
        return
      }
      if (record === null) return
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab || tab.docId !== docId) return
      if (tab.session.displayVersion?.contentHash !== version.contentHash) return
      const restore = restorePosition({
        anchor: record.anchor,
        targetVersionHash: version.contentHash,
        blocks: parseResult?.blocks ?? [],
      })
      pendingPositionRestoresRef.current.set(tabId, restore)
      setPositionRestoreNonce((nonce) => nonce + 1)
    },
    [],
  )

  const startParse = useCallback(
    async (
      tabId: string,
      docId: string,
      text: string,
      version: VersionInfo,
      generation: number,
      options: { restorePosition?: boolean } = {},
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
        // Restored tabs consume their committed position only after the parse
        // of the displayed version committed (models §10.1 T2; AT19).
        if (options.restorePosition) {
          void applyStoredPosition(tabId, docId, version, result)
        }
        // Complexity budget (rendering-pipeline §5): the first parse can reveal
        // an over-budget document that the size threshold did not catch. Offer
        // the same simplified/source choice once per version; declining keeps
        // the already-rendered full view and never re-prompts for this hash.
        const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
        if (
          tab &&
          tab.largeDocMode === 'full' &&
          largeDocPromptsRef.current[tabId] === undefined &&
          result.stats.blockCount + result.stats.segmentCount > 0 &&
          isOverComplexityBudget(result.stats)
        ) {
          const declineKey = `${tabId}:${version.contentHash}`
          if (!complexityDeclinedRef.current.has(declineKey)) {
            setPrompt(tabId, {
              sizeBytes: version.sizeBytes,
              reason: 'complexity',
              origin: 'complexity',
            })
          }
        }
      } catch (error) {
        if (error instanceof TaskAbortedError) return
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [applyStoredPosition, dispatchSession, parseOptionsFor, setPrompt],
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
    async (
      tabId: string,
      docId: string,
      purpose: 'initial' | 'restore' | 'refresh',
      generation: number,
      options: { skipParse?: boolean; restorePosition?: boolean } = {},
    ) => {
      const token: TaskToken = { docId, version: null, generation, taskId: nextTaskId('read') }
      if (purpose !== 'refresh') send(tabPhase(tabId, 'reading', null))
      try {
        const snapshot = await files.readDocument({ docId, purpose })
        const current = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
        if (!current || current.session.generation !== generation) return
        dispatchSession(tabId, sessionReadSucceeded(token, snapshot.version, snapshot.text))
        if (purpose !== 'refresh') {
          void watch.watchDocument({ docId }).catch(() => undefined)
          if (!options.skipParse) {
            void startParse(tabId, docId, snapshot.text, snapshot.version, generation, {
              restorePosition: purpose === 'restore' || options.restorePosition === true,
            })
          }
        } else {
          // A stable read observed a candidate (or the display hash again);
          // follow mode may now commit immediately (models §4.1).
          maybeAutoCommitRef.current(tabId)
        }
      } catch (error) {
        if (PaperStackError.is(error) && error.isCancelled) return
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [dispatchSession, startParse, send],
  )

  /**
   * >50MiB hard limit (rendering-pipeline §5): no full decode, no full IPC
   * transfer; only `get_source_info` establishes the display version for the
   * source-window mode (`read_source_window`/`search_source` then run inside
   * `SourceView`/the search session).
   */
  const startSourceWindow = useCallback(
    async (tabId: string, docId: string, generation: number) => {
      const token: TaskToken = { docId, version: null, generation, taskId: nextTaskId('source') }
      try {
        const info = await files.getSourceInfo(docId)
        const current = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
        if (!current || current.session.generation !== generation) return
        dispatchSession(tabId, sessionReadSucceeded(token, info.version))
        send(tabPhase(tabId, 'ready', null))
        void watch.watchDocument({ docId }).catch(() => undefined)
      } catch (error) {
        dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
      }
    },
    [dispatchSession, send],
  )

  const commitUpdate = useCallback(
    async (
      tabId: string,
      options: { clearSelection?: boolean } = {},
    ): Promise<UpdateCommitOutcome | null> => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      const pending = tab?.session.pendingVersion ?? null
      if (!tab || pending === null) return null
      const generation = tab.session.generation
      const cached = documentModelCache.get(tab.docId, pending.contentHash)
      const rawText = cached?.rawText ?? null
      if (rawText === null) return null

      let parseResult = cached?.data.parseResult as ParseDocumentResult | undefined
      const token = createTaskToken(tab.session, nextTaskId('update'), 'pending')
      if (parseResult === undefined) {
        if (token === null) return null
        try {
          const parsed = await parseDocumentWithFallback(
            rawText,
            { taskId: token.taskId, generation, docId: tab.docId },
            parseOptionsFor(tabId),
          )
          parseResult = parsed.result
        } catch (error) {
          if (error instanceof TaskAbortedError) return null
          // A pending-prefetch failure stays invisible (models §2.3): the
          // banner remains and the user can retry the read.
          dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
          return null
        }
      }

      // §6: a stale generation/candidate means the commit must be dropped with
      // zero visible effect (candidate replaced, tab closed, relinked).
      const current = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (
        !current ||
        current.session.generation !== generation ||
        current.session.pendingVersion?.contentHash !== pending.contentHash
      ) {
        return null
      }

      if (parseResult !== undefined && token !== null) {
        dispatchSession(
          tabId,
          sessionTaskSucceeded(token, pending, {
            text: rawText,
            data: { parseResult },
          }),
        )
      }

      const anchor = positionControllerRef.current?.anchorFor(tabId) ?? null
      const restore =
        anchor === null
          ? { kind: 'approx' as const, blockId: null, headingPath: null, reason: 'top' as const }
          : restorePosition({
              anchor,
              targetVersionHash: pending.contentHash,
              blocks: parseResult?.blocks ?? [],
            })

      if (options.clearSelection) clearDocumentSelection()
      const position = updatePositionForRestore(restore)
      dispatchSession(tabId, sessionUpdateCommitted(position))

      // Committed boundary: record the restored anchor against the new version
      // immediately, so a quit right after the update can still restore it.
      const restoredBlock =
        restore.blockId === null
          ? null
          : (parseResult?.blocks.find((block) => block.blockId === restore.blockId) ?? null)
      if (restoredBlock) {
        positionControllerRef.current?.observe(
          tabId,
          tab.docId,
          buildAnchorRecord({
            versionHash: pending.contentHash,
            block: restoredBlock,
            offsetRatio: restore.kind === 'exact' ? restore.offsetRatio : 0,
          }),
        )
      } else {
        positionControllerRef.current?.flush(tabId)
      }

      const outcome: UpdateCommitOutcome = {
        position,
        blockId: restore.blockId,
        messageKey: positionMessageKey(position),
      }
      setCommitNotices((previous) => ({
        ...previous,
        [tabId]: { ...outcome, nonce: (previous[tabId]?.nonce ?? 0) + 1 },
      }))
      return outcome
    },
    [dispatchSession, parseOptionsFor, setCommitNotices],
  )

  const maybeAutoCommit = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
      const decision = resolveUpdateDecision({
        hasPending: selectHasPendingUpdate(tab.session),
        mode: effectiveUpdateMode(updateModeByTabRef.current[tabId] ?? null, updateModeDefaultRef.current),
        isActiveTab: stateRef.current.activeTabId === tabId,
        hasSelection: selectionRef.current,
        hasInspectLayer: inspectLayerRef.current.has(tabId),
      })
      if (decision.kind === 'follow-commit') void commitUpdate(tabId)
    },
    [commitUpdate],
  )

  useEffect(() => {
    maybeAutoCommitRef.current = maybeAutoCommit
  }, [maybeAutoCommit])

  // Global selection tracking (INV-UM-03): a selection anywhere in the
  // document pauses automatic updates; clearing it re-evaluates the condition.
  useEffect(() => {
    const update = () => {
      const next = documentSelectionPresent()
      selectionRef.current = next
      setSelectionPresent(next)
      if (!next) {
        const active = stateRef.current.activeTabId
        if (active !== null) maybeAutoCommitRef.current(active)
      }
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  /**
   * Best-effort recents write on a successful open (R06; AT06/D-34-3). The
   * Rust side owns the ≤100 cap, order and the read-time availability marker;
   * a suppressed/`rememberRecords=false`/failed write stays silent (NF08;
   * models §9).
   */
  const recordRecent = useCallback((docId: string) => {
    if (isWriteBackSuppressed('recents') || !rememberRecordsRef.current) return
    void storage.touchRecent(docId).catch(() => undefined)
  }, [])

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
      // Batch oracle: request order, first accepted item gets focus, duplicates
      // reuse their canonical-path tab (R05), rejections are summarized.
      const plan = planOpenBatch(result.items)
      // Explicit open (entry != restore) lifts the cleared-category write
      // suppression before recents are recorded, exactly like models §9.1
      // (`resume_recording` alternative). Restore never re-records.
      if (plan.acceptedAny && entry !== 'restore') resumeSuppressedWrites()
      for (const item of plan.items) {
        const { outcome } = item
        if (entry !== 'restore') recordRecent(item.docId)
        const existing = stateRef.current.tabs.find((tab) => tab.docId === item.docId)
        if (existing) {
          if (item.activate) {
            send(tabActivate(existing.tabId))
            maybeAutoCommitRef.current(existing.tabId)
          }
          continue
        }
        const identity = outcome.identity
        if (!identity) continue
        const tab = createReaderTab({
          tabId: nextTabId(),
          docId: item.docId,
          canonicalPath: identity.canonicalPath,
          displayName: identity.displayName,
        })
        send(tabOpen(tab, item.activate))

        // Large-document classification (rendering-pipeline §5). The hard
        // limit wins: the tab goes straight to the source-window mode with an
        // explicit label; >10MiB asks before reading anything (cancel closes
        // the freshly created tab without starting background work).
        const classification = classifyLargeDocument({ sizeBytes: identity.sizeBytes })
        if (classification.kind === 'sourceOnly') {
          send(tabLargeDoc(tab.tabId, 'sourceWindow'))
          send(tabView(tab.tabId, 'source'))
          void startSourceWindow(tab.tabId, item.docId, tab.session.generation)
        } else if (classification.kind === 'prompt') {
          send(tabPhase(tab.tabId, 'largeDoc', null))
          setPrompt(tab.tabId, {
            sizeBytes: identity.sizeBytes,
            reason: classification.reason,
            origin: 'open',
          })
        } else {
          void startRead(tab.tabId, item.docId, 'initial', tab.session.generation)
        }
      }
      setOpenErrors(plan.failures)
    },
    [recordRecent, setPrompt, startRead, startSourceWindow, send],
  )

  /**
   * Records a surface-level command failure without clearing the current open
   * summary (used by the authorization dialog host).
   */
  const reportOpenError = useCallback((error: ErrorPayload) => {
    setOpenErrors((previous) => [...previous, { path: '', error }])
  }, [])

  /** Shared handler surface for the four entry adapters (`open/entry.ts`). */
  const entryHandlers = useCallback(
    (): OpenEntryHandlers => ({
      openPaths,
      setDirectory,
      reportError: reportOpenError,
    }),
    [openPaths, reportOpenError],
  )

  const pickAndOpen = useCallback(async () => {
    await openFromFileDialog(ENTRY_SERVICES, entryHandlers())
  }, [entryHandlers])

  /** Drag-and-drop entry: empty payloads are ignored, paths validate per item. */
  const openDrop = useCallback(
    async (paths: readonly string[]) => {
      await openFromDrop(entryHandlers(), paths)
    },
    [entryHandlers],
  )

  /**
   * “打开目录” (Ctrl+Shift+O): the picker result never authorizes by itself;
   * `tree.openDirectory` creates the session-scoped root used by the file
   * tree service (contracts §8/§9, R25). Cancel changes nothing.
   */
  const pickDirectory = useCallback(async () => {
    await openFromDirectoryDialog(ENTRY_SERVICES, entryHandlers())
  }, [entryHandlers])

  /**
   * Adopts one `relink_document` result into the tab that owns the docId
   * (R07; AT07): same bytes restore the identity without a version change;
   * different bytes are explained first and adopted as a new version with an
   * approximate position (INV-AR-04).
   *
   * The command crossed an async boundary: the adoption only applies when the
   * target tab still displays the same docId at the same generation as when
   * the request was issued (contracts §6.2/§6.3; INV-VC-02/06; B-06). A tab
   * navigated to another document, relinked or closed meanwhile keeps its new
   * state with zero visible effect from the late result.
   */
  const adoptRelinkResult = useCallback(
    (tab: ReaderTab, result: RelinkResult) => {
      const current = stateRef.current.tabs.find((candidate) => candidate.tabId === tab.tabId)
      if (
        !current ||
        current.docId !== tab.docId ||
        current.session.generation !== tab.session.generation
      ) {
        return
      }
      if (result.status === 'reassociated') {
        // Same bytes: identity is restored without a version change.
        setRelinkNotice('document.relink.reassociated')
        dispatchSession(current.tabId, sessionRecovered())
        return
      }
      // Different bytes: explain first, then adopt as a new version of
      // the same docId; the position can only be approximate.
      setRelinkNotice('document.relink.newVersion')
      dispatchSession(
        current.tabId,
        sessionDisplayReplaced(result.snapshot.version, result.snapshot.text),
      )
      send(tabPhase(current.tabId, 'parsing', null))
      void startParse(
        current.tabId,
        current.docId,
        result.snapshot.text,
        result.snapshot.version,
        current.session.generation + 1,
      )
    },
    [dispatchSession, send, startParse],
  )

  /**
   * Unavailable recents relink (ui-spec §3.1/§3.8; R07): re-select through the
   * system picker, attempt `relink_document` for the known docId when the tab
   * is still open, adopt the result into that tab, and always open the chosen
   * file afterwards. Cancel leaves every state unchanged.
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
      const tab = selectTabByDocId(stateRef.current, entry.docId)
      try {
        const result = await files.relinkDocument({ docId: entry.docId, newPath })
        if (tab) {
          adoptRelinkResult(tab, result)
        } else {
          setRelinkNotice(
            result.status === 'reassociated'
              ? 'document.relink.reassociated'
              : 'document.relink.newVersion',
          )
        }
      } catch {
        // The record may come from an earlier session; the explicit
        // re-selection below is still the user's decision.
        setRelinkNotice(null)
      }
      await openPaths([newPath], 'recent')
    },
    [adoptRelinkResult, openPaths],
  )

  const openRequest = useCallback(
    async (request: OpenRequest) => {
      await openFromRequest(entryHandlers(), request)
    },
    [entryHandlers],
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
      const previousDocId = tab.docId
      send(
        tabDocReplace(tabId, {
          docId,
          canonicalPath: identity.canonicalPath,
          displayName: identity.displayName,
        }),
      )
      // The old document session ends here: its remote allowances die with it
      // (INV-AZ-07/09) — the new document starts blocked again.
      resourceAuth.revokeRemote(previousDocId)
      resourceAuth.clearPromptsFor(previousDocId)
      void remote.revokeRemoteSession(previousDocId).catch(() => undefined)
      void startRead(tabId, docId, 'initial', generation)
      return { docId, anchorId }
    },
    [send, startRead],
  )

  /**
   * Unavailable-source relink for an open tab (ui-spec §3.8 “源不可用”;
   * R07; AT07): the same-bytes/different-bytes semantics as `relinkRecent`,
   * but the chosen file belongs to this tab. When the document is not
   * registered in Rust yet (a tab restored without its file), the selection
   * becomes a same-tab document navigation instead.
   */
  const relinkTab = useCallback(
    async (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
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
        const result = await files.relinkDocument({ docId: tab.docId, newPath })
        adoptRelinkResult(tab, result)
      } catch {
        // Not registered (restored without its file) or unreadable: treat the
        // explicit selection as navigating this tab to the chosen document.
        await navigateDocument(tabId, newPath, null)
      }
    },
    [adoptRelinkResult, navigateDocument],
  )

  /**
   * Startup session restore (models §10; R06; AT06/D-34-2). Runs after the
   * explicit startup queue so a CLI/system file keeps focus (INV-SR-01) and
   * only when `restoreSession` is on. The stored session carries only
   * `docId`s; the canonical path comes from the recents projection, the
   * contract's docId→path surface. Tabs are restored serially and
   * independently (INV-SR-02): a single failure marks only that tab
   * unavailable. Queries, selections, document-level overrides and temporary
   * network grants are never restored (INV-SR-03/04), and a cleared session
   * is never rebuilt (INV-SR-05).
   */
  const restoreStartupSession = useCallback(
    async (isCancelled: () => boolean, explicitTookFocus: boolean) => {
      if (isWriteBackSuppressed('session')) return
      let snapshot: SessionSnapshot | null = null
      try {
        snapshot = await storage.loadSession()
      } catch {
        return
      }
      if (!snapshot || snapshot.tabs.length === 0) return
      let recents: RecentEntry[] = []
      try {
        recents = await storage.listRecents()
      } catch {
        recents = []
      }
      const knownByDoc = new Map(recents.map((entry) => [entry.docId, entry]))
      const ordered = [...snapshot.tabs].sort(
        (left, right) =>
          left.orderIndex - right.orderIndex || left.tabId.localeCompare(right.tabId),
      )
      let storedActiveTabId: string | null = null
      for (const stored of ordered) {
        if (isCancelled()) return
        const alreadyOpen = stateRef.current.tabs.find((tab) => tab.docId === stored.docId)
        if (alreadyOpen) {
          if (stored.isActive) storedActiveTabId = alreadyOpen.tabId
          continue
        }
        const known = knownByDoc.get(stored.docId)
        if (!known) continue // no source path is known: no ghost tab
        let outcome: OpenOutcome | undefined
        if (known.available) {
          try {
            const result = await files.openDocuments({
              paths: [known.canonicalPath],
              entry: 'restore',
            })
            outcome = result.items[0]
          } catch {
            outcome = undefined
          }
          if (isCancelled()) return
        }
        const accepted =
          outcome !== undefined &&
          outcome.status !== 'rejected' &&
          (outcome.docId ?? outcome.duplicateOfDocId) !== undefined
        const docId = accepted ? (outcome?.docId ?? outcome?.duplicateOfDocId) : undefined
        if (docId !== undefined && stateRef.current.tabs.some((tab) => tab.docId === docId)) {
          continue // duplicate resolved to an already open document
        }
        const tab = createReaderTab({
          tabId: nextTabId(),
          docId: docId ?? stored.docId,
          canonicalPath: outcome?.identity?.canonicalPath ?? known.canonicalPath,
          displayName: outcome?.identity?.displayName ?? known.displayName,
        })
        send(tabOpen(tab, false))
        if (stored.isActive) storedActiveTabId = tab.tabId
        if (docId !== undefined) {
          void startRead(tab.tabId, docId, 'restore', tab.session.generation)
        } else {
          // File missing / no longer readable: keep the tab, mark it
          // unavailable; the banner offers 重新定位/重试/关闭 (ui-spec §3.8).
          dispatchSession(tab.tabId, sessionUnavailable())
          send(tabPhase(tab.tabId, 'failed', outcome?.error ?? missingSourceError()))
        }
      }
      if (storedActiveTabId !== null && !explicitTookFocus && !isCancelled()) {
        send(tabActivate(storedActiveTabId))
      }
    },
    [dispatchSession, send, startRead],
  )

  // Startup queue: drained exactly once and in order; later requests arrive as
  // `paperstack://open-requested` events through `openRequest` (contracts §4).
  // The stored session is restored afterwards, never taking focus from an
  // explicitly opened file (models §10; INV-SR-01/06).
  useEffect(() => {
    let cancelled = false
    const handlers = entryHandlers()
    const guarded: OpenEntryHandlers = {
      openPaths: (paths, entry) => (cancelled ? Promise.resolve() : handlers.openPaths(paths, entry)),
      setDirectory: handlers.setDirectory,
      reportError: handlers.reportError,
    }
    void (async () => {
      await drainPendingOpenRequests(ENTRY_SERVICES, guarded)
      if (cancelled) return
      const explicitTookFocus = stateRef.current.tabs.length > 0
      let restoreSession = true
      try {
        restoreSession = (await settings.getSettings()).global.restoreSession
      } catch {
        // Keep the contract default (true) when settings are unavailable.
      }
      if (cancelled || !restoreSession) return
      await restoreStartupSession(() => cancelled, explicitTookFocus)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [entryHandlers, restoreStartupSession])

  const activateTab = useCallback(
    (tabId: string) => {
      send(tabActivate(tabId))
      // Follow mode re-evaluates on activation (INV-UM-04): a candidate
      // observed while the tab was in the background may now commit.
      maybeAutoCommitRef.current(tabId)
    },
    [send],
  )

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (tab) {
        // Committed boundary: persist the last reading position before the tab
        // disappears; suppression/remember gates still apply.
        positionControllerRef.current?.flush(tabId)
      }
      send(tabClose(tabId))
      removePrompt(tabId)
      setCommitNotices((previous) => {
        if (!(tabId in previous)) return previous
        const next = { ...previous }
        delete next[tabId]
        return next
      })
      inlineMathRef.current.delete(tabId)
      updateModeByTabRef.current = Object.fromEntries(
        Object.entries(updateModeByTabRef.current).filter(([key]) => key !== tabId),
      )
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
      if (tab) {
        // Leaving the document session revokes its remote allowances and
        // cancels in-flight fetches (INV-AZ-07/09): reopening is blocked again.
        resourceAuth.revokeRemote(tab.docId)
        resourceAuth.clearPromptsFor(tab.docId)
        void remote.revokeRemoteSession(tab.docId).catch(() => undefined)
        void watch.unwatchDocument(tab.docId).catch(() => undefined)
      }
    },
    [removePrompt, send, setCommitNotices, setInlineMathByTab, setUpdateModeByTab],
  )

  const closeActiveTab = useCallback(() => {
    const active = selectActiveTab(stateRef.current)
    if (active) closeTab(active.tabId)
  }, [closeTab])

  /**
   * Large-document choice handling (T-51/T-52). `cancel` on the open-time
   * prompt closes the freshly created tab (no read ever started, no ghost);
   * on the complexity prompt it keeps the already rendered full view and
   * declines re-prompting for that version.
   */
  const chooseLargeDoc = useCallback(
    (tabId: string, choice: LargeDocChoice) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      const prompt = largeDocPromptsRef.current[tabId]
      if (!tab || !prompt) return
      if (choice === 'cancel') {
        removePrompt(tabId)
        if (prompt.origin === 'open') {
          // Nothing was read and no watch was registered: closing invalidates
          // any future task and leaves no ghost tab (R05/IT04).
          closeTab(tabId)
        } else {
          const hash = tab.session.displayVersion?.contentHash
          if (hash !== undefined) complexityDeclinedRef.current.add(`${tabId}:${hash}`)
        }
        return
      }
      const mode = resolveLargeDocChoice(choice)
      if (mode === null) return
      removePrompt(tabId)
      send(tabLargeDoc(tabId, mode))
      if (mode === 'simplified') {
        if (prompt.origin === 'complexity') {
          // The full parse already happened and is in the cache; re-render the
          // same display version with the simplified subset (no disk read).
          void reparseTab(tabId)
        } else {
          void startRead(tabId, tab.docId, 'initial', tab.session.generation)
        }
        return
      }
      // Source-only choice: ≤50MiB keeps the decoded text in memory (SourceView
      // renders it and in-memory search stays available); the >50MiB hard limit
      // never reaches this dialog.
      send(tabView(tabId, 'source'))
      positionControllerRef.current?.flush(tabId)
      if (prompt.origin === 'complexity') return
      void startRead(tabId, tab.docId, 'initial', tab.session.generation, { skipParse: true })
    },
    [closeTab, removePrompt, reparseTab, send, startRead],
  )

  const cancelLargeDoc = useCallback(
    (tabId: string) => {
      chooseLargeDoc(tabId, 'cancel')
    },
    [chooseLargeDoc],
  )

  const cycleTab = useCallback(
    (delta: number) => {
      const tabId = selectCycleTabId(stateRef.current, delta)
      if (tabId) activateTab(tabId)
    },
    [activateTab],
  )

  const cancelTab = useCallback(
    (tabId: string) => {
      dispatchSession(tabId, sessionInvalidated())
      send(tabPhase(tabId, 'cancelled', null))
    },
    [dispatchSession, send],
  )

  const setBannerCollapsed = useCallback(
    (tabId: string, collapsed: boolean) => {
      send(tabBanner(tabId, collapsed))
    },
    [send],
  )

  const setViewMode = useCallback(
    (tabId: string, mode: ReaderViewMode) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (tab && tab.viewMode !== mode) positionControllerRef.current?.flush(tabId)
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
    [reparseTab, setInlineMathByTab],
  )

  const inlineMathFor = useCallback(
    (tabId: string): boolean => inlineMathByTab[tabId] ?? true,
    [inlineMathByTab],
  )

  /** Update-mode override for the current document (session-scoped, INV-UM-07). */
  const setUpdateModeOverride = useCallback(
    (tabId: string, mode: UpdateMode) => {
      updateModeByTabRef.current = { ...updateModeByTabRef.current, [tabId]: mode }
      setUpdateModeByTab(updateModeByTabRef.current)
      maybeAutoCommitRef.current(tabId)
    },
    [setUpdateModeByTab],
  )

  const updateModeOverrideFor = useCallback(
    (tabId: string): UpdateMode | null => updateModeByTab[tabId] ?? null,
    [updateModeByTab],
  )

  const updateModeFor = useCallback(
    (tabId: string): UpdateMode =>
      effectiveUpdateMode(updateModeByTab[tabId] ?? null, updateModeDefault),
    [updateModeByTab, updateModeDefault],
  )

  const syncGlobalSettings = useCallback(
    (next: { updateModeDefault?: UpdateMode; rememberRecords?: boolean }) => {
      if (next.rememberRecords !== undefined) rememberRecordsRef.current = next.rememberRecords
      if (next.updateModeDefault !== undefined && next.updateModeDefault !== updateModeDefaultRef.current) {
        updateModeDefaultRef.current = next.updateModeDefault
        setUpdateModeDefaultState(next.updateModeDefault)
        for (const tab of stateRef.current.tabs) {
          if (updateModeByTabRef.current[tab.tabId] === undefined) maybeAutoCommitRef.current(tab.tabId)
        }
      }
    },
    [setUpdateModeDefaultState],
  )

  const setInspectLayerActive = useCallback(
    (tabId: string, active: boolean) => {
      let changed = false
      if (active) {
        if (!inspectLayerRef.current.has(tabId)) {
          inspectLayerRef.current.add(tabId)
          changed = true
        }
      } else {
        changed = inspectLayerRef.current.delete(tabId)
      }
      if (!changed) return
      setInspectLayerNonce((nonce) => nonce + 1)
      if (!active) maybeAutoCommitRef.current(tabId)
    },
    [setInspectLayerNonce],
  )

  const inspectLayerActiveFor = useCallback(
    (tabId: string): boolean => {
      // The nonce re-renders the consumer after a membership change.
      void inspectLayerNonce
      return inspectLayerRef.current.has(tabId)
    },
    [inspectLayerNonce],
  )

  const pauseKeyFor = useCallback((tabId: string): string | null => {
    const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
    const hash = tab?.session.pendingVersion?.contentHash
    return hash === undefined ? null : `${tabId}:${hash}`
  }, [])

  const isPauseDismissed = useCallback(
    (tabId: string): boolean => {
      // Recompute when the candidate or the dismissal set changes.
      void pauseNonce
      const key = pauseKeyFor(tabId)
      return key !== null && pauseDismissedRef.current.has(key)
    },
    [pauseKeyFor, pauseNonce],
  )

  const dismissUpdatePause = useCallback(
    (tabId: string) => {
      const key = pauseKeyFor(tabId)
      if (key === null) return
      pauseDismissedRef.current.add(key)
      setPauseNonce((nonce) => nonce + 1)
    },
    [pauseKeyFor, setPauseNonce],
  )

  const commitNoticeFor = useCallback(
    (tabId: string): UpdateCommitNotice | null => commitNotices[tabId] ?? null,
    [commitNotices],
  )

  const dismissCommitNotice = useCallback(
    (tabId: string) => {
      setCommitNotices((previous) => {
        if (!(tabId in previous)) return previous
        const next = { ...previous }
        delete next[tabId]
        return next
      })
    },
    [setCommitNotices],
  )

  const observePosition = useCallback(
    (tabId: string, anchor: AnchorRecord) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
      positionControllerRef.current?.observe(tabId, tab.docId, anchor)
    },
    [],
  )

  const flushPosition = useCallback(
    (tabId: string) => {
      positionControllerRef.current?.flush(tabId)
    },
    [],
  )

  const positionAnchorFor = useCallback(
    (tabId: string): AnchorRecord | null => positionControllerRef.current?.anchorFor(tabId) ?? null,
    [],
  )

  /**
   * One-shot consumer for a restart position restore (models §6/§10; AT19).
   * Returns the §6.2 decision-tree outcome once; the view scrolls to it and
   * labels exact vs approximate honestly.
   */
  const takePendingPositionRestore = useCallback((tabId: string): RestoreResult | null => {
    const pending = pendingPositionRestoresRef.current.get(tabId)
    if (pending === undefined) return null
    pendingPositionRestoresRef.current.delete(tabId)
    return pending
  }, [])

  const clearPositionError = useCallback(() => {
    positionControllerRef.current?.clearError()
    setPositionError(null)
  }, [setPositionError])

  const retryPositionSave = useCallback(
    (tabId: string) => {
      positionControllerRef.current?.clearError()
      setPositionError(null)
      positionControllerRef.current?.retry(tabId)
    },
    [setPositionError],
  )

  const refreshTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
      // The >50MiB source-window mode never has in-memory text: a refresh via
      // `read_document` would be rejected with PS_LIMIT_SIZE. The window view
      // owns its version-checked reads (`get_source_info`/`read_source_window`).
      const displayHash = tab.session.displayVersion?.contentHash
      if (
        tab.largeDocMode === 'sourceWindow' &&
        (displayHash === undefined ||
          documentModelCache.get(tab.docId, displayHash)?.rawText == null)
      ) {
        return
      }
      if (refreshingRef.current.has(tabId)) return
      refreshingRef.current.add(tabId)
      void startRead(tabId, tab.docId, 'refresh', tab.session.generation).finally(() =>
        refreshingRef.current.delete(tabId),
      )
    },
    [startRead],
  )

  /**
   * Retry for a failed/unavailable tab (ui-spec §3.8; models §1.2 T8). A tab
   * whose document never registered (file missing at startup) re-runs the open
   * validation first; a tab with loaded content retries through a stable
   * disk re-read so only an actually readable source restores Ready (a cached
   * initial read must not pretend recovery).
   */
  const retryTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
      if (!tab) return
      if (tab.session.displayVersion === null) {
        send(tabPhase(tabId, 'reading', null))
        const token = createTaskToken(tab.session, nextTaskId('read'), 'discovery')
        const generation = tab.session.generation
        void files
          .openDocuments({ paths: [tab.canonicalPath], entry: 'restore' })
          .then((result) => {
            const outcome = result.items[0]
            const current = stateRef.current.tabs.find((candidate) => candidate.tabId === tabId)
            if (!current || current.session.generation !== generation) return
            if (!outcome || outcome.status === 'rejected' || !outcome.docId) {
              if (token !== null) {
                dispatchSession(
                  tabId,
                  sessionTaskFailed(token, outcome?.error ?? missingSourceError()),
                )
              }
              return
            }
            dispatchSession(tabId, sessionRecovered())
            void startRead(tabId, outcome.docId, 'restore', generation)
          })
          .catch((error: unknown) => {
            if (token !== null) {
              dispatchSession(tabId, sessionTaskFailed(token, toErrorPayload(error)))
            }
          })
        return
      }
      if (tab.session.status === 'unavailable') {
        // Retained content stays visible during the stable re-read (INV-DS-06);
        // the refresh read itself restores Ready on success without a parse.
        // Forcing the `reading` phase here would strand the tab in `parsing`
        // (no parse is scheduled for a refresh) and unmount the content.
        refreshTab(tabId)
        return
      }
      send(tabPhase(tabId, 'reading', null))
      void startRead(tabId, tab.docId, 'initial', tab.session.generation)
    },
    [dispatchSession, refreshTab, startRead, send],
  )

  const handleWatchChanged = useCallback(
    (payload: WatchChangedPayload) => {
      const tab = selectTabByDocId(stateRef.current, payload.docId)
      if (!tab) return
      // Resource-only changes re-resolve just that resource (new `?v=` key);
      // they never change the display version or show a document banner
      // (contract §7.6; INV-VC-07).
      if (payload.kind === 'resource') {
        resourceInvalidation.bump(payload.docId, payload.resourcePath)
        return
      }
      if (payload.kind === 'removed') {
        dispatchSession(tab.tabId, sessionUnavailable())
        return
      }
      refreshTab(tab.tabId)
    },
    [dispatchSession, refreshTab],
  )

  const recheckOpenTabs = useCallback(() => {
    for (const tab of stateRef.current.tabs) {
      if (tab.session.status === 'loading' || tab.phase === 'reading') continue
      refreshTab(tab.tabId)
    }
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

  const clearRelinkNotice = useCallback(() => setRelinkNotice(null), [])

  const largeDocPromptFor = useCallback(
    (tabId: string): LargeDocPromptState | null => largeDocPrompts[tabId] ?? null,
    [largeDocPrompts],
  )

  return {
    state,
    openErrors,
    clearOpenErrors,
    reportOpenError,
    closeSaveFailed,
    directory,
    relinkNotice,
    clearRelinkNotice,
    pickAndOpen,
    pickDirectory,
    openPaths,
    openDrop,
    navigateDocument,
    openRequest,
    relinkRecent,
    relinkTab,
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
    updateModeFor,
    syncGlobalSettings,
    handleWatchChanged,
    recheckOpenTabs,
    saveSession,
    handleCloseRequested,
    largeDocPromptFor,
    chooseLargeDoc,
    cancelLargeDoc,
    selectionPresent,
    setInspectLayerActive,
    inspectLayerActiveFor,
    isPauseDismissed,
    dismissUpdatePause,
    commitUpdate,
    commitNoticeFor,
    dismissCommitNotice,
    observePosition,
    flushPosition,
    positionAnchorFor,
    takePendingPositionRestore,
    positionRestoreNonce,
    positionError,
    clearPositionError,
    retryPositionSave,
    layoutCorrectionTick,
    notifyLayoutChange,
  }
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
