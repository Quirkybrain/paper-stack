import type { Element, Text } from 'hast'
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Components } from 'rehype-react'

import { t } from '../../../app/i18n'
import { renderDocument, useProgressiveMount } from '../../../document/map'
import { MATH_ERROR_CLASS } from '../../../document/plugins/katex'
import { MERMAID_BLOCK_CLASS, extractMermaidSource } from '../../../document/plugins/mermaid'
import type { BlockRecord, ParseDocumentResult } from '../../../document/types'
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
  /**
   * Monotonic counter bumped on every locate request. A repeated request for
   * the same `revealBlockId` (for example re-clicking one outline entry after
   * scrolling away) must re-impose the reveal window even though the id is
   * unchanged (D-IT-3 windowed mounting).
   */
  revealNonce?: number
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

// ---------------------------------------------------------------------------
// Windowed mounting for large simplified documents (D-IT-3)
// ---------------------------------------------------------------------------

/**
 * Simplified documents above this block count mount through a bounded window
 * instead of the progressive pump. The progressive pump re-renders the whole
 * mounted prefix for every shard and only stops after mounting *all* blocks,
 * which on the 11 MiB corpus (145k blocks, ~6k shards) keeps WebKitGTK at
 * ≥100% CPU for minutes and starves window-manager events (D-IT-3 residual).
 * A bounded window mounts the first screen immediately, follows explicit
 * navigation targets, and grows on user scroll only.
 */
export const WINDOWED_MOUNT_MIN_BLOCKS = 2000
/** Blocks mounted before any scroll (first screen + copyable first code block). */
export const WINDOWED_MOUNT_INITIAL = 120
/** Blocks added per scroll-driven growth step (hard cap per commit). */
export const WINDOWED_MOUNT_STEP = 120
/** Hard cap on the mounted window size, regardless of document size. */
export const WINDOWED_MOUNT_MAX = 600
/** Blocks kept above a navigation target when the window jumps to it. */
export const WINDOWED_MOUNT_REVEAL_MARGIN = 24

export interface MountWindow {
  /** First mounted block index (inclusive). */
  start: number
  /** One past the last mounted block index (exclusive). */
  end: number
}

/** First screen of a windowed document: blocks `[0, INITIAL)`. */
export function initialMountWindow(total: number): MountWindow {
  const safeTotal = Math.max(0, total)
  return { start: 0, end: Math.min(WINDOWED_MOUNT_INITIAL, safeTotal) }
}

export function windowContains(window: MountWindow, index: number): boolean {
  return index >= window.start && index < window.end
}

/**
 * Bounded window that contains `revealIndex` (search hit / outline / history
 * locate), keeping [`WINDOWED_MOUNT_REVEAL_MARGIN`] blocks of context above
 * the target. Always mounts the target even at the document tail.
 */
export function planRevealWindow(total: number, revealIndex: number): MountWindow {
  const safeTotal = Math.max(0, total)
  const size = Math.min(WINDOWED_MOUNT_MAX, safeTotal)
  let start = Math.max(0, revealIndex - WINDOWED_MOUNT_REVEAL_MARGIN)
  if (start + size > safeTotal) start = Math.max(0, safeTotal - size)
  return { start, end: Math.min(safeTotal, start + size) }
}

/**
 * One scroll-driven growth step. Growing forward past
 * [`WINDOWED_MOUNT_MAX`] drops blocks from the top (the reader is moving
 * down); growing backward past the cap drops blocks from the bottom. Returns
 * the same object when nothing can grow (no work for React).
 */
export function growMountWindow(
  total: number,
  window: MountWindow,
  direction: 'forward' | 'backward',
): MountWindow {
  const safeTotal = Math.max(0, total)
  if (direction === 'forward') {
    if (window.end >= safeTotal) return window
    const end = Math.min(safeTotal, window.end + WINDOWED_MOUNT_STEP)
    const start = Math.max(window.start, end - WINDOWED_MOUNT_MAX)
    if (start === window.start && end === window.end) return window
    return { start, end }
  }
  if (window.start <= 0) return window
  const start = Math.max(0, window.start - WINDOWED_MOUNT_STEP)
  const end = Math.min(window.end, start + WINDOWED_MOUNT_MAX)
  if (start === window.start && end === window.end) return window
  return { start, end }
}

interface WindowState {
  generation: number
  total: number
  window: MountWindow
  /**
   * Locate request (`revealNonce:revealIndex`) already satisfied for this
   * window; a scroll-driven extension away from the target must not be
   * re-snapped back by the reveal derivation (the locate target is a one-shot
   * jump, not a global clamp). A new target or a new nonce re-imposes it.
   */
  handledReveal: string
}

/**
 * O(1) per-block source-excerpt resolver for the block error boundary.
 *
 * The section renderer resolves an excerpt for every mounted block when a
 * document renders. The previous implementation scanned the whole block list
 * and then walked the raw text from offset 0 twice per block to convert the
 * UTF-8 range; on the 11 MiB corpus a late-document window (600 blocks)
 * therefore cost billions of character steps inside one render and pegged
 * WebKitWebProcess at ~108% CPU for minutes, starving WM close (D-IT-3
 * residual). Block records already carry their exact UTF-16 range, so a
 * per-document map plus a direct slice is both correct and constant-time.
 */
export function createBlockExcerptResolver(
  blocks: readonly BlockRecord[],
  rawText: string,
  maxChars = 2000,
): (blockId: string) => string | undefined {
  const byId = new Map(blocks.map((block) => [block.blockId, block] as const))
  return (blockId: string): string | undefined => {
    const block = byId.get(blockId)
    if (!block) return undefined
    const { startUtf16, endUtf16 } = block.sourceRange
    return rawText.slice(startUtf16, endUtf16).slice(0, maxChars)
  }
}

/**
 * Window state for large simplified documents. The reveal target is resolved
 * during render (like the progressive mount's `reveal` clamp) so the located
 * block is committed together with the `revealBlockId` prop change; scroll
 * growth starts from that effective window and stores it, acknowledges the
 * locate request, and generation/total changes fall back to the initial
 * window without an effect.
 */
export function useWindowedMount(
  total: number,
  options: { generation?: number; revealIndex?: number; revealNonce?: number } = {},
): {
  window: MountWindow
  extend: (direction: 'forward' | 'backward') => void
} {
  const { generation = 0, revealIndex = -1, revealNonce = 0 } = options
  const safeTotal = Math.max(0, total)
  const initial = initialMountWindow(safeTotal)
  const [state, setState] = useState<WindowState>({
    generation,
    total: safeTotal,
    window: initial,
    handledReveal: '',
  })

  const current = state.generation === generation && state.total === safeTotal
  const base = current ? state.window : initial
  const handled = current ? state.handledReveal : ''
  const revealKey = `${revealNonce}:${revealIndex}`
  const window =
    revealIndex >= 0 &&
    revealKey !== handled &&
    revealIndex < safeTotal &&
    !windowContains(base, revealIndex)
      ? planRevealWindow(safeTotal, revealIndex)
      : base
  const windowStart = window.start
  const windowEnd = window.end

  const extend = useCallback(
    (direction: 'forward' | 'backward') => {
      const viewed: MountWindow = { start: windowStart, end: windowEnd }
      const next = growMountWindow(safeTotal, viewed, direction)
      if (next.start === viewed.start && next.end === viewed.end && revealKey === handled) {
        return
      }
      setState({
        generation,
        total: safeTotal,
        window: next,
        handledReveal: revealKey,
      })
    },
    [generation, safeTotal, windowStart, windowEnd, revealKey, handled],
  )

  return { window, extend }
}

/** First block whose bottom edge is inside the scroller viewport. */
function captureScrollAnchor(
  body: HTMLElement,
  scroller: HTMLElement,
): { blockId: string; top: number } | null {
  const viewportTop = scroller.getBoundingClientRect().top
  for (const element of body.querySelectorAll<HTMLElement>('[data-block-id]')) {
    const rect = element.getBoundingClientRect()
    if (rect.bottom > viewportTop + 1) {
      const blockId = element.getAttribute('data-block-id')
      return blockId === null ? null : { blockId, top: rect.top }
    }
  }
  return null
}

/**
 * Scroll wiring for the windowed mount: grows the window when the reader
 * approaches an edge of the mounted content. A window shift past the cap
 * removes blocks above/below the viewport; the first visible block is
 * re-anchored afterwards so the reading position does not jump. Growth is
 * strictly user-scroll-driven (delta-based), so an idle app performs no work.
 */
function useWindowedScrollGrowth(options: {
  enabled: boolean
  total: number
  bodyRef: React.RefObject<HTMLDivElement | null>
  extend: (direction: 'forward' | 'backward') => void
  windowStart: number
  windowEnd: number
}): void {
  const { enabled, total, bodyRef, extend, windowStart, windowEnd } = options
  const pendingAnchorRef = useRef<{ blockId: string; top: number } | null>(null)
  const suspendedRef = useRef(false)
  const suspendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return undefined
    const body = bodyRef.current
    const scroller = body?.closest('.ps-reader-main') as HTMLElement | null
    if (!body || !scroller || typeof scroller.addEventListener !== 'function') return undefined

    const EDGE_PX = 600
    let lastScrollTop = scroller.scrollTop
    const onScroll = () => {
      const currentTop = scroller.scrollTop
      const delta = currentTop - lastScrollTop
      lastScrollTop = currentTop
      if (suspendedRef.current || delta === 0) return
      const nearTop = currentTop <= EDGE_PX
      const nearBottom = currentTop + scroller.clientHeight >= scroller.scrollHeight - EDGE_PX
      const direction =
        delta > 0 && nearBottom ? 'forward' : delta < 0 && nearTop ? 'backward' : null
      if (direction === null) return
      const next = growMountWindow(
        Math.max(0, total),
        { start: windowStart, end: windowEnd },
        direction,
      )
      if (next.start === windowStart && next.end === windowEnd) return
      pendingAnchorRef.current = captureScrollAnchor(body, scroller)
      extend(direction)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (suspendTimerRef.current !== null) clearTimeout(suspendTimerRef.current)
    }
  }, [enabled, total, bodyRef, extend, windowStart, windowEnd])

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current
    pendingAnchorRef.current = null
    if (anchor === null) return
    const scroller = bodyRef.current?.closest('.ps-reader-main') as HTMLElement | null
    if (!scroller) return
    const element = scroller.querySelector<HTMLElement>(
      `[data-block-id="${anchor.blockId}"]`,
    )
    if (!element) return
    const offset = element.getBoundingClientRect().top - anchor.top
    if (Math.abs(offset) < 1) return
    suspendedRef.current = true
    if (suspendTimerRef.current !== null) clearTimeout(suspendTimerRef.current)
    scroller.scrollTop += offset
    suspendTimerRef.current = setTimeout(() => {
      suspendedRef.current = false
    }, 250)
  }, [windowStart, windowEnd, bodyRef])
}

export function DocumentView({
  docId,
  rawText,
  result,
  generation,
  simplified = false,
  revealBlockId,
  revealNonce = 0,
  searchHighlights,
  onDocumentLink,
}: DocumentViewProps) {
  const blockCount = result.status === 'ok' ? result.blocks.length : 0
  const revealIndex =
    revealBlockId === undefined || revealBlockId === null
      ? -1
      : result.blocks.findIndex((block) => block.blockId === revealBlockId)
  // Large simplified documents (R29) mount a bounded window instead of the
  // unbounded progressive pump; everything else keeps the progressive mount
  // (D-IT-3; rendering-pipeline §2.12).
  const windowed = simplified && blockCount > WINDOWED_MOUNT_MIN_BLOCKS
  const visibleBlocks = useProgressiveMount(windowed ? 0 : blockCount, {
    generation,
    ...(revealIndex >= 0 && !windowed ? { revealIndex } : {}),
  })
  const { window: mountWindow, extend } = useWindowedMount(blockCount, {
    generation,
    revealNonce,
    ...(revealIndex >= 0 ? { revealIndex } : {}),
  })
  const bodyRef = useRef<HTMLDivElement | null>(null)
  useWindowedScrollGrowth({
    enabled: windowed,
    total: blockCount,
    bodyRef,
    extend,
    windowStart: mountWindow.start,
    windowEnd: mountWindow.end,
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

  const sourceExcerptFor = useMemo(
    () => createBlockExcerptResolver(result.blocks, rawText),
    [result, rawText],
  )

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
        ...(windowed
          ? {
              blockStart: mountWindow.start,
              blockLimit: mountWindow.end - mountWindow.start,
            }
          : { blockLimit: visibleBlocks }),
      },
      { components: READER_COMPONENTS, translate: t, sourceExcerptFor },
    )
  }, [
    result,
    sourceExcerptFor,
    visibleBlocks,
    windowed,
    mountWindow.start,
    mountWindow.end,
  ])

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
      <div className="ps-document-body" ref={bodyRef}>
        {content}
      </div>
    </DocumentOverrideContext.Provider>
  )
}
