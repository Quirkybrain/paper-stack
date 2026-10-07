import { createElement, type ReactNode } from 'react'

/**
 * The single trusted-engine-HTML injection point (security-model §5.2:
 * "dangerouslySetInnerHTML 仅允许在消毒后受信引擎输出单一封装组件内出现";
 * ADR-002 §5.1; B-01).
 *
 * Both consumers — the Mermaid SVG (`features/reader/body/MermaidBlock`) and
 * the sanitized KaTeX preview (`features/reader/inspect/FormulaPanel`) — route
 * their post-sanitize engine output through this component; no other module
 * may carry the raw-injection prop. The `html` argument is always an engine
 * string (KaTeX/Mermaid output), never document text.
 */

export interface SanitizedNodeProps {
  /** Trusted engine output (KaTeX HTML or Mermaid SVG). */
  html: string
  className?: string
  /** Wrapper element; engine output defaults to an inline `span`. */
  as?: 'span' | 'div'
}

export function SanitizedNode({ html, className, as = 'span' }: SanitizedNodeProps): ReactNode {
  return createElement(as, {
    ...(className === undefined ? {} : { className }),
    dangerouslySetInnerHTML: { __html: html },
  })
}
