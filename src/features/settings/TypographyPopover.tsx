import { useId, type RefObject } from 'react'

import { t } from '../../app/i18n'
import { Button } from '../../components/Button'
import { Popover } from '../../components/Popover'
import type { ThemePreference } from '../../services/types'
import { SaveFailureNotice, SettingsNumberField } from './controls'
import { useSettings } from './settings-context'
import './settings.css'

/**
 * Aa display popover (ui-spec §3.7 UI06; IXD §13.1).
 *
 * Non-modal, anchored to the toolbar button: font size, line height, content
 * width, theme and "恢复显示默认". Changes preview instantly and persist
 * without an apply button; an invalid number keeps the previous valid value.
 * The popover deliberately contains no permissions/logs/TeX controls.
 */

export interface TypographyPopoverProps {
  anchor: RefObject<HTMLElement | null>
  onClose(): void
}

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; labelKey: string }> = [
  { value: 'system', labelKey: 'settings.reading.theme.system' },
  { value: 'light', labelKey: 'settings.reading.theme.light' },
  { value: 'dark', labelKey: 'settings.reading.theme.dark' },
]

export function TypographyPopover({ anchor, onClose }: TypographyPopoverProps) {
  const { settings, update, resetDisplayDefaults } = useSettings()
  const titleId = useId()

  return (
    <Popover
      anchor={anchor}
      onClose={onClose}
      labelledBy={titleId}
      width={300}
      className="ps-typography-popover"
    >
      <h2 id={titleId} className="ps-settings-subtitle">
        {t('toolbar.typography')}
      </h2>

      <SettingsNumberField
        field="fontSizePx"
        label={t('settings.reading.fontSize')}
        hint={t('settings.reading.range.fontSize')}
        value={settings.fontSizePx}
        onValidChange={(value) => void update({ fontSizePx: value })}
        id="ps-popover-font-size"
      />
      <SettingsNumberField
        field="lineHeight"
        label={t('settings.reading.lineHeight')}
        hint={t('settings.reading.range.lineHeight')}
        value={settings.lineHeight}
        onValidChange={(value) => void update({ lineHeight: value })}
        id="ps-popover-line-height"
      />
      <SettingsNumberField
        field="maxContentWidthPx"
        label={t('settings.reading.maxWidth')}
        hint={t('settings.reading.range.maxWidth')}
        value={settings.maxContentWidthPx}
        onValidChange={(value) => void update({ maxContentWidthPx: value })}
        id="ps-popover-max-width"
      />

      <fieldset className="ps-setting-fieldset">
        <legend>{t('settings.reading.theme')}</legend>
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className="ps-setting-radio">
            <input
              type="radio"
              name="ps-popover-theme"
              value={option.value}
              checked={settings.theme === option.value}
              onChange={() => void update({ theme: option.value })}
            />
            <span>{t(option.labelKey)}</span>
          </label>
        ))}
      </fieldset>

      <SaveFailureNotice />

      <div className="ps-settings-actions">
        <Button variant="secondary" onClick={() => void resetDisplayDefaults()}>
          {t('settings.reading.restoreDefaults')}
        </Button>
      </div>
    </Popover>
  )
}
