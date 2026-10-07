import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppStoreProvider } from '../../../app/store'
import { t } from '../../../app/i18n'
import type { ErrorPayload, RecentEntry } from '../../../services/types'
import { RECENT_FIRST_SCREEN, shortestDistinguishingParents } from './format'
import { WelcomePage } from './WelcomePage'

/**
 * Welcome page / recents (ui-spec §3.1; T-39): first-screen budget, row
 * content, unavailable relink, removal, empty sample and the honest storage
 * degradation (NF08).
 */

const NOW = 1_700_000_000_000

function entry(overrides: Partial<RecentEntry> & { docId: string }): RecentEntry {
  return {
    displayName: `${overrides.docId}.md`,
    canonicalPath: `/docs/${overrides.docId}/${overrides.docId}.md`,
    openedAtMs: NOW,
    available: true,
    ...overrides,
  }
}

function renderWelcome(props: Partial<Parameters<typeof WelcomePage>[0]> = {}, entries: RecentEntry[] = []) {
  const listRecents = vi.fn(async () => entries)
  render(
    <AppStoreProvider>
      <WelcomePage
        onOpenFile={props.onOpenFile ?? (() => undefined)}
        onOpenDirectory={props.onOpenDirectory ?? (() => undefined)}
        onOpenRecent={props.onOpenRecent ?? (() => undefined)}
        onRelink={props.onRelink ?? (() => undefined)}
        onRemoveRecent={props.onRemoveRecent ?? (() => undefined)}
        now={props.now ?? NOW}
        deps={{ listRecents }}
      />
    </AppStoreProvider>,
  )
  return { listRecents }
}

describe('WelcomePage (ui-spec §3.1)', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('shows the title, open actions and the honest note', async () => {
    renderWelcome()
    expect(screen.getByRole('heading', { level: 1, name: t('welcome.title') })).toBeTruthy()
    expect(screen.getByText(t('welcome.note'))).toBeTruthy()
    expect(screen.getByRole('button', { name: t('welcome.openFile') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('welcome.openDirectory') })).toBeTruthy()
    await screen.findByText(t('welcome.builtinSample'))
  })

  it('routes the open buttons to the picker actions', async () => {
    const onOpenFile = vi.fn()
    const onOpenDirectory = vi.fn()
    renderWelcome({ onOpenFile, onOpenDirectory })
    fireEvent.click(screen.getByRole('button', { name: t('welcome.openFile') }))
    fireEvent.click(screen.getByRole('button', { name: t('welcome.openDirectory') }))
    expect(onOpenFile).toHaveBeenCalledTimes(1)
    expect(onOpenDirectory).toHaveBeenCalledTimes(1)
  })

  it('lists recents in service order, first screen of 6, with parent and relative time', async () => {
    const entries = Array.from({ length: 8 }, (_, index) =>
      entry({ docId: `d-${index}`, openedAtMs: NOW - index * 60_000 }),
    )
    renderWelcome({}, entries)
    await screen.findByRole('list', { name: t('aria.recentList') })

    const list = screen.getByRole('list', { name: t('aria.recentList') })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(8)
    expect(within(items[0]).getByText('d-0.md')).toBeTruthy()
    expect(within(items[1]).getByText('d-1.md')).toBeTruthy()
    // Scroll container carries the ≤6 first-screen budget marker.
    const scroll = list.parentElement
    expect(scroll?.getAttribute('data-first-screen')).toBe(String(RECENT_FIRST_SCREEN))
    // Unique names still show the shortest parent directory.
    expect(within(items[0]).getByText('d-0')).toBeTruthy()
    expect(within(items[0]).getByText(t('time.justNow'))).toBeTruthy()
    expect(within(items[2]).getByText(t('time.minutesAgo', { count: 2 }))).toBeTruthy()
  })

  it('marks unavailable files and opens the relink flow instead of dropping them', async () => {
    const onOpen = vi.fn()
    const onRelink = vi.fn()
    const unavailable = entry({ docId: 'd-gone', displayName: 'gone.md', available: false })
    renderWelcome({ onOpenRecent: onOpen, onRelink }, [unavailable])
    const row = await screen.findByRole('listitem')
    expect(within(row).getByText(t('welcome.recent.unavailable'))).toBeTruthy()
    fireEvent.click(within(row).getByText('gone.md'))
    expect(onRelink).toHaveBeenCalledWith(unavailable)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('removes only the list entry through the explicit, reachable action', async () => {
    const onRemoveRecent = vi.fn()
    renderWelcome({ onRemoveRecent }, [entry({ docId: 'd-a' })])
    const row = await screen.findByRole('listitem')
    fireEvent.click(
      within(row).getByRole('button', {
        name: t('welcome.recent.removeAria', { name: 'd-a.md' }),
      }),
    )
    expect(onRemoveRecent).toHaveBeenCalledWith('d-a')
  })

  it('falls back to the built-in sample card when there are no records', async () => {
    renderWelcome()
    await screen.findByText(t('welcome.builtinSample'))
    expect(screen.getByText(t('welcome.builtinSample.note'))).toBeTruthy()
    expect(screen.queryByRole('list', { name: t('aria.recentList') })).toBeNull()
  })

  it('degrades honestly when storage is unavailable and keeps opening possible', async () => {
    const storageError: ErrorPayload = {
      code: 'PS_STORAGE_UNAVAILABLE',
      category: 'storage',
      messageKey: 'error.storage.unavailable',
      retryable: true,
    }
    const listRecents = vi.fn(async () => {
      throw storageError
    })
    const onOpenFile = vi.fn()
    render(
      <AppStoreProvider>
        <WelcomePage
          onOpenFile={onOpenFile}
          onOpenDirectory={() => undefined}
          onOpenRecent={() => undefined}
          onRelink={() => undefined}
          onRemoveRecent={() => undefined}
          deps={{ listRecents }}
        />
      </AppStoreProvider>,
    )
    await screen.findByText(t('error.storage.unavailable'))
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: t('welcome.openFile') }))
    expect(onOpenFile).toHaveBeenCalledTimes(1)

    // Retry re-runs the list load without changing the page state away.
    fireEvent.click(screen.getByRole('button', { name: t('common.retry') }))
    await waitFor(() => expect(listRecents).toHaveBeenCalledTimes(2))
  })
})

describe('recent formatting helpers', () => {
  it('extends the parent only while same-named entries collide', () => {
    const parents = shortestDistinguishingParents([
      entry({ docId: 'd-1', displayName: 'readme.md', canonicalPath: '/home/u/alpha/readme.md' }),
      entry({ docId: 'd-2', displayName: 'readme.md', canonicalPath: '/home/u/beta/readme.md' }),
      entry({ docId: 'd-3', displayName: 'notes.md', canonicalPath: '/home/u/docs/notes.md' }),
    ])
    expect(parents.get('d-1')).toBe('alpha')
    expect(parents.get('d-2')).toBe('beta')
    expect(parents.get('d-3')).toBe('docs')
  })

  it('extends through identical immediate parents', () => {
    const parents = shortestDistinguishingParents([
      entry({ docId: 'd-1', displayName: 'readme.md', canonicalPath: '/a/one/readme.md' }),
      entry({ docId: 'd-2', displayName: 'readme.md', canonicalPath: '/b/one/readme.md' }),
    ])
    expect(parents.get('d-1')).toBe('a/one')
    expect(parents.get('d-2')).toBe('b/one')
  })
})
