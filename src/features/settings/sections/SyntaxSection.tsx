import { t } from '../../../app/i18n'
import type { CurrentDocumentSettings } from '../current-document'
import type { SyntaxMode } from '../../../services/types'
import { useSettings } from '../settings-context'

/**
 * Syntax section (ui-spec §3.7): the global standard/technical mode and the
 * session-scoped inline-dollar switch for the current document. Changing the
 * mode re-renders the currently displayed version in place; it never loads a
 * newer revision from disk (R08, models §6).
 */

export interface SyntaxSectionProps {
  currentDocument: CurrentDocumentSettings | null
}

export function SyntaxSection({ currentDocument }: SyntaxSectionProps) {
  const { settings, update } = useSettings()

  const selectMode = (mode: SyntaxMode) => {
    if (mode === settings.syntaxMode) return
    void update({ syntaxMode: mode })
  }

  return (
    <div className="ps-settings-section">
      <h3>{t('settings.category.syntax')}</h3>

      <fieldset className="ps-setting-fieldset">
        <legend>{t('settings.syntax.mode')}</legend>
        {(
          [
            { value: 'technical', labelKey: 'settings.syntax.technical' },
            { value: 'standard', labelKey: 'settings.syntax.standard' },
          ] as const
        ).map((option) => (
          <label key={option.value} className="ps-setting-radio">
            <input
              type="radio"
              name="ps-settings-syntax-mode"
              value={option.value}
              checked={settings.syntaxMode === option.value}
              onChange={() => selectMode(option.value)}
            />
            <span>{t(option.labelKey)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="ps-setting-fieldset" disabled={currentDocument === null}>
        <legend>{t('settings.syntax.inlineDollar')}</legend>
        <label className="ps-setting-radio">
          <input
            type="checkbox"
            checked={currentDocument?.inlineMath ?? true}
            disabled={currentDocument === null}
            onChange={(event) => currentDocument?.onInlineMathChange(event.target.checked)}
          />
          <span>{t('settings.syntax.inlineDollar')}</span>
        </label>
        <p className="ps-settings-hint">{t('settings.syntax.inlineDollarHint')}</p>
        {currentDocument === null ? (
          <p className="ps-settings-hint" role="note">
            {t('common.unavailable')}
          </p>
        ) : null}
      </fieldset>
    </div>
  )
}
