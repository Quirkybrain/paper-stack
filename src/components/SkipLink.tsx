import { t } from '../app/i18n'

/** The landmark id the skip link targets; the reading body uses it too. */
export const DOCUMENT_BODY_ID = 'ps-document-body'

/**
 * Skip-to-body link (ui-spec §6.2): visually hidden until focused, then
 * appears at the top-left (`.ps-skip-link` in `base.css`).
 */

export interface SkipLinkProps {
  targetId?: string
}

export function SkipLink({ targetId = DOCUMENT_BODY_ID }: SkipLinkProps) {
  return (
    <a className="ps-skip-link" href={`#${targetId}`}>
      {t('aria.skipToBody')}
    </a>
  )
}
