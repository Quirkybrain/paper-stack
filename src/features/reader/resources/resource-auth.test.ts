import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourceAuthStore } from './resource-auth'

/**
 * Authorization aggregation oracle (T-57/T-58; models §8; INV-AZ-02/03/05/07).
 *
 * One prompt per directory scope (never per image), one remote prompt per
 * document session listing origins; a denial suppresses automatic
 * re-prompting and only an explicit user action re-opens the confirmation;
 * remote grants are session-scoped and revocation clears them.
 */

function localDecision(rootPath: string) {
  return { status: 'outside-root' as const, kind: 'local' as const, rootCandidate: rootPath }
}

function remoteDecision(origin: string) {
  return { status: 'remote-blocked' as const, kind: 'remote' as const, origin }
}

let store: ResourceAuthStore

beforeEach(() => {
  store = new ResourceAuthStore()
})

describe('ResourceAuthStore local aggregation', () => {
  it('aggregates out-of-root resources by directory scope, not per image', () => {
    store.noteLocalDecision('d-a', 'one.png', localDecision('/docs/shared'))
    store.noteLocalDecision('d-a', 'two.png', localDecision('/docs/shared'))
    const prompts = store.pendingPrompts()
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toMatchObject({ kind: 'local', docId: 'd-a', rootPath: '/docs/shared', resourceCount: 2 })
  })

  it('keeps one queued prompt per distinct directory scope', () => {
    store.noteLocalDecision('d-a', 'one.png', localDecision('/docs/shared'))
    store.noteLocalDecision('d-a', 'two.png', localDecision('/other'))
    expect(store.pendingPrompts()).toHaveLength(2)
    expect(store.getSnapshot()).toMatchObject({ rootPath: '/docs/shared' })
  })

  it('ignores decisions without a rootCandidate (no scope to confirm)', () => {
    store.noteLocalDecision('d-a', 'one.png', { status: 'outside-root', kind: 'local' })
    expect(store.pendingPrompts()).toEqual([])
    expect(store.getSnapshot()).toBeNull()
  })

  it('blocks a denied scope and only re-opens it on explicit user action', () => {
    store.noteLocalDecision('d-a', 'one.png', localDecision('/docs/shared'))
    store.noteLocalDecision('d-a', 'two.png', localDecision('/docs/shared'))
    const prompt = store.pendingPrompts()[0]
    store.blockPrompt(prompt.id)
    expect(store.getSnapshot()).toBeNull()

    // A later re-check does not re-prompt (no loop).
    store.noteLocalDecision('d-a', 'three.png', localDecision('/docs/shared'))
    expect(store.pendingPrompts()).toEqual([])

    // Explicit placeholder action re-opens it with the derived aggregate.
    store.openLocalPrompt('d-a', '/docs/shared')
    expect(store.getSnapshot()).toMatchObject({ kind: 'local', resourceCount: 3 })
  })

  it('resolves the head of the queue and advances to the next scope', () => {
    store.noteLocalDecision('d-a', 'one.png', localDecision('/docs/shared'))
    store.noteLocalDecision('d-a', 'two.png', localDecision('/other'))
    const [first] = store.pendingPrompts()
    store.resolvePrompt(first.id)
    expect(store.getSnapshot()).toMatchObject({ rootPath: '/other' })
    store.resolvePrompt(store.getSnapshot()?.id ?? '')
    expect(store.getSnapshot()).toBeNull()
  })

  it('notifies subscribers and keeps a stable snapshot between changes', () => {
    const listener = vi.fn()
    store.subscribe(listener)
    store.noteLocalDecision('d-a', 'one.png', localDecision('/docs/shared'))
    expect(listener).toHaveBeenCalledTimes(1)
    const snapshot = store.getSnapshot()
    expect(store.getSnapshot()).toBe(snapshot)
  })
})

describe('ResourceAuthStore remote session flows', () => {
  it('aggregates remote origins per document session without full URLs', () => {
    store.noteRemoteDecision('d-a', 'https://img.example.com/one.png', remoteDecision('https://img.example.com'))
    store.noteRemoteDecision('d-a', 'https://cdn.example.org/two.png', remoteDecision('https://cdn.example.org'))
    store.noteRemoteDecision('d-a', 'https://img.example.com/three.png', remoteDecision('https://img.example.com'))
    const prompts = store.pendingPrompts()
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toMatchObject({
      kind: 'remote',
      docId: 'd-a',
      origins: ['https://img.example.com', 'https://cdn.example.org'],
      resourceCount: 3,
    })
  })

  it('does not prompt for a granted origin and tracks session grants per document', () => {
    store.markRemoteGranted('d-a', ['https://img.example.com'])
    expect(store.hasRemoteGrant('d-a', 'https://img.example.com')).toBe(true)
    expect(store.hasRemoteGrant('d-a', 'https://other.example.com')).toBe(false)
    expect(store.hasRemoteGrant('d-b', 'https://img.example.com')).toBe(false)

    store.noteRemoteDecision('d-a', 'https://img.example.com/one.png', remoteDecision('https://img.example.com'))
    expect(store.pendingPrompts()).toEqual([])

    store.noteRemoteDecision('d-a', 'https://other.example.com/two.png', remoteDecision('https://other.example.com'))
    expect(store.pendingPrompts()).toHaveLength(1)
  })

  it('blocks a denied document session until an explicit action', () => {
    store.noteRemoteDecision('d-a', 'https://img.example.com/one.png', remoteDecision('https://img.example.com'))
    const [prompt] = store.pendingPrompts()
    store.blockPrompt(prompt.id)
    store.noteRemoteDecision('d-a', 'https://img.example.com/two.png', remoteDecision('https://img.example.com'))
    expect(store.pendingPrompts()).toEqual([])

    store.openRemotePrompt('d-a', 'https://img.example.com')
    expect(store.getSnapshot()).toMatchObject({
      kind: 'remote',
      origins: ['https://img.example.com'],
      resourceCount: 2,
    })
  })

  it('revocation clears the session grant so the next decision blocks again', () => {
    store.markRemoteGranted('d-a', ['https://img.example.com'])
    expect(store.grantedOrigins('d-a')).toEqual(['https://img.example.com'])
    store.revokeRemote('d-a')
    expect(store.hasRemoteGrant('d-a', 'https://img.example.com')).toBe(false)
    expect(store.grantedOrigins('d-a')).toEqual([])

    store.noteRemoteDecision('d-a', 'https://img.example.com/one.png', remoteDecision('https://img.example.com'))
    expect(store.pendingPrompts()).toHaveLength(1)
  })

  it('drops queued prompts when the document session ends without blocking it', () => {
    store.noteLocalDecision('d-a', 'one.png', localDecision('/shared'))
    store.noteRemoteDecision('d-b', 'https://img.example.com/one.png', remoteDecision('https://img.example.com'))
    expect(store.pendingPrompts()).toHaveLength(2)

    store.clearPromptsFor('d-a')
    expect(store.getSnapshot()).toMatchObject({ docId: 'd-b', kind: 'remote' })
    expect(store.pendingPrompts()).toHaveLength(1)

    // The scope is not blocked: a later decision may prompt again.
    store.noteLocalDecision('d-a', 'one.png', localDecision('/shared'))
    expect(store.pendingPrompts()).toHaveLength(2)
  })
})
