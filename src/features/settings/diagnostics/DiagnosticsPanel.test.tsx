import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../../app/i18n'
import type { DiagnosticEntryInput } from './diagnostics-model'
import { DiagnosticsProvider, useDiagnostics } from './diagnostics-context'
import { DiagnosticsPanel } from './DiagnosticsPanel'

/**
 * Diagnostics panel (ui-spec §3.8; IXD §15.2; R28): reason first, technical
 * details folded, redacted copy by default and the export preview reached
 * through the panel.
 */

function Seed({ inputs }: { inputs: readonly DiagnosticEntryInput[] }) {
  const { recordMany } = useDiagnostics()
  useEffect(() => {
    recordMany(inputs)
  }, [inputs, recordMany])
  return null
}

function renderPanel(inputs: readonly DiagnosticEntryInput[], protectedPaths: string[] = []) {
  return render(
    <DiagnosticsProvider now={() => 100}>
      <Seed inputs={inputs} />
      <DiagnosticsPanel onClose={() => undefined} protectedPaths={protectedPaths} />
    </DiagnosticsProvider>,
  )
}

function clipboardText(): string | undefined {
  const call = invokeMock.mock.calls.find(
    ([command]) => command === 'plugin:clipboard-manager|write_text',
  )
  return (call?.[1] as { text?: string } | undefined)?.text
}

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockImplementation((command: string) => {
    switch (command) {
      case 'plugin:clipboard-manager|write_text':
        return Promise.resolve(undefined)
      case 'preview_diagnostics':
        return Promise.resolve({
          exportId: 'export-1',
          generatedAtMs: 1,
          text: 'PREVIEW TEXT',
          sections: [],
          redactionCount: 2,
          expiresAtMs: 9_000_000_000_000,
        })
      default:
        return Promise.resolve(undefined)
    }
  })
})

describe('DiagnosticsPanel', () => {
  it('shows the user-readable reason first with folded technical details', async () => {
    renderPanel([
      {
        id: 'e1',
        messageKey: 'error.io.readFailed',
        code: 'PS_IO_READ_FAILED',
        category: 'io',
        docVersion: 'v1',
        sourceRange: { startByte: 4, endByte: 12 },
        details: { engine: 'katex' },
      },
    ])
    expect(screen.getByText(t('error.io.readFailed'))).toBeTruthy()
    expect(screen.getByText(t('diagnostics.errorId', { id: 'PS_IO_READ_FAILED' }))).toBeTruthy()
    expect(screen.getByText(t('diagnostics.sourceLocation', { range: '4-12' }))).toBeTruthy()

    const details = document.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.textContent).toContain('engine')
  })

  it('copies the summary redacted by default, without source context or paths', async () => {
    renderPanel([
      {
        id: 'e1',
        messageKey: 'error.parse.local',
        code: 'PS_PARSE_LOCAL',
        sourceContext: 'secret body text',
        paths: ['/home/user/private/doc.md'],
      },
    ])
    fireEvent.click(screen.getByRole('button', { name: t('diagnostics.copySummary') }))
    await waitFor(() => expect(clipboardText()).toBeDefined())
    const text = clipboardText() ?? ''
    expect(text).toContain('error.parse.local')
    expect(text).not.toContain('secret body text')
    expect(text).not.toContain('/home/user/private/doc.md')
    await screen.findByText(t('diagnostics.copy.copied'))
  })

  it('opens the export preview with redaction options off and re-previews on opt-in', async () => {
    renderPanel(
      [{ id: 'e1', messageKey: 'error.io.readFailed', code: 'PS_IO_READ_FAILED' }],
      ['/docs/a.md'],
    )
    fireEvent.click(screen.getByRole('button', { name: t('diagnostics.export') }))

    await screen.findByText('PREVIEW TEXT')
    expect(invokeMock).toHaveBeenCalledWith('preview_diagnostics', {
      req: { includeSourceContext: false, includeFullPaths: false },
    })

    fireEvent.click(screen.getByRole('checkbox', { name: t('diagnostics.preview.includeSource') }))
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('preview_diagnostics', {
        req: { includeSourceContext: true, includeFullPaths: false },
      }),
    )
  })
})
