import { createContext, useContext } from 'react'

import type { SourceRange } from '../../services/types'
import type { InspectTarget } from './inspect/types'
import type { ZoomTarget } from './zoom/ZoomOverlay'

/**
 * Reader UI actions shared with deeply nested block components (ui-spec §3.5/
 * §3.6): enter source view at a range, open the formula inspect drawer, open
 * the zoom overlay. Provided by `ReaderScreen`; blocks render no tool button
 * they can not honor when the provider is absent (standalone tests).
 */

export interface ReaderUi {
  /** UI04: show the source view, preferring the given range (bytes). */
  enterSource(range: SourceRange | null, blockId: string | null): void
  /** UI05: open the 340px non-modal formula drawer. */
  openInspect(target: InspectTarget): void
  /** UI05: open the independent zoom overlay for a diagram/formula/image. */
  openZoom(target: ZoomTarget): void
  /**
   * Layout-change notification (font/width/image decode) for the single
   * stabilization correction (INV-AR-05); optional for standalone tests.
   */
  notifyLayoutChange?(): void
}

export const ReaderUiContext = createContext<ReaderUi | null>(null)

export function useReaderUi(): ReaderUi | null {
  return useContext(ReaderUiContext)
}
