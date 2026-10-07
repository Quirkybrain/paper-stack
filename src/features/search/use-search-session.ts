import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import type { SearchSegment } from '../../document/types'
import { PaperStackError } from '../../services/invoke'
import type { SourceSearchResult } from '../../services/types'
import {
  findBodyHits,
  findSourceHits,
  sourceHitsFromResult,
  type SearchHit,
  type SearchScope,
} from './search-core'

/**
 * Per-tab search session (ui-spec §3.4; models §5.2; T-42, R17).
 *
 * State lives in a module-level store keyed by tab so switching tabs keeps
 * each tab's query, scope and result state without touching the new tab's
 * focus (EDGE-07) — it is memory-only and never written to disk (R20).
 *
 * Rules encoded here:
 * - IME composition gates commits: while composing, query/count updates and
 *   Enter navigation are suspended (EDGE-04);
 * - changes are debounced (150ms initial per ADR-007) and every new batch
 *   invalidates the previous one, so old counts can never flash back;
 * - three states are distinct: `indexing` / `results` / `noResults`;
 * - Enter with nothing selected jumps to the first hit, Shift+Enter to the
 *   last; once selected they move next/previous and wrap with a notice
 *   (EDGE-05);
 * - a >50MiB source scan may return `complete=false`; that is surfaced as
 *   "结果未完成" and never presented as a complete count (R29; IX15);
 * - Esc/close keeps the last selection and query for the next open
 *   (ui-spec §3.4 "会话与返回").
 */

export type SearchSessionStatus = 'idle' | 'indexing' | 'results' | 'noResults'

export interface SearchSessionState {
  open: boolean
  /** Committed query (never updated mid-composition). */
  query: string
  scope: SearchScope
  caseSensitive: boolean
  status: SearchSessionStatus
  matches: SearchHit[]
  /** 1-based index of the selected hit; 0 = nothing selected yet ("0/N"). */
  current: number
  /** Transient message key (wrap-around, cancelled, incomplete). */
  noticeKey: string | null
  /** Source scope only: the scan result was incomplete (budget/cancel). */
  incomplete: boolean
  /** Identity of one open→close session; search history merges per session. */
  sessionId: string
  /** Increments on every open/Ctrl+F so the input refocuses and reselects. */
  focusRequest: number
}

const SEARCH_DEBOUNCE_MS = 150

function createDefaultState(): SearchSessionState {
  return {
    open: false,
    query: '',
    scope: 'body',
    caseSensitive: false,
    status: 'idle',
    matches: [],
    current: 0,
    noticeKey: null,
    incomplete: false,
    sessionId: '',
    focusRequest: 0,
  }
}

const EMPTY_SNAPSHOT = createDefaultState()

const sessions = new Map<string, SearchSessionState>()
const listeners = new Map<string, Set<() => void>>()
let sessionSequence = 0

function ensureState(tabId: string): SearchSessionState {
  let state = sessions.get(tabId)
  if (state === undefined) {
    state = createDefaultState()
    sessions.set(tabId, state)
  }
  return state
}

function setState(
  tabId: string,
  updater: (state: SearchSessionState) => SearchSessionState,
): void {
  const previous = ensureState(tabId)
  const next = updater(previous)
  if (next === previous) return
  sessions.set(tabId, next)
  for (const listener of listeners.get(tabId) ?? []) listener()
}

/** Ctrl+F / toolbar entry: opens and asks the input to focus + select. */
export function openSearchSession(tabId: string): void {
  setState(tabId, (state) => {
    // Reopening (Ctrl+F while open) keeps the session identity so the search
    // history stays a single entry for this open period.
    const sessionId = state.open
      ? state.sessionId
      : `search-session-${(sessionSequence += 1)}`
    return {
      ...state,
      open: true,
      sessionId,
      noticeKey: null,
      focusRequest: state.focusRequest + 1,
    }
  })
}

export function closeSearchSession(tabId: string): void {
  setState(tabId, (state) => (state.open ? { ...state, open: false } : state))
}

export function readSearchSession(tabId: string): SearchSessionState {
  return ensureState(tabId)
}

export function subscribeSearchSession(tabId: string, listener: () => void): () => void {
  let set = listeners.get(tabId)
  if (set === undefined) {
    set = new Set()
    listeners.set(tabId, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

/** Test helper: drop all per-tab memory and reset session identity. */
export function resetSearchSessionsForTests(): void {
  sessions.clear()
  listeners.clear()
  sessionSequence = 0
}

export interface SearchLocateContext {
  sessionId: string
  /** True when this locate is the first explicit selection of the session. */
  first: boolean
}

export interface UseSearchSessionOptions {
  tabId: string | null
  /** Segments of the active tab's display version (body scope). */
  segments: readonly SearchSegment[]
  /** Decoded raw text of the display version (source scope); null when windowed. */
  rawText: string | null
  /** True while the document's index is not ready (parse pending). */
  indexing: boolean
  /**
   * >50MiB source-window search (contract §8 command 38). When absent the
   * source scope scans `rawText` in memory.
   */
  sourceSearch?: (query: string, caseSensitive: boolean) => Promise<SourceSearchResult>
  onLocate(hit: SearchHit, context: SearchLocateContext): void
  /** Debounce override for tests; production default is 150ms. */
  debounceMs?: number
}

export interface SearchSessionControls {
  state: SearchSessionState
  open(): void
  compositionStart(): void
  compositionEnd(): void
  setQuery(value: string): void
  setScope(scope: SearchScope): void
  setCaseSensitive(value: boolean): void
  next(): void
  prev(): void
  /** 0-based result-list click. */
  activate(index: number): void
  currentHit(): SearchHit | null
  close(): void
}

function sameTarget(
  state: SearchSessionState,
  query: string,
  scope: SearchScope,
  caseSensitive: boolean,
): boolean {
  return (
    state.query === query && state.scope === scope && state.caseSensitive === caseSensitive
  )
}

export function useSearchSession(options: UseSearchSessionOptions): SearchSessionControls {
  const { tabId, segments, rawText, indexing, debounceMs = SEARCH_DEBOUNCE_MS } = options

  const subscribe = useCallback(
    (listener: () => void) => (tabId === null ? () => undefined : subscribeSearchSession(tabId, listener)),
    [tabId],
  )
  const getSnapshot = useCallback(
    () => (tabId === null ? EMPTY_SNAPSHOT : ensureState(tabId)),
    [tabId],
  )
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const composingRef = useRef(false)
  const runIdRef = useRef(0)
  const onLocateRef = useRef(options.onLocate)
  const sourceSearchRef = useRef(options.sourceSearch)
  const dataRef = useRef({ segments, rawText })

  // Keep the async callbacks/data reachable without retriggering debounce
  // timers on every render. Declared before the search effect so it sees the
  // current values when the timer fires.
  useEffect(() => {
    onLocateRef.current = options.onLocate
    sourceSearchRef.current = options.sourceSearch
    dataRef.current = { segments, rawText }
  })

  const applyResults = useCallback(
    (
      runId: number,
      query: string,
      scope: SearchScope,
      caseSensitive: boolean,
      matches: SearchHit[],
      noticeKey: string | null,
    ) => {
      if (runId !== runIdRef.current) return
      setState(tabId as string, (current) => {
        if (!sameTarget(current, query, scope, caseSensitive)) return current
        return {
          ...current,
          status: matches.length > 0 ? 'results' : 'noResults',
          matches,
          current: Math.min(current.current, matches.length),
          noticeKey,
          incomplete: noticeKey === 'search.incomplete',
        }
      })
    },
    [tabId],
  )

  const run = useCallback(
    async (runId: number, query: string, scope: SearchScope, caseSensitive: boolean) => {
      const source = sourceSearchRef.current
      if (scope === 'source') {
        if (source) {
          try {
            const result = await source(query, caseSensitive)
            if (runId !== runIdRef.current) return
            applyResults(
              runId,
              query,
              scope,
              caseSensitive,
              sourceHitsFromResult(result.matches),
              result.complete ? null : 'search.incomplete',
            )
          } catch (error) {
            if (runId !== runIdRef.current) return
            const stackError = PaperStackError.is(error) ? error : null
            const noticeKey = stackError?.isCancelled
              ? 'search.cancelled'
              : stackError?.code === 'PS_LIMIT_SEARCH'
                ? 'search.incomplete'
                : (stackError?.messageKey ?? 'search.incomplete')
            setState(tabId as string, (current) => ({
              ...current,
              noticeKey,
              incomplete: noticeKey === 'search.incomplete',
            }))
          }
          return
        }
        const text = dataRef.current.rawText
        if (text === null) {
          setState(tabId as string, (current) => ({ ...current, status: 'indexing' }))
          return
        }
        applyResults(runId, query, scope, caseSensitive, findSourceHits(text, query, caseSensitive), null)
        return
      }
      applyResults(
        runId,
        query,
        scope,
        caseSensitive,
        findBodyHits(dataRef.current.segments, query, caseSensitive),
        null,
      )
    },
    [applyResults, tabId],
  )

  useEffect(() => {
    if (tabId === null || !state.open) return undefined
    const runId = ++runIdRef.current
    if (state.query.length === 0) {
      setState(tabId, (current) =>
        current.status === 'idle' &&
        current.matches.length === 0 &&
        current.current === 0 &&
        current.noticeKey === null &&
        !current.incomplete
          ? current
          : {
              ...current,
              status: 'idle',
              matches: [],
              current: 0,
              noticeKey: null,
              incomplete: false,
            },
      )
      return undefined
    }
    if (indexing) {
      setState(tabId, (current) =>
        current.status === 'indexing' && current.noticeKey === null
          ? current
          : { ...current, status: 'indexing', noticeKey: null, incomplete: false },
      )
      return undefined
    }
    const timer = setTimeout(() => {
      void run(runId, state.query, state.scope, state.caseSensitive)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [
    tabId,
    state.open,
    state.query,
    state.scope,
    state.caseSensitive,
    indexing,
    segments,
    rawText,
    debounceMs,
    run,
  ])

  const setQuery = useCallback(
    (value: string) => {
      if (tabId === null) return
      runIdRef.current += 1
      setState(tabId, (current) => {
        if (current.query === value) return current
        return {
          ...current,
          query: value,
          status: value.length > 0 ? 'indexing' : 'idle',
          matches: [],
          current: 0,
          noticeKey: null,
          incomplete: false,
        }
      })
    },
    [tabId],
  )

  const setScope = useCallback(
    (scope: SearchScope) => {
      if (tabId === null) return
      runIdRef.current += 1
      setState(tabId, (current) => {
        if (current.scope === scope) return current
        return {
          ...current,
          scope,
          status: current.query.length > 0 ? 'indexing' : 'idle',
          matches: [],
          current: 0,
          noticeKey: null,
          incomplete: false,
        }
      })
    },
    [tabId],
  )

  const setCaseSensitive = useCallback(
    (value: boolean) => {
      if (tabId === null) return
      runIdRef.current += 1
      setState(tabId, (current) => {
        if (current.caseSensitive === value) return current
        return {
          ...current,
          caseSensitive: value,
          status: current.query.length > 0 ? 'indexing' : 'idle',
          matches: [],
          current: 0,
          noticeKey: null,
          incomplete: false,
        }
      })
    },
    [tabId],
  )

  const select = useCallback(
    (hit: SearchHit, current: number, noticeKey: string | null, first: boolean, sessionId: string) => {
      setState(tabId as string, (state) => ({ ...state, current, noticeKey }))
      onLocateRef.current(hit, { sessionId, first })
    },
    [tabId],
  )

  const move = useCallback(
    (direction: 1 | -1) => {
      if (tabId === null || composingRef.current) return
      const current = ensureState(tabId)
      if (current.matches.length === 0 || current.status === 'idle') return
      let next = current.current
      let noticeKey: string | null = null
      if (current.current === 0) {
        next = direction === 1 ? 1 : current.matches.length
      } else if (direction === 1) {
        if (current.current >= current.matches.length) {
          next = 1
          noticeKey = 'search.wrapped.first'
        } else {
          next = current.current + 1
        }
      } else {
        if (current.current <= 1) {
          next = current.matches.length
          noticeKey = 'search.wrapped.last'
        } else {
          next = current.current - 1
        }
      }
      const hit = current.matches[next - 1]
      if (hit === undefined) return
      select(hit, next, noticeKey, current.current === 0, current.sessionId)
    },
    [select, tabId],
  )

  const next = useCallback(() => move(1), [move])
  const prev = useCallback(() => move(-1), [move])

  const activate = useCallback(
    (index: number) => {
      if (tabId === null) return
      const current = ensureState(tabId)
      const hit = current.matches[index]
      if (hit === undefined) return
      select(hit, index + 1, null, current.current === 0, current.sessionId)
    },
    [select, tabId],
  )

  const currentHit = useCallback((): SearchHit | null => {
    if (tabId === null) return null
    const current = ensureState(tabId)
    return current.matches[current.current - 1] ?? null
  }, [tabId])

  const close = useCallback(() => {
    if (tabId === null) return
    closeSearchSession(tabId)
  }, [tabId])

  const open = useCallback(() => {
    if (tabId === null) return
    openSearchSession(tabId)
  }, [tabId])

  const compositionStart = useCallback(() => {
    composingRef.current = true
  }, [])

  const compositionEnd = useCallback(() => {
    composingRef.current = false
  }, [])

  return {
    state,
    open,
    compositionStart,
    compositionEnd,
    setQuery,
    setScope,
    setCaseSensitive,
    next,
    prev,
    activate,
    currentHit,
    close,
  }
}
