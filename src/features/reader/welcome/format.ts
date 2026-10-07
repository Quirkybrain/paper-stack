import type { RecentEntry } from '../../../services/types'

/**
 * Welcome page formatting helpers (ui-spec §3.1): first-screen budget, relative
 * time and the shortest distinguishing parent directory. Kept pure so tests
 * stay deterministic (`now` is injectable).
 */

export const RECENT_FIRST_SCREEN = 6
export const RECENT_RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export interface RelativeTime {
  key: 'time.justNow' | 'time.minutesAgo' | 'time.hoursAgo' | 'time.daysAgo' | 'time.date'
  params?: Record<string, string | number>
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** Deterministic `YYYY-MM-DD` (no locale-dependent output). */
export function formatRecentDate(timestampMs: number): string {
  const date = new Date(timestampMs)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatRelativeTime(openedAtMs: number, nowMs: number = Date.now()): RelativeTime {
  const elapsed = Math.max(0, nowMs - openedAtMs)
  if (elapsed < 60_000) return { key: 'time.justNow' }
  if (elapsed < 3_600_000) return { key: 'time.minutesAgo', params: { count: Math.floor(elapsed / 60_000) } }
  if (elapsed < 86_400_000) return { key: 'time.hoursAgo', params: { count: Math.floor(elapsed / 3_600_000) } }
  if (elapsed < RECENT_RELATIVE_WINDOW_MS) {
    return { key: 'time.daysAgo', params: { count: Math.floor(elapsed / 86_400_000) } }
  }
  return { key: 'time.date', params: { date: formatRecentDate(openedAtMs) } }
}

function pathSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/** Last `depth` directory segments (the file name is not included). */
function parentCandidate(segments: readonly string[], depth: number): string {
  const end = segments.length - 1
  return segments.slice(Math.max(0, end - depth), end).join('/')
}

/**
 * Shortest distinguishing parent directory per entry: the immediate parent,
 * extended by one level while two entries with the same display name would
 * otherwise share the label. The file name itself is shown separately.
 */
export function shortestDistinguishingParents(
  entries: readonly Pick<RecentEntry, 'docId' | 'displayName' | 'canonicalPath'>[],
): Map<string, string> {
  const result = new Map<string, string>()
  const segmentsById = new Map(entries.map((entry) => [entry.docId, pathSegments(entry.canonicalPath)]))
  for (const entry of entries) {
    const own = segmentsById.get(entry.docId) ?? []
    const end = own.length - 1
    if (end <= 0) {
      result.set(entry.docId, '')
      continue
    }
    let label = parentCandidate(own, 1)
    for (let depth = 1; depth <= end; depth += 1) {
      const candidate = parentCandidate(own, depth)
      const unique = entries.every((other) => {
        if (other.docId === entry.docId) return true
        if (other.displayName !== entry.displayName) return true
        return parentCandidate(segmentsById.get(other.docId) ?? [], depth) !== candidate
      })
      label = candidate
      if (unique) break
    }
    result.set(entry.docId, label)
  }
  return result
}
