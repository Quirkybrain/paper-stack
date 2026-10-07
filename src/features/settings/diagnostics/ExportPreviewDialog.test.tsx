import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../../app/i18n'
import { ExportPreviewDialog } from './ExportPreviewDialog'

/**
 * Diagnostics export flow (ui-spec §3.8; IXD §15.3; security-model §7):
 * preview → picker → protection check → write → honest result. Cancelled
 * pickers write nothing; protected targets are rejected with an explanation;
 * overwrite needs explicit confirmation; failures keep the preview.
 */

function renderDialog(protectedPaths: string[] = ['/docs/a.md']) {
  render(<ExportPreviewDialog onClose={() => undefined} protectedPaths={protectedPaths} />)
}

function pickResult(paths: string[]) {
  return { cancelled: paths.length === 0, paths }
}

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockImplementation((command: string) => {
    switch (command) {
      case 'preview_diagnostics':
        return Promise.resolve({
          exportId: 'export-1',
          generatedAtMs: 1,
          text: 'PREVIEW TEXT',
          sections: [],
          redactionCount: 0,
          expiresAtMs: 9_000_000_000_000,
        })
      case 'plugin:clipboard-manager|write_text':
        return Promise.resolve(undefined)
      default:
        return Promise.resolve(undefined)
    }
  })
})

describe('ExportPreviewDialog', () => {
  it('rejects a protected target with an explanation and never writes', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'preview_diagnostics') {
        return Promise.resolve({
          exportId: 'export-1',
          generatedAtMs: 1,
          text: 'PREVIEW TEXT',
          sections: [],
          redactionCount: 0,
          expiresAtMs: 9_000_000_000_000,
        })
      }
      if (command === 'pick_export_target') return Promise.resolve(pickResult(['/docs/out.txt']))
      return Promise.resolve(undefined)
    })
    renderDialog()
    await screen.findByText('PREVIEW TEXT')

    fireEvent.click(screen.getByRole('button', { name: t('diagnostics.export.chooseTarget') }))
    await screen.findByText(t('diagnostics.export.blocked'))
    expect(invokeMock).not.toHaveBeenCalledWith('export_diagnostics', expect.anything())
    // Failure keeps the preview available for manual copy.
    expect(screen.getByText('PREVIEW TEXT')).toBeTruthy()
  })

  it('keeps the preview and writes nothing when the picker is cancelled', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'preview_diagnostics') {
        return Promise.resolve({
          exportId: 'export-1',
          generatedAtMs: 1,
          text: 'PREVIEW TEXT',
          sections: [],
          redactionCount: 0,
          expiresAtMs: 9_000_000_000_000,
        })
      }
      if (command === 'pick_export_target') return Promise.resolve(pickResult([]))
      return Promise.resolve(undefined)
    })
    renderDialog()
    await screen.findByText('PREVIEW TEXT')
    fireEvent.click(screen.getByRole('button', { name: t('diagnostics.export.chooseTarget') }))

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('pick_export_target', undefined))
    expect(invokeMock).not.toHaveBeenCalledWith('export_diagnostics', expect.anything())
    expect(screen.getByText('PREVIEW TEXT')).toBeTruthy()
  })

  it('asks for overwrite confirmation on PS_IO_EXPORT_BLOCKED and retries on confirm', async () => {
    let exportCalls = 0
    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case 'preview_diagnostics':
          return Promise.resolve({
            exportId: 'export-1',
            generatedAtMs: 1,
            text: 'PREVIEW TEXT',
            sections: [],
            redactionCount: 0,
            expiresAtMs: 9_000_000_000_000,
          })
        case 'pick_export_target':
          return Promise.resolve(pickResult(['/tmp/diag.txt']))
        case 'export_diagnostics': {
          exportCalls += 1
          if (exportCalls === 1) {
            return Promise.reject({
              code: 'PS_IO_EXPORT_BLOCKED',
              category: 'io',
              messageKey: 'error.io.exportBlocked',
              retryable: false,
            })
          }
          return Promise.resolve({ writtenPath: '/tmp/diag.txt', bytes: 42 })
        }
        default:
          return Promise.resolve(undefined)
      }
    })
    renderDialog()
    await screen.findByText('PREVIEW TEXT')

    fireEvent.click(screen.getByRole('button', { name: t('diagnostics.export.chooseTarget') }))
    await screen.findByText(t('diagnostics.export.overwrite'))
    expect(invokeMock).toHaveBeenCalledWith('export_diagnostics', {
      req: { exportId: 'export-1', targetPath: '/tmp/diag.txt', overwrite: false },
    })

    fireEvent.click(screen.getByRole('button', { name: t('common.confirm') }))
    await screen.findByText(t('diagnostics.export.success', { path: '/tmp/diag.txt' }))
    expect(invokeMock).toHaveBeenCalledWith('export_diagnostics', {
      req: { exportId: 'export-1', targetPath: '/tmp/diag.txt', overwrite: true },
    })
  })

  it('keeps the preview with the failure message when the write fails', async () => {
    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case 'preview_diagnostics':
          return Promise.resolve({
            exportId: 'export-1',
            generatedAtMs: 1,
            text: 'PREVIEW TEXT',
            sections: [],
            redactionCount: 0,
            expiresAtMs: 9_000_000_000_000,
          })
        case 'pick_export_target':
          return Promise.resolve(pickResult(['/tmp/diag.txt']))
        case 'export_diagnostics':
          return Promise.reject({
            code: 'PS_IO_WRITE_FAILED',
            category: 'io',
            messageKey: 'error.io.writeFailed',
            retryable: true,
          })
        default:
          return Promise.resolve(undefined)
      }
    })
    renderDialog()
    await screen.findByText('PREVIEW TEXT')

    fireEvent.click(screen.getByRole('button', { name: t('diagnostics.export.chooseTarget') }))
    await screen.findByText(t('diagnostics.export.saveFailed'))
    expect(screen.getByText('PREVIEW TEXT')).toBeTruthy()
  })
})
