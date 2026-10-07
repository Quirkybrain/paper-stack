import { describe, expect, it } from 'vitest'

import {
  createSourceOffsetIndex,
  nodeSourceRangeBytes,
  positionToUtf16Range,
  utf16IndexToUtf8ByteOffset,
  utf16RangeToUtf8Bytes,
  utf8ByteLength,
  utf8ByteOffsetToUtf16Index,
  utf8Encode,
  utf8RangeToUtf16,
} from './source-map'

describe('utf8ByteLength / utf8Encode', () => {
  it('measures ASCII, CJK, emoji, combining characters and CRLF', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('你好')).toBe(6)
    expect(utf8ByteLength('😀')).toBe(4)
    expect(utf8ByteLength('e\u0301')).toBe(3)
    expect(utf8ByteLength('a\r\nb')).toBe(4)
    expect(utf8ByteLength('')).toBe(0)
  })

  it('encodes to the same bytes as TextEncoder', () => {
    for (const value of ['abc', '你好', 'a😀b', 'e\u0301', 'a\r\nb']) {
      expect([...utf8Encode(value)]).toEqual([...new TextEncoder().encode(value)])
    }
  })
})

describe('utf16IndexToUtf8ByteOffset', () => {
  it('maps ASCII one-to-one', () => {
    expect(utf16IndexToUtf8ByteOffset('abc', 0)).toBe(0)
    expect(utf16IndexToUtf8ByteOffset('abc', 2)).toBe(2)
    expect(utf16IndexToUtf8ByteOffset('abc', 3)).toBe(3)
  })

  it('maps CJK (3 bytes per character)', () => {
    expect(utf16IndexToUtf8ByteOffset('你好', 0)).toBe(0)
    expect(utf16IndexToUtf8ByteOffset('你好', 1)).toBe(3)
    expect(utf16IndexToUtf8ByteOffset('你好', 2)).toBe(6)
  })

  it('maps emoji (surrogate pair, 4 bytes)', () => {
    // 'a😀b': a=0..1, emoji=1..3, b=3..4 (UTF-16)
    expect(utf16IndexToUtf8ByteOffset('a😀b', 0)).toBe(0)
    expect(utf16IndexToUtf8ByteOffset('a😀b', 1)).toBe(1)
    expect(utf16IndexToUtf8ByteOffset('a😀b', 2)).toBe(1)
    expect(utf16IndexToUtf8ByteOffset('a😀b', 3)).toBe(5)
    expect(utf16IndexToUtf8ByteOffset('a😀b', 4)).toBe(6)
  })

  it('maps combining characters (1 byte + 2 bytes)', () => {
    expect(utf16IndexToUtf8ByteOffset('e\u0301', 1)).toBe(1)
    expect(utf16IndexToUtf8ByteOffset('e\u0301', 2)).toBe(3)
  })

  it('maps CRLF byte-for-byte', () => {
    expect(utf16IndexToUtf8ByteOffset('a\r\nb', 3)).toBe(3)
    expect(utf16IndexToUtf8ByteOffset('a\r\nb', 4)).toBe(4)
  })

  it('clamps out-of-range indexes', () => {
    expect(utf16IndexToUtf8ByteOffset('你好', -1)).toBe(0)
    expect(utf16IndexToUtf8ByteOffset('你好', 99)).toBe(6)
  })
})

describe('utf8ByteOffsetToUtf16Index', () => {
  it('inverts utf16IndexToUtf8ByteOffset on every boundary', () => {
    const samples = ['abc', '你好', 'a😀b', 'e\u0301', 'a\r\nb', '混合 mixed 😀 text']
    for (const value of samples) {
      // Every UTF-16 index that is also a code-point boundary must round-trip.
      for (let index = 0; index <= value.length; index += 1) {
        const isContinuation =
          index > 0 &&
          index < value.length &&
          value.charCodeAt(index) >= 0xdc00 &&
          value.charCodeAt(index) <= 0xdfff
        if (isContinuation) continue
        const byteOffset = utf16IndexToUtf8ByteOffset(value, index)
        expect(utf8ByteOffsetToUtf16Index(value, byteOffset)).toBe(index)
      }
    }
  })

  it('clamps offsets inside a code point to its start', () => {
    expect(utf8ByteOffsetToUtf16Index('你好', 1)).toBe(0)
    expect(utf8ByteOffsetToUtf16Index('😀', 2)).toBe(0)
  })

  it('clamps past-the-end offsets', () => {
    expect(utf8ByteOffsetToUtf16Index('abc', 99)).toBe(3)
  })
})

describe('range helpers', () => {
  it('converts a CJK range to bytes and back', () => {
    const text = '前缀中文后缀'
    const range = { startUtf16: 2, endUtf16: 4 }
    const bytes = utf16RangeToUtf8Bytes(text, range)
    expect(bytes).toEqual({ startByte: 6, endByte: 12 })
    expect(utf8RangeToUtf16(text, bytes)).toEqual(range)
  })

  it('extracts node positions as UTF-16 ranges', () => {
    expect(
      positionToUtf16Range({
        start: { line: 1, column: 1, offset: 2 },
        end: { line: 1, column: 4, offset: 5 },
      }),
    ).toEqual({ startUtf16: 2, endUtf16: 5 })
    expect(
      positionToUtf16Range({ start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } as never),
    ).toBeNull()
    expect(positionToUtf16Range(undefined)).toBeNull()
  })

  it('maps mdast/hast nodes to UTF-8 byte ranges', () => {
    const text = '你好 world'
    const node = {
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 3, offset: 2 },
      },
    }
    expect(nodeSourceRangeBytes(text, node)).toEqual({ startByte: 0, endByte: 6 })
    expect(nodeSourceRangeBytes(text, { position: null })).toBeNull()
  })
})

describe('createSourceOffsetIndex (F-32-2 shared single-pass index)', () => {
  const lineCount = (value: string): number => value.split('\n').length

  const samples = [
    '',
    'abc',
    '你好',
    'a😀b',
    'e\u0301',
    'a\r\nb',
    '混合 mixed 😀 text',
    'line1\nline2\nline3',
    '段\n段落😀\n',
  ]

  it('agrees with the standalone converters on every index and byte offset', () => {
    for (const text of samples) {
      const index = createSourceOffsetIndex(text)
      expect(index.byteLength).toBe(utf8ByteLength(text))
      for (let position = 0; position <= text.length; position += 1) {
        const byte = utf16IndexToUtf8ByteOffset(text, position)
        expect(index.utf16ToByte(position)).toBe(byte)
        expect(index.lineAtUtf16(position)).toBe(lineCount(text.slice(0, position)))
      }
      for (let byte = 0; byte <= index.byteLength; byte += 1) {
        expect(index.byteToUtf16(byte)).toBe(utf8ByteOffsetToUtf16Index(text, byte))
      }
    }
  })

  it('stays exact across checkpoint boundaries on a larger mixed text', () => {
    const text = 'a你😀\n'.repeat(300)
    const index = createSourceOffsetIndex(text)
    expect(index.byteLength).toBe(utf8ByteLength(text))
    for (let position = 0; position <= text.length; position += 1) {
      expect(index.utf16ToByte(position)).toBe(utf16IndexToUtf8ByteOffset(text, position))
    }
    for (let byte = 0; byte <= index.byteLength; byte += 7) {
      expect(index.byteToUtf16(byte)).toBe(utf8ByteOffsetToUtf16Index(text, byte))
    }
    expect(index.lineAtUtf16(text.length)).toBe(301)
  })

  it('clamps ranges and offsets exactly like the standalone helpers', () => {
    const text = '你好'
    const index = createSourceOffsetIndex(text)
    expect(index.utf16ToByte(-1)).toBe(0)
    expect(index.utf16ToByte(99)).toBe(6)
    expect(index.byteToUtf16(1)).toBe(0)
    expect(index.byteToUtf16(99)).toBe(2)
    expect(index.lineAtUtf16(-5)).toBe(1)
    expect(index.lineAtUtf16(99)).toBe(1)
    expect(index.rangeToBytes({ startUtf16: 0, endUtf16: 2 })).toEqual({
      startByte: 0,
      endByte: 6,
    })
  })
})
