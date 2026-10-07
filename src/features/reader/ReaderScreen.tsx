import { useEffect, useMemo, useRef, useState } from 'react'

import { createEventBridge } from '../../app/events'
import { t } from '../../app/i18n'
import { selectHasPendingUpdate } from '../../app/session'
import { panelClosed, panelToggled, recentRemoved, useAppDispatch, useAppState } from '../../app/store'
import { Banner } from '../../components/Banner'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Placeholder, type PlaceholderStage } from '../../components/Placeholder'
import { DOCUMENT_BODY_ID } from '../../components/SkipLink'
import type { OutlineEntry, ParseDocumentResult } from '../../document/types'
import type { SourceRange } from '../../services/types'
import { DocumentView } from './body/DocumentView'
import { InspectDrawer } from './inspect/InspectDrawer'
import type { InspectTarget } from './inspect/types'
import { NavPanel, type NavPanelKind } from './nav/NavPanel'
import { useOutlineTracking } from './nav/use-outline-tracking'
import { RootErrorBoundary } from './RootErrorBoundary'
import { tabDisplayLabels } from './reader-state'
import { SourceView, type SourceBackInfo } from './source/SourceView'
import {
  blockRangeFor,
  findVisibleBlockId,
  resolveReturnTarget,
} from './source/mapping'
import { TabBar } from './tabs/TabBar'
import { ReaderToolbar } from './toolbar/ReaderToolbar'
import { ReaderUiContext, type ReaderUi } from './ui-context'
import { displayDocumentModel, useReader } from './use-reader'
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
    <Placeholder
      {...(stage ? { stage } : {})}
      cancellable={step === 'stage'}
      onCancel={onCancel}
    />
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

  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(null)
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null)
  const [sourceEntry, setSourceEntry] = useState<Record<string, SourceEntry>>({})
  const [sourcePosition, setSourcePosition] = useState<Record<string, SourceBackInfo>>({})
  const [sourceNotice, setSourceNotice] = useState<string | null>(null)
  const lastNavPanelRef = useRef<NavPanelKind | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  const controlsRef = useRef(reader)
  useEffect(() => {
    controlsRef.current = reader
  })

  const activePanel = appState.activePanel
  const navPanelKind: NavPanelKind | null =
    activePanel === 'files' || activePanel === 'outline' ? activePanel : null
  const navAvailable = reader.directory !== null || activeTab !== null

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
      if (activePanel === 'files' || activePanel === 'outline') lastNavPanelRef.current = activePanel
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

  const scrollToAnchor = (anchorId: string) => {
    const element = document.getElementById(anchorId)
    if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView()
  }

  const handleOutlineNavigate = (entry: OutlineEntry, fromAnchorId: string | null) => {
    // The source anchor is captured before the jump; wp-25 records the actual
    // navigation history item through the same callback contract (models §5).
    void fromAnchorId
    scrollToAnchor(entry.anchorId)
  }

  const ui: ReaderUi = {
    enterSource,
    openInspect,
    openZoom: (target) => setZoomTarget(target),
  }

  const outline = activeResult?.outline ?? null
  const currentAnchorId = useOutlineTracking(
    mainRef,
    outline,
    activeTab !== null && activeTab.phase === 'ready',
  )

  // Global shortcuts owned by wp-19 (ui-spec §6.1): Ctrl+O/Ctrl+W/Ctrl+Tab;
  // wp-24 adds Ctrl+B (navigation) and Ctrl+Shift+O (directory). Inputs and
  // IME never swallow shortcuts (EDGE-04).
  useEffect(() => {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'o' && event.shiftKey) {
        event.preventDefault()
        void controlsRef.current.pickDirectory()
      } else if (key === 'b' && !event.shiftKey && navAvailable) {
        event.preventDefault()
        toggleNav()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Tauri event bridge (contracts §4): watch/open/focus/close/drag-drop.
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const bridge = createEventBridge({
      onWatchChanged: (payload) => controlsRef.current.handleWatchChanged(payload),
      onOpenRequested: (request) => void controlsRef.current.openRequest(request),
      onFocusChanged: (focused) => {
        if (!focused) return
        if (focusTimer.current) clearTimeout(focusTimer.current)
        focusTimer.current = setTimeout(() => controlsRef.current.recheckActive(), 300)
      },
      onCloseRequested: (event) => controlsRef.current.handleCloseRequested(event),
      onDragDrop: (paths) => void controlsRef.current.openPaths(paths, 'drop'),
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
          {activeTab.error ? (
            <p className="ps-reader-notice-code">{activeTab.error.code}</p>
          ) : null}
          <Button variant="secondary" onClick={() => reader.retryTab(activeTab.tabId)}>
            {t('common.retry')}
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
        />
      )
    }

    // Ready but the display model is unavailable (defensive): keep a readable
    // placeholder instead of an empty body.
    return <Placeholder />
  })()

  return (
    <RootErrorBoundary>
      <ReaderUiContext.Provider value={ui}>
        <div className="ps-reader">
          <ReaderToolbar
            hasDocument={activeTab !== null}
            {...(activeTab
              ? { displayName: activeTab.displayName, canonicalPath: activeTab.canonicalPath }
              : {})}
            hasPendingUpdate={activeHasPending}
            viewMode={activeTab?.viewMode ?? 'reading'}
            navAvailable={navAvailable}
            navOpen={navPanelKind !== null}
            onOpenFile={() => void reader.pickAndOpen()}
            onOpenDirectory={() => void reader.pickDirectory()}
            onCloseDocument={reader.closeActiveTab}
            onToggleNav={toggleNav}
            onToggleSource={toggleSource}
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

          <div className="ps-reader-notices">
            {reader.closeSaveFailed ? (
              <Banner tone="warn">{t('document.state.notSaved')}</Banner>
            ) : null}
            {reader.openErrors.map((failure, index) => (
              <Banner
                key={`${failure.path}-${index}`}
                tone="danger"
                actions={
                  <Button variant="secondary" onClick={reader.clearOpenErrors}>
                    {t('common.close')}
                  </Button>
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
            {activeTab && activeHasPending && !activeTab.bannerCollapsed ? (
              <Banner
                tone="warn"
                label={t('aria.updateBanner')}
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => reader.setBannerCollapsed(activeTab.tabId, true)}
                  >
                    {t('update.action.later')}
                  </Button>
                }
              >
                {t('update.banner')}
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
      </ReaderUiContext.Provider>
    </RootErrorBoundary>
  )
}
