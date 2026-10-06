import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { onOpenRequested } from '../services/app'
import { SubscriptionBag } from '../services/events'
import { onWatchChanged } from '../services/watch'
import type { OpenRequest, WatchChangedPayload } from '../services/types'

/**
 * Tauri event bridge (contracts §4; models §3; T-23 deferred from wp-16).
 *
 * Consumes:
 * - `paperstack://watch-changed` → recheck/refresh handler (payload never
 *   carries content);
 * - `paperstack://open-requested` → open via the service layer;
 * - window focus (built-in) → recheck hook; missed-event compensation;
 * - `tauri://close-requested` (built-in) → flush the session save, with the
 *   handler free to `preventDefault()` once so a failure can be surfaced
 *   honestly (NF08);
 * - drag-and-drop (built-in `onDragDropEvent`) → paths open through the same
 *   validation as every other entry; non-drop phases are ignored.
 *
 * The module is transport-only: all policy lives in the injected handlers, so
 * unit tests drive fake subscriptions without a WebView.
 */

export interface CloseRequestedLike {
  preventDefault(): void
}

export interface DragDropPayloadLike {
  type: string
  paths: string[]
}

export interface EventBridgeHandlers {
  onWatchChanged(payload: WatchChangedPayload): void
  onOpenRequested(request: OpenRequest): void
  onFocusChanged(focused: boolean): void
  onCloseRequested(event: CloseRequestedLike): void | Promise<void>
  onDragDrop(paths: string[]): void
}

export interface EventBridgeDeps {
  subscribeWatch(handler: (payload: WatchChangedPayload) => void): Promise<UnlistenFn>
  subscribeOpenRequested(handler: (request: OpenRequest) => void): Promise<UnlistenFn>
  subscribeFocus(handler: (focused: boolean) => void): Promise<UnlistenFn>
  subscribeCloseRequested(
    handler: (event: CloseRequestedLike) => void | Promise<void>,
  ): Promise<UnlistenFn>
  subscribeDragDrop(handler: (payload: DragDropPayloadLike) => void): Promise<UnlistenFn>
}

/** Real Tauri wiring; created lazily so importing the module never touches the WebView. */
export function defaultEventBridgeDeps(): EventBridgeDeps {
  return {
    subscribeWatch: (handler) => onWatchChanged(handler),
    subscribeOpenRequested: (handler) => onOpenRequested(handler),
    subscribeFocus: async (handler) => {
      const window = getCurrentWindow()
      return window.onFocusChanged(({ payload }) => handler(payload))
    },
    subscribeCloseRequested: async (handler) => {
      const window = getCurrentWindow()
      return window.onCloseRequested((event) => handler(event))
    },
    subscribeDragDrop: async (handler) => {
      const window = getCurrentWindow()
      return window.onDragDropEvent((event) => {
        const payload = event.payload
        if (payload.type === 'drop') {
          handler({ type: 'drop', paths: payload.paths })
        }
      })
    },
  }
}

export interface EventBridge {
  readonly started: boolean
  start(): Promise<void>
  dispose(): Promise<void>
}

export function createEventBridge(
  handlers: EventBridgeHandlers,
  deps: EventBridgeDeps = defaultEventBridgeDeps(),
): EventBridge {
  const bag = new SubscriptionBag()
  let started = false

  return {
    get started() {
      return started
    },
    async start() {
      if (started) return
      started = true
      bag.track(deps.subscribeWatch(handlers.onWatchChanged))
      bag.track(deps.subscribeOpenRequested(handlers.onOpenRequested))
      bag.track(deps.subscribeFocus(handlers.onFocusChanged))
      bag.track(deps.subscribeCloseRequested(handlers.onCloseRequested))
      bag.track(
        deps.subscribeDragDrop((payload) => {
          if (payload.type === 'drop') handlers.onDragDrop(payload.paths)
        }),
      )
    },
    async dispose() {
      started = false
      await bag.dispose()
    },
  }
}
