import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
const listeners = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>())
const windowHandlers = vi.hoisted(() => ({
  focus: undefined as undefined | ((event: { payload: boolean }) => void),
  close: undefined as
    | undefined
    | ((event: { preventDefault(): void }) => void | Promise<void>),
  drag: undefined as
    | undefined
    | ((event: { payload: { type: string; paths: string[] } }) => void),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (event: { payload: unknown }) => void) => {
    listeners.set(name, cb)
    return Promise.resolve(() => listeners.delete(name))
  }),
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: (cb: (event: { payload: boolean }) => void) => {
      windowHandlers.focus = cb
      return Promise.resolve(() => undefined)
    },
    onCloseRequested: (cb: (event: { preventDefault(): void }) => void | Promise<void>) => {
      windowHandlers.close = cb
      return Promise.resolve(() => undefined)
    },
    onDragDropEvent: (cb: (event: { payload: { type: string; paths: string[] } }) => void) => {
      windowHandlers.drag = cb
      return Promise.resolve(() => undefined)
    },
  }),
}))

import ReaderScreen from './ReaderScreen'
import { documentModelCache } from '../../app/session'
import { AppStoreProvider } from '../../app/store'
import { t } from '../../app/i18n'
import { resetWriteSuppression, suppressWriteBack } from '../../app/write-suppression'
import { resourceAuth } from './resources/resource-auth'
import { resourceInvalidation } from './view/resource-invalidation'
import type {
  AccessDecision,
  DirectoryNode,
  DocIdentity,
  DocumentSnapshot,
  ErrorPayload,
  GlobalSettings,
  OpenRequest,
  PositionRecord,
  RecentEntry,
  SessionSnapshot,
} from '../../services/types'

/**
 * Reader smoke tests (ui-spec §3.2; handoff wp-19 "reader smoke component
 * tests: empty/loading/ready/error, tab order rules, event bridge"; wp-24
 * adds welcome/navigation/source/inspect coverage). Tauri is mocked at the
 * lowest transport level; the parse pipeline runs in-process (no Worker in
 * jsdom) exactly like the production fallback.
 */

function renderReader() {
  return render(
    <AppStoreProvider>
      <ReaderScreen />
    </AppStoreProvider>,
  )
}

const DEFAULTS: GlobalSettings = {
  theme: 'system',
  fontSizePx: 17,
  lineHeight: 1.8,
  maxContentWidthPx: 760,
  syntaxMode: 'technical',
  updateModeDefault: 'keep',
  restoreSession: true,
  rememberRecords: true,
}

let pendingRequests: OpenRequest[] = []
let readError: ErrorPayload | null = null
let refreshHash = 'v1'
let holdRead = false
let resolveRead: ((snapshot: DocumentSnapshot) => void) | null = null
let checkAccess: AccessDecision = { status: 'missing', kind: 'local' }
let saveResult: { saved: boolean; error?: ErrorPayload } = { saved: true }
let texts = new Map<string, string>()
let recentsResult: RecentEntry[] = []
let pickFilesResult: { cancelled: boolean; paths: string[] } = { cancelled: true, paths: [] }
let pickDirectoryResult: { cancelled: boolean; paths: string[] } = { cancelled: true, paths: [] }
let directoryNodes: DirectoryNode[] = []
let settingsResult: GlobalSettings = { ...DEFAULTS }
let sizeByPath = new Map<string, number>()
let relinkStatus: 'reassociated' | 'new-version' = 'reassociated'
let relinkText: string | null = null
let rejectPath: string | null = null
let duplicatePath: string | null = null
let sessionSnapshot: SessionSnapshot | null = null
let positionRecords = new Map<string, PositionRecord>()
let touchRecentCalls: string[] = []
let scrollCalls: Element[] = []

const REJECTED_OPEN_ERROR: ErrorPayload = {
  code: 'PS_FMT_UNSUPPORTED',
  category: 'io',
  messageKey: 'error.encoding.formatUnsupported',
  retryable: false,
}

/** Rendered source-unavailable banner (title + message via the template key). */
const UNAVAILABLE_BANNER = t('document.unavailable.banner', {
  title: t('document.unavailable.title'),
  message: t('document.unavailable.message'),
})

function identityFor(path: string): DocIdentity {
  const name = path.split('/').pop() ?? 'doc.md'
  return {
    docId: `d-${name}`,
    canonicalPath: path,
    displayName: name,
    format: 'markdown',
    encoding: 'utf-8',
    contentHash: 'v1',
    sizeBytes: sizeByPath.get(path) ?? 128,
    lastSeenAtMs: 1,
  }
}

function snapshotFor(docId: string, hash = 'v1'): DocumentSnapshot {
  const name = docId.slice(2)
  return {
    docId,
    identity: { ...identityFor(`/docs/${name}`), contentHash: hash },
    version: { contentHash: hash, sizeBytes: 128, modifiedAtMs: 1, observedAtMs: 2 },
    text: texts.get(`${docId}@${hash}`) ?? texts.get(docId) ?? `# ${name}\n\nhello ${name}\n`,
    lineCount: 3,
  }
}

function installRouter(): void {
  invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
    switch (command) {
      case 'take_pending_open_requests':
        return Promise.resolve(pendingRequests)
      case 'get_settings':
        return Promise.resolve({
          global: settingsResult,
          defaults: DEFAULTS,
          limits: { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 },
          revision: 0,
        })
      case 'open_documents': {
        const req = (args?.req ?? { paths: [] }) as { paths: string[] }
        return Promise.resolve({
          items: req.paths.map((path) => {
            if (path === rejectPath) {
              return { path, status: 'rejected', error: REJECTED_OPEN_ERROR }
            }
            if (path === duplicatePath) {
              return { path, status: 'duplicate', duplicateOfDocId: identityFor(path).docId }
            }
            const identity = identityFor(path)
            return { path, status: 'opened', docId: identity.docId, identity }
          }),
        })
      }
      case 'read_document': {
        const req = (args?.req ?? {}) as { docId: string; purpose: string }
        if (readError) return Promise.reject(readError)
        if (holdRead) {
          return new Promise<DocumentSnapshot>((resolve) => {
            resolveRead = resolve
          })
        }
        const hash = req.purpose === 'refresh' ? refreshHash : 'v1'
        return Promise.resolve(snapshotFor(req.docId, hash))
      }
      case 'watch_document':
      case 'unwatch_document':
        return Promise.resolve(undefined)
      case 'list_recents':
        return Promise.resolve(recentsResult)
      case 'load_session':
        return Promise.resolve(sessionSnapshot)
      case 'load_position': {
        const docId = ((args ?? {}) as { docId?: string }).docId ?? ''
        return Promise.resolve(positionRecords.get(docId) ?? null)
      }
      case 'touch_recent': {
        const docId = ((args ?? {}) as { docId?: string }).docId ?? ''
        touchRecentCalls.push(docId)
        return Promise.resolve(undefined)
      }
      case 'pick_files':
        return Promise.resolve(pickFilesResult)
      case 'pick_directory':
        return Promise.resolve(pickDirectoryResult)
      case 'open_directory':
        return Promise.resolve({
          rootId: 'root-1',
          canonicalPath: '/root',
          displayName: 'root',
          scope: 'session',
        })
      case 'read_directory': {
        const req = (args?.req ?? {}) as { dirPath: string }
        return Promise.resolve({
          dirPath: req.dirPath,
          entries: req.dirPath === '/root' ? directoryNodes : [],
          truncated: false,
        })
      }
      case 'relink_document': {
        const req = (args?.req ?? {}) as { docId: string; newPath: string }
        const snapshot = snapshotFor(req.docId)
        if (relinkText !== null) snapshot.text = relinkText
        if (relinkStatus === 'new-version') {
          snapshot.version = { contentHash: 'v9', sizeBytes: 128, modifiedAtMs: 9, observedAtMs: 9 }
        }
        return Promise.resolve({ status: relinkStatus, snapshot })
      }
      case 'get_source_info': {
        const requested = ((args ?? {}) as { docId?: string }).docId ?? 'd-a.md'
        return Promise.resolve({
          docId: requested,
          version: {
            contentHash: 'v1',
            sizeBytes: sizeByPath.get(`/docs/${requested.slice(2)}`) ?? 128,
            modifiedAtMs: 1,
            observedAtMs: 2,
          },
          encoding: 'utf-8',
          totalLines: 3,
        })
      }
      case 'read_source_window':
        return Promise.resolve({
          docId: 'd-a.md',
          version: { contentHash: 'v1', sizeBytes: 128, modifiedAtMs: 1, observedAtMs: 2 },
          startLine: 1,
          endLine: 1,
          text: '',
          eof: true,
        })
      case 'plugin:clipboard-manager|write_text':
        return Promise.resolve(undefined)
      case 'check_resource_access':
        return Promise.resolve(checkAccess)
      case 'grant_remote_session': {
        const req = (args?.req ?? {}) as { docId: string; origins: string[] }
        return Promise.resolve({
          grantId: 'g-remote',
          kind: 'remote',
          scope: 'session',
          docId: req.docId,
          origins: req.origins,
          grantedAtMs: 1,
        })
      }
      case 'fetch_remote_image': {
        const req = (args?.req ?? {}) as { docId: string; url: string }
        return Promise.resolve({
          assetUrl: `asset://remote/image?v=1`,
          mime: 'image/png',
          sizeBytes: 10,
          finalUrl: req.url,
          cacheKey: 'k1',
          fromCache: false,
        })
      }
      case 'revoke_remote_session':
        return Promise.resolve({ revoked: true, cancelledRequests: 0, removedCacheEntries: 1 })
      case 'save_session':
        return Promise.resolve(saveResult)
      default:
        return Promise.resolve(undefined)
    }
  })
}

beforeEach(() => {
  pendingRequests = []
  readError = null
  refreshHash = 'v1'
  holdRead = false
  resolveRead = null
  checkAccess = { status: 'missing', kind: 'local' }
  saveResult = { saved: true }
  texts = new Map()
  recentsResult = []
  pickFilesResult = { cancelled: true, paths: [] }
  pickDirectoryResult = { cancelled: true, paths: [] }
  directoryNodes = []
  settingsResult = { ...DEFAULTS }
  sizeByPath = new Map()
  relinkStatus = 'reassociated'
  relinkText = null
  rejectPath = null
  duplicatePath = null
  sessionSnapshot = null
  positionRecords = new Map()
  touchRecentCalls = []
  scrollCalls = []
  resetWriteSuppression()
  // jsdom does not implement scrolling; the reader guards on the method, so a
  // spy records exactly which element each navigation scrolled to.
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrollCalls.push(this)
  })
  listeners.clear()
  windowHandlers.focus = undefined
  windowHandlers.close = undefined
  windowHandlers.drag = undefined
  documentModelCache.clear()
  resourceAuth.reset()
  resourceInvalidation.reset()
  invokeMock.mockReset()
  installRouter()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ReaderScreen (ui-spec §3.2)', () => {
  it('shows the welcome placeholder when no document is open', async () => {
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('renders a document with formulas, local formula fallback and image placeholder', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set(
      'd-a.md',
      '# 标题\n\n行内 $x^2$。\n\n坏公式 $\\undefinedmacro{x}$\n\n![缺失](missing.png)\n',
    )
    checkAccess = { status: 'missing', kind: 'local' }

    renderReader()
    await screen.findByRole('heading', { level: 1, name: '标题' })
    expect(document.querySelector('.katex')).toBeTruthy()
    await screen.findByText(t('error.parse.local'))
    await screen.findByText(t('image.missing'))
    expect(screen.getByText(t('image.relPath', { path: 'missing.png' }))).toBeTruthy()
  })

  it('shows the read error with its code and a retry action', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    readError = {
      code: 'PS_IO_READ_FAILED',
      category: 'io',
      messageKey: 'error.io.readFailed',
      retryable: true,
    }

    renderReader()
    await screen.findByText(t('error.io.readFailed'))
    expect(screen.getByText('PS_IO_READ_FAILED')).toBeTruthy()
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeTruthy()
  })

  it('opens both documents, shows the tab bar and closes in order with Ctrl+W', async () => {
    pendingRequests = [{ paths: ['/docs/a.md', '/docs/b.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await screen.findByRole('heading', { level: 1, name: 'b.md' })
    // Tab bar hides again below two tabs (INV-TL-08).
    expect(screen.queryAllByRole('tab')).toHaveLength(0)

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('offers 现在更新 in keep mode and commits with the paired position result', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\nOLD\n')
    texts.set('d-a.md@v2', '# 标题\n\nNEW\n')
    renderReader()
    await screen.findByText('OLD')

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    await screen.findByText(t('update.banner'))
    expect(screen.getByRole('button', { name: t('update.action.now') })).toBeTruthy()
    expect(screen.getAllByText(t('update.badge')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: t('update.action.now') }))
    // No saved anchor exists yet: the commit must report the approximate
    // landing point, never a fake exact restore (INV-UM-08/INV-AR-03).
    await screen.findByText(t('update.position.approx'))
    await screen.findByText('NEW')
    expect(screen.queryByText(t('update.banner'))).toBeNull()
    expect(screen.queryByText('OLD')).toBeNull()
  })

  it('collapses the banner with 稍后 and reopens it from the textual marker (INV-UM-05)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    await screen.findByText(t('update.banner'))

    fireEvent.click(screen.getByRole('button', { name: t('update.action.later') }))
    await waitFor(() => expect(screen.queryByText(t('update.banner'))).toBeNull())
    const marker = screen.getByRole('button', { name: t('update.badge') })
    fireEvent.click(marker)
    await screen.findByText(t('update.banner'))
  })

  it('commits automatically only in follow mode on the active tab without selection or inspect', async () => {
    settingsResult = { ...DEFAULTS, updateModeDefault: 'follow' }
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\nOLD\n')
    texts.set('d-a.md@v2', '# 标题\n\nNEW\n')
    renderReader()
    await screen.findByText('OLD')

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    // No click: follow commits and pairs the position result (INV-UM-02/08).
    await screen.findByText('NEW')
    await screen.findByText(t('update.position.approx'))
    expect(screen.queryByText(t('update.banner'))).toBeNull()
  })

  it('defers a follow commit for a background tab and re-evaluates on activation (INV-UM-04)', async () => {
    settingsResult = { ...DEFAULTS, updateModeDefault: 'follow' }
    pendingRequests = [{ paths: ['/docs/a.md', '/docs/b.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\nA-OLD\n')
    texts.set('d-b.md@v1', '# 标题\n\nB-OLD\n')
    texts.set('d-b.md@v2', '# 标题\n\nB-NEW\n')
    renderReader()
    await screen.findByText('A-OLD')

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-b.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    // Background: the candidate is stored but never committed off-screen.
    expect(screen.queryByText('B-NEW')).toBeNull()
    expect(screen.queryByText('B-OLD')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /b\.md/ }))
    await screen.findByText('B-NEW')
    await screen.findByText(t('update.position.approx'))
  })

  it('pauses follow updates under a selection and commits only on 更新并清除选区 (INV-UM-03)', async () => {
    settingsResult = { ...DEFAULTS, updateModeDefault: 'follow' }
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\nOLD\n')
    texts.set('d-a.md@v2', '# 标题\n\nNEW\n')
    renderReader()
    const old = await screen.findByText('OLD')

    const range = document.createRange()
    range.selectNodeContents(old)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'))
    })

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    await screen.findByText(t('update.paused.selection'))
    expect(screen.queryByText('NEW')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('update.action.continueReading') }))
    fireEvent.click(screen.getByRole('button', { name: t('update.action.updateAndClearSelection') }))
    await screen.findByText('NEW')
    await screen.findByText(t('update.position.approx'))
    expect(window.getSelection()?.toString() ?? '').toBe('')
  })

  it('pauses follow updates while the inspect drawer is open and commits on close (INV-UM-02)', async () => {
    settingsResult = { ...DEFAULTS, updateModeDefault: 'follow' }
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\n$$\nx^2\n$$\n')
    texts.set('d-a.md@v2', '# 标题\n\n$$\nx^3\n$$\n')
    renderReader()
    await screen.findByRole('heading', { level: 1, name: '标题' })

    fireEvent.click(screen.getByRole('button', { name: t('formula.drawer.title') }))
    const inspect = await screen.findByRole('complementary', { name: t('inspect.aria') })

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    await screen.findByText(t('update.paused.inspect'))

    fireEvent.click(within(inspect).getByRole('button', { name: t('inspect.close') }))
    await waitFor(() => expect(screen.queryByText(t('update.paused.inspect'))).toBeNull())
    await screen.findByText(t('update.position.approx'))
  })

  it('observes the reading position on scroll and persists an AnchorRecord (INV-AR-01)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n第一段\n\n第二段\n')
    renderReader()
    await screen.findByText('第一段')

    const main = document.querySelector('.ps-reader-main') as HTMLElement
    await act(async () => {
      fireEvent.scroll(main)
    })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('save_position', {
        req: {
          docId: 'd-a.md',
          anchor: expect.objectContaining({
            versionHash: 'v1',
            sourceRange: expect.objectContaining({ startByte: expect.any(Number) }),
            blockFingerprint: expect.stringMatching(/^fp1:/),
          }),
        },
      }),
    )
  })

  it('merges consecutive candidates into one banner and commits the latest (INV-UM-06)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\nOLD\n')
    texts.set('d-a.md@v2', '# 标题\n\nMIDDLE\n')
    texts.set('d-a.md@v3', '# 标题\n\nNEWEST\n')
    renderReader()
    await screen.findByText('OLD')

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    await screen.findByText(t('update.banner'))

    refreshHash = 'v3'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 6 },
      })
    })
    // Exactly one banner for the merged candidate; no stacking.
    expect(screen.getAllByText(t('update.banner'))).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: t('update.action.now') }))
    await screen.findByText('NEWEST')
    expect(screen.queryByText('MIDDLE')).toBeNull()
    await screen.findByText(t('update.position.approx'))
  })

  it('re-resolves a resource event without a document banner or version change (INV-VC-07)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n![图](pic.png)\n')
    checkAccess = {
      status: 'allowed',
      kind: 'local',
      canonicalPath: '/docs/pic.png',
      assetUrl: 'asset://docs/pic.png?v=1',
    }
    renderReader()
    await screen.findByRole('img', { name: '图' })

    checkAccess = {
      status: 'allowed',
      kind: 'local',
      canonicalPath: '/docs/pic.png',
      assetUrl: 'asset://docs/pic.png?v=2',
    }
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: {
          docId: 'd-a.md',
          kind: 'resource',
          resourcePath: '/docs/pic.png',
          observedAtMs: 6,
        },
      })
    })
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '图' }).getAttribute('src')).toBe(
        'asset://docs/pic.png?v=2',
      ),
    )
    expect(screen.queryByText(t('update.banner'))).toBeNull()
    expect(
      invokeMock.mock.calls.some(
        ([command, args]) =>
          command === 'read_document' &&
          (args as { req?: { purpose?: string } } | undefined)?.req?.purpose === 'refresh',
      ),
    ).toBe(false)
  })

  it('ignores a late read result after the tab was closed (INV-VC-06)', async () => {
    vi.useFakeTimers()
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    holdRead = true
    renderReader()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await act(async () => {
      resolveRead?.(snapshotFor('d-a.md'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole('heading', { level: 1, name: t('welcome.title') })).toBeTruthy()
    expect(documentModelCache.sizeFor('d-a.md')).toBe(0)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('keeps the source view on the display version while a newer candidate exists (INV-VC-08)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md@v1', '# 标题\n\nOLD\n')
    texts.set('d-a.md@v2', '# 标题\n\nNEW\n')
    renderReader()
    await screen.findByText('OLD')

    refreshHash = 'v2'
    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'modified', observedAtMs: 5 },
      })
    })
    await screen.findByText(t('update.banner'))

    fireEvent.click(screen.getByRole('button', { name: t('toolbar.more') }))
    fireEvent.click(screen.getByRole('menuitem', { name: t('menu.viewSource') }))
    await screen.findByRole('heading', { name: t('source.title') })
    expect(screen.getByText(/OLD/)).toBeTruthy()
    expect(screen.queryByText(/NEW/)).toBeNull()
    expect(screen.getAllByText(t('update.badge')).length).toBeGreaterThan(0)
  })

  it('prompts for >10MiB documents and reads the simplified subset on choice (T-51)', async () => {
    sizeByPath.set('/docs/big.md', 11 * 1024 * 1024)
    pendingRequests = [{ paths: ['/docs/big.md'], cwd: null, source: 'cli' }]
    texts.set('d-big.md', '# 大文档\n\n正文 $x^2$\n')
    renderReader()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('largeDoc.title'))).toBeTruthy()
    // Nothing is read before the choice.
    expect(invokeMock).not.toHaveBeenCalledWith('read_document', expect.anything())

    fireEvent.click(within(dialog).getByRole('button', { name: t('largeDoc.simplified') }))
    await screen.findByText('大文档')
    expect(screen.getByText(t('document.badge.simplified'))).toBeTruthy()
    expect(screen.getByText(t('largeDoc.coverage'))).toBeTruthy()
    // Heavy engines stay off: the formula renders as its source, not KaTeX.
    expect(document.querySelector('.katex')).toBeNull()
    expect(screen.getByText(/x\^2/)).toBeTruthy()
  })

  it('cancelling the large-document prompt leaves no ghost tab or background read', async () => {
    sizeByPath.set('/docs/big.md', 11 * 1024 * 1024)
    pendingRequests = [{ paths: ['/docs/big.md'], cwd: null, source: 'cli' }]
    renderReader()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t('largeDoc.cancel') }))
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(invokeMock).not.toHaveBeenCalledWith('read_document', expect.anything())
  })

  it('routes >50MiB straight to the labeled source-window mode (T-52)', async () => {
    sizeByPath.set('/docs/huge.md', 51 * 1024 * 1024)
    pendingRequests = [{ paths: ['/docs/huge.md'], cwd: null, source: 'cli' }]
    renderReader()

    await screen.findByText(t('document.badge.sourceOnly'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(t('error.limit.size'))).toBeTruthy()
    await screen.findByRole('heading', { name: t('source.title') })
    expect(invokeMock).toHaveBeenCalledWith('get_source_info', { docId: 'd-huge.md' })
    expect(invokeMock).not.toHaveBeenCalledWith('read_document', expect.anything())
  })


  it('rechecks the active tab on window focus', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })

    await act(async () => {
      windowHandlers.focus?.({ payload: true })
    })
    await waitFor(
      () =>
        expect(invokeMock).toHaveBeenCalledWith('read_document', {
          req: { docId: 'd-a.md', purpose: 'refresh' },
        }),
      { timeout: 2000 },
    )
  })

  it('opens dropped paths through the same validated entry point', async () => {
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    await act(async () => {
      windowHandlers.drag?.({
        payload: { type: 'drop', paths: ['/docs/drop.md'] },
      })
    })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('open_documents', {
        req: { paths: ['/docs/drop.md'], entry: 'drop' },
      }),
    )
    await screen.findByRole('heading', { level: 1, name: 'drop.md' })
  })

  it('routes a single-instance open request through entry="system"', async () => {
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    await act(async () => {
      listeners.get('paperstack://open-requested')?.({
        payload: { paths: ['/docs/sys.md'], cwd: '/docs', source: 'second-instance' },
      })
    })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('open_documents', {
        req: { paths: ['/docs/sys.md'], entry: 'system' },
      }),
    )
    await screen.findByRole('heading', { level: 1, name: 'sys.md' })
  })

  it('summarizes a rejected drop item without clearing the successful tab', async () => {
    rejectPath = '/bin/tool'
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    await act(async () => {
      windowHandlers.drag?.({
        payload: { type: 'drop', paths: ['/bin/tool', '/docs/good.md'] },
      })
    })
    // The first item is rejected, so the first success (second in order) is
    // the tab that gets focus; the failure is summarized next to it.
    await screen.findByRole('heading', { level: 1, name: 'good.md' })
    const banner = await screen.findByText(/PS_FMT_UNSUPPORTED/)
    expect(banner.textContent).toContain(t('error.encoding.formatUnsupported'))
    expect(invokeMock).toHaveBeenCalledWith('open_documents', {
      req: { paths: ['/bin/tool', '/docs/good.md'], entry: 'drop' },
    })
  })

  it('reuses the canonical-path tab when a duplicate open arrives (R05)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md', '/docs/b.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    expect(screen.getAllByRole('tab')).toHaveLength(2)

    fireEvent.click(screen.getByRole('tab', { name: /b\.md/ }))
    await screen.findByRole('heading', { level: 1, name: 'b.md' })

    duplicatePath = '/docs/a.md'
    await act(async () => {
      windowHandlers.drag?.({ payload: { type: 'drop', paths: ['/docs/a.md'] } })
    })
    // The duplicate activates the existing tab instead of opening a third.
    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    const reads = invokeMock.mock.calls.filter(
      ([command, args]) =>
        command === 'read_document' &&
        (args as { req?: { docId?: string } } | undefined)?.req?.docId === 'd-a.md',
    )
    expect(reads).toHaveLength(1)
  })

  it('allows a remote origin for the document session, revokes on close and blocks a new session', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n![远程](https://img.example.com/a.png)\n')
    checkAccess = {
      status: 'remote-blocked',
      kind: 'remote',
      origin: 'https://img.example.com',
    }
    const fetchCalls = () =>
      invokeMock.mock.calls.filter(([command]) => command === 'fetch_remote_image').length
    renderReader()
    await screen.findByText(t('image.remoteBlocked'))
    expect(fetchCalls()).toBe(0)

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t('dialog.authRemote.allow') }))
    await screen.findByRole('img', { name: '远程' })
    await waitFor(() => expect(fetchCalls()).toBe(1))
    expect(invokeMock).toHaveBeenCalledWith('grant_remote_session', {
      req: { docId: 'd-a.md', origins: ['https://img.example.com'] },
    })

    // Leaving the document session revokes it (session cache purge in Rust).
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('revoke_remote_session', { docId: 'd-a.md' }),
    )

    // A new document session starts blocked again: no grant, no new request.
    await act(async () => {
      windowHandlers.drag?.({ payload: { type: 'drop', paths: ['/docs/a.md'] } })
    })
    await screen.findByText(t('image.remoteBlocked'))
    expect(screen.queryByRole('img')).toBeNull()
    expect(fetchCalls()).toBe(1)
    // The fresh session offers the confirmation again (explicit, never silent).
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('surfaces a failed quit-time save once and lets the next close proceed', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    saveResult = {
      saved: false,
      error: {
        code: 'PS_DB_FAILURE',
        category: 'storage',
        messageKey: 'error.storage.dbFailure',
        retryable: true,
      },
    }
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })

    const firstClose = { preventDefault: vi.fn() }
    await act(async () => {
      await windowHandlers.close?.(firstClose)
    })
    expect(firstClose.preventDefault).toHaveBeenCalledTimes(1)
    await screen.findByText(t('document.state.notSaved'))

    const secondClose = { preventDefault: vi.fn() }
    await act(async () => {
      await windowHandlers.close?.(secondClose)
    })
    expect(secondClose.preventDefault).not.toHaveBeenCalled()
  })

  it('follows the >150ms / >1s loading placeholder rules and supports cancel', async () => {
    vi.useFakeTimers()
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    holdRead = true

    renderReader()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    // Under 150ms: nothing on screen yet.
    expect(screen.queryByText(t('common.loading'))).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.getByText(t('common.loading'))).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    const cancel = screen.getByRole('button', { name: t('document.loading.cancel') })
    fireEvent.click(cancel)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(t('error.internal.cancelled'))).toBeTruthy()
    expect(resolveRead).not.toBeNull()
  })

  it('keeps the welcome state unchanged when the file picker is cancelled', async () => {
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    fireEvent.click(screen.getByRole('button', { name: t('welcome.openFile') }))
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('pick_files', undefined))
    expect(invokeMock.mock.calls.some(([command]) => command === 'open_documents')).toBe(false)
    expect(screen.getByRole('heading', { level: 1, name: t('welcome.title') })).toBeTruthy()
  })

  it('toggles the navigation panel with Ctrl+B and closes it in place', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    const panel = await screen.findByRole('complementary', { name: t('nav.aria') })
    // No directory is authorized: the outline is the available panel.
    expect(
      within(panel).getByRole('tab', { name: t('nav.tab.outline'), selected: true }),
    ).toBeTruthy()
    expect(within(panel).getByRole('tree', { name: t('nav.outline.aria') })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: t('nav.aria') })).toBeNull(),
    )
  })

  it('temporarily hides the navigation for the inspect drawer and restores it on close', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n$$\nx^2\n$$\n\n正文\n')
    renderReader()
    await screen.findByRole('heading', { level: 1, name: '标题' })

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    await screen.findByRole('complementary', { name: t('nav.aria') })

    fireEvent.click(screen.getByRole('button', { name: t('formula.drawer.title') }))
    const inspect = await screen.findByRole('complementary', { name: t('inspect.aria') })
    expect(inspect.querySelector('.ps-inspect-source')?.textContent).toBe('x^2')
    // One auxiliary area at most (EDGE-06).
    expect(screen.queryByRole('complementary', { name: t('nav.aria') })).toBeNull()

    fireEvent.click(within(inspect).getByRole('button', { name: t('inspect.close') }))
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: t('inspect.aria') })).toBeNull(),
    )
    expect(screen.getByRole('complementary', { name: t('nav.aria') })).toBeTruthy()
  })

  it('switches to the source view and falls back to the saved anchor with the exact message', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n第一段\n\n第二段\n')
    renderReader()
    await screen.findByRole('heading', { level: 1, name: '标题' })

    fireEvent.click(screen.getByRole('button', { name: t('toolbar.more') }))
    fireEvent.click(screen.getByRole('menuitem', { name: t('menu.viewSource') }))
    await screen.findByRole('heading', { name: t('source.title') })
    expect(screen.getByText(/# 标题/)).toBeTruthy()

    // Scroll beyond every block: the return mapping must not guess.
    const scroll = document.querySelector('.ps-source-scroll') as HTMLElement
    scroll.scrollTop = 10_000_000
    fireEvent.scroll(scroll)
    fireEvent.click(screen.getByRole('button', { name: t('source.back') }))

    await screen.findByText(t('source.notLocated'))
    expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeTruthy()
  })

  it('opens a directory into the file tree and opens a file from it', async () => {
    pickDirectoryResult = { cancelled: false, paths: ['/root'] }
    directoryNodes = [
      { name: 'readme.md', path: '/root/readme.md', kind: 'file', status: 'ok', isMarkdown: true },
    ]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })

    fireEvent.click(screen.getByRole('button', { name: t('welcome.openDirectory') }))
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('open_directory', {
        req: { path: '/root', persist: false },
      }),
    )

    const navButton = screen.getByRole('button', { name: t('toolbar.navToggle.show') })
    expect((navButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(navButton)
    const treeitem = await screen.findByRole('treeitem', { name: /readme\.md/ })
    fireEvent.click(treeitem)
    await screen.findByRole('heading', { level: 1, name: 'readme.md' })
    expect(invokeMock).toHaveBeenCalledWith('open_documents', {
      req: { paths: ['/root/readme.md'], entry: 'tree' },
    })
  })

  it('relinks an unavailable recent and reports the outcome instead of dropping it', async () => {
    recentsResult = [
      {
        docId: 'd-restored',
        displayName: 'restored.md',
        canonicalPath: '/docs/restored.md',
        openedAtMs: 1,
        available: false,
      },
    ]
    pickFilesResult = { cancelled: false, paths: ['/docs/restored.md'] }
    renderReader()
    fireEvent.click(await screen.findByText('restored.md'))

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('relink_document', {
        req: { docId: 'd-restored', newPath: '/docs/restored.md' },
      }),
    )
    await screen.findByText(t('document.relink.reassociated'))
    await screen.findByRole('heading', { level: 1, name: 'restored.md' })
  })

  it('explains a different-bytes relink as a new version before adopting (R07)', async () => {
    recentsResult = [
      {
        docId: 'd-restored',
        displayName: 'restored.md',
        canonicalPath: '/docs/restored.md',
        openedAtMs: 1,
        available: false,
      },
    ]
    pickFilesResult = { cancelled: false, paths: ['/docs/restored.md'] }
    relinkStatus = 'new-version'
    relinkText = '# 新版本\n\nchanged\n'
    renderReader()
    fireEvent.click(await screen.findByText('restored.md'))

    await screen.findByText(t('document.relink.newVersion'))
    await screen.findByRole('heading', { level: 1, name: 'restored.md' })
    // The relink/adoption explanation is visible, never silently "synced".
    expect(screen.queryByText(t('document.relink.reassociated'))).toBeNull()
  })

  it('opens the zoom overlay from a formula and closes it with Esc', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n$$\nx^2\n$$\n')
    renderReader()
    await screen.findByRole('heading', { level: 1, name: '标题' })

    fireEvent.click(screen.getByRole('button', { name: t('formula.action.zoom') }))
    await screen.findByRole('dialog', { name: t('zoom.title') })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t('zoom.title') })).toBeNull())
    expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // wp-34a routed acceptance defects (AT06/07/14/15/19)
  // -------------------------------------------------------------------------

  it('restores the last session on startup with stored order and active tab (AT06)', async () => {
    sessionSnapshot = {
      tabs: [
        { tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: false },
        { tabId: 'tab-old-2', docId: 'd-b.md', orderIndex: 1, isActive: true },
      ],
      activeTabId: 'tab-old-2',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
      {
        docId: 'd-b.md',
        displayName: 'b.md',
        canonicalPath: '/docs/b.md',
        openedAtMs: 2,
        available: true,
      },
    ]
    renderReader()

    await screen.findByRole('heading', { level: 1, name: 'b.md' })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(invokeMock).toHaveBeenCalledWith('open_documents', {
      req: { paths: ['/docs/a.md'], entry: 'restore' },
    })
    expect(invokeMock).toHaveBeenCalledWith('read_document', {
      req: { docId: 'd-a.md', purpose: 'restore' },
    })
    // Restoring is not an explicit open: no recent is (re-)recorded.
    expect(touchRecentCalls).toEqual([])
  })

  it('does not restore the session when the preference is off (AT06)', async () => {
    settingsResult = { ...DEFAULTS, restoreSession: false }
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
    ]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: t('welcome.title') })
    // The stored session is not even read when the preference is off.
    expect(invokeMock.mock.calls.some(([command]) => command === 'load_session')).toBe(false)
    expect(
      invokeMock.mock.calls.some(
        ([command, args]) =>
          command === 'read_document' &&
          (args as { req?: { purpose?: string } } | undefined)?.req?.purpose === 'restore',
      ),
    ).toBe(false)
  })

  it('never lets a session restore steal focus from an explicit startup file (INV-SR-01)', async () => {
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-b.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-b.md',
        displayName: 'b.md',
        canonicalPath: '/docs/b.md',
        openedAtMs: 1,
        available: true,
      },
    ]
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    renderReader()

    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('read_document', {
        req: { docId: 'd-b.md', purpose: 'restore' },
      }),
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
  })

  it('records successful explicit opens in recents but never silently drops them (AT06/D-34-3)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md', '/docs/b.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    await waitFor(() => expect(touchRecentCalls).toEqual(['d-a.md', 'd-b.md']))
  })

  it('records the first explicit open after a cleared recents category (AT27 interplay)', async () => {
    suppressWriteBack(['recents'])
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    renderReader()
    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    // The explicit open lifts the suppression before the recent is recorded
    // (models §9.1), so the freshly opened document is not lost.
    await waitFor(() => expect(touchRecentCalls).toEqual(['d-a.md']))
  })

  it('scrolls to the heading when an outline item is activated (AT14)', async () => {
    pendingRequests = [{ paths: ['/docs/links.md'], cwd: null, source: 'cli' }]
    texts.set('d-links.md', '# Links\n\n## More links\n\nBody\n')
    renderReader()
    await screen.findByText('Body')

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    const panel = await screen.findByRole('complementary', { name: t('nav.aria') })
    const heading = document.getElementById('ps-h-more-links')
    expect(heading).not.toBeNull()
    fireEvent.click(within(panel).getByRole('treeitem', { name: /More links/ }))
    await waitFor(() => expect(scrollCalls).toContain(heading))
    // Outline navigation records history too (models §5.2; INV-NH-02).
    const back = screen.getByRole('button', { name: t('toolbar.back') }) as HTMLButtonElement
    await waitFor(() => expect(back.disabled).toBe(false))
  })

  it('keeps the loaded content and offers relink/retry/close when the source disappears (AT07)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n仍然可见\n')
    renderReader()
    await screen.findByText('仍然可见')

    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'removed', observedAtMs: 7 },
      })
    })
    await screen.findByText(
      UNAVAILABLE_BANNER,
    )
    // INV-DS-06: the loaded content is kept.
    expect(screen.getByText('仍然可见')).toBeTruthy()
    const relink = screen.getByRole('button', { name: t('document.unavailable.relink') })
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('document.unavailable.closeTab') })).toBeTruthy()

    // 重新定位 adopts the reselected file and clears the unavailable state.
    pickFilesResult = { cancelled: false, paths: ['/docs/a.md'] }
    fireEvent.click(relink)
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('relink_document', {
        req: { docId: 'd-a.md', newPath: '/docs/a.md' },
      }),
    )
    await screen.findByText(t('document.relink.reassociated'))
    await waitFor(() =>
      expect(
        screen.queryByText(UNAVAILABLE_BANNER),
      ).toBeNull(),
    )
  })

  it('retries an unavailable source with retained content and returns to the readable state (AT07)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n仍然可见\n')
    renderReader()
    await screen.findByText('仍然可见')

    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'removed', observedAtMs: 7 },
      })
    })
    await screen.findByText(
      UNAVAILABLE_BANNER,
    )

    // 重试 re-reads the same path through the stable refresh read.
    fireEvent.click(screen.getByRole('button', { name: t('common.retry') }))
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('read_document', {
        req: { docId: 'd-a.md', purpose: 'refresh' },
      }),
    )
    // Same bytes readable again → Ready: the banner clears, the retained
    // content stays mounted and the tab must not be left in a loading phase
    // (T8 "源恢复可读"; INV-DS-06).
    await waitFor(() =>
      expect(
        screen.queryByText(UNAVAILABLE_BANNER),
      ).toBeNull(),
    )
    expect(screen.getByText('仍然可见')).toBeTruthy()
  })

  it('keeps the retained content when the unavailable retry still fails (AT07)', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\n仍然可见\n')
    renderReader()
    await screen.findByText('仍然可见')

    await act(async () => {
      listeners.get('paperstack://watch-changed')?.({
        payload: { docId: 'd-a.md', kind: 'removed', observedAtMs: 7 },
      })
    })
    await screen.findByText(
      UNAVAILABLE_BANNER,
    )

    readError = {
      code: 'PS_IO_NOT_FOUND',
      category: 'io',
      messageKey: 'error.io.notFound',
      retryable: true,
    }
    fireEvent.click(screen.getByRole('button', { name: t('common.retry') }))
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('read_document', {
        req: { docId: 'd-a.md', purpose: 'refresh' },
      }),
    )
    // INV-DS-06: a failed retry keeps the last displayed content and the
    // unavailable banner (the source is still missing).
    await waitFor(() =>
      expect(
        screen.getByText(UNAVAILABLE_BANNER),
      ).toBeTruthy(),
    )
    expect(screen.getByText('仍然可见')).toBeTruthy()
  })

  it('navigates in-app heading fragments through the outline anchors and records history (AT14/AT15)', async () => {
    pendingRequests = [{ paths: ['/docs/links.md'], cwd: null, source: 'cli' }]
    texts.set(
      'd-links.md',
      '# Links\n\n## More links\n\n[Jump](#more-links)\n\n## Duplicate 标题\n\nA\n\n## Duplicate 标题\n\nB\n',
    )
    renderReader()
    await screen.findByText('Jump')

    const heading = document.getElementById('ps-h-more-links')
    expect(heading).not.toBeNull()
    const back = screen.getByRole('button', { name: t('toolbar.back') }) as HTMLButtonElement
    expect(back.disabled).toBe(true)

    fireEvent.click(screen.getByRole('link', { name: 'Jump' }))
    await waitFor(() => expect(scrollCalls).toContain(heading))
    // The navigation produced exactly one history entry (INV-NH-02).
    await waitFor(() => expect(back.disabled).toBe(false))
  })

  it('resolves duplicate-title fragments to the unique outline ids (AT14)', async () => {
    pendingRequests = [{ paths: ['/docs/links.md'], cwd: null, source: 'cli' }]
    texts.set(
      'd-links.md',
      '# Links\n\n## Duplicate 标题\n\nFirst\n\n## Duplicate 标题\n\nSecond\n\n[两种](#duplicate-标题)\n',
    )
    renderReader()
    await screen.findByText('两种')

    fireEvent.click(screen.getByRole('link', { name: '两种' }))
    await waitFor(() => expect(scrollCalls.length).toBeGreaterThan(0))
    // The author fragment resolves through the same slug as the first
    // duplicate's unique outline anchor (`ps-h-duplicate`).
    expect(scrollCalls[0]?.id).toBe('ps-h-duplicate')
  })

  it('explains a missing fragment and keeps the position instead of navigating silently (AT15)', async () => {
    pendingRequests = [{ paths: ['/docs/links.md'], cwd: null, source: 'cli' }]
    texts.set('d-links.md', '# Links\n\n[Missing](#does-not-exist)\n')
    renderReader()
    await screen.findByText('Missing')

    fireEvent.click(screen.getByRole('link', { name: 'Missing' }))
    await screen.findByText(t('nav.fragment.notFound'))
    expect(scrollCalls).toHaveLength(0)
    // A failed navigation records no history (INV-NH-02).
    const back = screen.getByRole('button', { name: t('toolbar.back') }) as HTMLButtonElement
    expect(back.disabled).toBe(true)
  })

  it('restores the committed position on startup, exactly and silently for the same version (AT19)', async () => {
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
    ]
    texts.set('d-a.md', '# 标题\n\n第一段\n\n第二段\n')
    positionRecords.set('d-a.md', {
      docId: 'd-a.md',
      anchor: {
        versionHash: 'v1',
        headingPath: [],
        blockFingerprint: 'fp1:unchanged',
        offsetRatio: 0,
        sourceRange: { startByte: 0, endByte: 1 },
      },
      updatedAtMs: 3,
    })
    renderReader()

    await screen.findByRole('heading', { level: 1, name: '标题' })
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_position', { docId: 'd-a.md' }))
    await waitFor(() =>
      expect(scrollCalls.some((element) => element.getAttribute('data-block-id') === 'b1')).toBe(
        true,
      ),
    )
    // Same-version restarts are silent (models §6.3): no fabricated label.
    expect(screen.queryByText(t('nav.return.approx'))).toBeNull()
    expect(screen.queryByText(t('nav.return.exact'))).toBeNull()
  })

  it('labels a cross-version position restore honestly as approximate (AT19)', async () => {
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
    ]
    texts.set('d-a.md', '# 标题\n\n第一段\n')
    positionRecords.set('d-a.md', {
      docId: 'd-a.md',
      anchor: {
        versionHash: 'v-old',
        headingPath: ['已删除的章节'],
        blockFingerprint: 'fp1:deleted-section',
        offsetRatio: 0.5,
        sourceRange: { startByte: 40, endByte: 60 },
      },
      updatedAtMs: 3,
    })
    renderReader()

    await screen.findByRole('heading', { level: 1, name: '标题' })
    await screen.findByText(t('nav.return.approx'))
  })

  it('scrolls to the trusted heading on a cross-version heading fallback (D-34b-1/AT19)', async () => {
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
    ]
    texts.set('d-a.md', '# 标题\n\n改写后的段落\n')
    positionRecords.set('d-a.md', {
      docId: 'd-a.md',
      anchor: {
        versionHash: 'v-old',
        headingPath: ['标题'],
        blockFingerprint: 'fp1:changed-paragraph',
        offsetRatio: 0.5,
        sourceRange: { startByte: 40, endByte: 60 },
      },
      updatedAtMs: 3,
    })
    renderReader()

    await screen.findByRole('heading', { level: 1, name: '标题' })
    // The heading block is the approximate landing point: it must be scrolled
    // into view and labeled — never silently left at the top (INV-AR-04).
    await screen.findByText(t('nav.return.approx'))
    await waitFor(() =>
      expect(scrollCalls.some((element) => element.getAttribute('data-block-id') === 'b1')).toBe(
        true,
      ),
    )
  })

  it('falls back to the nearest trusted ancestor heading with the approximate label (D-34b-1/AT19)', async () => {
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
    ]
    texts.set('d-a.md', '# 章节\n\n更新后的正文\n')
    positionRecords.set('d-a.md', {
      docId: 'd-a.md',
      anchor: {
        versionHash: 'v-old',
        headingPath: ['章节', '已消失的小节'],
        blockFingerprint: 'fp1:changed-section',
        offsetRatio: 0.25,
        sourceRange: { startByte: 40, endByte: 60 },
      },
      updatedAtMs: 3,
    })
    renderReader()

    await screen.findByRole('heading', { level: 1, name: '章节' })
    await screen.findByText(t('nav.return.approx'))
    await waitFor(() =>
      expect(scrollCalls.some((element) => element.getAttribute('data-block-id') === 'b1')).toBe(
        true,
      ),
    )
  })

  it('applies a restored position when its background tab is activated (AT19)', async () => {
    sessionSnapshot = {
      tabs: [
        { tabId: 'tab-old-1', docId: 'd-a.md', orderIndex: 0, isActive: true },
        { tabId: 'tab-old-2', docId: 'd-b.md', orderIndex: 1, isActive: false },
      ],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-a.md',
        displayName: 'a.md',
        canonicalPath: '/docs/a.md',
        openedAtMs: 1,
        available: true,
      },
      {
        docId: 'd-b.md',
        displayName: 'b.md',
        canonicalPath: '/docs/b.md',
        openedAtMs: 2,
        available: true,
      },
    ]
    positionRecords.set('d-b.md', {
      docId: 'd-b.md',
      anchor: {
        versionHash: 'v-old',
        headingPath: ['Gone'],
        blockFingerprint: 'fp1:gone',
        offsetRatio: 0,
        sourceRange: { startByte: 9, endByte: 20 },
      },
      updatedAtMs: 3,
    })
    renderReader()

    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('load_position', { docId: 'd-b.md' }),
    )
    // Background tabs are never scrolled or labeled before activation.
    expect(screen.queryByText(t('nav.return.approx'))).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /b\.md/ }))
    await screen.findByText(t('nav.return.approx'))
  })

  it('marks a startup-unavailable restored source and retries its open (AT06/AT07)', async () => {
    sessionSnapshot = {
      tabs: [{ tabId: 'tab-old-1', docId: 'd-gone.md', orderIndex: 0, isActive: true }],
      activeTabId: 'tab-old-1',
      savedAtMs: 1,
    }
    recentsResult = [
      {
        docId: 'd-gone.md',
        displayName: 'gone.md',
        canonicalPath: '/docs/gone.md',
        openedAtMs: 1,
        available: false,
      },
    ]
    renderReader()

    // The tab is restored as unavailable without a read; retry re-runs the
    // open validation against the known path (models §10).
    await screen.findByText(
      UNAVAILABLE_BANNER,
    )
    expect(
      invokeMock.mock.calls.some(
        ([command, args]) =>
          command === 'read_document' &&
          (args as { req?: { docId?: string } } | undefined)?.req?.docId === 'd-gone.md',
      ),
    ).toBe(false)

    fireEvent.click(screen.getAllByRole('button', { name: t('common.retry') })[0] as HTMLElement)
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('open_documents', {
        req: { paths: ['/docs/gone.md'], entry: 'restore' },
      }),
    )
  })
})
