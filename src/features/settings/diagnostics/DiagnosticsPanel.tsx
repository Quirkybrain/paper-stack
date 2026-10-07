import { useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { clipboard } from '../../../services'
import { buildDiagnosticsSummary, type DiagnosticEntry } from './diagnostics-model'
import { useDiagnostics } from './diagnostics-context'
import { ExportPreviewDialog } from './ExportPreviewDialog'

/**
 * Diagnostics panel (ui-spec §3.8 UI07; IXD §15.2; R28).
 *
 * Reason first, then category/version/source location, with the technical
 * details folded away. "复制诊断摘要" defaults to the redacted summary —
 * source context and full paths are only added inside the export preview
 * after an explicit opt-in. Export never uploads anything.
 */

export interface DiagnosticsPanelProps {
  onClose(): void
  /** Canonical paths of currently open documents (export protection). */
  protectedPaths: readonly string[]
}

function sourceRangeLabel(entry: DiagnosticEntry): string | null {
  if (entry.sourceRange === undefined) return null
  return `${entry.sourceRange.startByte}-${entry.sourceRange.endByte}`
}

export function DiagnosticsPanel({ onClose, protectedPaths }: DiagnosticsPanelProps) {
  const { entries } = useDiagnostics()
  const [exportOpen, setExportOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copySummary = async () => {
    const summary = buildDiagnosticsSummary(entries)
    const result = await clipboard.copyText(summary.text)
    setCopyState(result.ok ? 'copied' : 'failed')
    if (result.ok) setTimeout(() => setCopyState('idle'), 1500)
  }

  return (
    <Modal onClose={onClose} ariaLabel={t('diagnostics.title')} className="ps-diagnostics-panel">
      <h2>{t('diagnostics.title')}</h2>

      <ul className="ps-diagnostics-list">
        {entries.map((entry) => (
          <li key={entry.id} className="ps-diagnostics-entry">
            <p className="ps-diagnostics-reason">{t(entry.messageKey)}</p>
            {entry.count > 1 ? <p className="ps-settings-hint">{`×${entry.count}`}</p> : null}
            {entry.code !== undefined ? (
              <p className="ps-settings-hint">{t('diagnostics.errorId', { id: entry.code })}</p>
            ) : null}
            {entry.category !== undefined ? (
              <p className="ps-settings-hint">
                {t('diagnostics.category')}: {entry.category}
              </p>
            ) : null}
            {entry.docVersion !== undefined ? (
              <p className="ps-settings-hint">
                {t('diagnostics.docVersion')}: {entry.docVersion}
              </p>
            ) : null}
            {sourceRangeLabel(entry) !== null ? (
              <p className="ps-settings-hint">
                {t('diagnostics.sourceLocation', { range: sourceRangeLabel(entry) ?? '' })}
              </p>
            ) : null}
            {entry.details !== undefined ? (
              <details className="ps-diagnostics-details">
                <summary>{t('diagnostics.details')}</summary>
                <pre>{JSON.stringify(entry.details, null, 2)}</pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="ps-settings-actions">
        <Button
          variant="secondary"
          disabled={entries.length === 0}
          disabledReason={t('common.unavailable')}
          onClick={() => void copySummary()}
        >
          {t('diagnostics.copySummary')}
        </Button>
        <Button variant="primary" onClick={() => setExportOpen(true)}>
          {t('diagnostics.export')}
        </Button>
      </div>
      {copyState === 'copied' ? (
        <p role="status" className="ps-settings-hint">
          {t('diagnostics.copy.copied')}
        </p>
      ) : null}
      {copyState === 'failed' ? (
        <p role="alert" className="ps-settings-field-error">
          {t('diagnostics.copy.failed')}
        </p>
      ) : null}

      {exportOpen ? (
        <ExportPreviewDialog onClose={() => setExportOpen(false)} protectedPaths={protectedPaths} />
      ) : null}
    </Modal>
  )
}
