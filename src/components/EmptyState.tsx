import type { CSSProperties, ReactNode } from 'react'

/**
 * Empty state (ui-spec §2.1, VC-10): welcome cards, empty document, empty
 * panels. No illustration, does not fill the screen; title and action are
 * caller-provided translated strings.
 */

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

const EMPTY_STATE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--ps-space-2)',
  padding: 'var(--ps-space-5) 0',
  color: 'var(--ps-color-text)',
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <section className={className} style={EMPTY_STATE_STYLE} aria-label={title}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {description !== undefined ? (
        <p style={{ margin: 0, color: 'var(--ps-color-muted)' }}>{description}</p>
      ) : null}
      {action !== undefined ? <div>{action}</div> : null}
    </section>
  )
}
