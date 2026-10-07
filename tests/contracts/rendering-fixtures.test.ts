import { readdirSync, readFileSync } from 'node:fs'

import type { Element, Root, RootContent } from 'hast'
import { describe, expect, it } from 'vitest'

import { parseDocument } from '../../src/document/pipeline'
import { utf16RangeToUtf8Bytes } from '../../src/document/source-map'

/**
 * Fixed rendering/security fixtures through the real parse pipeline (T-59;
 * rendering-pipeline §7; NF11).
 *
 * The assertions are derived from the fixture contracts, not from current
 * output: parsing is deterministic, source ranges slice the original text
 * exactly in both unit systems, and the malicious fixture must come out with
 * no executable/privileged nodes. React-level behavior (fold, mermaid
 * rendering, image placeholders) stays in the component suites.
 */

// Vitest runs from the project root (see tests/contracts/README.md).
const repoRoot = process.cwd()

const RENDERING_DIR = `${repoRoot}/fixtures/rendering`
const FORBIDDEN_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'style',
  'link',
  'meta',
  'base',
  'form',
  'video',
  'audio',
  'source',
])
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * Spec-derived content needles: each fixed sample must expose its
 * representative searchable text in the pipeline segments (rendering-pipeline
 * §2.4c coverage: readable text, code, inline code, image alt, formula source,
 * visible raw-HTML text). Assertions name content from the fixtures, not
 * output.
 */
const SEMANTIC_NEEDLES: Record<string, string[]> = {
  'mixed-cn-en.md': ['中文', 'English', 'x_{i+1}'],
  'math.md': ['x^2 + y^2 = z^2', '\\undefinedmacro{x}'],
  'code.md': ['int main(void)', '!! not a real language !!', 'line 45'],
  'tables.md': ['github-light', '行内代码'],
  'mermaid.md': ['flowchart LR', 'sequenceDiagram', 'classDiagram', 'pie title Shares'],
  'images.md': ['missing diagram alt', 'traversal attempt alt', 'linked image alt'],
  'links.md': ['Duplicate 标题', 'Dangerous javascript: link', 'autolink'],
  'edge-cases.md': ['tab indented', '受控子集 summary', 'Final line without a trailing newline follows'],
  'source-map.md': ['中文', '🚀🎉', 'x_{i+1}', '数据 slice'],
}

function renderingFixtures(): { name: string; path: string; text: string }[] {
  return readdirSync(RENDERING_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => ({
      name,
      path: `${RENDERING_DIR}/${name}`,
      text: readFileSync(`${RENDERING_DIR}/${name}`, 'utf8'),
    }))
}

function walkElements(node: Root | RootContent, visit: (element: Element) => void): void {
  if (node.type === 'element') visit(node)
  if ('children' in node) {
    for (const child of node.children) walkElements(child, visit)
  }
}

describe('rendering fixtures parse deterministically with intact source ranges', () => {
  const fixtures = renderingFixtures()

  it('covers the eight classes plus the source-map sample (≥9 files)', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(9)
    const names = fixtures.map((fixture) => fixture.name)
    for (const expected of [
      'mixed-cn-en.md',
      'math.md',
      'code.md',
      'tables.md',
      'mermaid.md',
      'images.md',
      'links.md',
      'edge-cases.md',
      'source-map.md',
    ]) {
      expect(names, expected).toContain(expected)
    }
  })

  for (const fixture of fixtures) {
    it(`${fixture.name}: parses, ranges slice, second parse is identical`, async () => {
      const first = await parseDocument(fixture.text, { mode: 'technical' })
      const second = await parseDocument(fixture.text, { mode: 'technical' })

      expect(first.status).toBe('ok')
      expect(first.hast).not.toBeNull()
      expect(first.stats.blockCount).toBeGreaterThan(0)
      expect(first.segments.length).toBeGreaterThan(0)

      // Determinism (NF11): same bytes -> same blocks/segments/outline/stats.
      expect(second.blocks).toEqual(first.blocks)
      expect(second.segments).toEqual(first.segments)
      expect(second.outline).toEqual(first.outline)
      expect(second.stats).toEqual(first.stats)

      // Source map contract: UTF-16 ranges are in bounds and slice exactly;
      // the byte range is the converted twin of the same range.
      for (const block of first.blocks) {
        expect(block.sourceRange.startUtf16, block.blockId).toBeGreaterThanOrEqual(0)
        expect(block.sourceRange.endUtf16, block.blockId).toBeLessThanOrEqual(
          fixture.text.length,
        )
        expect(block.sourceRange.startUtf16, block.blockId).toBeLessThan(
          block.sourceRange.endUtf16,
        )
        expect(block.sourceRangeBytes, block.blockId).toEqual(
          utf16RangeToUtf8Bytes(fixture.text, block.sourceRange),
        )
        expect(
          block.fingerprint,
          block.blockId,
        ).toMatch(/^fp1:[0-9a-f]{16}$/)
      }
      const segIds = first.segments.map((segment) => segment.segId)
      expect(new Set(segIds).size).toBe(segIds.length)
      for (const segment of first.segments) {
        // Ranges bound the source extent of the segment; for syntax-bearing
        // kinds (inline code, math, image alt, code) `text` is the searchable
        // content without delimiters, so it is not required to equal the raw
        // slice. Ranges must stay in bounds and be non-degenerate.
        expect(segment.startUtf16, segment.segId).toBeGreaterThanOrEqual(0)
        expect(segment.startUtf16, segment.segId).toBeLessThan(segment.endUtf16)
        expect(segment.endUtf16, segment.segId).toBeLessThanOrEqual(fixture.text.length)
        expect(segment.text.length, segment.segId).toBeGreaterThan(0)
      }

      // Spec-derived coverage: the sample's representative searchable content
      // must be present across the segments (rendering-pipeline §2.4c).
      const searchable = first.segments.map((segment) => segment.text).join('\n')
      for (const needle of SEMANTIC_NEEDLES[fixture.name] ?? []) {
        expect(searchable, `${fixture.name}: missing ${JSON.stringify(needle)}`).toContain(
          needle,
        )
      }

      // Outline anchors stay unique and prefixed by the frozen scheme.
      const anchors = first.outline.map((entry) => entry.anchorId)
      expect(new Set(anchors).size).toBe(anchors.length)
      for (const anchor of anchors) expect(anchor.startsWith('ps-h-')).toBe(true)
    })
  }

  it('math.md isolates the unknown macro with a local PS_PARSE_LOCAL diagnostic', async () => {
    const fixture = fixtures.find((candidate) => candidate.name === 'math.md')
    expect(fixture).toBeDefined()
    const result = await parseDocument(fixture!.text, { mode: 'technical' })
    expect(result.diagnostics.map((entry) => entry.code)).toContain('PS_PARSE_LOCAL')
    const mathErrors: Element[] = []
    walkElements(result.hast!, (element) => {
      if (
        element.properties.className !== undefined &&
        (element.properties.className as string[]).includes('math-error')
      ) {
        mathErrors.push(element)
      }
    })
    expect(mathErrors.length).toBeGreaterThanOrEqual(1)
  })

  it('edge-cases.md keeps the allowed details/summary subset and read-only checkboxes', async () => {
    const fixture = fixtures.find((candidate) => candidate.name === 'edge-cases.md')
    const result = await parseDocument(fixture!.text, { mode: 'technical' })
    const tags: string[] = []
    const checkboxes: Element[] = []
    walkElements(result.hast!, (element) => {
      tags.push(element.tagName)
      if (element.tagName === 'input' && element.properties.type === 'checkbox') {
        checkboxes.push(element)
      }
    })
    expect(tags).toContain('details')
    expect(tags).toContain('summary')
    expect(checkboxes.length).toBe(2)
    for (const checkbox of checkboxes) {
      expect(checkbox.properties.disabled).toBe(true)
    }
  })
})

describe('malicious fixture is sanitized without executing or reading outside', () => {
  const path = `${repoRoot}/fixtures/security/malicious.md`
  const text = readFileSync(path, 'utf8')

  it('produces no forbidden tags, event handlers, style or dangerous schemes', async () => {
    const result = await parseDocument(text, { mode: 'technical' })
    expect(result.status).toBe('ok')

    const problems: string[] = []
    walkElements(result.hast!, (element) => {
      if (FORBIDDEN_TAGS.has(element.tagName)) {
        problems.push(`forbidden tag <${element.tagName}>`)
      }
      for (const [name, value] of Object.entries(element.properties)) {
        if (name.toLowerCase().startsWith('on')) {
          problems.push(`event handler ${name} on <${element.tagName}>`)
        }
        if (name === 'style') {
          problems.push(`style attribute on <${element.tagName}>`)
        }
        if (
          (name === 'href' || name === 'src') &&
          typeof value === 'string' &&
          DANGEROUS_SCHEMES.some((scheme) =>
            value.trim().toLowerCase().startsWith(scheme),
          )
        ) {
          problems.push(`${name}=${value} on <${element.tagName}>`)
        }
      }
    })
    expect(problems).toEqual([])
  })

  it('contains no script/iframe element in serialized output and keeps other text readable', async () => {
    const result = await parseDocument(text, { mode: 'technical' })
    const serialized = JSON.stringify(result.hast)
    // Inline-code text may legitimately *mention* "<script>", but no element
    // of that name may exist (checked above); the serialized tree must not
    // contain an element with that tag name.
    expect(serialized.includes('"tagName":"script"')).toBe(false)
    expect(serialized.includes('"tagName":"iframe"')).toBe(false)
    // The macro bomb must stay local: one PS_PARSE_LOCAL diagnostic and a
    // readable placeholder, never a failed document.
    expect(result.diagnostics.map((entry) => entry.code)).toContain('PS_PARSE_LOCAL')
    expect(result.status).toBe('ok')
  })

  it('does not read traversal targets and leaves task checkboxes disabled', async () => {
    const result = await parseDocument(text, { mode: 'technical' })
    let checkbox: Element | undefined
    const altTexts: string[] = []
    walkElements(result.hast!, (element) => {
      if (element.tagName === 'input') checkbox = element
      if (element.tagName === 'img' && typeof element.properties.alt === 'string') {
        altTexts.push(element.properties.alt)
      }
    })
    expect(checkbox?.properties.disabled).toBe(true)
    // Path traversal stays a literal source string, never a resolved read.
    expect(altTexts.join('\n')).toContain('path traversal image')
  })
})
