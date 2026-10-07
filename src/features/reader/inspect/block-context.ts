import { createContext, useContext } from 'react'

import type { DocumentDiagnostic } from '../../../document/types'
import type { SourceRange } from '../../../services/types'

/**
 * Per-block context injected by `DocumentView` around every top-level section
 * (rendering-pipeline §2.11/§3). Block tools (code, formula, diagram, image)
 * use it to resolve heading path, source range and diagnostics without
 * re-deriving them from the DOM.
 */

export interface BlockContextValue {
  blockId: string | null
  headingPath: string[]
  range: SourceRange | null
  /** Display-version text; needed for UTF-16 → UTF-8 range conversion. */
  rawText: string
  diagnostics: DocumentDiagnostic[]
}

export const BlockContext = createContext<BlockContextValue | null>(null)

export function useBlockContext(): BlockContextValue | null {
  return useContext(BlockContext)
}
