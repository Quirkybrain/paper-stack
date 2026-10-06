import type { Heading, Root } from 'mdast'
import { visit } from 'unist-util-visit'

import { sha256Hex } from '../hash'
import { positionToUtf16Range } from '../source-map'
import type { OutlineEntry } from '../types'
import { visibleHtmlText } from './html-text'

/**
 * Transform a — outline and unique anchors (rendering-pipeline §2.4a; R14).
 *
 * Anchor ids are `ps-h-<slug>` and must survive the sanitize id allow-list
 * (`^ps-h-[a-z0-9-]{1,128}$`, security-model §5.2), so the slug is ASCII:
 * lowercase, whitespace/punctuation collapsed to `-`, trimmed and capped.
 * Titles with no ASCII slug (e.g. pure CJK) fall back to a short SHA-256 of
 * the heading text, which is deterministic and stable across sibling changes;
 * duplicates are disambiguated in document order with `-1`, `-2`, ….
 */

const MAX_SLUG_LENGTH = 100
const HASH_FALLBACK_LENGTH = 8

/** Plain visible text of a heading (markup, links and raw tags removed). */
export function headingText(node: Heading): string {
  return phraseText(node.children).trim()
}

function phraseText(children: readonly unknown[]): string {
  let result = ''
  for (const child of children) {
    if (!child || typeof child !== 'object') continue
    const node = child as { type?: unknown; value?: unknown; alt?: unknown; children?: unknown[] }
    switch (node.type) {
      case 'text':
      case 'inlineCode':
      case 'math':
      case 'inlineMath':
        result += typeof node.value === 'string' ? node.value : ''
        break
      case 'image':
        result += typeof node.alt === 'string' ? node.alt : ''
        break
      case 'break':
        result += ' '
        break
      case 'html':
        result += visibleHtmlText(typeof node.value === 'string' ? node.value : '')
        break
      default:
        if (Array.isArray(node.children)) result += phraseText(node.children)
        break
    }
  }
  return result
}

export function slugifyHeading(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
  if (ascii.length > 0) return ascii
  return `h-${sha256Hex(text).slice(0, HASH_FALLBACK_LENGTH)}`
}

export function extractOutline(tree: Root): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  const used = new Set<string>()

  visit(tree, 'heading', (node: Heading) => {
    const text = headingText(node)
    const base = slugifyHeading(text)
    let slug = base
    let suffix = 0
    while (used.has(slug)) {
      suffix += 1
      slug = `${base}-${suffix}`
    }
    used.add(slug)

    entries.push({
      level: node.depth,
      text,
      anchorId: `ps-h-${slug}`,
      sourceRange: positionToUtf16Range(node.position) ?? { startUtf16: 0, endUtf16: 0 },
    })
  })

  return entries
}
