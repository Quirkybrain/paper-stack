import zhCN from '../locales/zh-CN.json'

/**
 * i18n runtime for v0.1.0 (ADR-009).
 *
 * - Flat dotted keys from `src/locales/{locale}.json`; zh-CN is the baseline.
 * - `t(key, params?)` supports `{name}` interpolation (no string
 *   concatenation in call sites).
 * - Fallback chain: active locale → zh-CN → return the key as-is with a
 *   development warning. Never blank, never throws.
 * - Future languages register their bundle via `registerLocale`; no language
 *   gets a separate code path (single codebase rule).
 */

export type Locale = string

export type TranslationParams = Record<string, string | number>

export const DEFAULT_LOCALE: Locale = 'zh-CN'

type MessageBundle = Record<string, string>

const bundles = new Map<Locale, MessageBundle>()

let activeLocale: Locale = DEFAULT_LOCALE

function isDevEnvironment(): boolean {
  return typeof import.meta !== 'undefined' && import.meta.env?.DEV === true
}

function warn(message: string): void {
  if (isDevEnvironment()) console.warn(`[i18n] ${message}`)
}

/** Registers or replaces the bundle for a locale (e.g. a future `en-US.json`). */
export function registerLocale(locale: Locale, messages: MessageBundle): void {
  bundles.set(locale, { ...messages })
}

export function hasLocale(locale: Locale): boolean {
  return bundles.has(locale)
}

export function setLocale(locale: Locale): void {
  if (!bundles.has(locale) && locale !== DEFAULT_LOCALE) {
    warn(`locale "${locale}" is not registered; text will fall back to "${DEFAULT_LOCALE}"`)
  }
  activeLocale = locale
}

export function getLocale(): Locale {
  return activeLocale
}

/** Resolves a key through the fallback chain without warnings (for tooling). */
export function lookup(key: string, locale: Locale = activeLocale): string | undefined {
  return bundles.get(locale)?.[key] ?? bundles.get(DEFAULT_LOCALE)?.[key]
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name]
    return value === undefined ? placeholder : String(value)
  })
}

export function t(key: string, params?: TranslationParams): string {
  const bundle = bundles.get(activeLocale)
  const direct = bundle?.[key]
  if (direct !== undefined) return interpolate(direct, params)

  if (activeLocale !== DEFAULT_LOCALE) {
    const fallback = bundles.get(DEFAULT_LOCALE)?.[key]
    if (fallback !== undefined) {
      warn(`key "${key}" is missing in locale "${activeLocale}"; using "${DEFAULT_LOCALE}"`)
      return interpolate(fallback, params)
    }
  }

  warn(`missing key "${key}" for locale "${activeLocale}"`)
  return key
}

registerLocale(DEFAULT_LOCALE, zhCN as MessageBundle)
