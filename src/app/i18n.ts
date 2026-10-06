import zhCN from '../locales/zh-CN.json'

/**
 * Minimal i18n scaffold for v0.1.0 (ADR-009, artifacts/40-ux/strings-zh-CN.md).
 *
 * The full runtime — locale loading, the complete fallback chain and the
 * component-level API — lands with wp-16. This scaffold already fixes the
 * calling contract: `t(key, params?)` with `{param}` interpolation, flat
 * dotted keys from `src/locales/zh-CN.json`, and a "return the key, never
 * blank, never throw" fallback with a development warning.
 */
export type Locale = 'zh-CN'

export type TranslationParams = Record<string, string | number>

const resources: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN as Record<string, string>,
}

const FALLBACK_LOCALE: Locale = 'zh-CN'

let activeLocale: Locale = 'zh-CN'

export function setLocale(locale: Locale): void {
  activeLocale = locale
}

export function getLocale(): Locale {
  return activeLocale
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name]
    return value === undefined ? placeholder : String(value)
  })
}

export function t(key: string, params?: TranslationParams): string {
  const template = resources[activeLocale][key] ?? resources[FALLBACK_LOCALE][key]
  if (template === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing key for locale "${activeLocale}": ${key}`)
    }
    return key
  }
  return interpolate(template, params)
}
