import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

/**
 * Non-modal drawer for auxiliary areas (ui-spec §2.1/§6.2, EDGE-06, VC-09).
 *
 * Deliberately does NOT trap focus: `role="complementary"` with an
 * `aria-label`, Tab may leave it at any time. Esc closes and returns focus to
 * the trigger (via the mounted-element restore on unmount; EDGE-01).
 * Mutual exclusion between navigation and inspection is the host's job.
 */

export interface DrawerProps {
  side: 'left' | 'right'
  /** Accessible name, e.g. the nav panel / inspect panel catalog labels (ui-spec §6.3). */
  label: string
  onClose: () => void
  /** Defaults to the 248px navigation width; the 340px inspect width is opt-in. */
  width?: string
  className?: string
  children: ReactNode
}

export function Drawer({ side, label, onClose, width, className, children }: DrawerProps) {
  const asideRef = useRef<HTMLElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const active = document.activeElement
    restoreFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null
    return () => {
      const restore = restoreFocusRef.current
      if (restore !== null && restore.isConnected) restore.focus()
    }
  }, [])

  const style: CSSProperties = {
    width: width ?? 'var(--ps-nav-w)',
    alignSelf: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--ps-color-surface)',
    borderRight: side === 'left' ? '1px solid var(--ps-color-border)' : undefined,
    borderLeft: side === 'right' ? '1px solid var(--ps-color-border)' : undefined,
    transition: 'transform var(--ps-transition)',
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current()
    }
  }

  return (
    <aside
      ref={asideRef}
      role="complementary"
      aria-label={label}
      className={className}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {children}
    </aside>
  )
}
