import type { Element, Root } from 'hast'
import { createElement, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import rehypeReact, { type Components } from 'rehype-react'
import { unified } from 'unified'

import { annotateTree } from './annotate'
import { BlockErrorBoundary, type Translate } from './BlockErrorBoundary'
import type { BlockRecord, SearchSegment } from './types'

/**
 * Stage ⑪–⑫ on the main thread (rendering-pipeline §2.11–§2.12; ADR-002 §1):
 * sanitized/engine-processed hast → block-wrapped React tree, plus the
 * progressive-mount shard helpers.
 *
 * The Worker result never contains React elements or document text, so the
 * mapping stays on the main thread and receives the structured-cloneable
 * product of `parseDocument`.
 */

export interface RenderDocumentInput {
  hast: Root | null
  blocks: readonly BlockRecord[]
  segments: readonly SearchSegment[]
}

export interface RenderDocumentOptions {
  /** Feature-level component overrides (links, images, code, …). */
  components?: Partial<Components>
  /** App `t` function; labels in fault fallbacks resolve through it. */
  translate?: Translate
  /** Source excerpt shown when a block fails to render. */
  sourceExcerptFor?: (blockId: string) => string | undefined
  onBlockError?: (error: Error, blockId?: string) => void
}

const identityTranslate: Translate = (key) => key

export function renderDocument(
  input: RenderDocumentInput,
  options: RenderDocumentOptions = {},
): ReactNode {
  if (!input.hast) return null
  const annotated = annotateTree(input.hast, { blocks: input.blocks, segments: input.segments })
  const processor = unified().use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    components: createDocumentComponents(options),
    passNode: true,
  })
  return processor.stringify(annotated) as ReactNode
}

type SectionProps = ComponentProps<'section'> & { node?: Element }

export function createDocumentComponents(options: RenderDocumentOptions = {}): Partial<Components> {
  const translate = options.translate ?? identityTranslate
  const base: Partial<Components> = {
    section: (props: SectionProps) => renderSection(props, options, translate),
    input: (props: ComponentProps<'input'>) =>
      createElement('input', { ...props, type: 'checkbox', disabled: true, readOnly: true }),
  }
  return { ...base, ...options.components }
}

function renderSection(
  props: SectionProps,
  options: RenderDocumentOptions,
  translate: Translate,
): ReactNode {
  const { node, children, ...rest } = props
  const blockId = stringProperty(node, 'dataBlockId')
  const section = createElement('section', rest, children)
  if (!blockId) return section

  const sourceExcerpt = options.sourceExcerptFor?.(blockId)
  return (
    <BlockErrorBoundary
      blockId={blockId}
      sourceExcerpt={sourceExcerpt}
      translate={translate}
      onError={options.onBlockError}
    >
      {section}
    </BlockErrorBoundary>
  )
}

function stringProperty(node: Element | undefined, key: string): string | undefined {
  const value = node?.properties?.[key]
  return typeof value === 'string' ? value : undefined
}

export interface MountShardOptions {
  /** Blocks rendered in the first shard (first screen). */
  firstShard?: number
  /** Blocks appended per following shard. */
  shardSize?: number
}

/**
 * Split a block list into mount shards: first-screen shard then idle shards.
 * Pure helper for the reader's progressive mounting (rendering-pipeline
 * §2.12); index-order only, never reorders content.
 */
export function planMountShards<T>(items: readonly T[], options: MountShardOptions = {}): T[][] {
  const firstShard = Math.max(1, options.firstShard ?? 24)
  const shardSize = Math.max(1, options.shardSize ?? 24)
  const shards: T[][] = []
  if (items.length === 0) return shards
  shards.push(items.slice(0, firstShard))
  for (let index = firstShard; index < items.length; index += shardSize) {
    shards.push(items.slice(index, index + shardSize))
  }
  return shards
}

/**
 * Visible-block count for progressive mounting. Resets on `generation` change
 * (task invalidation, rendering-pipeline §2.12), renders the first shard
 * immediately and appends following shards when idle.
 */
export function useProgressiveMount(
  total: number,
  options: MountShardOptions & { generation?: number } = {},
): number {
  const { generation = 0, firstShard = 24, shardSize = 24 } = options
  const safeTotal = Math.max(0, total)
  const initial = Math.min(Math.max(1, firstShard), safeTotal)
  const [state, setState] = useState({ generation, visible: initial })

  useEffect(() => {
    if (safeTotal <= initial) return undefined

    let cancelled = false
    let count = initial
    let idleHandle: number | undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    const schedule = (): void => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(pump)
      } else {
        timeoutHandle = setTimeout(pump, 0)
      }
    }
    const pump = (): void => {
      if (cancelled) return
      count = Math.min(count + Math.max(1, shardSize), safeTotal)
      setState({ generation, visible: count })
      if (count < safeTotal) schedule()
    }

    schedule()

    return () => {
      cancelled = true
      if (
        idleHandle !== undefined &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    }
  }, [generation, safeTotal, initial, shardSize])

  // A generation change invalidates previous mount progress without an effect:
  // stale shards stop rendering immediately (rendering-pipeline §2.12).
  const visible = state.generation === generation ? state.visible : initial
  return Math.min(visible, safeTotal)
}
