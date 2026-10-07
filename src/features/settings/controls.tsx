import { useId, useState } from 'react'

import { t } from '../../app/i18n'
import { Button } from '../../components/Button'
import {
  DISPLAY_RANGES,
  isDisplayField,
  isWithinDisplayRange,
  type DisplayField,
} from './settings-model'
import { useSettings } from './settings-context'

/**
 * Shared settings controls (ui-spec §3.7/§13.1).
 *
 * `SettingsNumberField` keeps the last valid value applied while an
 * out-of-range entry is corrected: the typed text stays visible with the
 * range explanation, but the live settings (and the reading view) keep the
 * previous valid number until the input becomes valid again.
 */

export interface SettingsNumberFieldProps {
  field: DisplayField
  label: string
  hint: string
  value: number
  onValidChange(value: number): void
  /** Optional id prefix for deterministic test queries. */
  id?: string
}

export function SettingsNumberField({
  field,
  label,
  hint,
  value,
  onValidChange,
  id,
}: SettingsNumberFieldProps) {
  const generatedId = useId()
  const inputId = id ?? `ps-setting-${field}-${generatedId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  /**
   * Non-null only while the typed text is out of range. Any kept draft is by
   * construction invalid, so the displayed value is the draft while editing
   * an invalid entry and the applied value otherwise; a valid entry clears the
   * draft in the same React batch as the applied change.
   */
  const [draft, setDraft] = useState<string | null>(null)
  const range = DISPLAY_RANGES[field]
  const invalid = draft !== null
  const text = draft ?? String(value)

  const handleChange = (raw: string) => {
    const parsed = Number(raw)
    if (raw.trim() === '' || !isDisplayField(field) || !isWithinDisplayRange(field, parsed)) {
      setDraft(raw)
      return
    }
    setDraft(null)
    onValidChange(parsed)
  }

  const handleBlur = () => {
    if (!invalid) return
    setDraft(null)
  }

  return (
    <div className="ps-setting-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        min={range.min}
        max={range.max}
        step={range.step}
        value={text}
        aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
        aria-invalid={invalid || undefined}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
      />
      <span id={hintId} className="ps-settings-hint">
        {hint}
      </span>
      {invalid ? (
        <span id={errorId} className="ps-settings-field-error" role="alert">
          {t('settings.reading.invalidValue')}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Save-failure notice shared by the Aa popover and the full settings dialog
 * (ui-spec §3.7): the live value already changed; only persistence failed.
 * Success is never claimed here.
 */
export function SaveFailureNotice() {
  const { saveState, saveError, retrySave } = useSettings()
  if (saveState !== 'failed') return null
  return (
    <p className="ps-settings-save-failed" role="alert">
      <span>
        {t('settings.saveFailed')}
        {saveError !== null ? ` (${saveError.code})` : ''}
      </span>
      <Button variant="secondary" onClick={() => void retrySave()}>
        {t('settings.saveFailed.retry')}
      </Button>
    </p>
  )
}

export interface SettingSwitchProps {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  disabledReason?: string
  onChange(checked: boolean): void
}

/** Labeled checkbox row used by the settings sections. */
export function SettingSwitch({
  label,
  hint,
  checked,
  disabled,
  disabledReason,
  onChange,
}: SettingSwitchProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="ps-setting-switch">
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint !== undefined || disabledReason !== undefined ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint !== undefined || disabledReason !== undefined ? (
        <span id={hintId} className="ps-settings-hint">
          {hint ?? disabledReason}
        </span>
      ) : null}
    </div>
  )
}
