import katex from 'katex'
import { createElement, useMemo, type ReactNode } from 'react'

import { t } from '../../../app/i18n'
import { clipboard } from '../../../services'
import { Button } from '../../../components/Button'
import { SanitizedNode } from '../../../document/SanitizedNode'
import { katexOptions } from '../../../document/plugins/katex'
import { useReaderUi } from '../ui-context'
import { useCopyFeedback } from './copy-feedback'
import type { FormulaInspectTarget } from './types'

/**
 * Formula panel inside the 340px non-modal inspect drawer (ui-spec §3.6,
 * VC-06; T-46): formula preview, raw source without `$`, source chapter and
 * diagnostics, plus copy / view-source / zoom tools.
 *
 * The preview reuses the pipeline-frozen KaTeX options (`katexOptions`,
 * trust:false + maxSize/maxExpand caps) and injects its output through the
 * single `document/SanitizedNode` wrapper (B-01).
 *
 * Copy feedback follows EDGE-09: only a confirmed clipboard write shows
 * “已复制”, reverting after ~1.5s; a failure stays until the next attempt.
 */

export const FORMULA_COPY_FEEDBACK_MS = 1500

export function renderFormulaPreview(source: string): string | null {
  try {
    return katex.renderToString(source, {
      ...katexOptions({}),
      displayMode: false,
      throwOnError: false,
    })
  } catch {
    return null
  }
}

export interface FormulaPanelProps {
  target: FormulaInspectTarget
}

export function FormulaPanel({ target }: FormulaPanelProps) {
  const ui = useReaderUi()
  const { status: feedback, report: reportCopy } = useCopyFeedback(FORMULA_COPY_FEEDBACK_MS)
  const previewHtml = useMemo(() => renderFormulaPreview(target.source), [target.source])

  const handleCopy = async () => {
    const result = await clipboard.copyText(target.source)
    reportCopy(result.ok)
  }

  const previewNode: ReactNode =
    previewHtml === null
      ? createElement('code', { className: 'ps-formula-source-fallback' }, target.source)
      : createElement(SanitizedNode, { html: previewHtml })

  return (
    <div className="ps-formula-panel">
      <div className="ps-formula-preview" data-formula-preview="">
        {previewNode}
      </div>

      <section className="ps-formula-section">
        <h4>{t('formula.sourceLabel')}</h4>
        <pre className="ps-inspect-source" tabIndex={0}>
          {target.source}
        </pre>
      </section>

      {target.chapter !== null ? (
        <section className="ps-formula-section">
          <h4>{t('formula.chapterLabel')}</h4>
          <p>{target.chapter}</p>
        </section>
      ) : null}

      {target.diagnostic !== null ? (
        <details className="ps-formula-section">
          <summary>{t('formula.diagnostics')}</summary>
          <p>{t(target.diagnostic.messageKey)}</p>
          <p className="ps-inspect-code">{target.diagnostic.code}</p>
        </details>
      ) : null}

      <div className="ps-formula-actions">
        <Button variant="secondary" onClick={() => void handleCopy()}>
          {t('formula.action.copySource')}
        </Button>
        {ui ? (
          <Button variant="secondary" onClick={() => ui.enterSource(target.range, null)}>
            {t('formula.action.viewSource')}
          </Button>
        ) : null}
        {ui ? (
          <Button
            variant="secondary"
            onClick={() =>
              ui.openZoom({ label: t('formula.drawer.title'), content: previewNode })
            }
          >
            {t('formula.action.zoom')}
          </Button>
        ) : null}
        {feedback === 'copied' ? <span role="status">{t('formula.copied')}</span> : null}
        {feedback === 'failed' ? <span role="alert">{t('formula.copyFailed')}</span> : null}
      </div>
    </div>
  )
}
