import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { createEventBridge } from '../../app/events'
import { t } from '../../app/i18n'
import { selectHasPendingUpdate } from '../../app/session'
import {
  panelClosed,
  panelToggled,
  recentRemoved,
  useAppDispatch,
  useAppState,
} from '../../app/store'
import { Banner } from '../../components/Banner'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Placeholder, type PlaceholderStage } from '../../components/Placeholder'
import { DOCUMENT_BODY_ID } from '../../components/SkipLink'
import { Toast } from '../../components/Toast'
import { HARD_LIMIT_BYTES, largeDocHonesty } from '../../document/modes/modes'
import { slugifyHeading } from '../../document/transforms'
import type {
  BlockRecord,
  DocumentDiagnostic,
  OutlineEntry,
  ParseDocumentResult,
  SearchSegment,
} from '../../document/types'
import type { SyntaxMode } from '../../services/types'
import type { CurrentDocumentSettings } from '../settings/current-document'
import { DiagnosticsProvider, useDiagnostics } from '../settings/diagnostics/diagnostics-context'
import { DiagnosticsPanel } from '../settings/diagnostics/DiagnosticsPanel'
import { SettingsProvider, useSettings } from '../settings/settings-context'
import { SettingsDialog, type SettingsCategory } from '../settings/SettingsDialog'
import { SearchBar } from '../search/SearchBar'
import {
  openSearchSession,
  readSearchSession,
  useSearchSession,
  type SearchLocateContext,
} from '../search/use-search-session'
import type { BodySearchHit, SearchHit } from '../search/search-core'
import { search as searchService } from '../../services'
import type { SourceRange } from '../../services/types'
import { DocumentView, type SearchHighlight, type SearchHighlightRange } from './body/DocumentView'
import {
  canGoBack,
  canGoForward,
  restoreMessageKey,
  type HistoryEntry,
  type HistoryKind,
  type NavPoint,
} from './history/history'
import { useReaderHistory } from './history/use-reader-history'
import { InspectDrawer } from './inspect/InspectDrawer'
import type { InspectTarget } from './inspect/types'
import { LargeDocDialog } from './largeDoc/LargeDocDialog'
import { NavPanel, type NavPanelKind } from './nav/NavPanel'
import { useOutlineTracking } from './nav/use-outline-tracking'
import { buildAnchorRecord, type RestoreResult } from './position/position'
import { RootErrorBoundary } from './RootErrorBoundary'
import { tabDisplayLabels } from './reader-state'
import { SourceView, type SourceBackInfo } from './source/SourceView'
import {
  blockRangeFor,
  findBlockForByteOffset,
  findVisibleBlockId,
  resolveReturnTarget,
} from './source/mapping'
import { TabBar } from './tabs/TabBar'
import { ReaderToolbar } from './toolbar/ReaderToolbar'
import { ReaderUiContext, type ReaderUi } from './ui-context'
import { UpdateBanner } from './update/UpdateBanner'
import { selectUpdateBanner } from './update/update-model'
import { ResourceAuthDialogs } from './resources/ResourceAuthDialogs'
import {
  displayDocumentModel,
  useReader,
  type OpenFailure,
  type ReaderControls,
} from './use-reader'
import { WelcomePage } from './welcome/WelcomePage'
import { ZoomOverlay, type ZoomTarget } from './zoom/ZoomOverlay'
import './reader.css'

/**
 * Reader assembly (ui-spec §3.2 UI01; wp-24 adds UI00/UI02/UI04/UI05):
 * welcome + recents without a document, toolbar/tab bar/body with them, the
 * mutually exclusive navigation/inspect auxiliary areas, the read-only source
 * view, the zoom layer and the Tauri event bridge. Search, settings and the
 * update flows stay with wp-25/27/29 and are not faked here.
 */

/**
 * Loading placeholder rules (ui-spec §4.2, VC-11): >150ms light placeholder,
 * >1s phase text + cancel. Mounted per load attempt, so its timers start
 * fresh for every read without resetting state inside an effect.
 */
function ReaderLoading({ phase, onCancel }: { phase: 'reading' | 'parsing'; onCancel(): void }) {
  const [step, setStep] = useState<'none' | 'light' | 'stage'>('none')

  useEffect(() => {
    const lightTimer = setTimeout(() => setStep('light'), 150)
    const stageTimer = setTimeout(() => setStep('stage'), 1000)
    return () => {
      clearTimeout(lightTimer)
      clearTimeout(stageTimer)
    }
  }, [])

  if (step === 'none') return null
  const stage: PlaceholderStage | undefined =
    step === 'stage' ? (phase === 'reading' ? 'read' : 'parse') : undefined
  return (
    <Placeholder {...(stage ? { stage } : {})} cancellable={step === 'stage'} onCancel={onCancel} />
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

interface SourceEntry {
  range: SourceRange | null
  blockId: string | null
}

/** Search/history locate request, resolved after the target block mounts. */
interface PendingLocate {
  tabId: string
  point: NavPoint
  /** null = silent (search hit); 'auto' = exact/approx decision on restore. */
  notice: 'auto' | null
  focus: boolean
  /** Segment of a body search hit; focuses the current `<mark>`. */
  segId: string | null
}

const EMPTY_SEGMENTS: readonly SearchSegment[] = []

/**
 * Requested result budget for the >50MiB `search_source` scan (contract §8).
 * The command itself reports budget exhaustion with `complete=false` +
 * `PS_LIMIT_SEARCH`; this value only bounds the response size.
 */
export const SEARCH_SOURCE_MAX_RESULTS = 500

/**
 * Resolves a link href against the current document's canonical path
 * (models §5.2 "跨文档相对链接"). `./`, `../` and bare names are supported;
 * absolute paths pass through; fragments split off for the anchor restore.
 */
export function resolveDocumentLink(
  basePath: string,
  href: string,
): { path: string; anchorId: string | null } {
  const hashIndex = href.indexOf('#')
  const rawPath = hashIndex === -1 ? href : href.slice(0, hashIndex)
  const anchorId = hashIndex === -1 ? null : decodeURIComponent(href.slice(hashIndex + 1))
  if (rawPath.length === 0) return { path: basePath, anchorId }
  if (rawPath.startsWith('/')) return { path: rawPath, anchorId }
  const baseSegments = basePath.split('/').slice(0, -1)
  const segments = rawPath.split('/')
  const resolved = [...baseSegments]
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') resolved.pop()
    else resolved.push(segment)
  }
  return { path: `/${resolved.filter(Boolean).join('/')}`, anchorId }
}

/**
 * In-block ratio of the current reading position (0..1) for the anchor record;
 * layout-dependent, deterministic fallback 0 without real layout (jsdom).
 */
function blockOffsetRatio(container: HTMLElement | null, blockId: string): number {
  if (!container) return 0
  const element = container.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
  if (!element) return 0
  const rect = element.getBoundingClientRect()
  if (!Number.isFinite(rect.height) || rect.height <= 0) return 0
  const containerTop = container.getBoundingClientRect().top
  return Math.min(1, Math.max(0, (containerTop - rect.top) / rect.height))
}

function pointForSearchHit(
  hit: SearchHit,
  tab: { docId: string; canonicalPath: string },
  blocks: readonly BlockRecord[],
): NavPoint {
  if (hit.kind === 'body') {
    return {
      docId: tab.docId,
      canonicalPath: tab.canonicalPath,
      blockId: hit.blockId,
      anchorId: null,
      sourceByte: null,
    }
  }
  const block = findBlockForByteOffset(blocks, hit.startByte)
  return {
    docId: tab.docId,
    canonicalPath: tab.canonicalPath,
    blockId: block?.blockId ?? null,
    anchorId: null,
    sourceByte: hit.startByte,
  }
}

/**
 * Bridges the settings host into the reader controller: a syntax change
 * re-renders the displayed version in place (R08), never reloading disk; the
 * update-mode default and records preference feed the update/anchor flows; a
 * typography change (font size / line height / content width) requests the
 * single layout-stabilization correction (INV-AR-05).
 */
function ReaderSettingsBridge({ reader }: { reader: ReaderControls }) {
  const { settings } = useSettings()
  const readerRef = useRef(reader)
  useEffect(() => {
    readerRef.current = reader
  })
  const lastModeRef = useRef<SyntaxMode | null>(null)
  const lastTypographyRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastModeRef.current === settings.syntaxMode) return
    lastModeRef.current = settings.syntaxMode
    readerRef.current.applySyntaxMode(settings.syntaxMode)
  }, [settings.syntaxMode])

  useEffect(() => {
    readerRef.current.syncGlobalSettings({
      updateModeDefault: settings.updateModeDefault,
      rememberRecords: settings.rememberRecords,
    })
  }, [settings.updateModeDefault, settings.rememberRecords])

  useEffect(() => {
    const key = `${settings.fontSizePx}:${settings.lineHeight}:${settings.maxContentWidthPx}`
    if (lastTypographyRef.current === null) {
      lastTypographyRef.current = key
      return
    }
    if (lastTypographyRef.current === key) return
    lastTypographyRef.current = key
    readerRef.current.notifyLayoutChange()
  }, [settings.fontSizePx, settings.lineHeight, settings.maxContentWidthPx])

  return null
}

const EMPTY_DIAGNOSTICS: readonly DocumentDiagnostic[] = []

/**
 * Records every visible error surface into the diagnostics collector
 * (ui-spec §3.8): open failures, the active tab's load/parse error and the
 * pipeline's per-block diagnostics. Recording is a no-op when nothing new
 * appeared, and identical entries merge by count.
 */
function DiagnosticsRecorder({
  openErrors,
  activeError,
  activeDocVersion,
  parseDiagnostics,
}: {
  openErrors: readonly OpenFailure[]
  activeError: DocumentDiagnostic | null
  activeDocVersion: string | null
  parseDiagnostics: readonly DocumentDiagnostic[]
}) {
  const { recordMany } = useDiagnostics()

  useEffect(() => {
    recordMany(
      openErrors.map((failure) => ({
        messageKey: failure.error.messageKey,
        code: failure.error.code,
        category: failure.error.category,
        ...(failure.error.sourceRange === undefined
          ? {}
          : { sourceRange: failure.error.sourceRange }),
        ...(failure.error.details === undefined ? {} : { details: failure.error.details }),
      })),
    )
  }, [openErrors, recordMany])

  useEffect(() => {
    if (activeError === null) return
    recordMany([
      {
        messageKey: activeError.messageKey,
        code: activeError.code,
        category: activeError.category,
        ...(activeDocVersion === null ? {} : { docVersion: activeDocVersion }),
        ...(activeError.sourceRange === undefined ? {} : { sourceRange: activeError.sourceRange }),
        ...(activeError.details === undefined ? {} : { details: activeError.details }),
      },
    ])
  }, [activeError, activeDocVersion, recordMany])

  useEffect(() => {
    if (parseDiagnostics.length === 0) return
    recordMany(
      parseDiagnostics.map((diagnostic) => ({
        messageKey: diagnostic.messageKey,
        code: diagnostic.code,
        category: diagnostic.category,
        ...(activeDocVersion === null ? {} : { docVersion: activeDocVersion }),
        ...(diagnostic.sourceRange === undefined ? {} : { sourceRange: diagnostic.sourceRange }),
        ...(diagnostic.details === undefined ? {} : { details: diagnostic.details }),
      })),
    )
  }, [parseDiagnostics, activeDocVersion, recordMany])

  return null
}

export default function ReaderScreen() {
  const reader = useReader()
  const { state } = reader
  const appState = useAppState()
  const dispatch = useAppDispatch()
  const activeTab = state.tabs.find((tab) => tab.tabId === state.activeTabId) ?? null
  const labels = useMemo(() => tabDisplayLabels(state.tabs), [state.tabs])
  const activeModel = activeTab ? displayDocumentModel(activeTab) : undefined
  const activeResult = activeModel?.parseResult as ParseDocumentResult | undefined
  const activeHasPending = activeTab ? selectHasPendingUpdate(activeTab.session) : false
  const activeDiagnostics = activeResult?.diagnostics ?? EMPTY_DIAGNOSTICS

  const currentDocumentSettings: CurrentDocumentSettings | null = activeTab
    ? {
        displayName: activeTab.displayName,
        inlineMath: reader.inlineMathFor(activeTab.tabId),
        updateModeOverride: reader.updateModeOverrideFor(activeTab.tabId),
        onInlineMathChange: (enabled) => reader.setInlineMath(activeTab.tabId, enabled),
        onUpdateModeChange: (mode) => reader.setUpdateModeOverride(activeTab.tabId, mode),
      }
    : null

  const openSettings = (category: SettingsCategory) => {
    setSettingsCategory(category)
    setSettingsOpen(true)
  }

  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(null)
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('reading')
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [sourceEntry, setSourceEntry] = useState<Record<string, SourceEntry>>({})
  const [sourcePosition, setSourcePosition] = useState<Record<string, SourceBackInfo>>({})
  const [sourceNotice, setSourceNotice] = useState<string | null>(null)
  const [historyNotice, setHistoryNotice] = useState<string | null>(null)
  /** Missing in-page fragment explanation (models §5.2; AT14/AT15). */
  const [fragmentNotice, setFragmentNotice] = useState<string | null>(null)
  /** One-shot restart position restore awaiting a mounted target (AT19). */
  const [pendingPositionRestore, setPendingPositionRestore] = useState<RestoreResult | null>(null)
  const [revealBlockId, setRevealBlockId] = useState<string | null>(null)
  const [pendingLocate, setPendingLocate] = useState<PendingLocate | null>(null)
  /** Dismissed per tab/mode coverage notice (honesty statement stays reachable). */
  const [modeNoticeDismissed, setModeNoticeDismissed] = useState<Record<string, boolean>>({})
  const lastNavPanelRef = useRef<NavPanelKind | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const history = useReaderHistory()
  /** Origin captured when a search session opens (models §5.2 搜索会话). */
  const searchOriginRef = useRef(new Map<string, NavPoint>())
  /** One history entry per open→close search session (INV-NH-05). */
  const searchEntryRef = useRef(
    new Map<string, { sessionId: string; entryId: string; from: NavPoint }>(),
  )
  /** Last located search hit per tab, for the Esc focus return. */
  const searchCurrentHitRef = useRef(new Map<string, SearchHit>())

  const controlsRef = useRef(reader)
  useEffect(() => {
    controlsRef.current = reader
  })

  const activePanel = appState.activePanel
  const navPanelKind: NavPanelKind | null =
    activePanel === 'files' || activePanel === 'outline' ? activePanel : null
  const navAvailable = reader.directory !== null || activeTab !== null

  // -------------------------------------------------------------------------
  // wp-28 modes / update surface (T-51..T-55)
  // -------------------------------------------------------------------------

  const activeMode = activeTab?.largeDocMode ?? 'full'
  // >50MiB never reads full text; a user-chosen source window keeps it in
  // memory. The VersionInfo size tells the two apart (rendering-pipeline §5).
  const activeHardLimit =
    activeMode === 'sourceWindow' &&
    (activeTab?.session.displayVersion?.sizeBytes ?? 0) > HARD_LIMIT_BYTES
  const modeHonesty = largeDocHonesty(activeMode, { hardLimit: activeHardLimit })
  const modeBadge: 'simplified' | 'sourceOnly' | null =
    modeHonesty.badgeKey === 'document.badge.simplified'
      ? 'simplified'
      : modeHonesty.badgeKey === 'document.badge.sourceOnly'
        ? 'sourceOnly'
        : null
  const modeNoticeKey = activeTab ? `${activeTab.tabId}:${activeMode}` : null

  const updateBannerState = activeTab
    ? selectUpdateBanner({
        hasPending: activeHasPending,
        mode: reader.updateModeFor(activeTab.tabId),
        isActiveTab: true,
        hasSelection: reader.selectionPresent,
        hasInspectLayer: reader.inspectLayerActiveFor(activeTab.tabId),
        collapsed: activeTab.bannerCollapsed,
        pauseDismissed: reader.isPauseDismissed(activeTab.tabId),
      })
    : ({ kind: 'hidden' } as const)

  const commitNotice = activeTab ? reader.commitNoticeFor(activeTab.tabId) : null
  const largeDocPrompt = activeTab ? reader.largeDocPromptFor(activeTab.tabId) : null

  const updateBannerHandlers = {
    onUpdate: () => {
      if (!activeTab) return
      void reader.commitUpdate(activeTab.tabId, { clearSelection: reader.selectionPresent })
    },
    onLater: () => {
      if (activeTab) reader.setBannerCollapsed(activeTab.tabId, true)
    },
    onReopen: () => {
      if (activeTab) reader.setBannerCollapsed(activeTab.tabId, false)
    },
    onContinue: () => {
      if (activeTab) reader.dismissUpdatePause(activeTab.tabId)
    },
  }

  // Stable dismiss target for the success toast (VC-13): the tab currently
  // showing the commit result.
  const commitNoticeTabId = activeTab?.tabId ?? null

  /** Committed-boundary anchor observation for the current reading position. */
  const observeCurrentPosition = () => {
    if (!activeTab || activeTab.phase !== 'ready' || !activeModel || !activeResult) return
    const versionHash = activeTab.session.displayVersion?.contentHash
    if (!versionHash) return
    const blockId = findVisibleBlockId(mainRef.current)
    if (blockId === null) return
    const block = activeResult.blocks.find((candidate) => candidate.blockId === blockId)
    if (!block) return
    reader.observePosition(
      activeTab.tabId,
      buildAnchorRecord({
        versionHash,
        block,
        offsetRatio: blockOffsetRatio(mainRef.current, blockId),
      }),
    )
  }

  // The inspect drawer is one of the two follow-mode pause conditions
  // (models §4.1/INV-UM-02); opening/closing it re-evaluates the decision.
  const activeTabId = activeTab?.tabId ?? null
  const setInspectLayerActive = reader.setInspectLayerActive
  useEffect(() => {
    if (activeTabId === null) return
    const open = activePanel === 'inspect' && inspectTarget !== null
    setInspectLayerActive(activeTabId, open)
    return () => setInspectLayerActive(activeTabId, false)
  }, [activeTabId, activePanel, inspectTarget, setInspectLayerActive])

  // Paired update-result handling: scroll once to the restored block (exact or
  // approximate landing point) when a commit lands (INV-VC-11 / INV-UM-08).
  useEffect(() => {
    if (!commitNotice) return
    if (commitNotice.blockId !== null) {
      const element = mainRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${commitNotice.blockId}"]`,
      )
      if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView()
    } else if (mainRef.current && typeof mainRef.current.scrollIntoView === 'function') {
      mainRef.current.scrollIntoView()
    }
  }, [commitNotice])

  // Single layout-stabilization correction: at most one per layout change,
  // landing on the last recorded anchor block (INV-AR-05).
  useEffect(() => {
    if (reader.layoutCorrectionTick === 0 || !activeTab || !activeResult) return
    const anchor = reader.positionAnchorFor(activeTab.tabId)
    if (!anchor) return
    const block = activeResult.blocks.find(
      (candidate) =>
        anchor.sourceRange.startByte >= candidate.sourceRangeBytes.startByte &&
        anchor.sourceRange.startByte < candidate.sourceRangeBytes.endByte,
    )
    if (!block) return
    const element = mainRef.current?.querySelector<HTMLElement>(
      `[data-block-id="${block.blockId}"]`,
    )
    if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView()
  }, [reader.layoutCorrectionTick, activeTab, activeResult, reader])

  // Restart position restore (models §6/§10; R19; AT19): consume the queued
  // §6.2 decision-tree outcome once the restored tab is active and ready, and
  // reveal the target block so the progressive mount always contains it.
  const positionRestoreNonce = reader.positionRestoreNonce
  useEffect(() => {
    if (positionRestoreNonce === 0 || !activeTab || activeTab.phase !== 'ready' || !activeResult) {
      return
    }
    const restore = reader.takePendingPositionRestore(activeTab.tabId)
    if (restore === null) return
    // The microtask keeps React state updates out of the effect body itself.
    queueMicrotask(() => {
      setPendingPositionRestore(restore)
      // Reveal exact and approximate landing blocks alike: a heading/ancestor
      // fallback still carries a block id (models §6.2), and the consume
      // effect must find that block mounted before it scrolls (D-34b-1/AT19).
      if (restore.blockId !== null) setRevealBlockId(restore.blockId)
    })
  }, [positionRestoreNonce, activeTab, activeResult, reader])

  useEffect(() => {
    if (pendingPositionRestore === null || !activeTab || activeTab.phase !== 'ready') return
    if (
      pendingPositionRestore.blockId !== null &&
      revealBlockId !== pendingPositionRestore.blockId
    ) {
      return // wait until the revealed block is actually mounted
    }
    const restore = pendingPositionRestore
    queueMicrotask(() => {
      if (restore.blockId !== null) {
        const element = mainRef.current?.querySelector<HTMLElement>(
          `[data-block-id="${restore.blockId}"]`,
        )
        if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView()
        else mainRef.current?.scrollIntoView?.()
      } else {
        mainRef.current?.scrollIntoView?.()
      }
      // Same-version restarts stay silent (models §6.3); cross-version
      // outcomes are labeled exactly/approximately, never fabricated.
      if (restore.kind === 'approx') setHistoryNotice('nav.return.approx')
      else if (restore.reason !== 'same-version') setHistoryNotice('nav.return.exact')
      setPendingPositionRestore(null)
    })
  }, [pendingPositionRestore, activeTab, activeResult, revealBlockId])

  /**
   * Auxiliary-area mutual exclusion (EDGE-06): at most one of files/outline/
   * inspect. Opening inspect temporarily puts the navigation panel away and
   * remembers the user's choice; closing inspect restores it.
   */
  const showPanel = (panel: NavPanelKind) => {
    if (activePanel === 'inspect') setInspectTarget(null)
    if (activePanel !== panel) dispatch(panelToggled(panel))
  }

  const closePanel = () => {
    if (activePanel === 'inspect') {
      closeInspect()
      return
    }
    dispatch(panelClosed())
  }

  const toggleNav = () => {
    if (navPanelKind !== null) {
      dispatch(panelClosed())
      return
    }
    if (activePanel === 'inspect') setInspectTarget(null)
    dispatch(panelToggled(reader.directory !== null ? 'files' : 'outline'))
  }

  const openInspect = (target: InspectTarget) => {
    setInspectTarget(target)
    if (activePanel !== 'inspect') {
      if (activePanel === 'files' || activePanel === 'outline')
        lastNavPanelRef.current = activePanel
      dispatch(panelToggled('inspect'))
    }
  }

  const closeInspect = () => {
    setInspectTarget(null)
    dispatch(panelClosed())
    const previous = lastNavPanelRef.current
    lastNavPanelRef.current = null
    if (previous !== null) dispatch(panelToggled(previous))
  }

  const enterSource = (range: SourceRange | null, blockId: string | null) => {
    if (!activeTab) return
    let resolvedRange = range
    let resolvedBlock = blockId
    if (resolvedBlock === null && resolvedRange === null) {
      resolvedBlock = findVisibleBlockId(mainRef.current)
      resolvedRange = blockRangeFor(activeResult?.blocks ?? [], resolvedBlock)
    }
    setSourceEntry((previous) => ({
      ...previous,
      [activeTab.tabId]: { range: resolvedRange, blockId: resolvedBlock },
    }))
    setSourcePosition((previous) => {
      const next = { ...previous }
      delete next[activeTab.tabId]
      return next
    })
    setSourceNotice(null)
    reader.setViewMode(activeTab.tabId, 'source')
  }

  const backToReading = (info: SourceBackInfo) => {
    if (!activeTab) return
    reader.setViewMode(activeTab.tabId, 'reading')
    const entry = sourceEntry[activeTab.tabId]
    const target = resolveReturnTarget({
      blocks: activeResult?.blocks ?? [],
      rawText: activeModel?.rawText ?? null,
      byteOffset: info.byteOffset,
      savedAnchorBlockId: entry?.blockId ?? null,
    })
    if (target.blockId !== null) {
      const element = mainRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${target.blockId}"]`,
      )
      if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView()
    }
    setSourceNotice(target.kind === 'block' ? null : 'source.notLocated')
  }

  const toggleSource = () => {
    if (!activeTab) return
    if (activeTab.viewMode === 'source') {
      backToReading(sourcePosition[activeTab.tabId] ?? { line: 1, byteOffset: null })
    } else {
      enterSource(null, null)
    }
  }

  /**
   * Resolves an in-page fragment to the rendered element (models §5.2;
   * R14/R15; AT14/AT15). Author fragments are matched through the same slug
   * function the outline used to generate heading ids (`#more-links` →
   * `ps-h-more-links`; CJK text hashes exactly like the outline), so the
   * lookup stays consistent with the rendered anchors and never resolves
   * arbitrary application DOM ids. Footnotes keep their sanitize-pattern ids.
   */
  const resolveFragment = (rawFragment: string): { anchorId: string; element: HTMLElement } | null => {
    const direct = activeResult?.outline.find((entry) => entry.anchorId === rawFragment)
    const headingId = direct?.anchorId ?? `ps-h-${slugifyHeading(rawFragment)}`
    const heading = document.getElementById(headingId)
    if (heading !== null) return { anchorId: headingId, element: heading }
    if (/^ps-fn(ref)?-[A-Za-z0-9-]+$/.test(rawFragment)) {
      const footnote = document.getElementById(rawFragment)
      if (footnote !== null) return { anchorId: rawFragment, element: footnote }
    }
    return null
  }

  const scrollToAnchor = (anchorId: string) => {
    const resolved = resolveFragment(anchorId)
    if (resolved !== null && typeof resolved.element.scrollIntoView === 'function') {
      resolved.element.scrollIntoView()
    }
  }

  // -------------------------------------------------------------------------
  // Navigation history (models §5; T-44; INV-NH-01..08)
  // -------------------------------------------------------------------------

  const currentNavPoint = (): NavPoint => {
    if (!activeTab) {
      return { docId: '', canonicalPath: '', blockId: null, anchorId: null, sourceByte: null }
    }
    return {
      docId: activeTab.docId,
      canonicalPath: activeTab.canonicalPath,
      blockId: findVisibleBlockId(mainRef.current),
      anchorId: currentAnchorId,
      sourceByte: null,
    }
  }

  /** Folded code must expand before the hit is focused (ui-spec §3.4). */
  const expandFoldedAt = (element: HTMLElement) => {
    const block = element.closest('[data-block-id]') ?? element
    const collapsed = block.querySelector('.ps-code-collapsed')
    if (!collapsed) return
    const expand = collapsed.querySelector('.ps-code-expand')
    if (expand instanceof HTMLElement) expand.click()
  }

  /** Locates a point; "approx" means the recorded anchor no longer exists. */
  const locateNavPoint = (point: NavPoint): 'exact' | 'approx' => {
    if (point.anchorId !== null) {
      const element = document.getElementById(point.anchorId)
      if (element) {
        expandFoldedAt(element)
        element.scrollIntoView?.()
        return 'exact'
      }
    }
    if (point.sourceByte !== null && activeTab) {
      const range = { startByte: point.sourceByte, endByte: point.sourceByte }
      setSourceEntry((previous) => ({
        ...previous,
        [activeTab.tabId]: { range, blockId: point.blockId },
      }))
      setSourceNotice(null)
      if (activeTab.viewMode !== 'source') reader.setViewMode(activeTab.tabId, 'source')
      return 'exact'
    }
    if (point.blockId !== null) {
      const element = mainRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${point.blockId}"]`,
      )
      if (element) {
        expandFoldedAt(element)
        element.scrollIntoView?.()
        return 'exact'
      }
    }
    const hadAnchor = point.anchorId !== null || point.blockId !== null || point.sourceByte !== null
    // Never pick an arbitrary block: fall back to the document top and let the
    // caller label the restore as approximate (models §6.3).
    mainRef.current?.scrollIntoView?.()
    return hadAnchor ? 'approx' : 'exact'
  }

  const focusNavPoint = (point: NavPoint, segId: string | null) => {
    if (point.sourceByte !== null) {
      document.querySelector<HTMLElement>('.ps-source-pre')?.focus()
      return
    }
    let element: HTMLElement | null = null
    if (point.blockId !== null) {
      const block = mainRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${point.blockId}"]`,
      )
      element =
        segId !== null
          ? (block?.querySelector<HTMLElement>('mark[data-search-current]') ?? block ?? null)
          : (block ?? null)
    }
    if (element === null && point.anchorId !== null) {
      element = document.getElementById(point.anchorId)
    }
    if (element !== null) {
      element.tabIndex = -1
      element.focus({ preventScroll: true })
    }
  }

  const beginRestore = (entry: HistoryEntry, direction: 'from' | 'to') => {
    if (!activeTab) return
    const point = direction === 'from' ? entry.from : entry.to
    if (point.docId !== activeTab.docId) {
      void reader
        .navigateDocument(activeTab.tabId, point.canonicalPath, point.anchorId)
        .then((result) => {
          if (!result) {
            setHistoryNotice('nav.return.approx')
            return
          }
          setRevealBlockId(point.blockId)
          setPendingLocate({
            tabId: activeTab.tabId,
            point,
            notice: 'auto',
            focus: false,
            segId: null,
          })
        })
      return
    }
    setRevealBlockId(point.blockId)
    setPendingLocate({
      tabId: activeTab.tabId,
      point,
      notice: 'auto',
      focus: false,
      segId: null,
    })
  }

  const handleBack = () => {
    if (!activeTab) return
    const entry = history.back(activeTab.tabId)
    if (entry) beginRestore(entry, 'from')
  }

  const handleForward = () => {
    if (!activeTab) return
    const entry = history.forward(activeTab.tabId)
    if (entry) beginRestore(entry, 'to')
  }

  const blockIdForAnchor = (anchorId: string): string | null => {
    const outlineEntry = activeResult?.outline.find((candidate) => candidate.anchorId === anchorId)
    if (!outlineEntry) return null
    const block = activeResult?.blocks.find(
      (candidate) =>
        outlineEntry.sourceRange.startUtf16 >= candidate.sourceRange.startUtf16 &&
        outlineEntry.sourceRange.startUtf16 < candidate.sourceRange.endUtf16,
    )
    return block?.blockId ?? null
  }

  function anchorKind(anchorId: string): HistoryKind {
    return /^ps-fn(ref)?-[A-Za-z0-9-]+$/.test(anchorId) ? 'footnote' : 'fragment'
  }

  const handleOutlineNavigate = (entry: OutlineEntry, fromAnchorId: string | null) => {
    if (!activeTab) {
      scrollToAnchor(entry.anchorId)
      return
    }
    const base = currentNavPoint()
    const from: NavPoint = fromAnchorId !== null ? { ...base, anchorId: fromAnchorId } : base
    const block = activeResult?.blocks.find(
      (candidate) =>
        entry.sourceRange.startUtf16 >= candidate.sourceRange.startUtf16 &&
        entry.sourceRange.startUtf16 < candidate.sourceRange.endUtf16,
    )
    const to: NavPoint = {
      docId: activeTab.docId,
      canonicalPath: activeTab.canonicalPath,
      blockId: block?.blockId ?? null,
      anchorId: entry.anchorId,
      sourceByte: null,
    }
    history.commit(activeTab.tabId, 'outline', from, to)
    scrollToAnchor(entry.anchorId)
  }

  // -------------------------------------------------------------------------
  // In-page search host (ui-spec §3.4; T-42/T-43)
  // -------------------------------------------------------------------------

  const searchAvailable =
    activeTab !== null && activeTab.phase !== 'failed' && activeTab.phase !== 'cancelled'

  const handleSearchOpen = () => {
    if (!activeTab || !searchAvailable) return
    if (!readSearchSession(activeTab.tabId).open) {
      searchOriginRef.current.set(activeTab.tabId, currentNavPoint())
    }
    openSearchSession(activeTab.tabId)
  }

  function handleSearchLocate(hit: SearchHit, context: SearchLocateContext) {
    if (!activeTab) return
    const tab = activeTab
    const point = pointForSearchHit(hit, tab, activeResult?.blocks ?? [])
    searchCurrentHitRef.current.set(tab.tabId, hit)
    setRevealBlockId(point.blockId)
    setPendingLocate({
      tabId: tab.tabId,
      point,
      notice: null,
      focus: true,
      segId: hit.kind === 'body' ? hit.segId : null,
    })

    // One history entry per search session (INV-NH-05): the first explicit
    // locate commits it, later next/previous locates only update its target.
    const session = searchEntryRef.current.get(tab.tabId)
    if (!session || session.sessionId !== context.sessionId) {
      const from = searchOriginRef.current.get(tab.tabId) ?? currentNavPoint()
      const entry = history.commit(tab.tabId, 'search', from, point)
      searchEntryRef.current.set(tab.tabId, {
        sessionId: context.sessionId,
        entryId: entry.entryId,
        from,
      })
    } else {
      history.search(tab.tabId, session.entryId, session.from, point)
    }
  }

  /** Esc: keep the last hit position and move focus back to it. */
  const handleSearchClose = () => {
    if (!activeTab) return
    const hit = searchCurrentHitRef.current.get(activeTab.tabId)
    if (!hit) return
    const point = pointForSearchHit(hit, activeTab, activeResult?.blocks ?? [])
    focusNavPoint(point, hit.kind === 'body' ? hit.segId : null)
  }

  const handleFormulaInspect = (hit: BodySearchHit) => {
    const segment = activeResult?.segments.find((candidate) => candidate.segId === hit.segId)
    if (!segment) return
    const block = activeResult?.blocks.find((candidate) => candidate.blockId === hit.blockId)
    openInspect({
      kind: 'formula',
      source: segment.text,
      chapter: block && block.headingPath.length > 0 ? block.headingPath.join(' / ') : null,
      range: block?.sourceRangeBytes ?? null,
      diagnostic: null,
    })
  }

  const handleDocumentLink = (href: string) => {
    if (!activeTab || !activeResult) return
    if (href.startsWith('#')) {
      const anchorId = decodeURIComponent(href.slice(1))
      const resolved = resolveFragment(anchorId)
      if (resolved === null) {
        // Missing fragment: stay at the current position and explain
        // (models §5.2; ui-spec §3.3); a failed navigation produces no
        // history entry (INV-NH-02).
        setFragmentNotice('nav.fragment.notFound')
        return
      }
      const from = currentNavPoint()
      const to: NavPoint = {
        docId: activeTab.docId,
        canonicalPath: activeTab.canonicalPath,
        blockId: blockIdForAnchor(resolved.anchorId),
        anchorId: resolved.anchorId,
        sourceByte: null,
      }
      history.commit(activeTab.tabId, anchorKind(resolved.anchorId), from, to)
      resolved.element.scrollIntoView?.()
      return
    }
    const resolved = resolveDocumentLink(activeTab.canonicalPath, href)
    const tabId = activeTab.tabId
    const from = currentNavPoint()
    void reader.navigateDocument(tabId, resolved.path, resolved.anchorId).then((result) => {
      if (!result) return // failure/cancel consumes nothing (INV-NH-02)
      const to: NavPoint = {
        docId: result.docId,
        canonicalPath: resolved.path,
        blockId: null,
        anchorId: result.anchorId,
        sourceByte: null,
      }
      history.commit(tabId, 'document-link', from, to)
      if (resolved.anchorId !== null) {
        setPendingLocate({ tabId, point: to, notice: null, focus: false, segId: null })
      }
    })
  }

  const searchSession = useSearchSession({
    tabId: activeTab?.tabId ?? null,
    segments: activeResult?.segments ?? EMPTY_SEGMENTS,
    rawText: activeModel?.rawText ?? null,
    indexing: activeTab !== null && activeResult === undefined,
    // >50MiB source-window mode keeps no in-memory text: the contract §8
    // `search_source` scan runs in Rust and reports completeness explicitly.
    ...(activeTab !== null &&
    activeModel?.rawText == null &&
    activeTab.session.displayVersion !== null
      ? {
          sourceSearch: (query: string, caseSensitive: boolean) =>
            searchService.searchSource({
              docId: activeTab.docId,
              query,
              caseSensitive,
              maxResults: SEARCH_SOURCE_MAX_RESULTS,
            }),
        }
      : {}),
    onLocate: handleSearchLocate,
  })

  const searchHighlights = useMemo<SearchHighlight[] | undefined>(() => {
    const session = searchSession.state
    if (session.scope !== 'body' || session.matches.length === 0) return undefined
    const bySeg = new Map<string, SearchHighlightRange[]>()
    session.matches.forEach((hit, index) => {
      if (hit.kind !== 'body') return
      const ranges = bySeg.get(hit.segId) ?? []
      ranges.push({
        start: hit.startInSegment,
        end: hit.endInSegment,
        current: index === session.current - 1,
      })
      bySeg.set(hit.segId, ranges)
    })
    if (bySeg.size === 0) return undefined
    return [...bySeg.entries()].map(([segId, ranges]) => ({ segId, ranges }))
  }, [searchSession.state])

  // Resolve a queued locate once the target document/block is on screen; a
  // revealed block is mounted by the progressive mount before this runs. The
  // microtask keeps React state updates out of the effect body itself.
  useEffect(() => {
    if (!pendingLocate || !activeTab || pendingLocate.tabId !== activeTab.tabId) return
    if (activeTab.phase !== 'ready' || !activeResult) return
    let cancelled = false
    const target = pendingLocate
    queueMicrotask(() => {
      if (cancelled) return
      const outcome = locateNavPoint(target.point)
      if (target.focus) focusNavPoint(target.point, target.segId)
      if (target.notice === 'auto') setHistoryNotice(restoreMessageKey(outcome))
      setPendingLocate(null)
    })
    return () => {
      cancelled = true
    }
    // Locator helpers intentionally read the current render's DOM/state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLocate, activeTab, activeResult, revealBlockId])

  const ui: ReaderUi = {
    enterSource,
    openInspect,
    openZoom: (target) => setZoomTarget(target),
    notifyLayoutChange: reader.notifyLayoutChange,
  }

  const outline = activeResult?.outline ?? null
  const currentAnchorId = useOutlineTracking(
    mainRef,
    outline,
    activeTab !== null && activeTab.phase === 'ready',
  )

  // Global shortcuts owned by wp-19 (ui-spec §6.1): Ctrl+O/Ctrl+W/Ctrl+Tab;
  // wp-24 adds Ctrl+B (navigation) and Ctrl+Shift+O (directory). Inputs and
  // IME never swallow shortcuts (EDGE-04). Layout effects register the global
  // listeners during commit, so they are live the moment interactive content
  // is on screen (a passive effect could miss an immediate keystroke).
  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const ctrl = event.ctrlKey || event.metaKey
      if (!ctrl) return
      const key = event.key.toLowerCase()
      if (!event.shiftKey && key === 'w') {
        event.preventDefault()
        controlsRef.current.closeActiveTab()
      } else if (key === 'tab') {
        event.preventDefault()
        controlsRef.current.cycleTab(event.shiftKey ? -1 : 1)
      } else if (!event.shiftKey && key === 'o') {
        event.preventDefault()
        void controlsRef.current.pickAndOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Same eager registration for the second shortcut group (Alt history,
  // Ctrl+, / Ctrl+Shift+O / Ctrl+B / Ctrl+F); deps are absent on purpose so
  // each commit rebinds the closure to the current handlers.
  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      // Alt+←/→ active-tab history (ui-spec §6.1); works from inputs too,
      // only IME composition suppresses shortcuts (EDGE-04).
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
        if (key === 'arrowleft' || key === 'arrowright') {
          event.preventDefault()
          if (key === 'arrowleft') handleBack()
          else handleForward()
          return
        }
      }
      // Ctrl+, opens settings (ui-spec §6.1); it works from inputs too, only
      // IME composition suppresses shortcuts (EDGE-04).
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.isComposing &&
        key === ','
      ) {
        event.preventDefault()
        openSettings('reading')
        return
      }
      if (isEditableTarget(event.target)) return
      if (!(event.ctrlKey || event.metaKey)) return
      if (key === 'o' && event.shiftKey) {
        event.preventDefault()
        void controlsRef.current.pickDirectory()
      } else if (key === 'b' && !event.shiftKey && navAvailable) {
        event.preventDefault()
        toggleNav()
      } else if (key === 'f' && !event.shiftKey && searchAvailable) {
        event.preventDefault()
        handleSearchOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Tauri event bridge (contracts §4): watch/open/focus/close/drag-drop.
  // Layout effect: the transport subscriptions exist as soon as the reader is
  // mounted, so an event arriving immediately after mount is never lost.
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    const bridge = createEventBridge({
      onWatchChanged: (payload) => controlsRef.current.handleWatchChanged(payload),
      onOpenRequested: (request) => void controlsRef.current.openRequest(request),
      onFocusChanged: (focused) => {
        if (!focused) return
        if (focusTimer.current) clearTimeout(focusTimer.current)
        focusTimer.current = setTimeout(() => controlsRef.current.recheckActive(), 300)
      },
      onCloseRequested: (event) => controlsRef.current.handleCloseRequested(event),
      onDragDrop: (paths) => void controlsRef.current.openDrop(paths),
    })
    void bridge.start()
    return () => {
      if (focusTimer.current) clearTimeout(focusTimer.current)
      void bridge.dispose()
    }
  }, [])

  const body = (() => {
    if (!activeTab) {
      return (
        <WelcomePage
          onOpenFile={() => void reader.pickAndOpen()}
          onOpenDirectory={() => void reader.pickDirectory()}
          onOpenRecent={(entry) => void reader.openPaths([entry.canonicalPath], 'recent')}
          onRelink={(entry) => void reader.relinkRecent(entry)}
          onRemoveRecent={(docId) => dispatch(recentRemoved(docId))}
        />
      )
    }

    if (activeTab.viewMode === 'source' && activeTab.session.displayVersion !== null) {
      return (
        <SourceView
          docId={activeTab.docId}
          version={activeTab.session.displayVersion}
          rawText={activeModel?.rawText ?? null}
          initialRange={sourceEntry[activeTab.tabId]?.range ?? null}
          onBack={backToReading}
          onPositionChange={(info) =>
            setSourcePosition((previous) => ({ ...previous, [activeTab.tabId]: info }))
          }
        />
      )
    }

    if (activeTab.phase === 'largeDoc') {
      // Open-time large-document prompt: nothing is read until the user
      // chooses; the dialog carries the decision (rendering-pipeline §5).
      return null
    }

    if (activeTab.phase === 'reading' || activeTab.phase === 'parsing') {
      return (
        <ReaderLoading
          key={`${activeTab.tabId}:${activeTab.session.generation}`}
          phase={activeTab.phase}
          onCancel={() => reader.cancelTab(activeTab.tabId)}
        />
      )
    }

    if (activeTab.phase === 'cancelled') {
      return (
        <div className="ps-reader-notice">
          <p>{t('error.internal.cancelled')}</p>
          <Button variant="secondary" onClick={() => reader.retryTab(activeTab.tabId)}>
            {t('common.retry')}
          </Button>
        </div>
      )
    }

    if (activeTab.phase === 'failed' && !activeModel) {
      const messageKey = activeTab.error?.messageKey ?? 'error.io.readFailed'
      return (
        <div className="ps-reader-notice" role="alert">
          <p>{t(messageKey)}</p>
          {activeTab.error ? <p className="ps-reader-notice-code">{activeTab.error.code}</p> : null}
          <Button variant="secondary" onClick={() => reader.retryTab(activeTab.tabId)}>
            {t('common.retry')}
          </Button>
          <Button variant="secondary" onClick={() => setDiagnosticsOpen(true)}>
            {t('diagnostics.title')}
          </Button>
        </div>
      )
    }

    if (activeModel && activeResult) {
      if (activeModel.rawText.length === 0) {
        return <EmptyState title={t('document.empty')} />
      }
      return (
        <DocumentView
          docId={activeTab.docId}
          rawText={activeModel.rawText}
          result={activeResult}
          generation={activeTab.session.generation}
          simplified={activeMode === 'simplified'}
          revealBlockId={revealBlockId}
          {...(searchHighlights ? { searchHighlights } : {})}
          onDocumentLink={handleDocumentLink}
        />
      )
    }

    // Ready but the display model is unavailable (defensive): keep a readable
    // placeholder instead of an empty body.
    return <Placeholder />
  })()

  return (
    <SettingsProvider>
      <DiagnosticsProvider>
        <ReaderSettingsBridge reader={reader} />
        <DiagnosticsRecorder
          openErrors={reader.openErrors}
          activeError={(activeTab?.error as DocumentDiagnostic | null) ?? null}
          activeDocVersion={activeTab?.session.displayVersion?.contentHash ?? null}
          parseDiagnostics={activeDiagnostics}
        />
        <RootErrorBoundary>
          <ReaderUiContext.Provider value={ui}>
            <div className="ps-reader">
              <ReaderToolbar
                hasDocument={activeTab !== null}
                {...(activeTab
                  ? { displayName: activeTab.displayName, canonicalPath: activeTab.canonicalPath }
                  : {})}
                hasPendingUpdate={activeHasPending}
                modeBadge={modeBadge}
                viewMode={activeTab?.viewMode ?? 'reading'}
                navAvailable={navAvailable}
                navOpen={navPanelKind !== null}
                canGoBack={activeTab !== null && canGoBack(history.state, activeTab.tabId)}
                canGoForward={activeTab !== null && canGoForward(history.state, activeTab.tabId)}
                searchAvailable={searchAvailable}
                searchOpen={searchSession.state.open}
                onOpenFile={() => void reader.pickAndOpen()}
                onOpenDirectory={() => void reader.pickDirectory()}
                onOpenSettings={() => openSettings('reading')}
                onOpenAbout={() => openSettings('about')}
                onCloseDocument={reader.closeActiveTab}
                onToggleNav={toggleNav}
                onToggleSource={toggleSource}
                onBack={handleBack}
                onForward={handleForward}
                onToggleSearch={handleSearchOpen}
              />
              <TabBar
                items={state.tabs.map((tab) => ({
                  tabId: tab.tabId,
                  label: labels.get(tab.tabId) ?? tab.displayName,
                  fullPath: tab.canonicalPath,
                  hasPendingUpdate: selectHasPendingUpdate(tab.session),
                  isActive: tab.tabId === state.activeTabId,
                }))}
                onActivate={reader.activateTab}
                onClose={reader.closeTab}
              />

              {activeTab ? (
                <SearchBar
                  key={activeTab.tabId}
                  session={searchSession}
                  segments={activeResult?.segments ?? EMPTY_SEGMENTS}
                  rawText={activeModel?.rawText ?? null}
                  onClose={handleSearchClose}
                  onFormulaInspect={handleFormulaInspect}
                />
              ) : null}

              <div className="ps-reader-notices">
                {reader.closeSaveFailed ? (
                  <Banner tone="warn">{t('document.state.notSaved')}</Banner>
                ) : null}
                {reader.openErrors.map((failure, index) => (
                  <Banner
                    key={`${failure.path}-${index}`}
                    tone="danger"
                    actions={
                      <>
                        <Button variant="secondary" onClick={() => setDiagnosticsOpen(true)}>
                          {t('diagnostics.title')}
                        </Button>
                        <Button variant="secondary" onClick={reader.clearOpenErrors}>
                          {t('common.close')}
                        </Button>
                      </>
                    }
                  >
                    {t(failure.error.messageKey)} ({failure.error.code})
                  </Banner>
                ))}
                {reader.relinkNotice !== null ? (
                  <Banner
                    tone="info"
                    actions={
                      <Button variant="secondary" onClick={reader.clearRelinkNotice}>
                        {t('common.close')}
                      </Button>
                    }
                  >
                    {t(reader.relinkNotice)}
                  </Banner>
                ) : null}
                {sourceNotice !== null ? (
                  <Banner
                    tone="warn"
                    actions={
                      <Button variant="secondary" onClick={() => setSourceNotice(null)}>
                        {t('common.close')}
                      </Button>
                    }
                  >
                    {t(sourceNotice)}
                  </Banner>
                ) : null}
                {fragmentNotice !== null ? (
                  <Banner
                    tone="warn"
                    actions={
                      <Button variant="secondary" onClick={() => setFragmentNotice(null)}>
                        {t('common.close')}
                      </Button>
                    }
                  >
                    {t(fragmentNotice)}
                  </Banner>
                ) : null}
                {historyNotice !== null ? (
                  <Banner
                    tone="info"
                    actions={
                      <Button variant="secondary" onClick={() => setHistoryNotice(null)}>
                        {t('common.close')}
                      </Button>
                    }
                  >
                    {t(historyNotice)}
                  </Banner>
                ) : null}
                {activeTab && modeBadge !== null && modeHonesty.coverageKey !== null &&
                modeNoticeKey !== null &&
                modeNoticeDismissed[modeNoticeKey] !== true ? (
                  <Banner
                    tone={activeHardLimit ? 'warn' : 'info'}
                    actions={
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setModeNoticeDismissed((previous) => ({
                            ...previous,
                            [modeNoticeKey]: true,
                          }))
                        }
                      >
                        {t('common.close')}
                      </Button>
                    }
                  >
                    {t(modeHonesty.coverageKey)}
                  </Banner>
                ) : null}
                <UpdateBanner variant={updateBannerState} {...updateBannerHandlers} />
                {activeTab && activeTab.session.status === 'unavailable' ? (
                  <Banner
                    tone="warn"
                    actions={
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => void reader.relinkTab(activeTab.tabId)}
                        >
                          {t('document.unavailable.relink')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => reader.retryTab(activeTab.tabId)}
                        >
                          {t('common.retry')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => reader.closeTab(activeTab.tabId)}
                        >
                          {t('document.unavailable.closeTab')}
                        </Button>
                      </>
                    }
                  >
                    {t('document.unavailable.banner', {
                      title: t('document.unavailable.title'),
                      message: t('document.unavailable.message'),
                    })}
                  </Banner>
                ) : null}
                {commitNotice !== null ? (
                  <Toast
                    tone="success"
                    message={t(commitNotice.messageKey)}
                    onDismiss={() => {
                      if (commitNoticeTabId !== null) reader.dismissCommitNotice(commitNoticeTabId)
                    }}
                  />
                ) : null}
                {reader.positionError !== null ? (
                  <Banner
                    tone="danger"
                    actions={
                      <>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            activeTab ? reader.retryPositionSave(activeTab.tabId) : undefined
                          }
                        >
                          {t('common.retry')}
                        </Button>
                        <Button variant="secondary" onClick={reader.clearPositionError}>
                          {t('common.close')}
                        </Button>
                      </>
                    }
                  >
                    {t('document.position.notSaved')}
                  </Banner>
                ) : null}
              </div>

              <div className="ps-reader-body">
                {navPanelKind !== null ? (
                  <NavPanel
                    panel={navPanelKind}
                    root={reader.directory}
                    outline={outline}
                    docId={activeTab?.docId ?? null}
                    selectedPath={activeTab?.canonicalPath ?? null}
                    currentAnchorId={currentAnchorId}
                    onSelectPanel={showPanel}
                    onOpenFile={(path) => void reader.openPaths([path], 'tree')}
                    onOutlineNavigate={handleOutlineNavigate}
                    onClose={closePanel}
                  />
                ) : null}

                <main
                  ref={mainRef}
                  id={DOCUMENT_BODY_ID}
                  className="ps-reader-main"
                  aria-label={t('aria.documentBody')}
                  onScroll={observeCurrentPosition}
                  {...(activeTab ? { role: 'tabpanel' } : {})}
                >
                  {body}
                </main>

                {activePanel === 'inspect' && inspectTarget !== null ? (
                  <InspectDrawer target={inspectTarget} onClose={closeInspect} />
                ) : null}
              </div>
            </div>
            {zoomTarget !== null ? (
              <ZoomOverlay target={zoomTarget} onClose={() => setZoomTarget(null)} />
            ) : null}
            {settingsOpen ? (
              <SettingsDialog
                onClose={() => setSettingsOpen(false)}
                initialCategory={settingsCategory}
                currentDocument={currentDocumentSettings}
              />
            ) : null}
            {diagnosticsOpen ? (
              <DiagnosticsPanel
                onClose={() => setDiagnosticsOpen(false)}
                protectedPaths={state.tabs.map((tab) => tab.canonicalPath)}
              />
            ) : null}
            {largeDocPrompt !== null && activeTab !== null ? (
              <LargeDocDialog
                sizeBytes={largeDocPrompt.sizeBytes}
                reason={largeDocPrompt.reason}
                onChoose={(choice) => reader.chooseLargeDoc(activeTab.tabId, choice)}
              />
            ) : null}
            {/* Local/remote authorization dialogs (ui-spec §3.8; models §8). */}
            <ResourceAuthDialogs onError={reader.reportOpenError} />
          </ReaderUiContext.Provider>
        </RootErrorBoundary>
      </DiagnosticsProvider>
    </SettingsProvider>
  )
}
