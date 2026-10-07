import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => undefined)),
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: () => Promise.resolve(() => undefined),
    onCloseRequested: () => Promise.resolve(() => undefined),
    onDragDropEvent: () => Promise.resolve(() => undefined),
  }),
}))

import ReaderScreen from '../../features/reader/ReaderScreen'
import { documentModelCache } from '../../app/session'
import { AppStoreProvider } from '../../app/store'
import { t } from '../../app/i18n'
import { resetSearchSessionsForTests } from './use-search-session'
import type {
  DocIdentity,
  DocumentSnapshot,
  OpenRequest,
} from '../../services/types'

/**
 * Search + navigation-history integration (ui-spec §3.4; models §5; T-42..T-44;
 * INV-NH-01..08; R16/R17). The reader runs against the mocked Tauri transport
 * and the in-process parse pipeline, exactly like the wp-19 smoke tests:
 * Ctrl+F -> debounce -> `<mark>` -> locate, folded-code expansion, formula
 * source label, source scope, history merge/back/forward and cross-file links
 * in the current tab.
 */

function renderReader() {
  return render(
    <AppStoreProvider>
      <ReaderScreen />
    </AppStoreProvider>,
  )
}

const DEFAULTS = {
  theme: 'system',
  fontSizePx: 17,
  lineHeight: 1.8,
  maxContentWidthPx: 760,
  syntaxMode: 'technical',
  updateModeDefault: 'keep',
  restoreSession: true,
  rememberRecords: true,
} as const

let pendingRequests: OpenRequest[] = []
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

function snapshotFor(docId: string): DocumentSnapshot {
  const name = docId.slice(2)
  return {
    docId,
    identity: identityFor(`/docs/${name}`),
    version: { contentHash: 'v1', sizeBytes: 128, modifiedAtMs: 1, observedAtMs: 2 },
    text: texts.get(docId) ?? `# ${name}\n\nhello\n`,
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
            if (path.endsWith('rejected.md')) {
              return {
                path,
                status: 'rejected',
                error: {
                  code: 'PS_IO_NOT_FOUND',
                  category: 'io',
                  messageKey: 'error.io.notFound',
                  retryable: true,
                },
              }
            }
            const identity = identityFor(path)
            return { path, status: 'opened', docId: identity.docId, identity }
          }),
        })
      }
      case 'read_document': {
        const req = (args?.req ?? {}) as { docId: string }
        return Promise.resolve(snapshotFor(req.docId))
      }
      case 'watch_document':
      case 'unwatch_document':
      case 'save_session':
        return Promise.resolve(undefined)
      case 'list_recents':
        return Promise.resolve([])
      case 'pick_files':
      case 'pick_directory':
        return Promise.resolve({ cancelled: true, paths: [] })
      case 'check_resource_access':
        return Promise.resolve({ status: 'missing', kind: 'local' })
      default:
        return Promise.resolve(undefined)
    }
  })
}

async function openDoc(text: string, heading = '标题'): Promise<void> {
  pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
  texts.set('d-a.md', text)
  renderReader()
  await screen.findByRole('heading', { level: 1, name: heading })
}

async function openSearch(query: string, total: number): Promise<HTMLInputElement> {
  // Flush mount effects so the global Ctrl+F listener is registered before the
  // event is dispatched (the base suite had a rare lost-event flake here).
  await act(async () => {})
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
  const input = (await screen.findByRole('searchbox')) as HTMLInputElement
  fireEvent.change(input, { target: { value: query } })
  await screen.findByText(t('search.counter', { current: 0, total }))
  return input
}

function backButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: t('toolbar.back') }) as HTMLButtonElement
}

function forwardButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: t('toolbar.forward') }) as HTMLButtonElement
}

describe('in-page search integration (ui-spec §3.4; R17)', () => {
  beforeEach(() => {
    pendingRequests = []
    texts = new Map()
    documentModelCache.clear()
    resetSearchSessionsForTests()
    invokeMock.mockReset()
    installRouter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens with Ctrl+F, debounces, marks all hits and locates on Enter', async () => {
    await openDoc('# 标题\n\n第一段 match 内容\n\n第二段 match 结尾\n')
    const input = await openSearch('match', 2)

    const marks = document.querySelectorAll('mark.ps-search-mark')
    expect(marks).toHaveLength(2)

    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 1, total: 2 }))
    expect(backButton().disabled).toBe(false)
    const current = document.querySelector('mark[data-search-current="true"]')
    expect(current?.textContent).toBe('match')

    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 2, total: 2 }))
    expect(document.querySelectorAll('mark[data-search-current="true"]')).toHaveLength(1)
  })

  it('expands a folded code block before focusing a tail hit', async () => {
    const lines = Array.from({ length: 45 }, (_, index) =>
      index === 43 ? 'tail-token here' : `line ${index + 1}`,
    )
    await openDoc(`# 标题\n\n\`\`\`text\n${lines.join('\n')}\n\`\`\`\n`)
    expect(document.querySelector('.ps-code-collapsed')).toBeTruthy()

    const input = await openSearch('tail-token', 1)
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 1, total: 1 }))
    await waitFor(() => expect(document.querySelector('.ps-code-collapsed')).toBeNull())
    expect(document.querySelector('.ps-code-expand')).toBeNull()
  })

  it('labels formula-source hits and offers the inspect entry', async () => {
    await openDoc('# 标题\n\n$$\na^2 + b^2\n$$\n')
    const input = await openSearch('a^2', 1)
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 1, total: 1 }))
    expect(screen.getAllByText(t('search.formulaMatch')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: t('search.formulaMatch.inspect') }))
    const drawer = await screen.findByRole('complementary', { name: t('inspect.aria') })
    expect(drawer.querySelector('.ps-inspect-source')?.textContent).toBe('a^2 + b^2')
  })

  it('locates an image-alt hit inside its block', async () => {
    await openDoc('# 标题\n\n![唯一替代文本](missing.png)\n')
    await screen.findByText(t('image.missing'))

    const input = await openSearch('唯一替代文本', 1)
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 1, total: 1 }))
    await waitFor(() => {
      const active = document.activeElement as HTMLElement | null
      expect(active?.getAttribute('data-block-id')).toBeTruthy()
    })
  })

  it('source scope finds sanitized-away content and opens the source view', async () => {
    await openDoc('# 标题\n\n<div><script>hidden-secret()</script>visible</div>\n')
    const input = await openSearch('hidden-secret', 0)
    await screen.findByText(new RegExp(t('search.noResults')))

    fireEvent.click(screen.getByRole('button', { name: t('search.scope.source') }))
    await screen.findByText(t('search.counter', { current: 0, total: 1 }))
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByRole('heading', { name: t('source.title') })
    expect(document.querySelector('.ps-source-pre')?.textContent).toContain('hidden-secret')
  })

  it('merges the whole search session into one history entry; Esc keeps it', async () => {
    await openDoc('# 标题\n\n第一段 match 一\n\n第二段 match 二\n')
    const input = await openSearch('match', 2)
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 2, total: 2 }))

    // Esc closes the bar but the session entry remains for Alt+←.
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('search', { name: t('search.aria') })).toBeNull(),
    )
    expect(backButton().disabled).toBe(false)

    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true })
    await screen.findByText(t('nav.return.exact'))
    // Exactly one entry: after a single back there is nothing left to go back
    // to, and forward returns to the last hit of the session.
    expect(backButton().disabled).toBe(true)
    expect(forwardButton().disabled).toBe(false)

    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    await waitFor(() => expect(backButton().disabled).toBe(false))
  })

  it('consumes no history when the query has no results', async () => {
    await openDoc('# 标题\n\n普通内容\n')
    const input = await openSearch('zzz', 0)
    await screen.findByText(new RegExp(t('search.noResults')))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(backButton().disabled).toBe(true)
    expect(forwardButton().disabled).toBe(true)
  })

  it('records an outline navigation and restores it with the exact message', async () => {
    await openDoc('# One\n\ntext\n\n## Two\n\nmore\n', 'One')
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    const nav = await screen.findByRole('complementary', { name: t('nav.aria') })
    fireEvent.click(within(nav).getByRole('treeitem', { name: 'Two' }))

    await waitFor(() => expect(backButton().disabled).toBe(false))
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true })
    await screen.findByText(t('nav.return.exact'))
    expect(backButton().disabled).toBe(true)
    expect(forwardButton().disabled).toBe(false)
  })

  it('navigates a cross-file link in the current tab and back returns', async () => {
    await openDoc('# A\n\n[去 B](b.md)\n', 'A')
    texts.set('d-b.md', '# B\n\n内容\n')

    fireEvent.click(screen.getByRole('link', { name: '去 B' }))
    await screen.findByRole('heading', { level: 1, name: 'B' })
    // Current-tab navigation: the tab bar stays hidden (single tab).
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(backButton().disabled).toBe(false)

    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true })
    await screen.findByRole('heading', { level: 1, name: 'A' })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(forwardButton().disabled).toBe(false)
  })

  it('consumes no history when a cross-file link target is rejected', async () => {
    await openDoc('# A\n\n[坏](rejected.md)\n', 'A')
    fireEvent.click(screen.getByRole('link', { name: '坏' }))
    await screen.findByText(new RegExp(t('error.io.notFound')))
    expect(backButton().disabled).toBe(true)
    expect(forwardButton().disabled).toBe(true)
    expect(screen.getByRole('heading', { level: 1, name: 'A' })).toBeTruthy()
  })

  it('does not add history for the reading/source view toggle', async () => {
    await openDoc('# 标题\n\n正文\n')
    fireEvent.click(screen.getByRole('button', { name: t('toolbar.more') }))
    fireEvent.click(screen.getByRole('menuitem', { name: t('menu.viewSource') }))
    await screen.findByRole('heading', { name: t('source.title') })
    expect(backButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: t('source.back') }))
    await screen.findByRole('heading', { level: 1, name: '标题' })
    expect(backButton().disabled).toBe(true)
  })

  it('keeps history isolated per tab', async () => {
    pendingRequests = [{ paths: ['/docs/a.md', '/docs/b.md'], cwd: null, source: 'cli' }]
    texts.set('d-a.md', '# 标题\n\nmatch 内容\n')
    texts.set('d-b.md', '# b.md\n\nb 内容\n')
    renderReader()
    await screen.findByRole('heading', { level: 1, name: '标题' })

    const input = await openSearch('match', 1)
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText(t('search.counter', { current: 1, total: 1 }))
    expect(backButton().disabled).toBe(false)

    fireEvent.click(screen.getByRole('tab', { name: /b\.md/ }))
    await screen.findByRole('heading', { level: 1, name: 'b.md' })
    // Tab B has no search session and no history; A's query is not shown.
    expect(backButton().disabled).toBe(true)
    expect(screen.queryByRole('searchbox')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /a\.md/ }))
    await screen.findByRole('heading', { level: 1, name: '标题' })
    expect(backButton().disabled).toBe(false)
    const restored = screen.getByRole('searchbox') as HTMLInputElement
    expect(restored.value).toBe('match')
  })
})
