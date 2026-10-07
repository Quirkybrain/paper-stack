import { useId, useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { storage, toErrorPayload } from '../../../services'
import type { ClearResult, ErrorPayload, StorageOverview } from '../../../services/types'
import { formatBytes } from '../settings-model'
import {
  buildClearRows,
  categoryLabelKey,
  selectedCategories,
  type ClearRowId,
} from '../privacy-model'

/**
 * Category clear confirmation (ui-spec §3.8; IXD §14.1; R27). Selection
 * defaults to none, the action button names the actual action, and results
 * are reported per contract category — a partial failure never shows the
 * success summary (INV-WB-05/06).
 */

export interface ClearDataDialogProps {
  overview: StorageOverview
  onClose(): void
  onCleared(results: readonly ClearResult[]): void
}

export function ClearDataDialog({ overview, onClose, onCleared }: ClearDataDialogProps) {
  const rows = buildClearRows(overview)
  const [selected, setSelected] = useState<ReadonlySet<ClearRowId>>(new Set())
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<readonly ClearResult[] | null>(null)
  const [commandError, setCommandError] = useState<ErrorPayload | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const toggle = (id: ClearRowId) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirm = async () => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setCommandError(null)
    try {
      const response = await storage.clearRecords({
        categories: selectedCategories(rows, selected),
        confirm: true,
      })
      setResults(response)
      onCleared(response)
    } catch (error) {
      setCommandError(toErrorPayload(error))
    } finally {
      setBusy(false)
    }
  }

  const resultErrors = results?.filter((result) => result.error !== undefined) ?? []
  const done = results !== null && resultErrors.length === 0
  const actionLabel = (() => {
    if (selected.size === 0) return t('dialog.clear.action.generic')
    if (selected.size === 1 && selected.has('recents')) {
      const count = rows.find((row) => row.id === 'recents')?.count ?? 0
      return t('dialog.clear.action.recents', { count })
    }
    return t('dialog.clear.action.generic')
  })()

  return (
    <Modal
      labelledBy={titleId}
      onClose={onClose}
      initialFocusRef={cancelRef}
      className="ps-clear-dialog"
    >
      <h2 id={titleId}>{t('dialog.clear.title')}</h2>
      <p>{t('dialog.clear.intro')}</p>
      <p className="ps-settings-hint">{t('settings.privacy.noSourceDelete')}</p>

      {results === null ? (
        <ul className="ps-clear-list">
          {rows.map((row) => (
            <li key={row.id} className="ps-clear-row">
              <label className="ps-clear-row-label">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                />
                <span>
                  <span className="ps-setting-radio-label">{t(row.labelKey)}</span>
                  <span className="ps-settings-hint">
                    {t('dialog.clear.usage', {
                      count: row.count,
                      size: formatBytes(row.bytes ?? 0),
                    })}
                  </span>
                  {row.descKeys.map((key) => (
                    <span key={key} className="ps-settings-hint">
                      {t(key)}
                    </span>
                  ))}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ps-clear-results" role="status">
          {done ? (
            <h3>{t('dialog.clear.result.done')}</h3>
          ) : (
            <p role="alert" className="ps-clear-error">
              {t('dialog.clear.result.partial')}
            </p>
          )}
          <ul>
            {results.map((result) => (
              <li key={result.category}>
                <span className="ps-setting-radio-label">
                  {t(categoryLabelKey(result.category))}
                </span>
                <span className={result.error !== undefined ? 'ps-clear-error' : undefined}>
                  {result.error !== undefined
                    ? t(result.error.messageKey)
                    : t('dialog.clear.result.cleared', { count: result.cleared })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {commandError !== null ? (
        <p role="alert" className="ps-clear-error">
          {t(commandError.messageKey)}
        </p>
      ) : null}

      <div className="ps-settings-actions">
        {results === null ? (
          <>
            <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              busy={busy}
              disabled={selected.size === 0}
              disabledReason={t('common.unavailable')}
              onClick={() => void confirm()}
            >
              {actionLabel}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        )}
      </div>
    </Modal>
  )
}
