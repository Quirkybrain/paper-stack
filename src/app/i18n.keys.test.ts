import { describe, expect, it } from 'vitest'

import zhCN from '../locales/zh-CN.json'

/**
 * Key-parity guard for the baseline bundle.
 *
 * The expected count is the number of rows of the pinned catalog
 * `artifacts/40-ux/strings-zh-CN.md` (Rev 1, producer agent:experience-designer,
 * last verified 2026-10-07) measured on 2026-10-07. The catalog is the source
 * of truth; when it changes, regenerate `src/locales/zh-CN.json` and update
 * this count in the same commit.
 */
const CATALOG_KEY_COUNT = 378

const messages = zhCN as Record<string, string>

describe('zh-CN locale parity with the string catalog', () => {
  it(`contains exactly the ${CATALOG_KEY_COUNT} catalog keys`, () => {
    expect(Object.keys(messages)).toHaveLength(CATALOG_KEY_COUNT)
  })

  it('uses lowercase dotted namespace keys', () => {
    for (const key of Object.keys(messages)) {
      expect(key).toMatch(/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)*$/)
      expect(key).toContain('.')
    }
  })

  it('keeps every {param} placeholder inside a well-formed brace pair', () => {
    for (const [key, value] of Object.entries(messages)) {
      const opens = (value.match(/\{/g) ?? []).length
      const closes = (value.match(/\}/g) ?? []).length
      expect(opens, `unbalanced braces in ${key}`).toBe(closes)
    }
  })
})
