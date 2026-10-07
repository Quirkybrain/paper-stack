import { describe, expect, it } from 'vitest'

import type { Element, Root } from 'hast'

import { parseDocument } from '../pipeline'

/**
 * Math engine slot ⑧ (rendering-pipeline §2.8/§4; R10) under the strict
 * §5.2 code-class schema (B-10). End-to-end through `parseDocument`, which is
 * the same code the Worker runs.
 */

function classList(element: Element): string[] {
  const value: unknown = element.properties.className
  if (Array.isArray(value)) return value.map(String)
  return typeof value === 'string' ? value.split(/\s+/) : []
}

function collect(node: unknown, found: Element[]): void {
  if (!node || typeof node !== 'object') return
  const current = node as { type?: unknown; children?: unknown }
  if (current.type === 'element') found.push(node as Element)
  if (Array.isArray(current.children)) {
    for (const child of current.children) collect(child, found)
  }
}

function elements(tree: Root | Element | null): Element[] {
  const found: Element[] = []
  collect(tree, found)
  return found
}

function textContent(element: Element): string {
  let text = ''
  const walk = (node: Element['children'][number]): void => {
    if (node.type === 'text') text += node.value
    else if (node.type === 'element') for (const child of node.children) walk(child)
  }
  for (const child of element.children) walk(child)
  return text
}

function withClass(tree: Root | null, name: string): Element[] {
  return elements(tree).filter((element) => classList(element).includes(name))
}

describe('KaTeX engine (rendering-pipeline §2.8)', () => {
  it('renders inline and display math in technical mode', async () => {
    const result = await parseDocument(
      '# T\n\ninline $x^2$ here\n\n$$\n\\int_0^1 x \\, dx\n$$\n',
    )
    expect(result.status).toBe('ok')
    expect(withClass(result.hast, 'katex').length).toBeGreaterThan(0)
    expect(withClass(result.hast, 'katex-display').length).toBe(1)
    expect(withClass(result.hast, 'math-error')).toHaveLength(0)
    expect(result.diagnostics).toEqual([])
    // The marker wrapper is replaced, never left for the code engine.
    const markers = withClass(result.hast, 'math-inline')
    expect(markers).toHaveLength(0)
  })

  it('isolates a bad formula without blocking the rest of the document', async () => {
    const result = await parseDocument('bad: $\\undefinedmacro{x}$\n\ngood: $a+b$\n')
    expect(result.status).toBe('ok')
    const errors = withClass(result.hast, 'math-error')
    expect(errors).toHaveLength(1)
    expect(textContent(errors[0])).toContain('\\undefinedmacro{x}')
    // The neighbouring formula still renders.
    expect(withClass(result.hast, 'katex').length).toBeGreaterThan(0)
    const diagnostic = result.diagnostics.find(
      (entry) => entry.details?.engine === 'katex',
    )
    expect(diagnostic?.code).toBe('PS_PARSE_LOCAL')
    expect(diagnostic?.retryable).toBe(false)
  })

  it('caps macro expansion and reports a local error instead of throwing', async () => {
    const result = await parseDocument('$\\def\\x{\\x\\x}\\x$')
    expect(result.status).toBe('ok')
    expect(withClass(result.hast, 'math-error')).toHaveLength(1)
    expect(result.diagnostics.some((entry) => entry.details?.engine === 'katex')).toBe(true)
  })

  it('never creates math nodes in code contexts', async () => {
    const result = await parseDocument('`$x$` inline code\n\n```\n$y$\n```\n')
    expect(withClass(result.hast, 'katex')).toHaveLength(0)
    expect(withClass(result.hast, 'math-error')).toHaveLength(0)
    expect(JSON.stringify(result.hast)).toContain('$y$')
  })

  it('keeps inline dollars literal with inlineMath:false but renders $$ blocks', async () => {
    const result = await parseDocument('$x$ stays\n\n$$\ny\n$$\n', { inlineMath: false })
    expect(JSON.stringify(result.hast)).toContain('$x$')
    expect(withClass(result.hast, 'katex-display').length).toBe(1)
  })

  it('disables all math in standard mode', async () => {
    const result = await parseDocument('$x$ and\n\n$$\ny\n$$\n', { mode: 'standard' })
    expect(withClass(result.hast, 'katex')).toHaveLength(0)
    expect(JSON.stringify(result.hast)).toContain('$$')
  })

  it('does not leak macros across documents', async () => {
    const first = await parseDocument('$\\newcommand{\\foo}{1}\\foo$')
    expect(withClass(first.hast, 'katex').length).toBeGreaterThan(0)
    const second = await parseDocument('$\\foo$')
    expect(withClass(second.hast, 'math-error')).toHaveLength(1)
  })

  it('keeps trust:false (no javascript href output)', async () => {
    const result = await parseDocument('$\\href{javascript:alert(1)}{x}$')
    const hrefs = elements(result.hast).flatMap((element) => {
      const href = element.properties.href
      return typeof href === 'string' ? [href] : []
    })
    expect(hrefs.filter((href) => href.startsWith('javascript:'))).toEqual([])
  })

  it('renders math under the strict §5.2 code-class schema (B-10: no D-3 delta)', async () => {
    const result = await parseDocument(
      '<code class="language-math evil">x</code>\n\n<span class="evil">t</span>\n\ninline $x^2$\n\n$$\ny\n$$\n',
    )
    // `evil` and the remark-math marker tokens are stripped; only the
    // `language-*` pattern survives, and `language-math` alone is enough for
    // this engine and `rehype-katex` to render both inline and display math.
    const classes = elements(result.hast).flatMap((element) => classList(element))
    expect(classes).not.toContain('evil')
    expect(classes).not.toContain('math-inline')
    expect(classes).not.toContain('math-display')
    expect(withClass(result.hast, 'katex').length).toBeGreaterThan(0)
    expect(withClass(result.hast, 'katex-display').length).toBe(1)
  })
})
