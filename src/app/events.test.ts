import { describe, expect, it, vi } from 'vitest'

import {
  createEventBridge,
  type CloseRequestedLike,
  type EventBridgeDeps,
  type EventBridgeHandlers,
} from './events'

/**
 * Event bridge transport tests (contracts §4): subscriptions, forwarding,
 * drag-drop filtering and disposal — driven by fake transport, no WebView.
 */

interface FakeBridge {
  deps: EventBridgeDeps
  fireWatch(payload: unknown): void
  fireOpen(request: unknown): void
  fireFocus(focused: boolean): void
  fireClose(event: CloseRequestedLike): Promise<void>
  fireDrag(payload: { type: string; paths: string[] }): void
  unlisteners: ReturnType<typeof vi.fn>[]
}

function fakeDeps(): FakeBridge {
  const unlisteners: ReturnType<typeof vi.fn>[] = []
  const watch: Array<(payload: unknown) => void> = []
  const open: Array<(request: unknown) => void> = []
  const focus: Array<(focused: boolean) => void> = []
  const close: Array<(event: CloseRequestedLike) => void | Promise<void>> = []
  const drag: Array<(payload: { type: string; paths: string[] }) => void> = []

  const subscribe = <T>(bucket: T[], handler: T) => {
    bucket.push(handler)
    const unlisten = vi.fn(() => {
      const index = bucket.indexOf(handler)
      if (index !== -1) bucket.splice(index, 1)
    })
    unlisteners.push(unlisten)
    return Promise.resolve(unlisten)
  }

  return {
    deps: {
      subscribeWatch: (handler) => subscribe(watch, handler),
      subscribeOpenRequested: (handler) => subscribe(open, handler),
      subscribeFocus: (handler) => subscribe(focus, handler),
      subscribeCloseRequested: (handler) => subscribe(close, handler),
      subscribeDragDrop: (handler) => subscribe(drag, handler),
    },
    fireWatch: (payload) => watch.forEach((handler) => handler(payload)),
    fireOpen: (request) => open.forEach((handler) => handler(request)),
    fireFocus: (focused) => focus.forEach((handler) => handler(focused)),
    fireClose: (event) => Promise.all(close.map((handler) => handler(event))).then(() => undefined),
    fireDrag: (payload) => drag.forEach((handler) => handler(payload)),
    unlisteners,
  }
}

function handlers(): EventBridgeHandlers & {
  watch: ReturnType<typeof vi.fn>
  open: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  drop: ReturnType<typeof vi.fn>
} {
  const watch = vi.fn()
  const open = vi.fn()
  const focus = vi.fn()
  const close = vi.fn()
  const drop = vi.fn()
  return {
    watch,
    open,
    focus,
    close,
    drop,
    onWatchChanged: watch,
    onOpenRequested: open,
    onFocusChanged: focus,
    onCloseRequested: close,
    onDragDrop: drop,
  }
}

describe('createEventBridge', () => {
  it('subscribes once and forwards every event kind', async () => {
    const fake = fakeDeps()
    const spies = handlers()
    const bridge = createEventBridge(spies, fake.deps)
    await bridge.start()
    await bridge.start()
    expect(bridge.started).toBe(true)
    expect(fake.unlisteners).toHaveLength(5)

    const watchPayload = { docId: 'd-a', kind: 'modified', observedAtMs: 1 }
    fake.fireWatch(watchPayload)
    expect(spies.watch).toHaveBeenCalledWith(watchPayload)

    const request = { paths: ['/a.md'], cwd: null, source: 'cli' }
    fake.fireOpen(request)
    expect(spies.open).toHaveBeenCalledWith(request)

    fake.fireFocus(true)
    expect(spies.focus).toHaveBeenCalledWith(true)

    await fake.fireClose({ preventDefault: vi.fn() })
    expect(spies.close).toHaveBeenCalledTimes(1)

    fake.fireDrag({ type: 'over', paths: [] })
    fake.fireDrag({ type: 'drop', paths: ['/dropped.md'] })
    expect(spies.drop).toHaveBeenCalledTimes(1)
    expect(spies.drop).toHaveBeenCalledWith(['/dropped.md'])
  })

  it('disposes every subscription and allows a restart-free teardown', async () => {
    const fake = fakeDeps()
    const spies = handlers()
    const bridge = createEventBridge(spies, fake.deps)
    await bridge.start()
    await bridge.dispose()
    expect(bridge.started).toBe(false)
    for (const unlisten of fake.unlisteners) expect(unlisten).toHaveBeenCalledTimes(1)
    // The fake transport still holds the handler closures in this test double,
    // but the real listeners were unlistened; the bag is disposed and start()
    // cannot resurrect it.
    fake.fireWatch({ docId: 'd-a', kind: 'modified', observedAtMs: 1 })
    expect(spies.watch).not.toHaveBeenCalled()
  })
})
