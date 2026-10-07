import { describe, expect, it } from 'vitest'

import type { BlockRecord } from '../../../document/types'
import {
  blockRangeFor,
  byteOffsetForLine,
  countLines,
  findBlockForByteOffset,
  findVisibleBlockId,
  lineForByteOffset,
  resolveReturnTarget,
} from './mapping'

/**
 * Source position mapping (ui-spec §3.5; T-45, R18): UTF-8 byte ↔ line
 * conversions across CJK/emoji, block lookup and the explicit return-mapping
 * fallback.
 */

function block(blockId: string, startByte: number, endByte: number): BlockRecord {
  return {
    blockId,
    kind: 'paragraph',
    headingPath: [],
    sourceRange: { startUtf16: startByte, endUtf16: endByte },
    sourceRangeBytes: { startByte, endByte },
    fingerprint: 'fp1:test',
    segIds: [],
  }
}

describe('source mapping helpers', () => {
  it('counts lines including the trailing empty line', () => {
    expect(countLines('')).toBe(1)
    expect(countLines('a\nb')).toBe(2)
    expect(countLines('a\nb\n')).toBe(3)
  })

  it('maps UTF-8 byte offsets to lines across CJK and emoji', () => {
    const cjk = '标题\nabc'
    // '标题' = 6 bytes + '\n' = line 2 starts at byte 7.
    expect(lineForByteOffset(cjk, 0)).toBe(1)
    expect(lineForByteOffset(cjk, 6)).toBe(1)
    expect(lineForByteOffset(cjk, 7)).toBe(2)
    expect(byteOffsetForLine(cjk, 2)).toBe(7)

    const emoji = '😀x\nb'
    // '😀' = 4 bytes + 'x' = byte 6 is the line-2 start.
    expect(byteOffsetForLine(emoji, 2)).toBe(6)
    expect(lineForByteOffset(emoji, 6)).toBe(2)
  })

  it('finds the containing block and resolves return targets explicitly', () => {
    const blocks = [block('b1', 0, 10), block('b2', 10, 20)]
    expect(findBlockForByteOffset(blocks, 5)?.blockId).toBe('b1')
    expect(findBlockForByteOffset(blocks, 10)?.blockId).toBe('b2')
    expect(findBlockForByteOffset(blocks, 25)).toBeNull()
    expect(blockRangeFor(blocks, 'b2')).toEqual({ startByte: 10, endByte: 20 })
    expect(blockRangeFor(blocks, null)).toBeNull()

    expect(
      resolveReturnTarget({ blocks, rawText: 'x', byteOffset: 12, savedAnchorBlockId: 'b1' }),
    ).toEqual({ kind: 'block', blockId: 'b2' })
    expect(
      resolveReturnTarget({ blocks, rawText: 'x', byteOffset: 99, savedAnchorBlockId: 'b1' }),
    ).toEqual({ kind: 'fallback', blockId: 'b1' })
    expect(
      resolveReturnTarget({ blocks, rawText: null, byteOffset: null, savedAnchorBlockId: null }),
    ).toEqual({ kind: 'none', blockId: null })
  })

  it('maps the current reading position to a visible block id', () => {
    const container = document.createElement('div')
    for (const [id, top] of [
      ['b1', 0],
      ['b2', 120],
      ['b3', 300],
    ] as const) {
      const child = document.createElement('div')
      child.dataset.blockId = id
      child.getBoundingClientRect = () =>
        ({ top, left: 0, bottom: top + 100, right: 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
      container.appendChild(child)
    }
    container.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 400, right: 100, width: 100, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

    expect(findVisibleBlockId(container, 80)).toBe('b1')
    expect(findVisibleBlockId(container, 150)).toBe('b2')
    expect(findVisibleBlockId(container, 1000)).toBe('b3')
    expect(findVisibleBlockId(null)).toBeNull()
  })
})
