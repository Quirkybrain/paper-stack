import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

import { listen, type Event as TauriEvent, type UnlistenFn } from '@tauri-apps/api/event'

import { OPEN_REQUESTED_EVENT, onOpenRequested } from './app'
import { SubscriptionBag, subscribe } from './events'
import { WATCH_CHANGED_EVENT, onWatchChanged } from './watch'

const listenMock = vi.mocked(listen)

function tauriEvent<T>(event: string, payload: T): TauriEvent<T> {
  return { event, id: 1, payload }
}

describe('event subscription helpers', () => {
  beforeEach(() => {
    listenMock.mockReset()
  })

  it('subscribe forwards only the payload', async () => {
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)
    const handler = vi.fn()
    const result = await subscribe<{ value: number }>('demo://event', handler)
    expect(listenMock).toHaveBeenCalledWith('demo://event', expect.any(Function))
    expect(result).toBe(unlisten)

    const listener = listenMock.mock.calls[0][1]
    listener(tauriEvent('demo://event', { value: 7 }))
    expect(handler).toHaveBeenCalledWith({ value: 7 })
  })

  it('watch and open-request wrappers use the contract event names', async () => {
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)
    const watchHandler = vi.fn()
    const openHandler = vi.fn()

    await onWatchChanged(watchHandler)
    expect(listenMock).toHaveBeenLastCalledWith(WATCH_CHANGED_EVENT, expect.any(Function))
    listenMock.mock.calls[listenMock.mock.calls.length - 1][1](
      tauriEvent(WATCH_CHANGED_EVENT, { docId: 'd-1', kind: 'modified', observedAtMs: 5 }),
    )
    expect(watchHandler).toHaveBeenCalledWith({ docId: 'd-1', kind: 'modified', observedAtMs: 5 })

    await onOpenRequested(openHandler)
    expect(listenMock).toHaveBeenLastCalledWith(OPEN_REQUESTED_EVENT, expect.any(Function))
    listenMock.mock.calls[listenMock.mock.calls.length - 1][1](
      tauriEvent(OPEN_REQUESTED_EVENT, { paths: ['/tmp/a.md'], cwd: null, source: 'cli' }),
    )
    expect(openHandler).toHaveBeenCalledWith({ paths: ['/tmp/a.md'], cwd: null, source: 'cli' })
  })

  it('SubscriptionBag disposes every registered listener once', async () => {
    const first = vi.fn()
    const second = vi.fn()
    listenMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const bag = new SubscriptionBag()
    bag.track(subscribe('a://x', vi.fn()))
    bag.track(subscribe('b://y', vi.fn()))
    await Promise.resolve()
    await Promise.resolve()

    await bag.dispose()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(bag.disposed).toBe(true)
    await bag.dispose()
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('SubscriptionBag unlistens a subscription that resolves after dispose', async () => {
    let resolveListen: (unlisten: UnlistenFn) => void = () => undefined
    listenMock.mockImplementation(
      () =>
        new Promise<UnlistenFn>((resolve) => {
          resolveListen = resolve
        }),
    )
    const bag = new SubscriptionBag()
    bag.track(subscribe('c://z', vi.fn()))

    const disposeDone = bag.dispose()
    const late = vi.fn()
    resolveListen(late)
    await disposeDone
    expect(late).toHaveBeenCalledTimes(1)
  })
})
