import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import type { MermaidRenderer } from '../../../document/plugins/mermaid'
import { MermaidBlock } from './MermaidBlock'

/**
 * MermaidBlock (ui-spec §3.6; rendering-pipeline §2.10): injected renderer,
 * visibility fallback in jsdom, localized failure states with source view.
 */

function renderer(render: MermaidRenderer['render']): MermaidRenderer {
  return { version: 'mermaid@test', render }
}

const SOURCE = 'flowchart LR\n  A --> B'

describe('MermaidBlock', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the trusted SVG when the injected renderer succeeds', async () => {
    const { container } = render(
      <MermaidBlock
        source={SOURCE}
        deps={{
          loadRenderer: async () =>
            renderer(async () => ({ svg: '<svg data-testid="diagram"><g/></svg>' })),
        }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('.ps-mermaid-svg svg')).toBeTruthy()
    })
    expect(container.querySelector('[data-mermaid-state="ready"]')).toBeTruthy()
  })

  it('shows the localized timeout error and keeps the source view', async () => {
    vi.useFakeTimers()
    render(
      <MermaidBlock
        source={SOURCE}
        deps={{ loadRenderer: async () => renderer(() => new Promise(() => undefined)) }}
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByText(t('mermaid.timeout'))).toBeTruthy()
    expect(document.querySelector('.ps-mermaid-source')?.textContent).toBe(SOURCE)
  })

  it('localizes syntax errors and exposes the source without retrying', async () => {
    render(
      <MermaidBlock
        source={SOURCE}
        deps={{
          loadRenderer: async () =>
            renderer(async () => {
              throw new Error('parse failure')
            }),
        }}
      />,
    )
    await screen.findByText(t('mermaid.error.title'))
    expect(document.querySelector('.ps-mermaid-source')?.textContent).toBe(SOURCE)
  })

  it('explains unsupported diagram families without loading the renderer', async () => {
    const loadRenderer = vi.fn(async () => renderer(async () => ({ svg: '<svg/>' })))
    render(
      <MermaidBlock source={'stateDiagram-v2\n  [*] --> A'} deps={{ loadRenderer }} />,
    )
    await screen.findByText(t('mermaid.unsupported'))
    expect(loadRenderer).not.toHaveBeenCalled()
  })
})
