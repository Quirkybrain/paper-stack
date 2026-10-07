import { useEffect, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { app, opener, toErrorPayload } from '../../../services'
import type { AppInfo, ErrorPayload, LegalTextKind } from '../../../services/types'
import { LegalTextViewer } from '../about/LegalTextViewer'

/**
 * About section (ui-spec §3.7 UI06; IXD §15.1; R30).
 *
 * Shows the real version/owner/license from `get_app_info`, offers the
 * offline license and third-party texts, and only opens external URLs after
 * an explicit user click (`opener.openExternalUrl`). An unconfigured source
 * entry shows the release-blocking reason instead of a fake address.
 */

export function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<ErrorPayload | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [legalKind, setLegalKind] = useState<LegalTextKind | null>(null)
  const [buildOpen, setBuildOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void app
      .getAppInfo()
      .then((value) => {
        if (cancelled) return
        setInfo(value)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(toErrorPayload(cause))
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (error !== null) {
    return (
      <div className="ps-settings-section">
        <h3>{t('about.title')}</h3>
        <p role="alert" className="ps-settings-field-error">
          {t(error.messageKey)}
        </p>
        <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  if (info === null) {
    return (
      <div className="ps-settings-section">
        <h3>{t('about.title')}</h3>
        <p role="status">{t('common.loading')}</p>
      </div>
    )
  }

  const sourceUrl = info.legal.sourceEntryUrl
  const sourceNote = info.legal.sourceEntryNote ?? t('about.sourceUnconfigured')

  return (
    <div className="ps-settings-section">
      <h3>{t('about.title')}</h3>
      <p className="ps-about-product">{t('about.product')}</p>
      <p>{t('about.version', { version: info.version })}</p>
      <p>{t('about.owner')}</p>
      <p>{t('about.license')}</p>
      <p className="ps-settings-hint">{t('about.gplNote')}</p>
      <p className="ps-settings-hint">{t('about.offlineNote')}</p>

      <div className="ps-settings-actions">
        <Button variant="secondary" onClick={() => setLegalKind('license')}>
          {t('about.viewLicense')}
        </Button>
        <Button variant="secondary" onClick={() => setLegalKind('third_party_notices')}>
          {t('about.thirdParty')}
        </Button>
        <Button
          variant="secondary"
          aria-expanded={buildOpen}
          onClick={() => setBuildOpen((value) => !value)}
        >
          {t('about.buildInfo')}
        </Button>
      </div>

      {buildOpen ? (
        <dl className="ps-build-info">
          <dt>{t('about.product')}</dt>
          <dd>{info.name}</dd>
          <dt>{t('about.version', { version: info.version })}</dt>
          <dd>{info.version}</dd>
          <dt>IPC</dt>
          <dd>{info.ipcContract}</dd>
          <dt>Locale</dt>
          <dd>{info.locale}</dd>
          {info.tauriVersion !== undefined ? (
            <>
              <dt>Tauri</dt>
              <dd>{info.tauriVersion}</dd>
            </>
          ) : null}
          {info.webkitVersion !== undefined ? (
            <>
              <dt>WebKit</dt>
              <dd>{info.webkitVersion}</dd>
            </>
          ) : null}
          {info.os !== undefined ? (
            <>
              <dt>OS</dt>
              <dd>{info.os}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <div className="ps-settings-block">
        <h4>{t('about.source')}</h4>
        {sourceUrl !== null ? (
          <Button variant="secondary" onClick={() => void opener.openExternalUrl(sourceUrl)}>
            {t('about.source')}
          </Button>
        ) : (
          <p role="note" className="ps-about-source-note">
            {sourceNote}
          </p>
        )}
      </div>

      {legalKind !== null ? (
        <LegalTextViewer kind={legalKind} onClose={() => setLegalKind(null)} />
      ) : null}
    </div>
  )
}
