import { useRef } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { formatBytes } from '../../settings/settings-model'
import type { LargeDocChoice, LargeDocPromptReason } from '../../../document/modes/modes'

/**
 * Large-document choice modal (ui-spec §3.8 大文档; rendering-pipeline §5;
 * IXD §11.2 行 346–353; T-51).
 *
 * The dialog is modal by design ("大文档选择" is one of the few modal flows,
 * IXD §1.1/EDGE-02) and shows the frozen option set:
 * 简化阅读 / 只读源码 / 取消. For >50MiB no dialog is shown at all — the
 * reader goes straight to the source-window mode and explains the hard limit
 * (rendering-pipeline §5).
 */

export interface LargeDocDialogProps {
  sizeBytes: number
  reason: LargeDocPromptReason
  onChoose(choice: LargeDocChoice): void
}

export function LargeDocDialog({ sizeBytes, reason, onChoose }: LargeDocDialogProps) {
  const titleId = 'ps-large-doc-title'
  const simplifiedRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal labelledBy={titleId} initialFocusRef={simplifiedRef} onClose={() => onChoose('cancel')}>
      <h2 id={titleId}>{t('largeDoc.title')}</h2>
      <p>{t('largeDoc.message', { size: formatBytes(sizeBytes) })}</p>
      {reason === 'complexity' ? <p>{t('error.limit.complexity')}</p> : null}
      <p className="ps-settings-hint">{t('largeDoc.coverage')}</p>

      <div className="ps-large-doc-options">
        <Button ref={simplifiedRef} variant="primary" onClick={() => onChoose('simplified')}>
          {t('largeDoc.simplified')}
        </Button>
        <p className="ps-settings-hint">{t('largeDoc.simplifiedDesc')}</p>

        <Button variant="secondary" onClick={() => onChoose('source')}>
          {t('largeDoc.sourceOnly')}
        </Button>
        <p className="ps-settings-hint">{t('largeDoc.sourceOnlyDesc')}</p>

        <Button variant="secondary" onClick={() => onChoose('cancel')}>
          {t('largeDoc.cancel')}
        </Button>
      </div>
    </Modal>
  )
}
