import type { Element } from 'hast'
import { createElement, useMemo, type ReactNode } from 'react'
import type { Components } from 'rehype-react'

import { t } from '../../../app/i18n'
import { renderDocument, useProgressiveMount } from '../../../document/map'
import { MATH_ERROR_CLASS } from '../../../document/plugins/katex'
import { MERMAID_BLOCK_CLASS, extractMermaidSource } from '../../../document/plugins/mermaid'
import { utf8RangeToUtf16 } from '../../../document/source-map'
import type { ParseDocumentResult } from '../../../document/types'
import { opener } from '../../../services'
import { ContentBlock } from './ContentBlock'
import { ImageBlock } from './ImageBlock'
import { MathErrorBlock } from './MathErrorBlock'
import { MermaidBlock } from './MermaidBlock'

/**
 * Body renderer (ui-spec §3.2 `body/DocumentView.tsx`; rendering-pipeline
 * §2.11–§2.12): maps the engine-processed hast to React through
 * `renderDocument`, mounts blocks progressively, and supplies the reader's
 * component overrides (formula errors, images, Mermaid, links).
 */

export interface DocumentViewProps {
  docId: string
  rawText: string
  result: ParseDocumentResult
  /** Session generation; changes invalidate progressive-mount progress. */
  generation: number
}

/** rehype-react passes the source node with `passNode: true`. */
type OverrideProps = Record<string, unknown> & {
  node?: Element
  children?: ReactNode
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

function MathOrPassthrough(tag: 'span' | 'div', props: OverrideProps): ReactNode {
  if (classList(props.node).includes(MATH_ERROR_CLASS)) {
    return createElement(MathErrorBlock, props as never)
  }
  return passthrough(tag, props)
}

function MermaidOrPassthrough(props: OverrideProps): ReactNode {
  if (classList(props.node).includes(MERMAID_BLOCK_CLASS) && props.node) {
    return createElement(MermaidBlock, { source: extractMermaidSource(props.node) })
  }
  return MathOrPassthrough('div', props)
}

function ImageOverride(props: OverrideProps & { docId: string }): ReactNode {
  return createElement(ImageBlock, props as never)
}

/** Link routing subset (R15): fragments scroll; http(s) go to the system browser. */
function AnchorOverride(props: OverrideProps): ReactNode {
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
          const target = document.getElementById(href.slice(1))
          if (target) {
            event.preventDefault()
            target.scrollIntoView()
          }
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
  // Relative document links route in wp-26; not clickable until then.
  return createElement('span', { className: 'ps-link-unsupported', title: href }, children)
}

export function DocumentView({ docId, rawText, result, generation }: DocumentViewProps) {
  const blockCount = result.status === 'ok' ? result.blocks.length : 0
  const visibleBlocks = useProgressiveMount(blockCount, { generation })

  const sourceExcerptFor = useMemo(() => {
    return (blockId: string): string | undefined => {
      const block = result.blocks.find((candidate) => candidate.blockId === blockId)
      if (!block) return undefined
      const range = utf8RangeToUtf16(rawText, block.sourceRangeBytes)
      return rawText.slice(range.startUtf16, range.endUtf16).slice(0, 2000)
    }
  }, [result, rawText])

  const components = useMemo(() => {
    const overrides: Record<string, (props: OverrideProps) => ReactNode> = {
      section: (props) => {
        const blockId = props.node?.properties?.dataBlockId
        return createElement(ContentBlock, {
          ...(props as Record<string, unknown>),
          sourceExcerpt: typeof blockId === 'string' ? sourceExcerptFor(blockId) : undefined,
        } as never)
      },
      span: (props) => MathOrPassthrough('span', props),
      div: (props) => MermaidOrPassthrough(props),
      img: (props) => ImageOverride({ ...props, docId }),
      a: (props) => AnchorOverride(props),
    }
    return overrides as unknown as Partial<Components>
  }, [docId, sourceExcerptFor])

  const content = useMemo(() => {
    if (result.status !== 'ok' || !result.hast) return null
    return renderDocument(
      {
        hast: result.hast,
        blocks: result.blocks,
        segments: result.segments,
        blockLimit: visibleBlocks,
      },
      { components, translate: t, sourceExcerptFor },
    )
  }, [result, components, sourceExcerptFor, visibleBlocks])

  if (result.status !== 'ok' || !result.hast) {
    return (
      <div className="ps-document-fallback">
        <p role="alert">{t('error.parse.document')}</p>
        <pre className="ps-document-fallback-source">{rawText}</pre>
      </div>
    )
  }

  return <div className="ps-document-body">{content}</div>
}
