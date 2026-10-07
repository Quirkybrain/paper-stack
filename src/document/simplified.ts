import type { Element, ElementContent, Root, RootContent, Text } from 'hast'
import type { Point, Position } from 'unist'

import { fingerprintBlockText } from './hash'
import { CODE_BLOCK_CLASS, CODE_LANG_PROPERTY } from './plugins/shiki'
import { createSourceOffsetIndex } from './source-map'
import { blockSearchText } from './transforms/blocks'
import { slugifyHeading } from './transforms/outline'
import type {
  BlockKind,
  BlockRecord,
  OutlineEntry,
  ParseDocumentResult,
  PipelineStats,
  SearchSegment,
  SegmentKind,
  SourceRangeUtf16,
} from './types'

/**
 * Simplified-reading fast path (rendering-pipeline §5; R29/AT29; D-IT-3).
 *
 * The full pipeline (`pipeline.ts`, stages ①–⑦) builds an mdast/hast for the
 * whole document. On the mandated simplified path that is the wrong tool:
 * remark-parse scales super-linearly (measured ~8.4s at 2MiB UTF-16, minutes
 * at 11MiB) and the later remount also executed quadratic block matching.
 *
 * This module implements the §5 simplified subset directly with one linear
 * line scan: complete text, basic structure (headings/paragraphs/lists/
 * blockquotes/tables and fenced code as plain text), the full search index,
 * exact copy payloads for code blocks and the same source-map contract
 * (`BlockRecord`/`SearchSegment`/`OutlineEntry` with UTF-16↔UTF-8 ranges).
 * Heavy engines (KaTeX/Shiki/Mermaid/image decode/repagination) are absent by
 * construction. Fidelity that requires inline parsing or raw-HTML evaluation
 * (inline emphasis, link routing, footnote sections, image placeholders) is
 * intentionally not offered in this degraded mode; all source text stays
 * readable/searchable/copyable.
 *
 * The fast path is only selected for `simplified` parsing above
 * [`SIMPLIFIED_FAST_PATH_MIN_UTF16`]; smaller simplified documents keep the
 * exact pipeline-subset behavior (identical blockId/segId output, verified by
 * `pipeline.test.ts`).
 */

/**
 * Simplified parses above this size use the fast path (calibratable parameter;
 * at 1Mi UTF-16 the full path already costs ~3s of parse alone, and grows
 * super-linearly). Frozen for regression once measured on the 11MiB corpus.
 */
export const SIMPLIFIED_FAST_PATH_MIN_UTF16 = 1024 * 1024

export function shouldUseSimplifiedFastPath(text: string): boolean {
  return text.length > SIMPLIFIED_FAST_PATH_MIN_UTF16
}

interface ScanLine {
  start: number
  end: number
  /** Line content without the trailing LF/CRLF. */
  raw: string
}

interface DraftSegment {
  kind: SegmentKind
  text: string
  range: SourceRangeUtf16
}

// ---------------------------------------------------------------------------
// Line scanning primitives
// ---------------------------------------------------------------------------

function splitLines(text: string): ScanLine[] {
  const lines: ScanLine[] = []
  let start = 0
  for (;;) {
    let newline = text.indexOf('\n', start)
    if (newline === -1) newline = text.length
    let end = newline
    if (end > start && text.charCodeAt(end - 1) === 13) end -= 1
    lines.push({ start, end, raw: text.slice(start, end) })
    if (newline === text.length) return lines
    start = newline + 1
  }
}

function isBlank(line: ScanLine): boolean {
  return line.raw.trim().length === 0
}

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+|$)/
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const THEMATIC = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])([ \t]+|$)/
const BLOCKQUOTE = /^ {0,3}>/
const HTML_START = /^ {0,3}</

function isTableDelimiter(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return false
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  const cells = withoutEdges.split('|')
  if (cells.length === 0) return false
  return cells.every((cell) => /^[ \t]*:?-+:?[ \t]*$/.test(cell))
}

function startsInterruptingBlock(line: ScanLine): boolean {
  const raw = line.raw
  return (
    HEADING.test(raw) ||
    FENCE.test(raw) ||
    THEMATIC.test(raw) ||
    LIST_ITEM.test(raw) ||
    BLOCKQUOTE.test(raw)
  )
}

function isFenceClose(line: ScanLine, char: string, minLength: number): boolean {
  const match = /^ {0,3}([`~]+)[ \t]*$/.exec(line.raw)
  if (match === null) return false
  const fence = match[1]
  return fence.length >= minLength && fence.split('').every((candidate) => candidate === char)
}

// ---------------------------------------------------------------------------
// Fast-path scanner
// ---------------------------------------------------------------------------

class SimplifiedScanner {
  readonly text: string
  readonly lines: ScanLine[]
  readonly blocks: BlockRecord[] = []
  readonly segments: SearchSegment[] = []
  readonly outline: OutlineEntry[] = []
  readonly children: RootContent[] = []

  readonly #lineStarts: number[]
  readonly #offsetIndex: ReturnType<typeof createSourceOffsetIndex>
  #blockIndex = 0
  #segmentIndex = 0
  readonly #headingStack: Array<{ level: number; text: string }> = []
  readonly #usedAnchors = new Set<string>()
  readonly #anchorNextSuffix = new Map<string, number>()

  constructor(text: string) {
    this.text = text
    this.lines = splitLines(text)
    this.#lineStarts = this.lines.map((line) => line.start)
    this.#offsetIndex = createSourceOffsetIndex(text)
  }

  #pointAt(offset: number): Point {
    let low = 0
    let high = this.#lineStarts.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if (this.#lineStarts[middle] <= offset) low = middle
      else high = middle - 1
    }
    return { line: low + 1, column: offset - this.#lineStarts[low] + 1, offset }
  }

  position(start: number, end: number): Position {
    return { start: this.#pointAt(start), end: this.#pointAt(end) }
  }

  slice(range: SourceRangeUtf16): string {
    return this.text.slice(range.startUtf16, range.endUtf16)
  }

  textNode(range: SourceRangeUtf16): Text {
    return {
      type: 'text',
      value: this.slice(range),
      position: this.position(range.startUtf16, range.endUtf16),
    }
  }

  /** Appends one block with its segments and top-level hast node. */
  pushBlock(kind: BlockKind, range: SourceRangeUtf16, drafts: DraftSegment[], node: Element): void {
    this.#blockIndex += 1
    const blockId = `b${this.#blockIndex}`
    const segIds: string[] = []
    const texts: string[] = []
    for (const draft of drafts) {
      if (draft.text.length === 0) continue
      this.#segmentIndex += 1
      const segId = `s${this.#segmentIndex}`
      this.segments.push({
        segId,
        blockId,
        kind: draft.kind,
        text: draft.text,
        startUtf16: draft.range.startUtf16,
        endUtf16: draft.range.endUtf16,
      })
      segIds.push(segId)
      texts.push(draft.text)
    }
    this.blocks.push({
      blockId,
      kind,
      headingPath: this.#headingStack.map((heading) => heading.text),
      sourceRange: range,
      sourceRangeBytes: this.#offsetIndex.rangeToBytes(range),
      fingerprint: fingerprintBlockText(blockSearchText(texts)),
      segIds,
    })
    node.position = this.position(range.startUtf16, range.endUtf16)
    this.children.push(node)
  }

  addHeading(level: number, text: string, anchorId: string, range: SourceRangeUtf16): void {
    while (
      this.#headingStack.length > 0 &&
      this.#headingStack[this.#headingStack.length - 1].level >= level
    ) {
      this.#headingStack.pop()
    }
    this.#headingStack.push({ level, text })
    this.outline.push({ level, text, anchorId, sourceRange: range })
  }

  uniqueAnchor(text: string): string {
    const base = slugifyHeading(text)
    // Next free suffix per base: re-scanning from `-1` for every duplicate
    // heading is quadratic (D-IT-3 profiling: 16k identical headings cost
    // ~22s). Output order is unchanged (`base`, `base-1`, `base-2`, …).
    let next = this.#anchorNextSuffix.get(base) ?? 1
    let slug = base
    if (this.#usedAnchors.has(base)) {
      slug = `${base}-${next}`
      while (this.#usedAnchors.has(slug)) {
        next += 1
        slug = `${base}-${next}`
      }
      next += 1
    }
    this.#anchorNextSuffix.set(base, next)
    this.#usedAnchors.add(slug)
    return `ps-h-${slug}`
  }

  byteLength(): number {
    return this.#offsetIndex.byteLength
  }
}

function element(
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[],
): Element {
  return { type: 'element', tagName, properties, children }
}

function paragraphNode(
  value: string,
  range: SourceRangeUtf16,
  scanner: SimplifiedScanner,
  tag = 'p',
): Element {
  return element(tag, {}, value.length > 0 ? [scanner.textNode(range)] : [])
}

function pushCodeBlock(
  scanner: SimplifiedScanner,
  open: ScanLine,
  openIndex: number,
  fenceLength: number,
): number {
  const fenceChar = open.raw.trimStart()[0]
  const info = (FENCE.exec(open.raw)?.[2] ?? '').trim()
  let closeIndex = openIndex + 1
  while (
    closeIndex < scanner.lines.length &&
    !isFenceClose(scanner.lines[closeIndex], fenceChar, fenceLength)
  ) {
    closeIndex += 1
  }
  const closed = closeIndex < scanner.lines.length
  const contentStart =
    openIndex + 1 < scanner.lines.length ? scanner.lines[openIndex + 1].start : open.end
  let contentEnd: number
  if (closed) {
    // Everything before the closing fence line, minus the line ending that
    // terminated the last content line (micromark's code value semantics).
    contentEnd = closeIndex > openIndex + 1 ? scanner.lines[closeIndex - 1].end : contentStart
  } else {
    // Unclosed fence: text runs to EOF; strip exactly one trailing line ending
    // so the payload matches the full pipeline's code value.
    contentEnd = scanner.text.length
    if (contentEnd > contentStart && scanner.text.charCodeAt(contentEnd - 1) === 10) {
      contentEnd -= 1
      if (contentEnd > contentStart && scanner.text.charCodeAt(contentEnd - 1) === 13) {
        contentEnd -= 1
      }
    }
  }
  const range = {
    startUtf16: open.start,
    endUtf16: closed ? scanner.lines[closeIndex].end : scanner.text.length,
  }
  const contentRange = { startUtf16: contentStart, endUtf16: contentEnd }

  const language = /^[\w+#.-]+/.exec(info)?.[0]
  const code = element(
    'code',
    language !== undefined ? { className: [`language-${language}`] } : {},
    contentEnd > contentStart ? [scanner.textNode(contentRange)] : [],
  )
  const pre = element('pre', {}, [code])
  // The trusted copy/wrap UI (CodeBlock) keys off the `code-block` wrapper the
  // Shiki engine normally adds; the fast path builds the same wrapper around
  // the literal code so copying stays complete without loading Shiki.
  const wrapper = element('div', {
    className: [CODE_BLOCK_CLASS],
    [CODE_LANG_PROPERTY]: language ?? 'plaintext',
  }, [pre])
  scanner.pushBlock(
    'code',
    range,
    [{ kind: 'code', text: scanner.slice(contentRange), range: contentRange }],
    wrapper,
  )
  return closed ? closeIndex + 1 : closeIndex
}

function pushHeading(scanner: SimplifiedScanner, line: ScanLine): number {
  const match = HEADING.exec(line.raw)
  if (match === null) return 0
  const level = match[1].length
  const contentStart = line.start + match[0].length
  const rawContent = scanner.text.slice(contentStart, line.end)
  const lead = rawContent.length - rawContent.trimStart().length
  const text = rawContent.trim()
  const contentRange = { startUtf16: contentStart + lead, endUtf16: contentStart + lead + text.length }
  const anchorId = scanner.uniqueAnchor(text)
  const range = { startUtf16: line.start, endUtf16: line.end }
  const node = element(`h${level}`, { id: anchorId }, text.length > 0 ? [scanner.textNode(contentRange)] : [])
  scanner.addHeading(level, text, anchorId, range)
  scanner.pushBlock('heading', range, [{ kind: 'text', text, range: contentRange }], node)
  return 0
}

interface ListItemDraft {
  contentStart: number
  end: number
}

function pushList(scanner: SimplifiedScanner, startIndex: number): number {
  const items: ListItemDraft[] = []
  let index = startIndex
  let current: ListItemDraft | null = null
  while (index < scanner.lines.length && !isBlank(scanner.lines[index])) {
    const line = scanner.lines[index]
    const match = LIST_ITEM.exec(line.raw)
    if (match !== null) {
      if (current !== null) items.push(current)
      current = { contentStart: line.start + match[0].length, end: line.end }
    } else if (current === null || startsInterruptingBlock(line)) {
      break
    } else {
      current.end = line.end
    }
    index += 1
  }
  if (current !== null) items.push(current)

  const listChildren: ElementContent[] = []
  const drafts: DraftSegment[] = []
  for (const item of items) {
    const contentRange = { startUtf16: item.contentStart, endUtf16: item.end }
    const text = scanner.slice(contentRange)
    listChildren.push(paragraphNode(text, contentRange, scanner, 'li'))
    drafts.push({ kind: 'text', text, range: contentRange })
  }
  const first = scanner.lines[startIndex]
  const last = scanner.lines[index - 1]
  const range = { startUtf16: first.start, endUtf16: last.end }
  scanner.pushBlock('list', range, drafts, element('ul', {}, listChildren))
  return index
}

function pushBlockquote(scanner: SimplifiedScanner, startIndex: number): number {
  const paragraphs: ElementContent[] = []
  const drafts: DraftSegment[] = []
  let index = startIndex
  while (index < scanner.lines.length && BLOCKQUOTE.test(scanner.lines[index].raw)) {
    const line = scanner.lines[index]
    const marker = /^ {0,3}>[ \t]?/.exec(line.raw) as RegExpExecArray
    const contentRange = { startUtf16: line.start + marker[0].length, endUtf16: line.end }
    const text = scanner.slice(contentRange)
    paragraphs.push(paragraphNode(text, contentRange, scanner))
    drafts.push({ kind: 'text', text, range: contentRange })
    index += 1
  }
  const first = scanner.lines[startIndex]
  const last = scanner.lines[index - 1]
  const range = { startUtf16: first.start, endUtf16: last.end }
  scanner.pushBlock('blockquote', range, drafts, element('blockquote', {}, paragraphs))
  return index
}

function pushFlatBlock(
  scanner: SimplifiedScanner,
  startIndex: number,
  kind: BlockKind,
  tag: string,
): number {
  let index = startIndex
  while (
    index < scanner.lines.length &&
    !isBlank(scanner.lines[index]) &&
    (index === startIndex || !startsInterruptingBlock(scanner.lines[index]))
  ) {
    index += 1
  }
  const first = scanner.lines[startIndex]
  const last = scanner.lines[index - 1]
  const range = { startUtf16: first.start, endUtf16: last.end }
  const text = scanner.slice(range)
  const node = kind === 'hr' ? element('hr', {}, []) : paragraphNode(text, range, scanner, tag)
  const drafts: DraftSegment[] = []
  if (kind !== 'hr' && text.length > 0) drafts.push({ kind: 'text', text, range })
  scanner.pushBlock(kind, range, drafts, node)
  return index
}

/**
 * Parses one document through the simplified fast path. Never throws for
 * string input; malformed structure degrades to plain paragraphs.
 */
export function parseSimplifiedDocument(text: string): ParseDocumentResult {
  const scanner = new SimplifiedScanner(text)
  const lines = scanner.lines
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (isBlank(line)) {
      index += 1
      continue
    }

    const fence = FENCE.exec(line.raw)
    if (fence !== null) {
      index = pushCodeBlock(scanner, line, index, fence[1].length)
      continue
    }
    if (HEADING.test(line.raw)) {
      pushHeading(scanner, line)
      index += 1
      continue
    }
    if (THEMATIC.test(line.raw)) {
      index = pushFlatBlock(scanner, index, 'hr', 'p')
      continue
    }
    if (LIST_ITEM.test(line.raw)) {
      index = pushList(scanner, index)
      continue
    }
    if (BLOCKQUOTE.test(line.raw)) {
      index = pushBlockquote(scanner, index)
      continue
    }
    if (
      line.raw.includes('|') &&
      index + 1 < lines.length &&
      isTableDelimiter(lines[index + 1].raw)
    ) {
      index = pushFlatBlock(scanner, index, 'table', 'pre')
      continue
    }
    if (HTML_START.test(line.raw)) {
      index = pushFlatBlock(scanner, index, 'html', 'p')
      continue
    }
    index = pushFlatBlock(scanner, index, 'paragraph', 'p')
  }

  const stats: PipelineStats = {
    charsUtf16: text.length,
    bytesUtf8: scanner.byteLength(),
    blockCount: scanner.blocks.length,
    segmentCount: scanner.segments.length,
    headingCount: scanner.outline.length,
  }

  const hast: Root = { type: 'root', children: scanner.children }
  return {
    status: 'ok',
    hast,
    outline: scanner.outline,
    blocks: scanner.blocks,
    segments: scanner.segments,
    diagnostics: [],
    stats,
  }
}
