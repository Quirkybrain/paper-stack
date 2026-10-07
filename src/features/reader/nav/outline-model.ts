import type { OutlineEntry } from '../../../document/types'

/**
 * Pure outline model helpers (ui-spec §3.3; T-41): heading hierarchy from the
 * pipeline outline, duplicate-title numbering and the visible pre-order used
 * by the roving keyboard model.
 *
 * The pipeline already deduplicates `anchorId`s; this module only handles the
 * user-visible labels and tree shape. Highlight-follow never expands a node:
 * collapsed parents stay collapsed and are marked instead.
 */

export interface OutlineNode {
  entry: OutlineEntry
  /** User-visible label; duplicates get a ` (n)` suffix (ui-spec §3.3). */
  label: string
  children: OutlineNode[]
}

/** Labels in outline order; repeated titles are numbered `text (1)`, `text (2)`. */
export function outlineDisplayLabels(outline: readonly OutlineEntry[]): string[] {
  const total = new Map<string, number>()
  for (const entry of outline) total.set(entry.text, (total.get(entry.text) ?? 0) + 1)
  const seen = new Map<string, number>()
  return outline.map((entry) => {
    if ((total.get(entry.text) ?? 0) <= 1) return entry.text
    const index = (seen.get(entry.text) ?? 0) + 1
    seen.set(entry.text, index)
    return `${entry.text} (${index})`
  })
}

export function buildOutlineTree(outline: readonly OutlineEntry[]): OutlineNode[] {
  const labels = outlineDisplayLabels(outline)
  const roots: OutlineNode[] = []
  const stack: Array<{ level: number; node: OutlineNode }> = []

  outline.forEach((entry, index) => {
    const node: OutlineNode = { entry, label: labels[index] ?? entry.text, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.node.children.push(node)
    else roots.push(node)
    stack.push({ level: entry.level, node })
  })

  return roots
}

export interface VisibleOutlineNode {
  node: OutlineNode
  depth: number
  parentAnchorId: string | null
}

/** Pre-order over nodes whose parents are expanded. */
export function flattenOutline(
  roots: readonly OutlineNode[],
  expanded: ReadonlySet<string>,
): VisibleOutlineNode[] {
  const result: VisibleOutlineNode[] = []
  const walk = (nodes: readonly OutlineNode[], depth: number, parentAnchorId: string | null) => {
    for (const node of nodes) {
      result.push({ node, depth, parentAnchorId })
      if (node.children.length > 0 && expanded.has(node.entry.anchorId)) {
        walk(node.children, depth + 1, node.entry.anchorId)
      }
    }
  }
  walk(roots, 0, null)
  return result
}

/** Default expansion: every parent with children is open until the user acts. */
export function defaultExpandedAnchors(roots: readonly OutlineNode[]): Set<string> {
  const expanded = new Set<string>()
  const walk = (nodes: readonly OutlineNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        expanded.add(node.entry.anchorId)
        walk(node.children)
      }
    }
  }
  walk(roots)
  return expanded
}

/**
 * Nearest collapsed ancestor of `anchorId`, or null when the node is visible.
 * Used to mark a collapsed branch without force-expanding it (ui-spec §3.3).
 */
export function collapsedAncestor(
  roots: readonly OutlineNode[],
  anchorId: string,
  expanded: ReadonlySet<string>,
): string | null {
  const collect = (
    nodes: readonly OutlineNode[],
    trail: Array<{ anchorId: string; collapsed: boolean }>,
  ): string | null => {
    for (const node of nodes) {
      const next = [
        ...trail,
        {
          anchorId: node.entry.anchorId,
          collapsed: node.children.length > 0 && !expanded.has(node.entry.anchorId),
        },
      ]
      if (node.entry.anchorId === anchorId) {
        const collapsed = next.filter((item) => item.collapsed)
        return collapsed.length > 0 ? collapsed[collapsed.length - 1].anchorId : null
      }
      const found = collect(node.children, next)
      if (found !== null) return found
    }
    return null
  }
  return collect(roots, [])
}
