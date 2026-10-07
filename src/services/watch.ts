import type { UnlistenFn } from '@tauri-apps/api/event'

import { subscribe } from './events'
import { invokeCommand } from './invoke'

import type { WatchChangedPayload, WatchRequest } from './types'

/** Watch service (contracts §8): commands 11–12 and the watch event (§4). */

export const WATCH_CHANGED_EVENT = 'paperstack://watch-changed'

export function watchDocument(req: WatchRequest): Promise<void> {
  return invokeCommand<void>('watch_document', { req })
}

export function unwatchDocument(docId: string): Promise<void> {
  return invokeCommand<void>('unwatch_document', { docId })
}

export function onWatchChanged(cb: (payload: WatchChangedPayload) => void): Promise<UnlistenFn> {
  return subscribe<WatchChangedPayload>(WATCH_CHANGED_EVENT, cb)
}
