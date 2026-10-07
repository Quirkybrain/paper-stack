/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `dangerouslySetInnerHTML` single-entry guard (security-model §5.2:
 * “仅允许在消毒后受信引擎输出单一封装组件内出现；由质量审查静态检查”;
 * ADR-002; B-01).
 *
 * The scan covers every production file under `src/`, excludes tests, and
 * asserts that exactly one module carries the raw-injection prop: the
 * declared `document/SanitizedNode` wrapper. It also proves both engine
 * consumers route through the wrapper instead of injecting directly.
 */

const SRC_DIR = path.resolve(process.cwd(), 'src')
const SINGLE_ENTRY = 'src/document/SanitizedNode.tsx'
const TOKEN = 'dangerouslySetInnerHTML'
const CONSUMERS = [
  'src/features/reader/body/MermaidBlock.tsx',
  'src/features/reader/inspect/FormulaPanel.tsx',
]

function isProductionSource(name: string): boolean {
  return /\.(ts|tsx)$/.test(name) && !name.includes('.test.') && !name.includes('.spec.')
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectSourceFiles(full))
    else if (isProductionSource(entry.name)) files.push(full)
  }
  return files
}

function relativeRepoPath(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join('/')
}

describe('dangerouslySetInnerHTML single-entry guard (security-model §5.2)', () => {
  it('has exactly one production module with the raw-injection prop', () => {
    const hits = collectSourceFiles(SRC_DIR)
      .filter((file) => readFileSync(file, 'utf8').includes(TOKEN))
      .map(relativeRepoPath)
    expect(hits).toEqual([SINGLE_ENTRY])
  })

  it('routes Mermaid and formula preview through the wrapper, never directly', () => {
    for (const consumer of CONSUMERS) {
      const source = readFileSync(path.resolve(process.cwd(), consumer), 'utf8')
      expect(source, consumer).toContain('SanitizedNode')
      expect(source, consumer).not.toContain(TOKEN)
    }
  })
})
