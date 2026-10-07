import type { Element, ElementContent } from 'hast'
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

import { t } from '../../../app/i18n'
import { MATH_ERROR_CLASS, MATH_ERROR_SOURCE_CLASS } from '../../../document/plugins/katex'
import { nodeSourceRangeBytes } from '../../../document/source-map'
import { clipboard } from '../../../services'
import { Button } from '../../../components/Button'
import { IconButton } from '../../../components/IconButton'
import { useReaderUi } from '../ui-context'
import { useBlockContext } from './block-context'
import { CODE_COPY_FEEDBACK_MS } from './CodeBlock'
import { useCopyFeedback } from './copy-feedback'

/**
 * Formula host with the explicit tool bar (ui-spec §3.6; T-46, R10–R11).
 *
 * Tools appear only on formula elements themselves (hover/focus-within), never
 * on text selection. The formula source is extracted from the trusted KaTeX
 * annotation (or the local math-error placeholder) and never includes the `$`
 * delimiters. Block formulas expose inspect/view-source/copy/zoom; inline
 * formulas expose the inspect entry only, keeping the reading column quiet.
 */

export const KATEX_CLASS = 'katex'
export const KATEX_DISPLAY_CLASS = 'katex-display'

const MathNestingContext = createContext(false)

function classList(element: Element | undefined): readonly string[] {
  const value: unknown = element?.properties?.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/)
  return []
}

function textOf(node: Element): string {
  let value = ''
  const walk = (child: ElementContent): void => {
    if (child.type === 'text') {
      value += child.value
      return
    }
    if (child.type === 'element') {
      for (const grandChild of child.children) walk(grandChild)
    }
  }
  for (const child of node.children) walk(child)
  return value
}

/**
 * Source text of a rendered formula: the `application/x-tex` annotation of the
 * KaTeX output, or the local error placeholder source. No `$` delimiters.
 */
export function extractFormulaSource(node: Element | undefined): string {
  if (!node) return ''
  let annotation = ''
  let errorSource = ''
  const stack: ElementContent[] = [...node.children]
  while (stack.length > 0) {
    const child = stack.shift()
    if (!child || child.type !== 'element') continue
    const classes = classList(child)
    if (classes.includes(MATH_ERROR_SOURCE_CLASS)) {
      errorSource = textOf(child)
      break
    }
    if (child.properties.encoding === 'application/x-tex') {
      annotation = textOf(child)
      break
    }
    stack.unshift(...child.children.filter((entry) => entry.type === 'element'))
  }
  return errorSource || annotation
}

/** KaTeX-generated class of a math element, or null for other nodes. */
export function mathElementKind(node: Element | undefined): 'inline' | 'display' | null {
  const classes = classList(node)
  if (classes.includes(MATH_ERROR_CLASS)) return null
  if (classes.includes(KATEX_DISPLAY_CLASS)) return 'display'
  if (classes.includes(KATEX_CLASS)) return 'inline'
  return null
}

export interface MathBlockProps {
  node?: Element
  display: boolean
  className?: string
  children?: ReactNode
}

export function MathBlock({ node, display, children, ...rest }: MathBlockProps) {
  const nested = useContext(MathNestingContext)
  const context = useBlockContext()
  const ui = useReaderUi()
  const source = useMemo(() => extractFormulaSource(node), [node])
  const { status: feedback, report: reportCopy } = useCopyFeedback(CODE_COPY_FEEDBACK_MS)

  if (nested || !ui) {
    // Nested math inside a display block never gets its own toolbar.
    return createElement(display ? 'div' : 'span', rest, children)
  }

  const isError = classList(node).includes(MATH_ERROR_CLASS)
  const range =
    (context && node ? nodeSourceRangeBytes(context.rawText, node) : null) ?? context?.range ?? null
  const chapter =
    context && context.headingPath.length > 0 ? context.headingPath.join(' / ') : null
  const diagnostic = isError
    ? (context?.diagnostics.find((issue) => issue.messageKey === 'error.parse.local') ?? null)
    : null

  const openInspect = () =>
    ui.openInspect({
      kind: 'formula',
      source,
      chapter,
      range,
      diagnostic: diagnostic ? { code: diagnostic.code, messageKey: diagnostic.messageKey } : null,
    })

  const handleCopy = async () => {
    const result = await clipboard.copyText(source)
    reportCopy(result.ok)
  }

  const feedbackNode =
    feedback === 'copied'
      ? createElement('span', { role: 'status' }, t('formula.copied'))
      : feedback === 'failed'
        ? createElement('span', { role: 'alert' }, t('formula.copyFailed'))
        : null

  const tools = display
    ? createElement(
        'span',
        { className: 'ps-math-tools', role: 'group', 'aria-label': t('formula.drawer.title') },
        createElement(IconButton, { icon: 'info', label: t('formula.drawer.title'), onClick: openInspect }),
        createElement(
          Button,
          { variant: 'secondary', onClick: () => ui.enterSource(range, context?.blockId ?? null) },
          t('formula.action.viewSource'),
        ),
        createElement(Button, { variant: 'secondary', onClick: () => void handleCopy() }, t('formula.action.copySource')),
        createElement(
          Button,
          {
            variant: 'secondary',
            onClick: () => ui.openZoom({ label: t('formula.drawer.title'), content: children }),
          },
          t('formula.action.zoom'),
        ),
        feedbackNode,
      )
    : createElement(
        'span',
        { className: 'ps-math-tools ps-math-tools-inline' },
        createElement(IconButton, { icon: 'info', label: t('formula.drawer.title'), onClick: openInspect }),
      )

  const body = createElement(MathNestingContext.Provider, { value: true }, tools, children)
  return createElement(display ? 'div' : 'span', rest, body)
}
