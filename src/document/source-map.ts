import type { Position } from 'unist'

import type { SourceRangeBytes, SourceRangeUtf16 } from './types'

/**
 * UTF-16 ↔ UTF-8 offset helpers (contracts §1.2; rendering-pipeline §3 item 3;
 * SRS §5.3). Unit edges are covered by CJK, emoji, combining-character and
 * CRLF vectors in `source-map.test.ts`.
 *
 * A lone surrogate is not valid Unicode; it is counted (and encoded) as
 * U+FFFD, matching `TextEncoder` and the Rust UTF-8 decoder's replacement
 * behavior. Offsets are clamped to the text bounds.
 */

const REPLACEMENT_BYTE_LENGTH = 3

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/** UTF-8 width and UTF-16 width of the code point starting at `index`. */
function codePointWidth(text: string, index: number): { bytes: number; units: number } {
  const first = text.charCodeAt(index)
  if (Number.isNaN(first)) return { bytes: 0, units: 0 }
  if (
    isHighSurrogate(first) &&
    index + 1 < text.length &&
    isLowSurrogate(text.charCodeAt(index + 1))
  ) {
    return { bytes: 4, units: 2 }
  }
  if (isHighSurrogate(first) || isLowSurrogate(first)) {
    return { bytes: REPLACEMENT_BYTE_LENGTH, units: 1 }
  }
  if (first < 0x80) return { bytes: 1, units: 1 }
  if (first < 0x800) return { bytes: 2, units: 1 }
  return { bytes: 3, units: 1 }
}

/** Total UTF-8 byte length of `text` (lone surrogates count as U+FFFD). */
export function utf8ByteLength(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length;) {
    const width = codePointWidth(text, index)
    bytes += width.bytes
    index += width.units
  }
  return bytes
}

/** UTF-8 encode `text` (lone surrogates become U+FFFD, like `TextEncoder`). */
export function utf8Encode(text: string): Uint8Array {
  const result = new Uint8Array(utf8ByteLength(text))
  let byteIndex = 0
  for (let index = 0; index < text.length;) {
    const first = text.charCodeAt(index)
    let codePoint = first
    let units = 1
    if (
      isHighSurrogate(first) &&
      index + 1 < text.length &&
      isLowSurrogate(text.charCodeAt(index + 1))
    ) {
      codePoint = (first - 0xd800) * 0x400 + (text.charCodeAt(index + 1) - 0xdc00) + 0x10000
      units = 2
    } else if (isHighSurrogate(first) || isLowSurrogate(first)) {
      codePoint = 0xfffd
    }

    if (codePoint < 0x80) {
      result[byteIndex++] = codePoint
    } else if (codePoint < 0x800) {
      result[byteIndex++] = 0xc0 | (codePoint >> 6)
      result[byteIndex++] = 0x80 | (codePoint & 0x3f)
    } else if (codePoint < 0x10000) {
      result[byteIndex++] = 0xe0 | (codePoint >> 12)
      result[byteIndex++] = 0x80 | ((codePoint >> 6) & 0x3f)
      result[byteIndex++] = 0x80 | (codePoint & 0x3f)
    } else {
      result[byteIndex++] = 0xf0 | (codePoint >> 18)
      result[byteIndex++] = 0x80 | ((codePoint >> 12) & 0x3f)
      result[byteIndex++] = 0x80 | ((codePoint >> 6) & 0x3f)
      result[byteIndex++] = 0x80 | (codePoint & 0x3f)
    }

    index += units
  }
  return result
}

/**
 * Convert a UTF-16 code-unit index into a UTF-8 byte offset.
 * An index inside a surrogate pair clamps to the pair start; indexes past the
 * end clamp to the total byte length.
 */
export function utf16IndexToUtf8ByteOffset(text: string, utf16Index: number): number {
  const clamped = Math.max(0, Math.min(utf16Index, text.length))
  let bytes = 0
  for (let index = 0; index < clamped;) {
    const width = codePointWidth(text, index)
    // Stop at a code-point boundary rather than counting half of a pair.
    if (index + width.units > clamped) break
    bytes += width.bytes
    index += width.units
  }
  return bytes
}

/**
 * Convert a UTF-8 byte offset into a UTF-16 code-unit index.
 * An offset inside a code point clamps to that code point's start; offsets past
 * the end clamp to `text.length`.
 */
export function utf8ByteOffsetToUtf16Index(text: string, byteOffset: number): number {
  const target = Math.max(0, byteOffset)
  let bytes = 0
  let index = 0
  while (index < text.length) {
    const width = codePointWidth(text, index)
    if (bytes + width.bytes > target) return index
    bytes += width.bytes
    index += width.units
    if (bytes >= target) return index
  }
  return text.length
}

export function utf16RangeToUtf8Bytes(text: string, range: SourceRangeUtf16): SourceRangeBytes {
  return {
    startByte: utf16IndexToUtf8ByteOffset(text, range.startUtf16),
    endByte: utf16IndexToUtf8ByteOffset(text, range.endUtf16),
  }
}

export function utf8RangeToUtf16(text: string, range: SourceRangeBytes): SourceRangeUtf16 {
  return {
    startUtf16: utf8ByteOffsetToUtf16Index(text, range.startByte),
    endUtf16: utf8ByteOffsetToUtf16Index(text, range.endByte),
  }
}

/**
 * Source range (UTF-8 bytes) of an mdast/hast node. Returns `null` when the
 * node carries no numeric offsets (generated nodes); raw-HTML inner nodes are
 * approximate by contract (rendering-pipeline §3 item 3).
 */
export function nodeSourceRangeBytes(
  text: string,
  node: { position?: Position | null },
): SourceRangeBytes | null {
  const range = positionToUtf16Range(node.position)
  return range ? utf16RangeToUtf8Bytes(text, range) : null
}

/**
 * Extract the UTF-16 offset range of an mdast/hast node position.
 * Returns `null` when the parser did not record numeric offsets.
 */
export function positionToUtf16Range(
  position: Position | null | undefined,
): SourceRangeUtf16 | null {
  const start = position?.start?.offset
  const end = position?.end?.offset
  if (typeof start !== 'number' || typeof end !== 'number') return null
  return { startUtf16: start, endUtf16: end }
}

/**
 * Shared single-pass offset index (F-32-2/F-32-3; wp-32a).
 *
 * The standalone helpers above restart from index 0 on every call, so mapping
 * many offsets of the same document (block ranges, engine source ranges,
 * search hits) costs O(offsets × length) — the parse/query scaling defect in
 * the wp-32 verification report. The index scans the text once, records
 * checkpoints every `CHECKPOINT_INTERVAL` UTF-16 units (byte offset and 1-based
 * LF line at each checkpoint), and then answers each query with a binary
 * search plus a bounded local scan. Total mapping cost is O(length).
 *
 * Clamping and lone-surrogate behavior are identical to the standalone
 * helpers (see their docs); `source-map.test.ts` cross-checks both on the same
 * vectors.
 */
export interface SourceOffsetIndex {
  /** Total UTF-8 byte length (lone surrogates count as U+FFFD). */
  readonly byteLength: number
  /** UTF-16 code-unit index → UTF-8 byte offset (clamps to code-point starts). */
  utf16ToByte(utf16Index: number): number
  /** UTF-8 byte offset → UTF-16 code-unit index (clamps to code-point starts). */
  byteToUtf16(byteOffset: number): number
  /** 1-based line of a UTF-16 index (LF only; the empty document is line 1). */
  lineAtUtf16(utf16Index: number): number
  /** `utf16RangeToUtf8Bytes` through this index. */
  rangeToBytes(range: SourceRangeUtf16): SourceRangeBytes
}

/** Checkpoint spacing: query scans are bounded by this many UTF-16 units. */
const CHECKPOINT_INTERVAL = 256

export function createSourceOffsetIndex(text: string): SourceOffsetIndex {
  const checkpointUtf16: number[] = [0]
  const checkpointBytes: number[] = [0]
  const checkpointLines: number[] = [1]

  let bytes = 0
  let line = 1
  let nextCheckpoint = CHECKPOINT_INTERVAL
  for (let index = 0; index < text.length; ) {
    const width = codePointWidth(text, index)
    // `\n` is BMP; a surrogate half can never equal it, so per-code-point
    // counting matches per-unit counting for the line index.
    if (width.units === 1 && text.charCodeAt(index) === 10) line += 1
    index += width.units
    bytes += width.bytes
    if (index >= nextCheckpoint) {
      const previous = checkpointUtf16[checkpointUtf16.length - 1]
      if (index > previous) {
        checkpointUtf16.push(index)
        checkpointBytes.push(bytes)
        checkpointLines.push(line)
      }
      nextCheckpoint = index + CHECKPOINT_INTERVAL
    }
  }
  // The end is always a checkpoint, so `byteLength` lookups land exactly.
  if (checkpointUtf16[checkpointUtf16.length - 1] < text.length) {
    checkpointUtf16.push(text.length)
    checkpointBytes.push(bytes)
    checkpointLines.push(line)
  }

  // Largest checkpoint whose position is <= `target` (both key arrays are
  // strictly increasing, so this is an exact lower-bound search).
  function slotFor(values: readonly number[], target: number): number {
    let low = 0
    let high = values.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if (values[middle] <= target) low = middle
      else high = middle - 1
    }
    return low
  }

  function utf16ToByte(utf16Index: number): number {
    const clamped = Math.max(0, Math.min(utf16Index, text.length))
    const slot = slotFor(checkpointUtf16, clamped)
    let position = checkpointUtf16[slot]
    let result = checkpointBytes[slot]
    while (position < clamped) {
      const width = codePointWidth(text, position)
      // Stop at a code-point boundary rather than counting half of a pair.
      if (position + width.units > clamped) break
      result += width.bytes
      position += width.units
    }
    return result
  }

  function byteToUtf16(byteOffset: number): number {
    const target = Math.max(0, byteOffset)
    const slot = slotFor(checkpointBytes, target)
    let position = checkpointUtf16[slot]
    let scanned = checkpointBytes[slot]
    while (position < text.length) {
      const width = codePointWidth(text, position)
      if (scanned + width.bytes > target) return position
      scanned += width.bytes
      position += width.units
      if (scanned >= target) return position
    }
    return text.length
  }

  function lineAtUtf16(utf16Index: number): number {
    const clamped = Math.max(0, Math.min(utf16Index, text.length))
    const slot = slotFor(checkpointUtf16, clamped)
    let position = checkpointUtf16[slot]
    let result = checkpointLines[slot]
    while (position < clamped) {
      if (text.charCodeAt(position) === 10) result += 1
      position += 1
    }
    return result
  }

  return {
    byteLength: bytes,
    utf16ToByte,
    byteToUtf16,
    lineAtUtf16,
    rangeToBytes(range: SourceRangeUtf16): SourceRangeBytes {
      return {
        startByte: utf16ToByte(range.startUtf16),
        endByte: utf16ToByte(range.endUtf16),
      }
    },
  }
}
