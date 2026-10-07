import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { findSourceHits } from '../../src/features/search/search-core'

/**
 * Literal-search parity, front-end side (T-61; ADR-007; contracts §2.1
 * command 38). The expected offsets in `vectors/search-parity.json` are
 * computed from the normative rule (literal substring, per-code-point
 * lowercase, no normalization, non-overlapping, UTF-8 byte offsets, 1-based
 * LF lines) — never from implementation output. The Rust service executes the
 * same file in `src-tauri/tests/contract_search_parity.rs`.
 */

interface ExpectedHit {
  startByte: number
  endByte: number
  lineNumber: number
}

interface QueryVector {
  query: string
  caseSensitive: boolean
  expected?: ExpectedHit[]
  frontend?: ExpectedHit[]
  rust?: ExpectedHit[]
}

interface SearchCase {
  id: string
  note: string
  corpus: string
  queries: QueryVector[]
}

interface BoundaryCase extends SearchCase {
  kind: 'accepted-length-changing-fold' | 'contract-divergence'
  /** Set when a divergence was resolved and only its legacy shell remains. */
  resolvedIn?: string
}

interface SearchFileCase {
  id: string
  note: string
  corpusFile: string
  queries: QueryVector[]
}

interface SearchVectors {
  cases: SearchCase[]
  fileCases?: SearchFileCase[]
  boundaryCases: BoundaryCase[]
}

// Vitest runs from the project root (see tests/contracts/README.md).
const repoRoot = process.cwd()

const vectors = JSON.parse(
  readFileSync(join(repoRoot, 'tests/contracts/vectors/search-parity.json'), 'utf8'),
) as SearchVectors

function hitsFor(corpus: string, query: string, caseSensitive: boolean): ExpectedHit[] {
  return findSourceHits(corpus, query, caseSensitive).map((hit) => ({
    startByte: hit.startByte,
    endByte: hit.endByte,
    lineNumber: hit.lineNumber,
  }))
}

describe('shared literal-search parity vectors (front-end side)', () => {
  it('vector file is structurally complete (12 parity + 1 accepted boundary entry)', () => {
    expect(vectors.cases.length).toBeGreaterThanOrEqual(12)
    expect(vectors.boundaryCases).toHaveLength(1)
    for (const item of vectors.cases) {
      // The explicit empty-corpus case is empty by design; every other case
      // has content.
      if (item.id !== 'empty-corpus') {
        expect(item.corpus.length, item.id).toBeGreaterThan(0)
      }
      expect(item.queries.length, item.id).toBeGreaterThan(0)
    }
  })

  for (const item of vectors.cases) {
    it(`${item.id}: same corpus yields the hand-derived hits`, () => {
      for (const query of item.queries) {
        expect(
          hitsFor(item.corpus, query.query, query.caseSensitive),
          `${item.id} query=${JSON.stringify(query.query)} caseSensitive=${query.caseSensitive}`,
        ).toEqual(query.expected)
      }
    })
  }

  it('fixed fixture file is searchable with the same rule', () => {
    for (const item of vectors.fileCases ?? []) {
      const corpus = readFileSync(`${repoRoot}/${item.corpusFile}`, 'utf8')
      for (const query of item.queries) {
        expect(
          hitsFor(corpus, query.query, query.caseSensitive),
          `${item.id} query=${JSON.stringify(query.query)}`,
        ).toEqual(query.expected)
      }
    }
  })

  it('the accepted İ length-changing fold stays pinned per side', () => {
    for (const item of vectors.boundaryCases) {
      for (const query of item.queries) {
        const frontend = hitsFor(item.corpus, query.query, query.caseSensitive)
        expect(
          frontend,
          `${item.id}: front-end behavior changed; revise the vector and the report before relaxing this`,
        ).toEqual(query.frontend)
        // The documented divergence means the two implementations deliberately
        // differ (ADR-007 accepted length-changing fold). If the expectation
        // sets become equal, the vector must be revised together with the
        // report's finding list.
        expect(frontend).not.toEqual(query.rust)
      }
    }
  })
})
