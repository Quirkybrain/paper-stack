import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Error taxonomy ↔ messageKey ↔ zh-CN locale parity (T-61; contracts §5;
 * NF11). The shared vector is transcribed from contracts §5; the Rust test
 * (`src-tauri/tests/contract_search_parity.rs`) compares the same file against
 * the compiled `ErrorCode` table field by field, so this suite closes the
 * locale side of the 32/32 loop.
 */

interface TaxonomyEntry {
  code: string
  category: string
  messageKey: string
  retryable: boolean
  sourceRange: 'unused' | 'optional' | 'required'
}

interface Taxonomy {
  categories: string[]
  codes: TaxonomyEntry[]
}

// Vitest runs from the project root (see tests/contracts/README.md).
const repoRoot = process.cwd()

const taxonomy = JSON.parse(
  readFileSync(join(repoRoot, 'tests/contracts/vectors/error-taxonomy.json'), 'utf8'),
) as Taxonomy

const catalog = JSON.parse(
  readFileSync(join(repoRoot, 'src/locales/zh-CN.json'), 'utf8'),
) as Record<string, string>

describe('error taxonomy vector ↔ locale catalog', () => {
  it('lists exactly the 32 stable codes, unique, in contracts order', () => {
    expect(taxonomy.codes).toHaveLength(32)
    expect(new Set(taxonomy.codes.map((entry) => entry.code)).size).toBe(32)
    expect(taxonomy.codes[0].code).toBe('PS_IO_NOT_FOUND')
    expect(taxonomy.codes[31].code).toBe('PS_WORKER_FAILED')
  })

  it('every code has a valid category, retryable flag and sourceRange policy', () => {
    for (const entry of taxonomy.codes) {
      expect(taxonomy.categories, entry.code).toContain(entry.category)
      expect(typeof entry.retryable, entry.code).toBe('boolean')
      expect(['unused', 'optional', 'required'], entry.code).toContain(entry.sourceRange)
    }
  })

  it('32/32 messageKeys resolve to non-empty zh-CN strings', () => {
    for (const entry of taxonomy.codes) {
      const value = catalog[entry.messageKey]
      expect(value, `${entry.code} -> ${entry.messageKey}`).toBeTypeOf('string')
      expect(value.length, entry.messageKey).toBeGreaterThan(0)
    }
  })

  it('the catalog exposes no extra error.* keys (32/32 both ways)', () => {
    const localeKeys = Object.keys(catalog)
      .filter((key) => key.startsWith('error.'))
      .sort()
    const vectorKeys = taxonomy.codes.map((entry) => entry.messageKey).sort()
    expect(localeKeys).toEqual(vectorKeys)
  })

  it('categories match the shared enum order', () => {
    expect(taxonomy.categories).toEqual([
      'io',
      'encoding',
      'auth',
      'resource',
      'parse',
      'storage',
      'limit',
      'internal',
    ])
  })
})
