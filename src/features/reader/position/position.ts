import type { BlockRecord } from '../../../document/types'
import type {
  AnchorRecord,
  ErrorPayload,
  SavePositionRequest,
  SaveResult,
} from '../../../services/types'
import { toErrorPayload } from '../../../services/invoke'

/**
 * Reading-position records, the §6 restore decision tree and the write
 * discipline (models §6; data-model §3.3; contract §3.4; R19/AT19; T-54).
 *
 * Normative rules implemented here:
 * - The record contains only `versionHash / headingPath / blockFingerprint /
 *   offsetRatio / sourceRange` — never document text or quoted sentences
 *   (INV-AR-01; SRS §6.2).
 * - Same-version restore uses `sourceRange` and never re-reads the disk
 *   (INV-AR-02).
 * - Cross-version "exact" requires a unique `blockFingerprint` match with the
 *   same `headingPath`; duplicate paragraphs, multiple candidates and deleted
 *   sections are at most "approximate" (INV-AR-03/04). Ambiguity never picks
 *   an arbitrary block: it walks back to the nearest trusted ancestor heading
 *   or the document top.
 * - Writes are throttled to the ≥2s lower bound from data-model §3.3 and go
 *   through the write-back suppression mirror and `rememberRecords` gate:
 *   suppressed writes return without error and keep the in-memory anchor
 *   (INV-AR-06/08).
 * - Layout changes (font/width/image decode) get at most one stabilization
 *   correction, never a chasing loop (INV-AR-05; R19; IXD §9.1).
 */

/** Normative lower bound: position writes are at least 2s apart (data-model §3.3). */
export const POSITION_WRITE_INTERVAL_MS = 2_000

/**
 * SUGGESTED initial delay before the single layout correction runs (P-02 in
 * models §11; calibratable, not an acceptance threshold): waits for reflow,
 * font metrics and image decode to settle without racing them.
 */
export const LAYOUT_CORRECTION_DELAY_MS = 200

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export interface AnchorBuildInput {
  versionHash: string
  block: BlockRecord
  /** Ratio of the reading position inside the block, clamped to 0..1. */
  offsetRatio: number
}

/** Builds the contract `AnchorRecord` for one block (INV-AR-01 field set). */
export function buildAnchorRecord(input: AnchorBuildInput): AnchorRecord {
  return {
    versionHash: input.versionHash,
    headingPath: [...input.block.headingPath],
    blockFingerprint: input.block.fingerprint,
    offsetRatio: clampRatio(input.offsetRatio),
    sourceRange: {
      startByte: input.block.sourceRangeBytes.startByte,
      endByte: input.block.sourceRangeBytes.endByte,
    },
  }
}

export function sameHeadingPath(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export type RestoreResult =
  | {
      kind: 'exact'
      blockId: string
      offsetRatio: number
      /** `same-version` = sourceRange restore; `fingerprint` = unique identity. */
      reason: 'same-version' | 'fingerprint'
    }
  | {
      kind: 'approx'
      blockId: string | null
      headingPath: string[] | null
      reason: 'heading' | 'ancestor' | 'top'
    }

export interface RestoreInput {
  anchor: AnchorRecord
  targetVersionHash: string
  blocks: readonly BlockRecord[]
}

/**
 * §6.2 decision tree. Exact only for the same version (sourceRange) or a
 * unique fingerprint+heading match; everything else is approximate, with the
 * nearest trusted ancestor heading as the landing point.
 */
export function restorePosition(input: RestoreInput): RestoreResult {
  const { anchor, targetVersionHash, blocks } = input

  if (anchor.versionHash === targetVersionHash) {
    const block = blockAtByte(blocks, anchor.sourceRange.startByte)
    if (block) {
      return {
        kind: 'exact',
        blockId: block.blockId,
        offsetRatio: clampRatio(anchor.offsetRatio),
        reason: 'same-version',
      }
    }
    return topResult()
  }

  const fingerprintMatches = blocks.filter(
    (block) => block.fingerprint === anchor.blockFingerprint,
  )
  if (
    fingerprintMatches.length === 1 &&
    sameHeadingPath(fingerprintMatches[0].headingPath, anchor.headingPath)
  ) {
    return {
      kind: 'exact',
      blockId: fingerprintMatches[0].blockId,
      offsetRatio: clampRatio(anchor.offsetRatio),
      reason: 'fingerprint',
    }
  }

  // "Nearest trusted heading": try the full path, then progressively shorter
  // ancestor prefixes. A prefix with several candidates is not trusted.
  for (let depth = anchor.headingPath.length; depth >= 1; depth -= 1) {
    const prefix = anchor.headingPath.slice(0, depth)
    const candidates = blocks.filter(
      (block) => block.kind === 'heading' && sameHeadingPath(block.headingPath, prefix),
    )
    if (candidates.length === 1) {
      return {
        kind: 'approx',
        blockId: candidates[0].blockId,
        headingPath: [...prefix],
        reason: depth === anchor.headingPath.length ? 'heading' : 'ancestor',
      }
    }
  }

  return topResult()
}

function blockAtByte(blocks: readonly BlockRecord[], byteOffset: number): BlockRecord | null {
  for (const block of blocks) {
    if (
      byteOffset >= block.sourceRangeBytes.startByte &&
      byteOffset < block.sourceRangeBytes.endByte
    ) {
      return block
    }
  }
  return null
}

function topResult(): RestoreResult {
  return { kind: 'approx', blockId: null, headingPath: null, reason: 'top' }
}

// ---------------------------------------------------------------------------
// Write discipline: suppression gate + ≥2s throttle
// ---------------------------------------------------------------------------

export type TimerHandle = ReturnType<typeof setTimeout>

export interface PositionControllerDeps {
  savePosition(request: SavePositionRequest): Promise<SaveResult>
  /** True while `positions` writes are suppressed after clear_records (models §9). */
  isSuppressed(): boolean
  /** Global `rememberRecords`; false keeps positions in memory only (INV-AR-08). */
  rememberRecords(): boolean
  onError?(error: ErrorPayload): void
  now?(): number
  setTimer?(callback: () => void, ms: number): TimerHandle
  clearTimer?(handle: TimerHandle): void
  writeIntervalMs?: number
}

export interface PositionController {
  /** Latest in-memory anchor for the tab (INV-AR-08: always kept). */
  anchorFor(tabId: string): AnchorRecord | null
  /**
   * Records the anchor in memory and schedules the throttled write. Callers
   * pass committed boundaries and throttled scroll observations; the interval
   * guarantees at most one write per ≥2s per tab.
   */
  observe(tabId: string, docId: string, anchor: AnchorRecord): void
  /** Committed boundary (update/navigation commit, close): write latest now. */
  flush(tabId: string): void
  /** Explicit user retry after a visible save failure (INV-AR-07). */
  retry(tabId: string): void
  error(): ErrorPayload | null
  clearError(): void
  hasScheduledWrite(tabId: string): boolean
  dispose(): void
}

interface LatestWrite {
  docId: string
  anchor: AnchorRecord
}

/** Creates the per-tab anchor memory and throttled writer. */
export function createPositionController(deps: PositionControllerDeps): PositionController {
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle))
  const interval = deps.writeIntervalMs ?? POSITION_WRITE_INTERVAL_MS

  const anchors = new Map<string, AnchorRecord>()
  const latest = new Map<string, LatestWrite>()
  const lastWriteAt = new Map<string, number>()
  const timers = new Map<string, TimerHandle>()
  let lastError: ErrorPayload | null = null

  const write = (tabId: string): void => {
    const pending = latest.get(tabId)
    if (!pending) return
    lastWriteAt.set(tabId, now())
    // Suppression and `rememberRecords=false` keep the anchor in memory and
    // produce SaveResult{saved:false} semantics without an error (INV-AR-06/08).
    if (!deps.rememberRecords() || deps.isSuppressed()) return
    void deps
      .savePosition({ docId: pending.docId, anchor: pending.anchor })
      .then((result) => {
        if (result.error) {
          lastError = result.error
          deps.onError?.(result.error)
        }
      })
      .catch((error: unknown) => {
        const payload = toErrorPayload(error)
        lastError = payload
        deps.onError?.(payload)
      })
  }

  const schedule = (tabId: string): void => {
    if (timers.has(tabId)) return
    const elapsed = now() - (lastWriteAt.get(tabId) ?? Number.NEGATIVE_INFINITY)
    if (elapsed >= interval) {
      write(tabId)
      return
    }
    timers.set(
      tabId,
      setTimer(() => {
        timers.delete(tabId)
        write(tabId)
      }, interval - elapsed),
    )
  }

  return {
    anchorFor(tabId) {
      return anchors.get(tabId) ?? null
    },
    observe(tabId, docId, anchor) {
      anchors.set(tabId, anchor)
      latest.set(tabId, { docId, anchor })
      schedule(tabId)
    },
    flush(tabId) {
      schedule(tabId)
    },
    retry(tabId) {
      if (!latest.has(tabId)) return
      lastError = null
      const timer = timers.get(tabId)
      if (timer !== undefined) {
        clearTimer(timer)
        timers.delete(tabId)
      }
      lastWriteAt.set(tabId, Number.NEGATIVE_INFINITY)
      schedule(tabId)
    },
    error() {
      return lastError
    },
    clearError() {
      lastError = null
    },
    hasScheduledWrite(tabId) {
      return timers.has(tabId)
    },
    dispose() {
      for (const timer of timers.values()) clearTimer(timer)
      timers.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// Single layout-stabilization correction
// ---------------------------------------------------------------------------

export interface LayoutStabilizerDeps {
  delayMs?: number
  setTimer?(callback: () => void, ms: number): TimerHandle
  clearTimer?(handle: TimerHandle): void
}

/**
 * INV-AR-05: after a layout change (font size, content width, image decode)
 * at most one correction runs. Repeated requests while the correction is armed
 * are coalesced (no chasing); after it fires, a later layout change may arm a
 * new one.
 */
export class LayoutStabilizer {
  readonly #delayMs: number
  readonly #setTimer: NonNullable<LayoutStabilizerDeps['setTimer']>
  readonly #clearTimer: NonNullable<LayoutStabilizerDeps['clearTimer']>
  readonly #listeners = new Set<() => void>()
  #timer: TimerHandle | null = null

  constructor(deps: LayoutStabilizerDeps = {}) {
    this.#delayMs = deps.delayMs ?? LAYOUT_CORRECTION_DELAY_MS
    this.#setTimer = deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
    this.#clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle))
  }

  get pending(): boolean {
    return this.#timer !== null
  }

  /** Arms one correction; returns false when one is already pending. */
  request(): boolean {
    if (this.#timer !== null) return false
    this.#timer = this.#setTimer(() => {
      this.#timer = null
      for (const listener of [...this.#listeners]) listener()
    }, this.#delayMs)
    return true
  }

  onCorrect(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.#timer !== null) {
      this.#clearTimer(this.#timer)
      this.#timer = null
    }
    this.#listeners.clear()
  }
}
