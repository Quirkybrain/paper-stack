import { act, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { planMountShards, renderDocument, useProgressiveMount } from './map'
import { parseDocument } from './pipeline'
import type { RenderDocumentInput } from './map'

async function input(markdown: string): Promise<RenderDocumentInput> {
  const parsed = await parseDocument(markdown)
  return { hast: parsed.hast, blocks: parsed.blocks, segments: parsed.segments }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('renderDocument (⑪–⑫)', () => {
  it('renders block sections with data-block-id and UTF-8 source byte ranges', async () => {
    const text = '你好 world'
    const { container } = render(<>{renderDocument(await input(text))}</>)
    const sections = container.querySelectorAll('section[data-block-id]')
    expect(sections).toHaveLength(1)
    expect(sections[0].getAttribute('data-block-id')).toBe('b1')
    expect(sections[0].getAttribute('data-src-start')).toBe('0')
    expect(sections[0].getAttribute('data-src-end')).toBe(
      String(new TextEncoder().encode(text).length),
    )
    expect(container.querySelector('[data-block-id]')?.textContent).toBe('你好 world')
  })

  it('annotates searchable text with data-seg-id', async () => {
    const { container } = render(<>{renderDocument(await input('alpha 正文 gamma'))}</>)
    const segment = container.querySelector('[data-seg-id]')
    expect(segment).not.toBeNull()
    expect(segment?.getAttribute('data-seg-id')).toMatch(/^s\d+$/)
    expect(segment?.textContent).toBe('alpha 正文 gamma')
  })

  it('keeps literal code text accessible for copy', async () => {
    const { container } = render(<>{renderDocument(await input('```js\nconst a = 1\n```'))}</>)
    const code = container.querySelector('pre code')
    expect(code).not.toBeNull()
    // The literal keeps CommonMark's final line ending for copy fidelity (§2.9).
    expect(code?.textContent).toBe('const a = 1\n')
    expect(code?.getAttribute('data-seg-id')).toMatch(/^s\d+$/)
  })

  it('maps details/summary and disables task checkboxes', async () => {
    const markdown = '<details open><summary>摘要</summary>正文</details>\n\n- [x] done'
    const { container } = render(<>{renderDocument(await input(markdown))}</>)
    const details = container.querySelector('details')
    expect(details?.hasAttribute('open')).toBe(true)
    expect(details?.querySelector('summary')?.textContent).toBe('摘要')
    expect(details?.textContent).toContain('正文')

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.disabled).toBe(true)
    expect(checkbox.checked).toBe(true)
  })

  it('returns null for the defensive document failure path', () => {
    expect(renderDocument({ hast: null, blocks: [], segments: [] })).toBeNull()
  })

  it('isolates a failing block with the error boundary and keeps other blocks', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onBlockError = vi.fn()
    const Boom = () => {
      throw new Error('render exploded')
    }

    const { container } = render(
      <>
        {renderDocument(await input('# Heading\n\nboom paragraph'), {
          components: { p: Boom },
          translate: (key) => `T:${key}`,
          sourceExcerptFor: () => 'boom paragraph',
          onBlockError,
        })}
      </>,
    )

    const fallback = container.querySelector('.ps-block-error')
    expect(fallback).not.toBeNull()
    expect(fallback?.getAttribute('data-block-id')).toBe('b2')
    expect(fallback?.querySelector('pre')?.textContent).toBe('boom paragraph')
    expect(fallback?.textContent).toContain('T:error.parse.local')
    expect(container.querySelector('h1')?.textContent).toBe('Heading')
    expect(onBlockError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
  })
})

describe('progressive mount helpers', () => {
  it('splits blocks into a first-screen shard plus equal following shards', () => {
    const blocks = Array.from({ length: 10 }, (_, index) => `b${index + 1}`)
    expect(planMountShards(blocks, { firstShard: 4, shardSize: 3 })).toEqual([
      ['b1', 'b2', 'b3', 'b4'],
      ['b5', 'b6', 'b7'],
      ['b8', 'b9', 'b10'],
    ])
    expect(planMountShards([], {})).toEqual([])
    expect(planMountShards(blocks, { firstShard: 999 })).toEqual([blocks])
  })

  it('mounts the first shard, then appends shards to the full block count', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() =>
        useProgressiveMount(70, { firstShard: 10, shardSize: 20 }),
      )
      expect(result.current).toBe(10)
      act(() => {
        vi.runAllTimers()
      })
      expect(result.current).toBe(70)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets mount progress when the generation changes', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(
        ({ generation }) => useProgressiveMount(70, { generation, firstShard: 10, shardSize: 20 }),
        { initialProps: { generation: 0 } },
      )
      act(() => {
        vi.runAllTimers()
      })
      expect(result.current).toBe(70)

      rerender({ generation: 1 })
      expect(result.current).toBe(10)
    } finally {
      vi.useRealTimers()
    }
  })
})
