import { listen, type Event as TauriEvent, type UnlistenFn } from '@tauri-apps/api/event'

/**
 * Event subscription helpers (contracts §4).
 *
 * Tauri `listen` returns an `UnlistenFn`; components and the future bridge
 * must dispose every subscription. `SubscriptionBag` makes that disposal
 * leak-proof: a subscription that resolves after `dispose()` is unlistened
 * immediately instead of staying registered.
 */

export type EventHandler<T> = (payload: T) => void

/** Subscribes to a Tauri event and forwards only its payload. */
export async function subscribe<T>(eventName: string, handler: EventHandler<T>): Promise<UnlistenFn> {
  return listen<T>(eventName, (event: TauriEvent<T>) => {
    handler(event.payload)
  })
}

export class SubscriptionBag {
  #unlisteners = new Set<UnlistenFn>()
  #pending = new Set<Promise<void>>()
  #disposed = false

  /**
   * Registers a pending subscription. If the bag has already been disposed,
   * the subscription is unlistened as soon as it resolves (never leaked).
   */
  track(subscription: Promise<UnlistenFn>): void {
    const settling = subscription.then(
      (unlisten) => {
        if (this.#disposed) unlisten()
        else this.#unlisteners.add(unlisten)
      },
      () => undefined,
    )
    this.#pending.add(settling)
    void settling.then(() => {
      this.#pending.delete(settling)
    })
  }

  get disposed(): boolean {
    return this.#disposed
  }

  /** Unlistens everything tracked so far and awaits in-flight registrations. */
  async dispose(): Promise<void> {
    this.#disposed = true
    for (const unlisten of this.#unlisteners) unlisten()
    this.#unlisteners.clear()
    await Promise.allSettled([...this.#pending])
  }
}
