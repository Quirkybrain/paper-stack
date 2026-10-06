import { invokeCommand } from './invoke'

import type {
  AccessDecision,
  CheckResourceAccessRequest,
  GrantLocalRootRequest,
  GrantRecord,
  RevokeResult,
} from './types'

/** Authorization service (contracts §8): commands 24–27. */

/** Never rejects: the returned status drives the UI authorization flow. */
export function checkResourceAccess(req: CheckResourceAccessRequest): Promise<AccessDecision> {
  return invokeCommand<AccessDecision>('check_resource_access', { req })
}

export function grantLocalRoot(req: GrantLocalRootRequest): Promise<GrantRecord> {
  return invokeCommand<GrantRecord>('grant_local_root', { req })
}

export function listGrants(): Promise<GrantRecord[]> {
  return invokeCommand<GrantRecord[]>('list_grants')
}

export function revokeGrant(grantId: string): Promise<RevokeResult> {
  return invokeCommand<RevokeResult>('revoke_grant', { grantId })
}
