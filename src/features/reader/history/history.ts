/**
 * Per-tab navigation history (models §5; ui-spec §3.4/§6.1; T-44, R16;
 * INV-NH-01..08).
 *
 * This is an internal, memory-only model ("非 IPC", models §0.2 naming
 * discipline): each tab owns an independent `back`/`forward` pair of stacks.
 * An entry captures the source position before a navigation (`from`) and the
 * target after it (`to`). Only explicit navigations create entries — scroll,
 * theme/settings changes, tab switches, the source-view toggle and update
 * commits never reach this module (INV-NH-03).
 *
 * Search sessions merge: while one search session is active its entry's `to`
 * is updated by `upsertSearchNavigation` instead of appending a second entry
 * (INV-NH-05). Any new navigation clears `forward` (INV-NH-04) — including a
 * merged search update, because it still is a new user navigation.
 */

export type HistoryKind = 'outline' | 'footnote' | 'fragment' | 'document-link' | 'search'

/**
 * A restorable position. `blockId` locates a reading block, `anchorId` a
 * heading anchor, `sourceByte` a decoded-source offset (source scope); all
 * three may be `null` for the document top.
 */
export interface NavPoint {
  docId: string
  canonicalPath: string
  blockId: string | null
  anchorId: string | null
  sourceByte: number | null
}

export interface HistoryEntry {
  entryId: string
  kind: HistoryKind
  from: NavPoint
  to: NavPoint
  committedAt: number
}

export interface TabHistory {
  back: HistoryEntry[]
  forward: HistoryEntry[]
}

export type HistoryState = Record<string, TabHistory>

/**
 * Per-tab capacity (models §5.4 P-01, a pending parameter; the suggested 100
 * is used as an internal bound until the value is confirmed). The oldest
 * entry is dropped when the limit is exceeded.
 */
export const HISTORY_LIMIT = 100

const EMPTY_TAB: TabHistory = { back: [], forward: [] }

export function createHistoryState(): HistoryState {
  return {}
}

export function selectTabHistory(state: HistoryState, tabId: string): TabHistory {
  return state[tabId] ?? EMPTY_TAB
}

export function canGoBack(state: HistoryState, tabId: string): boolean {
  return selectTabHistory(state, tabId).back.length > 0
}

export function canGoForward(state: HistoryState, tabId: string): boolean {
  return selectTabHistory(state, tabId).forward.length > 0
}

function capped(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.length > HISTORY_LIMIT ? entries.slice(entries.length - HISTORY_LIMIT) : entries
}

function writeTab(state: HistoryState, tabId: string, tab: TabHistory): HistoryState {
  return { ...state, [tabId]: tab }
}

/**
 * Commits one successful navigation (INV-NH-02). Failures and cancellations
 * never call this; a rejected navigation must not change `from` or create an
 * entry. Any commit clears the forward branch (INV-NH-04).
 */
export function commitNavigation(
  state: HistoryState,
  tabId: string,
  entry: HistoryEntry,
): HistoryState {
  const tab = selectTabHistory(state, tabId)
  return writeTab(state, tabId, {
    back: capped([...tab.back, entry]),
    forward: [],
  })
}

/**
 * Search-session merge (INV-NH-05): when the session's entry still exists in
 * `back`, its `to` is replaced by the final target and it stays a single
 * entry. If the entry was removed (for example a back moved it to `forward`,
 * which a new navigation clears), a fresh entry is pushed for the new
 * position — the session can never leave more than one entry at a time.
 */
export function upsertSearchNavigation(
  state: HistoryState,
  tabId: string,
  entry: HistoryEntry,
): HistoryState {
  const tab = selectTabHistory(state, tabId)
  const index = tab.back.findIndex((candidate) => candidate.entryId === entry.entryId)
  if (index === -1) return commitNavigation(state, tabId, entry)

  const updated: HistoryEntry = { ...tab.back[index], to: entry.to, committedAt: entry.committedAt }
  const back = [...tab.back.slice(0, index), ...tab.back.slice(index + 1), updated]
  return writeTab(state, tabId, { back: capped(back), forward: [] })
}

export interface HistoryMove {
  state: HistoryState
  entry: HistoryEntry | null
}

/**
 * Back: the most recent entry moves to `forward` and the caller restores its
 * `from` position. Back itself never clears `forward` (INV-NH-04).
 */
export function goBack(state: HistoryState, tabId: string): HistoryMove {
  const tab = selectTabHistory(state, tabId)
  if (tab.back.length === 0) return { state, entry: null }
  const entry = tab.back[tab.back.length - 1]
  return {
    state: writeTab(state, tabId, {
      back: tab.back.slice(0, -1),
      forward: [...tab.forward, entry],
    }),
    entry,
  }
}

/**
 * Forward: the most recent `forward` entry returns to `back` and the caller
 * restores its `to` position.
 */
export function goForward(state: HistoryState, tabId: string): HistoryMove {
  const tab = selectTabHistory(state, tabId)
  if (tab.forward.length === 0) return { state, entry: null }
  const entry = tab.forward[tab.forward.length - 1]
  return {
    state: writeTab(state, tabId, {
      back: capped([...tab.back, entry]),
      forward: tab.forward.slice(0, -1),
    }),
    entry,
  }
}

/** Position restore outcome (models §6.3): only a found anchor is exact. */
export type RestoreOutcome = 'exact' | 'approx'

export function restoreMessageKey(outcome: RestoreOutcome): string {
  return outcome === 'exact' ? 'nav.return.exact' : 'nav.return.approx'
}
