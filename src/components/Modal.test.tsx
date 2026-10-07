import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from './Modal'

function Harness({ closeOnScrim = false }: { closeOnScrim?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open ? (
        <Modal labelledBy="modal-title" onClose={() => setOpen(false)} closeOnScrim={closeOnScrim}>
          <h2 id="modal-title">Dialog title</h2>
          <button type="button">first</button>
          <button type="button">last</button>
        </Modal>
      ) : null}
    </div>
  )
}

describe('Modal focus behavior (ui-spec §6.2)', () => {
  it('is a labelled modal dialog, traps Tab and restores focus after Esc', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'open' }))
    const dialog = screen.getByRole('dialog', { name: 'Dialog title' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    // Initial focus lands on the first focusable control (safe default).
    const first = screen.getByRole('button', { name: 'first' })
    const last = screen.getByRole('button', { name: 'last' })
    expect(document.activeElement).toBe(first)

    // Shift+Tab from the first control wraps to the last; Tab returns.
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
    await user.tab()
    expect(document.activeElement).toBe(first)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'open' }))
  })

  it('focuses the explicit initialFocusRef target when provided', () => {
    function RefHarness() {
      const safeRef = useRef<HTMLButtonElement>(null)
      return (
        <div>
          <button type="button" onClick={() => undefined}>
            outside
          </button>
          <Modal labelledBy="ref-title" initialFocusRef={safeRef} onClose={() => undefined}>
            <h2 id="ref-title">Safe</h2>
            <button type="button">unsafe</button>
            <button type="button" ref={safeRef}>
              keep blocked
            </button>
          </Modal>
        </div>
      )
    }
    render(<RefHarness />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'keep blocked' }))
  })

  it('does not close on a scrim click unless explicitly allowed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'open' }))
    const dialog = screen.getByRole('dialog', { name: 'Dialog title' })
    await user.click(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('closes on scrim click when closeOnScrim is set', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal labelledBy="scrim-title" onClose={onClose} closeOnScrim>
        <h2 id="scrim-title">Scrim</h2>
        <button type="button">inside</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Scrim' })
    await user.click(dialog.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
