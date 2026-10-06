import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Menu, type MenuItem } from './Menu'

function setup() {
  const anchorRef = createRef<HTMLButtonElement>()
  const alpha = vi.fn()
  const gamma = vi.fn()
  const onClose = vi.fn()
  const items: MenuItem[] = [
    { id: 'alpha', label: 'Alpha', onSelect: alpha },
    { id: 'beta', label: 'Beta', disabled: true, disabledReason: 'Not available yet' },
    { id: 'gamma', label: 'Gamma', onSelect: gamma },
  ]
  render(
    <>
      <button ref={anchorRef} type="button">
        anchor
      </button>
      <Menu items={items} anchor={anchorRef} label="More actions" onClose={onClose} />
    </>,
  )
  return { alpha, gamma, onClose, anchorRef }
}

describe('Menu keyboard navigation (ui-spec §2.2, §6.4)', () => {
  it('skips disabled items with ArrowDown and selects with Enter', async () => {
    const { gamma, onClose } = setup()
    const user = userEvent.setup()

    // Mount focuses the first enabled item.
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Alpha/ }))

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Gamma/ }))

    await user.keyboard('{Enter}')
    expect(gamma).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes disabled items with aria-disabled and their reason', () => {
    setup()
    const beta = screen.getByRole('menuitem', { name: /Beta/ })
    expect(beta.getAttribute('aria-disabled')).toBe('true')
    const reasonId = beta.getAttribute('aria-describedby')
    expect(reasonId).not.toBeNull()
    expect(document.getElementById(reasonId as string)?.textContent).toBe('Not available yet')
  })

  it('closes on Escape and returns focus to the anchor', async () => {
    const { onClose, anchorRef } = setup()
    const user = userEvent.setup()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(anchorRef.current)
  })
})
