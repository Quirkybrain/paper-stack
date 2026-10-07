import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import { ZoomOverlay } from './ZoomOverlay'

/**
 * Zoom overlay (ui-spec §3.6/§9.2, VC-15; T-47): permanent controls, zoom
 * buttons vs Ctrl+wheel, plain wheel/body wheel never zoom, pan by drag and
 * arrow keys, and Esc returning focus to the trigger.
 */

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        trigger
      </button>
      {open ? (
        <ZoomOverlay
          target={{ label: 'diagram', content: <div style={{ width: 800, height: 600 }}>内容</div> }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function openOverlay() {
  const trigger = screen.getByRole('button', { name: 'trigger' })
  trigger.focus()
  fireEvent.click(trigger)
  return {
    trigger,
    viewport: document.querySelector('.ps-zoom-viewport') as HTMLElement,
    content: document.querySelector('.ps-zoom-content') as HTMLElement,
  }
}

describe('ZoomOverlay (ui-spec §3.6, T-47)', () => {
  it('shows all permanent controls, title and hints', () => {
    render(<Harness />)
    openOverlay()
    expect(screen.getByRole('dialog', { name: t('zoom.title') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('zoom.close') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('zoom.in') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('zoom.out') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('zoom.fitWidth') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('zoom.reset') })).toBeTruthy()
    expect(screen.getByText(t('zoom.hint'), { exact: false })).toBeTruthy()
    expect(screen.getByText(t('zoom.arrowHint'), { exact: false })).toBeTruthy()
  })

  it('zooms in/out with buttons and resets to 100%', () => {
    render(<Harness />)
    const { viewport } = openOverlay()
    expect(viewport.dataset.zoomScale).toBe('1.00')
    fireEvent.click(screen.getByRole('button', { name: t('zoom.in') }))
    expect(viewport.dataset.zoomScale).toBe('1.25')
    fireEvent.click(screen.getByRole('button', { name: t('zoom.out') }))
    expect(viewport.dataset.zoomScale).toBe('1.00')
    fireEvent.click(screen.getByRole('button', { name: t('zoom.reset') }))
    expect(viewport.dataset.zoomScale).toBe('1.00')
  })

  it('fits the content width using the measured viewport', () => {
    render(<Harness />)
    const { viewport, content } = openOverlay()
    Object.defineProperty(viewport, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(content, 'scrollWidth', { value: 800, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: t('zoom.fitWidth') }))
    expect(viewport.dataset.zoomScale).toBe('0.50')
  })

  it('zooms only with Ctrl+wheel; plain wheel and body wheel never zoom', () => {
    render(<Harness />)
    const { viewport } = openOverlay()
    // Plain wheel keeps native scrolling and is not canceled.
    expect(fireEvent.wheel(viewport, { deltaY: -100 })).toBe(true)
    expect(viewport.dataset.zoomScale).toBe('1.00')
    // Wheel outside the overlay (document body) has no effect either.
    fireEvent.wheel(document.body, { deltaY: -100, ctrlKey: true })
    expect(viewport.dataset.zoomScale).toBe('1.00')
    // The documented modifier zooms and consumes the event.
    expect(fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true })).toBe(false)
    expect(viewport.dataset.zoomScale).toBe('1.25')
  })

  it('pans by drag and by arrow keys', () => {
    render(<Harness />)
    const { viewport, content } = openOverlay()
    viewport.focus()
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    fireEvent.keyDown(viewport, { key: 'ArrowDown' })
    expect(content.style.transform).toContain('translate(24px, 24px)')

    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 130, clientY: 70 })
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 130, clientY: 70 })
    expect(content.style.transform).toContain('translate(54px, -6px)')
  })

  it('closes once with Esc and returns focus to the trigger', () => {
    render(<Harness />)
    const { trigger } = openOverlay()
    const onCloseSpy = vi.fn()
    void onCloseSpy
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: t('zoom.title') })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    // The trigger is interactive again after the overlay unmounted.
    expect((trigger as HTMLButtonElement).disabled).toBe(false)
  })
})
