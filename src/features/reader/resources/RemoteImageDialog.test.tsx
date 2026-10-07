import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import { RemoteImageDialog } from './RemoteImageDialog'

/**
 * Remote image dialog (T-58; ui-spec §3.8; IX10; R26; security-model §4).
 *
 * Lists target domains only — the full URL path/token is never displayed —
 * and holds the safe default: initial focus and Esc on "keep blocking".
 */

function renderDialog() {
  const onAllow = vi.fn()
  const onBlock = vi.fn()
  render(
    <RemoteImageDialog
      origins={['https://img.example.com', 'https://cdn.example.org']}
      onAllow={onAllow}
      onBlock={onBlock}
    />,
  )
  return { onAllow, onBlock }
}

describe('RemoteImageDialog', () => {
  it('lists the target domains without exposing full URLs or tokens', () => {
    renderDialog()
    expect(screen.getByText(t('dialog.authRemote.title'))).toBeTruthy()
    expect(screen.getByText('https://img.example.com')).toBeTruthy()
    expect(screen.getByText('https://cdn.example.org')).toBeTruthy()
    expect(screen.getByText(t('dialog.authRemote.sessionNote'))).toBeTruthy()
    expect(screen.getByText(t('dialog.authRemote.blocked'))).toBeTruthy()
    expect(screen.getByText(t('dialog.authRemote.allow'))).toBeTruthy()
  })

  it('focuses the safe default and maps Esc to blocking', () => {
    const { onBlock } = renderDialog()
    const blocked = screen.getByRole('button', { name: t('dialog.authRemote.blocked') })
    expect(document.activeElement).toBe(blocked)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onBlock).toHaveBeenCalledTimes(1)
  })

  it('allows the current document session on explicit confirmation only', () => {
    const { onAllow, onBlock } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: t('dialog.authRemote.allow') }))
    expect(onAllow).toHaveBeenCalledTimes(1)
    expect(onBlock).not.toHaveBeenCalled()
  })
})
