import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../app/i18n'
import { AppStoreProvider } from '../../app/store'
import { isWriteBackSuppressed, resetWriteSuppression } from '../../app/write-suppression'
import type {
  ClearResult,
  GlobalSettings,
  GrantRecord,
  StorageOverview,
  UpdateSettingsResult,
} from '../../services/types'
import { DEFAULT_GLOBAL_SETTINGS } from './settings-model'
import { SettingsProvider, type SettingsServiceDeps } from './settings-context'
import { PrivacySection } from './sections/PrivacySection'

/**
 * Privacy section (ui-spec §3.8; R25/R27): counts and sizes, selection that
 * starts empty, per-category clear results with partial failures exposed,
 * post-clear write-back suppression and the persistent-grant revoke flow.
 */

const OVERVIEW: StorageOverview = {
  categories: [
    { category: 'recents', count: 5 },
    { category: 'positions', count: 2 },
    { category: 'session', count: 3 },
    { category: 'cache', count: 1, bytes: 1024 },
    { category: 'authorizations', count: 1 },
    { category: 'logs', count: 0, bytes: 512 },
  ],
  databasePath: '/data/db.sqlite',
  cacheDir: '/data/cache',
}

const GRANT: GrantRecord = {
  grantId: 'g1',
  kind: 'directory',
  scope: 'persistent',
  canonicalPath: '/root/assets',
  grantedAtMs: 1,
}

function settingsDeps(): SettingsServiceDeps {
  return {
    getSettings: vi.fn<SettingsServiceDeps['getSettings']>().mockResolvedValue({
      global: DEFAULT_GLOBAL_SETTINGS,
      defaults: DEFAULT_GLOBAL_SETTINGS,
      limits: { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 },
      revision: 1,
    }),
    updateSettings: vi.fn((patch: Partial<GlobalSettings>): Promise<UpdateSettingsResult> =>
      Promise.resolve({
        applied: { ...DEFAULT_GLOBAL_SETTINGS, ...patch },
        persisted: true,
        revision: 2,
      }),
    ),
  }
}

function renderPrivacy() {
  const deps = settingsDeps()
  render(
    <AppStoreProvider>
      <SettingsProvider deps={deps}>
        <PrivacySection />
      </SettingsProvider>
    </AppStoreProvider>,
  )
  return deps
}

beforeEach(() => {
  resetWriteSuppression()
  invokeMock.mockReset()
  invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
    switch (command) {
      case 'get_storage_overview':
        return Promise.resolve(OVERVIEW)
      case 'list_grants':
        return Promise.resolve([GRANT])
      case 'revoke_grant':
        return Promise.resolve({ revoked: true, cancelledRequests: 1, removedCacheEntries: 0 })
      case 'clear_records': {
        const categories = ((args?.req ?? {}) as { categories: string[] }).categories
        const results: ClearResult[] = categories.map((category) => ({
          category: category as ClearResult['category'],
          cleared: 1,
        }))
        return Promise.resolve(results)
      }
      default:
        return Promise.resolve(undefined)
    }
  })
})

describe('PrivacySection', () => {
  it('shows per-category counts/sizes, the log budget and persistent grants', async () => {
    renderPrivacy()
    await screen.findByText(t('settings.privacy.logsUsage', { size: '512 B', max: '10 MiB' }))
    expect(screen.getByText(t('storage.category.recents'))).toBeTruthy()
    expect(screen.getByText(t('storage.category.positionsSession'))).toBeTruthy()
    expect(screen.getAllByText(/5 项/).length).toBeGreaterThan(0)
    await screen.findByText('/root/assets')
  })

  it('keeps 记住阅读记录 independent from clearing', async () => {
    const deps = renderPrivacy()
    const toggle = await screen.findByRole('checkbox', { name: t('settings.privacy.remember') })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(deps.updateSettings).toHaveBeenCalledWith({ rememberRecords: false }),
    )
    expect(invokeMock).not.toHaveBeenCalledWith('clear_records', expect.anything())
  })

  it('starts with no selection and names the action once a category is chosen', async () => {
    renderPrivacy()
    const clearButton = await screen.findByRole('button', { name: t('settings.privacy.clear') })
    // The product disables the action until the storage overview is loaded
    // (overview === null). Wait for enabled so the click cannot land on a
    // disabled button under full-suite load (F-32-4).
    await waitFor(() => expect((clearButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(clearButton)
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', {
      name: t('dialog.clear.action.generic'),
    })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /最近阅读/ }))
    const named = within(dialog).getByRole('button', {
      name: t('dialog.clear.action.recents', { count: 5 }),
    })
    expect((named as HTMLButtonElement).disabled).toBe(false)
  })

  it('reports partial failures per category and never claims full success', async () => {
    invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === 'get_storage_overview') return Promise.resolve(OVERVIEW)
      if (command === 'list_grants') return Promise.resolve([])
      if (command === 'clear_records') {
        const categories = ((args?.req ?? {}) as { categories: string[] }).categories
        // Reject the session half of the merged row to force a partial result.
        return Promise.resolve(
          categories.map((category): ClearResult =>
            category === 'session'
              ? {
                  category: 'session',
                  cleared: 0,
                  error: {
                    code: 'PS_DB_FAILURE',
                    category: 'storage',
                    messageKey: 'error.storage.dbFailure',
                    retryable: true,
                  },
                }
              : { category: category as ClearResult['category'], cleared: 2 },
          ),
        )
      }
      return Promise.resolve(undefined)
    })
    renderPrivacy()
    const clearButton = await screen.findByRole('button', { name: t('settings.privacy.clear') })
    // The product disables the action until the storage overview is loaded
    // (overview === null). Wait for enabled so the click cannot land on a
    // disabled button under full-suite load (F-32-4).
    await waitFor(() => expect((clearButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(clearButton)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /位置与会话/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: t('dialog.clear.action.generic') }))

    await within(dialog).findByText(t('dialog.clear.result.partial'))
    expect(within(dialog).getByText(t('error.storage.dbFailure'))).toBeTruthy()
    expect(within(dialog).queryByText(t('dialog.clear.result.done'))).toBeNull()
  })

  it('suppresses cleared write-back categories and refreshes the overview', async () => {
    renderPrivacy()
    const clearButton = await screen.findByRole('button', { name: t('settings.privacy.clear') })
    // The product disables the action until the storage overview is loaded
    // (overview === null). Wait for enabled so the click cannot land on a
    // disabled button under full-suite load (F-32-4).
    await waitFor(() => expect((clearButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(clearButton)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /最近阅读/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /位置与会话/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: t('dialog.clear.action.generic') }))

    await within(dialog).findByText(t('dialog.clear.result.done'))
    expect(isWriteBackSuppressed('recents')).toBe(true)
    expect(isWriteBackSuppressed('positions')).toBe(true)
    expect(isWriteBackSuppressed('session')).toBe(true)
    // No implicit resume and no rewrite-back command: records stay cleared
    // until an explicit reopen or resume_recording (models §9.1).
    expect(invokeMock).not.toHaveBeenCalledWith('resume_recording', expect.anything())
    expect(invokeMock).not.toHaveBeenCalledWith('save_session', expect.anything())
    expect(
      invokeMock.mock.calls.filter(([command]) => command === 'get_storage_overview'),
    ).toHaveLength(2)
  })

  it('revokes a persistent grant immediately and keeps loaded content untouched', async () => {
    renderPrivacy()
    await screen.findByText('/root/assets')
    fireEvent.click(screen.getByRole('button', { name: t('settings.privacy.revoke') }))

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('revoke_grant', { grantId: 'g1' }))
    await waitFor(() => expect(screen.queryByText('/root/assets')).toBeNull())
    expect(screen.getByText(t('error.auth.revoked'))).toBeTruthy()
  })
})
