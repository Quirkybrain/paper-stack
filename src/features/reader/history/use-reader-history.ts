import { useCallback, useRef, useState } from 'react'

import {
  commitNavigation,
  createHistoryState,
  goBack,
  goForward,
  upsertSearchNavigation,
  type HistoryEntry,
  type HistoryKind,
  type HistoryState,
  type NavPoint,
} from './history'

/**
 * React binding for the per-tab navigation history (models §5; T-44).
 *
 * The state updates through a ref mirror exactly like the reader's session
 * dispatcher, so repeated Alt+←/→ in one tick observe each other. Entry ids
 * are allocated here; `search()` reuses the session's entry id so a search
 * session stays a single entry (INV-NH-05).
 */

let entrySequence = 0

function nextEntryId(): string {
  entrySequence += 1
  return `nh-${entrySequence}`
}

/** Test helper: make generated entry ids deterministic again. */
export function resetHistoryEntrySequenceForTests(): void {
  entrySequence = 0
}

export interface ReaderHistoryControls {
  state: HistoryState
  commit(tabId: string, kind: HistoryKind, from: NavPoint, to: NavPoint): HistoryEntry
  /** Merge a search-session location into its single entry (INV-NH-05). */
  search(tabId: string, entryId: string, from: NavPoint, to: NavPoint): void
  back(tabId: string): HistoryEntry | null
  forward(tabId: string): HistoryEntry | null
}

export function useReaderHistory(): ReaderHistoryControls {
  const [state, setState] = useState<HistoryState>(createHistoryState)
  const stateRef = useRef(state)
  const apply = useCallback((updater: (current: HistoryState) => HistoryState) => {
    stateRef.current = updater(stateRef.current)
    setState(stateRef.current)
  }, [])

  const commit = useCallback(
    (tabId: string, kind: HistoryKind, from: NavPoint, to: NavPoint): HistoryEntry => {
      const entry: HistoryEntry = {
        entryId: nextEntryId(),
        kind,
        from,
        to,
        committedAt: Date.now(),
      }
      apply((current) => commitNavigation(current, tabId, entry))
      return entry
    },
    [apply],
  )

  const search = useCallback(
    (tabId: string, entryId: string, from: NavPoint, to: NavPoint) => {
      const entry: HistoryEntry = {
        entryId,
        kind: 'search',
        from,
        to,
        committedAt: Date.now(),
      }
      apply((current) => upsertSearchNavigation(current, tabId, entry))
    },
    [apply],
  )

  const back = useCallback(
    (tabId: string): HistoryEntry | null => {
      const move = goBack(stateRef.current, tabId)
      if (move.entry === null) return null
      apply(() => move.state)
      return move.entry
    },
    [apply],
  )

  const forward = useCallback(
    (tabId: string): HistoryEntry | null => {
      const move = goForward(stateRef.current, tabId)
      if (move.entry === null) return null
      apply(() => move.state)
      return move.entry
    },
    [apply],
  )

  return { state, commit, search, back, forward }
}
