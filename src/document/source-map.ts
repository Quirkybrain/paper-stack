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
