import { describe, expect, it, vi } from 'vitest'

import type {
  DirectoryRoot,
  ErrorPayload,
  OpenEntry,
  OpenOutcome,
  OpenRequest,
} from '../../../services/types'
import {
  drainPendingOpenRequests,
  entryForOpenRequest,
  openFromDirectoryDialog,
  openFromDrop,
  openFromFileDialog,
  openFromRequest,
  planOpenBatch,
  type OpenEntryHandlers,
  type OpenEntryServices,
} from './entry'

/**
 * Entry matrix (T-56; contracts §2.1(4,35); ui-spec §3.1/§3.2).
 *
 * All four entries are adapters over the same `open_documents`/batch pipeline:
 * dialog/drop/CLI/system produce equivalent open state, cancellation changes
 * nothing, non-document/invalid paths arrive as per-item rejections (never as
 * commands of their own), duplicates reuse the canonical-path tab and the
 * first accepted item in request order receives focus.
 */

function identityFor(path: string) {
  const displayName = path.split('/').pop() ?? 'doc.md'
  const docId = `d-${displayName}`
  return {
    docId,
    canonicalPath: path,
    displayName,
    format: 'markdown' as const,
    encoding: 'utf-8' as const,
    contentHash: 'v1',
    sizeBytes: 128,
    lastSeenAtMs: 1,
  }
}

function opened(path: string): OpenOutcome {
  const identity = identityFor(path)
  return { path, status: 'opened', docId: identity.docId, identity }
}

function rejected(path: string, error: ErrorPayload): OpenOutcome {
  return { path, status: 'rejected', error }
}

const FORMAT_ERROR: ErrorPayload = {
  code: 'PS_FMT_UNSUPPORTED',
  category: 'io',
  messageKey: 'error.encoding.formatUnsupported',
  retryable: false,
}

function fakeServices(overrides: Partial<OpenEntryServices> = {}): OpenEntryServices {
  return {
    pickFiles: vi.fn(async () => ({ cancelled: true, paths: [] })),
    pickDirectory: vi.fn(async () => ({ cancelled: true, paths: [] })),
    openDocuments: vi.fn(async () => ({ items: [] })),
    openDirectory: vi.fn(async (): Promise<DirectoryRoot> => ({
      rootId: 'root-1',
      canonicalPath: '/root',
      displayName: 'root',
      scope: 'session',
    })),
    takePendingOpenRequests: vi.fn(async () => []),
    ...overrides,
  }
}

function fakeHandlers(batches: Array<{ paths: string[]; entry: OpenEntry }> = []): OpenEntryHandlers {
  return {
    openPaths: vi.fn(async (paths, entry) => {
      batches.push({ paths: [...paths], entry })
    }),
    setDirectory: vi.fn(),
    reportError: vi.fn(),
  }
}

describe('entry adapters (T-56)', () => {
  it('routes file-dialog paths through open_documents with entry="dialog"', async () => {
    const services = fakeServices({
      pickFiles: vi.fn(async () => ({ cancelled: false, paths: ['/docs/a.md', '/docs/b.md'] })),
    })
    const handlers = fakeHandlers()
    const opened = await openFromFileDialog(services, handlers)
    expect(opened).toBe(true)
    expect(handlers.openPaths).toHaveBeenCalledWith(['/docs/a.md', '/docs/b.md'], 'dialog')
  })

  it('changes nothing when the file picker is cancelled or returns no paths', async () => {
    const handlers = fakeHandlers()
    await openFromFileDialog(fakeServices(), handlers)
    expect(handlers.openPaths).not.toHaveBeenCalled()

    const empty = fakeServices({ pickFiles: vi.fn(async () => ({ cancelled: false, paths: [] })) })
    await openFromFileDialog(empty, handlers)
    expect(handlers.openPaths).not.toHaveBeenCalled()
  })

  it('opens a directory with session scope and reports command failures', async () => {
    const services = fakeServices({
      pickDirectory: vi.fn(async () => ({ cancelled: false, paths: ['/root'] })),
    })
    const handlers = fakeHandlers()
    const root = await openFromDirectoryDialog(services, handlers)
    expect(services.openDirectory).toHaveBeenCalledWith({ path: '/root', persist: false })
    expect(handlers.setDirectory).toHaveBeenCalledWith(root)

    const cancelled = fakeHandlers()
    await openFromDirectoryDialog(fakeServices(), cancelled)
    expect(cancelled.setDirectory).not.toHaveBeenCalled()

    const failure = fakeServices({
      pickDirectory: vi.fn(async () => ({ cancelled: false, paths: ['/root'] })),
      openDirectory: vi.fn(async () => {
        throw FORMAT_ERROR
      }),
    })
    const failed = fakeHandlers()
    await openFromDirectoryDialog(failure, failed)
    expect(failed.reportError).toHaveBeenCalledWith(FORMAT_ERROR)
    expect(failed.setDirectory).not.toHaveBeenCalled()
  })

  it('treats drag-drop paths as one validated batch and ignores empty payloads', async () => {
    const handlers = fakeHandlers()
    await openFromDrop(handlers, ['/docs/a.md', '/bin/tool'])
    expect(handlers.openPaths).toHaveBeenCalledTimes(1)
    expect(handlers.openPaths).toHaveBeenCalledWith(['/docs/a.md', '/bin/tool'], 'drop')

    await openFromDrop(handlers, [])
    expect(handlers.openPaths).toHaveBeenCalledTimes(1)
  })

  it('maps CLI and second-instance requests to their entries, in queue order', async () => {
    expect(entryForOpenRequest({ paths: [], cwd: null, source: 'cli' })).toBe('cli')
    expect(entryForOpenRequest({ paths: [], cwd: null, source: 'second-instance' })).toBe('system')

    const first: OpenRequest = { paths: ['/docs/a.md', '/docs/b.md'], cwd: '/docs', source: 'cli' }
    const second: OpenRequest = { paths: ['/docs/c.md'], cwd: null, source: 'second-instance' }
    const services = fakeServices({ takePendingOpenRequests: vi.fn(async () => [first, second]) })
    const batches: Array<{ paths: string[]; entry: OpenEntry }> = []
    await drainPendingOpenRequests(services, fakeHandlers(batches))
    expect(batches).toEqual([
      { paths: ['/docs/a.md', '/docs/b.md'], entry: 'cli' },
      { paths: ['/docs/c.md'], entry: 'system' },
    ])
  })

  it('reports a failed pending-queue drain and tolerates a malformed payload', async () => {
    const handlers = fakeHandlers()
    const failing = fakeServices({
      takePendingOpenRequests: vi.fn(async () => {
        throw FORMAT_ERROR
      }),
    })
    await drainPendingOpenRequests(failing, handlers)
    expect(handlers.reportError).toHaveBeenCalledWith(FORMAT_ERROR)

    const malformed = fakeServices({
      takePendingOpenRequests: vi.fn(async () => undefined as unknown as OpenRequest[]),
    })
    const tolerant = fakeHandlers()
    await expect(drainPendingOpenRequests(malformed, tolerant)).resolves.toBeUndefined()
  })

  it('produces equivalent open state from all four entries', async () => {
    const paths = ['/docs/a.md', '/docs/b.md']
    const outcomes = paths.map(opened)
    const expected = projectBatch(outcomes)

    const results: ReturnType<typeof projectBatch>[] = []
    for (const kind of ['dialog', 'drop', 'cli', 'system'] as const) {
      const batches: Array<{ paths: string[]; entry: OpenEntry }> = []
      const handlers = fakeHandlers(batches)
      if (kind === 'dialog') {
        const services = fakeServices({
          pickFiles: vi.fn(async () => ({ cancelled: false, paths })),
        })
        await openFromFileDialog(services, handlers)
      } else if (kind === 'drop') {
        await openFromDrop(handlers, paths)
      } else {
        await openFromRequest(handlers, { paths, cwd: null, source: kind === 'cli' ? 'cli' : 'second-instance' })
      }
      expect(batches).toEqual([{ paths, entry: kind }])
      results.push(projectBatch(outcomes))
    }
    expect(results).toEqual([expected, expected, expected, expected])
    expect(expected).toEqual({ tabs: ['d-a.md', 'd-b.md'], active: 'd-a.md' })
  })

  it('rejects non-document and unauthorized paths inside the batch, not as commands', () => {
    const plan = planOpenBatch([
      opened('/docs/a.md'),
      rejected('/bin/tool', FORMAT_ERROR),
      rejected('/secret/x.md', {
        code: 'PS_AUTH_OUTSIDE_ROOT',
        category: 'auth',
        messageKey: 'error.auth.outsideRoot',
        retryable: false,
      }),
    ])
    expect(plan.items.map((item) => item.docId)).toEqual(['d-a.md'])
    expect(plan.failures.map((failure) => failure.path)).toEqual(['/bin/tool', '/secret/x.md'])
    expect(plan.acceptedAny).toBe(true)
  })
})

describe('planOpenBatch (T-56 batch oracle)', () => {
  it('keeps request order and grants focus to the first accepted outcome only', () => {
    const plan = planOpenBatch([opened('/docs/a.md'), opened('/docs/b.md'), opened('/docs/c.md')])
    expect(plan.items.map((item) => item.docId)).toEqual(['d-a.md', 'd-b.md', 'd-c.md'])
    expect(plan.items.map((item) => item.activate)).toEqual([true, false, false])
    expect(plan.failures).toEqual([])
  })

  it('skips rejected items when choosing the first focus target', () => {
    const plan = planOpenBatch([rejected('/bin/tool', FORMAT_ERROR), opened('/docs/b.md')])
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].activate).toBe(true)
    expect(plan.items[0].docId).toBe('d-b.md')
  })

  it('marks a duplicate for canonical-tab reuse and activates it when first', () => {
    const plan = planOpenBatch([
      { path: '/docs/a.md', status: 'duplicate', duplicateOfDocId: 'd-a.md' },
    ])
    expect(plan.items).toEqual([
      {
        outcome: { path: '/docs/a.md', status: 'duplicate', duplicateOfDocId: 'd-a.md' },
        docId: 'd-a.md',
        activate: true,
        reuse: true,
      },
    ])
    expect(plan.acceptedAny).toBe(true)
  })

  it('summarizes an all-rejected batch without inventing a focus target', () => {
    const plan = planOpenBatch([rejected('/bin/tool', FORMAT_ERROR)])
    expect(plan.items).toEqual([])
    expect(plan.failures).toHaveLength(1)
    expect(plan.acceptedAny).toBe(false)
  })
})

/** Minimal application of a batch plan, used as the equivalence oracle. */
function projectBatch(outcomes: readonly OpenOutcome[]) {
  const plan = planOpenBatch(outcomes)
  return {
    tabs: plan.items.map((item) => item.docId),
    active: plan.items.find((item) => item.activate)?.docId ?? null,
  }
}
