import type { Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { runMdastTransforms, segmentHeadingPath } from './blocks'

function parse(markdown: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root
}

function transforms(markdown: string) {
  return runMdastTransforms(parse(markdown), markdown)
}

describe('block registry', () => {
  it('assigns stable source-ordered ids and documented kinds', () => {
    const markdown = [
      '# Title',
      '',
      'Paragraph',
      '',
      '- item',
      '',
      '> quote',
      '',
      '```js',
      'const a = 1',
      '```',
      '',
      '```mermaid',
      'graph TD; A-->B',
      '```',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '<details open><summary>s</summary>body</details>',
      '',
      '![alt](x.png)',
      '',
      '---',
      '',
      'ref[^n]',
      '',
      '[^n]: note',
    ].join('\n')

    const { blocks } = transforms(markdown)
    expect(blocks.map((block) => block.blockId)).toEqual(blocks.map((_, index) => `b${index + 1}`))
    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'blockquote',
      'code',
      'mermaid',
      'table',
      'details',
      'image',
      'hr',
      'paragraph',
      'footnote',
    ])
  })

  it('tracks heading paths and includes the heading itself for heading blocks', () => {
    const markdown = ['# A', '', 'intro', '', '## B', '', 'details', '', '### C', '', 'deep'].join(
      '\n',
    )
    const { blocks } = transforms(markdown)
    expect(blocks.map((block) => [block.kind, block.headingPath])).toEqual([
      ['heading', ['A']],
      ['paragraph', ['A']],
      ['heading', ['A', 'B']],
      ['paragraph', ['A', 'B']],
      ['heading', ['A', 'B', 'C']],
      ['paragraph', ['A', 'B', 'C']],
    ])
  })

  it('skips link reference definitions', () => {
    const markdown = ['[ref]: https://example.com', '', 'body'].join('\n')
    const { blocks } = transforms(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ blockId: 'b1', kind: 'paragraph' })
  })

  it('records segment ids per block and keeps hr empty', () => {
    const { blocks } = transforms('alpha\n\n---\n')
    expect(blocks[0].segIds.length).toBeGreaterThan(0)
    expect(blocks[1].kind).toBe('hr')
    expect(blocks[1].segIds).toEqual([])
  })

  it('exposes the heading path for a segment through its block', () => {
    const { blocks, segments } = transforms('# A\n\n## B\n\ntext')
    const paragraphSegment = segments.find((segment) => segment.text === 'text')
    expect(paragraphSegment).toBeDefined()
    expect(segmentHeadingPath(paragraphSegment!, blocks)).toEqual(['A', 'B'])
    expect(segmentHeadingPath({ ...paragraphSegment!, blockId: 'missing' }, blocks)).toEqual([])
  })
})

describe('block fingerprints', () => {
  it('are stable across repeated parses of the same text', () => {
    const markdown = 'alpha\n\nbeta\n'
    expect(transforms(markdown).blocks.map((block) => block.fingerprint)).toEqual(
      transforms(markdown).blocks.map((block) => block.fingerprint),
    )
  })

  it('do not change for earlier blocks when content is appended', () => {
    const before = transforms('alpha\n\nbeta\n')
    const after = transforms('alpha\n\nbeta\n\ngamma\n')
    expect(after.blocks[0].fingerprint).toBe(before.blocks[0].fingerprint)
    expect(after.blocks[1].fingerprint).toBe(before.blocks[1].fingerprint)
  })

  it('ignore inline markup changes because blockSearchText concatenates segments', () => {
    const plain = transforms('alpha beta\n')
    const emphasized = transforms('alpha *beta*\n')
    expect(emphasized.blocks[0].fingerprint).toBe(plain.blocks[0].fingerprint)
  })

  it('normalize CRLF to LF only', () => {
    const crlf = transforms('alpha\r\nbeta\r\n')
    const lf = transforms('alpha\nbeta\n')
    expect(crlf.blocks[0].fingerprint).toBe(lf.blocks[0].fingerprint)
  })

  it('match the fp1: format', () => {
    for (const block of transforms('alpha\n\nbeta').blocks) {
      expect(block.fingerprint).toMatch(/^fp1:[0-9a-f]{16}$/)
    }
  })
})

describe('block source ranges', () => {
  it('carry UTF-16 offsets and matching UTF-8 byte ranges for CJK', () => {
    const markdown = '你好\n\nworld'
    const { blocks } = transforms(markdown)
    const encoder = new TextEncoder()

    for (const block of blocks) {
      const slice = markdown.slice(block.sourceRange.startUtf16, block.sourceRange.endUtf16)
      expect(block.sourceRangeBytes.startByte).toBe(
        encoder.encode(markdown.slice(0, block.sourceRange.startUtf16)).length,
      )
      expect(block.sourceRangeBytes.endByte).toBe(
        block.sourceRangeBytes.startByte + encoder.encode(slice).length,
      )
    }
    expect(blocks[0].sourceRange).toEqual({ startUtf16: 0, endUtf16: 2 })
    expect(blocks[0].sourceRangeBytes).toEqual({ startByte: 0, endByte: 6 })
    expect(blocks[1].sourceRangeBytes).toEqual({ startByte: 8, endByte: 13 })
  })
})
