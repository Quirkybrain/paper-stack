import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../app/i18n'
import type {
  AppInfo,
  GlobalSettings,
  SettingsBundle,
  UpdateSettingsResult,
} from '../../services/types'
import type { CurrentDocumentSettings } from './current-document'
import { DEFAULT_GLOBAL_SETTINGS } from './settings-model'
import { SettingsProvider, type SettingsServiceDeps } from './settings-context'
import { SettingsDialog } from './SettingsDialog'

/**
 * Full settings dialog (ui-spec §3.7 UI06): five categories, applied vs
 * persisted save states with retry, display-only reset scope, modal focus
 * trap/Esc/focus return and the current-document syntax/update controls.
 */

const APP_INFO: AppInfo = {
  name: '纸栈 PaperStack',
  version: '0.1.0',
  owner: 'Quirkybrain',
  license: 'GPL-3.0-only',
  ipcContract: 'paperstack-ipc-r1',
  locale: 'zh-CN',
  legal: {
    sourceEntryUrl: null,
    licenseAvailable: false,
    thirdPartyAvailable: false,
  },
}

function bundle(global: Partial<GlobalSettings> = {}): SettingsBundle {
  return {
    global: { ...DEFAULT_GLOBAL_SETTINGS, ...global },
    defaults: DEFAULT_GLOBAL_SETTINGS,
    limits: { recentLimit: 100, cacheMaxBytes: 268435456, logMaxBytes: 10485760 },
    revision: 1,
  }
}

function deps(updateSettings: SettingsServiceDeps['updateSettings']): SettingsServiceDeps {
  return { getSettings: vi.fn().mockResolvedValue(bundle()), updateSettings }
}

const persistOk: SettingsServiceDeps['updateSettings'] = (patch) =>
  Promise.resolve<UpdateSettingsResult>({
    applied: { ...DEFAULT_GLOBAL_SETTINGS, ...patch },
    persisted: true,
    revision: 2,
  })

function Harness({
  settingsDeps,
  currentDocument = null,
}: {
  settingsDeps: SettingsServiceDeps
  currentDocument?: CurrentDocumentSettings | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <SettingsProvider deps={settingsDeps}>
      <button type="button" onClick={() => setOpen(true)}>
        open-settings
      </button>
      {open ? (
        <SettingsDialog onClose={() => setOpen(false)} currentDocument={currentDocument} />
      ) : null}
    </SettingsProvider>
  )
}

function openDialog(settingsDeps: SettingsServiceDeps, currentDocument?: CurrentDocumentSettings) {
  render(<Harness settingsDeps={settingsDeps} currentDocument={currentDocument ?? null} />)
  fireEvent.click(screen.getByRole('button', { name: 'open-settings' }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockImplementation((command: string) => {
    switch (command) {
      case 'get_app_info':
        return Promise.resolve(APP_INFO)
      case 'get_storage_overview':
        return Promise.resolve({
          categories: [],
          databasePath: '/data/db.sqlite',
          cacheDir: '/data/cache',
        })
      case 'list_grants':
        return Promise.resolve([])
      default:
        return Promise.resolve(undefined)
    }
  })
})

describe('SettingsDialog', () => {
  it('shows the five v0.1.0 categories and switches their content', async () => {
    const dialog = openDialog(deps(vi.fn(persistOk)))
    for (const key of [
      'settings.category.reading',
      'settings.category.fileUpdate',
      'settings.category.syntax',
      'settings.category.privacy',
      'settings.category.about',
    ]) {
      expect(screen.getByRole('button', { name: t(key) })).toBeTruthy()
    }
    expect(screen.getByLabelText(t('settings.reading.fontSize'))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: t('settings.category.fileUpdate') }))
    expect(screen.getByText(t('settings.fileUpdate.defaultLabel'))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: t('settings.category.syntax') }))
    expect(screen.getByText(t('settings.syntax.mode'))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: t('settings.category.about') }))
    await screen.findByText(t('about.version', { version: '0.1.0' }))
    expect(dialog).toBeTruthy()
  })

  it('shows the save-failure notice with retry while keeping the applied value', async () => {
    const updateSettings = vi
      .fn<SettingsServiceDeps['updateSettings']>()
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
    openDialog(deps(updateSettings))

    fireEvent.change(screen.getByLabelText(t('settings.reading.fontSize')), {
      target: { value: '20' },
    })
    await screen.findByText(new RegExp(t('settings.saveFailed')))
    expect(document.documentElement.style.getPropertyValue('--ps-body-size')).toBe('20px')

    fireEvent.click(screen.getByRole('button', { name: t('settings.saveFailed.retry') }))
    await waitFor(() => expect(screen.queryByText(new RegExp(t('settings.saveFailed')))).toBeNull())
    expect(updateSettings).toHaveBeenLastCalledWith({ fontSizePx: 20 })
  })

  it('traps focus, closes on Esc and returns focus to the trigger', async () => {
    render(<Harness settingsDeps={deps(vi.fn(persistOk))} />)
    const trigger = screen.getByRole('button', { name: 'open-settings' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('wires the current document into the syntax and update sections', async () => {
    const onInlineMathChange = vi.fn()
    const onUpdateModeChange = vi.fn()
    openDialog(deps(vi.fn(persistOk)), {
      displayName: 'a.md',
      inlineMath: true,
      updateModeOverride: null,
      onInlineMathChange,
      onUpdateModeChange,
    })

    fireEvent.click(screen.getByRole('button', { name: t('settings.category.syntax') }))
    const inlineToggle = screen.getByRole('checkbox', { name: t('settings.syntax.inlineDollar') })
    expect((inlineToggle as HTMLInputElement).checked).toBe(true)
    fireEvent.click(inlineToggle)
    expect(onInlineMathChange).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByRole('button', { name: t('settings.category.fileUpdate') }))
    const currentFieldset = screen
      .getByText(t('settings.fileUpdate.currentLabel'))
      .closest('fieldset')
    expect(currentFieldset).not.toBeNull()
    fireEvent.click(
      within(currentFieldset as HTMLElement).getByRole('radio', {
        name: new RegExp(t('update.mode.follow')),
      }),
    )
    expect(onUpdateModeChange).toHaveBeenCalledWith('follow')
  })
})
