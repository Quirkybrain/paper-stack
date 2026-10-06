import type { CSSProperties, ReactNode } from 'react'

import { Icon, type IconName } from './Icon'

/**
 * Non-modal status banner (ui-spec §2.1 §3.8, VC-08): update and source
 * notices above the content. `role="status"` so assistive technology can
 * perceive it without stealing focus; it stays out of the Tab order itself.
 */

export type BannerTone = 'info' | 'warn' | 'danger'

export interface BannerProps {
  tone?: BannerTone
  /** Accessible name, e.g. `t('aria.updateBanner')`. */
  label?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

const TONE_COLORS: Record<BannerTone, string> = {
  info: 'var(--ps-color-accent)',
  warn: 'var(--ps-color-warn)',
  danger: 'var(--ps-color-danger)',
}

const TONE_ICONS: Record<BannerTone, IconName> = {
  info: 'info',
  warn: 'warn',
  danger: 'warn',
}

const BANNER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--ps-space-2)',
  padding: 'var(--ps-space-2) var(--ps-space-3)',
  background: 'var(--ps-color-surface)',
  color: 'var(--ps-color-text)',
  border: '1px solid var(--ps-color-border)',
  borderRadius: 'var(--ps-radius-sm)',
}

export function Banner({ tone = 'info', label, actions, className, children }: BannerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={className}
      style={{ ...BANNER_STYLE, borderLeft: `3px solid ${TONE_COLORS[tone]}` }}
    >
      <Icon name={TONE_ICONS[tone]} style={{ color: TONE_COLORS[tone], flexShrink: 0, marginTop: '4px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {actions !== undefined ? (
        <div style={{ display: 'flex', gap: 'var(--ps-space-2)', flexShrink: 0 }}>{actions}</div>
      ) : null}
    </div>
  )
}
