import { describe, expect, it } from 'vitest'

import {
  effectiveUpdateMode,
  pausedMessageKey,
  positionMessageKey,
  resolveUpdateDecision,
  selectUpdateBanner,
  updateActionKey,
  updatePositionForRestore,
  type UpdateDecisionInput,
} from './update-model'

/**
 * Update-mode matrix oracle (models §4; ui-spec §3.8; INV-UM-01..08; T-53).
 */

const base: UpdateDecisionInput = {
  hasPending: true,
  mode: 'keep',
  isActiveTab: true,
  hasSelection: false,
  hasInspectLayer: false,
}

describe('keep/follow decision matrix (INV-UM-01..04)', () => {
  it('does nothing without a pending candidate', () => {
    expect(resolveUpdateDecision({ ...base, hasPending: false })).toEqual({ kind: 'none' })
  })

  it('keep is the default and never auto-replaces', () => {
    expect(resolveUpdateDecision(base)).toEqual({ kind: 'keep' })
    expect(
      resolveUpdateDecision({ ...base, mode: 'keep', hasSelection: true, hasInspectLayer: true }),
    ).toEqual({ kind: 'keep' })
  })

  it('follow commits only for the active tab with no selection and no inspect layer', () => {
    expect(resolveUpdateDecision({ ...base, mode: 'follow' })).toEqual({ kind: 'follow-commit' })
  })

  it('follow defers for a background tab even when other conditions hold', () => {
    expect(resolveUpdateDecision({ ...base, mode: 'follow', isActiveTab: false })).toEqual({
      kind: 'follow-deferred',
    })
  })

  it('selection pauses automatic updates first (INV-UM-03)', () => {
    expect(
      resolveUpdateDecision({ ...base, mode: 'follow', hasSelection: true }),
    ).toEqual({ kind: 'follow-paused', reason: 'selection' })
    // Selection wins over the inspect layer (both pause).
    expect(
      resolveUpdateDecision({
        ...base,
        mode: 'follow',
        hasSelection: true,
        hasInspectLayer: true,
      }),
    ).toEqual({ kind: 'follow-paused', reason: 'selection' })
  })

  it('the inspect layer pauses automatic updates (INV-UM-02)', () => {
    expect(
      resolveUpdateDecision({ ...base, mode: 'follow', hasInspectLayer: true }),
    ).toEqual({ kind: 'follow-paused', reason: 'inspect' })
  })
})

describe('banner selection (INV-UM-05/08)', () => {
  const bannerBase = { ...base, collapsed: false, pauseDismissed: false }

  it('is hidden without a pending candidate and after a follow commit', () => {
    expect(selectUpdateBanner({ ...bannerBase, hasPending: false })).toEqual({ kind: 'hidden' })
    expect(selectUpdateBanner({ ...bannerBase, mode: 'follow' })).toEqual({ kind: 'hidden' })
    expect(
      selectUpdateBanner({ ...bannerBase, mode: 'follow', isActiveTab: false }),
    ).toEqual({ kind: 'hidden' })
  })

  it('keep shows the non-modal banner with 现在更新 / 稍后', () => {
    expect(selectUpdateBanner(bannerBase)).toEqual({
      kind: 'banner',
      updateAction: 'update.action.now',
    })
  })

  it('names the explicit action when a selection exists (never ambiguous)', () => {
    expect(selectUpdateBanner({ ...bannerBase, hasSelection: true })).toEqual({
      kind: 'banner',
      updateAction: 'update.action.updateAndClearSelection',
    })
    expect(updateActionKey(true)).toBe('update.action.updateAndClearSelection')
    expect(updateActionKey(false)).toBe('update.action.now')
  })

  it('shows the paused explanation until dismissed, then the explicit banner', () => {
    const paused = selectUpdateBanner({
      ...bannerBase,
      mode: 'follow',
      hasSelection: true,
    })
    expect(paused).toEqual({ kind: 'paused', reason: 'selection' })
    expect(selectUpdateBanner({ ...bannerBase, mode: 'follow', hasInspectLayer: true })).toEqual({
      kind: 'paused',
      reason: 'inspect',
    })
    expect(
      selectUpdateBanner({
        ...bannerBase,
        mode: 'follow',
        hasSelection: true,
        pauseDismissed: true,
      }),
    ).toEqual({ kind: 'banner', updateAction: 'update.action.updateAndClearSelection' })
  })

  it('collapses "later" to the textual marker and can reopen (INV-UM-05)', () => {
    expect(selectUpdateBanner({ ...bannerBase, collapsed: true })).toEqual({ kind: 'collapsed' })
    expect(
      selectUpdateBanner({ ...bannerBase, collapsed: true, pauseDismissed: true, mode: 'follow', hasSelection: true }),
    ).toEqual({ kind: 'collapsed' })
  })

  it('maps pause and position messages to the catalog keys', () => {
    expect(pausedMessageKey('selection')).toBe('update.paused.selection')
    expect(pausedMessageKey('inspect')).toBe('update.paused.inspect')
    expect(positionMessageKey('exact')).toBe('update.position.exact')
    expect(positionMessageKey('approx')).toBe('update.position.approx')
  })
})

describe('effective mode and restore mapping (INV-UM-07)', () => {
  it('uses the session override over the global default and never persists it', () => {
    expect(effectiveUpdateMode(null, 'keep')).toBe('keep')
    expect(effectiveUpdateMode('follow', 'keep')).toBe('follow')
    expect(effectiveUpdateMode('keep', 'follow')).toBe('keep')
  })

  it('pairs exact restores with the exact position result', () => {
    expect(
      updatePositionForRestore({ kind: 'exact', blockId: 'b1', offsetRatio: 0, reason: 'fingerprint' }),
    ).toBe('exact')
    expect(
      updatePositionForRestore({ kind: 'approx', blockId: null, headingPath: null, reason: 'top' }),
    ).toBe('approx')
  })
})
