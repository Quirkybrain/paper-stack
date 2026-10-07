import type { UnlistenFn } from '@tauri-apps/api/event'

import { subscribe } from './events'
import { invokeCommand } from './invoke'

import type { AppInfo, LegalTextKind, LegalTextResult, OpenRequest } from './types'

/** Application service (contracts §8): commands 33–35 and the open event (§4). */

export const OPEN_REQUESTED_EVENT = 'paperstack://open-requested'

export function getAppInfo(): Promise<AppInfo> {
  return invokeCommand<AppInfo>('get_app_info')
}

export function readLegalText(kind: LegalTextKind): Promise<LegalTextResult> {
  return invokeCommand<LegalTextResult>('read_legal_text', { req: { kind } })
}

/** Drains startup/single-instance requests exactly once; later ones arrive as events. */
export function takePendingOpenRequests(): Promise<OpenRequest[]> {
  return invokeCommand<OpenRequest[]>('take_pending_open_requests')
}

export function onOpenRequested(cb: (payload: OpenRequest) => void): Promise<UnlistenFn> {
  return subscribe<OpenRequest>(OPEN_REQUESTED_EVENT, cb)
}
