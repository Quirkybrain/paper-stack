/// <reference types="node" />
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import zhCN from '../locales/zh-CN.json'

/**
 * Practical i18n guard (ADR-009 rules 3/5; ui-spec EDGE-12; B-09):
 * 1. All production sources under `src/{app,components,features,document,services}`
 *    must not contain CJK natural-language literals; text lives in
 *    `src/locales/zh-CN.json` and is reached through `t()`. Comments are
 *    stripped before scanning so CJK in explanatory comments does not
 *    false-positive, while strings (including type literals) are still seen.
 * 2. Every literal `t('...')` key used by those sources must exist in the
 *    baseline bundle (dynamic keys are out of reach of a static scan).
 * Test files, `src/locales/**`, `src/styles/**` and the root entry files are
 * outside the declared review-B scope.
 */

const SRC_DIR = path.resolve(process.cwd(), 'src')
const SCAN_DIRS = ['app', 'components', 'features', 'document', 'services']

// CJK punctuation, kana, CJK ideographs, compatibility ideographs, fullwidth forms.
const CJK_PATTERN = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff60]/u
const T_CALL_PATTERN = /\bt\(\s*(['"])([^'"]+)\1/g

/**
 * Compile-time literals that are not user-visible UI copy; the Review-B
 * scan already classified these as non-leaks (review-b §1.3).
 */
const NON_UI_LITERAL_ALLOWLIST = [
  // `AppInfo.name` TypeScript literal type (`services/types.ts`): never rendered.
  "name: '纸栈 PaperStack'",
]

function isSourceFile(name: string): boolean {
  return /\.(ts|tsx)$/.test(name) && !name.includes('.test.') && !name.includes('.spec.')
}

export function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectSourceFiles(full))
    else if (isSourceFile(entry.name)) files.push(full)
  }
  return files
}

/** Replaces comments with blanks while preserving line structure. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, ' ')
}

export function findCjkLiterals(file: string): string[] {
  return stripComments(readFileSync(file, 'utf8'))
    .split('\n')
    .flatMap((line, index) => {
      if (!CJK_PATTERN.test(line)) return []
      if (NON_UI_LITERAL_ALLOWLIST.some((allowed) => line.includes(allowed))) return []
      return [`${file}:${index + 1}: ${line.trim()}`]
    })
}

export function collectTranslationKeys(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const keys: string[] = []
  for (const match of source.matchAll(T_CALL_PATTERN)) keys.push(match[2])
  return keys
}

function scannedSourceFiles(): string[] {
  return SCAN_DIRS.flatMap((dir) => collectSourceFiles(path.join(SRC_DIR, dir)))
}

describe('i18n source guard', () => {
  it('has no CJK literals outside src/locales', () => {
    const violations = scannedSourceFiles().flatMap((file) => findCjkLiterals(file))
    expect(violations).toEqual([])
  })

  it('only references keys that exist in the zh-CN bundle', () => {
    const bundle = zhCN as Record<string, string>
    const missing = new Set<string>()
    for (const file of scannedSourceFiles()) {
      for (const key of collectTranslationKeys(file)) {
        if (!(key in bundle)) missing.add(`${key} (${path.relative(SRC_DIR, file)})`)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('detector flags a CJK literal in a sample source file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ps-i18n-guard-'))
    try {
      const sample = path.join(dir, 'sample.ts')
      writeFileSync(sample, "export const bad = '你好'\nexport const ok = 'hello'\n", 'utf8')
      const findings = findCjkLiterals(sample)
      expect(findings).toHaveLength(1)
      expect(findings[0]).toContain('sample.ts:1')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('detector ignores CJK that only appears in comments', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ps-i18n-guard-'))
    try {
      const sample = path.join(dir, 'sample.ts')
      writeFileSync(sample, '// 中文注释\n/* 另一段注释 */\nexport const ok = 1\n', 'utf8')
      expect(findCjkLiterals(sample)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
