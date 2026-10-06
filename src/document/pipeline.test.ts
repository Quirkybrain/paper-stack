import type { Element, Root, RootContent } from 'hast'
import { afterEach, describe, expect, it } from 'vitest'
import { visit } from 'unist-util-visit'

import { clearEngines, registerEngine } from './engines'
import { parseDocument, resolvePipelineOptions } from './pipeline'
import type { DocumentDiagnostic } from './types'

afterEach(() => {
  clearEngines()
})

function collectText(tree: Root): string {
  let text = ''
  visit(tree, 'text', (node) => {
    text += node.value
  })
  return text
}

function collectTags(tree: Root): string[] {
  const tags: string[] = []
  visit(tree, 'element', (node) => {
    tags.push(node.tagName)
  })
  return tags
}

function findElement(tree: Root, tagName: string): Element | undefined {
  let found: Element | undefined
  visit(tree, 'element', (node) => {
    if (!found && node.tagName === tagName) found = node
  })
  return found
}

function collectElements(tree: Root, tagName: string): Element[] {
  const found: Element[] = []
  visit(tree, 'element', (node) => {
    if (node.tagName === tagName) found.push(node)
  })
  return found
}

describe('resolvePipelineOptions', () => {
  it('defaults to technical mode with inline math enabled', () => {
    expect(resolvePipelineOptions()).toEqual({ mode: 'technical', inlineMath: true })
    expect(resolvePipelineOptions({ mode: 'standard' })).toEqual({
      mode: 'standard',
      inlineMath: true,
    })
  })
})

describe('sanitize stage (⑦)', () => {
  const adversarial = [
    '# Safe heading',
    '',
    "<script>alert('pwned')</script>",
    '',
    '<img src="https://example.com/x.png" alt="ok" onerror="alert(1)">',
    '',
    '<span style="color:red" onclick="alert(2)">styled</span>',
    '',
    '<iframe src="https://evil.example"></iframe>',
    '',
    '<a href="javascript:alert(3)">click</a>',
    '',
    '<div><style>body{display:none}</style>visible</div>',
    '',
    '<svg onload="alert(4)"><circle r="1" /></svg>',
    '',
    '<details open><summary>摘要</summary>正文</details>',
  ].join('\n')

  it('strips scripts, styles, iframes, event handlers, style and dangerous protocols', async () => {
    const result = await parseDocument(adversarial)
    expect(result.status).toBe('ok')
    expect(result.hast).not.toBeNull()
    const tree = result.hast as Root
    const tags = collectTags(tree)

    expect(tags).not.toContain('script')
    expect(tags).not.toContain('style')
    expect(tags).not.toContain('iframe')
    expect(tags).not.toContain('svg')
    expect(tags).toContain('details')
    expect(tags).toContain('summary')

    const text = collectText(tree)
    expect(text).toContain('Safe heading')
    expect(text).toContain('styled')
    expect(text).toContain('visible')
    expect(text).toContain('摘要')
    expect(text).toContain('正文')
    expect(text).not.toContain('pwned')
    expect(text).not.toContain('display:none')
    expect(text).not.toContain('alert(4)')

    const img = findElement(tree, 'img')
    expect(img?.properties.src).toBe('https://example.com/x.png')
    expect(img?.properties.alt).toBe('ok')
    expect(img?.properties.onerror).toBeUndefined()

    const span = findElement(tree, 'span')
    expect(span?.properties.style).toBeUndefined()
    expect(span?.properties.onclick).toBeUndefined()

    const link = findElement(tree, 'a')
    expect(link?.properties.href).toBeUndefined()
  })

  it('keeps details/summary open and allows http(s) hrefs', async () => {
    const result = await parseDocument(
      '<details open><summary>s</summary>b</details>\n\n[ok](https://example.com/x)',
    )
    const tree = result.hast as Root
    expect(findElement(tree, 'details')?.properties.open).toBe(true)
    expect(findElement(tree, 'a')?.properties.href).toBe('https://example.com/x')
  })

  it('forces task-list checkboxes disabled and read-only shaped', async () => {
    const result = await parseDocument('- [x] done\n- [ ] todo')
    const inputs = collectElements(result.hast as Root, 'input')
    expect(inputs).toHaveLength(2)
    for (const input of inputs) {
      expect(input.properties.type).toBe('checkbox')
      expect(input.properties.disabled).toBe(true)
    }
  })

  it('keeps generated heading anchor ids within the schema pattern', async () => {
    const result = await parseDocument('# 标题\n\n## 标题')
    const ids = collectElements(result.hast as Root, 'h1')
      .concat(collectElements(result.hast as Root, 'h2'))
      .map((element) => element.properties.id)
    for (const id of ids) expect(id).toMatch(/^ps-h-[a-z0-9-]{1,128}$/)
  })
})

describe('engine slots (⑧⑨⑩)', () => {
  interface Snapshot {
    hasScriptOrStyle: boolean
    hasEventOrStyleProperties: boolean
  }

  function inspect(tree: Root): Snapshot {
    let hasScriptOrStyle = false
    let hasEventOrStyleProperties = false
    visit(tree, 'element', (node) => {
      if (node.tagName === 'script' || node.tagName === 'style') hasScriptOrStyle = true
      for (const key of Object.keys(node.properties)) {
        if (key.startsWith('on') || key === 'style') hasEventOrStyleProperties = true
      }
    })
    return { hasScriptOrStyle, hasEventOrStyleProperties }
  }

  it('runs strictly after sanitize and in math → code → mermaid order', async () => {
    const calls: string[] = []
    const snapshots: Snapshot[] = []
    const probe = (name: string) => ({
      name,
      transform(tree: Root) {
        calls.push(name)
        snapshots.push(inspect(tree))
        return tree
      },
    })
    // Register code before math to prove the pipeline order is normative.
    registerEngine('code', probe('code'))
    registerEngine('mermaid', probe('mermaid'))
    registerEngine('math', probe('math'))

    const result = await parseDocument(
      '<script>alert(\'x\')</script>\n\n<span style="a:b">s</span>',
    )
    expect(result.status).toBe('ok')
    expect(calls).toEqual(['math', 'code', 'mermaid'])
    for (const snapshot of snapshots) {
      expect(snapshot).toEqual({ hasScriptOrStyle: false, hasEventOrStyleProperties: false })
    }
  })

  it('treats engine output as trusted and does not re-sanitize it', async () => {
    registerEngine('math', {
      name: 'probe-math',
      transform(tree: Root) {
        const output: Element = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['katex'], style: 'color:red' },
          children: [{ type: 'text', value: '引擎输出' }],
        }
        tree.children.push(output as RootContent)
        return tree
      },
    })

    const result = await parseDocument('body')
    const katex = (result.hast as Root).children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'span',
    )
    expect(katex?.properties.className).toEqual(['katex'])
    expect(katex?.properties.style).toBe('color:red')
    expect(result.diagnostics).toEqual([])
  })

  it('isolates a failing engine without blocking the others', async () => {
    const calls: string[] = []
    registerEngine('math', {
      name: 'boom',
      transform() {
        throw new Error('engine exploded: document text must not leak')
      },
    })
    registerEngine('code', {
      name: 'after',
      transform(tree: Root) {
        calls.push('after')
        return tree
      },
    })

    const result = await parseDocument('still readable')
    expect(result.status).toBe('ok')
    expect(calls).toEqual(['after'])
    expect(result.hast).not.toBeNull()
    expect(collectText(result.hast as Root)).toContain('still readable')
    const diagnostic = result.diagnostics.find((entry) => entry.code === 'PS_PARSE_LOCAL')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.details).toEqual({ engine: 'boom' })
    expect(JSON.stringify(result.diagnostics)).not.toContain('document text must not leak')
  })
})

describe('mode combinations', () => {
  const table = '| a | b |\n| - | - |\n| 1 | 2 |'

  it('technical mode enables the documented GFM subset', async () => {
    const result = await parseDocument(table, { mode: 'technical' })
    expect(collectTags(result.hast as Root)).toContain('table')
  })

  it('standard mode is CommonMark only', async () => {
    const result = await parseDocument(table, { mode: 'standard' })
    const tags = collectTags(result.hast as Root)
    expect(tags).not.toContain('table')
    expect(collectText(result.hast as Root)).toContain('| a | b |')
  })

  it('technical mode maps GFM footnotes with ps- prefixed ids', async () => {
    const result = await parseDocument('ref[^a]\n\n[^a]: note body')
    const tree = result.hast as Root
    const section = findElement(tree, 'section')
    expect(section?.properties.className).toEqual(['footnotes'])
    const item = collectElements(tree, 'li').find((element) => element.properties.id !== undefined)
    expect(String(item?.properties.id)).toMatch(/^ps-fn-[A-Za-z0-9-]+$/)
  })

  it('standard mode leaves footnote syntax as plain text', async () => {
    const result = await parseDocument('ref[^a]\n\n[^a]: note body', { mode: 'standard' })
    const tags = collectTags(result.hast as Root)
    expect(tags).not.toContain('section')
    expect(collectText(result.hast as Root)).toContain('[^a]')
  })
})

describe('pipeline product', () => {
  it('reports stats, outline, blocks and segments consistently', async () => {
    const text = '# Title\n\nBody 正文\n'
    const result = await parseDocument(text)
    expect(result.status).toBe('ok')
    expect(result.outline).toHaveLength(1)
    expect(result.blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph'])
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.stats).toEqual({
      charsUtf16: text.length,
      bytesUtf8: new TextEncoder().encode(text).length,
      blockCount: 2,
      segmentCount: result.segments.length,
      headingCount: 1,
    })
    expect(result.diagnostics).toEqual([])
  })

  it('stays structured-cloneable for the worker boundary', async () => {
    const result = await parseDocument('# Title\n\nBody')
    expect(() => structuredClone(result)).not.toThrow()
  })

  it('never includes link destinations or raw attribute text in segments', async () => {
    const result = await parseDocument('[label](https://hidden.example/path "tip")')
    const haystack = result.segments.map((segment) => segment.text).join('|')
    expect(haystack).toContain('label')
    expect(haystack).not.toContain('hidden.example')
    expect(haystack).not.toContain('tip')
  })

  it('reports defensive document failure as PS_PARSE_DOC', async () => {
    // An engine cannot fail the document (isolated above); a malformed input
    // type is the reachable defensive path.
    const result = await parseDocument(undefined as unknown as string)
    expect(result.status).toBe('failed')
    expect(result.hast).toBeNull()
    expect(result.diagnostics.map((diagnostic: DocumentDiagnostic) => diagnostic.code)).toContain(
      'PS_PARSE_DOC',
    )
  })
})
