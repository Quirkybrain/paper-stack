import type { Element, ElementContent, Properties, Root, RootContent } from 'hast'
import type { HighlighterCore } from 'shiki/core'
import { visit } from 'unist-util-visit'

import type { EngineContext, PipelineEngine } from '../engines'

/**
 * Code engine slot ⑨ (rendering-pipeline §2.9; R11).
 *
 * Shiki is loaded lazily with `import()` on the first highlighted block; until
 * it resolves the literal code stays in the tree (plain-text placeholder) and
 * the pipeline awaits the slot as a whole. The JavaScript regex engine is used
 * on purpose: the production CSP (`script-src 'self'`) does not allow
 * WebAssembly, so the Oniguruma WASM engine is not an option and no remote
 * resource is ever fetched.
 *
 * The documented v0.1.0 language set is fixed below; unknown languages
 * degrade to plain text without a diagnostic. Line numbers are generated as a
 * separate `aria-hidden` gutter, never part of the literal code text, so copy
 * payloads stay exact (`normalizeCodeCopyPayload` is exported for wp-26).
 */

export const SHIKI_THEME = 'github-light'

export const CODE_BLOCK_CLASS = 'code-block'
export const CODE_LINES_CLASS = 'code-block-lines'
/** Trusted attribute carrying the resolved language for later code tools. */
export const CODE_LANG_ATTRIBUTE = 'data-language'
/** hast property key for `data-language` (hast uses camelCase for data-*). */
export const CODE_LANG_PROPERTY = 'dataLanguage'

/** Documented v0.1.0 language set (rendering-pipeline §2.9). */
export const SHIKI_LANGUAGES = [
  'c',
  'cpp',
  'python',
  'rust',
  'java',
  'javascript',
  'typescript',
  'bash',
  'json',
  'yaml',
  'sql',
  'plaintext',
] as const

export type ShikiLanguage = (typeof SHIKI_LANGUAGES)[number]

/** Common fence aliases for the documented set; everything else is plain text. */
const LANGUAGE_ALIASES: Readonly<Record<string, ShikiLanguage>> = {
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  py: 'python',
  python: 'python',
  rs: 'rust',
  rust: 'rust',
  java: 'java',
  js: 'javascript',
  jsx: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext',
  plaintext: 'plaintext',
}

/**
 * Resolve a fence language to the documented set. Unknown languages degrade
 * to `plaintext` (no failure, rendering-pipeline §2.9).
 */
export function resolveShikiLanguage(raw: string | undefined): ShikiLanguage {
  if (raw === undefined || raw === '') return 'plaintext'
  return LANGUAGE_ALIASES[raw.toLowerCase()] ?? 'plaintext'
}

/**
 * Copy-payload normalization (rendering-pipeline §2.9): logical newlines to
 * LF only. Indentation and the final newline are preserved byte-for-byte
 * otherwise; the payload is built from the literal code text, never from the
 * line-number gutter.
 */
export function normalizeCodeCopyPayload(literalText: string): string {
  return literalText.replace(/\r\n|\r/g, '\n')
}

/** Extracts the literal code text (line spans included, gutter excluded). */
export function extractCodeText(code: Element): string {
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
  for (const child of code.children) walk(child)
  return value
}

// ---------------------------------------------------------------------------
// Lazy highlighter
// ---------------------------------------------------------------------------

let highlighterPromise: Promise<HighlighterCore> | null = null

async function createHighlighter(): Promise<HighlighterCore> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
  ])
  return createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [import('shiki/themes/github-light.mjs')],
    langs: [
      import('shiki/langs/c.mjs'),
      import('shiki/langs/cpp.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/rust.mjs'),
      import('shiki/langs/java.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/sql.mjs'),
    ],
  })
}

/** Loads (once) the lazy fine-grained highlighter. */
export function loadShikiHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighter()
  return highlighterPromise
}

/** Test helper: drop the cached highlighter promise. */
export function resetShikiHighlighterForTests(): void {
  highlighterPromise = null
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface CodeTarget {
  pre: Element
  code: Element
  parent: { children: RootContent[] | ElementContent[] }
  language: ShikiLanguage
}

function classList(element: Element): readonly string[] {
  const value: unknown = element.properties.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/)
  return []
}

function collectTargets(tree: Root): CodeTarget[] {
  const targets: CodeTarget[] = []
  visit(tree, 'element', (element, index, parent) => {
    if (element.tagName !== 'pre' || !parent || index === undefined) return
    const code = element.children.find(
      (child): child is Element =>
        child.type === 'element' && child.tagName === 'code' && hasLanguageClass(child),
    )
    if (!code) return
    const languageClass = classList(code).find((name) => name.startsWith('language-'))
    if (languageClass === undefined) return
    // The math slot (resolved earlier) and the mermaid slot (later) own these.
    if (languageClass === 'language-math' || languageClass === 'language-mermaid') return
    targets.push({
      pre: element,
      code,
      parent: parent as { children: RootContent[] | ElementContent[] },
      language: resolveShikiLanguage(languageClass.slice('language-'.length)),
    })
  })
  return targets
}

function hasLanguageClass(element: Element): boolean {
  return classList(element).some((name) => name.startsWith('language-'))
}

/** Shiki emits non-canonical property names (`class`, `tabindex`). */
function normalizeProperties(properties: Properties): Properties {
  const next: Properties = {}
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'class') {
      next.className =
        typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : (value as string[])
    } else if (key === 'tabindex') {
      next.tabIndex = value as number | string
    } else {
      next[key] = value as Properties[string]
    }
  }
  return next
}

function normalizeTree(node: Root | ElementContent): void {
  if (node.type === 'element') {
    node.properties = normalizeProperties(node.properties)
    for (const child of node.children) normalizeTree(child)
  } else if (node.type === 'root') {
    for (const child of node.children) normalizeTree(child as ElementContent)
  }
}

function lineNumberGutter(literalText: string): Element | null {
  const body = literalText.endsWith('\n') ? literalText.slice(0, -1) : literalText
  if (body.length === 0) return null
  const count = body.split('\n').length
  const numbers = Array.from({ length: count }, (_, index) => String(index + 1)).join('\n')
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [CODE_LINES_CLASS], ariaHidden: 'true' },
    children: [{ type: 'text', value: numbers }],
  }
}

function buildCodeBlock(
  highlighted: Root,
  target: CodeTarget,
  literalText: string,
): Element | null {
  const pre = highlighted.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'pre',
  )
  if (!pre) return null
  // Shiki output is trusted and injected after sanitize; keep the original
  // source-mapping position so block/segment alignment still works (⑫).
  pre.position = target.pre.position
  const gutter = lineNumberGutter(literalText)
  const children: ElementContent[] = []
  if (gutter) children.push(gutter)
  children.push(pre)
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: [CODE_BLOCK_CLASS],
      dataLanguage: target.language,
    },
    children,
    position: target.pre.position,
  }
}

export const shikiEngine: PipelineEngine = {
  name: 'shiki',
  async transform(tree, context: EngineContext) {
    const targets = collectTargets(tree)
    if (targets.length === 0) return

    let highlighter: HighlighterCore
    try {
      highlighter = await loadShikiHighlighter()
    } catch {
      // Highlighter load failure degrades to plain text with one diagnostic;
      // the literal code (and its copy payload) stays complete (§4).
      context.addDiagnostic({
        code: 'PS_PARSE_LOCAL',
        category: 'parse',
        messageKey: 'error.parse.local',
        retryable: false,
        details: { engine: 'shiki' },
      })
      return
    }

    for (const target of targets) {
      const literalText = extractCodeText(target.code)
      try {
        const highlighted = await highlighter.codeToHast(literalText, {
          lang: target.language,
          theme: SHIKI_THEME,
        })
        normalizeTree(highlighted)
        const replacement = buildCodeBlock(highlighted, target, literalText)
        if (!replacement) continue
        const index = target.parent.children.indexOf(target.pre)
        if (index === -1) continue
        target.parent.children.splice(index, 1, replacement)
      } catch {
        // One failing block never blocks the others; the original plain code
        // is kept and a local diagnostic is recorded.
        context.addDiagnostic({
          code: 'PS_PARSE_LOCAL',
          category: 'parse',
          messageKey: 'error.parse.local',
          retryable: false,
          details: { engine: 'shiki' },
        })
      }
    }
  },
}
