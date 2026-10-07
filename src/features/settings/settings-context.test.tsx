import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { GlobalSettings, SettingsBundle, UpdateSettingsResult } from '../../services/types'
import { DEFAULT_GLOBAL_SETTINGS } from './settings-model'
import { SettingsProvider, useSettings } from './settings-context'

/**
 * Settings host semantics (ui-spec §3.7; R23): instant preview is separate
 * from persistence, a failed save keeps the applied value and retries the
 * remaining delta, and "恢复显示默认" only resets display fields.
 */

const LIMITS = { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 }

function bundle(global: Partial<GlobalSettings> = {}, revision = 1): SettingsBundle {
  return {
    global: { ...DEFAULT_GLOBAL_SETTINGS, ...global },
    defaults: DEFAULT_GLOBAL_SETTINGS,
    limits: LIMITS,
    revision,
  }
}

function Consumer() {
  const { settings, saveState, update, retrySave, resetDisplayDefaults } = useSettings()
  return (
    <div>
      <span data-testid="state">{saveState}</span>
      <span data-testid="size">{settings.fontSizePx}</span>
      <span data-testid="restore">{String(settings.restoreSession)}</span>
      <span data-testid="remember">{String(settings.rememberRecords)}</span>
      <button type="button" onClick={() => void update({ fontSizePx: 20 })}>
        update-size
      </button>
      <button type="button" onClick={() => void update({ rememberRecords: false })}>
        update-remember
      </button>
      <button type="button" onClick={() => void retrySave()}>
        retry
      </button>
      <button type="button" onClick={() => void resetDisplayDefaults()}>
        reset
      </button>
    </div>
  )
}

describe('SettingsProvider', () => {
  it('previews instantly and reports applied vs persisted on a failed save, then retries', async () => {
    const updateSettings = vi
      .fn<(patch: Partial<GlobalSettings>) => Promise<UpdateSettingsResult>>()
      .mockResolvedValueOnce({
        applied: { ...DEFAULT_GLOBAL_SETTINGS, fontSizePx: 20 },
        persisted: false,
        revision: 2,
        error: {
          code: 'PS_IO_WRITE_FAILED',
          category: 'io',
          messageKey: 'error.io.writeFailed',
          retryable: true,
        },
      })
      .mockResolvedValueOnce({
        applied: { ...DEFAULT_GLOBAL_SETTINGS, fontSizePx: 20 },
        persisted: true,
        revision: 3,
      })
    const deps = {
      getSettings: vi.fn().mockResolvedValue(bundle()),
      updateSettings,
    }
    render(
      <SettingsProvider deps={deps}>
        <Consumer />
      </SettingsProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('17'))

    fireEvent.click(screen.getByRole('button', { name: 'update-size' }))
    // Instant preview: the value is applied before (and despite) persistence.
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('20'))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('failed'))
    expect(document.documentElement.style.getPropertyValue('--ps-body-size')).toBe('20px')

    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('idle'))
    expect(updateSettings).toHaveBeenLastCalledWith({ fontSizePx: 20 })
  })

  it('keeps the applied value when the command rejects and retries the full delta', async () => {
    const updateSettings = vi
      .fn<(patch: Partial<GlobalSettings>) => Promise<UpdateSettingsResult>>()
      .mockRejectedValueOnce({
        code: 'PS_IO_WRITE_FAILED',
        category: 'io',
        messageKey: 'error.io.writeFailed',
        retryable: true,
      })
      .mockResolvedValueOnce({
        applied: { ...DEFAULT_GLOBAL_SETTINGS, fontSizePx: 21 },
        persisted: true,
        revision: 4,
      })
    render(
      <SettingsProvider deps={{ getSettings: vi.fn().mockResolvedValue(bundle()), updateSettings }}>
        <Consumer />
      </SettingsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'update-size' }))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('failed'))
    expect(screen.getByTestId('size').textContent).toBe('20')

    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('idle'))
    expect(updateSettings).toHaveBeenLastCalledWith({ fontSizePx: 20 })
  })

  it('reset display defaults patches only display fields and leaves records/preferences alone', async () => {
    const updateSettings = vi
      .fn<(patch: Partial<GlobalSettings>) => Promise<UpdateSettingsResult>>()
      .mockImplementation((patch) =>
        Promise.resolve({
          applied: { ...DEFAULT_GLOBAL_SETTINGS, restoreSession: false, ...patch },
          persisted: true,
          revision: 2,
        }),
      )
    render(
      <SettingsProvider
        deps={{
          getSettings: vi.fn().mockResolvedValue(bundle({ fontSizePx: 22, restoreSession: false })),
          updateSettings,
        }}
      >
        <Consumer />
      </SettingsProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('22'))

    fireEvent.click(screen.getByRole('button', { name: 'reset' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith({
      fontSizePx: 17,
      lineHeight: 1.8,
      maxContentWidthPx: 760,
      theme: 'system',
    })
    await waitFor(() => expect(screen.getByTestId('size').textContent).toBe('17'))
    expect(screen.getByTestId('restore').textContent).toBe('false')
  })

  it('persists rememberRecords independently from clearing', async () => {
    const updateSettings = vi
      .fn<(patch: Partial<GlobalSettings>) => Promise<UpdateSettingsResult>>()
      .mockImplementation((patch) =>
        Promise.resolve({
          applied: { ...DEFAULT_GLOBAL_SETTINGS, ...patch },
          persisted: true,
          revision: 2,
        }),
      )
    render(
      <SettingsProvider deps={{ getSettings: vi.fn().mockResolvedValue(bundle()), updateSettings }}>
        <Consumer />
      </SettingsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'update-remember' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ rememberRecords: false }))
    await waitFor(() => expect(screen.getByTestId('remember').textContent).toBe('false'))
  })
})
