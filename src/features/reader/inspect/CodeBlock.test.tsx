import type { Element } from 'hast'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { t } from '../../../app/i18n'
import { BlockContext, type BlockContextValue } from './block-context'
import {
  CODE_COLLAPSED_LINES,
  CODE_COLLAPSE_THRESHOLD_LINES,
  CodeBlock,
  resetCodeWrapSessionForTests,
} from './CodeBlock'
import type { ReaderUi } from '../ui-context'
import { ReaderUiContext } from '../ui-context'

/**
 * Code block actions (ui-spec §3.6; T-46): whole-literal copy payloads,
 * clipboard-confirmed feedback timing, session-scoped wrap, the 40/20-line
 * collapse thresholds and the source-view entry.
 */

function codeNode(literal: string, language = 'rust'): Element {
  const code: Element = {
    type: 'element',
    tagName: 'code',
    properties: { className: [`language-${language}`] },
    children: [{ type: 'text', value: literal }],
  }
  const pre: Element = { type: 'element', tagName: 'pre', properties: {}, children: [code] }
  const gutter: Element = {
    type: 'element',
    tagName: 'span',
    properties: { className: ['code-block-lines'], ariaHidden: 'true' },
    children: [{ type: 'text', value: '1' }],
  }
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-block'], dataLanguage: language },
    children: [gutter, pre],
  }
}

const CONTEXT: BlockContextValue = {
  blockId: 'b1',
  headingPath: ['第一章'],
  range: { startByte: 5, endByte: 60 },
  rawText: 'text',
  diagnostics: [],
}

function renderCode(literal: string, ui?: ReaderUi) {
  const node = codeNode(literal)
  const view = render(
    <BlockContext.Provider value={CONTEXT}>
      <ReaderUiContext.Provider value={ui ?? null}>
        <CodeBlock node={node}>
          <pre>{literal}</pre>
        </CodeBlock>
      </ReaderUiContext.Provider>
    </BlockContext.Provider>,
  )
  return view
}

describe('CodeBlock (ui-spec §3.6, T-46)', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
    resetCodeWrapSessionForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('copies the whole literal (gutter excluded, LF normalized) with confirmed feedback', async () => {
    vi.useFakeTimers()
    renderCode('line1\r\nline2\r\n')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t('code.action.copyAria') }))
    })
    expect(invokeMock).toHaveBeenCalledWith('plugin:clipboard-manager|write_text', {
      text: 'line1\nline2\n',
    })
    expect(screen.getByText(t('code.copied'))).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(screen.queryByText(t('code.copied'))).toBeNull()
  })

  it('keeps the failure message until the next attempt', async () => {
    vi.useFakeTimers()
    invokeMock.mockRejectedValue(new Error('clipboard unavailable'))
    renderCode('code')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t('code.action.copyAria') }))
    })
    expect(screen.getByText(t('code.copyFailed'))).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(screen.getByText(t('code.copyFailed'))).toBeTruthy()
  })

  it('toggles wrap for this block and remembers it for the session', () => {
    const view = renderCode('code')
    const wrap = screen.getByRole('button', { name: t('code.action.wrapAria') })
    expect(wrap.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(wrap)
    expect(wrap.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.code-block')?.className).toContain('ps-code-wrapped')

    view.unmount()
    renderCode('code')
    expect(
      screen.getByRole('button', { name: t('code.action.wrapAria') }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('collapses long blocks to the first 20 lines with the 40-line threshold', () => {
    const long = `${Array.from({ length: 45 }, (_, index) => `line ${index}`).join('\n')}\n`
    renderCode(long)
    expect(
      screen.getByText(t('code.collapsed', { shown: CODE_COLLAPSED_LINES, total: 45 })),
    ).toBeTruthy()
    const expand = screen.getByRole('button', { name: t('code.action.expand', { count: 45 }) })
    expect(document.querySelector('.code-block')?.className).toContain('ps-code-collapsed')

    fireEvent.click(expand)
    expect(screen.queryByText(t('code.collapsed', { shown: 20, total: 45 }))).toBeNull()
    expect(screen.getByRole('button', { name: t('code.action.collapse') })).toBeTruthy()
  })

  it('leaves blocks at or below the threshold fully expanded', () => {
    const lines = CODE_COLLAPSE_THRESHOLD_LINES
    const literal = `${Array.from({ length: lines }, (_, index) => `l${index}`).join('\n')}\n`
    renderCode(literal)
    expect(screen.queryByRole('button', { name: /展开全部/ })).toBeNull()
    expect(screen.queryByText(/已折叠/)).toBeNull()
  })

  it('opens the source view at this block range', () => {
    const enterSource = vi.fn()
    const ui: ReaderUi = { enterSource, openInspect: vi.fn(), openZoom: vi.fn() }
    renderCode('code', ui)
    fireEvent.click(screen.getByRole('button', { name: t('code.action.viewSource') }))
    expect(enterSource).toHaveBeenCalledWith({ startByte: 5, endByte: 60 }, 'b1')
  })
})
