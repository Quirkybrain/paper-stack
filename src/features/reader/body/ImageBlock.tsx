import type { Element } from 'hast'
import { useEffect, useState, useSyncExternalStore, type ComponentProps } from 'react'

import { t } from '../../../app/i18n'
import { Button } from '../../../components/Button'
import { auth, remote, toErrorPayload } from '../../../services'
import type { AccessDecision, AccessStatus } from '../../../services/types'
import { useReaderUi } from '../ui-context'
import { resourceInvalidation } from '../view/resource-invalidation'
import { resourceAuth } from '../resources/resource-auth'

/**
 * Image block (ui-spec §3.6/§9.1; rendering-pipeline §2.11; R13/R25/R26/R29).
 *
 * The sanitizer keeps the raw `src` string; actual loading always goes through
 * `check_resource_access`, which never rejects and returns the decision. Only
 * `allowed` renders the Rust-generated asset URL; every other status renders
 * an in-block placeholder — no document-driven URL is ever loaded, and no
 * network request happens for blocked remote images.
 *
 * wp-30/wp-31 additions:
 * - blocked decisions feed the aggregation store (`resource-auth`): one prompt
 *   per directory scope for outside-root resources, one per document session
 *   for remote origins; a denial leaves this placeholder with an explicit
 *   action, and only that click re-opens the confirmation (INV-AZ-02/05);
 * - a remote image is fetched through `fetch_remote_image` only when this
 *   document session has a grant for its origin; the default is zero requests.
 *   A failed fetch shows its contract message and a retry that runs exactly
 *   once per explicit click (no automatic retry loops);
 * - `kind=resource` watch events bump this raw `src`'s revision through the
 *   shared `resourceInvalidation` store, re-running the access check so the
 *   Rust `?v=` observation key changes (contract §7.6; INV-VC-07).
 */

export interface ImageBlockProps extends ComponentProps<'img'> {
  node?: Element
  docId: string
  /** Simplified reading subset: placeholder + alt, no decode or network. */
  simplified?: boolean
}

type SettledStatus = Exclude<AccessStatus, 'allowed'> | 'load-failed'

interface ResolvedImage {
  src: string
  status: 'allowed' | SettledStatus
  assetUrl?: string
  /** The decision that produced this state (scope/origin for explicit actions). */
  decision?: AccessDecision
  /** Contract `messageKey` of a failed controlled fetch (remote). */
  errorKey?: string
}

const STATUS_MESSAGE_KEYS: Record<SettledStatus, string> = {
  missing: 'image.missing',
  'outside-root': 'image.outsideRoot',
  'remote-blocked': 'image.remoteBlocked',
  unsupported: 'error.resource.unsupported',
  denied: 'error.auth.denied',
  'load-failed': 'image.loadFailed',
}

export function ImageBlock({ node, docId, simplified = false, ...rest }: ImageBlockProps) {
  const rawSrc = typeof node?.properties?.src === 'string' ? node.properties.src : undefined
  const alt = typeof node?.properties?.alt === 'string' ? node.properties.alt : ''
  const [resolved, setResolved] = useState<ResolvedImage | null>(null)
  /** Explicit retry of a failed remote fetch: one attempt per click. */
  const [retryNonce, setRetryNonce] = useState(0)
  const ui = useReaderUi()

  // Per-resource revision; changes exactly when this resource is invalidated
  // (or when the whole document's resources are re-checked after a grant).
  const revision = useSyncExternalStore(
    (listener) => resourceInvalidation.subscribe(listener),
    () => resourceInvalidation.revisionFor(docId, rawSrc ?? ''),
    () => 0,
  )

  useEffect(() => {
    if (!rawSrc || simplified) return undefined
    let cancelled = false
    const fetchRemote = (decision: AccessDecision) => {
      remote
        .fetchRemoteImage({ docId, url: rawSrc })
        .then((result) => {
          if (!cancelled) {
            setResolved({ src: rawSrc, status: 'allowed', assetUrl: result.assetUrl, decision })
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setResolved({
              src: rawSrc,
              status: 'load-failed',
              decision,
              errorKey: toErrorPayload(error).messageKey,
            })
          }
        })
    }
    auth
      .checkResourceAccess({ docId, rawSrc })
      .then((decision) => {
        if (cancelled) return
        if (decision.status === 'allowed' && decision.assetUrl) {
          if (decision.canonicalPath !== undefined) {
            resourceInvalidation.register(docId, rawSrc, decision.canonicalPath)
          }
          setResolved({ src: rawSrc, status: 'allowed', assetUrl: decision.assetUrl, decision })
          return
        }
        if (decision.status === 'outside-root') {
          resourceAuth.noteLocalDecision(docId, rawSrc, decision)
          setResolved({ src: rawSrc, status: 'outside-root', decision })
          return
        }
        if (decision.status === 'remote-blocked') {
          resourceAuth.noteRemoteDecision(docId, rawSrc, decision)
          // Controlled fetch only after this document session was granted the
          // origin (R26). No grant → placeholder, zero network requests.
          if (decision.origin !== undefined && resourceAuth.hasRemoteGrant(docId, decision.origin)) {
            fetchRemote(decision)
            return
          }
          setResolved({ src: rawSrc, status: 'remote-blocked', decision })
          return
        }
        setResolved({
          src: rawSrc,
          status: decision.status === 'allowed' ? 'load-failed' : decision.status,
          decision,
        })
      })
      .catch(() => {
        if (!cancelled) setResolved({ src: rawSrc, status: 'load-failed' })
      })
    return () => {
      cancelled = true
    }
  }, [docId, rawSrc, revision, simplified, retryNonce])

  // Simplified reading: heavy content shows its source/alt instead of being
  // decoded (rendering-pipeline §5); no access check and no network happen.
  if (simplified) {
    return (
      <span className="ps-image-placeholder" role="note" data-image-state="simplified">
        <span className="ps-image-placeholder-message">{t('document.badge.simplified')}</span>
        {alt !== '' ? <span className="ps-image-alt">{alt}</span> : null}
      </span>
    )
  }

  // Derivation: the current reference has no settled state yet.
  const state: ResolvedImage =
    rawSrc === undefined
      ? { src: '', status: 'missing' }
      : resolved && resolved.src === rawSrc
        ? resolved
        : { src: rawSrc, status: 'missing', assetUrl: undefined }

  if (rawSrc && state.status === 'allowed' && state.assetUrl !== undefined) {
    const assetUrl = state.assetUrl
    const handleLoad = () => ui?.notifyLayoutChange?.()
    if (!ui) return <img key={assetUrl} {...rest} src={assetUrl} alt={alt} onLoad={handleLoad} />
    return (
      <span className="ps-image" data-image-state="allowed">
        <img key={assetUrl} {...rest} src={assetUrl} alt={alt} onLoad={handleLoad} />
        <Button
          variant="secondary"
          className="ps-image-zoom"
          onClick={() =>
            ui.openZoom({
              label: alt !== '' ? alt : rawSrc,
              content: <img src={assetUrl} alt={alt} />,
            })
          }
        >
          {t('zoom.title')}
        </Button>
      </span>
    )
  }
  if (rawSrc && !(resolved && resolved.src === rawSrc)) {
    return (
      <span className="ps-image-placeholder" role="status" data-image-state="checking">
        {t('common.loading')}
      </span>
    )
  }
  const status: SettledStatus =
    state.status === 'allowed' ? 'load-failed' : (state.status as SettledStatus)
  const messageKey = state.errorKey ?? STATUS_MESSAGE_KEYS[status]
  const localScope = state.decision?.rootCandidate ?? null
  const remoteOrigin = state.decision?.origin ?? null
  const showLocalAction = status === 'outside-root' && localScope !== null && localScope !== ''
  const showRemoteAction = status === 'remote-blocked' && remoteOrigin !== null && remoteOrigin !== ''
  const showRetry = status === 'load-failed' && state.errorKey !== undefined
  return (
    <span className="ps-image-placeholder" role="note" data-image-state={status}>
      <span className="ps-image-placeholder-message">{t(messageKey)}</span>
      {rawSrc !== undefined ? (
        <code className="ps-image-placeholder-path">{t('image.relPath', { path: rawSrc })}</code>
      ) : null}
      {showLocalAction || showRemoteAction || showRetry ? (
        <span className="ps-image-placeholder-actions">
          {showLocalAction && localScope !== null && localScope !== '' ? (
            <Button
              variant="secondary"
              onClick={() => resourceAuth.openLocalPrompt(docId, localScope)}
            >
              {t('image.allowScope')}
            </Button>
          ) : null}
          {showRemoteAction && remoteOrigin !== null && remoteOrigin !== '' ? (
            <Button
              variant="secondary"
              onClick={() => resourceAuth.openRemotePrompt(docId, remoteOrigin)}
            >
              {t('image.allowOnce')}
            </Button>
          ) : null}
          {showRetry ? (
            <Button variant="secondary" onClick={() => setRetryNonce((nonce) => nonce + 1)}>
              {t('image.retry')}
            </Button>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
