import type { Element, Text } from 'hast'
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react'
import type { Components } from 'rehype-react'

import { t } from '../../../app/i18n'
import { renderDocument, useProgressiveMount } from '../../../document/map'
import { MATH_ERROR_CLASS } from '../../../document/plugins/katex'
import { MERMAID_BLOCK_CLASS, extractMermaidSource } from '../../../document/plugins/mermaid'
import { utf8RangeToUtf16 } from '../../../document/source-map'
import type { ParseDocumentResult } from '../../../document/types'
import { opener } from '../../../services'
import { BlockContext, type BlockContextValue } from '../inspect/block-context'
import { CodeBlock, isCodeBlockNode } from '../inspect/CodeBlock'
import { MathBlock, mathElementKind } from '../inspect/MathBlock'
import { ContentBlock } from './ContentBlock'
import { ImageBlock } from './ImageBlock'
import { MathErrorBlock } from './MathErrorBlock'
import { MermaidBlock } from './MermaidBlock'

/**
 * Body renderer (ui-spec §3.2 `body/DocumentView.tsx`; rendering-pipeline
 * §2.11–§2.12): maps the engine-processed hast to React through
 * `renderDocument`, mounts blocks progressively, and supplies the reader's
 * component overrides (formula errors, images, Mermaid, links, search marks).
 *
 * The override components are module-level so their identities never change:
 * search highlights and link handlers travel through `DocumentOverrideContext`
 * instead of new `components` objects. Recreating the override functions would
 * remount the whole document on every keystroke and lose block-local state
 * (for example a code block's expanded state).
 */

export interface DocumentViewProps {
  docId: string
  rawText: string
  result: ParseDocumentResult
  /** Session generation; changes invalidate progressive-mount progress. */
  generation: number
  /**
   * Simplified reading subset (R29): images render as alt placeholders and
   * heavy engines were skipped by the pipeline; the block/segment source map
   * is unchanged.
   */
  simplified?: boolean
  /**
   * Block that must be mounted before focusing it (search/history locate);
   * the progressive mount never skips a revealed block (ui-spec §3.4).
   */
  revealBlockId?: string | null
  /** `<mark>` highlight ranges per `data-seg-id` (VC-16). */
  searchHighlights?: readonly SearchHighlight[]
  /** Document-link router: hash fragments and relative documents (R15/R16). */
  onDocumentLink?: (href: string) => void
}

export interface SearchHighlightRange {
  /** UTF-16 range inside the segment text. */
  start: number
  end: number
  current?: boolean
}

export interface SearchHighlight {
  segId: string
  ranges: readonly SearchHighlightRange[]
}

/** rehype-react passes the source node with `passNode: true`. */
type OverrideProps = Record<string, unknown> & {
  node?: Element
  children?: ReactNode
}

interface OverrideContextValue {
  docId: string
  rawText: string
  result: ParseDocumentResult
  simplified: boolean
  highlightBySeg: ReadonlyMap<string, readonly SearchHighlightRange[]>
  sourceExcerptFor(blockId: string): string | undefined
  onDocumentLink?: (href: string) => void
}

const DocumentOverrideContext = createContext<OverrideContextValue | null>(null)

function useOverrideContext(): OverrideContextValue | null {
  return useContext(DocumentOverrideContext)
}

function classList(element: Element | undefined): readonly string[] {
  const value: unknown = element?.properties?.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/)
  return []
}

function passthrough(tag: string, props: OverrideProps): ReactNode {
  const { node: _node, children, ...rest } = props
  void _node
  return createElement(tag, rest, children)
}

function blockContextFor(
  context: OverrideContextValue,
  node: Element | undefined,
): BlockContextValue {
  const blockId = node?.properties?.dataBlockId
  const block =
    typeof blockId === 'string'
      ? context.result.blocks.find((candidate) => candidate.blockId === blockId)
      : undefined
  const range = block?.sourceRangeBytes ?? null
  return {
    blockId: block?.blockId ?? (typeof blockId === 'string' ? blockId : null),
    headingPath: block?.headingPath ?? [],
    range,
    rawText: context.rawText,
    diagnostics:
      range === null
        ? []
        : context.result.diagnostics.filter(
            (issue) =>
              issue.sourceRange !== undefined &&
              issue.sourceRange.startByte >= range.startByte &&
              issue.sourceRange.startByte < range.endByte,
          ),
  }
}

function SectionOverride(props: OverrideProps): ReactNode {
  const context = useOverrideContext()
  if (context === null) return passthrough('section', props)
  const blockId = props.node?.properties?.dataBlockId
  return createElement(
    BlockContext.Provider,
    { value: blockContextFor(context, props.node) },
    createElement(ContentBlock, {
      ...(props as Record<string, unknown>),
      sourceExcerpt:
        typeof blockId === 'string' ? context.sourceExcerptFor(blockId) : undefined,
    } as never),
  )
}

function SpanOverride(props: OverrideProps): ReactNode {
  const context = useOverrideContext()
  if (classList(props.node).includes(MATH_ERROR_CLASS)) {
    return createElement(MathErrorBlock, props as never)
  }
  const kind = mathElementKind(props.node)
  if (kind !== null) {
    // Both inline and display KaTeX output are spans; the class marks the
    // display wrapper (`span.katex-display`).
    return createElement(MathBlock, { ...props, display: kind === 'display' } as never)
  }
  const segId =
    typeof props.node?.properties?.dataSegId === 'string'
      ? props.node.properties.dataSegId
      : null
  const ranges = segId !== null ? context?.highlightBySeg.get(segId) : undefined
  const textChild = props.node?.children.find((child): child is Text => child.type === 'text')
  if (ranges && ranges.length > 0 && textChild) {
    const { node: _node, children: _children, ...rest } = props
    void _node
    void _children
    return createElement('span', rest, renderHighlightedText(textChild.value, ranges))
  }
  return passthrough('span', props)
}

function DivOverride(props: OverrideProps): ReactNode {
  if (classList(props.node).includes(MERMAID_BLOCK_CLASS) && props.node) {
    return createElement(MermaidBlock, { source: extractMermaidSource(props.node) })
  }
  if (classList(props.node).includes(MATH_ERROR_CLASS)) {
    return createElement(MathErrorBlock, props as never)
  }
  if (mathElementKind(props.node) === 'display') {
    return createElement(MathBlock, { ...props, display: true } as never)
  }
  if (isCodeBlockNode(props.node)) {
    return createElement(CodeBlock, { ...props } as never)
  }
  return passthrough('div', props)
}

function ImgOverride(props: OverrideProps): ReactNode {
  const context = useOverrideContext()
  return createElement(ImageBlock, {
    ...props,
    docId: context?.docId ?? '',
    simplified: context?.simplified ?? false,
  } as never)
}

/** Link routing subset (R15/R16): fragments scroll/record; http(s) go to the
 * system browser; relative Markdown documents route through the reader
 * (current-tab navigation); anything else stays unclickable. */
function AnchorOverride(props: OverrideProps): ReactNode {
  const context = useOverrideContext()
  const onDocumentLink = context?.onDocumentLink
  const { node: _node, children, ...rest } = props
  void _node
  const href = typeof rest.href === 'string' ? rest.href : undefined
  if (href === undefined) return createElement('span', {}, children)
  if (href.startsWith('#')) {
    return createElement(
      'a',
      {
        ...rest,
        href,
        onClick: (event: { preventDefault(): void }) => {
          event.preventDefault()
          if (onDocumentLink) {
            onDocumentLink(href)
            return
          }
          const target = document.getElementById(href.slice(1))
          if (target) target.scrollIntoView()
        },
      },
      children,
    )
  }
  if (/^https?:/i.test(href)) {
    return createElement(
      'a',
      {
        ...rest,
        href,
        onClick: (event: { preventDefault(): void }) => {
          event.preventDefault()
          void opener.openExternalUrl(href).catch(() => undefined)
        },
      },
      children,
    )
  }
  if (onDocumentLink && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return createElement(
      'a',
      {
        ...rest,
        href,
        onClick: (event: { preventDefault(): void }) => {
          event.preventDefault()
          onDocumentLink(href)
        },
      },
      children,
    )
  }
  return createElement('span', { className: 'ps-link-unsupported', title: href }, children)
}

const READER_COMPONENTS = {
  section: SectionOverride,
  span: SpanOverride,
  div: DivOverride,
  img: ImgOverride,
  a: AnchorOverride,
} as unknown as Partial<Components>

function renderHighlightedText(
  text: string,
  ranges: readonly SearchHighlightRange[],
): ReactNode {
  const parts: ReactNode[] = []
  let cursor = 0
  ranges.forEach((range, index) => {
    const start = Math.max(cursor, Math.min(range.start, text.length))
    const end = Math.max(start, Math.min(range.end, text.length))
    if (start > cursor) parts.push(text.slice(cursor, start))
    if (end > start) {
      parts.push(
        createElement(
          'mark',
          {
            key: `ps-mark-${index}`,
            className: range.current ? 'ps-search-mark ps-search-mark-current' : 'ps-search-mark',
            ...(range.current ? { 'data-search-current': 'true' } : {}),
          },
          text.slice(start, end),
        ),
      )
    }
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function DocumentView({
  docId,
  rawText,
  result,
  generation,
  simplified = false,
  revealBlockId,
  searchHighlights,
  onDocumentLink,
}: DocumentViewProps) {
  const blockCount = result.status === 'ok' ? result.blocks.length : 0
  const revealIndex =
    revealBlockId === undefined || revealBlockId === null
      ? -1
      : result.blocks.findIndex((block) => block.blockId === revealBlockId)
  const visibleBlocks = useProgressiveMount(blockCount, {
    generation,
    ...(revealIndex >= 0 ? { revealIndex } : {}),
  })

  const highlightBySeg = useMemo(() => {
    const map = new Map<string, SearchHighlightRange[]>()
    for (const highlight of searchHighlights ?? []) {
      const existing = map.get(highlight.segId) ?? []
      existing.push(...highlight.ranges)
      map.set(highlight.segId, existing)
    }
    for (const ranges of map.values()) ranges.sort((a, b) => a.start - b.start)
    return map
  }, [searchHighlights])

  const sourceExcerptFor = useMemo(() => {
    return (blockId: string): string | undefined => {
      const block = result.blocks.find((candidate) => candidate.blockId === blockId)
      if (!block) return undefined
      const range = utf8RangeToUtf16(rawText, block.sourceRangeBytes)
      return rawText.slice(range.startUtf16, range.endUtf16).slice(0, 2000)
    }
  }, [result, rawText])

  const overrideContext = useMemo<OverrideContextValue>(
    () => ({
      docId,
      rawText,
      result,
      simplified,
      highlightBySeg,
      sourceExcerptFor,
      ...(onDocumentLink ? { onDocumentLink } : {}),
    }),
    [docId, rawText, result, simplified, highlightBySeg, sourceExcerptFor, onDocumentLink],
  )

  const content = useMemo(() => {
    if (result.status !== 'ok' || !result.hast) return null
    return renderDocument(
      {
        hast: result.hast,
        blocks: result.blocks,
        segments: result.segments,
        blockLimit: visibleBlocks,
      },
      { components: READER_COMPONENTS, translate: t, sourceExcerptFor },
    )
  }, [result, sourceExcerptFor, visibleBlocks])

  if (result.status !== 'ok' || !result.hast) {
    return (
      <div className="ps-document-fallback">
        <p role="alert">{t('error.parse.document')}</p>
        <pre className="ps-document-fallback-source">{rawText}</pre>
      </div>
    )
  }

  return (
    <DocumentOverrideContext.Provider value={overrideContext}>
      <div className="ps-document-body">{content}</div>
    </DocumentOverrideContext.Provider>
  )
}
