import type { Element } from 'hast'
import { createElement, type ComponentProps, type ReactNode } from 'react'

import { t } from '../../../app/i18n'
import { BlockErrorBoundary } from '../../../document/BlockErrorBoundary'

/**
 * Top-level block wrapper (ui-spec §2.2 `body/ContentBlock.tsx`;
 * rendering-pipeline §2.11/§3).
 *
 * The section already carries the pipeline-produced `data-block-id` /
 * `data-src-*` / `data-seg-id` attributes; this component adds the per-block
 * error boundary so one failing block shows its source excerpt and a
 * localized label instead of blanking the document (rendering-pipeline §4).
 */

export type ContentBlockProps = ComponentProps<'section'> & {
  /** Raw hast element with the trusted data attributes (passNode). */
  node?: Element
  /** Source excerpt for the failure fallback, resolved by DocumentView. */
  sourceExcerpt?: string
}

export function ContentBlock({ node, sourceExcerpt, children, ...rest }: ContentBlockProps) {
  const section = createElement('section', rest, children)
  const blockId = node?.properties?.dataBlockId
  if (typeof blockId !== 'string') return section
  return (
    <BlockErrorBoundary blockId={blockId} sourceExcerpt={sourceExcerpt} translate={t}>
      {section}
    </BlockErrorBoundary>
  )
}

/** Default section renderer used when the pipeline produced no block id. */
export function renderPlainSection(props: ContentBlockProps): ReactNode {
  const { node, sourceExcerpt, children, ...rest } = props
  void node
  void sourceExcerpt
  return createElement('section', rest, children)
}
