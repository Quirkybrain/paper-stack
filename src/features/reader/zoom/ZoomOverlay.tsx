import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { IconButton } from '../../../components/IconButton'

/**
 * Independent zoom overlay for images and diagrams (ui-spec §3.6/§9.2,
 * VC-15; T-47).
 *
 * - Permanent controls: title, close, zoom out/in, fit width, 100% reset.
 * - Pan by pointer drag and by arrow keys; Ctrl+wheel zooms (plain wheel
 *   scrolls the overlay content and never the zoom level). Wheel events
 *   outside the overlay never reach it, so the document keeps scrolling.
 * - Esc closes once and returns focus to the trigger; focus stays inside the
 *   overlay while it is open (role=dialog aria-modal).
 */

export interface ZoomTarget {
  /** Human label appended to the overlay title (never document body text). */
  label: string
  content: ReactNode
}

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const ZOOM_STEP = 0.25
export const ZOOM_PAN_STEP = 24

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

const SCRIM_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--ps-color-scrim)',
}

const PANEL_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  margin: 'var(--ps-space-4)',
  background: 'var(--ps-color-surface)',
  color: 'var(--ps-color-text)',
  border: '1px solid var(--ps-color-border)',
  borderRadius: 'var(--ps-radius-lg)',
  overflow: 'hidden',
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ps-space-2)',
  padding: '0 var(--ps-space-3)',
  minHeight: 'var(--ps-toolbar-h)',
  borderBottom: '1px solid var(--ps-color-border)',
  flexShrink: 0,
}

export interface ZoomOverlayProps {
  target: ZoomTarget
  onClose: () => void
}

export function ZoomOverlay({ target, onClose }: ZoomOverlayProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const active = document.activeElement
    restoreFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    viewportRef.current?.focus()
    return () => {
      const restore = restoreFocusRef.current
      if (restore !== null && restore.isConnected) restore.focus()
    }
  }, [])

  // Esc is consumed once at the top layer (EDGE-03) and must not reach the
  // inspect drawer or navigation panel below.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  // Ctrl+wheel zoom needs a non-passive native listener: React attaches
  // `onWheel` passively at the root, so `preventDefault` there is ignored.
  // Plain wheel is untouched and keeps scrolling the overlay content.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const handleWheel = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      setScale((current) =>
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))),
      )
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  const clampScale = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

  const zoomBy = (delta: number) => setScale((current) => clampScale(current + delta))

  const reset = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  const fitWidth = () => {
    const viewport = viewportRef.current
    const content = contentRef.current
    const available = viewport?.clientWidth ?? 0
    const width = content?.scrollWidth ?? 0
    setScale(available > 0 && width > 0 ? clampScale(available / width) : 1)
    setOffset({ x: 0, y: 0 })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current()
      return
    }
    if (event.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }
    const panBy: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -ZOOM_PAN_STEP, y: 0 },
      ArrowRight: { x: ZOOM_PAN_STEP, y: 0 },
      ArrowUp: { x: 0, y: -ZOOM_PAN_STEP },
      ArrowDown: { x: 0, y: ZOOM_PAN_STEP },
    }
    const pan = panBy[event.key]
    if (pan) {
      event.preventDefault()
      setOffset((current) => ({ x: current.x + pan.x, y: current.y + pan.y }))
    }
  }

  return createPortal(
    <div style={SCRIM_STYLE}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ps-zoom-overlay"
        style={PANEL_STYLE}
        onKeyDown={handleDialogKeyDown}
      >
        <div style={TOOLBAR_STYLE}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 17 }}>
            {t('zoom.title')}
          </h2>
          <span className="ps-zoom-label">{target.label}</span>
          <span className="ps-toolbar-spacer" />
          <Button variant="secondary" onClick={() => zoomBy(-ZOOM_STEP)} disabled={scale <= ZOOM_MIN}>
            {t('zoom.out')}
          </Button>
          <Button variant="secondary" onClick={() => zoomBy(ZOOM_STEP)} disabled={scale >= ZOOM_MAX}>
            {t('zoom.in')}
          </Button>
          <Button variant="secondary" onClick={fitWidth}>
            {t('zoom.fitWidth')}
          </Button>
          <Button variant="secondary" onClick={reset}>
            {t('zoom.reset')}
          </Button>
          <IconButton icon="close" label={t('zoom.close')} onClick={() => onCloseRef.current()} />
        </div>
        <p className="ps-zoom-hint">
          {t('zoom.hint')} {t('zoom.arrowHint')}
        </p>
        <div
          ref={viewportRef}
          className="ps-zoom-viewport"
          role="group"
          aria-label={t('zoom.arrowHint')}
          tabIndex={0}
          data-zoom-scale={scale.toFixed(2)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            ref={contentRef}
            className="ps-zoom-content"
            data-zoom-content=""
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {target.content}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
