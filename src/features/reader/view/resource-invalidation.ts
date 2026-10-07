/**
 * Resource-only invalidation (contract §7.6; models §2.2(e)/§3.2 W5;
 * INV-VC-07; IXD §10.3).
 *
 * `watch-changed {kind:"resource"}` means one already-authorized resource (for
 * example an image) changed on disk. The frontend must re-resolve exactly
 * that resource so the Rust-generated `?v=` observation key changes and the
 * WebView cache is bypassed; it must NOT change `displayVersion`, produce a
 * document update banner or rebuild the document.
 *
 * The store maps a watch `resourcePath` back to the raw `src` references that
 * registered it through `check_resource_access` (which returns the canonical
 * path for local files). When no registration matches — for example the
 * resource was a missing placeholder when the event arrived — the document's
 * fallback revision bumps so every resource of that document re-checks; the
 * scope stays per document, never global.
 */

export type ResourceListener = () => void

export class ResourceInvalidationStore {
  #counter = 0
  #docRevision = new Map<string, number>()
  #resourceRevision = new Map<string, number>()
  #canonical = new Map<string, Map<string, string>>()
  #listeners = new Set<ResourceListener>()

  /** Registers the canonical path of a resolved resource (allowed local files). */
  register(docId: string, rawSrc: string, canonicalPath?: string): void {
    if (canonicalPath === undefined) return
    const bySrc = this.#canonical.get(docId) ?? new Map<string, string>()
    if (bySrc.get(rawSrc) === canonicalPath) return
    bySrc.set(rawSrc, canonicalPath)
    this.#canonical.set(docId, bySrc)
  }

  /**
   * Applies one `kind=resource` event. Matching canonical paths bump only
   * their own raw `src` entries; an unmatched path bumps the document so
   * placeholders can re-resolve when the file appears.
   */
  bump(docId: string, resourcePath?: string): void {
    const bySrc = this.#canonical.get(docId)
    let matched = false
    if (bySrc !== undefined && resourcePath !== undefined && resourcePath !== '') {
      for (const [rawSrc, canonicalPath] of bySrc) {
        if (canonicalPath === resourcePath) {
          this.#counter += 1
          this.#resourceRevision.set(this.#key(docId, rawSrc), this.#counter)
          matched = true
        }
      }
    }
    if (!matched) {
      this.#counter += 1
      this.#docRevision.set(docId, this.#counter)
    }
    this.#emit()
  }

  /**
   * Monotonic revision for one raw `src`; changes exactly when that resource
   * (or its document fallback) was invalidated.
   */
  revisionFor(docId: string, rawSrc: string): number {
    const doc = this.#docRevision.get(docId) ?? 0
    const resource = this.#resourceRevision.get(this.#key(docId, rawSrc)) ?? 0
    return Math.max(doc, resource)
  }

  subscribe(listener: ResourceListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) listener()
  }

  #key(docId: string, rawSrc: string): string {
    return `${docId}\u0000${rawSrc}`
  }

  /** Test helper: drops every registration and revision. */
  reset(): void {
    this.#counter = 0
    this.#docRevision.clear()
    this.#resourceRevision.clear()
    this.#canonical.clear()
    this.#listeners.clear()
  }
}

/** Module-level store shared by the reader controller and ImageBlock. */
export const resourceInvalidation = new ResourceInvalidationStore()
