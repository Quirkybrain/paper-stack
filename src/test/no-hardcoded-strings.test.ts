/// <reference types="node" />
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import zhCN from '../locales/zh-CN.json'

/**
 * Practical i18n guard (ADR-009 rules 3/5; ui-spec EDGE-12):
 * 1. `src/components/**` and `src/app/**` sources must not contain CJK
 *    natural-language literals; text lives in `src/locales/zh-CN.json` and is
 *    reached through `t()`.
 * 2. Every literal `t('...')` key used by those sources must exist in the
 *    baseline bundle (dynamic keys are out of reach of a static scan).
 * Test files are exempt: they assert translated output and may contain
 * fixtures. Comments are scanned too — keep source comments in English.
 */

const SRC_DIR = path.resolve(process.cwd(), 'src')
const SCAN_DIRS = ['components', 'app']

// CJK punctuation, kana, CJK ideographs, compatibility ideographs, fullwidth forms.
const CJK_PATTERN = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff60]/u
const T_CALL_PATTERN = /\bt\(\s*(['"])([^'"]+)\1/g

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

export function findCjkLiterals(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      CJK_PATTERN.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [],
    )
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
})
