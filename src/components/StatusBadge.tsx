import type { CSSProperties } from 'react'

import { Icon, type IconName } from './Icon'
import { t } from '../app/i18n'

/**
 * Text status badge (ui-spec §2.1, §16.1, VC-18): status is always text plus
 * a small icon, never color alone.
 */

const BADGE_CONFIG = {
  newVersion: { key: 'update.badge', icon: 'refresh' },
  simplified: { key: 'document.badge.simplified', icon: 'check' },
  sourceOnly: { key: 'document.badge.sourceOnly', icon: 'fileText' },
  unavailable: { key: 'document.badge.unavailable', icon: 'warn' },
} as const satisfies Record<string, { key: string; icon: IconName }>

export type StatusBadgeKind = keyof typeof BADGE_CONFIG

export interface StatusBadgeProps {
  kind: StatusBadgeKind
  className?: string
}

const BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--ps-space-1)',
  padding: '0 var(--ps-space-1)',
  borderRadius: 'var(--ps-radius-sm)',
  fontSize: '13px',
  lineHeight: 1.6,
  whiteSpace: 'nowrap',
}

export function StatusBadge({ kind, className }: StatusBadgeProps) {
  const config = BADGE_CONFIG[kind]
  const warn = kind === 'newVersion' || kind === 'unavailable'
  return (
    <span
      className={className}
      style={{ ...BADGE_STYLE, color: warn ? 'var(--ps-color-warn)' : 'var(--ps-color-muted)' }}
    >
      <Icon name={config.icon} style={{ flexShrink: 0 }} />
      <span>{t(config.key)}</span>
    </span>
  )
}
