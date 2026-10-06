import type { Heading, Root, RootContent } from 'mdast'
import type { Properties } from 'hast'
import { visit } from 'unist-util-visit'

import { fingerprintBlockText } from '../hash'
import { positionToUtf16Range, utf16RangeToUtf8Bytes } from '../source-map'
import type { BlockKind, BlockRecord, OutlineEntry, SearchSegment } from '../types'
import { extractOutline, headingText } from './outline'
import { collectSegmentDrafts } from './segments'

/**
 * Transforms a→b→c (rendering-pipeline §2.4).
 *
 * Order is fixed: outline first (a), then the top-level block registry (b),
 * then search segments (c). Segments are produced per block so the fingerprint
 * can hash `blockSearchText` — the block's segment texts concatenated in
 * document order with LF-only normalization (data-model §3.3) — and blocks
 * carry the resulting `segIds`.
 *
 * Blocks are the top-level semantic children in source order; `definition`
 * (link reference definitions) and front matter (`yaml`) render no block
 * content, so they are skipped. `sourceRange` is UTF-16 (pipeline §2.4b);
 * `sourceRangeBytes` is the converted range used for `data-src-*` (§3).
 */

export interface TransformSideData {
  outline: OutlineEntry[]
  blocks: BlockRecord[]
  segments: SearchSegment[]
}

export function runMdastTransforms(tree: Root, text: string): TransformSideData {
  const outline = extractOutline(tree)
  applyHeadingAnchors(tree, outline)
  const blocks: BlockRecord[] = []
  const segments: SearchSegment[] = []
  const headingStack: Array<{ level: number; text: string }> = []

  let blockIndex = 0
  let segmentIndex = 0

  for (const child of tree.children) {
    if (child.type === 'heading') {
      const level = child.depth
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }
      headingStack.push({ level, text: headingText(child as Heading) })
    }

    const kind = classifyTopLevelBlock(child)
    if (kind === null) continue
    const range = positionToUtf16Range(child.position)
    if (!range) continue

    blockIndex += 1
    const blockId = `b${blockIndex}`
    const drafts = collectSegmentDrafts(child)
    const segIds: string[] = []

    for (const draft of drafts) {
      segmentIndex += 1
      const segId = `s${segmentIndex}`
      segments.push({
        segId,
        blockId,
        kind: draft.kind,
        text: draft.text,
        startUtf16: draft.range.startUtf16,
        endUtf16: draft.range.endUtf16,
      })
      segIds.push(segId)
    }

    blocks.push({
      blockId,
      kind,
      headingPath: headingStack.map((heading) => heading.text),
      sourceRange: range,
      sourceRangeBytes: utf16RangeToUtf8Bytes(text, range),
      fingerprint: fingerprintBlockText(blockSearchText(drafts.map((draft) => draft.text))),
      segIds,
    })
  }

  return { outline, blocks, segments }
}

/** `blockSearchText` shared with search indexing and anchor fingerprints. */
export function blockSearchText(segmentTexts: readonly string[]): string {
  return segmentTexts.join('').replace(/\r\n|\r/g, '\n')
}

/**
 * Heading path context for a segment (handoff `{sourceRange, blockId, path}`):
 * segments stay flat and reference their block; the semantic path is reached
 * through this helper (rendering-pipeline §2.4b–c).
 */
export function segmentHeadingPath(
  segment: SearchSegment,
  blocks: readonly BlockRecord[],
): string[] {
  return blocks.find((block) => block.blockId === segment.blockId)?.headingPath ?? []
}

/**
 * Attach the outline anchor to each mdast heading through `hProperties.id`
 * (survives `remark-rehype`, then the sanitize id allow-list). Document order
 * of `extractOutline` and this visit are identical.
 */
function applyHeadingAnchors(tree: Root, outline: readonly OutlineEntry[]): void {
  let index = 0
  visit(tree, 'heading', (node) => {
    const entry = outline[index]
    index += 1
    if (!entry) return
    const data = (node.data ?? {}) as Record<string, unknown>
    const previous = data.hProperties
    const hProperties: Properties =
      previous && typeof previous === 'object' ? { ...(previous as Properties) } : {}
    hProperties.id = entry.anchorId
    // `hProperties` is an mdast-util-to-hast extension to unist `Data`.
    node.data = { ...data, hProperties } as unknown as Heading['data']
  })
}

export function classifyTopLevelBlock(node: RootContent): BlockKind | null {
  switch (node.type) {
    case 'paragraph':
      return isImageParagraph(node) ? 'image' : 'paragraph'
    case 'heading':
      return 'heading'
    case 'list':
      return 'list'
    case 'blockquote':
      return 'blockquote'
    case 'code':
      return node.lang === 'mermaid' ? 'mermaid' : 'code'
    case 'table':
      return 'table'
    case 'html':
      return /^<details(\s|>|\/)/i.test(node.value.trimStart()) ? 'details' : 'html'
    case 'thematicBreak':
      return 'hr'
    case 'footnoteDefinition':
      return 'footnote'
    default: {
      // `math` ships with the wp-19 math engine slot; keep the registry ready.
      const type = (node as { type?: unknown }).type
      return type === 'math' ? 'math' : null
    }
  }
}

function isImageParagraph(node: RootContent & { type: 'paragraph' }): boolean {
  const meaningful = node.children.filter(
    (child) => !(child.type === 'text' && child.value.trim() === ''),
  )
  return meaningful.length === 1 && meaningful[0].type === 'image'
}
