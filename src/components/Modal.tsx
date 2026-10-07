import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal dialog (ui-spec §2.1/§6.2, EDGE-02/EDGE-03, VC-12).
 *
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (ui-spec §6.3).
 * - Focus trap: Tab/Shift+Tab cycle inside the panel; the background is
 *   covered by the scrim and cannot be reached with Tab.
 * - Esc cancels and closes (safe default; authorization dialogs map Esc to
 *   "keep blocking" at the call site).
 * - On unmount, focus returns to the trigger element when it still exists
 *   (EDGE-01).
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface ModalProps {
  /** Id of the visible title element (preferred; ui-spec §6.3). */
  labelledBy?: string
  /** Accessible name when there is no visible title. */
  ariaLabel?: string
  /** Element that receives initial focus (safe default action). */
  initialFocusRef?: RefObject<HTMLElement | null> | null
  onClose: () => void
  /** Clicking the scrim cancels; default false (explicit decision surfaces). */
  closeOnScrim?: boolean
  className?: string
  children: ReactNode
}

const SCRIM_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--ps-color-scrim)',
  padding: 'var(--ps-space-4)',
}

const PANEL_STYLE: CSSProperties = {
  background: 'var(--ps-color-surface)',
  color: 'var(--ps-color-text)',
  border: '1px solid var(--ps-color-border)',
  borderRadius: 'var(--ps-radius-lg)',
  padding: 'var(--ps-space-5)',
  width: '100%',
  maxWidth: 720,
  maxHeight: '85vh',
  overflow: 'auto',
  boxShadow: 'none',
}

export function Modal({
  labelledBy,
  ariaLabel,
  initialFocusRef,
  onClose,
  closeOnScrim = false,
  className,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const active = document.activeElement
    restoreFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    const panel = panelRef.current
    const target = initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel
    target?.focus()
    return () => {
      const restore = restoreFocusRef.current
      if (restore !== null && restore.isConnected) restore.focus()
    }
    // Mount/unmount only: initial focus and restore targets are captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current()
      return
    }
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    if (focusables.length === 0) {
      event.preventDefault()
      panel.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      style={SCRIM_STYLE}
      onMouseDown={(event) => {
        if (closeOnScrim && event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy === undefined ? ariaLabel : undefined}
        className={className}
        style={PANEL_STYLE}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
