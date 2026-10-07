import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Element, Root } from 'hast'

import { parseDocument } from '../pipeline'
import {
  MERMAID_BLOCK_CLASS,
  MERMAID_SOURCE_CLASS,
  detectMermaidType,
  extractMermaidSource,
  renderMermaidDiagram,
  type MermaidRenderer,
} from './mermaid'

/**
 * Mermaid placeholder slot ⑩ + the frozen render policy
 * (rendering-pipeline §2.10; R12). The real renderer is injected, so timeout,
 * node cap and error paths are deterministic.
 */

const SOURCE = 'flowchart LR\n  A[开始] --> B[结束]\n'

function elements(tree: Root | null): Element[] {
  const found: Element[] = []
  const walk = (node: Root['children'][number] | Element): void => {
    if (node.type !== 'element') return
    found.push(node)
    for (const child of node.children) walk(child)
  }
  for (const child of tree?.children ?? []) walk(child)
  return found
}

function withClass(tree: Root | null, name: string): Element[] {
  return elements(tree).filter((element) => {
    const value = element.properties.className
    const classes = Array.isArray(value) ? value.map(String) : []
    return classes.includes(name)
  })
}

function renderer(render: MermaidRenderer['render']): MermaidRenderer {
  return { version: 'mermaid@test', render }
}

describe('Mermaid placeholder engine (rendering-pipeline §2.10)', () => {
  it('replaces the fence with a placeholder carrying the source', async () => {
    const result = await parseDocument('```mermaid\n' + SOURCE + '```\n')
    expect(result.status).toBe('ok')
    const blocks = withClass(result.hast, MERMAID_BLOCK_CLASS)
    expect(blocks).toHaveLength(1)
    const sourceNode = withClass(result.hast, MERMAID_SOURCE_CLASS)
    expect(sourceNode).toHaveLength(1)
    expect(extractMermaidSource(blocks[0])).toBe(SOURCE)
    // No rendering happens in the pipeline; no diagnostic either.
    expect(result.diagnostics).toEqual([])
  })

  it('keeps the fence as a literal code block in standard mode', async () => {
    const result = await parseDocument('```mermaid\n' + SOURCE + '```\n', {
      mode: 'standard',
    })
    expect(withClass(result.hast, MERMAID_BLOCK_CLASS)).toHaveLength(0)
    expect(JSON.stringify(result.hast)).toContain('flowchart')
  })
})

describe('Mermaid render policy', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('detects the supported families and rejects others', () => {
    expect(detectMermaidType(SOURCE)).toBe('flowchart')
    expect(detectMermaidType('%% comment\nsequenceDiagram\n A->>B: hi')).toBe('sequenceDiagram')
    expect(detectMermaidType('classDiagram\n A <|-- B')).toBe('classDiagram')
    expect(detectMermaidType('stateDiagram-v2\n [*] --> A')).toBe('other')
    expect(detectMermaidType('not a diagram at all')).toBe('other')
  })

  it('returns SVG + version on success without touching security policy', async () => {
    const loadRenderer = vi.fn(async () => renderer(async () => ({ svg: '<svg><g/></svg>' })))
    const result = await renderMermaidDiagram(SOURCE, {
      loadRenderer,
      countSvgNodes: () => 2,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.svg).toContain('<svg')
      expect(result.version).toBe('mermaid@test')
    }
  })

  it('fails unsupported diagram families before loading the renderer', async () => {
    const loadRenderer = vi.fn(async () => renderer(async () => ({ svg: '<svg/>' })))
    const result = await renderMermaidDiagram('stateDiagram-v2\n [*] --> A', { loadRenderer })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failure.kind).toBe('unsupported')
    expect(loadRenderer).not.toHaveBeenCalled()
  })

  it('enforces the render timeout cap', async () => {
    vi.useFakeTimers()
    const resultPromise = renderMermaidDiagram(SOURCE, {
      loadRenderer: async () => renderer(() => new Promise(() => undefined)),
      timeoutMs: 5000,
    })
    await vi.advanceTimersByTimeAsync(5000)
    const result = await resultPromise
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('timeout')
      expect(result.failure.messageKey).toBe('mermaid.timeout')
    }
  })

  it('enforces the node cap', async () => {
    const result = await renderMermaidDiagram(SOURCE, {
      loadRenderer: async () => renderer(async () => ({ svg: '<svg>' + '<g/>'.repeat(10) + '</svg>' })),
      maxNodes: 3,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failure.kind).toBe('limit')
  })

  it('counts SVG nodes through an inert parse without live-DOM side effects (B-08)', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    const onloadSpy = vi.fn()
    const scope = window as unknown as { __psMermaidStubLoad?: () => void }
    scope.__psMermaidStubLoad = onloadSpy
    try {
      const svg =
        '<svg onload="window.__psMermaidStubLoad()">' +
        '<image href="https://example.com/never-loaded.png"/>' +
        '<g><rect/></g></svg>'
      const result = await renderMermaidDiagram(SOURCE, {
        loadRenderer: async () => renderer(async () => ({ svg })),
        maxNodes: 10,
      })
      expect(result.ok).toBe(true)
      // The default counter parses into an inert document: no live element is
      // created, no handler runs, no <image> reaches the page.
      expect(createElementSpy).not.toHaveBeenCalled()
      expect(onloadSpy).not.toHaveBeenCalled()
      expect(document.querySelector('image')).toBeNull()
    } finally {
      createElementSpy.mockRestore()
      delete scope.__psMermaidStubLoad
    }
  })

  it('reports load failures and syntax errors as local failures', async () => {
    const loadFailure = await renderMermaidDiagram(SOURCE, {
      loadRenderer: async () => {
        throw new Error('module unavailable')
      },
    })
    expect(loadFailure.ok).toBe(false)
    if (!loadFailure.ok) expect(loadFailure.failure.kind).toBe('load')

    const syntaxFailure = await renderMermaidDiagram(SOURCE, {
      loadRenderer: async () =>
        renderer(async () => {
          throw new Error('parse error')
        }),
    })
    expect(syntaxFailure.ok).toBe(false)
    if (!syntaxFailure.ok) expect(syntaxFailure.failure.kind).toBe('syntax')
  })
})
