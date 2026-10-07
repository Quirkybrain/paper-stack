import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import type { DirectoryListing, DirectoryNode, DirectoryRoot, ErrorPayload } from '../../../services/types'
import { FileTree } from './FileTree'
import { navMemory } from './nav-memory'

/**
 * File tree (ui-spec §3.3; T-40, R02/R25): lazy one-level expansion, focus vs
 * selection, the ARIA tree keyboard model, failure retry, node-state text and
 * the secondary “显示其他文件” listing.
 */

const ROOT: DirectoryRoot = {
  rootId: 'root-1',
  canonicalPath: '/root',
  displayName: 'root',
  scope: 'session',
}

function node(overrides: Partial<DirectoryNode> & { path: string }): DirectoryNode {
  return { name: overrides.path.split('/').pop() ?? overrides.path, kind: 'file', status: 'ok', ...overrides }
}

const TREE: Record<string, DirectoryNode[]> = {
  '/root': [
    node({ path: '/root/src', kind: 'directory', hasChildren: true }),
    node({ path: '/root/readme.md', isMarkdown: true }),
    node({ path: '/root/notes.txt' }),
    node({ path: '/root/link-out', kind: 'symlink', status: 'symlink-outside', symlinkTarget: '/elsewhere' }),
  ],
  '/root/src': [node({ path: '/root/src/main.rs', isMarkdown: true })],
}

function listingFor(dirPath: string): DirectoryListing {
  const entries = TREE[dirPath] ?? []
  return { dirPath, entries, truncated: false }
}

const permissionError: ErrorPayload = {
  code: 'PS_IO_PERMISSION',
  category: 'io',
  messageKey: 'error.io.permission',
  retryable: true,
}

function renderTree(options: { selectedPath?: string | null } = {}) {
  const readDirectory = vi.fn(async (req: { rootId: string; dirPath: string }) => listingFor(req.dirPath))
  const onOpenFile = vi.fn()
  render(
    <FileTree
      root={ROOT}
      selectedPath={options.selectedPath ?? null}
      onOpenFile={onOpenFile}
      deps={{ readDirectory }}
    />,
  )
  return { readDirectory, onOpenFile }
}

describe('FileTree (ui-spec §3.3, T-40)', () => {
  beforeEach(() => {
    navMemory.reset()
  })

  it('loads only the root listing and expands one level lazily', async () => {
    const { readDirectory } = renderTree()
    await waitFor(() => expect(readDirectory).toHaveBeenCalledTimes(1))
    expect(readDirectory).toHaveBeenCalledWith({ rootId: 'root-1', dirPath: '/root' })
    expect(screen.queryByText('main.rs')).toBeNull()

    fireEvent.click(screen.getByRole('treeitem', { name: /src/ }))
    await screen.findByText('main.rs')
    expect(readDirectory).toHaveBeenCalledTimes(2)
    expect(readDirectory).toHaveBeenLastCalledWith({ rootId: 'root-1', dirPath: '/root/src' })

    // Collapsing does not reload; re-expanding reuses the loaded listing.
    fireEvent.click(screen.getByRole('treeitem', { name: /src/ }))
    expect(screen.queryByText('main.rs')).toBeNull()
    fireEvent.click(screen.getByRole('treeitem', { name: /src/ }))
    await screen.findByText('main.rs')
    expect(readDirectory).toHaveBeenCalledTimes(2)
  })

  it('moves focus with arrows and opens files with Enter, independent from selection', async () => {
    const { onOpenFile } = renderTree({ selectedPath: '/root/readme.md' })
    await screen.findByRole('treeitem', { name: /readme\.md/ })
    const items = screen.getAllByRole('treeitem')
    const [src, readme] = items

    expect(readme.getAttribute('aria-selected')).toBe('true')
    src.focus()
    fireEvent.keyDown(src, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(readme)
    // Selection stays on the open document even though focus moved.
    expect(readme.getAttribute('aria-selected')).toBe('true')
    expect(src.getAttribute('aria-selected')).toBeNull()

    fireEvent.keyDown(readme, { key: 'Enter' })
    expect(onOpenFile).toHaveBeenCalledWith('/root/readme.md')
  })

  it('expands with ArrowRight, enters children and returns with ArrowLeft', async () => {
    renderTree()
    await screen.findByRole('treeitem', { name: /src/ })
    const src = screen.getByRole('treeitem', { name: /src/ })
    src.focus()
    fireEvent.keyDown(src, { key: 'ArrowRight' })
    await screen.findByText('main.rs')
    expect(src.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(src, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /main\.rs/ }))

    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(src)

    fireEvent.keyDown(src, { key: 'ArrowLeft' })
    expect(src.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the tree on failure, explains the node and retries in place', async () => {
    let attempts = 0
    const readDirectory = vi.fn(async (req: { rootId: string; dirPath: string }) => {
      if (req.dirPath === '/root/src') {
        attempts += 1
        if (attempts === 1) throw permissionError
      }
      return listingFor(req.dirPath)
    })
    render(
      <FileTree root={ROOT} selectedPath={null} onOpenFile={() => undefined} deps={{ readDirectory }} />,
    )
    await screen.findByRole('treeitem', { name: /readme\.md/ })
    fireEvent.click(screen.getByRole('treeitem', { name: /src/ }))
    await screen.findByText(t('error.io.permission'))
    // The failed node is not treated as an empty directory; siblings stay.
    expect(screen.getByRole('treeitem', { name: /readme\.md/ })).toBeTruthy()
    expect(screen.queryByText(t('nav.empty.directory'))).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('nav.retry') }))
    await screen.findByText('main.rs')
  })

  it('renders symlink/status explanations instead of opening broken nodes', async () => {
    const { onOpenFile } = renderTree()
    const link = await screen.findByRole('treeitem', { name: /link-out/ })
    expect(within(link).getByText(t('nav.node.symlinkOutside'))).toBeTruthy()
    fireEvent.click(link)
    expect(onOpenFile).not.toHaveBeenCalled()
  })

  it('shows non-Markdown resources under “显示其他文件” and explains unsupported types', async () => {
    renderTree()
    const toggle = await screen.findByRole('button', { name: t('nav.showOtherFiles') })
    expect(screen.queryByText('notes.txt')).toBeNull()
    fireEvent.click(toggle)
    const note = screen.getByRole('button', { name: 'notes.txt' })
    fireEvent.click(note)
    await screen.findByText(t('nav.unsupported'))
  })

  it('shows the empty-directory state for an empty expanded directory', async () => {
    const readDirectory = vi.fn(async (req: { dirPath: string }) =>
      req.dirPath === '/root/empty'
        ? { dirPath: req.dirPath, entries: [], truncated: false }
        : {
            dirPath: req.dirPath,
            entries: [node({ path: '/root/empty', kind: 'directory', hasChildren: true })],
            truncated: false,
          },
    )
    render(
      <FileTree root={ROOT} selectedPath={null} onOpenFile={() => undefined} deps={{ readDirectory }} />,
    )
    const empty = await screen.findByRole('treeitem', { name: /empty/ })
    fireEvent.click(empty)
    await screen.findByText(t('nav.empty.directory'))
  })

  it('restores expansion and scroll for the same root across remounts', async () => {
    const readDirectory = vi.fn(async (req: { rootId: string; dirPath: string }) => listingFor(req.dirPath))
    const first = render(
      <FileTree root={ROOT} selectedPath={null} onOpenFile={() => undefined} deps={{ readDirectory }} />,
    )
    await screen.findByRole('treeitem', { name: /src/ })
    fireEvent.click(screen.getByRole('treeitem', { name: /src/ }))
    await screen.findByText('main.rs')
    const scroll = document.querySelector('.ps-tree') as HTMLElement
    scroll.scrollTop = 42

    first.unmount()
    render(
      <FileTree
        root={ROOT}
        selectedPath={null}
        onOpenFile={() => undefined}
        deps={{ readDirectory }}
      />,
    )
    // Expansion is restored and the directory is refetched exactly once for
    // the new mount (listings themselves are not part of the memory).
    await screen.findByText('main.rs')
    expect((document.querySelector('.ps-tree') as HTMLElement).scrollTop).toBe(42)
    expect(readDirectory.mock.calls.filter((call) => call[0].dirPath === '/root/src')).toHaveLength(2)
  })
})
