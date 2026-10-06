import type { Element, ElementContent, Root, RootContent } from 'hast'
import { visit } from 'unist-util-visit'

import type { EngineContext, PipelineEngine } from '../engines'

/**
 * Mermaid placeholder slot ⑩ (rendering-pipeline §2.10; R12).
 *
 * The pipeline never renders diagrams: it replaces `pre > code.language-mermaid`
 * with a placeholder node carrying the source. The React `MermaidBlock`
 * (features/reader) renders it later, only when visible and after the mermaid
 * module is dynamically imported. This module stays worker-safe (no DOM/React
 * imports) and exports the frozen render policy + an injectable render helper
 * so the timeout/node caps are testable without the real renderer.
 *
 * Security posture (security-model §5.2): `securityLevel:'strict'` and
 * `htmlLabels:false` are code constants; document text can never lower them.
 * Failures degrade to a localized local error with a source view and are
 * never retried automatically.
 */

export const MERMAID_BLOCK_CLASS = 'mermaid-block'
export const MERMAID_SOURCE_CLASS = 'mermaid-source'

/** Frozen Mermaid security configuration (security-model §5.2; R12). */
export const MERMAID_SECURITY_LEVEL = 'strict' as const
export const MERMAID_HTML_LABELS = false as const

/** Initial caps (calibratable; contracts §5 `PS_LIMIT_MERMAID`). */
export const MERMAID_RENDER_TIMEOUT_MS = 5000
export const MERMAID_MAX_NODES = 5000
export const MERMAID_MAX_SOURCE_CHARS = 100_000

/** Diagram families supported in v0.1.0 (rendering-pipeline §2.10). */
export const MERMAID_SUPPORTED_TYPES = ['flowchart', 'graph', 'sequenceDiagram', 'classDiagram'] as const

export type MermaidDiagramType = (typeof MERMAID_SUPPORTED_TYPES)[number] | 'other'

const MERMAID_TYPE_PATTERN =
  /^\s*(?:%%[^\n]*\n\s*)*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|requirementDiagram|C4\w*|zenuml|info|treemap)/

/** First diagram keyword of the source, or `other` when unrecognized. */
export function detectMermaidType(source: string): MermaidDiagramType {
  const keyword = MERMAID_TYPE_PATTERN.exec(source)?.[1]
  if (keyword === undefined) return 'other'
  return (MERMAID_SUPPORTED_TYPES as readonly string[]).includes(keyword)
    ? (keyword as MermaidDiagramType)
    : 'other'
}

export type MermaidErrorKind = 'load' | 'syntax' | 'unsupported' | 'limit' | 'timeout'

export interface MermaidRenderFailure {
  kind: MermaidErrorKind
  messageKey: string
  /** Diagram keyword when known (shown in the localized error block). */
  diagramType?: string
  /** Short engine-side summary; never includes the full document source. */
  summary?: string
}

export interface MermaidRenderer {
  version: string
  render(id: string, source: string): Promise<{ svg: string }>
}

export interface MermaidRenderDeps {
  loadRenderer: () => Promise<MermaidRenderer>
  timeoutMs?: number
  maxNodes?: number
  maxSourceChars?: number
  /** Counts SVG elements; injected in tests (DOM parser in the real path). */
  countSvgNodes?: (svg: string) => number
}

export type MermaidRenderResult =
  | { ok: true; svg: string; version: string }
  | { ok: false; failure: MermaidRenderFailure }

let renderSequence = 0

export function nextMermaidRenderId(): string {
  renderSequence += 1
  return `ps-mermaid-${renderSequence}`
}

function countSvgNodesInDom(svg: string): number {
  if (typeof document === 'undefined') return 0
  const container = document.createElement('div')
  container.innerHTML = svg
  return container.querySelectorAll('*').length
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const handle = setTimeout(() => resolve('timeout'), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(handle)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(handle)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/**
 * Render one diagram under the frozen caps. The renderer itself is injected;
 * production wiring loads `mermaid` dynamically in the feature layer.
 */
export async function renderMermaidDiagram(
  source: string,
  deps: MermaidRenderDeps,
): Promise<MermaidRenderResult> {
  const timeoutMs = deps.timeoutMs ?? MERMAID_RENDER_TIMEOUT_MS
  const maxNodes = deps.maxNodes ?? MERMAID_MAX_NODES
  const maxSourceChars = deps.maxSourceChars ?? MERMAID_MAX_SOURCE_CHARS
  const diagramType = detectMermaidType(source)

  if (source.length > maxSourceChars) {
    return {
      ok: false,
      failure: {
        kind: 'limit',
        messageKey: 'error.limit.mermaid',
        diagramType: diagramType === 'other' ? undefined : diagramType,
      },
    }
  }
  if (diagramType === 'other') {
    return { ok: false, failure: { kind: 'unsupported', messageKey: 'mermaid.unsupported' } }
  }

  let renderer: MermaidRenderer
  try {
    renderer = await deps.loadRenderer()
  } catch {
    return { ok: false, failure: { kind: 'load', messageKey: 'mermaid.error.title' } }
  }

  const id = nextMermaidRenderId()
  const renderPromise = renderer.render(id, source)
  // The losing branch must never surface as an unhandled rejection.
  renderPromise.catch(() => undefined)

  try {
    const outcome = await withTimeout(renderPromise, timeoutMs)
    if (outcome === 'timeout') {
      return {
        ok: false,
        failure: { kind: 'timeout', messageKey: 'mermaid.timeout', diagramType },
      }
    }
    const countNodes = deps.countSvgNodes ?? countSvgNodesInDom
    if (countNodes(outcome.svg) > maxNodes) {
      return {
        ok: false,
        failure: { kind: 'limit', messageKey: 'error.limit.mermaid', diagramType },
      }
    }
    return { ok: true, svg: outcome.svg, version: renderer.version }
  } catch (error) {
    // Engine errors are summarized without echoing the document source.
    const name = error instanceof Error ? error.name : 'Error'
    return {
      ok: false,
      failure: { kind: 'syntax', messageKey: 'mermaid.error.title', diagramType, summary: name },
    }
  }
}

// ---------------------------------------------------------------------------
// Pipeline placeholder engine
// ---------------------------------------------------------------------------

function classList(element: Element): readonly string[] {
  const value: unknown = element.properties.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/)
  return []
}

function extractText(node: RootContent | ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(extractText).join('')
  return ''
}

interface MermaidTarget {
  pre: Element
  code: Element
  parent: { children: RootContent[] | ElementContent[] }
}

function collectTargets(tree: Root): MermaidTarget[] {
  const targets: MermaidTarget[] = []
  visit(tree, 'element', (element, index, parent) => {
    if (element.tagName !== 'pre' || !parent || index === undefined) return
    const code = element.children.find(
      (child): child is Element =>
        child.type === 'element' &&
        child.tagName === 'code' &&
        classList(child).includes('language-mermaid'),
    )
    if (!code) return
    targets.push({
      pre: element,
      code,
      parent: parent as { children: RootContent[] | ElementContent[] },
    })
  })
  return targets
}

export function createMermaidPlaceholder(pre: Element, source: string): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: [MERMAID_BLOCK_CLASS] },
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: { className: [MERMAID_SOURCE_CLASS] },
        children: [{ type: 'text', value: source }],
      },
    ],
    position: pre.position,
  }
}

/** Reads the diagram source back out of a placeholder node (React layer). */
export function extractMermaidSource(node: Element): string {
  const pre = node.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'pre',
  )
  return pre ? extractText(pre) : ''
}

export const mermaidEngine: PipelineEngine = {
  name: 'mermaid',
  transform(tree, context: EngineContext) {
    // Standard mode keeps diagrams as literal code blocks (mode table §1):
    // the placeholder step only runs in technical mode.
    if (context.options.mode !== 'technical') return
    const targets = collectTargets(tree)
    for (const target of targets) {
      const index = target.parent.children.indexOf(target.pre)
      if (index === -1) continue
      target.parent.children.splice(index, 1, createMermaidPlaceholder(target.pre, extractText(target.code)))
    }
  },
}
