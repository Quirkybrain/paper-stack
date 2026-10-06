import { afterEach, describe, expect, it, vi } from 'vitest'

import zhCN from '../locales/zh-CN.json'
import {
  DEFAULT_LOCALE,
  getLocale,
  hasLocale,
  lookup,
  registerLocale,
  setLocale,
  t,
} from './i18n'

const messages = zhCN as Record<string, string>

afterEach(() => {
  setLocale(DEFAULT_LOCALE)
})

describe('i18n runtime (zh-CN baseline)', () => {
  it('resolves a sample of critical catalog keys verbatim', () => {
    expect(t('app.name')).toBe('纸栈 PaperStack')
    expect(t('welcome.openFile')).toBe('打开文件')
    expect(t('search.scope.body')).toBe('正文')
    expect(t('settings.title')).toBe('设置')
    expect(t('error.io.notFound')).toBe('找不到文件或资源。')
    expect(t('about.license')).toBe('GNU GPL v3.0（GPL-3.0-only）')
  })

  it('has no empty or non-string values in the baseline bundle', () => {
    const invalid = Object.entries(messages).filter(
      ([, value]) => typeof value !== 'string' || value.trim().length === 0,
    )
    expect(invalid).toEqual([])
  })

  it('interpolates {param} placeholders', () => {
    expect(t('search.counter', { current: 3, total: 10 })).toBe('3/10')
    expect(t('search.counter.aria', { current: 2, total: 7 })).toBe('第 2 项，共 7 项')
    expect(t('about.version', { version: '0.1.0' })).toBe('版本 0.1.0')
    expect(t('time.minutesAgo', { count: 5 })).toBe('5 分钟前')
    expect(t('time.minutesAgo', { count: 0 })).toBe('0 分钟前')
    expect(t('dialog.clear.usage', { count: '2', size: '1 KiB' })).toBe('2 项 · 1 KiB')
  })

  it('keeps placeholders without a matching parameter and ignores extras', () => {
    expect(t('search.counter', { current: 1 })).toBe('1/{total}')
    expect(t('app.name', { unused: 'x' })).toBe('纸栈 PaperStack')
  })

  it('returns the key and warns in development when a key is missing everywhere', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(t('does.not.exist')).toBe('does.not.exist')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('does.not.exist'))
    } finally {
      warn.mockRestore()
    }
  })

  it('falls back from a registered locale to the zh-CN baseline with a warning', () => {
    registerLocale('en-US', { 'app.name': 'PaperStack', 'toolbar.open': 'Open' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      setLocale('en-US')
      expect(t('app.name')).toBe('PaperStack')
      expect(t('toolbar.open')).toBe('Open')
      // Missing in en-US but present in zh-CN: baseline fallback + dev warning.
      expect(t('welcome.openFile')).toBe('打开文件')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('welcome.openFile'))
      // Missing everywhere: key returned, still no throw.
      expect(t('en-US.only.missing')).toBe('en-US.only.missing')
    } finally {
      warn.mockRestore()
    }
  })

  it('exposes lookup and locale registration state', () => {
    expect(hasLocale(DEFAULT_LOCALE)).toBe(true)
    expect(hasLocale('fr-FR')).toBe(false)
    registerLocale('fr-FR', { 'welcome.title': 'Ouvrir un document.' })
    expect(hasLocale('fr-FR')).toBe(true)
    expect(lookup('welcome.title', 'fr-FR')).toBe('Ouvrir un document.')
    expect(lookup('welcome.openFile', 'fr-FR')).toBe('打开文件')
  })

  it('exposes the active locale accessors', () => {
    expect(getLocale()).toBe('zh-CN')
    setLocale('zh-CN')
    expect(getLocale()).toBe('zh-CN')
  })
})
