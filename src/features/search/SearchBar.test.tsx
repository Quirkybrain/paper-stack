import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { t } from '../../app/i18n'
import type { SearchSegment } from '../../document/types'
import { SearchBar } from './SearchBar'
import {
  openSearchSession,
  resetSearchSessionsForTests,
  useSearchSession,
  type SearchLocateContext,
} from './use-search-session'
import type { BodySearchHit, SearchHit } from './search-core'

/**
 * SearchBar UI oracle (ui-spec §3.4 UI03; T-42/T-43): visible controls,
 * composition gating, Enter/Shift+Enter through the input, the three states,
 * formula-match label and inspect entry, and Esc close.
 */

const SEGMENTS: SearchSegment[] = [
  {
    segId: 's1',
    blockId: 'b1',
    kind: 'text',
    text: 'alpha match one',
    startUtf16: 0,
    endUtf16: 15,
  },
  {
    segId: 's2',
    blockId: 'b2',
    kind: 'text',
    text: 'another match',
    startUtf16: 20,
    endUtf16: 33,
  },
  {
    segId: 's3',
    blockId: 'b3',
    kind: 'math',
    text: 'x^2 + y^2',
    startUtf16: 40,
    endUtf16: 49,
  },
]

interface HarnessProps {
  onLocate: (hit: SearchHit, context: SearchLocateContext) => void
  onClose?: () => void
  onFormulaInspect?: (hit: BodySearchHit) => void
  indexing?: boolean
  segments?: SearchSegment[]
}

function Harness({
  onLocate,
  onClose = () => undefined,
  onFormulaInspect,
  indexing = false,
  segments = SEGMENTS,
}: HarnessProps) {
  const session = useSearchSession({
    tabId: 't1',
    segments,
    rawText: 'alpha match one\nanother match',
    indexing,
    onLocate,
    debounceMs: 150,
  })
  return (
    <SearchBar
      session={session}
      segments={segments}
      rawText={'alpha match one\nanother match'}
      onClose={onClose}
      {...(onFormulaInspect ? { onFormulaInspect } : {})}
    />
  )
}

function search(input: HTMLElement, value: string, advance = 150) {
  fireEvent.change(input, { target: { value } })
  act(() => {
    vi.advanceTimersByTime(advance)
  })
}

describe('SearchBar', () => {
  beforeEach(() => {
    resetSearchSessionsForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetSearchSessionsForTests()
  })

  it('opens as a search landmark with a focused input', () => {
    const onLocate = vi.fn()
    render(<Harness onLocate={onLocate} />)
    act(() => openSearchSession('t1'))

    const bar = screen.getByRole('search', { name: t('search.aria') })
    const input = screen.getByRole('searchbox', { name: t('search.placeholder') })
    expect(bar.contains(input)).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(screen.getByRole('button', { name: t('search.close') })).toBeTruthy()
    expect(screen.getByText(t('search.caseSensitive'))).toBeTruthy()
  })

  it('debounces, shows the 0/N counter and locates a clicked result', () => {
    const onLocate = vi.fn()
    render(<Harness onLocate={onLocate} />)
    act(() => openSearchSession('t1'))
    const input = screen.getByRole('searchbox')

    search(input, 'match')
    expect(screen.getByText(t('search.counter', { current: 0, total: 2 }))).toBeTruthy()

    const rows = screen.getAllByRole('button', { name: /match/ })
    expect(rows.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(rows[1])
    expect(onLocate).toHaveBeenCalledTimes(1)
    expect(screen.getByText(t('search.counter', { current: 2, total: 2 }))).toBeTruthy()
  })

  it('IME composition suspends the query commit and Enter until compositionend', () => {
    const onLocate = vi.fn()
    render(<Harness onLocate={onLocate} />)
    act(() => openSearchSession('t1'))
    const input = screen.getByRole('searchbox') as HTMLInputElement

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'match' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    // The draft is visible but nothing is committed yet.
    expect(input.value).toBe('match')
    expect(screen.queryByText(t('search.counter', { current: 0, total: 2 }))).toBeNull()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onLocate).not.toHaveBeenCalled()

    fireEvent.compositionEnd(input, { data: 'match' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByText(t('search.counter', { current: 0, total: 2 }))).toBeTruthy()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onLocate).toHaveBeenCalledTimes(1)
  })

  it('EDGE-05: Enter next / Shift+Enter previous with the wrap notice', () => {
    const onLocate = vi.fn()
    render(<Harness onLocate={onLocate} />)
    act(() => openSearchSession('t1'))
    const input = screen.getByRole('searchbox')

    search(input, 'match')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText(t('search.counter', { current: 1, total: 2 }))).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText(t('search.counter', { current: 2, total: 2 }))).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText(t('search.wrapped.first'))).toBeTruthy()
    expect(screen.getByText(t('search.counter', { current: 1, total: 2 }))).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(screen.getByText(t('search.wrapped.last'))).toBeTruthy()
  })

  it('labels formula-source hits and offers the inspect entry', () => {
    const onLocate = vi.fn()
    const onFormulaInspect = vi.fn()
    render(<Harness onLocate={onLocate} onFormulaInspect={onFormulaInspect} />)
    act(() => openSearchSession('t1'))
    const input = screen.getByRole('searchbox')

    search(input, 'x^2')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getAllByText(t('search.formulaMatch')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: t('search.formulaMatch.inspect') }))
    expect(onFormulaInspect).toHaveBeenCalledTimes(1)
    expect(onFormulaInspect.mock.calls[0][0]).toMatchObject({ segId: 's3', segmentKind: 'math' })
  })

  it('shows the indexing and no-results states with their distinct messages', () => {
    const onLocate = vi.fn()
    const { unmount } = render(<Harness onLocate={onLocate} indexing />)
    act(() => openSearchSession('t1'))
    search(screen.getByRole('searchbox'), 'match')
    expect(screen.getByText(t('search.indexing'))).toBeTruthy()
    unmount()

    render(<Harness onLocate={onLocate} />)
    act(() => openSearchSession('t1'))
    search(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText(new RegExp(t('search.noResults')))).toBeTruthy()
    expect(screen.getByText(new RegExp(t('search.noResults.hint')))).toBeTruthy()
  })

  it('re-selects the existing query when the bar is reopened', () => {
    const onLocate = vi.fn()
    render(<Harness onLocate={onLocate} />)
    act(() => openSearchSession('t1'))
    search(screen.getByRole('searchbox'), 'match')

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    act(() => openSearchSession('t1'))
    const reopened = screen.getByRole('searchbox') as HTMLInputElement
    expect(reopened.value).toBe('match')
    expect(reopened.selectionStart).toBe(0)
    expect(reopened.selectionEnd).toBe('match'.length)
  })

  it('Esc closes the bar and reports the close to the host', () => {
    const onLocate = vi.fn()
    const onClose = vi.fn()
    render(<Harness onLocate={onLocate} onClose={onClose} />)
    act(() => openSearchSession('t1'))
    const input = screen.getByRole('searchbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('search', { name: t('search.aria') })).toBeNull()
  })
})
