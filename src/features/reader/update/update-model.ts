import type { UpdateMode } from '../../../services/types'
import type { UpdatePositionResult } from '../../../app/session'
import type { RestoreResult } from '../position/position'

/**
 * Update-mode decision model (models §4; ui-spec §3.8; IXD §10.2; T-53;
 * R21/AT21; INV-UM-01..08).
 *
 * The pure functions here are the testable oracle of the keep/follow matrix:
 * they decide *when* a stable candidate may commit, but never perform the
 * commit itself — the commit goes through the wp-16 session reducer's §6
 * token/generation rule (INV-VC-*), which stays the single guard against late
 * or superseded results. Keeping the two separate is deliberate: a policy
 * change here can never weaken the version-correctness rule.
 */

export type FollowPauseReason = 'selection' | 'inspect'

export interface UpdateDecisionInput {
  /** `pendingVersion ≠ displayVersion` (INV-VC-05). */
  hasPending: boolean
  mode: UpdateMode
  isActiveTab: boolean
  /** A non-empty document selection exists (INV-UM-03). */
  hasSelection: boolean
  /** The inspect drawer is open over this tab (INV-UM-02 "覆盖/检查操作"). */
  hasInspectLayer: boolean
}

export type UpdateDecision =
  | { kind: 'none' }
  /** Default keep mode: never auto-replace, the banner offers the action. */
  | { kind: 'keep' }
  /** Follow mode, condition blocked: candidate stays, re-evaluated later. */
  | { kind: 'follow-paused'; reason: FollowPauseReason }
  /** Follow mode, tab in the background: activate first, never steal focus. */
  | { kind: 'follow-deferred' }
  /** Follow mode, all conditions hold: commit now. */
  | { kind: 'follow-commit' }

/** §4.1 flow chart as a total function (INV-UM-01/02/03/04). */
export function resolveUpdateDecision(input: UpdateDecisionInput): UpdateDecision {
  if (!input.hasPending) return { kind: 'none' }
  if (input.mode === 'keep') return { kind: 'keep' }
  if (!input.isActiveTab) return { kind: 'follow-deferred' }
  if (input.hasSelection) return { kind: 'follow-paused', reason: 'selection' }
  if (input.hasInspectLayer) return { kind: 'follow-paused', reason: 'inspect' }
  return { kind: 'follow-commit' }
}

export interface UpdateBannerInput extends UpdateDecisionInput {
  /** "稍后" collapsed the banner; the pending candidate stays (INV-UM-05). */
  collapsed: boolean
  /** User dismissed the paused notice for the current candidate. */
  pauseDismissed: boolean
}

export type UpdateBannerVariant =
  | { kind: 'hidden' }
  | { kind: 'banner'; updateAction: 'update.action.now' | 'update.action.updateAndClearSelection' }
  | { kind: 'paused'; reason: FollowPauseReason }
  | { kind: 'collapsed' }

/**
 * Selects the UpdateBanner variant for the *active* tab. A committed follow
 * update leaves no banner; a deferred background candidate shows only the
 * tab marker, never a banner in another tab (INV-UM-04/06).
 */
export function selectUpdateBanner(input: UpdateBannerInput): UpdateBannerVariant {
  if (!input.hasPending) return { kind: 'hidden' }
  const decision = resolveUpdateDecision(input)
  switch (decision.kind) {
    case 'none':
    case 'follow-commit':
    case 'follow-deferred':
      return { kind: 'hidden' }
    case 'follow-paused':
      if (!input.pauseDismissed) return { kind: 'paused', reason: decision.reason }
      return input.collapsed
        ? { kind: 'collapsed' }
        : { kind: 'banner', updateAction: updateActionKey(input.hasSelection) }
    case 'keep':
      return input.collapsed
        ? { kind: 'collapsed' }
        : { kind: 'banner', updateAction: updateActionKey(input.hasSelection) }
    default:
      return assertNever(decision)
  }
}

/**
 * With a selection present the explicit action must name the consequence
 * ("更新并清除选区"); an ambiguous 确定/现在更新 is forbidden (INV-UM-03).
 */
export function updateActionKey(
  hasSelection: boolean,
): 'update.action.now' | 'update.action.updateAndClearSelection' {
  return hasSelection ? 'update.action.updateAndClearSelection' : 'update.action.now'
}

export function pausedMessageKey(reason: FollowPauseReason): string {
  return reason === 'selection' ? 'update.paused.selection' : 'update.paused.inspect'
}

/** Effective mode: session override (in-memory only) over the global default. */
export function effectiveUpdateMode(
  override: UpdateMode | null,
  globalDefault: UpdateMode,
): UpdateMode {
  return override ?? globalDefault
}

/** §6.3 message for a commit's paired position result (INV-UM-08 / INV-VC-11). */
export function positionMessageKey(
  position: UpdatePositionResult,
): 'update.position.exact' | 'update.position.approx' {
  return position === 'exact' ? 'update.position.exact' : 'update.position.approx'
}

/** Maps the §6 restore decision to the paired update position result. */
export function updatePositionForRestore(result: RestoreResult): UpdatePositionResult {
  return result.kind === 'exact' ? 'exact' : 'approx'
}

function assertNever(value: never): never {
  throw new Error(`unreachable update decision: ${String(value)}`)
}
