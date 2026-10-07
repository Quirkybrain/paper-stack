import type { DirectoryListing, DirectoryNode } from '../../../services/types'

/**
 * Pure file-tree model helpers (ui-spec §3.3; T-40): visible-node flattening
 * for the roving keyboard model, node state classification and the
 * "supported document" partition used by the "show other files" listing.
 */

/** Directory nodes (and inside symlinks) can be expanded. */
export function isExpandable(node: DirectoryNode): boolean {
  if (node.kind === 'directory') return true
  return node.kind === 'symlink' && node.status === 'symlink-inside'
}

/** Primary openable item: a regular Markdown file. */
export function isSupportedDocument(node: DirectoryNode): boolean {
  return node.kind === 'file' && node.isMarkdown === true
}

export interface VisibleTreeNode {
  node: DirectoryNode
  depth: number
  parentPath: string | null
}

/**
 * Flatten the loaded listing tree into the visible node order for keyboard
 * navigation. Children only appear when their parent directory is expanded and
 * its listing has been loaded (one level per explicit expand, R02).
 */
export function flattenTree(
  rootPath: string,
  listings: ReadonlyMap<string, DirectoryListing>,
  expanded: ReadonlySet<string>,
): VisibleTreeNode[] {
  const result: VisibleTreeNode[] = []
  const walk = (dirPath: string, depth: number): void => {
    const listing = listings.get(dirPath)
    if (!listing) return
    for (const node of listing.entries) {
      // Non-Markdown files are resources, not primary open targets (ui-spec
      // §3.3); they appear under “显示其他文件”.
      if (node.kind === 'file' && node.isMarkdown !== true) continue
      result.push({ node, depth, parentPath: dirPath === rootPath ? null : dirPath })
      if (isExpandable(node) && expanded.has(node.path)) walk(node.path, depth + 1)
    }
  }
  walk(rootPath, 0)
  return result
}

/** Non-Markdown files (and other node kinds) offered by "显示其他文件". */
export function collectOtherFiles(
  rootPath: string,
  listings: ReadonlyMap<string, DirectoryListing>,
): DirectoryNode[] {
  const others: DirectoryNode[] = []
  const seen = new Set<string>()
  const walk = (dirPath: string): void => {
    const listing = listings.get(dirPath)
    if (!listing) return
    for (const node of listing.entries) {
      if (node.kind === 'file' && node.isMarkdown !== true && !seen.has(node.path)) {
        seen.add(node.path)
        others.push(node)
      }
      if (isExpandable(node)) walk(node.path)
    }
  }
  walk(rootPath)
  return others
}

export type DirectoryNodeStatusKey =
  | 'nav.node.missing'
  | 'nav.node.noPermission'
  | 'nav.node.outsideRoot'
  | 'nav.node.symlinkOutside'

/** Explanatory text for a node that is not in `ok` state; null when usable. */
export function nodeStatusKey(node: DirectoryNode): DirectoryNodeStatusKey | null {
  switch (node.status) {
    case 'missing':
      return 'nav.node.missing'
    case 'no-permission':
      return 'nav.node.noPermission'
    case 'out-of-root':
      return 'nav.node.outsideRoot'
    case 'symlink-outside':
      return 'nav.node.symlinkOutside'
    default:
      return null
  }
}

/** A node can be activated (open/toggle) only when its state is usable. */
export function isActivatable(node: DirectoryNode): boolean {
  if (node.kind === 'directory') return true
  if (node.kind === 'symlink') return node.status === 'symlink-inside'
  return node.kind === 'file' && node.status === 'ok'
}
