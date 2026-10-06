import { useEffect, useMemo, useRef, useState } from 'react'

import { createEventBridge } from '../../app/events'
import { t } from '../../app/i18n'
import { selectHasPendingUpdate } from '../../app/session'
import { Banner } from '../../components/Banner'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Placeholder, type PlaceholderStage } from '../../components/Placeholder'
import { DOCUMENT_BODY_ID } from '../../components/SkipLink'
import type { ParseDocumentResult } from '../../document/types'
import { DocumentView } from './body/DocumentView'
import { RootErrorBoundary } from './RootErrorBoundary'
import { tabDisplayLabels } from './reader-state'
import { TabBar } from './tabs/TabBar'
import { ReaderToolbar } from './toolbar/ReaderToolbar'
import { displayDocumentModel, useReader } from './use-reader'
import './reader.css'

/**
 * Minimal reader assembly (ui-spec §3.2 UI01; handoff wp-19+wp-20):
 * toolbar, conditional tab bar, body with loading/error states, update-banner
 * state (keep mode only), the global shortcuts this task owns (Ctrl+O,
 * Ctrl+W, Ctrl+Tab) and the Tauri event bridge. Welcome stays a placeholder
 * until wp-24 replaces it; source view / inspect drawers / search / settings
 * arrive in later tasks and are not faked here.
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

export default function ReaderScreen() {
  const reader = useReader()
  const { state } = reader
  const activeTab = state.tabs.find((tab) => tab.tabId === state.activeTabId) ?? null
  const labels = useMemo(() => tabDisplayLabels(state.tabs), [state.tabs])

  const controlsRef = useRef(reader)
  useEffect(() => {
    controlsRef.current = reader
  })

  // Global shortcuts owned by wp-19 (ui-spec §6.1). Unimplemented shortcuts
  // are not intercepted; inputs/IME never swallow shortcuts (EDGE-04).
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

  const activeModel = activeTab ? displayDocumentModel(activeTab) : undefined
  const activeHasPending = activeTab ? selectHasPendingUpdate(activeTab.session) : false

  const body = (() => {
    if (!activeTab) {
      return (
        <div className="ps-reader-welcome">
          <h1>{t('app.name')}</h1>
          <p className="ps-reader-welcome-note">{t('welcome.note')}</p>
        </div>
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

    if (activeModel) {
      const result = activeModel.parseResult as ParseDocumentResult | undefined
      if (!result) return null
      if (activeModel.rawText.length === 0) {
        return <EmptyState title={t('document.empty')} />
      }
      return (
        <DocumentView
          docId={activeTab.docId}
          rawText={activeModel.rawText}
          result={result}
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
      <div className="ps-reader">
        <ReaderToolbar
          hasDocument={activeTab !== null}
          {...(activeTab
            ? { displayName: activeTab.displayName, canonicalPath: activeTab.canonicalPath }
            : {})}
          hasPendingUpdate={activeHasPending}
          onOpenFile={() => void reader.pickAndOpen()}
          onCloseDocument={reader.closeActiveTab}
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
          {reader.closeSaveFailed ? <Banner tone="warn">{t('document.state.notSaved')}</Banner> : null}
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

        <main
          id={DOCUMENT_BODY_ID}
          className="ps-reader-main"
          aria-label={t('aria.documentBody')}
          {...(activeTab ? { role: 'tabpanel' } : {})}
        >
          {body}
        </main>
      </div>
    </RootErrorBoundary>
  )
}
