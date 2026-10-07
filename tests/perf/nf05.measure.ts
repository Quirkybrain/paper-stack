import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { expect, it } from 'vitest'

import { parseDocument } from '../../src/document/pipeline'
import { findBodyHits, findSourceHits } from '../../src/features/search/search-core'

/**
 * NF05 first-query calibration (T-60; requirements NF05; ADR-007 §Consequences).
 *
 * For each iteration on a generated corpus:
 *   parse_and_index_ms — decoded text -> blocks/segments ready
 *                        ("full-text-searchable" index, NF04's third metric)
 *   first_query_ms     — query submission -> first source-scope result
 *                        (findSourceHits over the raw text) plus the body
 *                        scan over the ready segments.
 *
 * Results are raw calibration samples on this machine; the harness asserts
 * only that each iteration produced results (no timing threshold is a gate —
 * plan §5.4 marks NF05 P95 as pending a reference machine).
 *
 * Env: PS_PERF_CORPUS (default generated 1MiB corpus)
 *      PS_PERF_N (default 30), PS_PERF_OUT (raw JSON path)
 *      PS_PERF_QUERY (default "needle-")
 */

const repoRoot = process.cwd()
const corpusPath =
  process.env.PS_PERF_CORPUS ??
  join(repoRoot, 'artifacts', '70-verification', 'evidence', 'generated', 'corpus-1MiB.md')
const iterations = Number(process.env.PS_PERF_N ?? 30)
const query = process.env.PS_PERF_QUERY ?? 'needle-'
const outPath = process.env.PS_PERF_OUT

interface Sample {
  iteration: number
  parse_and_index_ms: number
  first_query_ms: number
  source_hits: number
  body_hits: number
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))
  return sorted[index]
}

function summarize(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    n: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
  }
}

it('nf05 first-query calibration on the generated corpus', async () => {
  const text = readFileSync(corpusPath, 'utf8')
  expect(text.length).toBeGreaterThan(0)

  const samples: Sample[] = []
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const start = performance.now()
    const parsed = await parseDocument(text, { mode: 'technical' })
    const indexed = performance.now()
    const sourceHits = findSourceHits(text, query, false)
    const bodyHits = findBodyHits(parsed.segments, query, false)
    const queried = performance.now()

    expect(parsed.status).toBe('ok')
    expect(sourceHits.length).toBeGreaterThan(0)
    expect(bodyHits.length).toBeGreaterThan(0)

    samples.push({
      iteration,
      parse_and_index_ms: indexed - start,
      first_query_ms: queried - indexed,
      source_hits: sourceHits.length,
      body_hits: bodyHits.length,
    })
  }

  const report = {
    metric: 'NF05',
    note: 'CALIBRATION on this machine (non-reference); viewable/index proxies documented in tests/perf/README.md',
    corpus: corpusPath,
    corpus_bytes: Buffer.byteLength(text, 'utf8'),
    query,
    iterations,
    parse_and_index: summarize(samples.map((sample) => sample.parse_and_index_ms)),
    first_query: summarize(samples.map((sample) => sample.first_query_ms)),
    samples,
  }
  if (outPath) writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    `NF05 n=${report.parse_and_index.n} corpus_bytes=${report.corpus_bytes} ` +
      `parse_p50=${report.parse_and_index.p50.toFixed(1)}ms parse_p95=${report.parse_and_index.p95.toFixed(1)}ms ` +
      `first_query_p50=${report.first_query.p50.toFixed(2)}ms first_query_p95=${report.first_query.p95.toFixed(2)}ms`,
  )
})
