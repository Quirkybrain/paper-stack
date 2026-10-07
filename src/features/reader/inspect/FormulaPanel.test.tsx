import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import katex from 'katex'

import { t } from '../../../app/i18n'
import {
  KATEX_MAX_EXPAND,
  KATEX_MAX_SIZE_EM,
  katexOptions,
} from '../../../document/plugins/katex'
import { ReaderUiContext, type ReaderUi } from '../ui-context'
import { FORMULA_COPY_FEEDBACK_MS, FormulaPanel, renderFormulaPreview } from './FormulaPanel'
import type { FormulaInspectTarget } from './types'

/**
 * Formula drawer panel (ui-spec §3.6, VC-06; T-46): preview, raw source
 * without `$`, source chapter, diagnostics and the copy/view-source/zoom
 * actions with confirmed feedback.
 */

const TARGET: FormulaInspectTarget = {
  kind: 'formula',
  source: 'x^2 + y',
  chapter: '第一章 / 公式',
  range: { startByte: 10, endByte: 30 },
  diagnostic: { code: 'PS_PARSE_LOCAL', messageKey: 'error.parse.local' },
}

function renderPanel(target: FormulaInspectTarget = TARGET, ui?: ReaderUi) {
  const view = render(
    <ReaderUiContext.Provider value={ui ?? null}>
      <FormulaPanel target={target} />
    </ReaderUiContext.Provider>,
  )
  return view
}

describe('FormulaPanel (ui-spec §3.6, T-46)', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the preview, the raw source without $, the chapter and diagnostics', () => {
    const { container } = renderPanel()
    expect(container.querySelector('.ps-formula-preview .katex')).toBeTruthy()
    const source = container.querySelector('.ps-inspect-source') as HTMLElement
    expect(source.textContent).toBe('x^2 + y')
    expect(source.textContent).not.toContain('$')
    expect(screen.getByText(t('formula.sourceLabel'))).toBeTruthy()
    expect(screen.getByText('第一章 / 公式')).toBeTruthy()
    expect(screen.getByText(t('formula.chapterLabel'))).toBeTruthy()
    expect(screen.getByText(t('formula.diagnostics'))).toBeTruthy()
    expect(screen.getByText(t('error.parse.local'))).toBeTruthy()
    expect(screen.getByText('PS_PARSE_LOCAL')).toBeTruthy()
  })

  it('reuses the pipeline-frozen KaTeX caps for the preview (B-01)', () => {
    const spy = vi.spyOn(katex, 'renderToString')
    try {
      renderFormulaPreview('x')
      expect(spy).toHaveBeenCalledWith('x', {
        ...katexOptions({}),
        displayMode: false,
        throwOnError: false,
      })
    } finally {
      spy.mockRestore()
    }

    // Observable caps: a 100em rule is clamped to the frozen 20em maxSize.
    const html = renderFormulaPreview('\\rule{100em}{1em}')
    expect(html).not.toBeNull()
    expect(html).toContain(`width="${KATEX_MAX_SIZE_EM}em"`)
    expect(html).not.toContain('width="100em"')
    expect(KATEX_MAX_EXPAND).toBeGreaterThan(0)
  })

  it('copies exactly the raw source and confirms for ~1.5s', async () => {
    vi.useFakeTimers()
    renderPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t('formula.action.copySource') }))
    })
    expect(invokeMock).toHaveBeenCalledWith('plugin:clipboard-manager|write_text', {
      text: 'x^2 + y',
    })
    expect(screen.getByText(t('formula.copied'))).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FORMULA_COPY_FEEDBACK_MS)
    })
    expect(screen.queryByText(t('formula.copied'))).toBeNull()
  })

  it('keeps the failure message visible and offers the source view/zoom entries', async () => {
    invokeMock.mockRejectedValue(new Error('nope'))
    const enterSource = vi.fn()
    const openZoom = vi.fn()
    const openInspect = vi.fn()
    renderPanel(TARGET, { enterSource, openInspect, openZoom })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t('formula.action.copySource') }))
    })
    expect(screen.getByText(t('formula.copyFailed'))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: t('formula.action.viewSource') }))
    expect(enterSource).toHaveBeenCalledWith({ startByte: 10, endByte: 30 }, null)

    fireEvent.click(screen.getByRole('button', { name: t('formula.action.zoom') }))
    expect(openZoom).toHaveBeenCalledTimes(1)
    const target = openZoom.mock.calls[0][0] as { label: string; content: unknown }
    expect(target.label).toBe(t('formula.drawer.title'))
    expect(target.content).toBeTruthy()
  })
})
