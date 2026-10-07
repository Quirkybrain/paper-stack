import { describe, expect, it } from 'vitest'

import {
  HISTORY_LIMIT,
  canGoBack,
  canGoForward,
  commitNavigation,
  createHistoryState,
  goBack,
  goForward,
  restoreMessageKey,
  selectTabHistory,
  upsertSearchNavigation,
  type HistoryEntry,
  type HistoryKind,
  type NavPoint,
} from './history'

/**
 * Navigation-history oracle (models §5; INV-NH-01..08). The pure model owns
 * ordering, merge and forward-clearing rules; failures/cancellations simply
 * never call `commitNavigation` (INV-NH-02), which the reader-level tests
 * cover through rejected document-link navigation.
 */

function point(docId: string, overrides: Partial<NavPoint> = {}): NavPoint {
  return {
    docId,
    canonicalPath: `/${docId}.md`,
    blockId: null,
    anchorId: null,
    sourceByte: null,
    ...overrides,
  }
}

function entry(
  entryId: string,
  from: NavPoint,
  to: NavPoint,
  kind: HistoryKind = 'outline',
): HistoryEntry {
  return { entryId, kind, from, to, committedAt: 1 }
}

describe('history stacks', () => {
  it('INV-NH-07: nothing to go back/forward initially, and moves are no-ops', () => {
    const state = createHistoryState()
    expect(canGoBack(state, 't1')).toBe(false)
    expect(canGoForward(state, 't1')).toBe(false)
    const back = goBack(state, 't1')
    expect(back.entry).toBeNull()
    expect(back.state).toBe(state)
    const forward = goForward(state, 't1')
    expect(forward.entry).toBeNull()
    expect(forward.state).toBe(state)
  })

  it('INV-NH-02: every committed navigation is exactly one entry', () => {
    const from = point('a')
    const to = point('a', { blockId: 'b1' })
    const state = commitNavigation(createHistoryState(), 't1', entry('e1', from, to))
    expect(selectTabHistory(state, 't1').back).toHaveLength(1)
    expect(canGoBack(state, 't1')).toBe(true)
  })

  it('goes back to the source and forward to the target again', () => {
    const from = point('a', { blockId: 'b0' })
    const to = point('a', { blockId: 'b1' })
    const state = commitNavigation(createHistoryState(), 't1', entry('e1', from, to))

    const first = goBack(state, 't1')
    expect(first.entry?.from).toEqual(from)
    expect(canGoBack(first.state, 't1')).toBe(false)
    expect(canGoForward(first.state, 't1')).toBe(true)

    const second = goForward(first.state, 't1')
    expect(second.entry?.to).toEqual(to)
    expect(canGoBack(second.state, 't1')).toBe(true)
    expect(canGoForward(second.state, 't1')).toBe(false)
  })

  it('INV-NH-01: histories are isolated per tab', () => {
    const state = commitNavigation(
      createHistoryState(),
      't1',
      entry('e1', point('a'), point('a', { blockId: 'b1' })),
    )
    expect(canGoBack(state, 't1')).toBe(true)
    expect(canGoBack(state, 't2')).toBe(false)
    const closed = goBack(state, 't2')
    expect(closed.state).toBe(state)
  })

  it('INV-NH-04: back keeps forward; a new navigation clears it', () => {
    let state = commitNavigation(createHistoryState(), 't1', entry('e1', point('a'), point('a', { blockId: 'b1' })))
    state = commitNavigation(state, 't1', entry('e2', point('a', { blockId: 'b1' }), point('a', { blockId: 'b2' })))
    const back = goBack(state, 't1')
    expect(canGoForward(back.state, 't1')).toBe(true)
    // Back itself must not clear forward.
    expect(selectTabHistory(back.state, 't1').forward).toHaveLength(1)

    const afterNew = commitNavigation(
      back.state,
      't1',
      entry('e3', point('a', { blockId: 'b0' }), point('a', { blockId: 'b3' })),
    )
    expect(canGoForward(afterNew, 't1')).toBe(false)
    expect(selectTabHistory(afterNew, 't1').back.map((item) => item.entryId)).toEqual([
      'e1',
      'e3',
    ])
  })

  it('INV-NH-05: a search session merges into one entry, final target wins', () => {
    const from = point('a', { blockId: 'b0' })
    let state = commitNavigation(
      createHistoryState(),
      't1',
      entry('search-1', from, point('a', { blockId: 'b1' }), 'search'),
    )
    state = upsertSearchNavigation(
      state,
      't1',
      entry('search-1', from, point('a', { blockId: 'b2' }), 'search'),
    )
    state = upsertSearchNavigation(
      state,
      't1',
      entry('search-1', from, point('a', { blockId: 'b3' }), 'search'),
    )
    const tab = selectTabHistory(state, 't1')
    expect(tab.back).toHaveLength(1)
    expect(tab.back[0].to.blockId).toBe('b3')
    expect(tab.back[0].from).toEqual(from)
  })

  it('INV-NH-05: a merged search update still clears forward', () => {
    let state = commitNavigation(createHistoryState(), 't1', entry('e1', point('a'), point('a', { blockId: 'b1' })))
    state = commitNavigation(
      state,
      't1',
      entry('search-1', point('a', { blockId: 'b1' }), point('a', { blockId: 'b2' }), 'search'),
    )
    state = goBack(state, 't1').state
    expect(canGoForward(state, 't1')).toBe(true)
    state = upsertSearchNavigation(
      state,
      't1',
      entry('search-1', point('a', { blockId: 'b1' }), point('a', { blockId: 'b3' }), 'search'),
    )
    expect(canGoForward(state, 't1')).toBe(false)
    expect(selectTabHistory(state, 't1').back.map((item) => item.entryId)).toEqual(['e1', 'search-1'])
  })

  it('upserting an unknown search entry pushes it (session restart)', () => {
    const from = point('a')
    let state = commitNavigation(
      createHistoryState(),
      't1',
      entry('search-1', from, point('a', { blockId: 'b1' }), 'search'),
    )
    state = upsertSearchNavigation(
      state,
      't1',
      entry('search-2', from, point('a', { blockId: 'b9' }), 'search'),
    )
    expect(selectTabHistory(state, 't1').back.map((item) => item.entryId)).toEqual([
      'search-1',
      'search-2',
    ])
  })

  it('caps the per-tab stack at the pending P-01 bound, dropping the oldest', () => {
    let state = createHistoryState()
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      state = commitNavigation(
        state,
        't1',
        entry(`e${index}`, point('a', { blockId: `from-${index}` }), point('a', { blockId: `to-${index}` })),
      )
    }
    const back = selectTabHistory(state, 't1').back
    expect(back).toHaveLength(HISTORY_LIMIT)
    expect(back[0].entryId).toBe('e5')
  })

  it('maps restore outcomes to the exact §16.2 strings', () => {
    expect(restoreMessageKey('exact')).toBe('nav.return.exact')
    expect(restoreMessageKey('approx')).toBe('nav.return.approx')
  })
})
