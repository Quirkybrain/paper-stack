import type { Root } from 'hast'

/**
 * Shared types for the single parse pipeline (ADR-002;
 * `artifacts/30-architecture/rendering-pipeline.md` §1–§6).
 *
 * Unit discipline (contracts §1.2): mdast/hast positions and every internal
 * search/anchor offset use UTF-16 code units; IPC/`data-src-*` byte ranges use
 * UTF-8 bytes. Conversions go through `source-map.ts` helpers only.
 */

/** UTF-16 code-unit offsets into the decoded document text; half-open `[start, end)`. */
export interface SourceRangeUtf16 {
  startUtf16: number
  endUtf16: number
}

/** UTF-8 byte offsets into the decoded document text; half-open `[start, end)`. */
export interface SourceRangeBytes {
  startByte: number
  endByte: number
}

export type ErrorCategory =
  'io' | 'encoding' | 'auth' | 'resource' | 'parse' | 'storage' | 'limit' | 'internal'

/**
 * Local diagnostic in the shape of the contract `ErrorPayload`
 * (contracts.md §3.7/§5). `sourceRange` is always UTF-8 bytes (contracts §1.2).
 */
export interface DocumentDiagnostic {
  code: string
  category: ErrorCategory
  messageKey: string
  retryable: boolean
  sourceRange?: SourceRangeBytes
  details?: Record<string, string | number | boolean>
}

/** Outline entry for one heading, in document order (rendering-pipeline §2.4a). */
export interface OutlineEntry {
  level: number
  text: string
  anchorId: string
  sourceRange: SourceRangeUtf16
}

export type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'code'
  | 'mermaid'
  | 'table'
  | 'image'
  | 'details'
  | 'html'
  | 'hr'
  | 'footnote'
  | 'math'

/**
 * Stable record for one top-level semantic block (rendering-pipeline §2.4b).
 * `sourceRange` is UTF-16 (pipeline model); `sourceRangeBytes` is the same
 * range converted for `data-src-*` and IPC consumption (pipeline §3).
 */
export interface BlockRecord {
  blockId: string
  kind: BlockKind
  headingPath: string[]
  sourceRange: SourceRangeUtf16
  sourceRangeBytes: SourceRangeBytes
  fingerprint: string
  segIds: string[]
}

export type SegmentKind = 'text' | 'code' | 'inline-code' | 'image-alt' | 'math' | 'html-text'

/** One flat literal-search segment (rendering-pipeline §2.4c, ADR-007). */
export interface SearchSegment {
  segId: string
  blockId: string
  kind: SegmentKind
  text: string
  startUtf16: number
  endUtf16: number
}

export interface PipelineStats {
  charsUtf16: number
  bytesUtf8: number
  blockCount: number
  segmentCount: number
  headingCount: number
}

/** Frozen v0.1.0 mode combination (rendering-pipeline §1 table). */
export type PipelineMode = 'technical' | 'standard'

export interface ParseDocumentOptions {
  /** `technical` (default) enables the documented GFM subset; `standard` is CommonMark. */
  mode?: PipelineMode
  /**
   * Document-level inline-math switch (rendering-pipeline §2.3). Consumed by
   * the wp-19 math engine slot; kept in the resolved options and worker
   * protocol so the interface is frozen now.
   */
  inlineMath?: boolean
}

export interface ResolvedPipelineOptions {
  mode: PipelineMode
  inlineMath: boolean
}

/**
 * Structured-cloneable product of stages ①–⑩ (ADR-002/§6). Worker and
 * main-thread fallback return the same shape; `hast` is `null` only for the
 * defensive document-level failure path (`PS_PARSE_DOC`).
 */
export interface ParseDocumentResult {
  status: 'ok' | 'failed'
  hast: Root | null
  outline: OutlineEntry[]
  blocks: BlockRecord[]
  segments: SearchSegment[]
  diagnostics: DocumentDiagnostic[]
  stats: PipelineStats
}
