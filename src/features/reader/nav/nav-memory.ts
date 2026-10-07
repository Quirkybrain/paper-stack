/**
 * Navigation panel memory and responsive layout (ui-spec §3.3, §4; T-41).
 *
 * The panel is unmounted whenever it is closed (temporarily by the inspect
 * drawer, permanently by the user), so expansion, scroll and width preferences
 * must live outside React: module-level stores keyed by authorized root
 * (file tree) and by document (outline). Memory is intentionally
 * non-persistent: it survives panel switches inside a session, not restarts.
 */

export const NAV_DEFAULT_WIDTH = 248

/** ui-spec §4: >=1180px side by side; 840–1179px overlay; <840 full width. */
export const NAV_SIDE_BY_SIDE_MIN = 1180
export const NAV_OVERLAY_MIN = 840

export type NavLayoutMode = 'side' | 'overlay' | 'full'

export function resolveNavLayout(widthPx: number): NavLayoutMode {
  if (!Number.isFinite(widthPx)) return 'side'
  if (widthPx >= NAV_SIDE_BY_SIDE_MIN) return 'side'
  if (widthPx >= NAV_OVERLAY_MIN) return 'overlay'
  return 'full'
}

export interface RootNavMemory {
  /** Panel width in px, remembered per authorized root (default 248). */
  width: number
  /** Expanded directory paths. */
  expanded: Set<string>
  /** File-tree scroll offset. */
  scrollTop: number
}

export interface DocNavMemory {
  /** Outline nodes the user expanded. */
  expanded: Set<string>
  /** True once the user collapsed/expanded something; before that the default
   * (all parents expanded) applies. */
  touched: boolean
  scrollTop: number
}

export class NavMemoryStore {
  #roots = new Map<string, RootNavMemory>()
  #docs = new Map<string, DocNavMemory>()

  root(rootId: string): RootNavMemory {
    let memory = this.#roots.get(rootId)
    if (!memory) {
      memory = { width: NAV_DEFAULT_WIDTH, expanded: new Set(), scrollTop: 0 }
      this.#roots.set(rootId, memory)
    }
    return memory
  }

  doc(docId: string): DocNavMemory {
    let memory = this.#docs.get(docId)
    if (!memory) {
      memory = { expanded: new Set(), touched: false, scrollTop: 0 }
      this.#docs.set(docId, memory)
    }
    return memory
  }

  reset(): void {
    this.#roots.clear()
    this.#docs.clear()
  }
}

export const navMemory = new NavMemoryStore()

// Module-level accessors: components get the mutable store only inside event
// handlers/effects (the React compiler treats render-captured objects as
// immutable, so writes go through these helpers instead).

export function rememberRootExpanded(rootId: string, expanded: ReadonlySet<string>): void {
  navMemory.root(rootId).expanded = new Set(expanded)
}

export function rememberRootScroll(rootId: string, scrollTop: number): void {
  navMemory.root(rootId).scrollTop = scrollTop
}

export function readRootScroll(rootId: string): number {
  return navMemory.root(rootId).scrollTop
}

export function readOutlineMemory(docId: string): { touched: boolean; expanded: ReadonlySet<string> } {
  const memory = navMemory.doc(docId)
  return { touched: memory.touched, expanded: memory.expanded }
}

export function rememberOutlineExpansion(docId: string, expanded: ReadonlySet<string>): void {
  const memory = navMemory.doc(docId)
  memory.touched = true
  memory.expanded = new Set(expanded)
}

export function readOutlineScroll(docId: string): number {
  return navMemory.doc(docId).scrollTop
}

export function rememberOutlineScroll(docId: string, scrollTop: number): void {
  navMemory.doc(docId).scrollTop = scrollTop
}
