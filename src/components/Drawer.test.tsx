import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Drawer } from './Drawer'

describe('Drawer is non-modal (ui-spec §6.2, EDGE-02)', () => {
  it('exposes a complementary landmark and lets Tab leave the drawer', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">before</button>
        <Drawer side="left" label="Navigation" onClose={() => undefined}>
          <button type="button">inside</button>
        </Drawer>
        <button type="button">after</button>
      </>,
    )

    const drawer = screen.getByRole('complementary', { name: 'Navigation' })
    expect(drawer.getAttribute('aria-modal')).toBeNull()

    screen.getByRole('button', { name: 'before' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'inside' }))
    await user.tab()
    // Focus is not trapped: it leaves the drawer for the next control.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }))
  })

  it('closes on Escape from inside the drawer', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Drawer side="left" label="Navigation" onClose={onClose}>
        <button type="button">inside</button>
      </Drawer>,
    )
    screen.getByRole('button', { name: 'inside' }).focus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
