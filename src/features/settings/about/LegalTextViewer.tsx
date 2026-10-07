import { useEffect, useId, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { app, toErrorPayload } from '../../../services'
import type { ErrorPayload, LegalTextKind } from '../../../services/types'

/**
 * Offline legal text viewer (ui-spec §3.7; IXD §15.1/§15.4; R30).
 *
 * Reads the bundled license/third-party text through `read_legal_text`.
 * When the resource is not bundled yet, the viewer says so using the error
 * message and never renders fabricated legal text.
 */

export interface LegalTextViewerProps {
  kind: LegalTextKind
  onClose(): void
}

interface LegalTextState {
  kind: LegalTextKind
  text?: string
  resourceName?: string
  error?: ErrorPayload
}

export function LegalTextViewer({ kind, onClose }: LegalTextViewerProps) {
  const [result, setResult] = useState<LegalTextState | null>(null)
  const titleId = useId()

  useEffect(() => {
    let cancelled = false
    void app
      .readLegalText(kind)
      .then((value) => {
        if (cancelled) return
        setResult({ kind, text: value.text, resourceName: value.resourceName })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setResult({ kind, error: toErrorPayload(cause) })
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  const current = result?.kind === kind ? result : null
  const title = kind === 'license' ? t('legal.license.title') : t('legal.thirdParty.title')

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="ps-legal-dialog">
      <h2 id={titleId}>
        {title}
        {current?.resourceName !== undefined ? (
          <span className="ps-settings-hint"> · {current.resourceName}</span>
        ) : null}
      </h2>
      {current?.error !== undefined ? (
        <p role="alert" className="ps-legal-unavailable">
          {t(current.error.messageKey)}
        </p>
      ) : current?.text === undefined ? (
        <p role="status">{t('common.loading')}</p>
      ) : (
        <pre className="ps-legal-text" tabIndex={0}>
          {current.text}
        </pre>
      )}
      <div className="ps-settings-actions">
        <Button variant="secondary" onClick={onClose}>
          {t('legal.close')}
        </Button>
      </div>
    </Modal>
  )
}
