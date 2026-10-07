import { useId, useState } from 'react'

import { t } from '../../app/i18n'
import { IconButton } from '../../components/IconButton'
import { Modal } from '../../components/Modal'
import { SaveFailureNotice } from './controls'
import type { CurrentDocumentSettings } from './current-document'
import { AboutSection } from './sections/AboutSection'
import { FileUpdateSection } from './sections/FileUpdateSection'
import { PrivacySection } from './sections/PrivacySection'
import { ReadingSection } from './sections/ReadingSection'
import { SyntaxSection } from './sections/SyntaxSection'
import './settings.css'

/**
 * Full settings dialog (ui-spec §3.7 UI06; IXD §13.2).
 *
 * Modal with the five v0.1.0 categories only. Changes preview immediately and
 * persist through the settings host; a persistence failure keeps the applied
 * value and shows "本次已生效，但未能保存到本地" with retry (R23). The
 * context menu path and Ctrl+, both focus this dialog; Esc closes it and
 * restores the trigger.
 */

export type SettingsCategory = 'reading' | 'fileUpdate' | 'syntax' | 'privacy' | 'about'

const CATEGORIES: ReadonlyArray<{ id: SettingsCategory; labelKey: string }> = [
  { id: 'reading', labelKey: 'settings.category.reading' },
  { id: 'fileUpdate', labelKey: 'settings.category.fileUpdate' },
  { id: 'syntax', labelKey: 'settings.category.syntax' },
  { id: 'privacy', labelKey: 'settings.category.privacy' },
  { id: 'about', labelKey: 'settings.category.about' },
]

export interface SettingsDialogProps {
  onClose(): void
  initialCategory?: SettingsCategory
  currentDocument?: CurrentDocumentSettings | null
}

export function SettingsDialog({
  onClose,
  initialCategory = 'reading',
  currentDocument = null,
}: SettingsDialogProps) {
  const [category, setCategory] = useState<SettingsCategory>(initialCategory)
  const titleId = useId()

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="ps-settings-dialog">
      <div className="ps-settings-header">
        <h2 id={titleId}>{t('settings.title')}</h2>
        <IconButton icon="close" label={t('common.close')} onClick={onClose} />
      </div>

      <SaveFailureNotice />

      <div className="ps-settings-layout">
        <nav className="ps-settings-nav" aria-label={t('settings.title')}>
          {CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="ps-settings-nav-item"
              aria-current={category === entry.id ? 'true' : undefined}
              onClick={() => setCategory(entry.id)}
            >
              {t(entry.labelKey)}
            </button>
          ))}
        </nav>

        <div className="ps-settings-content">
          {category === 'reading' ? <ReadingSection /> : null}
          {category === 'fileUpdate' ? (
            <FileUpdateSection currentDocument={currentDocument} />
          ) : null}
          {category === 'syntax' ? <SyntaxSection currentDocument={currentDocument} /> : null}
          {category === 'privacy' ? <PrivacySection /> : null}
          {category === 'about' ? <AboutSection /> : null}
        </div>
      </div>
    </Modal>
  )
}
