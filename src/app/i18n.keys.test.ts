import { describe, expect, it } from 'vitest'

import zhCN from '../locales/zh-CN.json'

/**
 * Key-parity guard for the baseline bundle.
 *
 * The expected count is the number of rows of the pinned catalog
 * `artifacts/40-ux/strings-zh-CN.md` (Rev 1, producer agent:experience-designer,
 * last verified 2026-10-07) measured on 2026-10-07, plus the wp-34a fix delta
 * (recorded as string-catalog deltas for the wp-42 documentation review):
 * `nav.fragment.notFound` (missing-fragment explanation required by
 * models §5.2 / AT14-AT15) and `document.unavailable.banner` (parameterized
 * title+message composition for the source-unavailable banner per
 * `docs/internationalization.md`; the catalog only carries the two parts).
 * The wp-36a Review-B fix adds three keys: `document.footnoteLabel` (B-03:
 * the generated footnote-section label is injected through `t()`),
 * `document.info.disabled` and `document.info.issues.none` (B-04:
 * DocumentInfoPanel disabled reason and empty resource-issue state).
 * The catalog is the source of truth; when it changes, regenerate
 * `src/locales/zh-CN.json` and update this count in the same commit.
 */
const CATALOG_KEY_COUNT = 378
const WP_34A_FIX_KEY_COUNT = 2
const WP_36A_FIX_KEY_COUNT = 3
const EXPECTED_KEY_COUNT = CATALOG_KEY_COUNT + WP_34A_FIX_KEY_COUNT + WP_36A_FIX_KEY_COUNT

const messages = zhCN as Record<string, string>

describe('zh-CN locale parity with the string catalog', () => {
  it(`contains exactly the ${EXPECTED_KEY_COUNT} catalog keys`, () => {
    expect(Object.keys(messages)).toHaveLength(EXPECTED_KEY_COUNT)
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
