import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../app/i18n'
import type { GlobalSettings, SettingsBundle, UpdateSettingsResult } from '../../services/types'
import { DEFAULT_GLOBAL_SETTINGS } from './settings-model'
import { SettingsProvider, type SettingsServiceDeps } from './settings-context'
import { TypographyPopover } from './TypographyPopover'

/**
 * Aa popover (ui-spec §3.7; IXD §13.1): instant preview, range enforcement
 * that keeps the last valid value, theme switching and reset defaults —
 * without jumping the reading position.
 */

function bundle(global: Partial<GlobalSettings> = {}): SettingsBundle {
  return {
    global: { ...DEFAULT_GLOBAL_SETTINGS, ...global },
    defaults: DEFAULT_GLOBAL_SETTINGS,
    limits: { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 },
    revision: 1,
  }
}

function defaultDeps(
  updateSettings: SettingsServiceDeps['updateSettings'],
  global: Partial<GlobalSettings> = {},
): SettingsServiceDeps {
  return { getSettings: vi.fn().mockResolvedValue(bundle(global)), updateSettings }
}

function Harness({ deps }: { deps: SettingsServiceDeps }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(true)
  return (
    <SettingsProvider deps={deps}>
      <button ref={anchor} type="button">
        anchor
      </button>
      <div data-testid="reading-position">current reading content</div>
      {open ? <TypographyPopover anchor={anchor} onClose={() => setOpen(false)} /> : null}
    </SettingsProvider>
  )
}

const persistOk =
  (revision = 2): SettingsServiceDeps['updateSettings'] =>
  (patch) =>
    Promise.resolve<UpdateSettingsResult>({
      applied: { ...DEFAULT_GLOBAL_SETTINGS, ...patch },
      persisted: true,
      revision,
    })

describe('TypographyPopover', () => {
  it('keeps the last valid value and explains an out-of-range entry', async () => {
    const updateSettings = vi.fn(persistOk())
    render(<Harness deps={defaultDeps(updateSettings)} />)
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--ps-body-size')).toBe('17px'),
    )

    const input = screen.getByLabelText(t('settings.reading.fontSize'))
    fireEvent.change(input, { target: { value: '30' } })

    expect(screen.getByText(t('settings.reading.invalidValue'))).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.documentElement.style.getPropertyValue('--ps-body-size')).toBe('17px')
    expect(updateSettings).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '20' } })
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--ps-body-size')).toBe('20px'),
    )
    expect(updateSettings).toHaveBeenCalledWith({ fontSizePx: 20 })
    expect(screen.queryByText(t('settings.reading.invalidValue'))).toBeNull()
  })

  it('previews without remounting the reading position and keeps focus in the field', async () => {
    render(<Harness deps={defaultDeps(persistOk())} />)
    const probe = screen.getByTestId('reading-position')
    const input = screen.getByLabelText(t('settings.reading.fontSize'))
    input.focus()

    fireEvent.change(input, { target: { value: '19' } })
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--ps-body-size')).toBe('19px'),
    )
    expect(screen.getByTestId('reading-position')).toBe(probe)
    expect(document.activeElement).toBe(input)
  })

  it('switches theme instantly and persists the change', async () => {
    const updateSettings = vi.fn(persistOk())
    render(<Harness deps={defaultDeps(updateSettings)} />)
    fireEvent.click(screen.getByRole('radio', { name: t('settings.reading.theme.dark') }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' })
  })

  it('resets only the display fields through 恢复显示默认', async () => {
    const updateSettings = vi.fn(persistOk())
    render(
      <Harness
        deps={defaultDeps(updateSettings, { fontSizePx: 22, updateModeDefault: 'follow' })}
      />,
    )
    await waitFor(() => expect(screen.getByLabelText(t('settings.reading.fontSize'))).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: t('settings.reading.restoreDefaults') }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith({
      fontSizePx: 17,
      lineHeight: 1.8,
      maxContentWidthPx: 760,
      theme: 'system',
    })
  })
})
