import { describe, expect, it, vi } from 'vitest'

import zhCN from '../locales/zh-CN.json'
import { getLocale, setLocale, t } from './i18n'

const messages = zhCN as Record<string, string>

describe('i18n scaffold (zh-CN)', () => {
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
  })

  it('keeps placeholders without a matching parameter and ignores extras', () => {
    expect(t('search.counter', { current: 1 })).toBe('1/{total}')
    expect(t('app.name', { unused: 'x' })).toBe('纸栈 PaperStack')
  })

  it('returns the key and warns in development when a key is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(t('does.not.exist')).toBe('does.not.exist')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('does.not.exist'))
    } finally {
      warn.mockRestore()
    }
  })

  it('exposes the active locale accessors', () => {
    expect(getLocale()).toBe('zh-CN')
    setLocale('zh-CN')
    expect(getLocale()).toBe('zh-CN')
  })
})
