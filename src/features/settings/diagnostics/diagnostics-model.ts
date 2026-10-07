import type { ErrorCategory, SourceRange } from '../../../services/types'

/**
 * Diagnostics collection and export model (ui-spec §3.8 UI07; IXD §15.2–15.3;
 * security-model §7; R28).
 *
 * Entries carry only the contract's error surfaces (`messageKey`, code,
 * category, display version, byte range, sanitized `details`). Source context
 * and full paths are separate optional fields: the summary builder excludes
 * them by default and counts every exclusion, so "复制诊断摘要" is redacted
 * unless the user explicitly opts in inside a preview they can see.
 */

export interface DiagnosticEntryInput {
  /** Stable identity for deterministic tests; generated when omitted. */
  id?: string
  messageKey: string
  code?: string
  category?: ErrorCategory
  /** Displayed content hash of the document the error belongs to. */
  docVersion?: string
  sourceRange?: SourceRange
  details?: Record<string, string | number | boolean>
  /** Body/source excerpt; redacted unless `includeSourceContext` is set. */
  sourceContext?: string
  /** Absolute paths; redacted unless `includeFullPaths` is set. */
  paths?: string[]
  atMs?: number
}

export interface DiagnosticEntry extends DiagnosticEntryInput {
  id: string
  count: number
  firstSeenAtMs: number
  lastSeenAtMs: number
}

let generatedEntrySequence = 0

export function diagnosticDedupeKey(input: DiagnosticEntryInput): string {
  return [
    input.code ?? input.messageKey,
    input.messageKey,
    input.docVersion ?? '',
    input.sourceRange?.startByte ?? '',
  ].join('|')
}

export function createDiagnosticEntry(input: DiagnosticEntryInput, atMs: number): DiagnosticEntry {
  return {
    ...input,
    id: input.id ?? `diag-${++generatedEntrySequence}`,
    count: 1,
    firstSeenAtMs: atMs,
    lastSeenAtMs: atMs,
  }
}

/** Merges a repeated diagnostic (same code + document + range) by count. */
export function mergeDiagnosticEntry(
  entries: readonly DiagnosticEntry[],
  input: DiagnosticEntryInput,
  atMs: number,
): DiagnosticEntry[] {
  const key = diagnosticDedupeKey(input)
  const index = entries.findIndex((entry) => diagnosticDedupeKey(entry) === key)
  if (index === -1) return [...entries, createDiagnosticEntry(input, atMs)]
  const next = [...entries]
  const existing = next[index]
  next[index] = { ...existing, count: existing.count + 1, lastSeenAtMs: atMs }
  return next
}

export interface SummaryOptions {
  includeSourceContext?: boolean
  includeFullPaths?: boolean
  generatedAtMs?: number
}

export interface DiagnosticsSummary {
  text: string
  redactionCount: number
}

/**
 * Plain-text summary in stable ASCII labels (safe to paste anywhere).
 * Source context and paths are only emitted after explicit opt-in.
 */
export function buildDiagnosticsSummary(
  entries: readonly DiagnosticEntry[],
  options: SummaryOptions = {},
): DiagnosticsSummary {
  const includeSourceContext = options.includeSourceContext === true
  const includeFullPaths = options.includeFullPaths === true
  let redactionCount = 0
  const lines: string[] = ['paperstack-diagnostics v1']
  if (options.generatedAtMs !== undefined) {
    lines.push(`generatedAtMs: ${options.generatedAtMs}`)
  }
  entries.forEach((entry, index) => {
    lines.push(
      `[${index + 1}] ${entry.messageKey}${entry.code !== undefined ? ` (${entry.code})` : ''}`,
    )
    if (entry.category !== undefined) lines.push(`  category: ${entry.category}`)
    if (entry.docVersion !== undefined) lines.push(`  docVersion: ${entry.docVersion}`)
    if (entry.sourceRange !== undefined) {
      lines.push(`  sourceRange: ${entry.sourceRange.startByte}-${entry.sourceRange.endByte}`)
    }
    if (entry.count > 1) lines.push(`  count: ${entry.count}`)
    for (const [key, value] of Object.entries(entry.details ?? {})) {
      lines.push(`  ${key}: ${String(value)}`)
    }
    if (entry.sourceContext !== undefined) {
      if (includeSourceContext) lines.push(`  sourceContext: ${entry.sourceContext}`)
      else redactionCount += 1
    }
    for (const path of entry.paths ?? []) {
      if (includeFullPaths) lines.push(`  path: ${path}`)
      else redactionCount += 1
    }
  })
  return { text: lines.join('\n'), redactionCount }
}

/** Parent directory of a canonical POSIX path (no trailing slash). */
function parentDir(path: string): string {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash <= 0 ? '/' : path.slice(0, lastSlash)
}

/**
 * Component-level export validation (security-model §7 steps 2–3): a target
 * equal to an open source document or inside an open document's canonical
 * parent directory is protected and must be rejected before any write.
 */
export function isProtectedExportTarget(
  targetPath: string,
  openDocumentPaths: readonly string[],
): boolean {
  for (const openPath of openDocumentPaths) {
    if (targetPath === openPath) return true
    const directory = parentDir(openPath)
    if (targetPath === directory) return true
    if (directory === '/' ? targetPath.startsWith('/') : targetPath.startsWith(`${directory}/`)) {
      return true
    }
  }
  return false
}
