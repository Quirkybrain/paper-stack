import {
  createSessionState,
  selectIsDisplayPrepared,
  sessionClosed,
  sessionOpened,
  sessionReducer,
  type DocumentSessionState,
  type SessionAction,
} from '../../app/session'
import type { LargeDocMode } from '../../document/modes/modes'
import type { ErrorPayload } from '../../services/types'

/**
 * Reader tab state (ui-spec §3.2 tabs, models §7; R05; INV-TL-01..08).
 *
 * One reducer owns every open document: tab list, active tab, per-tab
 * `DocumentSessionState` (contract §6 commit rule, wp-16 `app/session`) and
 * the lightweight feature phase used for loading/error rendering. Heavy
 * artifacts stay in `documentModelCache`; state here is small and serializable
 * apart from the session reducer's model-cache side effects.
 *
 * Behavioral rules encoded here:
 * - opening a `canonicalPath` that already has a tab reuses it (INV-TL-01);
 * - closing the active tab activates MRU → right neighbour → left neighbour
 *   (INV-TL-04) and applying `session/closed` releases the tab's model cache;
 * - the last closed tab leaves the reader empty (INV-TL-05).
 */

export type ReaderPhase =
  | 'reading'
  | 'parsing'
  | 'ready'
  | 'failed'
  | 'cancelled'
  /** Open-time large-document prompt; nothing is read until the user chooses. */
  | 'largeDoc'

/** Per-tab main view (ui-spec §3.5): source view shares the display version. */
export type ReaderViewMode = 'reading' | 'source'

export interface ReaderTab {
  tabId: string
  docId: string
  canonicalPath: string
  displayName: string
  /** Monotonic activation counter; higher means more recently used (MRU). */
  lastActiveAt: number
  session: DocumentSessionState
  phase: ReaderPhase
  error: ErrorPayload | null
  /** "Later" only collapses the banner; the pending marker stays (INV-UM-05). */
  bannerCollapsed: boolean
  /** Reading or read-only source; switching never updates or adds history. */
  viewMode: ReaderViewMode
  /** D5 display mode: full / simplified / sourceWindow (models §0.2; R29). */
  largeDocMode: LargeDocMode
}

export interface ReaderState {
  tabs: ReaderTab[]
  activeTabId: string | null
  activationCounter: number
}

export const INITIAL_READER_STATE: ReaderState = {
  tabs: [],
  activeTabId: null,
  activationCounter: 0,
}

export interface NewTabInput {
  tabId: string
  docId: string
  canonicalPath: string
  displayName: string
}

export function createReaderTab(input: NewTabInput): ReaderTab {
  return {
    tabId: input.tabId,
    docId: input.docId,
    canonicalPath: input.canonicalPath,
    displayName: input.displayName,
    lastActiveAt: 0,
    session: createSessionState(input.docId),
    phase: 'reading',
    error: null,
    bannerCollapsed: false,
    viewMode: 'reading',
    largeDocMode: 'full',
  }
}

export type ReaderAction =
  | { type: 'tab/open'; tab: ReaderTab; activate: boolean }
  | { type: 'tab/activate'; tabId: string }
  | { type: 'tab/close'; tabId: string }
  | { type: 'tab/session'; tabId: string; action: SessionAction }
  | { type: 'tab/phase'; tabId: string; phase: ReaderPhase; error?: ErrorPayload | null }
  | { type: 'tab/banner'; tabId: string; collapsed: boolean }
  | { type: 'tab/view'; tabId: string; mode: ReaderViewMode }
  | { type: 'tab/largeDoc'; tabId: string; mode: LargeDocMode }
  | {
      type: 'tab/docReplace'
      tabId: string
      docId: string
      canonicalPath: string
      displayName: string
    }

export const tabOpen = (tab: ReaderTab, activate: boolean): ReaderAction => ({
  type: 'tab/open',
  tab,
  activate,
})

export const tabActivate = (tabId: string): ReaderAction => ({ type: 'tab/activate', tabId })

export const tabClose = (tabId: string): ReaderAction => ({ type: 'tab/close', tabId })

export const tabSessionAction = (tabId: string, action: SessionAction): ReaderAction => ({
  type: 'tab/session',
  tabId,
  action,
})

export const tabPhase = (
  tabId: string,
  phase: ReaderPhase,
  error?: ErrorPayload | null,
): ReaderAction => ({
  type: 'tab/phase',
  tabId,
  phase,
  ...(error === undefined ? {} : { error }),
})

export const tabBanner = (tabId: string, collapsed: boolean): ReaderAction => ({
  type: 'tab/banner',
  tabId,
  collapsed,
})

export const tabView = (tabId: string, mode: ReaderViewMode): ReaderAction => ({
  type: 'tab/view',
  tabId,
  mode,
})

export const tabLargeDoc = (tabId: string, mode: LargeDocMode): ReaderAction => ({
  type: 'tab/largeDoc',
  tabId,
  mode,
})

/**
 * Current-tab document navigation (models §5.2 "跨文档相对链接：默认当前标签
 * 导航"): the tab keeps its identity and activation order but displays the
 * target document. `session/opened` advances the generation so the previous
 * document's late tasks cannot commit (contract §6).
 */
export const tabDocReplace = (
  tabId: string,
  target: { docId: string; canonicalPath: string; displayName: string },
): ReaderAction => ({
  type: 'tab/docReplace',
  tabId,
  ...target,
})

function activateTab(state: ReaderState, tabId: string): ReaderState {
  const counter = state.activationCounter + 1
  return {
    ...state,
    activationCounter: counter,
    activeTabId: tabId,
    tabs: state.tabs.map((tab) =>
      tab.tabId === tabId ? { ...tab, lastActiveAt: counter } : tab,
    ),
  }
}

/** Phase transition driven by a commit-rule session result (contract §6). */
function phaseAfterSession(
  tab: ReaderTab,
  nextSession: DocumentSessionState,
  action: SessionAction,
): { phase: ReaderPhase; error: ErrorPayload | null } {
  const changed = nextSession !== tab.session
  switch (action.type) {
    case 'session/readSucceeded':
      // Initial reads move into parsing; refresh reads may only set/clear the
      // pending candidate and must not disturb a ready tab.
      return changed && tab.phase === 'reading'
        ? { phase: 'parsing', error: null }
        : { phase: tab.phase, error: tab.error }
    case 'session/taskSucceeded':
      if (
        changed &&
        selectIsDisplayPrepared(nextSession) &&
        nextSession.displayVersion?.contentHash === action.token.version
      ) {
        return { phase: 'ready', error: null }
      }
      return { phase: tab.phase, error: tab.error }
    case 'session/taskFailed':
      // Stale/pending-prefetch failures leave the session reference unchanged.
      return changed ? { phase: 'failed', error: action.error } : { phase: tab.phase, error: tab.error }
    case 'session/displayReplaced':
      return { phase: 'parsing', error: null }
    case 'session/unavailable':
      return { phase: tab.phase, error: tab.error }
    default:
      return { phase: tab.phase, error: tab.error }
  }
}

function closeTab(state: ReaderState, tabId: string): ReaderState {
  const index = state.tabs.findIndex((tab) => tab.tabId === tabId)
  if (index === -1) return state
  const closed = state.tabs[index]
  // Release heavy artifacts immediately; late results cannot rebuild the tab
  // because the session generation advances in `session/closed` (INV-TL-06).
  sessionReducer(closed.session, sessionClosed())
  const remaining = state.tabs.filter((tab) => tab.tabId !== tabId)

  if (state.activeTabId !== tabId) {
    return { ...state, tabs: remaining }
  }

  let nextActive: ReaderTab | undefined
  if (remaining.length > 0) {
    // MRU first (INV-TL-04), then right neighbour, then left neighbour.
    nextActive = remaining.reduce((best, tab) =>
      tab.lastActiveAt > best.lastActiveAt ? tab : best,
    )
    if (nextActive.lastActiveAt === 0) {
      nextActive = remaining[Math.min(index, remaining.length - 1)]
    }
  }

  const nextState: ReaderState = { ...state, tabs: remaining, activeTabId: null }
  return nextActive ? activateTab(nextState, nextActive.tabId) : nextState
}

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'tab/open': {
      const existing = state.tabs.find((tab) => tab.docId === action.tab.docId)
      if (existing) {
        return action.activate ? activateTab(state, existing.tabId) : state
      }
      const withTab: ReaderState = { ...state, tabs: [...state.tabs, action.tab] }
      if (action.activate || withTab.activeTabId === null) {
        return activateTab(withTab, action.tab.tabId)
      }
      return withTab
    }

    case 'tab/activate': {
      if (!state.tabs.some((tab) => tab.tabId === action.tabId)) return state
      return state.activeTabId === action.tabId ? state : activateTab(state, action.tabId)
    }

    case 'tab/close':
      return closeTab(state, action.tabId)

    case 'tab/session': {
      const tab = state.tabs.find((candidate) => candidate.tabId === action.tabId)
      if (!tab) return state
      const nextSession = sessionReducer(tab.session, action.action)
      const { phase, error } = phaseAfterSession(tab, nextSession, action.action)
      if (nextSession === tab.session && phase === tab.phase && error === tab.error) return state
      return {
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.tabId === action.tabId ? { ...candidate, session: nextSession, phase, error } : candidate,
        ),
      }
    }

    case 'tab/phase': {
      const tab = state.tabs.find((candidate) => candidate.tabId === action.tabId)
      if (!tab) return state
      const error = action.error === undefined ? tab.error : action.error
      if (tab.phase === action.phase && tab.error === error) return state
      return {
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.tabId === action.tabId ? { ...candidate, phase: action.phase, error } : candidate,
        ),
      }
    }

    case 'tab/banner': {
      const tab = state.tabs.find((candidate) => candidate.tabId === action.tabId)
      if (!tab || tab.bannerCollapsed === action.collapsed) return state
      return {
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.tabId === action.tabId ? { ...candidate, bannerCollapsed: action.collapsed } : candidate,
        ),
      }
    }

    case 'tab/view': {
      const tab = state.tabs.find((candidate) => candidate.tabId === action.tabId)
      if (!tab || tab.viewMode === action.mode) return state
      return {
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.tabId === action.tabId ? { ...candidate, viewMode: action.mode } : candidate,
        ),
      }
    }

    case 'tab/largeDoc': {
      const tab = state.tabs.find((candidate) => candidate.tabId === action.tabId)
      if (!tab || tab.largeDocMode === action.mode) return state
      return {
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.tabId === action.tabId
            ? { ...candidate, largeDocMode: action.mode }
            : candidate,
        ),
      }
    }

    case 'tab/docReplace': {
      const tab = state.tabs.find((candidate) => candidate.tabId === action.tabId)
      if (!tab || tab.docId === action.docId) return state
      const session = sessionReducer(tab.session, sessionOpened(action.docId))
      return {
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.tabId === action.tabId
            ? {
                ...candidate,
                docId: action.docId,
                canonicalPath: action.canonicalPath,
                displayName: action.displayName,
                session,
                phase: 'reading',
                error: null,
                bannerCollapsed: false,
                viewMode: 'reading',
                largeDocMode: 'full',
              }
            : candidate,
        ),
      }
    }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Selectors and pure helpers
// ---------------------------------------------------------------------------

export function selectActiveTab(state: ReaderState): ReaderTab | null {
  return state.tabs.find((tab) => tab.tabId === state.activeTabId) ?? null
}

export function selectTabByDocId(state: ReaderState, docId: string): ReaderTab | null {
  return state.tabs.find((tab) => tab.docId === docId) ?? null
}

export function selectTabByCanonicalPath(state: ReaderState, path: string): ReaderTab | null {
  return state.tabs.find((tab) => tab.canonicalPath === path) ?? null
}

/** Ctrl+Tab / Ctrl+Shift+Tab cycling over the visual tab order. */
export function selectCycleTabId(state: ReaderState, delta: number): string | null {
  if (state.tabs.length === 0) return null
  const index = state.tabs.findIndex((tab) => tab.tabId === state.activeTabId)
  const next = (index + delta + state.tabs.length) % state.tabs.length
  return state.tabs[next]?.tabId ?? null
}

/**
 * Labels for the tab bar: first-screen names, with the shortest
 * distinguishing parent directory when display names collide (INV-TL-03).
 */
export function tabDisplayLabels(tabs: readonly ReaderTab[]): Map<string, string> {
  const labels = new Map<string, string>()
  const byName = new Map<string, ReaderTab[]>()
  for (const tab of tabs) {
    const group = byName.get(tab.displayName) ?? []
    group.push(tab)
    byName.set(tab.displayName, group)
  }
  for (const group of byName.values()) {
    if (group.length === 1) {
      labels.set(group[0].tabId, group[0].displayName)
      continue
    }
    const segments = group.map((tab) => tab.canonicalPath.split('/').filter(Boolean))
    group.forEach((tab, index) => {
      const own = segments[index]
      for (let depth = 1; depth <= own.length - 1; depth += 1) {
        const candidate = own.slice(own.length - depth - 1).join('/')
        const unique = group.every(
          (_other, otherIndex) =>
            otherIndex === index ||
            segments[otherIndex].slice(segments[otherIndex].length - depth - 1).join('/') !==
              candidate,
        )
        if (unique) {
          labels.set(tab.tabId, candidate)
          return
        }
      }
      labels.set(tab.tabId, tab.canonicalPath || tab.displayName)
    })
  }
  return labels
}

/** Session snapshot for `storage.saveSession` (contract §3.4). */
export function buildSessionTabs(state: ReaderState) {
  return state.tabs.map((tab, index) => ({
    tabId: tab.tabId,
    docId: tab.docId,
    orderIndex: index,
    isActive: tab.tabId === state.activeTabId,
  }))
}
