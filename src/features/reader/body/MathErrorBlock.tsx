import type { Element, ElementContent } from 'hast'
import { createElement, type ComponentProps, type ReactNode } from 'react'

import { t } from '../../../app/i18n'
import {
  MATH_ERROR_CLASS,
  MATH_ERROR_SOURCE_CLASS,
} from '../../../document/plugins/katex'

/**
 * Local formula failure placeholder (rendering-pipeline §2.8/§4, R10).
 *
 * The math engine replaced a failing node with `.math-error` carrying the
 * original source in a `<code>` element; this component renders the localized
 * label next to the copyable source. The full formula drawer (inspect, copy,
 * zoom) belongs to wp-26.
 */

export interface MathErrorBlockProps extends ComponentProps<'span'> {
  node?: Element
}

export function extractMathErrorSource(node: Element | undefined): string {
  if (!node) return ''
  let source = ''
  const walk = (child: ElementContent): void => {
    if (child.type === 'text') {
      source += child.value
      return
    }
    if (child.type === 'element') {
      for (const grandChild of child.children) walk(grandChild)
    }
  }
  const stack: ElementContent[] = [...node.children]
  while (stack.length > 0) {
    const current = stack.shift()
    if (!current) continue
    if (current.type === 'element') {
      const classes = Array.isArray(current.properties.className)
        ? current.properties.className.map(String)
        : []
      if (classes.includes(MATH_ERROR_SOURCE_CLASS)) {
        walk(current)
        break
      }
      stack.push(...current.children)
    }
  }
  return source
}

export function MathErrorBlock({ node, children, ...rest }: MathErrorBlockProps) {
  void children
  const display = node?.tagName === 'div'
  const source = extractMathErrorSource(node)
  const content: ReactNode = (
    <>
      <span className="ps-math-error-label">{t('error.parse.local')}</span>
      <code className={`${MATH_ERROR_SOURCE_CLASS} ps-math-error-source`}>{source}</code>
    </>
  )
  return createElement(
    display ? 'div' : 'span',
    {
      ...rest,
      className: `${MATH_ERROR_CLASS} ps-math-error${display ? ' ps-math-error-display' : ''}`,
      role: 'note',
    },
    content,
  )
}
