import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { AppStoreProvider } from '../../app/store'
import { t } from '../../app/i18n'
import type { DocumentSnapshot, GlobalSettings, OpenRequest } from '../../services/types'
import ReaderScreen from '../reader/ReaderScreen'

/**
 * Syntax settings integration (ui-spec §3.7; R08): changing the syntax mode
 * or the current-document inline-dollar switch re-renders the displayed
 * version in place. `read_document` must not run again — no disk reload.
 */

const TEXT = '# 标题\n\n行内 $x^2$ 公式\n\n结束\n'

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

const SNAPSHOT: DocumentSnapshot = {
  docId: 'd-a.md',
  identity: {
    docId: 'd-a.md',
    canonicalPath: '/docs/a.md',
    displayName: 'a.md',
    format: 'markdown',
    encoding: 'utf-8',
    contentHash: 'v1',
    sizeBytes: TEXT.length,
    lastSeenAtMs: 1,
  },
  version: { contentHash: 'v1', sizeBytes: TEXT.length, modifiedAtMs: 1, observedAtMs: 2 },
  text: TEXT,
  lineCount: 5,
}

beforeEach(() => {
  pendingRequests = [{ paths: ['/docs/a.md'], cwd: null, source: 'cli' }]
  invokeMock.mockReset()
  invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
    switch (command) {
      case 'take_pending_open_requests':
        return Promise.resolve(pendingRequests)
      case 'list_recents':
        return Promise.resolve([])
      case 'get_settings':
        return Promise.resolve({
          global: DEFAULTS,
          defaults: DEFAULTS,
          limits: { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 },
          revision: 1,
        })
      case 'update_settings': {
        const patch = ((args?.req ?? {}) as { patch: Partial<GlobalSettings> }).patch
        return Promise.resolve({
          applied: { ...DEFAULTS, ...patch },
          persisted: true,
          revision: 2,
        })
      }
      case 'open_documents':
        return Promise.resolve({
          items: [
            {
              path: '/docs/a.md',
              status: 'opened',
              docId: 'd-a.md',
              identity: SNAPSHOT.identity,
            },
          ],
        })
      case 'read_document':
        return Promise.resolve(SNAPSHOT)
      default:
        return Promise.resolve(undefined)
    }
  })
})

describe('syntax re-render without disk reload', () => {
  it('opens with Ctrl+,, toggles inline dollars in place and keeps read_document at one call', async () => {
    render(
      <AppStoreProvider>
        <ReaderScreen />
      </AppStoreProvider>,
    )
    await screen.findByRole('heading', { level: 1, name: '标题' })
    expect(document.querySelector('.katex')).toBeTruthy()
    const readsBefore = invokeMock.mock.calls.filter(
      ([command]) => command === 'read_document',
    ).length
    expect(readsBefore).toBe(1)

    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    const dialog = await screen.findByRole('dialog', { name: t('settings.title') })
    fireEvent.click(within(dialog).getByRole('button', { name: t('settings.category.syntax') }))

    const inlineToggle = within(dialog).getByRole('checkbox', {
      name: t('settings.syntax.inlineDollar'),
    })
    fireEvent.click(inlineToggle)

    await waitFor(() => expect(document.querySelector('.katex')).toBeNull())
    expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain('$x^2$')

    // Changing the global syntax mode re-renders too, still from memory.
    fireEvent.click(within(dialog).getByRole('radio', { name: t('settings.syntax.standard') }))
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('update_settings', {
        req: { patch: { syntaxMode: 'standard' } },
      }),
    )
    const readsAfter = invokeMock.mock.calls.filter(
      ([command]) => command === 'read_document',
    ).length
    expect(readsAfter).toBe(1)
    expect(document.querySelector('.katex')).toBeNull()
  })
})
