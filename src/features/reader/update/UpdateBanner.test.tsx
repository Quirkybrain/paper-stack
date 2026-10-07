import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import { UpdateBanner } from './UpdateBanner'

/**
 * UpdateBanner presentation oracle (ui-spec §3.8; VC-08; INV-UM-03/05/08).
 */

function handlers() {
  return {
    onUpdate: vi.fn(),
    onLater: vi.fn(),
    onReopen: vi.fn(),
    onContinue: vi.fn(),
  }
}

describe('UpdateBanner', () => {
  it('renders nothing when hidden', () => {
    const { container } = render(<UpdateBanner variant={{ kind: 'hidden' }} {...handlers()} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the non-modal banner with 现在更新 / 稍后 and never steals focus', () => {
    const spies = handlers()
    render(
      <UpdateBanner
        variant={{ kind: 'banner', updateAction: 'update.action.now' }}
        {...spies}
      />,
    )
    expect(screen.getByText(t('update.banner'))).toBeTruthy()
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(screen.getByRole('button', { name: t('update.action.now') }))
    expect(spies.onUpdate).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: t('update.action.later') }))
    expect(spies.onLater).toHaveBeenCalledTimes(1)
  })

  it('names the explicit clear-selection action when a selection exists', () => {
    const spies = handlers()
    render(
      <UpdateBanner
        variant={{ kind: 'banner', updateAction: 'update.action.updateAndClearSelection' }}
        {...spies}
      />,
    )
    expect(screen.queryByText(t('update.action.now'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('update.action.updateAndClearSelection') }))
    expect(spies.onUpdate).toHaveBeenCalledTimes(1)
  })

  it('explains a paused automatic update and offers 继续阅读', () => {
    const spies = handlers()
    render(<UpdateBanner variant={{ kind: 'paused', reason: 'inspect' }} {...spies} />)
    expect(screen.getByText(t('update.paused.inspect'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: t('update.action.continueReading') }))
    expect(spies.onContinue).toHaveBeenCalledTimes(1)
  })

  it('collapses to the textual marker that can reopen the banner', () => {
    const spies = handlers()
    render(<UpdateBanner variant={{ kind: 'collapsed' }} {...spies} />)
    expect(screen.queryByText(t('update.banner'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('update.badge') }))
    expect(spies.onReopen).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(t('update.badge')).length).toBeGreaterThan(0)
  })
})
