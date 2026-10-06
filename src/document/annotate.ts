import type { Element, ElementContent, Root, RootContent, Text } from 'hast'

import { positionToUtf16Range } from './source-map'
import type { BlockRecord, SearchSegment, SegmentKind } from './types'

/**
 * Stage ⑫ (pure half) — block re-wrapping and `data-seg-id` alignment
 * (rendering-pipeline §1/§3/§2.12). Runs on the sanitized/engine-processed
 * hast on the main thread, so the trusted `data-*` attributes it adds never
 * pass through document sanitize and never come from document text.
 *
 * Each top-level group of hast children that falls inside one `BlockRecord`
 * range is wrapped in `<section data-block-id data-src-start data-src-end>`
 * (UTF-8 bytes, §3 item 1). Searchable text nodes get a `<span data-seg-id>`
 * wrapper; code/img elements carry the id directly. Positions that mdast
 * dropped (e.g. text after a hard break) fall back to exact-text matching
 * within the same block. Text without any segment stays untouched.
 */

export interface AnnotateInput {
  blocks: readonly BlockRecord[]
  segments: readonly SearchSegment[]
}

const TEXT_SEGMENT_KINDS: ReadonlySet<SegmentKind> = new Set(['text', 'html-text'])

export function annotateTree(tree: Root, input: AnnotateInput): Root {
  const groups = groupChildren(tree.children, input.blocks)
  const children: RootContent[] = []

  for (const group of groups) {
    if (!group.block) {
      children.push(...group.children)
      continue
    }
    const annotated = annotateChildren(group.children, group.block, input.segments)
    children.push({
      type: 'element',
      tagName: 'section',
      properties: {
        dataBlockId: group.block.blockId,
        dataSrcStart: group.block.sourceRangeBytes.startByte,
        dataSrcEnd: group.block.sourceRangeBytes.endByte,
      },
      children: annotated as ElementContent[],
    })
  }

  return { ...tree, children }
}

interface Group {
  block: BlockRecord | null
  children: RootContent[]
}

interface SegmentCursor {
  segments: readonly SearchSegment[]
  used: Set<string>
}

function groupChildren(children: readonly RootContent[], blocks: readonly BlockRecord[]): Group[] {
  const groups: Group[] = []

  for (const child of children) {
    const range = positionToUtf16Range(child.position)
    const block = range ? findBlock(blocks, range.startUtf16) : null
    const last = groups[groups.length - 1]
    if (last && last.block === block) last.children.push(child)
    else groups.push({ block, children: [child] })
  }

  return groups
}

function findBlock(blocks: readonly BlockRecord[], offset: number): BlockRecord | null {
  for (const block of blocks) {
    if (offset >= block.sourceRange.startUtf16 && offset < block.sourceRange.endUtf16) return block
  }
  return null
}

function annotateChildren(
  children: readonly RootContent[],
  block: BlockRecord,
  segments: readonly SearchSegment[],
): RootContent[] {
  const cursor: SegmentCursor = {
    segments: segments.filter((segment) => segment.blockId === block.blockId),
    used: new Set<string>(),
  }
  return children.map((child) => annotateNode(child, cursor, false))
}

function annotateNode(
  node: RootContent | ElementContent,
  cursor: SegmentCursor,
  insideCode: boolean,
): RootContent | ElementContent {
  if (node.type === 'text') {
    // Literal code text stays unwrapped so copy payloads remain exact.
    if (insideCode) return node
    const segment = matchTextSegment(node, cursor)
    if (!segment) return node
    return {
      type: 'element',
      tagName: 'span',
      properties: { dataSegId: segment.segId },
      children: [node],
      position: node.position,
    }
  }

  if (node.type === 'element') {
    if (node.tagName === 'code' && !node.children.some((child) => child.type === 'element')) {
      const copy: Element = { ...node, properties: { ...node.properties } }
      const segment = matchContainingSegment(node, ['code', 'inline-code'], cursor)
      if (segment) copy.properties.dataSegId = segment.segId
      return copy
    }

    if (node.tagName === 'img') {
      const copy: Element = { ...node, properties: { ...node.properties } }
      const segment = matchContainingSegment(node, ['image-alt'], cursor)
      if (segment) copy.properties.dataSegId = segment.segId
      return copy
    }

    if (node.tagName === 'pre') {
      const segment = matchContainingSegment(node, ['code'], cursor)
      const children = node.children.map((child) => {
        const annotated = annotateNode(child, cursor, true)
        if (segment && annotated.type === 'element' && annotated.tagName === 'code') {
          return { ...annotated, properties: { ...annotated.properties, dataSegId: segment.segId } }
        }
        return annotated
      })
      return { ...node, properties: { ...node.properties }, children: children as ElementContent[] }
    }

    const nextInsideCode = insideCode || node.tagName === 'code'
    const children = node.children.map((child) => annotateNode(child, cursor, nextInsideCode))
    return { ...node, properties: { ...node.properties }, children: children as ElementContent[] }
  }

  return node
}

function matchTextSegment(node: Text, cursor: SegmentCursor): SearchSegment | undefined {
  const range = positionToUtf16Range(node.position)
  if (range) {
    const exact = cursor.segments.find(
      (segment) =>
        TEXT_SEGMENT_KINDS.has(segment.kind) &&
        segment.startUtf16 === range.startUtf16 &&
        segment.endUtf16 === range.endUtf16,
    )
    if (exact) return exact

    const containing = matchContainingRange(
      cursor.segments,
      range.startUtf16,
      range.endUtf16,
      TEXT_SEGMENT_KINDS,
    )
    if (containing) return containing
  }

  // Positions can be dropped by the mdast → hast conversion (for example the
  // text following a hard break). Fall back to exact visible-text matching in
  // document order within the block.
  const normalized = node.value.replace(/^\n+/, '').trim()
  if (normalized.length === 0) return undefined
  const fallback = cursor.segments.find(
    (segment) =>
      !cursor.used.has(segment.segId) &&
      TEXT_SEGMENT_KINDS.has(segment.kind) &&
      segment.text.trim() === normalized,
  )
  if (fallback) cursor.used.add(fallback.segId)
  return fallback
}

function matchContainingSegment(
  node: Element,
  kinds: readonly SegmentKind[],
  cursor: SegmentCursor,
): SearchSegment | undefined {
  const range = positionToUtf16Range(node.position)
  if (!range) return undefined
  return matchContainingRange(cursor.segments, range.startUtf16, range.endUtf16, new Set(kinds))
}

function matchContainingRange(
  segments: readonly SearchSegment[],
  start: number,
  end: number,
  kinds: ReadonlySet<SegmentKind>,
): SearchSegment | undefined {
  let best: SearchSegment | undefined
  for (const segment of segments) {
    if (!kinds.has(segment.kind)) continue
    if (segment.startUtf16 <= start && end <= segment.endUtf16) {
      if (!best || segment.endUtf16 - segment.startUtf16 < best.endUtf16 - best.startUtf16) {
        best = segment
      }
    }
  }
  return best
}
