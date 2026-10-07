import { describe, expect, it } from 'vitest'

import {
  COMPLEXITY_BUDGET,
  HARD_LIMIT_BYTES,
  LARGE_DOC_THRESHOLD_BYTES,
  classifyLargeDocument,
  isHonestlyLabeled,
  isOverComplexityBudget,
  largeDocHonesty,
  resolveLargeDocChoice,
  simplifiedParseOptions,
} from './modes'

/**
 * Large-document modes oracle (rendering-pipeline §5; models §1.4/§1.3;
 * R29/AT29; INV-DS-08; T-51/T-52).
 */

describe('large-document classification (rendering-pipeline §5)', () => {
  it('keeps documents at or below 10MiB in the full pipeline', () => {
    expect(classifyLargeDocument({ sizeBytes: 0 })).toEqual({ kind: 'full' })
    expect(classifyLargeDocument({ sizeBytes: LARGE_DOC_THRESHOLD_BYTES })).toEqual({ kind: 'full' })
    expect(
      classifyLargeDocument({
        sizeBytes: 1024,
        stats: { blockCount: COMPLEXITY_BUDGET.maxBlocks, segmentCount: COMPLEXITY_BUDGET.maxSegments },
      }),
    ).toEqual({ kind: 'full' })
  })

  it('prompts above 10MiB with the size reason', () => {
    expect(classifyLargeDocument({ sizeBytes: LARGE_DOC_THRESHOLD_BYTES + 1 })).toEqual({
      kind: 'prompt',
      reason: 'size',
    })
  })

  it('routes above 50MiB to the source-window mode only (hard limit wins)', () => {
    // Exactly 50MiB is still promptable; the strictly-greater hard limit is
    // never offered a full render or the simplified subset.
    expect(classifyLargeDocument({ sizeBytes: HARD_LIMIT_BYTES })).toEqual({
      kind: 'prompt',
      reason: 'size',
    })
    expect(classifyLargeDocument({ sizeBytes: HARD_LIMIT_BYTES + 1 })).toEqual({
      kind: 'sourceOnly',
      reason: 'hardLimit',
    })
    // The hard limit beats a complexity overrun too.
    expect(
      classifyLargeDocument({
        sizeBytes: HARD_LIMIT_BYTES + 1,
        stats: { blockCount: COMPLEXITY_BUDGET.maxBlocks + 1, segmentCount: 0 },
      }),
    ).toEqual({ kind: 'sourceOnly', reason: 'hardLimit' })
  })

  it('prompts when a prior parse exceeds the suggested complexity budget', () => {
    expect(
      isOverComplexityBudget({
        blockCount: COMPLEXITY_BUDGET.maxBlocks + 1,
        segmentCount: 1,
      }),
    ).toBe(true)
    expect(
      isOverComplexityBudget({
        blockCount: 1,
        segmentCount: COMPLEXITY_BUDGET.maxSegments + 1,
      }),
    ).toBe(true)
    expect(
      classifyLargeDocument({
        sizeBytes: 1024,
        stats: { blockCount: COMPLEXITY_BUDGET.maxBlocks + 1, segmentCount: 1 },
      }),
    ).toEqual({ kind: 'prompt', reason: 'complexity' })
  })
})

describe('choice and honesty (INV-DS-08)', () => {
  it('maps the frozen option set; cancel produces no mode (no ghost tab)', () => {
    expect(resolveLargeDocChoice('simplified')).toBe('simplified')
    expect(resolveLargeDocChoice('source')).toBe('sourceWindow')
    expect(resolveLargeDocChoice('cancel')).toBeNull()
  })

  it('labels every partial render and never calls it full', () => {
    const full = largeDocHonesty('full')
    expect(full.renderComplete).toBe(true)
    expect(full.badgeKey).toBeNull()

    for (const mode of ['simplified', 'sourceWindow'] as const) {
      const honesty = largeDocHonesty(mode)
      expect(honesty.renderComplete).toBe(false)
      expect(honesty.badgeKey).not.toBeNull()
      expect(isHonestlyLabeled(honesty)).toBe(true)
    }
  })

  it('keeps simplified full text searchable while heavy engines are off', () => {
    const honesty = largeDocHonesty('simplified')
    expect(honesty.textComplete).toBe(true)
    expect(honesty.indexComplete).toBe(true)
    expect(honesty.heavyEngines).toBe(false)
    expect(honesty.coverageKey).toBe('largeDoc.coverage')
  })

  it('follows the scan result for the source-window index coverage', () => {
    expect(largeDocHonesty('sourceWindow').indexComplete).toBe(false)
    expect(largeDocHonesty('sourceWindow', { searchComplete: true }).indexComplete).toBe(true)
    expect(largeDocHonesty('sourceWindow', { hardLimit: true }).coverageKey).toBe(
      'error.limit.size',
    )
    expect(largeDocHonesty('sourceWindow').coverageKey).toBe('largeDoc.coverage')
    expect(largeDocHonesty('sourceWindow').textComplete).toBe(false)
  })

  it('builds the simplified pipeline options as the same pipeline subset', () => {
    expect(simplifiedParseOptions({ mode: 'technical', inlineMath: false })).toEqual({
      mode: 'technical',
      inlineMath: false,
      simplified: true,
    })
  })
})
