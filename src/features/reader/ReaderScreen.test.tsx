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
import type {
  AccessDecision,
  DirectoryNode,
  DocIdentity,
  DocumentSnapshot,
  ErrorPayload,
  GlobalSettings,
  OpenRequest,
  RecentEntry,
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

function identityFor(path: string): DocIdentity {
  const name = path.split('/').pop() ?? 'doc.md'
  return {
    docId: `d-${name}`,
    canonicalPath: path,
    displayName: name,
    format: 'markdown',
    encoding: 'utf-8',
    contentHash: 'v1',
    sizeBytes: 128,
    lastSeenAtMs: 1,
  }
}

function snapshotFor(docId: string, hash = 'v1'): DocumentSnapshot {
  const name = docId.slice(2)
  return {
    docId,
    identity: identityFor(`/docs/${name}`),
    version: { contentHash: hash, sizeBytes: 128, modifiedAtMs: 1, observedAtMs: 2 },
    text: texts.get(docId) ?? `# ${name}\n\nhello ${name}\n`,
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
          global: DEFAULTS,
          defaults: DEFAULTS,
          limits: { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 },
          revision: 0,
        })
      case 'open_documents': {
        const req = (args?.req ?? { paths: [] }) as { paths: string[] }
        return Promise.resolve({
          items: req.paths.map((path) => {
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
        return Promise.resolve({
          status: 'reassociated',
          snapshot: snapshotFor(req.docId),
        })
      }
      case 'get_source_info':
        return Promise.resolve({
          docId: 'd-a.md',
          version: { contentHash: 'v1', sizeBytes: 128, modifiedAtMs: 1, observedAtMs: 2 },
          encoding: 'utf-8',
          totalLines: 3,
        })
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
  listeners.clear()
  windowHandlers.focus = undefined
  windowHandlers.close = undefined
  windowHandlers.drag = undefined
  documentModelCache.clear()
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

  it('records a pending version from watch-changed as a keep-mode banner only', async () => {
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
    // Submitting an update belongs to wp-29; no fake action is offered.
    expect(screen.queryByText(t('update.action.now'))).toBeNull()
    expect(screen.getAllByText(t('update.badge')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: t('update.action.later') }))
    await waitFor(() => expect(screen.queryByText(t('update.banner'))).toBeNull())
    expect(screen.getAllByText(t('update.badge')).length).toBeGreaterThan(0)
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
})
