import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchSegment } from '../../document/types'
import { PaperStackError } from '../../services/invoke'
import type { SourceSearchResult } from '../../services/types'
import {
  readSearchSession,
  resetSearchSessionsForTests,
  useSearchSession,
  type UseSearchSessionOptions,
} from './use-search-session'

/**
 * Search session oracle (ui-spec §3.4; T-42; ADR-007): IME gate, 150ms
 * debounce with stale-batch isolation, the three states, EDGE-05 Enter
 * semantics with wrap-around notices, and per-tab memory.
 */

const SEGMENTS: SearchSegment[] = [
  {
    segId: 's1',
    blockId: 'b1',
    kind: 'text',
    text: 'alpha match one match two',
    startUtf16: 0,
    endUtf16: 25,
  },
  {
    segId: 's2',
    blockId: 'b2',
    kind: 'text',
    text: 'another match',
    startUtf16: 30,
    endUtf16: 43,
  },
]

function sourceResult(overrides: Partial<SourceSearchResult> = {}): SourceSearchResult {
  return {
    docId: 'd-a',
    version: { contentHash: 'v1', sizeBytes: 1, modifiedAtMs: 1, observedAtMs: 1 },
    matches: [],
    scannedBytes: 10,
    totalBytes: 10,
    complete: true,
    ...overrides,
  }
}

function setup(overrides: Partial<UseSearchSessionOptions> = {}) {
  const onLocate = vi.fn()
  const options: UseSearchSessionOptions = {
    tabId: 't1',
    segments: SEGMENTS,
    rawText: 'alpha match one match two\nanother match',
    indexing: false,
    onLocate,
    debounceMs: 150,
    ...overrides,
  }
  const view = renderHook((props: UseSearchSessionOptions) => useSearchSession(props), {
    initialProps: options,
  })
  const openAndSearch = (query: string, advance = 150) => {
    act(() => view.result.current.open())
    act(() => view.result.current.setQuery(query))
    act(() => {
      vi.advanceTimersByTime(advance)
    })
  }
  return { view, onLocate, openAndSearch }
}

describe('useSearchSession', () => {
  beforeEach(() => {
    resetSearchSessionsForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetSearchSessionsForTests()
  })

  it('debounces 150ms and never shows stale counts for the new query', () => {
    const { view } = setup()
    act(() => view.result.current.open())
    act(() => view.result.current.setQuery('match'))
    // The old count is cleared immediately; the UI shows the indexing state.
    expect(view.result.current.state.status).toBe('indexing')
    expect(view.result.current.state.matches).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(view.result.current.state.matches).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(view.result.current.state.status).toBe('results')
    expect(view.result.current.state.matches).toHaveLength(3)
    expect(view.result.current.state.current).toBe(0)

    // A second query replaces the first batch without flashing old counts.
    act(() => view.result.current.setQuery('another'))
    expect(view.result.current.state.matches).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(view.result.current.state.matches).toHaveLength(1)
  })

  it('IME composition gates navigation until compositionend', () => {
    const { view, onLocate, openAndSearch } = setup()
    openAndSearch('match')
    expect(view.result.current.state.matches).toHaveLength(3)

    act(() => view.result.current.compositionStart())
    act(() => view.result.current.next())
    expect(onLocate).not.toHaveBeenCalled()
    expect(view.result.current.state.current).toBe(0)

    act(() => view.result.current.compositionEnd())
    act(() => view.result.current.next())
    expect(onLocate).toHaveBeenCalledTimes(1)
    expect(view.result.current.state.current).toBe(1)
  })

  it('EDGE-05: none selected jumps first/last, then next/previous with wrap notices', () => {
    const { view, onLocate, openAndSearch } = setup()
    openAndSearch('match')

    act(() => view.result.current.next())
    expect(onLocate.mock.calls[0][1]).toMatchObject({ first: true })
    expect(view.result.current.state.current).toBe(1)

    act(() => view.result.current.next())
    expect(view.result.current.state.current).toBe(2)
    act(() => view.result.current.next())
    expect(view.result.current.state.current).toBe(3)

    act(() => view.result.current.next())
    expect(view.result.current.state.current).toBe(1)
    expect(view.result.current.state.noticeKey).toBe('search.wrapped.first')

    act(() => view.result.current.prev())
    expect(view.result.current.state.current).toBe(3)
    expect(view.result.current.state.noticeKey).toBe('search.wrapped.last')

    act(() => view.result.current.prev())
    expect(view.result.current.state.current).toBe(2)
    expect(view.result.current.state.noticeKey).toBeNull()

    // Shift+Enter with nothing selected jumps to the last item (EDGE-05).
    const fresh = setup({ tabId: 't-other' })
    act(() => fresh.view.result.current.open())
    act(() => fresh.view.result.current.setQuery('another'))
    act(() => {
      vi.advanceTimersByTime(150)
    })
    act(() => fresh.view.result.current.prev())
    expect(fresh.view.result.current.state.current).toBe(1)
    expect(fresh.onLocate.mock.calls[0][1]).toMatchObject({ first: true })
  })

  it('surfaces the indexing state while the document index is not ready', () => {
    const { view } = setup({ indexing: true })
    act(() => view.result.current.open())
    act(() => view.result.current.setQuery('match'))
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(view.result.current.state.status).toBe('indexing')
    expect(view.result.current.state.matches).toHaveLength(0)
  })

  it('reports no-results distinctly from an empty query', () => {
    const { view, openAndSearch } = setup()
    openAndSearch('zzz-not-there')
    expect(view.result.current.state.status).toBe('noResults')
    expect(view.result.current.state.matches).toHaveLength(0)

    act(() => view.result.current.setQuery(''))
    expect(view.result.current.state.status).toBe('idle')
  })

  it('never lets a stale async source batch overwrite the new query', async () => {
    const pending = new Map<string, (result: SourceSearchResult) => void>()
    const sourceSearch = vi.fn(
      (query: string) =>
        new Promise<SourceSearchResult>((resolve) => {
          pending.set(query, resolve)
        }),
    )
    const { view } = setup({ sourceSearch })
    act(() => view.result.current.open())
    act(() => view.result.current.setScope('source'))

    act(() => view.result.current.setQuery('A'))
    act(() => {
      vi.advanceTimersByTime(150)
    })
    act(() => view.result.current.setQuery('B'))
    act(() => {
      vi.advanceTimersByTime(150)
    })

    await act(async () => {
      pending.get('B')?.(
        sourceResult({
          matches: [
            { startByte: 0, endByte: 2, lineNumber: 1 },
            { startByte: 5, endByte: 7, lineNumber: 2 },
          ],
        }),
      )
    })
    expect(view.result.current.state.matches).toHaveLength(2)

    await act(async () => {
      pending.get('A')?.(
        sourceResult({
          matches: Array.from({ length: 9 }, (_, index) => ({
            startByte: index,
            endByte: index + 1,
            lineNumber: 1,
          })),
        }),
      )
    })
    // The late A batch is dropped: no old counts flash back.
    expect(view.result.current.state.matches).toHaveLength(2)
    expect(view.result.current.state.query).toBe('B')
  })

  it('marks incomplete source scans and cancelled searches with their own notices', async () => {
    const incomplete = setup({
      tabId: 't-incomplete',
      sourceSearch: vi.fn().mockResolvedValue(
        sourceResult({
          matches: [{ startByte: 0, endByte: 3, lineNumber: 1 }],
          complete: false,
        }),
      ),
    })
    act(() => incomplete.view.result.current.open())
    act(() => incomplete.view.result.current.setScope('source'))
    act(() => incomplete.view.result.current.setQuery('abc'))
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(incomplete.view.result.current.state.status).toBe('results')
    expect(incomplete.view.result.current.state.incomplete).toBe(true)
    expect(incomplete.view.result.current.state.noticeKey).toBe('search.incomplete')

    const cancelled = setup({
      tabId: 't-cancelled',
      sourceSearch: vi
        .fn()
        .mockRejectedValue(
          new PaperStackError({
            code: 'PS_TASK_CANCELLED',
            category: 'internal',
            messageKey: 'error.internal.cancelled',
            retryable: false,
          }),
        ),
    })
    act(() => cancelled.view.result.current.open())
    act(() => cancelled.view.result.current.setScope('source'))
    act(() => cancelled.view.result.current.setQuery('abc'))
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(cancelled.view.result.current.state.noticeKey).toBe('search.cancelled')
    expect(cancelled.view.result.current.state.incomplete).toBe(false)
  })

  it('keeps query and selection across close and isolates tabs', () => {
    const { view, openAndSearch } = setup()
    openAndSearch('match')
    act(() => view.result.current.next())

    act(() => view.result.current.close())
    expect(view.result.current.state.open).toBe(false)
    expect(view.result.current.state.query).toBe('match')
    expect(view.result.current.state.current).toBe(1)

    const other = renderHook((props: UseSearchSessionOptions) => useSearchSession(props), {
      initialProps: {
        tabId: 't2',
        segments: SEGMENTS,
        rawText: null,
        indexing: false,
        onLocate: vi.fn(),
      },
    })
    expect(other.result.current.state.query).toBe('')
    expect(readSearchSession('t1').query).toBe('match')
  })

  it('activates a clicked result and clears the wrap notice', () => {
    const { view, onLocate, openAndSearch } = setup()
    openAndSearch('match')
    act(() => view.result.current.next())
    act(() => view.result.current.next())
    act(() => view.result.current.next())
    act(() => view.result.current.next()) // wrap → notice
    expect(view.result.current.state.noticeKey).toBe('search.wrapped.first')

    act(() => view.result.current.activate(1))
    expect(view.result.current.state.current).toBe(2)
    expect(view.result.current.state.noticeKey).toBeNull()
    expect(onLocate).toHaveBeenCalledTimes(5)
  })
})
