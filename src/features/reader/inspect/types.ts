import type { SourceRange } from '../../../services/types'

/**
 * Inspect drawer target (ui-spec §3.6; T-46). The 340px non-modal drawer is
 * the formula panel; code, diagram and image tools act on their own blocks
 * (their diagnostics stay in-block) and never open this drawer.
 */

export interface FormulaInspectTarget {
  kind: 'formula'
  /** Source text without the `$`/`$$` delimiters. */
  source: string
  /** Heading path of the containing block; null at the document top. */
  chapter: string | null
  range: SourceRange | null
  diagnostic: { code: string; messageKey: string } | null
}

export type InspectTarget = FormulaInspectTarget
