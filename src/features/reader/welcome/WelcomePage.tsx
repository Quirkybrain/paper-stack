import { useEffect, useState } from 'react'

import { t } from '../../../app/i18n'
import { recentsLoaded, useAppDispatch, useAppState } from '../../../app/store'
import { Button } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { storage, toErrorPayload } from '../../../services'
import type { ErrorPayload, RecentEntry } from '../../../services/types'
import { RecentList } from './RecentList'

/**
 * Welcome page / recents (ui-spec §3.1, IXD §4.1; T-39, R01–R03/R06).
 *
 * The list is loaded from `storage.listRecents` into the app store; removal
 * only updates the store entry for this view (the per-category clear service
 * owns deletion, §3.8). A storage failure degrades honestly: the list area
 * explains the problem and the open actions keep working (NF08). The built-in
 * sample card replaces the list when there are no records.
 */

export interface WelcomePageDeps {
  listRecents?: typeof storage.listRecents
}

export interface WelcomePageProps {
  onOpenFile(): void
  onOpenDirectory(): void
  onOpenRecent(entry: RecentEntry): void
  onRelink(entry: RecentEntry): void
  onRemoveRecent(docId: string): void
  /** Injectable clock for deterministic relative times in tests. */
  now?: number
  deps?: WelcomePageDeps
}

export function WelcomePage({
  onOpenFile,
  onOpenDirectory,
  onOpenRecent,
  onRelink,
  onRemoveRecent,
  now,
  deps,
}: WelcomePageProps) {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const [storageError, setStorageError] = useState<ErrorPayload | null>(null)
  const [attempt, setAttempt] = useState(0)
  const listRecents = deps?.listRecents ?? storage.listRecents

  useEffect(() => {
    let cancelled = false
    void listRecents()
      .then((entries) => {
        if (cancelled) return
        dispatch(recentsLoaded(entries))
        setStorageError(null)
      })
      .catch((error: unknown) => {
        if (!cancelled) setStorageError(toErrorPayload(error))
      })
    return () => {
      cancelled = true
    }
  }, [dispatch, listRecents, attempt])

  return (
    <section className="ps-welcome">
      <div className="ps-welcome-intro">
        <h1>{t('welcome.title')}</h1>
        <p className="ps-welcome-note">{t('welcome.note')}</p>
        <div className="ps-welcome-actions">
          <Button variant="primary" onClick={onOpenFile}>
            <Icon name="open" />
            <span>{t('welcome.openFile')}</span>
          </Button>
          <Button variant="secondary" onClick={onOpenDirectory}>
            <Icon name="folder" />
            <span>{t('welcome.openDirectory')}</span>
          </Button>
        </div>
      </div>

      <section className="ps-welcome-recents" aria-label={t('welcome.recent.title')}>
        <h2>{t('welcome.recent.title')}</h2>

        {storageError !== null ? (
          <div className="ps-welcome-storage" role="status">
            <p>{t(storageError.messageKey)}</p>
            <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : null}

        {storageError === null && !state.recentsLoaded ? (
          <p className="ps-welcome-loading" role="status">
            {t('common.loading')}
          </p>
        ) : null}

        {storageError === null && state.recentsLoaded && state.recents.length > 0 ? (
          <RecentList
            entries={state.recents}
            onOpen={onOpenRecent}
            onRelink={onRelink}
            onRemove={onRemoveRecent}
            {...(now === undefined ? {} : { now })}
          />
        ) : null}

        {storageError === null && state.recentsLoaded && state.recents.length === 0 ? (
          <div className="ps-sample-card" role="note">
            <span className="ps-sample-badge">{t('welcome.builtinSample')}</span>
            <p>{t('welcome.builtinSample.note')}</p>
          </div>
        ) : null}
      </section>
    </section>
  )
}
