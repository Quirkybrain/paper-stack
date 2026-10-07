import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { t } from '../../../app/i18n'
import { formatBytes } from '../../settings/settings-model'
import { LargeDocDialog } from './LargeDocDialog'

/**
 * Large-document choice dialog oracle (ui-spec §3.8; rendering-pipeline §5;
 * T-51): the frozen option set, the size message and the safe default focus.
 */

const ELEVEN_MIB = 11 * 1024 * 1024

describe('LargeDocDialog', () => {
  it('shows the size message and the three frozen options', () => {
    render(<LargeDocDialog sizeBytes={ELEVEN_MIB} reason="size" onChoose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(t('largeDoc.title'))).toBeTruthy()
    expect(
      screen.getByText(t('largeDoc.message', { size: formatBytes(ELEVEN_MIB) })),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: t('largeDoc.simplified') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('largeDoc.sourceOnly') })).toBeTruthy()
    expect(screen.getByRole('button', { name: t('largeDoc.cancel') })).toBeTruthy()
    // The simplified reading option is the safe default focus target.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: t('largeDoc.simplified') }))
  })

  it('reports the chosen mode and maps Esc/cancel to cancel', () => {
    const onChoose = vi.fn()
    render(<LargeDocDialog sizeBytes={ELEVEN_MIB} reason="size" onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: t('largeDoc.sourceOnly') }))
    expect(onChoose).toHaveBeenLastCalledWith('source')

    fireEvent.click(screen.getByRole('button', { name: t('largeDoc.cancel') }))
    expect(onChoose).toHaveBeenLastCalledWith('cancel')

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onChoose).toHaveBeenLastCalledWith('cancel')
  })

  it('carries the complexity explanation for a post-parse budget overrun', () => {
    render(<LargeDocDialog sizeBytes={1024} reason="complexity" onChoose={vi.fn()} />)
    expect(screen.getByText(t('error.limit.complexity'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: t('largeDoc.simplified') }))
  })

  it('choosing simplified reports the simplified mode', () => {
    const onChoose = vi.fn()
    render(<LargeDocDialog sizeBytes={ELEVEN_MIB} reason="size" onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: t('largeDoc.simplified') }))
    expect(onChoose).toHaveBeenCalledWith('simplified')
  })
})
