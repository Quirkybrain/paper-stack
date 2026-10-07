import { describe, expect, it } from 'vitest'

import { ResourceInvalidationStore } from './resource-invalidation'

/**
 * Resource-only invalidation oracle (contract §7.6; INV-VC-07; T-55).
 */

describe('resource invalidation store', () => {
  it('bumps exactly the registered raw src of a matching canonical path', () => {
    const store = new ResourceInvalidationStore()
    store.register('d-a', 'pic.png', '/docs/pic.png')
    store.register('d-a', 'other.png', '/docs/other.png')
    const before = {
      pic: store.revisionFor('d-a', 'pic.png'),
      other: store.revisionFor('d-a', 'other.png'),
    }
    store.bump('d-a', '/docs/pic.png')
    expect(store.revisionFor('d-a', 'pic.png')).toBeGreaterThan(before.pic)
    expect(store.revisionFor('d-a', 'other.png')).toBe(before.other)
  })

  it('does not touch another document', () => {
    const store = new ResourceInvalidationStore()
    store.register('d-a', 'pic.png', '/docs/pic.png')
    store.register('d-b', 'pic.png', '/docs/pic.png')
    const bBefore = store.revisionFor('d-b', 'pic.png')
    store.bump('d-a', '/docs/pic.png')
    expect(store.revisionFor('d-b', 'pic.png')).toBe(bBefore)
  })

  it('falls back to the document scope for unmatched paths (placeholders)', () => {
    const store = new ResourceInvalidationStore()
    store.register('d-a', 'pic.png', '/docs/pic.png')
    const bBefore = store.revisionFor('d-b', 'pic.png')
    store.bump('d-a', '/docs/appeared-later.png')
    const docRevision = store.revisionFor('d-a', 'pic.png')
    expect(docRevision).toBeGreaterThan(0)
    // Every raw src of the document observes the fallback revision.
    expect(store.revisionFor('d-a', 'unregistered.png')).toBe(docRevision)
    expect(store.revisionFor('d-b', 'pic.png')).toBe(bBefore)
  })

  it('notifies subscribers once per bump and unsubscribes cleanly', () => {
    const store = new ResourceInvalidationStore()
    let notifications = 0
    const unsubscribe = store.subscribe(() => {
      notifications += 1
    })
    store.bump('d-a', '/docs/pic.png')
    store.bump('d-a', '/docs/pic.png')
    expect(notifications).toBe(2)
    unsubscribe()
    store.bump('d-a', '/docs/pic.png')
    expect(notifications).toBe(2)
  })

  it('is stable until a bump changes the revision (getSnapshot discipline)', () => {
    const store = new ResourceInvalidationStore()
    store.register('d-a', 'pic.png', '/docs/pic.png')
    const revision = store.revisionFor('d-a', 'pic.png')
    expect(store.revisionFor('d-a', 'pic.png')).toBe(revision)
    store.bump('d-a', '/docs/pic.png')
    expect(store.revisionFor('d-a', 'pic.png')).not.toBe(revision)
  })
})
