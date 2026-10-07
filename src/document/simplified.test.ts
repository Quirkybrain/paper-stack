import { describe, expect, it } from 'vitest'

import { annotateTree } from './annotate'
import { parseDocument } from './pipeline'
import {
  parseSimplifiedDocument,
  shouldUseSimplifiedFastPath,
  SIMPLIFIED_FAST_PATH_MIN_UTF16,
} from './simplified'
import { utf16RangeToUtf8Bytes, utf8ByteLength } from './source-map'

/**
 * Simplified fast-path tests (rendering-pipeline §5; R29/AT29; D-IT-3).
 * Functional coverage of the linear scanner plus the frozen selection rule:
 * small simplified documents still run the full pipeline subset.
 */

const SAMPLE = [
  '# 标题',
  '',
  '第一段文本 with **markup** and `code`.',
  '',
  '## 标题',
  '',
  '第二段。',
  '',
  '- 项目一',
  '- 项目二',
  '',
  '> 引用行一',
  '> 引用行二',
  '',
  '```rust',
  'fn main() {',
  '    println!("hi");',
  '}',
  '```',
  '',
  '| 列 | 值 |',
  '| --- | --- |',
  '| a | b |',
  '',
  '---',
  '',
  '<div>原始文本</div>',
].join('\n')

describe('parseSimplifiedDocument', () => {
  it('scans basic structure into blocks, outline and hast without engines', () => {
    const result = parseSimplifiedDocument(SAMPLE)
    expect(result.status).toBe('ok')
    expect(result.diagnostics).toEqual([])
    expect(result.blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'paragraph',
      'list',
      'blockquote',
      'code',
      'table',
      'hr',
      'html',
    ])
    expect(result.outline.map((entry) => entry.level)).toEqual([1, 2])
    expect(result.outline[0]?.text).toBe('标题')
    expect(result.outline[0]?.anchorId).not.toBe(result.outline[1]?.anchorId)
    for (const entry of result.outline) expect(entry.anchorId).toMatch(/^ps-h-/)
    expect(result.stats.blockCount).toBe(10)
    expect(result.stats.headingCount).toBe(2)
    expect(result.stats.charsUtf16).toBe(SAMPLE.length)
    expect(result.stats.bytesUtf8).toBe(utf8ByteLength(SAMPLE))
  })

  it('keeps every segment an exact slice of the document text', () => {
    const result = parseSimplifiedDocument(SAMPLE)
    for (const segment of result.segments) {
      expect(SAMPLE.slice(segment.startUtf16, segment.endUtf16)).toBe(segment.text)
      expect(result.blocks.some((block) => block.blockId === segment.blockId)).toBe(true)
    }
    for (const block of result.blocks) {
      expect(block.sourceRangeBytes).toEqual(utf16RangeToUtf8Bytes(SAMPLE, block.sourceRange))
      expect(block.segIds.length).toBe(
        result.segments.filter((segment) => segment.blockId === block.blockId).length,
      )
      expect(block.fingerprint).toMatch(/^fp1:[0-9a-f]{16}$/)
    }
  })

  it('renders code fences as a copy-capable code-block wrapper with an exact payload', () => {
    const result = parseSimplifiedDocument(SAMPLE)
    const codeBlock = result.blocks.find((block) => block.kind === 'code')
    expect(codeBlock).toBeDefined()
    const segments = result.segments.filter(
      (segment) => segment.blockId === codeBlock?.blockId,
    )
    expect(segments).toHaveLength(1)
    expect(segments[0]?.kind).toBe('code')
    expect(segments[0]?.text).toBe('fn main() {\n    println!("hi");\n}')

    // Same trusted wrapper shape the Shiki engine produces, so the reader's
    // CodeBlock copy/wrap UI (and its exact payload) works without Shiki.
    const wrapper = result.hast?.children.find(
      (child) => child.type === 'element' && child.tagName === 'div',
    )
    if (wrapper?.type !== 'element') throw new Error('code wrapper missing')
    expect(wrapper.properties.className).toEqual(['code-block'])
    expect(wrapper.properties.dataLanguage).toBe('rust')
    const pre = wrapper.children[0]
    expect(pre?.type).toBe('element')
    if (pre?.type === 'element') {
      expect(pre.tagName).toBe('pre')
      const code = pre.children[0]
      expect(code?.type).toBe('element')
      if (code?.type === 'element') {
        expect(code.tagName).toBe('code')
        expect(code.properties.className).toEqual(['language-rust'])
        expect(code.children[0]).toMatchObject({ type: 'text', value: segments[0]?.text })
      }
    }
  })

  it('renders lists, blockquotes and tables as plain structure', () => {
    const result = parseSimplifiedDocument(SAMPLE)
    const list = result.hast?.children.find(
      (child) => child.type === 'element' && child.tagName === 'ul',
    )
    if (list?.type !== 'element') throw new Error('list element missing')
    expect(list.children).toHaveLength(2)
    const quote = result.hast?.children.find(
      (child) => child.type === 'element' && child.tagName === 'blockquote',
    )
    if (quote?.type !== 'element') throw new Error('blockquote element missing')
    expect(quote.children).toHaveLength(2)
    const table = result.hast?.children.find(
      (child) => child.type === 'element' && child.tagName === 'pre',
    )
    expect(table?.type).toBe('element')
  })

  it('keeps CJK, emoji and CRLF text exact and byte-mapped', () => {
    const text = '# 中文\r\n\r\n😀 emoji text\r\nsecond line\r\n'
    const result = parseSimplifiedDocument(text)
    expect(result.blocks).toHaveLength(2)
    for (const segment of result.segments) {
      expect(text.slice(segment.startUtf16, segment.endUtf16)).toBe(segment.text)
    }
    expect(result.segments.some((segment) => segment.text.includes('😀 emoji text'))).toBe(true)
    const paragraph = result.blocks[1]
    expect(paragraph?.sourceRangeBytes).toEqual(utf16RangeToUtf8Bytes(text, paragraph.sourceRange))
  })

  it('treats an unclosed fence as a code block through end of file', () => {
    const text = '```\nunclosed\n'
    const result = parseSimplifiedDocument(text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.kind).toBe('code')
    expect(result.segments[0]?.text).toBe('unclosed')
  })

  it('produces zero blocks for an empty or whitespace-only document', () => {
    for (const text of ['', '\n\n   \n']) {
      const result = parseSimplifiedDocument(text)
      expect(result.status).toBe('ok')
      expect(result.blocks).toEqual([])
      expect(result.segments).toEqual([])
      expect(result.hast?.children).toEqual([])
    }
  })

  it('covers every search needle token exactly once across segments', () => {
    const units: string[] = []
    for (let i = 0; i < 400; i += 1) {
      units.push(
        `## 章节 ${i}\n\n混合段落 ${i}: needle-${i} token.\n\n- item-${i}\n- second-${i}\n\n\`\`\`text\ncode-${i}\n\`\`\`\n`,
      )
    }
    const text = units.join('\n')
    const result = parseSimplifiedDocument(text)
    for (let i = 0; i < 400; i += 1) {
      const hits = result.segments.filter((segment) => segment.text.includes(`needle-${i} `))
      expect(hits).toHaveLength(1)
      expect(text.slice(hits[0]?.startUtf16 ?? 0, hits[0]?.endUtf16 ?? 0)).toBe(hits[0]?.text)
    }
    // Every code payload stays exact (copy completeness, R11/R29).
    const code = result.segments.filter((segment) => segment.kind === 'code')
    expect(code).toHaveLength(400)
    for (let i = 0; i < 400; i += 1) expect(code[i]?.text).toBe(`code-${i}`)
  })

  it('annotates its hast with block sections and segment ids', () => {
    const result = parseSimplifiedDocument(SAMPLE)
    if (result.hast === null) throw new Error('hast missing')
    const annotated = annotateTree(result.hast, {
      blocks: result.blocks,
      segments: result.segments,
      blockLimit: 24,
    })
    const first = annotated.children[0]
    if (first?.type !== 'element') throw new Error('first annotated element missing')
    expect(first.tagName).toBe('section')
    expect(first.properties.dataBlockId).toBe('b1')
    expect(first.properties.dataSrcStart).toBe(0)
    const instrumented = JSON.stringify(annotated)
    expect(instrumented).toContain('dataSegId')
  })
})

describe('simplified fast-path selection (D-IT-3)', () => {
  it('selects the fast path only above the frozen size threshold', () => {
    expect(SIMPLIFIED_FAST_PATH_MIN_UTF16).toBe(1024 * 1024)
    expect(shouldUseSimplifiedFastPath('x'.repeat(SIMPLIFIED_FAST_PATH_MIN_UTF16))).toBe(false)
    expect(shouldUseSimplifiedFastPath('x'.repeat(SIMPLIFIED_FAST_PATH_MIN_UTF16 + 1))).toBe(true)
  })

  it('keeps the exact pipeline subset for small simplified documents', async () => {
    const small = '行内 $y$ 文本 with `code`.\n'
    expect(shouldUseSimplifiedFastPath(small)).toBe(false)
    const simplified = await parseDocument(small, { simplified: true })
    // The full subset segments inline math/code; the fast path has one text
    // segment. Multi-kind output proves the pipeline branch was kept.
    expect(simplified.segments.length).toBeGreaterThan(1)
    expect(simplified.segments.some((segment) => segment.kind === 'math')).toBe(true)
    expect(simplified.segments.some((segment) => segment.kind === 'inline-code')).toBe(true)
  })

  it('routes large simplified parses through the linear fast path', async () => {
    const unit = '## 章节\n\n正文段落 needle-0。\n\n- 项目一\n- 项目二\n\n```rust\nfn sample() {}\n```\n\n'
    const text = unit.repeat(Math.ceil((SIMPLIFIED_FAST_PATH_MIN_UTF16 + 1024) / unit.length))
    expect(shouldUseSimplifiedFastPath(text)).toBe(true)
    const throughPipeline = await parseDocument(text, { simplified: true })
    const direct = parseSimplifiedDocument(text)
    expect(throughPipeline.status).toBe('ok')
    expect(throughPipeline.blocks.length).toBe(direct.blocks.length)
    expect(throughPipeline.blocks[0]).toEqual(direct.blocks[0])
    expect(throughPipeline.blocks[throughPipeline.blocks.length - 1]).toEqual(
      direct.blocks[direct.blocks.length - 1],
    )
    expect(throughPipeline.segments.length).toBe(direct.segments.length)
    expect(throughPipeline.segments[0]).toEqual(direct.segments[0])
    expect(throughPipeline.outline).toEqual(direct.outline)
    expect(throughPipeline.stats).toEqual(direct.stats)
    // All decoded text participates in the search index (R29).
    expect(throughPipeline.stats.charsUtf16).toBe(text.length)
    expect(throughPipeline.segments.length).toBeGreaterThan(0)
  })

  it('stays within a linear budget on an 11MiB-class corpus', { timeout: 20_000 }, async () => {
    const chunk =
      '## 章节 {i}\n\n混合段落 {i}: deterministic mixed CN/EN payload with `inline code` and search marker needle-{i}.\n\n' +
      '段落 {j}: English sentence with numbers 0123456789 and CJK 汉字文本用于精确字节边界。\n\n' +
      '- item-{i} alpha\n- item-{i} beta 中文列表\n\n' +
      '```rust\nfn sample() -> u32 {\n    42 // fixed code block\n}\n```\n\n' +
      '| 列 | value |\n| --- | --- |\n| {i} | cell-{i} |\n'
    const chunks: string[] = []
    let bytes = 0
    let index = 0
    while (bytes < 11 * 1024 * 1024) {
      const piece = chunk.replaceAll('{i}', String(index)).replaceAll('{j}', String(index + 1))
      chunks.push(piece)
      bytes += utf8ByteLength(piece)
      index += 1
    }
    const text = chunks.join('\n')
    const started = performance.now()
    const result = parseSimplifiedDocument(text)
    const elapsed = performance.now() - started
    expect(result.status).toBe('ok')
    expect(result.stats.bytesUtf8).toBeGreaterThanOrEqual(11 * 1024 * 1024)
    expect(result.stats.charsUtf16).toBe(text.length)
    expect(result.blocks.length).toBeGreaterThan(10_000)
    // The fast path is linear; the full pipeline needs minutes at this size.
    expect(elapsed).toBeLessThan(10_000)
  })
})
