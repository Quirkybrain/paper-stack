import { useEffect, useState, type RefObject } from 'react'

import type { OutlineEntry } from '../../../document/types'

/**
 * Scroll-follow outline highlight (ui-spec §3.3; R14). Purely observational:
 * it reads heading positions from the scrolling document and never calls
 * `focus()`, so following the scroll can not steal focus. Collapsed outline
 * nodes are the outline component's concern; this hook only reports the
 * anchor, and the caller must not expand anything.
 *
 * The measurement is keyed by the outline array identity, so a re-parse
 * invalidates the previous highlight without a state reset inside an effect.
 */

/** Pixels below the container top that still count as the current heading. */
export const OUTLINE_FOLLOW_OFFSET_PX = 80

export interface AnchorOffset {
  anchorId: string
  topPx: number
}

/** Last anchor whose top is above the threshold; null before the first one. */
export function pickCurrentAnchor(
  positions: readonly AnchorOffset[],
  thresholdPx: number,
): string | null {
  let current: string | null = null
  for (const position of positions) {
    if (position.topPx <= thresholdPx) current = position.anchorId
    else break
  }
  return current
}

interface MeasuredAnchor {
  outline: readonly OutlineEntry[]
  anchorId: string | null
}

export function useOutlineTracking(
  containerRef: RefObject<HTMLElement | null>,
  outline: readonly OutlineEntry[] | null,
  enabled: boolean,
): string | null {
  const [measured, setMeasured] = useState<MeasuredAnchor | null>(null)

  useEffect(() => {
    if (!enabled || !outline || outline.length === 0) return undefined
    const container = containerRef.current
    if (!container) return undefined

    const measure = () => {
      const containerTop = container.getBoundingClientRect().top
      const positions: AnchorOffset[] = []
      for (const entry of outline) {
        const element = document.getElementById(entry.anchorId)
        if (!element) continue
        positions.push({
          anchorId: entry.anchorId,
          topPx: element.getBoundingClientRect().top - containerTop,
        })
      }
      setMeasured({ outline, anchorId: pickCurrentAnchor(positions, OUTLINE_FOLLOW_OFFSET_PX) })
    }

    container.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      container.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [containerRef, enabled, outline])

  return measured !== null && measured.outline === outline ? measured.anchorId : null
}
