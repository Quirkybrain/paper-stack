import { t } from '../../../app/i18n'
import { useSettings } from '../settings-context'
import type { CurrentDocumentSettings } from '../current-document'
import type { UpdateMode } from '../../../services/types'

/**
 * File & update section (ui-spec §3.7): the global default behavior for new
 * sessions and the current document override, which only lives for this
 * document session. The update engine itself is wp-29; both values are real
 * session state consumed there, never fake controls.
 */

export interface FileUpdateSectionProps {
  currentDocument: CurrentDocumentSettings | null
}

export function FileUpdateSection({ currentDocument }: FileUpdateSectionProps) {
  const { settings, update } = useSettings()
  const effective: UpdateMode = currentDocument?.updateModeOverride ?? settings.updateModeDefault

  const renderMode = (name: string, selected: UpdateMode, onSelect: (mode: UpdateMode) => void) => (
    <>
      {(
        [
          { value: 'keep', labelKey: 'update.mode.keep', descKey: 'settings.fileUpdate.keepDesc' },
          {
            value: 'follow',
            labelKey: 'update.mode.follow',
            descKey: 'settings.fileUpdate.followDesc',
          },
        ] as const
      ).map((option) => (
        <label key={option.value} className="ps-setting-radio ps-setting-radio-block">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={selected === option.value}
            onChange={() => onSelect(option.value)}
          />
          <span>
            <span className="ps-setting-radio-label">{t(option.labelKey)}</span>
            <span className="ps-settings-hint">{t(option.descKey)}</span>
          </span>
        </label>
      ))}
    </>
  )

  return (
    <div className="ps-settings-section">
      <h3>{t('settings.category.fileUpdate')}</h3>

      <fieldset className="ps-setting-fieldset">
        <legend>{t('settings.fileUpdate.defaultLabel')}</legend>
        {renderMode(
          'ps-settings-update-default',
          settings.updateModeDefault,
          (mode) => void update({ updateModeDefault: mode }),
        )}
      </fieldset>

      <fieldset className="ps-setting-fieldset" disabled={currentDocument === null}>
        <legend>{t('settings.fileUpdate.currentLabel')}</legend>
        {renderMode('ps-settings-update-current', effective, (mode) =>
          currentDocument?.onUpdateModeChange(mode),
        )}
        <p className="ps-settings-hint">{t('settings.fileUpdate.currentScope')}</p>
        {currentDocument === null ? (
          <p className="ps-settings-hint" role="note">
            {t('common.unavailable')}
          </p>
        ) : null}
      </fieldset>
    </div>
  )
}
