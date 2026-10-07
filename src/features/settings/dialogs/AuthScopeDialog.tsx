import { useId, useRef, useState } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'

/**
 * Local out-of-root scope confirmation (T-57; ui-spec §3.8 UI07; IX10;
 * R25; models §8).
 *
 * - Shows the normalized canonical range and the aggregated resource count;
 *   one prompt per directory scope, never one per image (INV-AZ-02);
 * - explicitly states that source files are not written (read-only promise);
 * - "记住此目录授权" is unchecked by default and the session grant is the
 *   default action; ticking it only then requests a persistent grant
 *   (INV-AZ-03) — no implicit upgrade, no "always allow all" shortcut;
 * - initial focus is the safe default "保持阻止"; Esc maps to blocking; Tab is
 *   trapped by `Modal` (ui-spec §6.2, EDGE-02).
 */

export interface AuthScopeDialogProps {
  /** Canonical, normalized directory scope from Rust `rootCandidate`. */
  scopePath: string
  /** Distinct out-of-root resources aggregated for this scope. */
  resourceCount: number
  /** `persist` is the "记住此目录授权" checkbox value (default false). */
  onAllow(persist: boolean): void
  /** Safe default action; also reached by Esc. */
  onBlock(): void
}

export function AuthScopeDialog({
  scopePath,
  resourceCount,
  onAllow,
  onBlock,
}: AuthScopeDialogProps) {
  const [remember, setRemember] = useState(false)
  const blockRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  return (
    <Modal
      labelledBy={titleId}
      onClose={onBlock}
      initialFocusRef={blockRef}
      className="ps-auth-dialog"
    >
      <h2 id={titleId}>{t('dialog.authLocal.title')}</h2>
      <p className="ps-auth-scope">{t('dialog.authLocal.scope', { path: scopePath })}</p>
      <p className="ps-auth-count">{t('dialog.authLocal.count', { count: resourceCount })}</p>
      <p className="ps-auth-hint">{t('dialog.authLocal.noWrite')}</p>
      <label className="ps-auth-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>{t('dialog.authLocal.remember')}</span>
      </label>
      <p className="ps-auth-hint">{t('dialog.authLocal.rememberHint')}</p>
      <div className="ps-auth-actions">
        <Button ref={blockRef} variant="secondary" onClick={onBlock}>
          {t('dialog.authLocal.blocked')}
        </Button>
        <Button onClick={() => onAllow(remember)}>{t('dialog.authLocal.allow')}</Button>
      </div>
    </Modal>
  )
}
