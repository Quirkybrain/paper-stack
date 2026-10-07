/**
 * Frontend half of the persistent write-back suppression gate
 * (models §9.1/§9.3; R27/AT27).
 *
 * The Rust storage layer owns the authoritative gate: after
 * `clear_records(confirm=true)` for `recents | positions | session`, writes
 * for those categories return `SaveResult{saved:false}` (no error, no row)
 * until `resume_recording(category)` or an explicit document open
 * (`entry != restore`) lifts it (models §9.1). This module mirrors that gate
 * in front of the frontend's own write calls so a cleared category cannot be
 * rebuilt from the webview (INV-WB-02) and so tests can observe the behavior
 * without a live Rust backend.
 *
 * Independently of this gate, `rememberRecords=false` blocks writes on the
 * Rust side (INV-WB-04); this module never touches that preference.
 */

export type SuppressibleCategory = 'recents' | 'positions' | 'session'

export const SUPPRESSIBLE_CATEGORIES: readonly SuppressibleCategory[] = [
  'recents',
  'positions',
  'session',
]

const suppressed = new Set<SuppressibleCategory>()

/** Suppresses write-back for the categories that were actually cleared. */
export function suppressWriteBack(categories: readonly SuppressibleCategory[]): void {
  for (const category of categories) suppressed.add(category)
}

/** True while a cleared category must not be written back (models §9.1). */
export function isWriteBackSuppressed(category: SuppressibleCategory): boolean {
  return suppressed.has(category)
}

/** Lifts suppression for `categories` or for every category when omitted. */
export function resumeSuppressedWrites(categories?: readonly SuppressibleCategory[]): void {
  if (categories === undefined) {
    suppressed.clear()
    return
  }
  for (const category of categories) suppressed.delete(category)
}

/** Test helper: restores the initial writable state. */
export function resetWriteSuppression(): void {
  suppressed.clear()
}
