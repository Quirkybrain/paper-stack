import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import { AuthScopeDialog } from './AuthScopeDialog'

/**
 * Local authorization dialog (T-57; ui-spec §3.8/§6.2; IX10; INV-AZ-02/03).
 *
 * Shows the normalized range + aggregated count + the no-write promise; the
 * "remember" checkbox defaults to off (session grant) and only explicit
 * ticking requests a persistent grant; initial focus and Esc are the safe
 * "keep blocking" action.
 */

function renderDialog() {
  const onAllow = vi.fn()
  const onBlock = vi.fn()
  render(
    <AuthScopeDialog
      scopePath="/docs/shared"
      resourceCount={3}
      onAllow={onAllow}
      onBlock={onBlock}
    />,
  )
  return { onAllow, onBlock }
}

describe('AuthScopeDialog', () => {
  it('shows the normalized scope, resource count and the no-write statement', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(t('dialog.authLocal.scope', { path: '/docs/shared' }))).toBeTruthy()
    expect(screen.getByText(t('dialog.authLocal.count', { count: 3 }))).toBeTruthy()
    expect(screen.getByText(t('dialog.authLocal.noWrite'))).toBeTruthy()
  })

  it('does not expose an always-allow shortcut', () => {
    renderDialog()
    expect(screen.queryByText(/始终|全部允许|always/i)).toBeNull()
    expect(screen.getByRole('button', { name: t('dialog.authLocal.allow') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('dialog.authLocal.blocked') })).toBeTruthy()
  })

  it('requests a session grant by default and a persistent grant only when ticked', () => {
    const { onAllow } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: t('dialog.authLocal.allow') }))
    expect(onAllow).toHaveBeenCalledWith(false)

    const remember = screen.getByRole('checkbox', { name: t('dialog.authLocal.remember') })
    expect((remember as HTMLInputElement).checked).toBe(false)
    fireEvent.click(remember)
    fireEvent.click(screen.getByRole('button', { name: t('dialog.authLocal.allow') }))
    expect(onAllow).toHaveBeenLastCalledWith(true)
  })

  it('focuses the safe default and maps Esc to blocking', () => {
    const { onBlock } = renderDialog()
    const blocked = screen.getByRole('button', { name: t('dialog.authLocal.blocked') })
    expect(document.activeElement).toBe(blocked)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onBlock).toHaveBeenCalledTimes(1)
  })

  it('wraps Tab inside the dialog (focus trap)', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const remember = screen.getByRole('checkbox')
    const allow = screen.getByRole('button', { name: t('dialog.authLocal.allow') })

    // Last → first (forward wrap).
    allow.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(remember)

    // First → last (backward wrap).
    remember.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(allow)
  })
})
