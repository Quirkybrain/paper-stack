import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { t } from '../app/i18n'
import { TOAST_SUCCESS_DURATION_MS, Toast } from './Toast'

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast notifications (ui-spec §6.3, VC-13)', () => {
  it('success toasts are role=status and auto-dismiss after ~1.5s', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast tone="success" message="done" onDismiss={onDismiss} />)

    expect(screen.getByRole('status').textContent).toContain('done')
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(TOAST_SUCCESS_DURATION_MS)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('error toasts are role=alert, persist, and dismiss only via the close button', async () => {
    const onDismiss = vi.fn()
    render(<Toast tone="error" message="failed" onDismiss={onDismiss} />)

    expect(screen.getByRole('alert').textContent).toContain('failed')

    vi.useFakeTimers()
    act(() => {
      vi.advanceTimersByTime(TOAST_SUCCESS_DURATION_MS * 10)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    vi.useRealTimers()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('common.close') }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('never steals focus', () => {
    render(
      <>
        <button type="button">opener</button>
        <Toast tone="error" message="failed" onDismiss={() => undefined} />
      </>,
    )
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()
    expect(document.activeElement).toBe(opener)
  })
})
