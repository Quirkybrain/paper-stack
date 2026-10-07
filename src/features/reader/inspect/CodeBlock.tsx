import type { Element } from 'hast'
import { createElement, useMemo, useState, type ReactNode } from 'react'

import { t } from '../../../app/i18n'
import {
  CODE_BLOCK_CLASS,
  extractCodeText,
  normalizeCodeCopyPayload,
} from '../../../document/plugins/shiki'
import { clipboard } from '../../../services'
import { Button } from '../../../components/Button'
import { useReaderUi } from '../ui-context'
import { useBlockContext } from './block-context'
import { useCopyFeedback } from './copy-feedback'

/**
 * Code block host with the VC-05 action bar (ui-spec §3.6; T-46).
 *
 * - Copy takes the whole literal code (gutter excluded, LF-normalized) and is
 *   built from the pipeline output, never from the visible substring; feedback
 *   appears only after the clipboard confirmed success (EDGE-09) and reverts
 *   after ~1.5s; failure stays until the next attempt.
 * - Wrap only changes this block's display and is remembered for the session.
 * - Blocks longer than 40 lines start collapsed to the first 20 lines;
 *   expanding does not change the copy payload.
 * - View source opens UI04 at this block's source range.
 */

export const CODE_COPY_FEEDBACK_MS = 1500
export const CODE_COLLAPSE_THRESHOLD_LINES = 40
export const CODE_COLLAPSED_LINES = 20

const wrapPreference = new Map<string, boolean>()

/** Test helper: clear the session-scoped wrap preferences. */
export function resetCodeWrapSessionForTests(): void {
  wrapPreference.clear()
}

export function findCodeElement(node: Element | undefined): Element | null {
  if (!node) return null
  const stack = [...node.children]
  while (stack.length > 0) {
    const child = stack.shift()
    if (!child || child.type !== 'element') continue
    if (child.tagName === 'code') return child
    stack.unshift(...child.children.filter((entry) => entry.type === 'element'))
  }
  return null
}

/** Literal line count of a code payload (trailing newline is not a line). */
export function codeLineCount(literal: string): number {
  const body = literal.endsWith('\n') ? literal.slice(0, -1) : literal
  if (body.length === 0) return 0
  return body.split('\n').length
}

export interface CodeBlockProps {
  node?: Element
  className?: string
  children?: ReactNode
}

export function CodeBlock({ node, className, children }: CodeBlockProps) {
  const context = useBlockContext()
  const ui = useReaderUi()
  const code = useMemo(() => findCodeElement(node), [node])
  const literal = useMemo(() => (code ? extractCodeText(code) : ''), [code])
  const lineCount = codeLineCount(literal)
  const blockId = context?.blockId ?? null
  const wrapKey = blockId ?? `code:${lineCount}:${literal.length}`
  const [wrap, setWrap] = useState(() => wrapPreference.get(wrapKey) ?? false)
  const [expanded, setExpanded] = useState(false)
  const { status: feedback, report: reportCopy } = useCopyFeedback(CODE_COPY_FEEDBACK_MS)

  const collapsed = lineCount > CODE_COLLAPSE_THRESHOLD_LINES && !expanded
  const language =
    typeof node?.properties?.dataLanguage === 'string' ? node.properties.dataLanguage : 'plaintext'

  const handleCopy = async () => {
    const result = await clipboard.copyText(normalizeCodeCopyPayload(literal))
    reportCopy(result.ok)
  }

  const handleWrap = () => {
    const next = !wrap
    setWrap(next)
    wrapPreference.set(wrapKey, next)
  }

  const nodeClasses = Array.isArray(node?.properties?.className)
    ? node.properties.className.map(String)
    : typeof node?.properties?.className === 'string'
      ? [node.properties.className]
      : []
  const classes = [
    ...nodeClasses,
    className,
    'ps-code-block',
    wrap ? 'ps-code-wrapped' : '',
    collapsed ? 'ps-code-collapsed' : '',
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')

  return createElement(
    'div',
    { className: classes, 'data-line-count': lineCount },
    createElement(
      'div',
      { className: 'ps-code-actions', role: 'group', 'aria-label': t('code.action.copyAria') },
      createElement('span', { className: 'ps-code-language' }, language),
      createElement('span', { className: 'ps-toolbar-spacer' }),
      feedback === 'copied' ? createElement('span', { role: 'status' }, t('code.copied')) : null,
      feedback === 'failed' ? createElement('span', { role: 'alert' }, t('code.copyFailed')) : null,
      createElement(
        Button,
        { variant: 'secondary', onClick: () => void handleCopy(), 'aria-label': t('code.action.copyAria') },
        t('code.action.copy'),
      ),
      createElement(
        Button,
        {
          variant: 'secondary',
          onClick: handleWrap,
          'aria-pressed': wrap,
          'aria-label': t('code.action.wrapAria'),
        },
        t('code.action.wrap'),
      ),
      collapsed
        ? createElement(
            Button,
            { variant: 'secondary', onClick: () => setExpanded(true) },
            t('code.action.expand', { count: lineCount }),
          )
        : expanded && lineCount > CODE_COLLAPSE_THRESHOLD_LINES
          ? createElement(
              Button,
              { variant: 'secondary', onClick: () => setExpanded(false) },
              t('code.action.collapse'),
            )
          : null,
      ui
        ? createElement(
            Button,
            {
              variant: 'secondary',
              onClick: () => ui.enterSource(context?.range ?? null, blockId),
            },
            t('code.action.viewSource'),
          )
        : null,
    ),
    collapsed
      ? createElement(
          'p',
          { className: 'ps-code-collapsed-note', role: 'status' },
          t('code.collapsed', { shown: CODE_COLLAPSED_LINES, total: lineCount }),
        )
      : null,
    createElement('div', { className: 'ps-code-row' }, children),
  )
}

/** True when a `div` hast node is the pipeline's code block wrapper. */
export function isCodeBlockNode(node: Element | undefined): boolean {
  const classes = Array.isArray(node?.properties?.className)
    ? node.properties.className.map(String)
    : []
  return classes.includes(CODE_BLOCK_CLASS)
}
