import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../../app/i18n'
import type { OutlineEntry } from '../../../document/types'
import type { DirectoryRoot } from '../../../services/types'
import { NavPanel } from './NavPanel'
import { navMemory } from './nav-memory'

/**
 * Nav panel host (ui-spec §3.3/§4; T-41): files/outline sharing one spot,
 * responsive width modes, close always reachable and per-root width memory.
 */

const ROOT: DirectoryRoot = {
  rootId: 'root-1',
  canonicalPath: '/root',
  displayName: 'root',
  scope: 'session',
}

const OUTLINE: OutlineEntry[] = [
  { level: 1, text: '标题', anchorId: 'ps-h-title', sourceRange: { startUtf16: 0, endUtf16: 1 } },
]

function renderPanel(props: Partial<Parameters<typeof NavPanel>[0]> = {}) {
  const handlers = {
    onSelectPanel: vi.fn(),
    onOpenFile: vi.fn(),
    onOutlineNavigate: vi.fn(),
    onClose: vi.fn(),
  }
  render(
    <NavPanel
      panel={props.panel ?? 'outline'}
      root={props.root ?? null}
      outline={props.outline ?? OUTLINE}
      docId={props.docId ?? 'doc-1'}
      selectedPath={null}
      currentAnchorId={null}
      viewportWidth={props.viewportWidth ?? 1280}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('NavPanel (ui-spec §3.3/§4)', () => {
  beforeEach(() => {
    navMemory.reset()
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ dirPath: '/root', entries: [], truncated: false })
  })

  it('renders side-by-side at >=1180px with the remembered width', () => {
    navMemory.root('root-1').width = 300
    renderPanel({ root: ROOT, panel: 'files' })
    const panel = screen.getByRole('complementary', { name: t('nav.aria') })
    expect(panel.className).toContain('ps-nav-side')
    expect((panel as HTMLElement).style.width).toBe('300px')
    expect(screen.getByRole('tabpanel').getAttribute('data-nav-layout')).toBe('side')
  })

  it('renders the overlay and full-width modes per the 840px threshold', () => {
    const overlay = renderPanel({ viewportWidth: 1000, root: ROOT, panel: 'files' })
    void overlay
    let panel = screen.getByRole('complementary', { name: t('nav.aria') })
    expect(panel.className).toContain('ps-nav-overlay')
    expect((panel as HTMLElement).style.width).toBe('320px')

    renderPanel({ viewportWidth: 700, root: ROOT, panel: 'files' })
    const panels = screen.getAllByRole('complementary', { name: t('nav.aria') })
    panel = panels[panels.length - 1]
    expect(panel.className).toContain('ps-nav-full')
    expect((panel as HTMLElement).style.width).toBe('100%')
  })

  it('keeps close and Esc exits reachable in every mode', async () => {
    const { onClose } = renderPanel({ viewportWidth: 700, root: ROOT, panel: 'files' })
    const panel = screen.getByRole('complementary', { name: t('nav.aria') })
    const close = screen.getByRole('button', { name: t('common.close') })
    expect(panel.contains(close)).toBe(true)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the files tab without an authorized root and switches panels', async () => {
    const { onSelectPanel } = renderPanel({ root: null, panel: 'outline' })
    const filesTab = screen.getByRole('tab', { name: t('nav.tab.files') }) as HTMLButtonElement
    expect(filesTab.disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: t('nav.tab.outline') }))
    expect(onSelectPanel).toHaveBeenCalledWith('outline')
  })

  it('shows the file tree for the files panel and the empty state without an outline', async () => {
    renderPanel({ root: ROOT, panel: 'files' })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('read_directory', {
        req: { rootId: 'root-1', dirPath: '/root' },
      }),
    )

    renderPanel({ root: ROOT, panel: 'outline', outline: [] })
    const empties = screen.getAllByText(t('nav.empty.outline'))
    expect(empties.length).toBeGreaterThan(0)
  })
})
