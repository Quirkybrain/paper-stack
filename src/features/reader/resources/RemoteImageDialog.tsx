import { useId, useRef } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'

/**
 * Remote image session confirmation (T-58; ui-spec §3.8 UI07; IX10; R26;
 * security-model §4).
 *
 * - Lists target domains only (`https://host[:port]`) — never full URLs, file
 *   paths or tokens;
 * - "本次文档允许加载" is session-scoped for the current document only;
 *   there is no persistent or "all network" option (INV-AZ-03);
 * - initial focus is the safe default "保持阻止"; Esc blocks; Tab is trapped
 *   by `Modal` (ui-spec §6.2, EDGE-02).
 */

export interface RemoteImageDialogProps {
  /** Origins (`https://host[:port]`), first-seen order; no paths or tokens. */
  origins: readonly string[]
  onAllow(): void
  /** Safe default action; also reached by Esc. */
  onBlock(): void
}

export function RemoteImageDialog({ origins, onAllow, onBlock }: RemoteImageDialogProps) {
  const blockRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  return (
    <Modal
      labelledBy={titleId}
      onClose={onBlock}
      initialFocusRef={blockRef}
      className="ps-auth-dialog"
    >
      <h2 id={titleId}>{t('dialog.authRemote.title')}</h2>
      <p className="ps-auth-hint">{t('dialog.authRemote.domains')}</p>
      <ul className="ps-auth-domains">
        {origins.map((origin) => (
          <li key={origin}>
            <code>{origin}</code>
          </li>
        ))}
      </ul>
      <p className="ps-auth-hint">{t('dialog.authRemote.sessionNote')}</p>
      <div className="ps-auth-actions">
        <Button ref={blockRef} variant="secondary" onClick={onBlock}>
          {t('dialog.authRemote.blocked')}
        </Button>
        <Button onClick={onAllow}>{t('dialog.authRemote.allow')}</Button>
      </div>
    </Modal>
  )
}
