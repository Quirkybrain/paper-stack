import type { CSSProperties, ReactNode } from 'react'

import { t } from '../app/i18n'

/**
 * Reading toolbar container (ui-spec §2.1 §3.2): 52px, `role="toolbar"` with
 * the reading-toolbar accessible name (ui-spec §6.3). Overflow behavior is
 * the host's concern.
 */

export interface ToolbarProps {
  /** Accessible name; defaults to `t('toolbar.aria')`. */
  label?: string
  className?: string
  children: ReactNode
}

const TOOLBAR_STYLE: CSSProperties = {
  height: 'var(--ps-toolbar-h)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ps-space-2)',
  padding: '0 var(--ps-space-3)',
  background: 'var(--ps-color-surface)',
  borderBottom: '1px solid var(--ps-color-border)',
  flexShrink: 0,
}

export function Toolbar({ label, className, children }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label={label ?? t('toolbar.aria')} className={className} style={TOOLBAR_STYLE}>
      {children}
    </div>
  )
}
