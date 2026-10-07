import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  utf8ByteLength,
  utf8ByteOffsetToUtf16Index,
  utf16IndexToUtf8ByteOffset,
  utf16RangeToUtf8Bytes,
  utf8RangeToUtf16,
} from '../../src/document/source-map'

/**
 * UTF-16 ↔ UTF-8 fidelity vectors, front-end side (T-61; contracts §1.2;
 * rendering-pipeline §3 item 3; SRS §5.3). The Rust service asserts the same
 * shared vectors are char-boundary exact; the JS-only file pins clamping for
 * invalid/lone-surrogate text that valid Rust UTF-8 cannot contain.
 */

interface Point {
  utf16Index: number
  byteOffset: number
  direction?: 'utf16-to-bytes' | 'bytes-to-utf16'
}

interface SharedVector {
  id: string
  text: string
  points: Point[]
}

interface JsOnlyCase {
  id: string
  text: string
  byteLength?: number
  points: Point[]
}

// Vitest runs from the project root (see tests/contracts/README.md).
const repoRoot = process.cwd()

const shared = JSON.parse(
  readFileSync(join(repoRoot, 'tests/contracts/vectors/utf16-utf8.json'), 'utf8'),
) as { vectors: SharedVector[] }

const jsOnly = JSON.parse(
  readFileSync(join(repoRoot, 'tests/contracts/vectors/utf16-utf8-js-only.json'), 'utf8'),
) as { cases: JsOnlyCase[] }

describe('shared UTF-16/UTF-8 vectors (front-end side)', () => {
  it('file has the expected shape', () => {
    expect(shared.vectors.length).toBeGreaterThanOrEqual(5)
  })

  for (const vector of shared.vectors) {
    it(`${vector.id}: both directions agree with the vector`, () => {
      for (const point of vector.points) {
        expect(
          utf16IndexToUtf8ByteOffset(vector.text, point.utf16Index),
          `${vector.id} utf16 ${point.utf16Index} -> bytes`,
        ).toBe(point.byteOffset)
        expect(
          utf8ByteOffsetToUtf16Index(vector.text, point.byteOffset),
          `${vector.id} bytes ${point.byteOffset} -> utf16`,
        ).toBe(point.utf16Index)
      }
      const last = vector.points[vector.points.length - 1]
      expect(utf8ByteLength(vector.text), `${vector.id} total byte length`).toBe(last.byteOffset)
    })
  }

  it('range helpers are inverses on the vectors', () => {
    for (const vector of shared.vectors) {
      for (const point of vector.points) {
        expect(
          utf8RangeToUtf16(vector.text, {
            startByte: 0,
            endByte: point.byteOffset,
          }),
        ).toEqual({ startUtf16: 0, endUtf16: point.utf16Index })
        const bytes = utf16RangeToUtf8Bytes(vector.text, {
          startUtf16: 0,
          endUtf16: point.utf16Index,
        })
        expect(bytes).toEqual({ startByte: 0, endByte: point.byteOffset })
      }
    }
  })
})

describe('JS-only clamping vectors (invalid text)', () => {
  for (const item of jsOnly.cases) {
    it(`${item.id}: clamps exactly as documented`, () => {
      if (item.byteLength !== undefined) {
        expect(utf8ByteLength(item.text)).toBe(item.byteLength)
      }
      for (const point of item.points) {
        if (point.direction === 'utf16-to-bytes') {
          expect(
            utf16IndexToUtf8ByteOffset(item.text, point.utf16Index),
            `${item.id} utf16 ${point.utf16Index} -> bytes`,
          ).toBe(point.byteOffset)
        } else {
          expect(
            utf8ByteOffsetToUtf16Index(item.text, point.byteOffset),
            `${item.id} bytes ${point.byteOffset} -> utf16`,
          ).toBe(point.utf16Index)
        }
      }
    })
  }
})
