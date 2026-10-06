import type { Element, ElementContent, Root, RootContent, Text } from 'hast'
import katex from 'katex'
import rehypeKatex from 'rehype-katex'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { EngineContext, PipelineEngine } from '../engines'
import { positionToUtf16Range } from '../source-map'
import type { SourceRangeUtf16 } from '../types'

/**
 * Math engine slot ⑧ (rendering-pipeline §2.3/§2.8; R10).
 *
 * ③ parsing: `remark-math` turns `$…$`/`$$…$$` into mdast `inlineMath`/`math`
 * nodes; after `remark-rehype` they carry the `language-math` marker plus
 * `math-inline`/`math-display` and become `code` elements. The bounded
 * sanitize-schema extension (`sanitize.ts`, D-3) lets those marker classes
 * survive ⑦; the engine then renders each node with KaTeX and replaces it
 * with trusted output (never re-sanitized, never re-parsed from document
 * text).
 *
 * Per-node isolation: every marker is rendered once in a pre-flight try/catch;
 * a failing node (unknown macro, engine limit) becomes a local `.math-error`
 * placeholder carrying the original source in a `<code>` element, plus one
 * `PS_PARSE_LOCAL` diagnostic. The remaining nodes still render through
 * `rehype-katex` with the frozen safe options:
 * `trust:false`, `strict:'warn'`, `maxSize`/`maxExpand` caps and one macros
 * object per document render (never shared across documents).
 */

/** Initial cap for user-specified em sizes (calibratable; security-model §5.2). */
export const KATEX_MAX_SIZE_EM = 20

/** Initial macro-expansion cap (KaTeX default made explicit). */
export const KATEX_MAX_EXPAND = 1000

export const MATH_MARKER_CLASS = 'language-math'
export const MATH_INLINE_CLASS = 'math-inline'
export const MATH_DISPLAY_CLASS = 'math-display'
export const MATH_ERROR_CLASS = 'math-error'
export const MATH_ERROR_SOURCE_CLASS = 'math-error-source'

/** Frozen KaTeX settings shared by the pre-flight check and the real render. */
export function katexOptions(macros: Record<string, string>) {
  return {
    trust: false,
    strict: 'warn' as const,
    maxSize: KATEX_MAX_SIZE_EM,
    maxExpand: KATEX_MAX_EXPAND,
    macros,
  }
}

export interface MathRemarkSettings {
  /** Document-level inline-math switch (rendering-pipeline §2.3). */
  inlineMath: boolean
}

/**
 * remark-math registration (③). Only called in `technical` mode; with
 * `inlineMath:false` only `$$…$$` blocks still produce math nodes. Code
 * contexts never produce math nodes — the tokenizer guarantees it.
 */
export { default as remarkMathPlugin } from 'remark-math'

function classList(element: Element): readonly string[] {
  const value: unknown = element.properties.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/)
  return []
}

function isMathMarker(element: Element): boolean {
  const classes = classList(element)
  return (
    classes.includes(MATH_MARKER_CLASS) ||
    classes.includes(MATH_INLINE_CLASS) ||
    classes.includes(MATH_DISPLAY_CLASS)
  )
}

/** Plain text of a node with all whitespace preserved (KaTeX source value). */
function sourceText(node: Element): string {
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

type ScopeParent = { children: Array<RootContent | ElementContent> }

interface MathScope {
  /** Node replaced on failure/rendered on success (the `<pre>` for display math). */
  scope: Element
  parent: ScopeParent
  index: number
  source: string
  displayMode: boolean
  range?: SourceRangeUtf16
}

function createMathErrorNode(scope: Element, source: string, displayMode: boolean): Element {
  return {
    type: 'element',
    tagName: displayMode ? 'div' : 'span',
    properties: {
      className: displayMode
        ? [MATH_ERROR_CLASS, `${MATH_ERROR_CLASS}-display`]
        : [MATH_ERROR_CLASS],
    },
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: [MATH_ERROR_SOURCE_CLASS] },
        children: [{ type: 'text', value: source } satisfies Text],
      },
    ],
    position: scope.position,
  }
}

function reportMathError(context: EngineContext, scope: MathScope): void {
  context.addDiagnostic({
    code: 'PS_PARSE_LOCAL',
    category: 'parse',
    messageKey: 'error.parse.local',
    retryable: false,
    ...(scope.range ? { sourceRange: scope.range } : {}),
    // Never include the KaTeX error message: it can quote document text.
    details: { engine: 'katex' },
  })
}

function checkScope(scope: MathScope, macros: Record<string, string>, context: EngineContext): void {
  try {
    katex.renderToString(scope.source, {
      ...katexOptions(macros),
      displayMode: scope.displayMode,
      throwOnError: true,
    })
  } catch {
    // Re-check index safety: earlier replacements shift sibling positions.
    const index = scope.parent.children.indexOf(scope.scope)
    if (index === -1) return
    scope.parent.children.splice(
      index,
      1,
      createMathErrorNode(scope.scope, scope.source, scope.displayMode),
    )
    reportMathError(context, scope)
  }
}

/**
 * Pre-flight each marker node individually so a single bad formula cannot
 * abort the document. Failing nodes are replaced before `rehype-katex` runs.
 *
 * Marker shapes (mdast-util-math): inline `code.language-math.math-inline`
 * inside a paragraph; display `pre > code.language-math.math-display`. The
 * display scope is the whole `pre`, matching rehype-katex.
 */
function isolateMathErrors(tree: Root, context: EngineContext, macros: Record<string, string>): void {
  const handled = new Set<Element>()
  visit(tree, 'element', (element, index, parent) => {
    if (!parent || index === undefined || handled.has(element)) return
    if (element.tagName === 'pre') {
      const code = element.children.find(
        (child): child is Element =>
          child.type === 'element' && child.tagName === 'code' && isMathMarker(child),
      )
      if (!code) return
      handled.add(element)
      handled.add(code)
      checkScope(
        {
          scope: element,
          parent: parent as ScopeParent,
          index,
          source: sourceText(code),
          displayMode: true,
          range: positionToUtf16Range(element.position) ?? undefined,
        },
        macros,
        context,
      )
      return
    }
    if (element.tagName !== 'code' || !isMathMarker(element)) return
    // Math inside a `pre` is handled at the `pre` level above.
    if (parent.type === 'element' && parent.tagName === 'pre') return
    handled.add(element)
    const classes = classList(element)
    checkScope(
      {
        scope: element,
        parent: parent as ScopeParent,
        index,
        source: sourceText(element),
        displayMode: classes.includes(MATH_DISPLAY_CLASS),
        range: positionToUtf16Range(element.position) ?? undefined,
      },
      macros,
      context,
    )
  })
}

export const katexEngine: PipelineEngine = {
  name: 'katex',
  transform(tree, context) {
    const macros: Record<string, string> = {}
    isolateMathErrors(tree, context, macros)
    const processor = unified().use(rehypeKatex, katexOptions(macros))
    processor.runSync(tree)
  },
}
