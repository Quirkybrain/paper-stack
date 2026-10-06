import type { Element, Root as HastRoot } from 'hast'
import { describe, expect, it } from 'vitest'
import { visit } from 'unist-util-visit'

import { annotateTree } from './annotate'
import { parseDocument } from './pipeline'

async function annotated(markdown: string): Promise<HastRoot> {
  const parsed = await parseDocument(markdown)
  if (!parsed.hast) throw new Error('fixture failed to parse')
  return annotateTree(parsed.hast, { blocks: parsed.blocks, segments: parsed.segments })
}

function collectElements(tree: HastRoot, tagName: string): Element[] {
  const elements: Element[] = []
  visit(tree, 'element', (node) => {
    if (node.tagName === tagName) elements.push(node)
  })
  return elements
}

describe('annotateTree (stage ⑫)', () => {
  it('wraps each top-level block in a section with UTF-8 byte attributes', async () => {
    const text = '你好\n\nworld'
    const tree = await annotated(text)
    const sections = collectElements(tree, 'section')

    expect(sections).toHaveLength(2)
    expect(sections.map((section) => section.properties.dataBlockId)).toEqual(['b1', 'b2'])

    const encoder = new TextEncoder()
    expect(sections[0].properties.dataSrcStart).toBe(0)
    expect(sections[0].properties.dataSrcEnd).toBe(encoder.encode('你好').length)
    expect(sections[1].properties.dataSrcStart).toBe(encoder.encode('你好\n\n').length)
    expect(sections[1].properties.dataSrcEnd).toBe(encoder.encode(text).length)
  })

  it('aligns searchable text nodes with data-seg-id spans', async () => {
    const parsed = await parseDocument('alpha **beta** gamma')
    const tree = annotateTree(parsed.hast as HastRoot, {
      blocks: parsed.blocks,
      segments: parsed.segments,
    })
    const spans = collectElements(tree, 'span').filter(
      (element) => element.properties.dataSegId !== undefined,
    )
    const covered = spans.map((span) =>
      span.children.map((child) => ('value' in child ? child.value : '')).join(''),
    )
    expect(new Set(covered)).toEqual(new Set(['alpha ', 'beta', ' gamma']))
    const segIds = new Set(parsed.segments.map((segment) => segment.segId))
    for (const span of spans) expect(segIds.has(String(span.properties.dataSegId))).toBe(true)
  })

  it('recovers text whose position the mdast → hast conversion dropped', async () => {
    const tree = await annotated('alpha\\\nbeta')
    const spans = collectElements(tree, 'span').filter(
      (element) => element.properties.dataSegId !== undefined,
    )
    const texts = spans.map((span) =>
      span.children.map((child) => ('value' in child ? child.value : '')).join(''),
    )
    expect(texts.some((text) => text.includes('beta'))).toBe(true)
  })

  it('marks code and image elements directly', async () => {
    const tree = await annotated('```js\nconst a = 1\n```\n\n![替代](x.png)')
    const code = collectElements(tree, 'code')[0]
    expect(code.properties.dataSegId).toBeDefined()
    const image = collectElements(tree, 'img')[0]
    expect(image.properties.dataSegId).toBeDefined()
    expect(image.properties.alt).toBe('替代')
  })

  it('leaves position-less generated sections (footnotes) unwrapped', async () => {
    const tree = await annotated('ref[^a]\n\n[^a]: note')
    const footnoteSection = collectElements(tree, 'section').find(
      (element) =>
        Array.isArray(element.properties.className) &&
        element.properties.className.includes('footnotes'),
    )
    expect(footnoteSection).toBeDefined()
    expect(footnoteSection?.properties.dataBlockId).toBeUndefined()
  })

  it('does not mutate the input tree', async () => {
    const parsed = await parseDocument('alpha')
    const original = JSON.stringify(parsed.hast)
    annotateTree(parsed.hast as HastRoot, { blocks: parsed.blocks, segments: parsed.segments })
    expect(JSON.stringify(parsed.hast)).toBe(original)
  })
})
