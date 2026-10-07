import type { Position } from 'unist'

import { positionToUtf16Range } from '../source-map'
import type { SegmentKind, SourceRangeUtf16 } from '../types'
import { visibleHtmlText } from './html-text'

/**
 * Transform c (collection half) — search segments on mdast
 * (rendering-pipeline §2.4c; ADR-007).
 *
 * Coverage: readable text, code (fenced and indented, including collapsed
 * content), inline code, image `alt`, future math source, and visible text of
 * the allowed raw-HTML subset. Excluded: HTML attributes (except `alt`), link
 * destinations/titles, GFM's generated `Footnotes` label (it exists only in
 * the later rehype footer, never in mdast), and UI chrome.
 *
 * No Unicode normalization is applied (SRS §5.3); CRLF is kept as written.
 */

export interface SegmentDraft {
  kind: SegmentKind
  text: string
  range: SourceRangeUtf16
}

interface WalkNode {
  type?: unknown
  value?: unknown
  alt?: unknown
  children?: unknown[]
  position?: Position
}

export function collectSegmentDrafts(node: unknown): SegmentDraft[] {
  const drafts: SegmentDraft[] = []
  walk(node, drafts)
  return drafts
}

function walk(node: unknown, drafts: SegmentDraft[]): void {
  if (!node || typeof node !== 'object') return
  const current = node as WalkNode
  const type = typeof current.type === 'string' ? current.type : ''

  switch (type) {
    case 'text':
      pushLiteral('text', current, drafts)
      return
    case 'inlineCode':
      pushLiteral('inline-code', current, drafts)
      return
    case 'code':
      pushLiteral('code', current, drafts)
      return
    case 'math':
    case 'inlineMath':
      pushLiteral('math', current, drafts)
      return
    case 'image': {
      const range = positionToUtf16Range(current.position)
      const alt = typeof current.alt === 'string' ? current.alt : ''
      if (range && alt.length > 0) drafts.push({ kind: 'image-alt', text: alt, range })
      return
    }
    case 'html': {
      const range = positionToUtf16Range(current.position)
      const text = visibleHtmlText(typeof current.value === 'string' ? current.value : '')
      if (range && text.length > 0) drafts.push({ kind: 'html-text', text, range })
      return
    }
    default:
      break
  }

  if (!Array.isArray(current.children)) return
  for (const child of current.children) walk(child, drafts)
}

function pushLiteral(kind: SegmentKind, node: WalkNode, drafts: SegmentDraft[]): void {
  const range = positionToUtf16Range(node.position)
  const text = typeof node.value === 'string' ? node.value : ''
  if (!range || text.length === 0) return
  drafts.push({ kind, text, range })
}
