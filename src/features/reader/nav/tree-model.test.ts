import { describe, expect, it } from 'vitest'

import type { DirectoryListing, DirectoryNode } from '../../../services/types'
import {
  collectOtherFiles,
  flattenTree,
  isExpandable,
  isSupportedDocument,
  nodeStatusKey,
} from './tree-model'

/**
 * Pure file-tree model (ui-spec §3.3; T-40): lazy visible order, the
 * supported-document partition and node-state explanations.
 */

function node(overrides: Partial<DirectoryNode> & { path: string }): DirectoryNode {
  return { name: overrides.path.split('/').pop() ?? overrides.path, kind: 'file', status: 'ok', ...overrides }
}

function listing(dirPath: string, entries: DirectoryNode[], truncated = false): DirectoryListing {
  return { dirPath, entries, truncated }
}

const ROOT = '/root'
const listings = new Map<string, DirectoryListing>([
  [
    ROOT,
    listing(ROOT, [
      node({ path: '/root/src', kind: 'directory', hasChildren: true }),
      node({ path: '/root/readme.md', isMarkdown: true }),
      node({ path: '/root/notes.txt' }),
      node({ path: '/root/gone.md', status: 'missing', isMarkdown: true }),
    ]),
  ],
  ['/root/src', listing('/root/src', [node({ path: '/root/src/main.rs', isMarkdown: true })])],
])

describe('tree-model', () => {
  it('only lists expanded directories and one loaded level at a time', () => {
    const collapsed = flattenTree(ROOT, listings, new Set())
    expect(collapsed.map((item) => item.node.path)).toEqual([
      '/root/src',
      '/root/readme.md',
      '/root/gone.md',
    ])
    expect(collapsed.map((item) => item.depth)).toEqual([0, 0, 0])

    const expanded = flattenTree(ROOT, listings, new Set(['/root/src']))
    expect(expanded.map((item) => item.node.path)).toContain('/root/src/main.rs')
    expect(expanded.find((item) => item.node.path === '/root/src/main.rs')?.depth).toBe(1)
  })

  it('partitions supported documents from other resources', () => {
    expect(isSupportedDocument(node({ path: '/root/a.md', isMarkdown: true }))).toBe(true)
    expect(isSupportedDocument(node({ path: '/root/a.txt' }))).toBe(false)
    expect(collectOtherFiles(ROOT, listings).map((item) => item.path)).toEqual(['/root/notes.txt'])
  })

  it('classifies expandability and node states', () => {
    expect(isExpandable(node({ path: '/root/src', kind: 'directory' }))).toBe(true)
    expect(isExpandable(node({ path: '/root/link', kind: 'symlink', status: 'symlink-inside' }))).toBe(true)
    expect(isExpandable(node({ path: '/root/link', kind: 'symlink', status: 'symlink-outside' }))).toBe(false)
    expect(nodeStatusKey(node({ path: '/root/a', status: 'no-permission' }))).toBe('nav.node.noPermission')
    expect(nodeStatusKey(node({ path: '/root/a', status: 'out-of-root' }))).toBe('nav.node.outsideRoot')
    expect(nodeStatusKey(node({ path: '/root/a', kind: 'symlink', status: 'symlink-outside' }))).toBe(
      'nav.node.symlinkOutside',
    )
    expect(nodeStatusKey(node({ path: '/root/a', status: 'missing' }))).toBe('nav.node.missing')
    expect(nodeStatusKey(node({ path: '/root/a' }))).toBeNull()
  })
})
