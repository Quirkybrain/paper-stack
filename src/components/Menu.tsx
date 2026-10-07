import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { Icon, type IconName } from './Icon'
import { useAnchoredPosition } from './useAnchoredPosition'

/**
 * Toolbar/menu list (ui-spec §2.1 §2.2, §6.4). Roving focus with
 * ArrowUp/ArrowDown/Home/End, Enter/Space to select, Esc to close and return
 * focus to the anchor. Disabled items stay focusable so their reason is
 * reachable (`aria-disabled` + `aria-describedby`, VC-14). Items without a
 * capability for v0.1.0 are simply not rendered (IXD §2.2).
 */

export interface MenuItem {
  id: string
  label: string
  icon?: IconName
  disabled?: boolean
  disabledReason?: string
  onSelect?: () => void
}

export interface MenuProps {
  items: MenuItem[]
  anchor: RefObject<HTMLElement | null> | null
  label: string
  onClose: () => void
  width?: number
}

const MENU_STYLE: CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  minWidth: 200,
  padding: 'var(--ps-space-1)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--ps-color-surface)',
  color: 'var(--ps-color-text)',
  border: '1px solid var(--ps-color-border)',
  borderRadius: 'var(--ps-radius-sm)',
  maxHeight: '70vh',
  overflowY: 'auto',
}

export function Menu({ items, anchor, label, onClose, width }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const position = useAnchoredPosition(anchor)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const idBase = useId()

  const firstEnabled = items.findIndex((item) => !item.disabled)
  const initialIndex = firstEnabled === -1 ? 0 : firstEnabled
  const [focusedIndex, setFocusedIndex] = useState(initialIndex)

  useEffect(() => {
    itemRefs.current[initialIndex]?.focus()
    // Mount-only: the menu grabs focus once when opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (anchor?.current?.contains(target)) return
      onCloseRef.current()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [anchor])

  const focusItem = (index: number) => {
    setFocusedIndex(index)
    itemRefs.current[index]?.focus()
  }

  const move = (delta: 1 | -1) => {
    const count = items.length
    if (count === 0) return
    let index = focusedIndex
    for (let step = 0; step < count; step += 1) {
      index = (index + delta + count) % count
      if (!items[index].disabled) {
        focusItem(index)
        return
      }
    }
  }

  const edge = (fromEnd: boolean) => {
    let index = -1
    if (fromEnd) {
      for (let candidate = items.length - 1; candidate >= 0; candidate -= 1) {
        if (!items[candidate].disabled) {
          index = candidate
          break
        }
      }
    } else {
      index = firstEnabled
    }
    if (index >= 0) focusItem(index)
  }

  const select = (index: number) => {
    const item = items[index]
    if (!item || item.disabled) return
    item.onSelect?.()
    onCloseRef.current()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        edge(false)
        break
      case 'End':
        event.preventDefault()
        edge(true)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        select(focusedIndex)
        break
      case 'Escape':
        event.stopPropagation()
        onCloseRef.current()
        anchor?.current?.focus()
        break
      case 'Tab':
        // Menus close when focus leaves; the browser moves focus naturally.
        onCloseRef.current()
        break
      default:
        break
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      style={{ ...MENU_STYLE, top: position.top, left: position.left, ...(width === undefined ? {} : { width }) }}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => {
        const reasonId = `${idBase}-reason-${index}`
        return (
          <button
            key={item.id}
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            type="button"
            role="menuitem"
            tabIndex={index === focusedIndex ? 0 : -1}
            aria-disabled={item.disabled === true || undefined}
            aria-describedby={item.disabled && item.disabledReason !== undefined ? reasonId : undefined}
            title={item.disabled && item.disabledReason !== undefined ? item.disabledReason : item.label}
            onClick={() => select(index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--ps-space-2)',
              minHeight: 'var(--ps-control-h)',
              padding: '0 var(--ps-space-2)',
              textAlign: 'left',
              background: 'transparent',
              color: item.disabled === true ? 'var(--ps-color-muted)' : 'inherit',
              opacity: item.disabled === true ? 0.6 : 1,
              border: 'none',
              borderRadius: 'var(--ps-radius-sm)',
              cursor: item.disabled === true ? 'default' : 'pointer',
            }}
          >
            {item.icon !== undefined ? <Icon name={item.icon} /> : null}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.disabled && item.disabledReason !== undefined ? (
              <span id={reasonId} className="ps-visually-hidden">
                {item.disabledReason}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
