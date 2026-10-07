import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { useAnchoredPosition } from './useAnchoredPosition'

/**
 * Anchored non-modal popover (ui-spec §2.1/§6.2: the Aa display-settings
 * layer; VC-12 320px).
 *
 * Esc or a pointer-down outside closes it; focus returns to the anchor on
 * close. Focus is not trapped (non-modal region, EDGE-02).
 */

export interface PopoverProps {
  anchor: RefObject<HTMLElement | null> | null
  onClose: () => void
  label?: string
  labelledBy?: string
  width?: number
  className?: string
  children: ReactNode
}

export function Popover({
  anchor,
  onClose,
  label,
  labelledBy,
  width = 320,
  className,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition(anchor)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (ref.current?.contains(target)) return
      if (anchor?.current?.contains(target)) return
      onCloseRef.current()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!ref.current?.contains(document.activeElement)) return
      const trigger = anchor?.current
      onCloseRef.current()
      trigger?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchor])

  const style: CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    zIndex: 1000,
    width,
    maxHeight: '70vh',
    overflowY: 'auto',
    background: 'var(--ps-color-surface)',
    color: 'var(--ps-color-text)',
    border: '1px solid var(--ps-color-border)',
    borderRadius: 'var(--ps-radius-lg)',
    padding: 'var(--ps-space-3)',
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-modal="false"
      className={className}
      style={style}
    >
      {children}
    </div>,
    document.body,
  )
}
