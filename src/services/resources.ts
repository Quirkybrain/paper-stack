import { invokeCommand } from './invoke'

import type {
  FetchRemoteImageRequest,
  GrantRecord,
  GrantRemoteSessionRequest,
  RemoteImageResult,
  RevokeResult,
} from './types'

/**
 * Remote image service (commands 28–30).
 *
 * The contract module namespace is `remote` (§2 command index, §8); this file
 * is named `resources.ts` to mirror the Rust `commands/resources.rs` module.
 */

export function grantRemoteSession(req: GrantRemoteSessionRequest): Promise<GrantRecord> {
  return invokeCommand<GrantRecord>('grant_remote_session', { req })
}

export function revokeRemoteSession(docId: string): Promise<RevokeResult> {
  return invokeCommand<RevokeResult>('revoke_remote_session', { docId })
}

/** No automatic retry: a manual retry calls this command again (R26). */
export function fetchRemoteImage(req: FetchRemoteImageRequest): Promise<RemoteImageResult> {
  return invokeCommand<RemoteImageResult>('fetch_remote_image', { req })
}
