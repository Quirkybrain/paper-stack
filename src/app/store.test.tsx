import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  AppStoreProvider,
  INITIAL_APP_STATE,
  appReducer,
  createToast,
  overlayPushed,
  overlayPopped,
  panelToggled,
  recentRemoved,
  recentTouched,
  selectActivePanel,
  selectTopOverlay,
  settingsLoaded,
  toastDismissed,
  toastPushed,
  useAppDispatch,
  useAppState,
} from './store'
import type { GlobalSettings, RecentEntry } from '../services/types'

const settings: GlobalSettings = {
  theme: 'system',
  fontSizePx: 17,
  lineHeight: 1.8,
  maxContentWidthPx: 760,
  syntaxMode: 'technical',
  updateModeDefault: 'keep',
  restoreSession: true,
  rememberRecords: true,
}

function recent(docId: string): RecentEntry {
  return {
    docId,
    displayName: `${docId}.md`,
    canonicalPath: `/tmp/${docId}.md`,
    openedAtMs: 1,
    available: true,
  }
}

describe('global app store', () => {
  it('keeps at most one auxiliary panel open at a time (EDGE-06)', () => {
    let state = INITIAL_APP_STATE
    state = appReducer(state, panelToggled('files'))
    expect(selectActivePanel(state)).toBe('files')

    state = appReducer(state, panelToggled('outline'))
    expect(selectActivePanel(state)).toBe('outline')

    state = appReducer(state, panelToggled('inspect'))
    expect(selectActivePanel(state)).toBe('inspect')

    state = appReducer(state, panelToggled('inspect'))
    expect(selectActivePanel(state)).toBeNull()
  })

  it('upserts recents most-recent-first and removes by docId', () => {
    let state = INITIAL_APP_STATE
    state = appReducer(state, recentTouched(recent('a')))
    state = appReducer(state, recentTouched(recent('b')))
    expect(state.recents.map((entry) => entry.docId)).toEqual(['b', 'a'])

    state = appReducer(state, recentTouched(recent('a')))
    expect(state.recents.map((entry) => entry.docId)).toEqual(['a', 'b'])

    state = appReducer(state, recentRemoved('a'))
    expect(state.recents.map((entry) => entry.docId)).toEqual(['b'])
    expect(state.recentsLoaded).toBe(true)

    expect(appReducer(state, recentRemoved('missing'))).toBe(state)
  })

  it('stores the settings snapshot with its revision', () => {
    const state = appReducer(INITIAL_APP_STATE, settingsLoaded(settings, 3))
    expect(state.settings).toEqual(settings)
    expect(state.settingsRevision).toBe(3)
  })

  it('manages the modal overlay stack (push/pop/top)', () => {
    let state = INITIAL_APP_STATE
    state = appReducer(state, overlayPushed('settings', 'o1'))
    state = appReducer(state, overlayPushed('clear', 'o2'))
    expect(selectTopOverlay(state)?.id).toBe('o2')

    state = appReducer(state, overlayPopped())
    expect(selectTopOverlay(state)?.id).toBe('o1')

    state = appReducer(state, overlayPopped('o1'))
    expect(state.overlays).toEqual([])
    expect(appReducer(state, overlayPopped())).toBe(state)
  })

  it('persists error toasts until dismissed and makes success toasts transient', () => {
    const errorToast = createToast('error', 'error.io.readFailed')
    const successToast = createToast('success', 'formula.copied')
    expect(errorToast.persistent).toBe(true)
    expect(successToast.persistent).toBe(false)

    let state = appReducer(INITIAL_APP_STATE, toastPushed(errorToast))
    state = appReducer(state, toastPushed(successToast))
    expect(state.toasts).toHaveLength(2)

    state = appReducer(state, toastDismissed(successToast.id))
    expect(state.toasts.map((toast) => toast.id)).toEqual([errorToast.id])
    expect(appReducer(state, toastDismissed('nope'))).toBe(state)
  })

  it('exposes state and dispatch through AppStoreProvider', () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      {
        wrapper: ({ children }) => <AppStoreProvider>{children}</AppStoreProvider>,
      },
    )
    expect(result.current.state.activePanel).toBeNull()
    act(() => {
      result.current.dispatch(panelToggled('files'))
    })
    expect(result.current.state.activePanel).toBe('files')
  })
})
