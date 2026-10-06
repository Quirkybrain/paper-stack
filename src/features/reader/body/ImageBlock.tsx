import type { Element } from 'hast'
import { useEffect, useState, type ComponentProps } from 'react'

import { t } from '../../../app/i18n'
import { auth } from '../../../services'
import type { AccessStatus } from '../../../services/types'

/**
 * Image block (ui-spec §3.6/§9.1; rendering-pipeline §2.11; R13/R25/R26).
 *
 * The sanitizer keeps the raw `src` string; actual loading always goes through
 * `check_resource_access`, which never rejects and returns the decision. Only
 * `allowed` renders the Rust-generated asset URL; every other status renders
 * an in-block placeholder — no document-driven URL is ever loaded, and no
 * network request happens for blocked remote images.
 *
 * Grant flows, aggregated prompts and the zoom overlay belong to later tasks
 * (wp-26/29); this minimal block intentionally offers no action it cannot
 * honor. The resolution state is keyed by `src`, so a changed reference is
 * derived as "checking" without resetting state inside an effect.
 */

export interface ImageBlockProps extends ComponentProps<'img'> {
  node?: Element
  docId: string
}

type SettledStatus = Exclude<AccessStatus, 'allowed'> | 'load-failed'

interface ResolvedImage {
  src: string
  status: 'allowed' | SettledStatus
  assetUrl?: string
}

const STATUS_MESSAGE_KEYS: Record<SettledStatus, string> = {
  missing: 'image.missing',
  'outside-root': 'image.outsideRoot',
  'remote-blocked': 'image.remoteBlocked',
  unsupported: 'error.resource.unsupported',
  denied: 'error.auth.denied',
  'load-failed': 'image.loadFailed',
}

export function ImageBlock({ node, docId, ...rest }: ImageBlockProps) {
  const rawSrc = typeof node?.properties?.src === 'string' ? node.properties.src : undefined
  const alt = typeof node?.properties?.alt === 'string' ? node.properties.alt : ''
  const [resolved, setResolved] = useState<ResolvedImage | null>(null)

  useEffect(() => {
    if (!rawSrc) return undefined
    let cancelled = false
    auth
      .checkResourceAccess({ docId, rawSrc })
      .then((decision) => {
        if (cancelled) return
        if (decision.status === 'allowed' && decision.assetUrl) {
          setResolved({ src: rawSrc, status: 'allowed', assetUrl: decision.assetUrl })
          return
        }
        setResolved({
          src: rawSrc,
          status: decision.status === 'allowed' ? 'load-failed' : decision.status,
        })
      })
      .catch(() => {
        if (!cancelled) setResolved({ src: rawSrc, status: 'load-failed' })
      })
    return () => {
      cancelled = true
    }
  }, [docId, rawSrc])

  // Derivation: the current reference has no settled state yet.
  const state: ResolvedImage =
    rawSrc === undefined
      ? { src: '', status: 'missing' }
      : resolved && resolved.src === rawSrc
        ? resolved
        : { src: rawSrc, status: 'missing', assetUrl: undefined }

  if (rawSrc && state.status === 'allowed' && state.assetUrl !== undefined) {
    return <img {...rest} src={state.assetUrl} alt={alt} />
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
  return (
    <span className="ps-image-placeholder" role="note" data-image-state={status}>
      <span className="ps-image-placeholder-message">{t(STATUS_MESSAGE_KEYS[status])}</span>
      {rawSrc !== undefined ? (
        <code className="ps-image-placeholder-path">{t('image.relPath', { path: rawSrc })}</code>
      ) : null}
    </span>
  )
}
