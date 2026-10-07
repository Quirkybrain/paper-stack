import type { CSSProperties } from 'react'

import { Button } from './Button'
import { t } from '../app/i18n'

/**
 * Loading placeholder (ui-spec §2.1, VC-11): no animation, no fake
 * percentages. The host mounts it only after the >150ms threshold; passing a
 * `stage` adds the actual phase line (>1s) and the cancellable button.
 */

export type PlaceholderStage = 'loading' | 'read' | 'parse'

const STAGE_KEYS: Record<PlaceholderStage, string> = {
  loading: 'common.loading',
  read: 'document.loading.read',
  parse: 'document.loading.parse',
}

export interface PlaceholderProps {
  stage?: PlaceholderStage
  cancellable?: boolean
  onCancel?: () => void
  className?: string
}

const PLACEHOLDER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--ps-space-3)',
  padding: 'var(--ps-space-6) 0',
  color: 'var(--ps-color-muted)',
}

export function Placeholder({ stage = 'loading', cancellable = false, onCancel, className }: PlaceholderProps) {
  return (
    <div role="status" className={className} style={PLACEHOLDER_STYLE}>
      <span>{t(STAGE_KEYS[stage])}</span>
      {cancellable ? (
        <Button variant="secondary" onClick={onCancel}>
          {t('document.loading.cancel')}
        </Button>
      ) : null}
    </div>
  )
}
