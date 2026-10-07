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
  /**
   * Mount only the first `blockLimit` block groups; everything after (and
   * trailing position-less groups such as the GFM footnote section) is
   * omitted. Used by the reader's progressive mounting (rendering-pipeline
   * §2.12); omitted means a full render.
   */
  blockLimit?: number
}

const TEXT_SEGMENT_KINDS: ReadonlySet<SegmentKind> = new Set(['text', 'html-text'])

export function annotateTree(tree: Root, input: AnnotateInput): Root {
  const groups = groupChildren(tree.children, input.blocks, input.blockLimit)
  const segmentsByBlock = buildSegmentIndex(input.segments)
  const children: RootContent[] = []
  let emittedBlocks = 0

  for (const group of groups) {
    if (!group.block) {
      children.push(...group.children)
      continue
    }
    if (input.blockLimit !== undefined && emittedBlocks >= input.blockLimit) break
    emittedBlocks += 1
    const annotated = annotateChildren(group.children, group.block, segmentsByBlock)
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

const EMPTY_SEGMENTS: readonly SearchSegment[] = []

/**
 * Segments bucketed by block once per annotate call. A per-block `filter`
 * over the flat segment list made the transform O(blocks × segments)
 * (D-IT-3 profiling), which dominated the main thread on large documents.
 */
function buildSegmentIndex(
  segments: readonly SearchSegment[],
): Map<string, SearchSegment[]> {
  const byBlock = new Map<string, SearchSegment[]>()
  for (const segment of segments) {
    const bucket = byBlock.get(segment.blockId)
    if (bucket === undefined) byBlock.set(segment.blockId, [segment])
    else bucket.push(segment)
  }
  return byBlock
}

/**
 * Groups top-level hast children by the block whose source range contains
 * their start offset. Blocks and children are in document order, so the block
 * lookup is a binary search; the previous linear scan per child made the
 * grouping O(children × blocks). With `blockLimit` the scan stops after the
 * prefix the annotate loop would emit.
 */
function groupChildren(
  children: readonly RootContent[],
  blocks: readonly BlockRecord[],
  blockLimit?: number,
): Group[] {
  const groups: Group[] = []
  let emittedBlocks = 0

  for (const child of children) {
    const range = positionToUtf16Range(child.position)
    const block = range ? findBlock(blocks, range.startUtf16) : null
    if (block !== null && (groups.length === 0 || groups[groups.length - 1].block !== block)) {
      if (blockLimit !== undefined && emittedBlocks >= blockLimit) break
      emittedBlocks += 1
    }
    const last = groups[groups.length - 1]
    if (last && last.block === block) last.children.push(child)
    else groups.push({ block, children: [child] })
  }

  return groups
}

function findBlock(blocks: readonly BlockRecord[], offset: number): BlockRecord | null {
  let low = 0
  let high = blocks.length - 1
  let candidate = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (blocks[middle].sourceRange.startUtf16 <= offset) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  if (candidate === -1) return null
  const block = blocks[candidate]
  return offset < block.sourceRange.endUtf16 ? block : null
}

function annotateChildren(
  children: readonly RootContent[],
  block: BlockRecord,
  segmentsByBlock: ReadonlyMap<string, SearchSegment[]>,
): RootContent[] {
  const cursor: SegmentCursor = {
    segments: segmentsByBlock.get(block.blockId) ?? EMPTY_SEGMENTS,
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
