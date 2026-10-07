import {
  utf16IndexToUtf8ByteOffset,
  utf8ByteOffsetToUtf16Index,
} from '../../document/source-map'
import type { SearchSegment, SegmentKind } from '../../document/types'
import { countLines } from '../reader/source/mapping'

/**
 * In-page search execution (ADR-007; ui-spec §3.4; T-43, R17).
 *
 * Semantics are frozen by ADR-007 §Decision:
 * - literal substring only — no regex, no Unicode normalization, no tokenizing;
 * - `caseSensitive=false` folds both sides with `toLowerCase` exactly (a
 *   length-changing fold on exotic code points is accepted by the ADR; the
 *   scan clamps to the text bounds);
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

function fold(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase()
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
  return findMatchRanges(rawText, query, caseSensitive).map((range) => ({
    kind: 'source',
    startByte: utf16IndexToUtf8ByteOffset(rawText, range.start),
    endByte: utf16IndexToUtf8ByteOffset(rawText, range.end),
    lineNumber: countLines(rawText.slice(0, range.start)),
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
 */
export function hitSnippet(
  hit: SearchHit,
  options: {
    segments: readonly SearchSegment[]
    rawText: string | null
    maxLength?: number
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
  const start = utf8ByteOffsetToUtf16Index(text, hit.startByte)
  const end = utf8ByteOffsetToUtf16Index(text, hit.endByte)
  const contextRadius = 24
  const from = Math.max(0, start - contextRadius)
  const to = Math.min(text.length, end + contextRadius)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  return `${prefix}${text.slice(from, to).slice(0, maxLength)}${suffix}`
}
