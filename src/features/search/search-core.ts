import {
  createSourceOffsetIndex,
  utf8ByteOffsetToUtf16Index,
  type SourceOffsetIndex,
} from '../../document/source-map'
import type { SearchSegment, SegmentKind } from '../../document/types'

/**
 * In-page search execution (ADR-007; ui-spec §3.4; T-43, R17).
 *
 * Semantics are frozen by ADR-007 §Decision:
 * - literal substring only — no regex, no Unicode normalization, no tokenizing;
 * - `caseSensitive=false` folds both sides with the single `foldLower` helper:
 *   Unicode default lowercase applied per code point, matching the Rust
 *   `search_source` service (F-32-1; whole-string `toLowerCase` would apply the
 *   context-sensitive Final_Sigma rule and diverge). A length-changing fold on
 *   exotic code points (İ) is accepted by the ADR; the scan clamps to the text
 *   bounds;
 * - body scope searches the flat `SearchSegment[]` produced by the render
 *   pipeline (readable text, code, inline code, image alt, formula source,
 *   visible raw-HTML text); the source scope scans the decoded raw text, which
 *   also covers content removed by sanitize (R17 "源码范围搜索解码原文");
 * - results stay in document order.
 */

export type SearchScope = 'body' | 'source'

/** A hit inside one `SearchSegment` (body scope). */
export interface BodySearchHit {
  kind: 'body'
  blockId: string
  segId: string
  segmentKind: SegmentKind
  /** Match range inside `segment.text`, UTF-16 code units. */
  startInSegment: number
  endInSegment: number
  /** Document-order key: UTF-16 offset of the match start in the raw text. */
  order: number
}

/** A hit in the decoded raw text (source scope). */
export interface SourceSearchHit {
  kind: 'source'
  startByte: number
  endByte: number
  /** 1-based line of the match start. */
  lineNumber: number
}

export type SearchHit = BodySearchHit | SourceSearchHit

export interface MatchRange {
  start: number
  end: number
}

/** True for a formula-source hit ("公式源码匹配", ADR-007 §Decision 7). */
export function isFormulaHit(hit: SearchHit): boolean {
  return hit.kind === 'body' && hit.segmentKind === 'math'
}

export function hitKey(hit: SearchHit): string {
  return hit.kind === 'body'
    ? `body:${hit.segId}:${hit.startInSegment}`
    : `source:${hit.startByte}`
}

/**
 * Unicode default lowercase applied per code point — the single folding rule
 * for all in-page search (F-32-1, wp-32a).
 *
 * The Rust `search_source` service folds per code point with
 * `char::to_lowercase`. Whole-string `String.prototype.toLowerCase` must not be
 * used because it additionally applies the context-sensitive Final_Sigma rule
 * (Σ at a word end → ς), which made the two implementations disagree on the
 * `ΟΔΟΣ` vector. Final_Sigma is the only context-sensitive default-lowercase
 * rule in Unicode SpecialCasing, so strings without U+03A3 fold identically
 * under both strategies and take the native fast path.
 *
 * Length-changing folds (İ → i + combining dot) are accepted by ADR-007; the
 * literal scan clamps match ranges back to the original text bounds.
 */
export function foldLower(value: string): string {
  if (!value.includes('\u03A3')) return value.toLowerCase()
  let folded = ''
  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index) ?? 0
    folded += String.fromCodePoint(codePoint).toLowerCase()
    index += codePoint > 0xffff ? 2 : 1
  }
  return folded
}

function fold(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : foldLower(value)
}

/**
 * All literal occurrences of `query` in `text`, in order.
 * An empty query never matches (results must not show 0/0 for a blank input).
 */
export function findMatchRanges(
  text: string,
  query: string,
  caseSensitive: boolean,
): MatchRange[] {
  if (text.length === 0 || query.length === 0) return []
  const haystack = fold(text, caseSensitive)
  const needle = fold(query, caseSensitive)
  if (needle.length === 0) return []
  const ranges: MatchRange[] = []
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    const end = Math.min(index + needle.length, text.length)
    ranges.push({ start: index, end })
    index = haystack.indexOf(needle, index + Math.max(1, needle.length))
  }
  return ranges
}

/** Body-scope scan over the pipeline segments, sorted in document order. */
export function findBodyHits(
  segments: readonly SearchSegment[],
  query: string,
  caseSensitive: boolean,
): BodySearchHit[] {
  const hits: BodySearchHit[] = []
  for (const segment of segments) {
    for (const range of findMatchRanges(segment.text, query, caseSensitive)) {
      hits.push({
        kind: 'body',
        blockId: segment.blockId,
        segId: segment.segId,
        segmentKind: segment.kind,
        startInSegment: range.start,
        endInSegment: range.end,
        order: segment.startUtf16 + range.start,
      })
    }
  }
  hits.sort((left, right) => left.order - right.order)
  return hits
}

/** Source-scope scan over the decoded raw text (byte offsets + line numbers). */
export function findSourceHits(
  rawText: string,
  query: string,
  caseSensitive: boolean,
): SourceSearchHit[] {
  const ranges = findMatchRanges(rawText, query, caseSensitive)
  if (ranges.length === 0) return []
  // One shared index per query (F-32-3): the previous per-hit conversions
  // restarted from the text start (byte offset + line prefix), making a dense
  // first query O(hits × length). The index answers every hit in one pass.
  const offsets = createSourceOffsetIndex(rawText)
  return ranges.map((range) => ({
    kind: 'source',
    startByte: offsets.utf16ToByte(range.start),
    endByte: offsets.utf16ToByte(range.end),
    lineNumber: offsets.lineAtUtf16(range.start),
  }))
}

/**
 * Adapts the >50MiB `search_source` result (contract §8 command 38) to the
 * common hit shape. `complete=false` is preserved by the caller — partial
 * results must never be presented as complete (R29; IX15).
 */
export function sourceHitsFromResult(matches: readonly {
  startByte: number
  endByte: number
  lineNumber: number
}[]): SourceSearchHit[] {
  return matches.map((match) => ({
    kind: 'source',
    startByte: match.startByte,
    endByte: match.endByte,
    lineNumber: match.lineNumber,
  }))
}

/**
 * Visible snippet for the result list. Body hits slice the segment text;
 * source hits slice the raw text through the byte offsets. Windowed source
 * mode has no in-memory text — the caller shows the line number instead.
 *
 * `offsetIndex` is optional: pass the document's shared `SourceOffsetIndex`
 * (built for the same `rawText`) so a 200-row result list does not rescan the
 * text twice per row (F-32-3). Without it the standalone converter is used.
 */
export function hitSnippet(
  hit: SearchHit,
  options: {
    segments: readonly SearchSegment[]
    rawText: string | null
    maxLength?: number
    offsetIndex?: SourceOffsetIndex | null
  },
): string | null {
  const maxLength = options.maxLength ?? 120
  if (hit.kind === 'body') {
    const segment = options.segments.find((candidate) => candidate.segId === hit.segId)
    if (!segment) return null
    const text = segment.text
    const contextRadius = 24
    const start = Math.max(0, hit.startInSegment - contextRadius)
    const end = Math.min(text.length, hit.endInSegment + contextRadius)
    const prefix = start > 0 ? '…' : ''
    const suffix = end < text.length ? '…' : ''
    return `${prefix}${text.slice(start, end).slice(0, maxLength)}${suffix}`
  }
  if (options.rawText === null) return null
  const text = options.rawText
  const index = options.offsetIndex ?? null
  const start = index ? index.byteToUtf16(hit.startByte) : utf8ByteOffsetToUtf16Index(text, hit.startByte)
  const end = index ? index.byteToUtf16(hit.endByte) : utf8ByteOffsetToUtf16Index(text, hit.endByte)
  const contextRadius = 24
  const from = Math.max(0, start - contextRadius)
  const to = Math.min(text.length, end + contextRadius)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  return `${prefix}${text.slice(from, to).slice(0, maxLength)}${suffix}`
}
