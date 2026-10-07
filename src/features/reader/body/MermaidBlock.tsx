import { useEffect, useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import {
  MERMAID_HTML_LABELS,
  MERMAID_SECURITY_LEVEL,
  renderMermaidDiagram,
  type MermaidRenderer,
  type MermaidRenderResult,
} from '../../../document/plugins/mermaid'
import { useBlockContext } from '../inspect/block-context'
import { useReaderUi } from '../ui-context'

/**
 * On-demand Mermaid rendering (rendering-pipeline §2.10; ui-spec §3.6, IX07).
 *
 * The placeholder produced by pipeline slot ⑩ carries only the source. This
 * component waits until the block is (nearly) visible, dynamically imports
 * `mermaid`, and renders under the frozen strict policy — document text can
 * never change `securityLevel`/`htmlLabels`. Failures (syntax, unsupported
 * family, timeout, node cap) show a localized in-block error plus the source;
 * there is no automatic retry.
 *
 * `dangerouslySetInnerHTML` is confined to this single trusted-engine wrapper
 * (security-model §5.2: post-sanitize engine output). The SVG comes from
 * Mermaid strict mode, never from raw document HTML.
 */

export interface MermaidBlockDeps {
  loadRenderer?: () => Promise<MermaidRenderer>
}

export interface MermaidBlockProps {
  source: string
  deps?: MermaidBlockDeps
}

type RenderState =
  | { status: 'waiting' }
  | { status: 'loading' }
  | { status: 'ready'; svg: string; version: string }
  | { status: 'failed'; result: Extract<MermaidRenderResult, { ok: false }> }

let mermaidModulePromise: Promise<MermaidRenderer> | null = null

/** Lazily loads and initializes Mermaid exactly once (frozen policy). */
export function loadMermaidRenderer(): Promise<MermaidRenderer> {
  mermaidModulePromise ??= import('mermaid').then((module) => {
    const mermaid = module.default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: MERMAID_SECURITY_LEVEL,
      htmlLabels: MERMAID_HTML_LABELS,
      theme: 'neutral',
    })
    return {
      version: `mermaid@${(mermaid as { version?: string }).version ?? 'unknown'}`,
      render: async (id: string, source: string) => {
        const result = await mermaid.render(id, source)
        return { svg: result.svg }
      },
    }
  })
  return mermaidModulePromise
}

/** Test helper: drop the cached Mermaid module promise. */
export function resetMermaidRendererForTests(): void {
  mermaidModulePromise = null
}

export function MermaidBlock({ source, deps }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<RenderState>({ status: 'waiting' })
  const context = useBlockContext()
  const ui = useReaderUi()

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      // jsdom / environments without IntersectionObserver render immediately;
      // the WebView target supports it, so real rendering stays visibility-gated.
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    let cancelled = false
    const loadRenderer = deps?.loadRenderer ?? loadMermaidRenderer
    void renderMermaidDiagram(source, { loadRenderer }).then((result) => {
      if (cancelled) return
      setState(result.ok ? { status: 'ready', svg: result.svg, version: result.version } : { status: 'failed', result })
    })
    return () => {
      cancelled = true
    }
  }, [visible, source, deps])

  // Derived: visible but not settled yet reads as "loading" without an extra
  // synchronous state update inside the effect.
  const status: RenderState['status'] =
    !visible ? 'waiting' : state.status === 'waiting' ? 'loading' : state.status

  return (
    <div className="ps-mermaid-block" ref={containerRef} data-mermaid-state={status}>
      {ui ? (
        <div className="ps-mermaid-tools" role="group">
          <Button
            variant="secondary"
            onClick={() => ui.enterSource(context?.range ?? null, context?.blockId ?? null)}
          >
            {t('mermaid.action.viewSource')}
          </Button>
          {state.status === 'ready' ? (
            <Button
              variant="secondary"
              onClick={() =>
                ui.openZoom({
                  label: t('mermaid.action.zoom'),
                  content: (
                    <div
                      className="ps-mermaid-svg"
                      dangerouslySetInnerHTML={{ __html: state.svg }}
                    />
                  ),
                })
              }
            >
              {t('mermaid.action.zoom')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className="ps-mermaid-svg" dangerouslySetInnerHTML={{ __html: state.svg }} />
      ) : (
        <div className="ps-mermaid-source-view">
          <p className="ps-mermaid-error-title" role="note">
            {state.status === 'failed' ? t(state.result.failure.messageKey) : t('common.loading')}
          </p>
          {state.status === 'failed' ? (
            <dl className="ps-mermaid-diagnostics">
              {state.result.failure.diagramType !== undefined ? (
                <div>
                  <dt>{t('mermaid.error.type', { type: state.result.failure.diagramType })}</dt>
                </div>
              ) : null}
              {state.result.failure.summary !== undefined ? (
                <div>
                  <dt>{t('mermaid.error.summary', { summary: state.result.failure.summary })}</dt>
                </div>
              ) : null}
            </dl>
          ) : null}
          <details className="ps-mermaid-source-details">
            <summary>{t('mermaid.action.viewSource')}</summary>
            <pre className="ps-mermaid-source">{source}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
