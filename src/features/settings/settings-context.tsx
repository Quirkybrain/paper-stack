import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { settings as settingsService, toErrorPayload } from '../../services'
import type {
  ErrorPayload,
  FrozenLimits,
  GlobalSettings,
  SettingsBundle,
  UpdateSettingsResult,
} from '../../services/types'
import {
  DEFAULT_FROZEN_LIMITS,
  DEFAULT_GLOBAL_SETTINGS,
  displayDefaultsPatch,
  hasSettingsPatch,
  settingsPatchBetween,
} from './settings-model'

/**
 * Global settings host (ui-spec §3.7; contracts §3.5/§8; R23).
 *
 * Applies three rules from the spec verbatim:
 * - instant preview and persistence are different states: every control calls
 *   `update()`, which merges the patch into the live settings immediately and
 *   only then asks `update_settings` to persist;
 * - a failed save never claims success: the live value stays ("本次已生效"),
 *   `saveState` becomes `failed` and `retrySave()` re-sends the remaining
 *   delta against the last confirmed settings;
 * - theme/typography are applied to the document root so the current reading
 *   position is not remounted or scrolled.
 */

export interface SettingsServiceDeps {
  getSettings(): Promise<SettingsBundle>
  updateSettings(patch: Partial<GlobalSettings>): Promise<UpdateSettingsResult>
}

/** Default deps hit `src/services/settings`; tests may inject a mocked pair. */
const DEFAULT_DEPS: SettingsServiceDeps = {
  getSettings: settingsService.getSettings,
  updateSettings: settingsService.updateSettings,
}

export type SettingsSaveState = 'idle' | 'saving' | 'failed'

export interface SettingsContextValue {
  settings: GlobalSettings
  defaults: GlobalSettings
  limits: FrozenLimits
  revision: number
  loading: boolean
  loadFailed: boolean
  saveState: SettingsSaveState
  saveError: ErrorPayload | null
  /** Instant local preview only; callers that must persist use `update`. */
  preview(patch: Partial<GlobalSettings>): void
  /** Preview + persist; resolves after the service result has been applied. */
  update(patch: Partial<GlobalSettings>): Promise<void>
  /** Re-sends the delta against the last confirmed settings (save failure). */
  retrySave(): Promise<void>
  /** Resets display fields to the bundle defaults; nothing else (ui-spec §3.7). */
  resetDisplayDefaults(): Promise<void>
  dismissSaveError(): void
}

interface SettingsState {
  settings: GlobalSettings
  defaults: GlobalSettings
  limits: FrozenLimits
  revision: number
  loading: boolean
  loadFailed: boolean
  saveState: SettingsSaveState
  saveError: ErrorPayload | null
  /** Last server-confirmed settings; the retry patch is derived from these. */
  confirmed: GlobalSettings
}

const INITIAL_STATE: SettingsState = {
  settings: DEFAULT_GLOBAL_SETTINGS,
  defaults: DEFAULT_GLOBAL_SETTINGS,
  limits: DEFAULT_FROZEN_LIMITS,
  revision: 0,
  loading: true,
  loadFailed: false,
  saveState: 'idle',
  saveError: null,
  confirmed: DEFAULT_GLOBAL_SETTINGS,
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export interface SettingsProviderProps {
  children: ReactNode
  deps?: SettingsServiceDeps
}

export function SettingsProvider({ children, deps }: SettingsProviderProps) {
  const [state, setState] = useState<SettingsState>(INITIAL_STATE)
  const getSettingsFn = deps?.getSettings ?? DEFAULT_DEPS.getSettings
  const updateSettingsFn = deps?.updateSettings ?? DEFAULT_DEPS.updateSettings
  /** Last-issued save wins; an out-of-order older response is ignored. */
  const requestSeq = useRef(0)
  /** Once the user edits, a late bundle read must not clobber the preview. */
  const userEditedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void getSettingsFn()
      .then((bundle) => {
        if (cancelled) return
        setState((previous) =>
          userEditedRef.current
            ? {
                ...previous,
                defaults: bundle.defaults,
                limits: bundle.limits,
                revision: bundle.revision,
                loading: false,
                loadFailed: false,
              }
            : {
                ...previous,
                settings: bundle.global,
                defaults: bundle.defaults,
                limits: bundle.limits,
                revision: bundle.revision,
                confirmed: bundle.global,
                loading: false,
                loadFailed: false,
              },
        )
      })
      .catch(() => {
        if (cancelled) return
        // Honest degradation: contract defaults stay active; the settings UI
        // reports per-field save failures if a persist is later attempted.
        setState((previous) => ({ ...previous, loading: false, loadFailed: true }))
      })
    return () => {
      cancelled = true
    }
  }, [getSettingsFn])

  // Apply theme + typography to the document root without touching the body
  // tree, so changing a value never jumps the reading position (ui-spec §3.7).
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--ps-body-size', `${state.settings.fontSizePx}px`)
    root.style.setProperty('--ps-body-line', String(state.settings.lineHeight))
    root.style.setProperty('--ps-content-max', `${state.settings.maxContentWidthPx}px`)
    const explicit: 'light' | 'dark' | null =
      state.settings.theme === 'system' ? null : state.settings.theme
    if (explicit !== null) {
      root.dataset.theme = explicit
      return
    }
    const mql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    const applySystem = () => {
      root.dataset.theme = mql?.matches ? 'dark' : 'light'
    }
    applySystem()
    mql?.addEventListener?.('change', applySystem)
    return () => {
      mql?.removeEventListener?.('change', applySystem)
    }
  }, [
    state.settings.theme,
    state.settings.fontSizePx,
    state.settings.lineHeight,
    state.settings.maxContentWidthPx,
  ])

  const preview = useCallback((patch: Partial<GlobalSettings>) => {
    userEditedRef.current = true
    setState((previous) => ({ ...previous, settings: { ...previous.settings, ...patch } }))
  }, [])

  const update = useCallback(
    async (patch: Partial<GlobalSettings>) => {
      userEditedRef.current = true
      setState((previous) => ({
        ...previous,
        settings: { ...previous.settings, ...patch },
        saveState: 'saving',
      }))
      const seq = requestSeq.current + 1
      requestSeq.current = seq
      try {
        const result = await updateSettingsFn(patch)
        if (seq !== requestSeq.current) return
        setState((previous) => ({
          ...previous,
          settings: result.applied,
          revision: result.revision,
          confirmed: result.persisted ? result.applied : previous.confirmed,
          saveState: result.persisted ? 'idle' : 'failed',
          saveError: result.persisted ? null : (result.error ?? null),
        }))
      } catch (error) {
        if (seq !== requestSeq.current) return
        setState((previous) => ({
          ...previous,
          saveState: 'failed',
          saveError: toErrorPayload(error),
        }))
      }
    },
    [updateSettingsFn],
  )

  const retrySave = useCallback(async () => {
    const patch = settingsPatchBetween(state.confirmed, state.settings)
    if (!hasSettingsPatch(patch)) {
      setState((previous) => ({
        ...previous,
        saveState: 'idle',
        saveError: null,
      }))
      return
    }
    await update(patch)
  }, [state.settings, state.confirmed, update])

  const resetDisplayDefaults = useCallback(async () => {
    await update(displayDefaultsPatch(state.defaults))
  }, [state.defaults, update])

  const dismissSaveError = useCallback(() => {
    setState((previous) =>
      previous.saveState === 'failed'
        ? { ...previous, saveState: 'idle', saveError: null }
        : previous,
    )
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: state.settings,
      defaults: state.defaults,
      limits: state.limits,
      revision: state.revision,
      loading: state.loading,
      loadFailed: state.loadFailed,
      saveState: state.saveState,
      saveError: state.saveError,
      preview,
      update,
      retrySave,
      resetDisplayDefaults,
      dismissSaveError,
    }),
    [state, preview, update, retrySave, resetDisplayDefaults, dismissSaveError],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (value === null) {
    throw new Error('useSettings must be used inside SettingsProvider')
  }
  return value
}
