import { t } from '../../../app/i18n'
import { Drawer } from '../../../components/Drawer'
import { IconButton } from '../../../components/IconButton'
import { FormulaPanel } from './FormulaPanel'
import type { InspectTarget } from './types'

/**
 * Non-modal inspect drawer host (ui-spec §3.6, VC-06; T-46): 340px on the
 * right, one target at a time, mutually exclusive with the navigation panel
 * (the host manages that; EDGE-06). Esc and the close button return focus to
 * the trigger (EDGE-01). `sourceChanged` is the wp-29 integration point for a
 * target that disappeared after an update.
 */

export interface InspectDrawerProps {
  target: InspectTarget
  onClose: () => void
  /** True when the target block disappeared after an update (wp-29 wiring). */
  sourceChanged?: boolean
}

export function InspectDrawer({ target, onClose, sourceChanged = false }: InspectDrawerProps) {
  return (
    <Drawer
      side="right"
      width="var(--ps-inspect-w)"
      label={t('inspect.aria')}
      onClose={onClose}
    >
      <header className="ps-inspect-header">
        <h3 className="ps-inspect-title">{t('formula.drawer.title')}</h3>
        <span className="ps-toolbar-spacer" />
        <IconButton icon="close" label={t('inspect.close')} onClick={onClose} />
      </header>
      {sourceChanged ? (
        <p className="ps-inspect-notice" role="status">
          {t('inspect.sourceChanged')}
        </p>
      ) : null}
      <div className="ps-inspect-body">
        <FormulaPanel target={target} />
      </div>
    </Drawer>
  )
}
