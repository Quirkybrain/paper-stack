import { useCallback, useEffect, useState } from 'react'

import { t } from '../../../app/i18n'
import { recentsLoaded, useAppDispatch } from '../../../app/store'
import { suppressWriteBack } from '../../../app/write-suppression'
import { Button } from '../../../components/Button'
import { auth, storage, toErrorPayload } from '../../../services'
import type {
  ClearResult,
  ErrorPayload,
  GrantRecord,
  StorageOverview,
} from '../../../services/types'
import { SettingSwitch } from '../controls'
import { ClearDataDialog } from '../dialogs/ClearDataDialog'
import { buildClearRows, suppressibleFromCategories } from '../privacy-model'
import { useSettings } from '../settings-context'
import { formatBytes } from '../settings-model'

/**
 * Privacy section (ui-spec §3.8 UI07; IXD §14.1; R25/R27/R28).
 *
 * - "记住阅读记录" is an independent preference; clearing history is never
 *   implied by turning it off (INV-WB-04).
 * - Clearing is explicit, confirmed category by category and reports actual
 *   per-category results; loaded content is unaffected and source files are
 *   never touched.
 * - Revoking a persistent grant takes effect immediately for new reads; the
 *   already loaded content stays.
 */

export function PrivacySection() {
  const { settings, limits, update } = useSettings()
  const dispatch = useAppDispatch()
  const [overview, setOverview] = useState<StorageOverview | null>(null)
  const [overviewError, setOverviewError] = useState<ErrorPayload | null>(null)
  const [grants, setGrants] = useState<GrantRecord[] | null>(null)
  const [grantsError, setGrantsError] = useState<ErrorPayload | null>(null)
  const [revokedNotice, setRevokedNotice] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [overviewAttempt, setOverviewAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void storage
      .getStorageOverview()
      .then((value) => {
        if (cancelled) return
        setOverview(value)
        setOverviewError(null)
      })
      .catch((error: unknown) => {
        if (!cancelled) setOverviewError(toErrorPayload(error))
      })
    return () => {
      cancelled = true
    }
  }, [overviewAttempt])

  useEffect(() => {
    let cancelled = false
    void auth
      .listGrants()
      .then((value) => {
        if (cancelled) return
        setGrants(value)
        setGrantsError(null)
      })
      .catch((error: unknown) => {
        if (!cancelled) setGrantsError(toErrorPayload(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshOverview = useCallback(() => setOverviewAttempt((attempt) => attempt + 1), [])

  const handleCleared = useCallback(
    (results: readonly ClearResult[]) => {
      const cleared = results.filter((result) => result.error === undefined)
      suppressWriteBack(suppressibleFromCategories(cleared.map((result) => result.category)))
      if (cleared.some((result) => result.category === 'recents')) {
        // The welcome list reads from the app store; the cleared category must
        // not linger there (INV-WB-01/02).
        dispatch(recentsLoaded([]))
      }
      if (cleared.some((result) => result.category === 'authorizations')) {
        void auth
          .listGrants()
          .then((value) => setGrants(value))
          .catch((error: unknown) => setGrantsError(toErrorPayload(error)))
        setRevokedNotice('error.auth.revoked')
      }
      refreshOverview()
    },
    [dispatch, refreshOverview],
  )

  const revoke = async (grant: GrantRecord) => {
    setRevokedNotice(null)
    setGrantsError(null)
    try {
      const result = await auth.revokeGrant(grant.grantId)
      if (!result.revoked) {
        setGrantsError({
          code: 'PS_DB_FAILURE',
          category: 'storage',
          messageKey: 'error.storage.dbFailure',
          retryable: true,
        })
        return
      }
      setGrants(
        (previous) => previous?.filter((item) => item.grantId !== grant.grantId) ?? previous,
      )
      // Contract §5 `error.auth.revoked` is the user-facing result: new reads
      // stop; content already loaded stays.
      setRevokedNotice('error.auth.revoked')
    } catch (error) {
      setGrantsError(toErrorPayload(error))
    }
  }

  const logsRow = buildClearRows(overview).find((row) => row.id === 'logs')
  const persistentGrants = grants?.filter((grant) => grant.scope === 'persistent') ?? null

  return (
    <div className="ps-settings-section">
      <h3>{t('settings.category.privacy')}</h3>

      <SettingSwitch
        label={t('settings.privacy.remember')}
        hint={t('settings.privacy.rememberHint')}
        checked={settings.rememberRecords}
        onChange={(checked) => void update({ rememberRecords: checked })}
      />

      <div className="ps-settings-block">
        <p className="ps-settings-hint">{t('settings.privacy.noSourceDelete')}</p>
        {overview === null && overviewError === null ? (
          <p role="status">{t('common.loading')}</p>
        ) : null}
        {overviewError !== null ? (
          <p role="alert" className="ps-settings-field-error">
            {t(overviewError.messageKey)}
          </p>
        ) : null}
        {overview !== null ? (
          <ul className="ps-privacy-usage">
            {buildClearRows(overview)
              .filter((row) => row.id !== 'logs')
              .map((row) => (
                <li key={row.id}>
                  <span>{t(row.labelKey)}</span>
                  <span className="ps-settings-hint">
                    {t('dialog.clear.usage', {
                      count: row.count,
                      size: formatBytes(row.bytes ?? 0),
                    })}
                  </span>
                </li>
              ))}
            <li>
              <span>{t('settings.privacy.logs')}</span>
              <span className="ps-settings-hint">
                {t('settings.privacy.logsUsage', {
                  size: formatBytes(logsRow?.bytes ?? 0),
                  max: formatBytes(limits.logMaxBytes),
                })}
              </span>
            </li>
          </ul>
        ) : null}
        <Button
          variant="secondary"
          disabled={overview === null}
          disabledReason={t('common.unavailable')}
          onClick={() => setClearOpen(true)}
        >
          {t('settings.privacy.clear')}
        </Button>
      </div>

      <div className="ps-settings-block">
        <h4>{t('settings.privacy.grants')}</h4>
        {persistentGrants === null && grantsError === null ? (
          <p role="status">{t('common.loading')}</p>
        ) : null}
        {grantsError !== null ? (
          <p role="alert" className="ps-settings-field-error">
            {t(grantsError.messageKey)}
          </p>
        ) : null}
        {persistentGrants !== null && persistentGrants.length === 0 ? (
          <p className="ps-settings-hint">{t('settings.privacy.grantsEmpty')}</p>
        ) : null}
        {persistentGrants !== null && persistentGrants.length > 0 ? (
          <ul className="ps-grant-list">
            {persistentGrants.map((grant) => (
              <li key={grant.grantId} className="ps-grant-row">
                <span className="ps-grant-scope">
                  {grant.canonicalPath ?? grant.origins?.join(', ') ?? grant.grantId}
                </span>
                <Button variant="secondary" onClick={() => void revoke(grant)}>
                  {t('settings.privacy.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {revokedNotice !== null ? (
          <p role="status" className="ps-settings-hint">
            {t(revokedNotice)}
          </p>
        ) : null}
      </div>

      {clearOpen && overview !== null ? (
        <ClearDataDialog
          overview={overview}
          onClose={() => setClearOpen(false)}
          onCleared={handleCleared}
        />
      ) : null}
    </div>
  )
}
