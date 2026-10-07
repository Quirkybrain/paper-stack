import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { SettingsNumberField, SettingSwitch } from '../controls'
import { useSettings } from '../settings-context'

/**
 * Reading section (ui-spec §3.7): typography, theme and the startup restore
 * preference. Everything here persists globally; "恢复显示默认" only resets
 * the display fields and never touches records, permissions, updates or the
 * syntax override (IXD §13.3).
 */

export function ReadingSection() {
  const { settings, update, resetDisplayDefaults } = useSettings()

  return (
    <div className="ps-settings-section">
      <h3>{t('settings.category.reading')}</h3>

      <SettingsNumberField
        field="fontSizePx"
        label={t('settings.reading.fontSize')}
        hint={t('settings.reading.range.fontSize')}
        value={settings.fontSizePx}
        onValidChange={(value) => void update({ fontSizePx: value })}
        id="ps-settings-font-size"
      />
      <SettingsNumberField
        field="lineHeight"
        label={t('settings.reading.lineHeight')}
        hint={t('settings.reading.range.lineHeight')}
        value={settings.lineHeight}
        onValidChange={(value) => void update({ lineHeight: value })}
        id="ps-settings-line-height"
      />
      <SettingsNumberField
        field="maxContentWidthPx"
        label={t('settings.reading.maxWidth')}
        hint={t('settings.reading.range.maxWidth')}
        value={settings.maxContentWidthPx}
        onValidChange={(value) => void update({ maxContentWidthPx: value })}
        id="ps-settings-max-width"
      />

      <fieldset className="ps-setting-fieldset">
        <legend>{t('settings.reading.theme')}</legend>
        {(
          [
            { value: 'system', labelKey: 'settings.reading.theme.system' },
            { value: 'light', labelKey: 'settings.reading.theme.light' },
            { value: 'dark', labelKey: 'settings.reading.theme.dark' },
          ] as const
        ).map((option) => (
          <label key={option.value} className="ps-setting-radio">
            <input
              type="radio"
              name="ps-settings-theme"
              value={option.value}
              checked={settings.theme === option.value}
              onChange={() => void update({ theme: option.value })}
            />
            <span>{t(option.labelKey)}</span>
          </label>
        ))}
      </fieldset>

      <SettingSwitch
        label={t('settings.reading.restoreSession')}
        checked={settings.restoreSession}
        onChange={(checked) => void update({ restoreSession: checked })}
      />

      <div className="ps-settings-actions">
        <Button variant="secondary" onClick={() => void resetDisplayDefaults()}>
          {t('settings.reading.restoreDefaults')}
        </Button>
      </div>
    </div>
  )
}
