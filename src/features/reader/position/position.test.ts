import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BlockRecord } from '../../../document/types'
import type { AnchorRecord, ErrorPayload, SaveResult } from '../../../services/types'
import {
  LayoutStabilizer,
  POSITION_WRITE_INTERVAL_MS,
  buildAnchorRecord,
  createPositionController,
  restorePosition,
} from './position'

/**
 * Anchor save/restore oracle (models §6; data-model §3.3; R19/AT19; T-54):
 * INV-AR-01..08. Timers are fake so the ≥2s throttle is deterministic.
 */

function block(overrides: Partial<BlockRecord> = {}): BlockRecord {
  return {
    blockId: 'b1',
    kind: 'paragraph',
    headingPath: ['第一章'],
    sourceRange: { startUtf16: 100, endUtf16: 140 },
    sourceRangeBytes: { startByte: 200, endByte: 280 },
    fingerprint: 'fp1:aaaa',
    segIds: ['s1'],
    ...overrides,
  }
}

function anchor(overrides: Partial<AnchorRecord> = {}): AnchorRecord {
  return {
    versionHash: 'v1',
    headingPath: ['第一章'],
    blockFingerprint: 'fp1:aaaa',
    offsetRatio: 0.25,
    sourceRange: { startByte: 200, endByte: 280 },
    ...overrides,
  }
}

describe('anchor record shape (INV-AR-01)', () => {
  it('stores exactly the contract fields, clamps the ratio and copies the heading path', () => {
    const source = block()
    const record = buildAnchorRecord({ versionHash: 'v9', block: source, offsetRatio: 1.7 })
    expect(Object.keys(record).sort()).toEqual([
      'blockFingerprint',
      'headingPath',
      'offsetRatio',
      'sourceRange',
      'versionHash',
    ])
    expect(record.offsetRatio).toBe(1)
    expect(record.blockFingerprint).toBe('fp1:aaaa')
    expect(record.headingPath).toEqual(['第一章'])
    expect(record.headingPath).not.toBe(source.headingPath)
    expect(
      buildAnchorRecord({ versionHash: 'v9', block: source, offsetRatio: Number.NaN }).offsetRatio,
    ).toBe(0)
  })
})

describe('restore decision tree (INV-AR-02/03/04)', () => {
  it('restores the same version exactly from sourceRange without any disk input', () => {
    const target = block()
    const result = restorePosition({
      anchor: anchor({ sourceRange: { startByte: 210, endByte: 280 } }),
      targetVersionHash: 'v1',
      blocks: [target],
    })
    expect(result).toEqual({ kind: 'exact', blockId: 'b1', offsetRatio: 0.25, reason: 'same-version' })
  })

  it('claims exact cross-version only for a unique fingerprint with the same heading path', () => {
    const unique = block({ blockId: 'b7', fingerprint: 'fp1:zzzz' })
    const result = restorePosition({
      anchor: anchor({ blockFingerprint: 'fp1:zzzz' }),
      targetVersionHash: 'v2',
      blocks: [unique],
    })
    expect(result).toEqual({ kind: 'exact', blockId: 'b7', offsetRatio: 0.25, reason: 'fingerprint' })
  })

  it('downgrades a unique fingerprint under a different heading to approximate', () => {
    const moved = block({ blockId: 'b7', fingerprint: 'fp1:zzzz', headingPath: ['第二章'] })
    const result = restorePosition({
      anchor: anchor({ blockFingerprint: 'fp1:zzzz', headingPath: ['第一章'] }),
      targetVersionHash: 'v2',
      blocks: [moved],
    })
    expect(result.kind).toBe('approx')
  })

  it('never claims exact for duplicate blocks (ambiguous candidates)', () => {
    const first = block({ blockId: 'b1', fingerprint: 'fp1:dup' })
    const second = block({ blockId: 'b2', fingerprint: 'fp1:dup' })
    const result = restorePosition({
      anchor: anchor({ blockFingerprint: 'fp1:dup', headingPath: [] }),
      targetVersionHash: 'v2',
      blocks: [first, second],
    })
    expect(result.kind).toBe('approx')
    expect(result).toEqual({ kind: 'approx', blockId: null, headingPath: null, reason: 'top' })
  })

  it('falls back to a unique heading path with the approximate marker', () => {
    const heading = block({
      blockId: 'b3',
      kind: 'heading',
      fingerprint: 'fp1:head',
      headingPath: ['第一章'],
    })
    const other = block({ blockId: 'b1', fingerprint: 'fp1:old' })
    const result = restorePosition({
      anchor: anchor({ blockFingerprint: 'fp1:missing' }),
      targetVersionHash: 'v2',
      blocks: [other, heading],
    })
    expect(result).toEqual({ kind: 'approx', blockId: 'b3', headingPath: ['第一章'], reason: 'heading' })
  })

  it('walks back to the nearest trusted ancestor heading', () => {
    const ancestor = block({
      blockId: 'b1',
      kind: 'heading',
      headingPath: ['第一章'],
      fingerprint: 'fp1:h1',
    })
    const result = restorePosition({
      anchor: anchor({ blockFingerprint: 'fp1:gone', headingPath: ['第一章', '已删除小节'] }),
      targetVersionHash: 'v2',
      blocks: [ancestor],
    })
    expect(result).toEqual({
      kind: 'approx',
      blockId: 'b1',
      headingPath: ['第一章'],
      reason: 'ancestor',
    })
  })

  it('falls back to the document top when nothing is trustworthy', () => {
    const result = restorePosition({
      anchor: anchor({ blockFingerprint: 'fp1:gone', headingPath: ['已删除'] }),
      targetVersionHash: 'v2',
      blocks: [block({ fingerprint: 'fp1:other', headingPath: [] })],
    })
    expect(result).toEqual({ kind: 'approx', blockId: null, headingPath: null, reason: 'top' })
  })
})

describe('position write discipline (INV-AR-06/07/08)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function harness(options: {
    suppressed?: boolean
    rememberRecords?: boolean
    result?: SaveResult | (() => Promise<SaveResult>)
  }) {
    vi.useFakeTimers()
    const calls: Array<{ docId: string; anchor: AnchorRecord }> = []
    const errors: ErrorPayload[] = []
    const failures = options.result
    const controller = createPositionController({
      savePosition: (request) => {
        calls.push({ docId: request.docId, anchor: request.anchor })
        if (typeof failures === 'function') return failures()
        return Promise.resolve(failures ?? { saved: true })
      },
      isSuppressed: () => options.suppressed === true,
      rememberRecords: () => options.rememberRecords !== false,
      onError: (error) => errors.push(error),
    })
    return { controller, calls, errors }
  }

  it('throttles writes to at least 2s and persists the latest anchor', async () => {
    const { controller, calls } = harness({})
    controller.observe('t1', 'd1', anchor({ sourceRange: { startByte: 1, endByte: 2 } }))
    expect(calls).toHaveLength(1) // leading edge
    controller.observe('t1', 'd1', anchor({ sourceRange: { startByte: 3, endByte: 4 } }))
    controller.observe('t1', 'd1', anchor({ sourceRange: { startByte: 5, endByte: 6 } }))
    expect(calls).toHaveLength(1)
    expect(controller.hasScheduledWrite('t1')).toBe(true)

    await vi.advanceTimersByTimeAsync(POSITION_WRITE_INTERVAL_MS)
    expect(calls).toHaveLength(2)
    expect(calls[1].anchor.sourceRange).toEqual({ startByte: 5, endByte: 6 })
    expect(controller.anchorFor('t1')?.sourceRange).toEqual({ startByte: 5, endByte: 6 })
  })

  it('keeps memory and skips the service while positions are suppressed (INV-AR-06)', async () => {
    const { controller, calls, errors } = harness({ suppressed: true })
    controller.observe('t1', 'd1', anchor())
    await vi.advanceTimersByTimeAsync(POSITION_WRITE_INTERVAL_MS * 3)
    expect(calls).toHaveLength(0)
    expect(errors).toHaveLength(0)
    expect(controller.error()).toBeNull()
    expect(controller.anchorFor('t1')).not.toBeNull()
  })

  it('keeps memory only when rememberRecords is false (INV-AR-08)', async () => {
    const { controller, calls } = harness({ rememberRecords: false })
    controller.observe('t1', 'd1', anchor())
    await vi.advanceTimersByTimeAsync(POSITION_WRITE_INTERVAL_MS * 3)
    expect(calls).toHaveLength(0)
    expect(controller.anchorFor('t1')).not.toBeNull()
  })

  it('surfaces save failures and retries on demand (INV-AR-07)', async () => {
    const failure: ErrorPayload = {
      code: 'PS_DB_FAILURE',
      category: 'storage',
      messageKey: 'error.storage.dbFailure',
      retryable: true,
    }
    let attempt = 0
    const { controller, calls, errors } = harness({
      result: () => {
        attempt += 1
        return Promise.resolve(
          attempt === 1 ? { saved: false, error: failure } : ({ saved: true } as SaveResult),
        )
      },
    })
    controller.observe('t1', 'd1', anchor())
    await vi.advanceTimersByTimeAsync(0)
    expect(errors).toEqual([failure])
    expect(controller.error()).toEqual(failure)

    controller.retry('t1')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('single layout correction (INV-AR-05)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces bursts into one correction and allows a later layout change', () => {
    vi.useFakeTimers()
    const stabilizer = new LayoutStabilizer()
    const corrections: number[] = []
    const unsubscribe = stabilizer.onCorrect(() => corrections.push(corrections.length + 1))

    expect(stabilizer.request()).toBe(true)
    expect(stabilizer.request()).toBe(false)
    expect(stabilizer.request()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(corrections).toHaveLength(1)

    expect(stabilizer.request()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(corrections).toHaveLength(2)
    unsubscribe()
    stabilizer.dispose()
  })

  it('cancels a pending correction on dispose', () => {
    vi.useFakeTimers()
    const stabilizer = new LayoutStabilizer()
    const corrections: number[] = []
    stabilizer.onCorrect(() => corrections.push(1))
    stabilizer.request()
    stabilizer.dispose()
    vi.advanceTimersByTime(1000)
    expect(corrections).toHaveLength(0)
  })
})
