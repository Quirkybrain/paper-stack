import type { FrozenLimits, GlobalSettings } from '../../services/types'

/**
 * Pure settings helpers (contracts §3.5; ui-spec §3.7).
 *
 * The defaults here mirror the contract defaults exactly and are only the
 * fallback before `getSettings()` answers; the authoritative `defaults` come
 * from the `SettingsBundle` so "恢复显示默认" never hardcodes values that the
 * Rust layer may revise within the contract.
 */

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: 'system',
  fontSizePx: 17,
  lineHeight: 1.8,
  maxContentWidthPx: 760,
  syntaxMode: 'technical',
  updateModeDefault: 'keep',
  restoreSession: true,
  rememberRecords: true,
}

export const DEFAULT_FROZEN_LIMITS: FrozenLimits = {
  recentLimit: 100,
  cacheMaxBytes: 256 * 1024 * 1024,
  logMaxBytes: 10 * 1024 * 1024,
}

export type DisplayField = 'fontSizePx' | 'lineHeight' | 'maxContentWidthPx'

export interface DisplayRange {
  min: number
  max: number
  step: number
}

export const DISPLAY_RANGES: Record<DisplayField, DisplayRange> = {
  fontSizePx: { min: 14, max: 24, step: 1 },
  lineHeight: { min: 1.5, max: 2.2, step: 0.1 },
  maxContentWidthPx: { min: 560, max: 960, step: 20 },
}

export function isDisplayField(field: string): field is DisplayField {
  return field === 'fontSizePx' || field === 'lineHeight' || field === 'maxContentWidthPx'
}

/** ui-spec §3.7/§13.1: out-of-range input keeps the last valid value. */
export function isWithinDisplayRange(field: DisplayField, value: number): boolean {
  if (!Number.isFinite(value)) return false
  const range = DISPLAY_RANGES[field]
  return value >= range.min && value <= range.max
}

/** Fields "恢复显示默认" resets; records/permissions/updates/syntax are untouched. */
export const DISPLAY_FIELDS: readonly (keyof GlobalSettings)[] = [
  'fontSizePx',
  'lineHeight',
  'maxContentWidthPx',
  'theme',
]

export function displayDefaultsPatch(defaults: GlobalSettings): Partial<GlobalSettings> {
  return {
    fontSizePx: defaults.fontSizePx,
    lineHeight: defaults.lineHeight,
    maxContentWidthPx: defaults.maxContentWidthPx,
    theme: defaults.theme,
  }
}

/** Every key of `target` whose value differs from `current` (retry patch). */
export function settingsPatchBetween(
  current: GlobalSettings,
  target: GlobalSettings,
): Partial<GlobalSettings> {
  const patch: Partial<GlobalSettings> = {}
  if (current.theme !== target.theme) patch.theme = target.theme
  if (current.fontSizePx !== target.fontSizePx) patch.fontSizePx = target.fontSizePx
  if (current.lineHeight !== target.lineHeight) patch.lineHeight = target.lineHeight
  if (current.maxContentWidthPx !== target.maxContentWidthPx) {
    patch.maxContentWidthPx = target.maxContentWidthPx
  }
  if (current.syntaxMode !== target.syntaxMode) patch.syntaxMode = target.syntaxMode
  if (current.updateModeDefault !== target.updateModeDefault) {
    patch.updateModeDefault = target.updateModeDefault
  }
  if (current.restoreSession !== target.restoreSession) {
    patch.restoreSession = target.restoreSession
  }
  if (current.rememberRecords !== target.rememberRecords) {
    patch.rememberRecords = target.rememberRecords
  }
  return patch
}

export function hasSettingsPatch(patch: Partial<GlobalSettings>): boolean {
  return Object.keys(patch).length > 0
}

/** Deterministic byte formatting for counts/sizes (strings §18 `format.bytes`). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 'B'
  for (const candidate of units) {
    value /= 1024
    unit = candidate
    if (value < 1024) break
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${unit}`
}
