import { useCallback, useEffect, useId, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import {
  clipboard,
  diagnostics as diagnosticsService,
  files,
  toErrorPayload,
} from '../../../services'
import type { DiagnosticsPreview, ErrorPayload } from '../../../services/types'
import { isProtectedExportTarget } from './diagnostics-model'

/**
 * Diagnostics export preview (ui-spec §3.8/IXD §15.3; security-model §7; R28).
 *
 * preview → target picker → component-level protection check → write →
 * honest result. Redaction options are off by default and any change
 * re-requests the preview so the user always sees the bytes that would be
 * exported. A cancelled picker writes nothing; a failure keeps the preview
 * for manual copy, retries nowhere else and uploads nothing.
 */

export interface ExportPreviewDialogProps {
  onClose(): void
  /** Canonical paths of currently open documents (protected source set). */
  protectedPaths: readonly string[]
}

type Notice =
  | { tone: 'success'; key: string; params: Record<string, string | number> }
  | { tone: 'danger'; key: string }

export function ExportPreviewDialog({ onClose, protectedPaths }: ExportPreviewDialogProps) {
  const [includeSourceContext, setIncludeSourceContext] = useState(false)
  const [includeFullPaths, setIncludeFullPaths] = useState(false)
  /**
   * Keyed preview state: `null` or a mismatched key means "loading" for the
   * current options, so the effect never has to reset state synchronously.
   */
  const [previewState, setPreviewState] = useState<{
    key: string
    preview?: DiagnosticsPreview
    error?: ErrorPayload
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [overwriteTarget, setOverwriteTarget] = useState<string | null>(null)
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const titleId = useId()

  const requestKey = `${includeSourceContext}|${includeFullPaths}|${attempt}`
  const currentPreview = previewState?.key === requestKey ? previewState : null
  const preview = currentPreview?.preview ?? null
  const previewError = currentPreview?.error ?? null

  useEffect(() => {
    let cancelled = false
    void diagnosticsService
      .previewDiagnostics({ includeSourceContext, includeFullPaths })
      .then((value) => {
        if (!cancelled) setPreviewState({ key: requestKey, preview: value })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setPreviewState({ key: requestKey, error: toErrorPayload(cause) })
      })
    return () => {
      cancelled = true
    }
  }, [includeSourceContext, includeFullPaths, requestKey])

  const copyPreview = async () => {
    if (preview === null) return
    const result = await clipboard.copyText(preview.text)
    setCopied(result.ok ? 'copied' : 'failed')
    if (result.ok) {
      setTimeout(() => setCopied('idle'), 1500)
    }
  }

  const writeTo = useCallback(
    async (targetPath: string, overwrite: boolean): Promise<void> => {
      if (preview === null) return
      setBusy(true)
      setNotice(null)
      try {
        const result = await diagnosticsService.exportDiagnostics({
          exportId: preview.exportId,
          targetPath,
          overwrite,
        })
        setOverwriteTarget(null)
        setNotice({
          tone: 'success',
          key: 'diagnostics.export.success',
          params: { path: result.writtenPath },
        })
      } catch (cause) {
        const payload = toErrorPayload(cause)
        if (payload.code === 'PS_IO_EXPORT_BLOCKED') {
          // `PS_IO_EXPORT_BLOCKED` carries a machine-readable reason
          // (security-model §7; D-34b-3/AT28): only `target-exists` is an
          // overwrite question. A protected source target (including sources
          // known only to Rust, e.g. error-state documents) must be explained
          // and re-chosen, never confirmed as an overwrite.
          if (payload.details?.reason === 'target-exists') {
            if (overwrite) {
              setNotice({ tone: 'danger', key: 'diagnostics.export.saveFailed' })
            } else {
              setOverwriteTarget(targetPath)
            }
          } else {
            setNotice({ tone: 'danger', key: 'diagnostics.export.blocked' })
          }
        } else {
          setNotice({ tone: 'danger', key: 'diagnostics.export.saveFailed' })
        }
      } finally {
        setBusy(false)
      }
    },
    [preview],
  )

  const chooseTarget = async () => {
    if (preview === null || busy) return
    setNotice(null)
    let picked
    try {
      picked = await files.pickExportTarget()
    } catch (cause) {
      setNotice({ tone: 'danger', key: toErrorPayload(cause).messageKey })
      return
    }
    if (picked.cancelled || picked.paths.length === 0) return // no write, preview kept
    const targetPath = picked.paths[0]
    if (isProtectedExportTarget(targetPath, protectedPaths)) {
      setNotice({ tone: 'danger', key: 'diagnostics.export.blocked' })
      return
    }
    await writeTo(targetPath, false)
  }

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="ps-export-dialog">
      <h2 id={titleId}>{t('diagnostics.preview.title')}</h2>
      <p className="ps-settings-hint">{t('diagnostics.preview.redacted')}</p>

      <div className="ps-export-options">
        <label className="ps-setting-radio">
          <input
            type="checkbox"
            checked={includeSourceContext}
            onChange={(event) => setIncludeSourceContext(event.target.checked)}
          />
          <span>{t('diagnostics.preview.includeSource')}</span>
        </label>
        <label className="ps-setting-radio">
          <input
            type="checkbox"
            checked={includeFullPaths}
            onChange={(event) => setIncludeFullPaths(event.target.checked)}
          />
          <span>{t('diagnostics.preview.includePaths')}</span>
        </label>
      </div>

      {previewError !== null ? (
        <div role="alert" className="ps-settings-field-error">
          <p>{t(previewError.messageKey)}</p>
          <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
            {t('common.retry')}
          </Button>
        </div>
      ) : preview === null ? (
        <p role="status">{t('common.loading')}</p>
      ) : (
        <>
          <p className="ps-settings-hint">
            {t('diagnostics.preview.redactions', { count: preview.redactionCount })}
          </p>
          <pre className="ps-export-preview" tabIndex={0}>
            {preview.text}
          </pre>
          <div className="ps-settings-actions">
            <Button variant="secondary" onClick={() => void copyPreview()}>
              {t('diagnostics.preview.copy')}
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void chooseTarget()}>
              {t('diagnostics.export.chooseTarget')}
            </Button>
          </div>
          {copied === 'copied' ? (
            <p role="status" className="ps-settings-hint">
              {t('diagnostics.copy.copied')}
            </p>
          ) : null}
          {copied === 'failed' ? (
            <p role="alert" className="ps-settings-field-error">
              {t('diagnostics.copy.failed')}
            </p>
          ) : null}
        </>
      )}

      {overwriteTarget !== null ? (
        <div
          role="alertdialog"
          aria-label={t('diagnostics.export.overwrite')}
          className="ps-export-overwrite"
        >
          <p>{t('diagnostics.export.overwrite')}</p>
          <div className="ps-settings-actions">
            <Button variant="secondary" onClick={() => setOverwriteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => void writeTo(overwriteTarget, true)}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      ) : null}

      {notice !== null ? (
        <p
          role={notice.tone === 'danger' ? 'alert' : 'status'}
          className={notice.tone === 'danger' ? 'ps-settings-field-error' : 'ps-settings-hint'}
        >
          {notice.tone === 'success' ? t(notice.key, notice.params) : t(notice.key)}
        </p>
      ) : null}

      <div className="ps-settings-actions">
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Modal>
  )
}
