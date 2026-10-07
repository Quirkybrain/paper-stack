import { describe, expect, it } from 'vitest'

import { createSourceOffsetIndex } from '../../document/source-map'
import type { SearchSegment } from '../../document/types'
import {
  findBodyHits,
  findMatchRanges,
  findSourceHits,
  foldLower,
  hitSnippet,
  isFormulaHit,
  sourceHitsFromResult,
} from './search-core'

/**
 * Search semantics oracle (ADR-007; rendering-pipeline §2.4c; SRS §5.3):
 * literal substring, per-code-point `foldLower`, no normalization, document
 * order. CJK, emoji and CRLF vectors mirror the source-map unit edges.
 */

function segment(overrides: Partial<SearchSegment> & Pick<SearchSegment, 'text'>): SearchSegment {
  return {
    segId: 's1',
    blockId: 'b1',
    kind: 'text',
    startUtf16: 0,
    endUtf16: overrides.text.length,
    ...overrides,
  }
}

describe('findMatchRanges', () => {
  it('matches literal substrings in order and never treats them as patterns', () => {
    expect(findMatchRanges('a.b a-b a*b', 'a.b', true)).toEqual([{ start: 0, end: 3 }])
    expect(findMatchRanges('aba aba', 'aba', true)).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ])
  })

  it('folds both sides only when case-insensitive', () => {
    expect(findMatchRanges('React and react', 'react', false)).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
    ])
    expect(findMatchRanges('React and react', 'react', true)).toEqual([{ start: 10, end: 15 }])
  })

  it('returns nothing for an empty query', () => {
    expect(findMatchRanges('anything', '', false)).toEqual([])
  })

  it('folds Greek sigma per code point, not with Final_Sigma context (F-32-1)', () => {
    // Whole-string toLowerCase would fold 'ΟΔΟΣ' to 'οδος' (final ς) and match
    // both words; the Rust-parity fold yields 'οδοσ', so only the word that is
    // already final-sigma matches the query.
    expect(findMatchRanges('ΟΔΟΣ οδος', 'οδος', false)).toEqual([{ start: 5, end: 9 }])
    expect(findMatchRanges('ΟΔΟΣ οδος', 'οδοσ', false)).toEqual([{ start: 0, end: 4 }])
  })
})

describe('foldLower (single shared folding helper)', () => {
  it('does not apply the context-sensitive Final_Sigma rule', () => {
    expect(foldLower('ΟΔΟΣ οδος')).toBe('οδοσ οδος')
    expect(foldLower('Σ')).toBe('σ')
  })

  it('agrees with whole-string toLowerCase when no U+03A3 is present', () => {
    for (const value of ['Straße STRASSE ẞ', 'K k Å å', 'İstanbul', '前缀🚀中文', 'e\u0301']) {
      expect(foldLower(value)).toBe(value.toLowerCase())
    }
  })

  it('keeps the accepted length-changing İ fold', () => {
    expect(foldLower('İ')).toBe('i\u0307')
  })
})

describe('findBodyHits', () => {
  const segments: SearchSegment[] = [
    segment({ segId: 's1', blockId: 'b1', text: '第一段 match 结尾', startUtf16: 0 }),
    segment({ segId: 's2', blockId: 'b1', kind: 'inline-code', text: 'const match = 1', startUtf16: 20 }),
    segment({ segId: 's3', blockId: 'b2', kind: 'math', text: 'match^2', startUtf16: 40 }),
  ]

  it('finds short CJK queries with in-segment offsets', () => {
    const hits = findBodyHits(segments, '段', false)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ segId: 's1', startInSegment: 2, endInSegment: 3 })
  })

  it('covers code, inline code and formula-source segments in document order', () => {
    const hits = findBodyHits(segments, 'match', false)
    expect(hits.map((hit) => hit.segId)).toEqual(['s1', 's2', 's3'])
    expect(hits.map((hit) => hit.order)).toEqual([4, 26, 40])
  })

  it('reports every occurrence inside one segment', () => {
    const hits = findBodyHits([segment({ text: 'match match' })], 'match', false)
    expect(hits).toHaveLength(2)
    expect(hits[1].startInSegment).toBe(6)
  })

  it('is case-sensitive on demand (ADR-007: literal + toLowerCase only)', () => {
    expect(findBodyHits([segment({ text: 'Match' })], 'match', true)).toEqual([])
    expect(findBodyHits([segment({ text: 'Match' })], 'match', false)).toHaveLength(1)
  })

  it('marks formula-source hits for the 公式源码匹配 label', () => {
    const [hit] = findBodyHits([segments[2]], 'match', false)
    expect(isFormulaHit(hit)).toBe(true)
    expect(isFormulaHit(findBodyHits([segments[0]], 'match', false)[0])).toBe(false)
  })

  it('keeps emoji and combining-character offsets exact', () => {
    const text = '前缀😀e\u0301 match'
    const [hit] = findBodyHits([segment({ text })], 'match', false)
    expect(text.slice(hit.startInSegment, hit.endInSegment)).toBe('match')
  })
})

describe('findSourceHits', () => {
  it('scans the decoded raw text with UTF-8 byte offsets and 1-based lines', () => {
    const raw = 'a中b中c'
    const hits = findSourceHits(raw, '中', false)
    expect(hits).toEqual([
      { kind: 'source', startByte: 1, endByte: 4, lineNumber: 1 },
      { kind: 'source', startByte: 5, endByte: 8, lineNumber: 1 },
    ])
  })

  it('covers content that sanitize removed from the rendered body', () => {
    const raw = '第一行\n<div><script>hiddenSecret()</script>show</div>\n'
    const hits = findSourceHits(raw, 'hiddenSecret', false)
    expect(hits).toHaveLength(1)
    expect(hits[0].lineNumber).toBe(2)
  })

  it('is case-insensitive by default and case-sensitive on demand', () => {
    expect(findSourceHits('Secret secret', 'secret', false)).toHaveLength(2)
    expect(findSourceHits('Secret secret', 'secret', true)).toHaveLength(1)
  })

  it('maps dense multi-hit results exactly through one shared index (F-32-3)', () => {
    const raw = '段落0 段落1\n段落2 段落3\n'
    const hits = findSourceHits(raw, '段落', false)
    expect(hits.map((hit) => [hit.startByte, hit.endByte, hit.lineNumber])).toEqual([
      [0, 6, 1],
      [8, 14, 1],
      [16, 22, 2],
      [24, 30, 2],
    ])
  })
})

describe('sourceHitsFromResult', () => {
  it('passes contract matches through in document order', () => {
    const hits = sourceHitsFromResult([
      { startByte: 0, endByte: 3, lineNumber: 1 },
      { startByte: 9, endByte: 12, lineNumber: 4 },
    ])
    expect(hits.map((hit) => hit.startByte)).toEqual([0, 9])
  })
})

describe('hitSnippet', () => {
  it('slices body segments and source raw text with context', () => {
    const body = hitSnippet(
      findBodyHits([segment({ text: 'before match after' })], 'match', false)[0],
      { segments: [segment({ text: 'before match after' })], rawText: null },
    )
    expect(body).toContain('match')

    const raw = 'line one\nline two with match here\nline three'
    const source = hitSnippet(findSourceHits(raw, 'match', false)[0], {
      segments: [],
      rawText: raw,
    })
    expect(source).toContain('match')
  })

  it('returns null for windowed source text without rawText', () => {
    const snippet = hitSnippet(
      { kind: 'source', startByte: 0, endByte: 3, lineNumber: 1 },
      { segments: [], rawText: null },
    )
    expect(snippet).toBeNull()
  })

  it('produces identical snippets with or without a shared offset index', () => {
    const raw = 'line one\nline two with match here\n'
    const hit = findSourceHits(raw, 'match', false)[0]
    const plain = hitSnippet(hit, { segments: [], rawText: raw })
    const indexed = hitSnippet(hit, {
      segments: [],
      rawText: raw,
      offsetIndex: createSourceOffsetIndex(raw),
    })
    expect(indexed).toBe(plain)
    expect(indexed).toContain('match')
  })
})
