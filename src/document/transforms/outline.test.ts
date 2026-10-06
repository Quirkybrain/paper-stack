import type { Root } from 'mdast'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { extractOutline, headingText, slugifyHeading } from './outline'

function parse(markdown: string): Root {
  return unified().use(remarkParse).parse(markdown) as Root
}

function firstHeading(markdown: string) {
  const tree = parse(markdown)
  const heading = tree.children.find((child) => child.type === 'heading')
  if (!heading || heading.type !== 'heading') throw new Error('no heading in fixture')
  return heading
}

describe('slugifyHeading', () => {
  it('lowercases, collapses whitespace/punctuation to dashes and trims', () => {
    expect(slugifyHeading('  Hello   World! ')).toBe('hello-world')
    expect(slugifyHeading('2.1 数据 Data')).toBe('2-1-data')
  })

  it('falls back to a deterministic hash for non-ASCII-only titles', () => {
    const first = slugifyHeading('标题')
    expect(first).toMatch(/^h-[0-9a-f]{8}$/)
    expect(slugifyHeading('标题')).toBe(first)
    expect(slugifyHeading('另一个标题')).not.toBe(first)
  })

  it('caps the slug so the full anchor stays within the sanitize pattern', () => {
    const slug = slugifyHeading('a'.repeat(300))
    expect(slug.length).toBeLessThanOrEqual(100)
    expect(`ps-h-${slug}`).toMatch(/^ps-h-[a-z0-9-]{1,128}$/)
  })
})

describe('headingText', () => {
  it('renders emphasis, inline code and images as plain text', () => {
    expect(headingText(firstHeading('# Hello *World* `code` ![alt](x.png)'))).toBe(
      'Hello World code alt',
    )
  })

  it('drops raw HTML tags but keeps their visible text', () => {
    expect(headingText(firstHeading('# 标题 <b>bold</b>'))).toBe('标题 bold')
  })
})

describe('extractOutline', () => {
  it('records level, text, anchor and source range in document order', () => {
    const tree = parse('# One\n\n## Two\n\n### Three\n')
    const outline = extractOutline(tree)
    expect(outline.map((entry) => [entry.level, entry.text])).toEqual([
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
    ])
    expect(outline.map((entry) => entry.anchorId)).toEqual(['ps-h-one', 'ps-h-two', 'ps-h-three'])
    expect(outline[0].sourceRange).toEqual({ startUtf16: 0, endUtf16: 5 })
    expect(outline[1].sourceRange.startUtf16).toBe(7)
  })

  it('disambiguates duplicate headings with -1, -2 in document order', () => {
    const outline = extractOutline(parse('# Same\n\n# Same\n\n# Same\n'))
    expect(outline.map((entry) => entry.anchorId)).toEqual([
      'ps-h-same',
      'ps-h-same-1',
      'ps-h-same-2',
    ])
  })

  it('keeps Chinese duplicate titles unique and within the sanitize pattern', () => {
    const outline = extractOutline(parse('# 标题\n\n# 标题\n\n# 另一个标题\n'))
    const anchors = outline.map((entry) => entry.anchorId)
    expect(new Set(anchors).size).toBe(anchors.length)
    for (const anchor of anchors) expect(anchor).toMatch(/^ps-h-[a-z0-9-]{1,128}$/)
    expect(anchors[0]).toBe(anchors[1].replace(/-1$/, ''))
  })

  it('is deterministic across repeated extraction', () => {
    const tree = parse('# 数据\n\n# 数据\n')
    expect(extractOutline(tree)).toEqual(extractOutline(tree))
  })
})
