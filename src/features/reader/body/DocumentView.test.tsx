import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../services', () => ({
  opener: { openExternalUrl: vi.fn() },
}))

import { parseSimplifiedDocument } from '../../../document/simplified'
import {
  DocumentView,
  WINDOWED_MOUNT_INITIAL,
  WINDOWED_MOUNT_MAX,
  createBlockExcerptResolver,
  growMountWindow,
  initialMountWindow,
  planRevealWindow,
  useWindowedMount,
  windowContains,
  type MountWindow,
} from './DocumentView'

/**
 * Windowed mounting regression suite (D-IT-3 residual). The 11 MiB simplified
 * corpus is ~145k blocks; the previous progressive pump re-rendered the whole
 * growing prefix every shard and only stopped after mounting every block, so
 * WebKitGTK stayed at ≥100% CPU for minutes. These tests freeze the window
 * logic: bounded first screen, no idle growth (no continuous re-render loop),
 * bounded reveal at any index, and the preserved progressive mount for
 * normal-size documents.
 */

function corpusText(blocks: number): string {
  const parts: string[] = []
  for (let index = 0; index < blocks; index += 1) {
    parts.push(`段落 ${index} 用于窗口挂载回归测试。`)
  }
  return parts.join('\n\n')
}

function blockIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('section[data-block-id]')].map(
    (section) => section.getAttribute('data-block-id') ?? '',
  )
}

describe('mount window helpers', () => {
  it('bounds the initial window to the first screen', () => {
    expect(initialMountWindow(10_000)).toEqual({ start: 0, end: WINDOWED_MOUNT_INITIAL })
    expect(initialMountWindow(3)).toEqual({ start: 0, end: 3 })
    expect(initialMountWindow(0)).toEqual({ start: 0, end: 0 })
  })

  it('plans a bounded reveal window that always contains the target', () => {
    const middle = planRevealWindow(10_000, 5_000)
    expect(windowContains(middle, 5_000)).toBe(true)
    expect(middle.end - middle.start).toBe(WINDOWED_MOUNT_MAX)

    const tail = planRevealWindow(10_000, 9_999)
    expect(windowContains(tail, 9_999)).toBe(true)
    expect(tail.end).toBe(10_000)
    expect(tail.end - tail.start).toBe(WINDOWED_MOUNT_MAX)

    expect(planRevealWindow(10, 9)).toEqual({ start: 0, end: 10 })
  })

  it('grows forward/backward and shifts only past the hard size cap', () => {
    let window: MountWindow = { start: 0, end: 120 }
    window = growMountWindow(10_000, window, 'forward')
    expect(window).toEqual({ start: 0, end: 240 })
    for (let step = 0; step < 3; step += 1) {
      window = growMountWindow(10_000, window, 'forward')
    }
    expect(window).toEqual({ start: 0, end: WINDOWED_MOUNT_MAX })
    window = growMountWindow(10_000, window, 'forward')
    expect(window).toEqual({ start: 120, end: 720 })
    window = growMountWindow(10_000, window, 'backward')
    expect(window).toEqual({ start: 0, end: 600 })
  })

  it('never grows past the document edges', () => {
    const atEnd: MountWindow = { start: 9_400, end: 10_000 }
    expect(growMountWindow(10_000, atEnd, 'forward')).toBe(atEnd)
    const atStart: MountWindow = { start: 0, end: 120 }
    expect(growMountWindow(10_000, atStart, 'backward')).toBe(atStart)
  })
})

describe('useWindowedMount', () => {
  it('starts at the first screen and grows on demand', () => {
    const { result } = renderHook(() => useWindowedMount(10_000, { generation: 1 }))
    expect(result.current.window).toEqual({ start: 0, end: 120 })
    act(() => result.current.extend('forward'))
    expect(result.current.window).toEqual({ start: 0, end: 240 })
  })

  it('jumps to a bounded window around the reveal target', () => {
    const { result, rerender } = renderHook(
      ({ revealIndex }: { revealIndex: number }) =>
        useWindowedMount(10_000, { generation: 1, revealIndex }),
      { initialProps: { revealIndex: -1 } },
    )
    expect(result.current.window).toEqual({ start: 0, end: 120 })
    rerender({ revealIndex: 9_999 })
    expect(result.current.window).toEqual({ start: 9_400, end: 10_000 })
  })

  it('grows from the revealed window after the jump', () => {
    const { result, rerender } = renderHook(
      ({ revealIndex }: { revealIndex: number }) =>
        useWindowedMount(10_000, { generation: 1, revealIndex }),
      { initialProps: { revealIndex: -1 } },
    )
    rerender({ revealIndex: 9_999 })
    act(() => result.current.extend('backward'))
    expect(result.current.window).toEqual({ start: 9_280, end: 9_880 })
  })

  it('re-imposes the reveal window for a repeated locate request (new nonce)', () => {
    const { result, rerender } = renderHook(
      ({ revealIndex, revealNonce }: { revealIndex: number; revealNonce: number }) =>
        useWindowedMount(10_000, { generation: 1, revealIndex, revealNonce }),
      { initialProps: { revealIndex: 9_999, revealNonce: 1 } },
    )
    expect(result.current.window).toEqual({ start: 9_400, end: 10_000 })
    act(() => result.current.extend('backward'))
    expect(result.current.window).toEqual({ start: 9_280, end: 9_880 })
    rerender({ revealIndex: 9_999, revealNonce: 2 })
    expect(result.current.window).toEqual({ start: 9_400, end: 10_000 })
  })

  it('resets to the first screen when the generation changes', () => {
    const { result, rerender } = renderHook(
      ({ generation, revealIndex }: { generation: number; revealIndex: number }) =>
        useWindowedMount(10_000, { generation, revealIndex }),
      { initialProps: { generation: 1, revealIndex: 9_999 } },
    )
    expect(result.current.window.start).toBe(9_400)
    rerender({ generation: 2, revealIndex: -1 })
    expect(result.current.window).toEqual({ start: 0, end: 120 })
  })
})

describe('createBlockExcerptResolver (D-IT-3)', () => {
  it('returns the exact block source slice and undefined for unknown ids', () => {
    const text = '# 标题\n\n段落 一 with CJK\n\n```js\nconst a = 1\n```'
    const parsed = parseSimplifiedDocument(text)
    const resolve = createBlockExcerptResolver(parsed.blocks, text)
    expect(resolve('b1')).toBe('# 标题')
    expect(resolve('b3')).toBe('```js\nconst a = 1\n```')
    expect(resolve('missing')).toBeUndefined()
  })

  it('honours the excerpt cap', () => {
    const text = 'x'.repeat(5000)
    const parsed = parseSimplifiedDocument(text)
    const resolve = createBlockExcerptResolver(parsed.blocks, text, 10)
    expect(resolve('b1')).toBe('x'.repeat(10))
  })

  it('resolves a late block of a large document (no raw-text walk)', () => {
    const total = 50_000
    const parts: string[] = []
    for (let index = 0; index < total; index += 1) parts.push(`p${index}`)
    const text = parts.join('\n\n')
    const parsed = parseSimplifiedDocument(text)
    const resolve = createBlockExcerptResolver(parsed.blocks, text)
    const last = parsed.blocks[parsed.blocks.length - 1]
    expect(resolve(last.blockId)).toBe(`p${total - 1}`)
  })
})

describe('DocumentView windowed mounting (D-IT-3)', () => {
  const text = corpusText(3_000)
  const result = parseSimplifiedDocument(text)

  it('mounts only the bounded first window and no idle pump runs', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(
        <DocumentView docId="doc" rawText={text} result={result} generation={1} simplified />,
      )
      expect(blockIds(container)).toHaveLength(WINDOWED_MOUNT_INITIAL)
      // The old progressive pump mounted 24 blocks per idle tick forever; the
      // windowed mount must do nothing while the user is not scrolling.
      act(() => {
        vi.runAllTimers()
      })
      expect(blockIds(container)).toHaveLength(WINDOWED_MOUNT_INITIAL)
    } finally {
      vi.useRealTimers()
    }
  })

  it('mounts the bounded target window for a tail reveal (search/outline locate)', () => {
    const revealId = result.blocks[result.blocks.length - 1].blockId
    const { container } = render(
      <DocumentView
        docId="doc"
        rawText={text}
        result={result}
        generation={1}
        simplified
        revealBlockId={revealId}
      />,
    )
    const ids = blockIds(container)
    expect(ids.length).toBeLessThanOrEqual(WINDOWED_MOUNT_MAX)
    expect(ids[ids.length - 1]).toBe(revealId)
    expect(container.querySelector('[data-block-id="b1"]')).toBeNull()
  })

  it('replaces the window when a tail reveal arrives after mount', () => {
    const { container, rerender } = render(
      <DocumentView docId="doc" rawText={text} result={result} generation={1} simplified />,
    )
    expect(container.querySelector('[data-block-id="b1"]')).not.toBeNull()
    const revealId = result.blocks[result.blocks.length - 1].blockId
    rerender(
      <DocumentView
        docId="doc"
        rawText={text}
        result={result}
        generation={1}
        simplified
        revealBlockId={revealId}
      />,
    )
    expect(container.querySelector(`[data-block-id="${revealId}"]`)).not.toBeNull()
    expect(container.querySelector('[data-block-id="b1"]')).toBeNull()
  })

  it('keeps the first-screen code block copyable inside the window', () => {
    const markdown = [
      '段落 前置说明。',
      '',
      '```rust',
      'fn sample() -> u32 {',
      '    42',
      '}',
      '```',
      '',
      corpusText(3_000),
    ].join('\n')
    const parsed = parseSimplifiedDocument(markdown)
    const { container } = render(
      <DocumentView docId="doc" rawText={markdown} result={parsed} generation={1} simplified />,
    )
    const code = container.querySelector('pre code')
    expect(code?.textContent).toContain('42')
    // The trusted code-block wrapper supplies the copy action (R11/§5).
    expect(container.querySelector('.ps-code-block')).not.toBeNull()
  })

  it('keeps the progressive mount for normal-size simplified documents', () => {
    vi.useFakeTimers()
    try {
      const smallText = corpusText(100)
      const smallResult = parseSimplifiedDocument(smallText)
      const { container } = render(
        <DocumentView
          docId="doc"
          rawText={smallText}
          result={smallResult}
          generation={1}
          simplified
        />,
      )
      expect(blockIds(container)).toHaveLength(24)
      act(() => {
        vi.runAllTimers()
      })
      expect(blockIds(container)).toHaveLength(100)
    } finally {
      vi.useRealTimers()
    }
  })
})
