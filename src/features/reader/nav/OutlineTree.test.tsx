import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import type { OutlineEntry } from '../../../document/types'
import { OutlineTree } from './OutlineTree'
import { navMemory } from './nav-memory'

/**
 * Outline tree (ui-spec §3.3; T-41, R14): heading hierarchy, duplicate-title
 * numbering, scroll-follow highlight that neither steals focus nor expands a
 * collapsed branch, and per-document memory.
 */

function heading(level: number, text: string, anchorId: string, start = 0): OutlineEntry {
  return { level, text, anchorId, sourceRange: { startUtf16: start, endUtf16: start + 1 } }
}

const OUTLINE: OutlineEntry[] = [
  heading(1, '接口', 'ps-h-api-1', 0),
  heading(2, '安装', 'ps-h-install', 10),
  heading(3, '依赖', 'ps-h-deps', 20),
  heading(1, '接口', 'ps-h-api-2', 30),
  heading(2, '使用', 'ps-h-usage', 40),
]

function renderOutline(options: { currentAnchorId?: string | null; docId?: string } = {}) {
  const onNavigate = vi.fn()
  const view = render(
    <OutlineTree
      docId={options.docId ?? 'doc-1'}
      outline={OUTLINE}
      currentAnchorId={options.currentAnchorId ?? null}
      onNavigate={onNavigate}
    />,
  )
  return { onNavigate, view }
}

describe('OutlineTree (ui-spec §3.3, T-41)', () => {
  beforeEach(() => {
    navMemory.reset()
  })

  it('builds the hierarchy and numbers duplicate titles', () => {
    renderOutline()
    const items = screen.getAllByRole('treeitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '接口 (1)',
      '安装',
      '依赖',
      '接口 (2)',
      '使用',
    ])
    expect(items.map((item) => item.getAttribute('aria-level'))).toEqual(['1', '2', '3', '1', '2'])
    expect(items[0].getAttribute('aria-expanded')).toBe('true')
  })

  it('marks the current section without stealing focus', () => {
    const view = render(
      <>
        <button type="button">external</button>
        <OutlineTree docId="doc-1" outline={OUTLINE} currentAnchorId={null} onNavigate={() => undefined} />
      </>,
    )
    const external = screen.getByRole('button', { name: 'external' })
    external.focus()

    view.rerender(
      <>
        <button type="button">external</button>
        <OutlineTree
          docId="doc-1"
          outline={OUTLINE}
          currentAnchorId="ps-h-install"
          onNavigate={() => undefined}
        />
      </>,
    )
    const current = view.container.querySelector('[aria-current="true"]')
    expect(current?.textContent).toBe('安装')
    expect(document.activeElement).toBe(external)
  })

  it('keeps a user-collapsed branch collapsed while highlighting it', () => {
    const { view } = renderOutline()
    fireEvent.click(screen.getByRole('button', { name: '接口 (1)' }))
    expect(screen.queryByText('安装')).toBeNull()

    view.rerender(
      <OutlineTree docId="doc-1" outline={OUTLINE} currentAnchorId="ps-h-install" onNavigate={() => undefined} />,
    )
    expect(screen.queryByText('安装')).toBeNull()
    const parent = screen.getByRole('treeitem', { name: '接口 (1)' })
    expect(parent.getAttribute('aria-expanded')).toBe('false')
    expect(parent.getAttribute('data-current-subtree')).toBe('true')
  })

  it('navigates with the captured source anchor and never on expansion', () => {
    const { onNavigate } = renderOutline({ currentAnchorId: 'ps-h-api-1' })
    fireEvent.click(screen.getByText('安装'))
    expect(onNavigate).toHaveBeenCalledWith(OUTLINE[1], 'ps-h-api-1')

    onNavigate.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '接口 (1)' }))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('supports arrow navigation, expansion and Enter navigation', () => {
    const { onNavigate } = renderOutline({ currentAnchorId: null })
    const items = screen.getAllByRole('treeitem')
    items[0].focus()
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect((document.activeElement as HTMLElement).textContent).toBe('安装')

    // Expanded child: ArrowLeft collapses it first, then returns to parent.
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    expect(screen.queryByText('依赖')).toBeNull()
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(items[0])
    // …and ArrowLeft there collapses the branch, ArrowRight re-expands.
    fireEvent.keyDown(items[0], { key: 'ArrowLeft' })
    expect(items[0].getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(items[0], { key: 'ArrowRight' })
    expect(items[0].getAttribute('aria-expanded')).toBe('true')

    onNavigate.mockClear()
    // Move the roving focus to the child, then activate with Enter.
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    expect((document.activeElement as HTMLElement).textContent).toBe('安装')
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledWith(OUTLINE[1], null)
  })

  it('remembers collapsed branches per document', () => {
    const first = renderOutline({ docId: 'doc-a' })
    fireEvent.click(screen.getByRole('button', { name: '接口 (1)' }))
    expect(screen.queryByText('安装')).toBeNull()
    first.view.unmount()

    // Same document: still collapsed.
    const second = renderOutline({ docId: 'doc-a' })
    expect(screen.queryByText('安装')).toBeNull()
    second.view.unmount()

    // Another document starts from the default (all parents expanded).
    renderOutline({ docId: 'doc-b' })
    expect(screen.getByText('安装')).toBeTruthy()
  })

  it('shows the empty-outline state', () => {
    render(
      <OutlineTree docId="doc-1" outline={[]} currentAnchorId={null} onNavigate={() => undefined} />,
    )
    expect(screen.getByText(t('nav.empty.outline'))).toBeTruthy()
  })
})
