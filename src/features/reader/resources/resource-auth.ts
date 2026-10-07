import type { AccessDecision } from '../../../services/types'

/**
 * Resource authorization aggregation (T-57/T-58; models §8; security-model
 * §3/§4; ui-spec §3.6/§3.8/IX10).
 *
 * `check_resource_access` never rejects: every blocked decision (outside-root
 * or remote-blocked) is reported here. The store aggregates per directory
 * scope (local) or per document session (remote) and exposes one queued
 * prompt at a time through `getSnapshot` / `subscribe`:
 *
 * - one prompt per directory scope, never one per image (INV-AZ-02);
 * - a denial/block suppresses automatic re-prompting for that scope; only an
 *   explicit user action (`openLocalPrompt`/`openRemotePrompt`) re-opens it
 *   (INV-AZ-05; models §8.1 Blocked → Prompted);
 * - remote grants are tracked per document session only; revocation clears
 *   them so the next decision blocks again (INV-AZ-03/07/09).
 *
 * The store performs no IPC and holds no path as a credential: the host
 * (`ResourceAuthDialogs`) routes decisions to `grant_local_root` /
 * `grant_remote_session`, whose results — computed by the Rust registry — are
 * the only source of authorization (INV-AZ-04).
 */

export interface LocalResourcePrompt {
  id: string
  kind: 'local'
  docId: string
  /** Canonical, normalized directory scope from Rust `rootCandidate`. */
  rootPath: string
  /** Distinct out-of-root resources aggregated for this scope. */
  resourceCount: number
}

export interface RemoteResourcePrompt {
  id: string
  kind: 'remote'
  docId: string
  /** Origins only (`https://host[:port]`), first-seen order, no paths/tokens. */
  origins: string[]
  /** Distinct blocked remote resources aggregated for this document session. */
  resourceCount: number
}

export type ResourcePrompt = LocalResourcePrompt | RemoteResourcePrompt

interface KnownResource {
  kind: 'local' | 'remote'
  rootPath?: string
  origin?: string
}

const KEY_SEPARATOR = '\u0000'

export class ResourceAuthStore {
  #listeners = new Set<() => void>()
  #prompts: ResourcePrompt[] = []
  #snapshot: ResourcePrompt | null = null
  #sequence = 0
  /** Scope keys `docId\0rootPath` blocked by a denial. */
  #blockedLocal = new Set<string>()
  /** Document sessions blocked by a denial. */
  #blockedRemote = new Set<string>()
  /** Session-scoped remote grants: docId → granted origins. */
  #remoteGrants = new Map<string, string[]>()
  /** Known remote origins per document (display order for the dialog). */
  #remoteOrigins = new Map<string, string[]>()
  /** Known resources per document for aggregation counts. */
  #known = new Map<string, Map<string, KnownResource>>()

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Queue head; stable reference until the queue actually changes. */
  getSnapshot = (): ResourcePrompt | null => this.#snapshot

  /** Test/read-only view of the whole queue (never a credential). */
  pendingPrompts(): ResourcePrompt[] {
    return [...this.#prompts]
  }

  /**
   * Feeds one local decision. Only `outside-root` decisions with a
   * `rootCandidate` can aggregate; anything else is ignored.
   */
  noteLocalDecision(docId: string, rawSrc: string, decision: AccessDecision): void {
    if (decision.status !== 'outside-root') return
    const rootPath = decision.rootCandidate
    if (rootPath === undefined || rootPath === '') return
    this.#remember(docId, rawSrc, { kind: 'local', rootPath })
    if (this.#blockedLocal.has(this.#localKey(docId, rootPath))) return
    const count = this.#localCount(docId, rootPath)
    const pending = this.#findLocal(docId, rootPath)
    if (pending !== undefined) {
      this.#replace(pending.id, { ...pending, resourceCount: count })
      return
    }
    this.#enqueue({ kind: 'local', docId, rootPath, resourceCount: count })
  }

  /**
   * Feeds one remote decision. A decision whose origin already has a session
   * grant does not prompt (the host is fetching it instead).
   */
  noteRemoteDecision(docId: string, rawSrc: string, decision: AccessDecision): void {
    if (decision.status !== 'remote-blocked') return
    const origin = decision.origin
    if (origin === undefined || origin === '') return
    this.#remember(docId, rawSrc, { kind: 'remote', origin })
    this.#addOrigin(docId, origin)
    if (this.hasRemoteGrant(docId, origin)) return
    if (this.#blockedRemote.has(docId)) return
    const pending = this.#findRemote(docId)
    if (pending !== undefined) {
      this.#replace(pending.id, {
        ...pending,
        origins: this.#originsFor(docId),
        resourceCount: this.#remoteCount(docId),
      })
      return
    }
    this.#enqueue({
      kind: 'remote',
      docId,
      origins: this.#originsFor(docId),
      resourceCount: this.#remoteCount(docId),
    })
  }

  /**
   * Explicit user action on a local placeholder: clears the block mark and
   * (re-)opens the aggregation prompt for this scope. This is the only path
   * that re-prompts after a denial (INV-AZ-05).
   */
  openLocalPrompt(docId: string, rootPath: string): void {
    this.#blockedLocal.delete(this.#localKey(docId, rootPath))
    const resourceCount = Math.max(1, this.#localCount(docId, rootPath))
    this.#prompts = this.#prompts.filter(
      (prompt) => !(prompt.kind === 'local' && prompt.docId === docId && prompt.rootPath === rootPath),
    )
    this.#sequence += 1
    this.#prompts.unshift({
      id: `rp-${this.#sequence}`,
      kind: 'local',
      docId,
      rootPath,
      resourceCount,
    })
    this.#emit()
  }

  /** Explicit user action on a remote placeholder (INV-AZ-05). */
  openRemotePrompt(docId: string, origin?: string): void {
    this.#blockedRemote.delete(docId)
    if (origin !== undefined && origin !== '') this.#addOrigin(docId, origin)
    const origins = this.#originsFor(docId)
    const resourceCount = Math.max(1, this.#remoteCount(docId))
    this.#prompts = this.#prompts.filter(
      (prompt) => !(prompt.kind === 'remote' && prompt.docId === docId),
    )
    this.#sequence += 1
    this.#prompts.unshift({
      id: `rp-${this.#sequence}`,
      kind: 'remote',
      docId,
      origins,
      resourceCount,
    })
    this.#emit()
  }

  /** Removes a resolved prompt (grant confirmed or command failed). */
  resolvePrompt(id: string): void {
    this.#remove(id)
  }

  /**
   * Denial / grant failure: the prompt is dropped and the scope is marked so
   * no automatic decision re-opens it; placeholders stay readable.
   */
  blockPrompt(id: string): void {
    const prompt = this.#prompts.find((candidate) => candidate.id === id)
    if (prompt === undefined) return
    this.#prompts = this.#prompts.filter((candidate) => candidate.id !== id)
    if (prompt.kind === 'local') {
      this.#blockedLocal.add(this.#localKey(prompt.docId, prompt.rootPath))
    } else {
      this.#blockedRemote.add(prompt.docId)
    }
    this.#emit()
  }

  /** Grant succeeded (Rust registry is authoritative); clears the block mark. */
  markLocalGranted(docId: string, rootPath: string): void {
    this.#blockedLocal.delete(this.#localKey(docId, rootPath))
  }

  /** Records a session-scoped remote grant for the current document session. */
  markRemoteGranted(docId: string, origins: readonly string[]): void {
    for (const origin of origins) this.#addOrigin(docId, origin)
    this.#remoteGrants.set(docId, this.#originsFor(docId))
    this.#blockedRemote.delete(docId)
  }

  hasRemoteGrant(docId: string, origin: string): boolean {
    return this.#remoteGrants.get(docId)?.includes(origin) ?? false
  }

  grantedOrigins(docId: string): string[] {
    return [...(this.#remoteGrants.get(docId) ?? [])]
  }

  /**
   * Revocation / leaving the document session (INV-AZ-07/09): the grants are
   * cleared immediately; a granted origin from a previous session is never
   * reused, so the next check blocks again.
   */
  revokeRemote(docId: string): void {
    this.#remoteGrants.delete(docId)
  }

  /**
   * Drops queued prompts for a document whose session ended (tab closed or
   * replaced): no dialog may outlive the document it asks about. The denial
   * marks stay, so a reopened document does not re-prompt by itself.
   */
  clearPromptsFor(docId: string): void {
    const remaining = this.#prompts.filter((prompt) => prompt.docId !== docId)
    if (remaining.length === this.#prompts.length) return
    this.#prompts = remaining
    this.#emit()
  }

  /** Test helper: drops every mark, grant, prompt and listener. */
  reset(): void {
    this.#listeners.clear()
    this.#prompts = []
    this.#snapshot = null
    this.#sequence = 0
    this.#blockedLocal.clear()
    this.#blockedRemote.clear()
    this.#remoteGrants.clear()
    this.#remoteOrigins.clear()
    this.#known.clear()
  }

  // -------------------------------------------------------------------------

  #localKey(docId: string, rootPath: string): string {
    return `${docId}${KEY_SEPARATOR}${rootPath}`
  }

  #remember(docId: string, rawSrc: string, resource: KnownResource): void {
    const bySrc = this.#known.get(docId) ?? new Map<string, KnownResource>()
    bySrc.set(rawSrc, resource)
    this.#known.set(docId, bySrc)
  }

  #localCount(docId: string, rootPath: string): number {
    const bySrc = this.#known.get(docId)
    if (bySrc === undefined) return 0
    let count = 0
    for (const resource of bySrc.values()) {
      if (resource.kind === 'local' && resource.rootPath === rootPath) count += 1
    }
    return count
  }

  #remoteCount(docId: string): number {
    const bySrc = this.#known.get(docId)
    if (bySrc === undefined) return 0
    let count = 0
    for (const resource of bySrc.values()) {
      if (resource.kind === 'remote') count += 1
    }
    return count
  }

  #addOrigin(docId: string, origin: string): void {
    const origins = this.#remoteOrigins.get(docId) ?? []
    if (!origins.includes(origin)) {
      origins.push(origin)
      this.#remoteOrigins.set(docId, origins)
    }
  }

  #originsFor(docId: string): string[] {
    return [...(this.#remoteOrigins.get(docId) ?? [])]
  }

  #findLocal(docId: string, rootPath: string): LocalResourcePrompt | undefined {
    return this.#prompts.find(
      (prompt): prompt is LocalResourcePrompt =>
        prompt.kind === 'local' && prompt.docId === docId && prompt.rootPath === rootPath,
    )
  }

  #findRemote(docId: string): RemoteResourcePrompt | undefined {
    return this.#prompts.find(
      (prompt): prompt is RemoteResourcePrompt =>
        prompt.kind === 'remote' && prompt.docId === docId,
    )
  }

  #enqueue(prompt: Omit<LocalResourcePrompt, 'id'> | Omit<RemoteResourcePrompt, 'id'>): void {
    this.#sequence += 1
    this.#prompts.push({ ...prompt, id: `rp-${this.#sequence}` } as ResourcePrompt)
    this.#emit()
  }

  #replace(id: string, next: ResourcePrompt): void {
    // Rebuild the array and the prompt object so `getSnapshot` identity
    // changes and subscribed hosts re-render with the new aggregate.
    this.#prompts = this.#prompts.map((prompt) =>
      prompt.id === id ? ({ ...next, id } as ResourcePrompt) : prompt,
    )
    this.#emit()
  }

  #remove(id: string): void {
    const remaining = this.#prompts.filter((prompt) => prompt.id !== id)
    if (remaining.length === this.#prompts.length) return
    this.#prompts = remaining
    this.#emit()
  }

  #emit(): void {
    this.#snapshot = this.#prompts[0] ?? null
    for (const listener of [...this.#listeners]) listener()
  }
}

/** Module-level store shared by ImageBlock, the host dialogs and the reader. */
export const resourceAuth = new ResourceAuthStore()
