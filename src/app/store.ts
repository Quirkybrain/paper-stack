import {
  createContext,
  createElement,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'

import type { GlobalSettings, RecentEntry } from '../services/types'

/**
 * Global application store (ADR-003 option C; ui-spec §2.1 `AppStore`).
 *
 * Holds the small, cohesive cross-tab state: settings snapshot, recents,
 * the exclusive auxiliary panel slot, the modal overlay stack and the toast
 * queue. Per-tab document session state lives in `src/app/session.ts`.
 * `useReducer + Context` only; no external state framework (ADR-003).
 */

/** One auxiliary area at a time: files/outline share a spot; inspect is exclusive too. */
export type PanelKind = 'files' | 'outline' | 'inspect'

export type ToastTone = 'success' | 'error'

export interface ToastEntry {
  id: string
  tone: ToastTone
  /** i18n key; resolved with `t()` at render time (no hardcoded strings). */
  messageKey: string
  params?: Record<string, string | number>
  /** Errors persist until dismissed; success toasts auto-dismiss (~1.5s). */
  persistent: boolean
}

/** App-level modal descriptor; feature screens own the concrete content. */
export interface OverlayEntry {
  id: string
  kind: string
}

export interface AppState {
  settings: GlobalSettings | null
  settingsRevision: number | null
  recents: RecentEntry[]
  recentsLoaded: boolean
  activePanel: PanelKind | null
  /** Modal stack; the last entry is the top-most dialog. */
  overlays: OverlayEntry[]
  toasts: ToastEntry[]
}

export const INITIAL_APP_STATE: AppState = {
  settings: null,
  settingsRevision: null,
  recents: [],
  recentsLoaded: false,
  activePanel: null,
  overlays: [],
  toasts: [],
}

export type AppAction =
  | { type: 'settings/loaded'; settings: GlobalSettings; revision: number }
  | { type: 'settings/updated'; settings: GlobalSettings; revision: number }
  | { type: 'recents/loaded'; entries: RecentEntry[] }
  | { type: 'recents/touched'; entry: RecentEntry }
  | { type: 'recents/removed'; docId: string }
  | { type: 'panel/toggled'; panel: PanelKind }
  | { type: 'panel/closed' }
  | { type: 'overlay/pushed'; entry: OverlayEntry }
  | { type: 'overlay/popped'; id?: string }
  | { type: 'toast/pushed'; toast: ToastEntry }
  | { type: 'toast/dismissed'; id: string }
  | { type: 'toasts/cleared' }

let toastSequence = 0
let overlaySequence = 0

export function nextToastId(): string {
  toastSequence += 1
  return `toast-${toastSequence}`
}

export function nextOverlayId(): string {
  overlaySequence += 1
  return `overlay-${overlaySequence}`
}

// Action creators used by features and the (later) service bridge.

export const settingsLoaded = (settings: GlobalSettings, revision: number): AppAction => ({
  type: 'settings/loaded',
  settings,
  revision,
})

export const settingsUpdated = (settings: GlobalSettings, revision: number): AppAction => ({
  type: 'settings/updated',
  settings,
  revision,
})

export const recentsLoaded = (entries: RecentEntry[]): AppAction => ({
  type: 'recents/loaded',
  entries,
})

export const recentTouched = (entry: RecentEntry): AppAction => ({
  type: 'recents/touched',
  entry,
})

export const recentRemoved = (docId: string): AppAction => ({
  type: 'recents/removed',
  docId,
})

export const panelToggled = (panel: PanelKind): AppAction => ({ type: 'panel/toggled', panel })

export const panelClosed = (): AppAction => ({ type: 'panel/closed' })

export const overlayPushed = (kind: string, id = nextOverlayId()): AppAction => ({
  type: 'overlay/pushed',
  entry: { id, kind },
})

export const overlayPopped = (id?: string): AppAction => ({
  type: 'overlay/popped',
  ...(id === undefined ? {} : { id }),
})

export function createToast(
  tone: ToastTone,
  messageKey: string,
  params?: Record<string, string | number>,
): ToastEntry {
  return {
    id: nextToastId(),
    tone,
    messageKey,
    ...(params === undefined ? {} : { params }),
    persistent: tone === 'error',
  }
}

export const toastPushed = (toast: ToastEntry): AppAction => ({ type: 'toast/pushed', toast })

export const toastDismissed = (id: string): AppAction => ({ type: 'toast/dismissed', id })

export const toastsCleared = (): AppAction => ({ type: 'toasts/cleared' })

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'settings/loaded':
      return { ...state, settings: action.settings, settingsRevision: action.revision }

    case 'settings/updated':
      return { ...state, settings: action.settings, settingsRevision: action.revision }

    case 'recents/loaded':
      return { ...state, recents: [...action.entries], recentsLoaded: true }

    case 'recents/touched': {
      const rest = state.recents.filter((entry) => entry.docId !== action.entry.docId)
      return { ...state, recents: [action.entry, ...rest], recentsLoaded: true }
    }

    case 'recents/removed': {
      const recents = state.recents.filter((entry) => entry.docId !== action.docId)
      return recents.length === state.recents.length ? state : { ...state, recents }
    }

    case 'panel/toggled':
      return { ...state, activePanel: state.activePanel === action.panel ? null : action.panel }

    case 'panel/closed':
      return state.activePanel === null ? state : { ...state, activePanel: null }

    case 'overlay/pushed':
      return { ...state, overlays: [...state.overlays, action.entry] }

    case 'overlay/popped': {
      if (state.overlays.length === 0) return state
      if (action.id === undefined) {
        return { ...state, overlays: state.overlays.slice(0, -1) }
      }
      const overlays = state.overlays.filter((entry) => entry.id !== action.id)
      return overlays.length === state.overlays.length ? state : { ...state, overlays }
    }

    case 'toast/pushed':
      return { ...state, toasts: [...state.toasts, action.toast] }

    case 'toast/dismissed': {
      const toasts = state.toasts.filter((toast) => toast.id !== action.id)
      return toasts.length === state.toasts.length ? state : { ...state, toasts }
    }

    case 'toasts/cleared':
      return state.toasts.length === 0 ? state : { ...state, toasts: [] }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSettings = (state: AppState): GlobalSettings | null => state.settings

export const selectSettingsRevision = (state: AppState): number | null => state.settingsRevision

export const selectRecents = (state: AppState): RecentEntry[] => state.recents

export const selectRecentsLoaded = (state: AppState): boolean => state.recentsLoaded

export const selectActivePanel = (state: AppState): PanelKind | null => state.activePanel

export const selectOverlays = (state: AppState): OverlayEntry[] => state.overlays

export const selectTopOverlay = (state: AppState): OverlayEntry | null =>
  state.overlays.length === 0 ? null : state.overlays[state.overlays.length - 1]

export const selectToasts = (state: AppState): ToastEntry[] => state.toasts

// ---------------------------------------------------------------------------
// Context provider and hooks
// ---------------------------------------------------------------------------

const AppStateContext = createContext<AppState | null>(null)
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null)

export interface AppStoreProviderProps {
  children: ReactNode
  initialState?: AppState
}

export function AppStoreProvider({ children, initialState }: AppStoreProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState ?? INITIAL_APP_STATE)
  return createElement(
    AppStateContext.Provider,
    { value: state },
    createElement(AppDispatchContext.Provider, { value: dispatch }, children),
  )
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext)
  if (state === null) {
    throw new Error('useAppState must be used inside AppStoreProvider')
  }
  return state
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(AppDispatchContext)
  if (dispatch === null) {
    throw new Error('useAppDispatch must be used inside AppStoreProvider')
  }
  return dispatch
}
