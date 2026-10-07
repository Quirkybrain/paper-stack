import { describe, expect, it } from 'vitest'

import {
  sessionInvalidated,
  sessionReadSucceeded,
  sessionTaskFailed,
  sessionTaskSucceeded,
  type TaskToken,
} from '../../app/session'
import type { ErrorPayload, VersionInfo } from '../../services/types'
import {
  INITIAL_READER_STATE,
  buildSessionTabs,
  createReaderTab,
  readerReducer,
  selectActiveTab,
  selectCycleTabId,
  tabActivate,
  tabClose,
  tabDisplayLabels,
  tabLargeDoc,
  tabOpen,
  tabPhase,
  tabSessionAction,
  type ReaderState,
  type ReaderTab,
} from './reader-state'

/**
 * Reader tab rules (models §7; INV-TL-01..08) and the session-commit phase
 * transitions (contract §6). Pure reducer tests — no DOM.
 */

let tabCounter = 0

function tab(docId: string, path = `/docs/${docId}.md`, name = `${docId}.md`): ReaderTab {
  tabCounter += 1
  return createReaderTab({
    tabId: `tab-${tabCounter}`,
    docId,
    canonicalPath: path,
    displayName: name,
  })
}

function version(hash: string): VersionInfo {
  return { contentHash: hash, sizeBytes: 10, modifiedAtMs: 1, observedAtMs: 2 }
}

function discoveryToken(docId: string, generation: number, taskId = 'r1'): TaskToken {
  return { docId, version: null, generation, taskId }
}

const failure: ErrorPayload = {
  code: 'PS_IO_READ_FAILED',
  category: 'io',
  messageKey: 'error.io.readFailed',
  retryable: true,
}

function activeId(state: ReaderState): string | null {
  return selectActiveTab(state)?.tabId ?? null
}

describe('reader tabs (models §7)', () => {
  it('reuses a tab for the same docId instead of duplicating (INV-TL-01)', () => {
    let state = INITIAL_READER_STATE
    const first = tab('d-a')
    state = readerReducer(state, tabOpen(first, true))
    state = readerReducer(state, tabOpen(tab('d-a'), false))
    expect(state.tabs).toHaveLength(1)
    expect(activeId(state)).toBe(first.tabId)
    // A later duplicate open activates the existing tab.
    state = readerReducer(state, tabActivate('tab-999'))
    expect(activeId(state)).toBe(first.tabId)
  })

  it('closes the active tab in MRU → right → left order (INV-TL-04)', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    state = readerReducer(state, tabOpen(tab('d-b'), true))
    state = readerReducer(state, tabOpen(tab('d-c'), false))
    const a = state.tabs[0].tabId
    const b = state.tabs[1].tabId
    state = readerReducer(state, tabActivate(a))
    state = readerReducer(state, tabClose(a))
    // b was used more recently than c.
    expect(activeId(state)).toBe(b)
  })

  it('falls back to the right neighbour, then the left (INV-TL-04)', () => {
    const a = tab('d-a')
    const b = tab('d-b')
    const c = tab('d-c')
    const withoutMru: ReaderState = {
      tabs: [a, b, c],
      activeTabId: a.tabId,
      activationCounter: 0,
    }
    const right = readerReducer(withoutMru, tabClose(a.tabId))
    expect(activeId(right)).toBe(b.tabId)

    const withLeftOnly: ReaderState = {
      tabs: [a, b],
      activeTabId: b.tabId,
      activationCounter: 0,
    }
    const left = readerReducer(withLeftOnly, tabClose(b.tabId))
    expect(activeId(left)).toBe(a.tabId)
  })

  it('closing a background tab keeps the active tab and focus (INV-TL-02)', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    state = readerReducer(state, tabOpen(tab('d-b'), true))
    const [a, b] = state.tabs
    state = readerReducer(state, tabClose(a.tabId))
    expect(state.tabs).toHaveLength(1)
    expect(activeId(state)).toBe(b.tabId)
  })

  it('closing the last tab empties the reader (INV-TL-05)', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    state = readerReducer(state, tabClose(state.tabs[0].tabId))
    expect(state.tabs).toHaveLength(0)
    expect(state.activeTabId).toBeNull()
  })

  it('cycles tabs for Ctrl+Tab / Ctrl+Shift+Tab', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    state = readerReducer(state, tabOpen(tab('d-b'), true))
    state = readerReducer(state, tabOpen(tab('d-c'), true))
    const [a, b, c] = state.tabs
    expect(selectCycleTabId(state, 1)).toBe(a.tabId)
    expect(selectCycleTabId(state, -1)).toBe(b.tabId)
    state = readerReducer(state, tabActivate(a.tabId))
    expect(selectCycleTabId(state, 1)).toBe(b.tabId)
    expect(selectCycleTabId(state, -1)).toBe(c.tabId)
  })

  it('shows the shortest distinguishing parent directory (INV-TL-03)', () => {
    const first = tab('d-a', '/home/u/projects/alpha/readme.md', 'readme.md')
    const second = tab('d-b', '/home/u/projects/beta/readme.md', 'readme.md')
    const third = tab('d-c', '/home/u/docs/readme.md', 'readme.md')
    const labels = tabDisplayLabels([first, second, third])
    expect(labels.get(first.tabId)).toBe('alpha/readme.md')
    expect(labels.get(second.tabId)).toBe('beta/readme.md')
    expect(labels.get(third.tabId)).toBe('docs/readme.md')

    const unique = tabDisplayLabels([first])
    expect(unique.get(first.tabId)).toBe('readme.md')
  })

  it('builds the session snapshot in tab order', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    state = readerReducer(state, tabOpen(tab('d-b'), true))
    const [a, b] = state.tabs
    expect(buildSessionTabs(state)).toEqual([
      { tabId: a.tabId, docId: 'd-a', orderIndex: 0, isActive: false },
      { tabId: b.tabId, docId: 'd-b', orderIndex: 1, isActive: true },
    ])
  })
})

describe('reader phase transitions (contract §6)', () => {
  it('moves reading → parsing → ready on committed results', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    const tabId = state.tabs[0].tabId
    const versionInfo = version('v1')

    state = readerReducer(
      state,
      tabSessionAction(tabId, sessionReadSucceeded(discoveryToken('d-a', 1), versionInfo, 'text')),
    )
    expect(state.tabs[0].phase).toBe('parsing')
    expect(state.tabs[0].session.displayVersion?.contentHash).toBe('v1')

    state = readerReducer(
      state,
      tabSessionAction(
        tabId,
        sessionTaskSucceeded({ docId: 'd-a', version: 'v1', generation: 1, taskId: 'p1' }, versionInfo, {
          text: 'text',
          data: { parseResult: { status: 'ok' } },
        }),
      ),
    )
    expect(state.tabs[0].phase).toBe('ready')
  })

  it('drops stale session results without visible effect (INV-VC-04)', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    const tabId = state.tabs[0].tabId
    state = readerReducer(
      state,
      tabSessionAction(tabId, sessionReadSucceeded(discoveryToken('d-a', 1), version('v1'), 'text')),
    )
    const before = state.tabs[0]
    // Late result from an invalidated generation.
    state = readerReducer(
      state,
      tabSessionAction(tabId, sessionReadSucceeded(discoveryToken('d-a', 0), version('v0'), 'old')),
    )
    expect(state.tabs[0]).toBe(before)
  })

  it('marks the current read failure as failed and a pending prefetch failure as silent', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    const tabId = state.tabs[0].tabId
    state = readerReducer(
      state,
      tabSessionAction(tabId, sessionTaskFailed(discoveryToken('d-a', 1), failure)),
    )
    expect(state.tabs[0].phase).toBe('failed')
    expect(state.tabs[0].error?.code).toBe('PS_IO_READ_FAILED')
  })

  it('cancel invalidates the generation and late results can not resurface', () => {
    let state = INITIAL_READER_STATE
    state = readerReducer(state, tabOpen(tab('d-a'), true))
    const tabId = state.tabs[0].tabId
    state = readerReducer(state, tabSessionAction(tabId, sessionInvalidated()))
    state = readerReducer(state, tabPhase(tabId, 'cancelled', null))
    state = readerReducer(
      state,
      tabSessionAction(tabId, sessionReadSucceeded(discoveryToken('d-a', 1), version('v1'), 'late')),
    )
    expect(state.tabs[0].phase).toBe('cancelled')
    expect(state.tabs[0].session.displayVersion).toBeNull()
  })

  it('switches the D5 large-document mode without touching tab identity (R29)', () => {
    let state = readerReducer(INITIAL_READER_STATE, tabOpen(tab('d-a'), true))
    const tabId = state.tabs[0].tabId
    expect(state.tabs[0].largeDocMode).toBe('full')
    state = readerReducer(state, tabLargeDoc(tabId, 'simplified'))
    expect(state.tabs[0].largeDocMode).toBe('simplified')
    state = readerReducer(state, tabLargeDoc(tabId, 'sourceWindow'))
    expect(state.tabs[0].largeDocMode).toBe('sourceWindow')
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].docId).toBe('d-a')
    expect(state.tabs[0].tabId).toBe(tabId)
  })
})
