import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { t } from '../../app/i18n'
import type {
  AccessDecision,
  DocIdentity,
  DocumentSnapshot,
  ErrorPayload,
  GlobalSettings,
  OpenRequest,
} from '../../services/types'

/**
 * Reader smoke tests (ui-spec §3.2; handoff wp-19 "reader smoke component
 * tests: empty/loading/ready/error, tab order rules, event bridge"). Tauri is
 * mocked at the lowest transport level; the parse pipeline runs in-process
 * (no Worker in jsdom) exactly like the production fallback.
 */

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
    render(<ReaderScreen />)
    await screen.findByRole('heading', { level: 1, name: t('app.name') })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('renders a document with formulas, local formula fallback and image placeholder', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    texts.set(
      'd-a.md',
      '# 标题\n\n行内 $x^2$。\n\n坏公式 $\\undefinedmacro{x}$\n\n![缺失](missing.png)\n',
    )
    checkAccess = { status: 'missing', kind: 'local' }

    render(<ReaderScreen />)
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

    render(<ReaderScreen />)
    await screen.findByText(t('error.io.readFailed'))
    expect(screen.getByText('PS_IO_READ_FAILED')).toBeTruthy()
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeTruthy()
  })

  it('opens both documents, shows the tab bar and closes in order with Ctrl+W', async () => {
    pendingRequests = [{ paths: ['/docs/a.md', '/docs/b.md'], cwd: null, source: 'cli' }]
    render(<ReaderScreen />)
    await screen.findByRole('heading', { level: 1, name: 'a.md' })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await screen.findByRole('heading', { level: 1, name: 'b.md' })
    // Tab bar hides again below two tabs (INV-TL-08).
    expect(screen.queryAllByRole('tab')).toHaveLength(0)

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    await screen.findByRole('heading', { level: 1, name: t('app.name') })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('records a pending version from watch-changed as a keep-mode banner only', async () => {
    pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
    render(<ReaderScreen />)
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
    render(<ReaderScreen />)
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
    render(<ReaderScreen />)
    await screen.findByRole('heading', { level: 1, name: t('app.name') })
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
    render(<ReaderScreen />)
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

    render(<ReaderScreen />)
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
})
