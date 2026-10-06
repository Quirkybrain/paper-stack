import type { Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { collectSegmentDrafts } from './segments'

function parse(markdown: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root
}

function drafts(markdown: string) {
  return collectSegmentDrafts(parse(markdown))
}

function allSegmentText(markdown: string): string {
  return drafts(markdown)
    .map((draft) => draft.text)
    .join('\n')
}

describe('segment collection', () => {
  it('covers readable text with exact UTF-16 source ranges, including CJK and emoji', () => {
    const markdown = '前缀😀尾 与 latin'
    const [segment] = drafts(markdown)
    expect(segment.kind).toBe('text')
    expect(segment.text).toBe('前缀😀尾 与 latin')
    expect(markdown.slice(segment.range.startUtf16, segment.range.endUtf16)).toBe(segment.text)
  })

  it('keeps CRLF exactly as written and maps it to the source', () => {
    const markdown = 'line one\r\nline two'
    const [segment] = drafts(markdown)
    expect(segment.text).toBe('line one\r\nline two')
    expect(markdown.slice(segment.range.startUtf16, segment.range.endUtf16)).toBe(segment.text)
  })

  it('collects code blocks without fences and inline code separately', () => {
    const markdown = 'Use `code()` here.\n\n```js\nconst a = 1\n```\n'
    const collected = drafts(markdown)
    expect(collected.map((draft) => draft.kind)).toEqual(['text', 'inline-code', 'text', 'code'])
    const code = collected.find((draft) => draft.kind === 'code')
    expect(code?.text).toBe('const a = 1')
  })

  it('collects image alt text and excludes link destinations and titles', () => {
    const markdown = '![替代文本](secret/path.png "title") [label](https://hidden.example/x)'
    const collected = drafts(markdown)
    expect(collected.find((draft) => draft.kind === 'image-alt')?.text).toBe('替代文本')
    const joined = collected.map((draft) => draft.text).join('|')
    expect(joined).not.toContain('secret/path.png')
    expect(joined).not.toContain('hidden.example')
    expect(joined).not.toContain('title')
  })

  it('indexes visible raw-HTML text only and skips hidden content', () => {
    const markdown =
      '<details><summary>摘要</summary>正文</details>\n\n<div><script>secret()</script>show</div>'
    const collected = drafts(markdown)
    const htmlTexts = collected.filter((draft) => draft.kind === 'html-text')
    expect(htmlTexts.length).toBeGreaterThanOrEqual(2)
    const joined = htmlTexts.map((draft) => draft.text).join('\n')
    expect(joined).toContain('摘要')
    expect(joined).toContain('正文')
    expect(joined).toContain('show')
    expect(joined).not.toContain('secret')
  })

  it('excludes the generated GFM footnote label but keeps footnote bodies', () => {
    const markdown = 'ref[^a]\n\n[^a]: note body'
    const joined = allSegmentText(markdown)
    expect(joined).toContain('note body')
    expect(joined.toLowerCase()).not.toContain('footnotes')
  })

  it('emits a math segment for future formula nodes with source range', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'inlineMath',
              value: 'x^2',
              position: { start: { offset: 3 }, end: { offset: 8 } },
            },
          ],
          position: { start: { offset: 3 }, end: { offset: 8 } },
        },
      ],
    } as unknown as Root
    const collected = collectSegmentDrafts(tree)
    expect(collected).toEqual([
      { kind: 'math', text: 'x^2', range: { startUtf16: 3, endUtf16: 8 } },
    ])
  })

  it('skips empty text and images without alt', () => {
    expect(drafts('![](x.png)')).toEqual([])
  })
})
