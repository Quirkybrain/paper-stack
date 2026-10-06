import { describe, expect, it } from 'vitest'

import type { Element, Root } from 'hast'

import { parseDocument } from '../pipeline'
import {
  CODE_BLOCK_CLASS,
  CODE_LINES_CLASS,
  extractCodeText,
  normalizeCodeCopyPayload,
  resolveShikiLanguage,
} from './shiki'

/**
 * Code engine slot ⑨ (rendering-pipeline §2.9; R11): language set,
 * unknown-language degradation, line-number gutter and copy-payload
 * normalization.
 */

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

function classList(element: Element): string[] {
  const value: unknown = element.properties.className
  if (Array.isArray(value)) return value.map(String)
  return typeof value === 'string' ? value.split(/\s+/) : []
}

function withClass(tree: Root | null, name: string): Element[] {
  return elements(tree).filter((element) => classList(element).includes(name))
}

const RUST_FENCE = '```rust\nlet x = 1;\nlet y = 2;\n```\n'

describe('Shiki engine (rendering-pipeline §2.9)', () => {
  it('resolves the documented language set and aliases; unknown → plaintext', () => {
    expect(resolveShikiLanguage('rust')).toBe('rust')
    expect(resolveShikiLanguage('c++')).toBe('cpp')
    expect(resolveShikiLanguage('JS')).toBe('javascript')
    expect(resolveShikiLanguage('ts')).toBe('typescript')
    expect(resolveShikiLanguage('yml')).toBe('yaml')
    expect(resolveShikiLanguage('sh')).toBe('bash')
    expect(resolveShikiLanguage('brainfuck')).toBe('plaintext')
    expect(resolveShikiLanguage(undefined)).toBe('plaintext')
  })

  it('normalizes copy payloads to LF, preserving indentation and final newline', () => {
    expect(normalizeCodeCopyPayload('a\r\n  b\r\n')).toBe('a\n  b\n')
    expect(normalizeCodeCopyPayload('a\rb')).toBe('a\nb')
    expect(normalizeCodeCopyPayload('  indented\n')).toBe('  indented\n')
    expect(normalizeCodeCopyPayload('no-final-newline')).toBe('no-final-newline')
  })

  it('highlights a known language and keeps literal text exact', async () => {
    const result = await parseDocument(RUST_FENCE)
    expect(result.status).toBe('ok')
    const blocks = withClass(result.hast, CODE_BLOCK_CLASS)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].properties.dataLanguage).toBe('rust')
    const pre = elements(blocks[0]).find(
      (element) => element.tagName === 'pre' && classList(element).includes('shiki'),
    )
    expect(pre).toBeDefined()
    const code = elements(blocks[0]).find((element) => element.tagName === 'code')
    expect(code).toBeDefined()
    expect(extractCodeText(code as Element)).toBe('let x = 1;\nlet y = 2;\n')
    expect(result.diagnostics).toEqual([])
  })

  it('generates an aria-hidden line-number gutter outside the code text', async () => {
    const result = await parseDocument(RUST_FENCE)
    const gutters = withClass(result.hast, CODE_LINES_CLASS)
    expect(gutters).toHaveLength(1)
    expect(gutters[0].properties.ariaHidden).toBe('true')
    let gutterText = ''
    for (const child of gutters[0].children) {
      if (child.type === 'text') gutterText += child.value
    }
    expect(gutterText).toBe('1\n2')
    // Copy payload from the literal text never includes the gutter.
    const code = withClass(result.hast, CODE_BLOCK_CLASS)
      .flatMap((block) => elements(block))
      .find((element) => element.tagName === 'code') as Element
    expect(extractCodeText(code)).not.toContain('1\n2\nlet')
  })

  it('degrades unknown languages to plain text without a diagnostic', async () => {
    const result = await parseDocument('```not-a-real-language\nplain body\n```\n')
    const blocks = withClass(result.hast, CODE_BLOCK_CLASS)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].properties.dataLanguage).toBe('plaintext')
    expect(result.diagnostics).toEqual([])
  })

  it('leaves mermaid fences to the mermaid slot', async () => {
    const result = await parseDocument('```mermaid\nflowchart LR\n  A-->B\n```\n')
    expect(withClass(result.hast, CODE_BLOCK_CLASS)).toHaveLength(0)
    expect(withClass(result.hast, 'mermaid-block')).toHaveLength(1)
  })

  it('does not touch indented code blocks without a language', async () => {
    const result = await parseDocument('    indented code $keep$\n')
    expect(withClass(result.hast, CODE_BLOCK_CLASS)).toHaveLength(0)
    expect(JSON.stringify(result.hast)).toContain('indented code')
  })
})
