import { describe, expect, it } from 'vitest'

import {
  buildDiagnosticsSummary,
  isProtectedExportTarget,
  mergeDiagnosticEntry,
  type DiagnosticEntry,
} from './diagnostics-model'

/**
 * Diagnostics model (security-model §7; R28): repeated entries merge by
 * count; the default summary redacts source context and full paths; export
 * targets inside an open document's source tree are rejected.
 */

const entry = (overrides: Partial<DiagnosticEntry> = {}): DiagnosticEntry => ({
  id: 'e1',
  messageKey: 'error.parse.local',
  count: 1,
  firstSeenAtMs: 1,
  lastSeenAtMs: 1,
  ...overrides,
})

describe('diagnostics model', () => {
  it('merges repeated diagnostics and keeps the newest observation time', () => {
    let entries = mergeDiagnosticEntry([], { id: 'e1', messageKey: 'error.parse.local' }, 10)
    expect(entries).toHaveLength(1)
    entries = mergeDiagnosticEntry(entries, { id: 'e2', messageKey: 'error.parse.local' }, 20)
    expect(entries).toHaveLength(1)
    expect(entries[0].count).toBe(2)
    expect(entries[0].id).toBe('e1')
    expect(entries[0].lastSeenAtMs).toBe(20)

    entries = mergeDiagnosticEntry(entries, { id: 'e3', messageKey: 'error.parse.local' }, 30)
    expect(entries).toHaveLength(1)
    expect(entries[0].count).toBe(3)

    // A different stable code is a different diagnostic and must not merge.
    const split = mergeDiagnosticEntry(
      entries,
      { id: 'e4', messageKey: 'error.parse.local', code: 'PS_PARSE_LOCAL' },
      40,
    )
    expect(split).toHaveLength(2)
  })

  it('redacts source context and full paths by default and counts redactions', () => {
    const entries = [
      entry({
        code: 'PS_PARSE_LOCAL',
        category: 'parse',
        docVersion: 'v1',
        sourceRange: { startByte: 4, endByte: 12 },
        details: { engine: 'katex' },
        sourceContext: 'secret body text',
        paths: ['/home/user/private/doc.md'],
      }),
    ]
    const summary = buildDiagnosticsSummary(entries, { generatedAtMs: 42 })
    expect(summary.text).toContain('error.parse.local')
    expect(summary.text).toContain('(PS_PARSE_LOCAL)')
    expect(summary.text).toContain('engine: katex')
    expect(summary.text).not.toContain('secret body text')
    expect(summary.text).not.toContain('/home/user/private/doc.md')
    expect(summary.redactionCount).toBe(2)
  })

  it('includes opt-in context only when explicitly requested', () => {
    const entries = [entry({ sourceContext: 'context text', paths: ['/home/user/private/doc.md'] })]
    const summary = buildDiagnosticsSummary(entries, {
      includeSourceContext: true,
      includeFullPaths: true,
    })
    expect(summary.text).toContain('context text')
    expect(summary.text).toContain('/home/user/private/doc.md')
    expect(summary.redactionCount).toBe(0)
  })

  it('rejects export targets that touch the open document or its source directory', () => {
    const open = ['/docs/a.md', '/home/reader/b.md']
    expect(isProtectedExportTarget('/docs/a.md', open)).toBe(true)
    expect(isProtectedExportTarget('/docs/notes/diag.txt', open)).toBe(true)
    expect(isProtectedExportTarget('/home/reader/b.md', open)).toBe(true)
    expect(isProtectedExportTarget('/home/reader/other.txt', open)).toBe(true)
    expect(isProtectedExportTarget('/tmp/diag.txt', open)).toBe(false)
    expect(isProtectedExportTarget('/docs-other/diag.txt', open)).toBe(false)
  })
})
