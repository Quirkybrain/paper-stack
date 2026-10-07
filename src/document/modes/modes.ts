import type { ParseDocumentOptions, PipelineStats } from '../types'

/**
 * Large-document mode selection and honesty reporting (rendering-pipeline §5;
 * models §1.4; T-51/T-52; R29/AT29).
 *
 * Two frozen thresholds from SRS §6.1 / models §1.4 drive the frontend:
 * - `>10MiB or over the complexity budget` → the open-time prompt offers
 *   `简化阅读 / 只读源码 / 取消` (rendering-pipeline §5 table);
 * - `>50MiB` → no full render and no full IPC transfer at all; only the
 *   source-window mode (`get_source_info` / `read_source_window` /
 *   `search_source`) is allowed.
 *
 * INV-DS-08 / R29: the visible "rendered / indexed range" statement must be
 * exact. This module is the single place that maps a mode to its coverage
 * facts, so no component can call a partial view "full" without contradicting
 * the exported record.
 *
 * The complexity budget values are suggested initial values (rendering-pipeline
 * §5 "节点/块数初始阈值，可校准"; models §11 discipline): they are NOT
 * acceptance thresholds and must be calibrated by the measurement task before
 * being used as regression oracles (A8/NF11).
 */

/** Frozen: >10MiB (or over budget) prompts before full rendering. */
export const LARGE_DOC_THRESHOLD_BYTES = 10 * 1024 * 1024

/** Frozen: >50MiB never full-renders; source-window mode only. */
export const HARD_LIMIT_BYTES = 50 * 1024 * 1024

/**
 * SUGGESTED INITIAL VALUES (calibratable; not acceptance thresholds):
 * block/segment counts beyond these make the full pipeline expensive enough to
 * offer the simplified subset.
 */
export const COMPLEXITY_BUDGET = {
  maxBlocks: 20_000,
  maxSegments: 60_000,
} as const

/** D5 display mode (models §0.2): full / simplified / sourceWindow. */
export type LargeDocMode = 'full' | 'simplified' | 'sourceWindow'

/** User choice in the open-time prompt (ui-spec §3.8 大文档). */
export type LargeDocChoice = 'simplified' | 'source' | 'cancel'

export type LargeDocPromptReason = 'size' | 'complexity'

export type LargeDocClassification =
  | { kind: 'full' }
  | { kind: 'prompt'; reason: LargeDocPromptReason }
  | { kind: 'sourceOnly'; reason: 'hardLimit' }

export interface LargeDocSizeInput {
  sizeBytes: number
  /** Parse stats when a first parse already ran (complexity path). */
  stats?: Pick<PipelineStats, 'blockCount' | 'segmentCount'>
}

/** True when the block/segment counts exceed the suggested budget. */
export function isOverComplexityBudget(
  stats: Pick<PipelineStats, 'blockCount' | 'segmentCount'>,
): boolean {
  return (
    stats.blockCount > COMPLEXITY_BUDGET.maxBlocks || stats.segmentCount > COMPLEXITY_BUDGET.maxSegments
  )
}

/**
 * Size-first classification. The hard limit wins over everything; size beats
 * complexity; without a prior parse only the size can be judged.
 */
export function classifyLargeDocument(input: LargeDocSizeInput): LargeDocClassification {
  const { sizeBytes, stats } = input
  if (sizeBytes > HARD_LIMIT_BYTES) return { kind: 'sourceOnly', reason: 'hardLimit' }
  if (sizeBytes > LARGE_DOC_THRESHOLD_BYTES) return { kind: 'prompt', reason: 'size' }
  if (stats !== undefined && isOverComplexityBudget(stats)) {
    return { kind: 'prompt', reason: 'complexity' }
  }
  return { kind: 'full' }
}

/** Choice → mode; `cancel` produces no mode (never a ghost tab). */
export function resolveLargeDocChoice(choice: LargeDocChoice): LargeDocMode | null {
  if (choice === 'simplified') return 'simplified'
  if (choice === 'source') return 'sourceWindow'
  return null
}

export interface LargeDocHonesty {
  mode: LargeDocMode
  /** Visible text label (`document.badge.*`); null means unlabeled. */
  badgeKey: 'document.badge.simplified' | 'document.badge.sourceOnly' | null
  /** Coverage explanation (`largeDoc.coverage` / `error.limit.size`). */
  coverageKey: 'largeDoc.coverage' | 'error.limit.size' | null
  /** All decoded text is present in this view. */
  textComplete: boolean
  /** Every rendered block went through the full pipeline. */
  renderComplete: boolean
  /** All decoded text participates in search (in-memory or scanned). */
  indexComplete: boolean
  /** Heavy engines (KaTeX/Shiki/Mermaid/image decode) are active. */
  heavyEngines: boolean
}

/**
 * Coverage facts per mode. `indexComplete` for the source window follows the
 * scan result: `search_source` may finish incomplete (`complete=false`), and a
 * partial scan must never be reported as a complete index (contract §2.1;
 * IX15 "说明已完成索引范围").
 */
export function largeDocHonesty(
  mode: LargeDocMode,
  options: { searchComplete?: boolean; hardLimit?: boolean } = {},
): LargeDocHonesty {
  switch (mode) {
    case 'full':
      return {
        mode,
        badgeKey: null,
        coverageKey: null,
        textComplete: true,
        renderComplete: true,
        indexComplete: true,
        heavyEngines: true,
      }
    case 'simplified':
      // Full text, basic structure, complete search/copy/source; heavy blocks
      // show their source instead of being rendered (rendering-pipeline §5).
      return {
        mode,
        badgeKey: 'document.badge.simplified',
        coverageKey: 'largeDoc.coverage',
        textComplete: true,
        renderComplete: false,
        indexComplete: true,
        heavyEngines: false,
      }
    case 'sourceWindow':
      return {
        mode,
        badgeKey: 'document.badge.sourceOnly',
        coverageKey: options.hardLimit ? 'error.limit.size' : 'largeDoc.coverage',
        textComplete: false,
        renderComplete: false,
        indexComplete: options.searchComplete === true,
        heavyEngines: false,
      }
    default:
      return assertNever(mode)
  }
}

/**
 * INV-DS-08 guard: a mode whose render is partial must carry a visible badge;
 * the caller cannot present it as an unlabeled "full" success.
 */
export function isHonestlyLabeled(honesty: LargeDocHonesty): boolean {
  return honesty.renderComplete || honesty.badgeKey !== null
}

/** Parse options for the simplified subset: same pipeline lexically, engines off. */
export function simplifiedParseOptions(base: ParseDocumentOptions): ParseDocumentOptions {
  return { ...base, simplified: true }
}

function assertNever(value: never): never {
  throw new Error(`unreachable large-document mode: ${String(value)}`)
}
