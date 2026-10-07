import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../app/i18n'
import type { AppInfo, ErrorPayload } from '../../services/types'
import { AboutSection } from './sections/AboutSection'

/**
 * About/Legal (ui-spec §3.7; R30): real app info, an honest unconfigured
 * source reason, offline legal text and external URLs only after an explicit
 * user click.
 */

function appInfo(overrides: Partial<AppInfo['legal']> = {}): AppInfo {
  return {
    name: '纸栈 PaperStack',
    version: '0.1.0',
    owner: 'Quirkybrain',
    license: 'GPL-3.0-only',
    ipcContract: 'paperstack-ipc-r1',
    locale: 'zh-CN',
    tauriVersion: '2.12.1',
    legal: {
      // Real backend payload shape (`services/info.rs`): Rust returns the
      // i18n key, never user-visible text (AT30/D-34-1).
      sourceEntryUrl: null,
      sourceEntryNote: 'about.sourceUnconfigured',
      licenseAvailable: false,
      thirdPartyAvailable: false,
      ...overrides,
    },
  }
}

beforeEach(() => {
  invokeMock.mockReset()
})

describe('AboutSection', () => {
  it('shows the real version/owner/license and the unconfigured source reason', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_app_info') return Promise.resolve(appInfo())
      return Promise.resolve(undefined)
    })
    render(<AboutSection />)

    await screen.findByText(t('about.version', { version: '0.1.0' }))
    expect(screen.getByText(t('about.product'))).toBeTruthy()
    expect(screen.getByText(t('about.owner'))).toBeTruthy()
    expect(screen.getByText(t('about.license'))).toBeTruthy()
    // sourceEntryUrl = null: show the release-blocking reason, not a fake URL.
    // The backend sends an i18n key; the raw key must never render (AT30).
    expect(screen.getByText(t('about.sourceUnconfigured'))).toBeTruthy()
    expect(screen.queryByText('about.sourceUnconfigured')).toBeNull()
    expect(invokeMock).not.toHaveBeenCalledWith('open_external_url', expect.anything())
  })

  it('opens a configured source URL only after the explicit click', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_app_info') {
        return Promise.resolve(appInfo({ sourceEntryUrl: 'https://example.com/source' }))
      }
      if (command === 'open_external_url') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    render(<AboutSection />)
    await screen.findByText(t('about.version', { version: '0.1.0' }))
    expect(invokeMock).not.toHaveBeenCalledWith('open_external_url', expect.anything())

    fireEvent.click(screen.getByRole('button', { name: t('about.source') }))
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('open_external_url', {
        url: 'https://example.com/source',
      }),
    )
  })

  it('renders the bundled legal text verbatim through read_legal_text', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_app_info') return Promise.resolve(appInfo({ licenseAvailable: true }))
      if (command === 'read_legal_text') {
        return Promise.resolve({ text: 'GNU GPL v3 text', resourceName: 'LICENSE' })
      }
      return Promise.resolve(undefined)
    })
    render(<AboutSection />)
    await screen.findByText(t('about.version', { version: '0.1.0' }))
    fireEvent.click(screen.getByRole('button', { name: t('about.viewLicense') }))

    await screen.findByText('GNU GPL v3 text')
    expect(invokeMock).toHaveBeenCalledWith('read_legal_text', { req: { kind: 'license' } })
  })

  it('degrades gracefully when the license resource is not bundled yet', async () => {
    const missing: ErrorPayload = {
      code: 'PS_IO_NOT_FOUND',
      category: 'io',
      messageKey: 'error.io.notFound',
      retryable: true,
    }
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_app_info') return Promise.resolve(appInfo())
      if (command === 'read_legal_text') return Promise.reject(missing)
      return Promise.resolve(undefined)
    })
    render(<AboutSection />)
    await screen.findByText(t('about.version', { version: '0.1.0' }))
    fireEvent.click(screen.getByRole('button', { name: t('about.viewLicense') }))

    await screen.findByText(t('error.io.notFound'))
    // No fabricated legal text is rendered.
    expect(document.querySelector('.ps-legal-text')).toBeNull()
  })
})
