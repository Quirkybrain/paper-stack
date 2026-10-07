import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import type { ErrorPayload, SourceInfo, SourceWindow, VersionInfo } from '../../../services/types'
import { SOURCE_LINE_HEIGHT_PX, SourceView } from './SourceView'
import { byteOffsetForLine } from './mapping'

/**
 * Read-only source view (ui-spec §3.5; T-45): plain `<pre>` with line numbers,
 * display-version text without any disk read, version-checked window mode for
 * large documents and the position reported back to the reader.
 */

const VERSION: VersionInfo = { contentHash: 'v1', sizeBytes: 128, modifiedAtMs: 1, observedAtMs: 2 }

const TEXT = '# 标题\n\n正文内容\n'

function renderSource(overrides: Partial<Parameters<typeof SourceView>[0]> = {}) {
  const onBack = vi.fn()
  const onPositionChange = vi.fn()
  const deps = {
    getSourceInfo: vi.fn(async (): Promise<SourceInfo> => {
      return { docId: 'd-1', version: VERSION, encoding: 'utf-8', totalLines: 5000 }
    }),
    readSourceWindow: vi.fn(async (): Promise<SourceWindow> => {
      return { docId: 'd-1', version: VERSION, startLine: 1, endLine: 2, text: 'a\nb', eof: false }
    }),
  }
  const view = render(
    <SourceView
      docId="d-1"
      version={VERSION}
      rawText={TEXT}
      initialRange={null}
      onBack={onBack}
      onPositionChange={onPositionChange}
      deps={deps}
      {...overrides}
    />,
  )
  return { onBack, onPositionChange, deps, view }
}

describe('SourceView (ui-spec §3.5, T-45)', () => {
  it('renders a read-only pre with line numbers and no editable affordance', () => {
    const { deps } = renderSource()
    expect(screen.getByRole('heading', { name: t('source.title') })).toBeTruthy()
    const back = screen.getByRole('button', { name: t('source.back') })
    expect(back).toBeTruthy()
    const container = document.querySelector('[data-source-mode="text"]') as HTMLElement
    expect(container).toBeTruthy()
    const pre = container.querySelector('pre') as HTMLPreElement
    expect(pre.textContent).toBe(TEXT)
    expect(pre.getAttribute('contenteditable')).toBeNull()
    expect(container.querySelector('input, textarea, [contenteditable="true"]')).toBeNull()
    expect((container.querySelector('.ps-source-lines') as HTMLElement).textContent).toBe('1\n2\n3\n4')
    // Display-version text needs no disk command at all.
    expect(deps.getSourceInfo).not.toHaveBeenCalled()
    expect(deps.readSourceWindow).not.toHaveBeenCalled()
  })

  it('reports the initial mapped line and its byte offset back', () => {
    const { onBack, onPositionChange } = renderSource({
      initialRange: { startByte: byteOffsetForLine(TEXT, 3), endByte: byteOffsetForLine(TEXT, 3) + 1 },
    })
    expect(onPositionChange).toHaveBeenCalledWith({
      line: 3,
      byteOffset: byteOffsetForLine(TEXT, 3),
    })
    fireEvent.click(screen.getByRole('button', { name: t('source.back') }))
    expect(onBack).toHaveBeenCalledWith({
      line: 3,
      byteOffset: byteOffsetForLine(TEXT, 3),
    })
  })

  it('tracks the first visible line while scrolling', () => {
    const { onBack } = renderSource()
    const scroll = document.querySelector('.ps-source-scroll') as HTMLElement
    scroll.scrollTop = SOURCE_LINE_HEIGHT_PX * 2
    fireEvent.scroll(scroll)
    fireEvent.click(screen.getByRole('button', { name: t('source.back') }))
    expect(onBack).toHaveBeenCalledWith({ line: 3, byteOffset: byteOffsetForLine(TEXT, 3) })
  })

  it('loads a version-checked window for text that is not in memory', async () => {
    renderSource({ rawText: null })
    await screen.findByText(t('source.window', { start: 1, end: 2, total: 5000 }))
    const container = document.querySelector('[data-source-mode="window"]') as HTMLElement
    expect(container).toBeTruthy()
    const scroll = container.querySelector('.ps-source-scroll') as HTMLElement
    expect(scroll.getAttribute('data-complete')).toBe('false')
    expect(container.querySelector('pre')?.textContent).toBe('a\nb')
  })

  it('refuses a window whose hash differs from the display version', async () => {
    const getSourceInfo = vi.fn(async (): Promise<SourceInfo> => {
      return {
        docId: 'd-1',
        version: { ...VERSION, contentHash: 'v2' },
        encoding: 'utf-8',
        totalLines: 10,
      }
    })
    const readSourceWindow = vi.fn()
    renderSource({ rawText: null, deps: { getSourceInfo, readSourceWindow: readSourceWindow as never } })
    await screen.findByText(t('error.io.changed'))
    expect(readSourceWindow).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeTruthy()
  })

  it('shows window read failures with their reason, code and retry', async () => {
    const failure: ErrorPayload = {
      code: 'PS_IO_READ_FAILED',
      category: 'io',
      messageKey: 'error.io.readFailed',
      retryable: true,
    }
    const getSourceInfo = vi.fn(async () => {
      throw failure
    })
    renderSource({ rawText: null, deps: { getSourceInfo } })
    await screen.findByText(t('error.io.readFailed'))
    expect(screen.getByText('PS_IO_READ_FAILED')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: t('common.retry') })).toBeTruthy())
  })
})
