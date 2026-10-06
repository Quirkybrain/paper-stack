import { useLayoutEffect, useState, type RefObject } from 'react'

export interface AnchoredPosition {
  top: number
  left: number
}

/**
 * Internal helper for anchor-positioned layers (Popover/Menu, ui-spec §2.1).
 * Computes a viewport-relative position below the anchor and tracks resize and
 * scroll. jsdom reports zero-size rects, so tests exercise behavior, not pixels.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null> | null,
): AnchoredPosition {
  const [position, setPosition] = useState<AnchoredPosition>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    const element = anchor?.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor])

  return position
}
