import { t } from '../../../app/i18n'
import { Banner } from '../../../components/Banner'
import { Button } from '../../../components/Button'
import { pausedMessageKey, type UpdateBannerVariant } from './update-model'

/**
 * Non-modal update banner (ui-spec §3.8 UI07; VC-08; models §4; T-53).
 *
 * The component is purely presentational: the keep/follow policy lives in
 * `update-model.ts` and the commit itself goes through the reader controller
 * and the §6 session commit rule. Rendering rules encoded here:
 * - `banner` never steals focus (`Banner` is `role="status"`, not in the Tab
 *   order) and offers 现在更新 / 稍后;
 * - with a selection present the primary action must read
 *   "更新并清除选区" — never an ambiguous confirm (INV-UM-03);
 * - `paused` explains why the automatic update is paused and offers 继续阅读;
 * - `collapsed` is only the textual "有新版本" marker that can reopen the
 *   banner ("稍后" keeps the pending candidate, INV-UM-05).
 */

export interface UpdateBannerProps {
  variant: UpdateBannerVariant
  onUpdate(): void
  onLater(): void
  onReopen(): void
  onContinue(): void
}

export function UpdateBanner({ variant, onUpdate, onLater, onReopen, onContinue }: UpdateBannerProps) {
  if (variant.kind === 'hidden') return null

  if (variant.kind === 'collapsed') {
    return (
      <Button
        variant="secondary"
        className="ps-update-marker"
        onClick={onReopen}
        aria-label={t('update.badge')}
      >
        {t('update.badge')}
      </Button>
    )
  }

  if (variant.kind === 'paused') {
    return (
      <Banner
        tone="warn"
        label={t('aria.updateBanner')}
        actions={
          <Button variant="secondary" onClick={onContinue}>
            {t('update.action.continueReading')}
          </Button>
        }
      >
        {t(pausedMessageKey(variant.reason))}
      </Banner>
    )
  }

  return (
    <Banner
      tone="warn"
      label={t('aria.updateBanner')}
      className="ps-update-banner"
      actions={
        <>
          <Button variant="primary" onClick={onUpdate}>
            {t(variant.updateAction)}
          </Button>
          <Button variant="secondary" onClick={onLater}>
            {t('update.action.later')}
          </Button>
        </>
      }
    >
      {t('update.banner')}
    </Banner>
  )
}
