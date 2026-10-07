import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Element } from 'hast'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkResourceAccessMock = vi.hoisted(() => vi.fn())
const fetchRemoteImageMock = vi.hoisted(() => vi.fn())
const grantRemoteSessionMock = vi.hoisted(() => vi.fn())
const grantLocalRootMock = vi.hoisted(() => vi.fn())

vi.mock('../../../services', () => ({
  auth: {
    checkResourceAccess: checkResourceAccessMock,
    grantLocalRoot: grantLocalRootMock,
  },
  remote: {
    fetchRemoteImage: fetchRemoteImageMock,
    grantRemoteSession: grantRemoteSessionMock,
  },
  toErrorPayload: (error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'messageKey' in error
    ) {
      return error
    }
    return {
      code: 'PS_INTERNAL',
      category: 'internal',
      messageKey: 'error.internal.unexpected',
      retryable: true,
    }
  },
}))

import { t } from '../../../app/i18n'
import type { ErrorPayload } from '../../../services/types'
import { ImageBlock } from '../body/ImageBlock'
import { resourceInvalidation } from '../view/resource-invalidation'
import { resourceAuth } from './resource-auth'
import { ResourceAuthDialogs } from './ResourceAuthDialogs'

/**
 * Resource authorization flow (T-57/T-58; ui-spec §3.6/§3.8; models §8).
 *
 * Default-block is verified through the mock boundary: a remote-blocked image
 * performs zero `fetch_remote_image` calls until the current document session
 * is explicitly granted; a local out-of-root scope aggregates one prompt per
 * directory (count, no per-image dialogs); denial keeps the placeholder and
 * never re-prompts on its own; revocation unloads fetched assets.
 */

const IMG_ORIGIN = 'https://img.example.com'
const IMG_URL = `${IMG_ORIGIN}/a.png`
const LOCAL_ROOT = '/shared/assets'
const onErrorSpy = vi.fn()

function imgNode(src: string, alt: string): Element {
  return { type: 'element', tagName: 'img', properties: { src, alt }, children: [] }
}

function remoteBlocked(origin = IMG_ORIGIN) {
  return { status: 'remote-blocked', kind: 'remote', origin }
}

function outsideRoot(rootPath = LOCAL_ROOT) {
  return { status: 'outside-root', kind: 'local', rootCandidate: rootPath }
}

function allowed(url: string, canonicalPath?: string) {
  return {
    status: 'allowed',
    kind: canonicalPath === undefined ? 'remote' : 'local',
    ...(canonicalPath === undefined ? {} : { canonicalPath }),
    assetUrl: url,
  }
}

function renderHarness(blocks: Array<{ src: string; alt: string }>) {
  return render(
    <>
      {blocks.map((block) => (
        <ImageBlock key={block.src} docId="d-a" node={imgNode(block.src, block.alt)} />
      ))}
      <ResourceAuthDialogs onError={onErrorSpy} />
    </>,
  )
}

async function allowRemoteDialog() {
  fireEvent.click(
    await screen.findByRole('button', { name: t('dialog.authRemote.allow') }),
  )
}

beforeEach(() => {
  resourceAuth.reset()
  resourceInvalidation.reset()
  checkResourceAccessMock.mockReset()
  fetchRemoteImageMock.mockReset()
  grantRemoteSessionMock.mockReset()
  grantLocalRootMock.mockReset()
  onErrorSpy.mockReset()
})

describe('remote image flow (T-58)', () => {
  it('performs zero requests by default and aggregates the domain prompt', async () => {
    checkResourceAccessMock.mockResolvedValue(remoteBlocked())
    renderHarness([{ src: IMG_URL, alt: '远程图' }])

    expect(await screen.findByText(t('image.remoteBlocked'))).toBeTruthy()
    expect(fetchRemoteImageMock).not.toHaveBeenCalled()
    expect(grantRemoteSessionMock).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('dialog.authRemote.title'))).toBeTruthy()
    expect(within(dialog).getByText(IMG_ORIGIN)).toBeTruthy()
    // The dialog lists the origin only; the placeholder path lives outside it.
    expect(within(dialog).queryByText(/a\.png/)).toBeNull()
  })

  it('fetches exactly once after the session grant and renders the asset URL', async () => {
    checkResourceAccessMock.mockResolvedValue(remoteBlocked())
    grantRemoteSessionMock.mockResolvedValue({
      grantId: 'g-remote',
      kind: 'remote',
      scope: 'session',
      docId: 'd-a',
      origins: [IMG_ORIGIN],
      grantedAtMs: 1,
    })
    fetchRemoteImageMock.mockResolvedValue({
      assetUrl: 'asset://remote/a.png?v=1',
      mime: 'image/png',
      sizeBytes: 10,
      finalUrl: IMG_URL,
      cacheKey: 'k1',
      fromCache: false,
    })
    renderHarness([{ src: IMG_URL, alt: '远程图' }])
    await screen.findByText(t('image.remoteBlocked'))

    await allowRemoteDialog()
    const image = await screen.findByRole('img', { name: '远程图' })
    expect(image.getAttribute('src')).toBe('asset://remote/a.png?v=1')
    expect(grantRemoteSessionMock).toHaveBeenCalledWith({
      docId: 'd-a',
      origins: [IMG_ORIGIN],
    })
    expect(fetchRemoteImageMock).toHaveBeenCalledTimes(1)
    expect(fetchRemoteImageMock).toHaveBeenCalledWith({ docId: 'd-a', url: IMG_URL })
  })

  it('shows the redirect-blocked message and retries only on explicit click', async () => {
    checkResourceAccessMock.mockResolvedValue(remoteBlocked())
    grantRemoteSessionMock.mockResolvedValue({
      grantId: 'g-remote',
      kind: 'remote',
      scope: 'session',
      docId: 'd-a',
      origins: [IMG_ORIGIN],
      grantedAtMs: 1,
    })
    const redirectError: ErrorPayload = {
      code: 'PS_REMOTE_REDIRECT_BLOCKED',
      category: 'resource',
      messageKey: 'error.resource.redirectBlocked',
      retryable: true,
    }
    fetchRemoteImageMock.mockRejectedValueOnce(redirectError)
    fetchRemoteImageMock.mockResolvedValue({
      assetUrl: 'asset://remote/a.png?v=2',
      mime: 'image/png',
      sizeBytes: 10,
      finalUrl: IMG_URL,
      cacheKey: 'k1',
      fromCache: false,
    })
    renderHarness([{ src: IMG_URL, alt: '远程图' }])
    await screen.findByText(t('image.remoteBlocked'))
    await allowRemoteDialog()

    expect(await screen.findByText(t('error.resource.redirectBlocked'))).toBeTruthy()
    expect(fetchRemoteImageMock).toHaveBeenCalledTimes(1)
    // No automatic retry loop.
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchRemoteImageMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: t('image.retry') }))
    await waitFor(() => expect(fetchRemoteImageMock).toHaveBeenCalledTimes(2))
    await screen.findByRole('img', { name: '远程图' })
  })

  it('keeps blocking after a denial and re-prompts only on the explicit placeholder action', async () => {
    checkResourceAccessMock.mockResolvedValue(remoteBlocked())
    renderHarness([{ src: IMG_URL, alt: '远程图' }])
    await screen.findByText(t('image.remoteBlocked'))

    fireEvent.click(screen.getByRole('button', { name: t('dialog.authRemote.blocked') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // A re-resolution of the same document does not re-open the dialog.
    await act(async () => {
      resourceInvalidation.bump('d-a')
    })
    await screen.findByText(t('image.remoteBlocked'))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('image.allowOnce') }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(fetchRemoteImageMock).not.toHaveBeenCalled()
  })

  it('revocation unloads fetched assets back to the blocked placeholder', async () => {
    checkResourceAccessMock.mockResolvedValue(remoteBlocked())
    grantRemoteSessionMock.mockResolvedValue({
      grantId: 'g-remote',
      kind: 'remote',
      scope: 'session',
      docId: 'd-a',
      origins: [IMG_ORIGIN],
      grantedAtMs: 1,
    })
    fetchRemoteImageMock.mockResolvedValue({
      assetUrl: 'asset://remote/a.png?v=1',
      mime: 'image/png',
      sizeBytes: 10,
      finalUrl: IMG_URL,
      cacheKey: 'k1',
      fromCache: false,
    })
    renderHarness([{ src: IMG_URL, alt: '远程图' }])
    await screen.findByText(t('image.remoteBlocked'))
    await allowRemoteDialog()
    await screen.findByRole('img', { name: '远程图' })

    await act(async () => {
      resourceAuth.revokeRemote('d-a')
      resourceInvalidation.bump('d-a')
    })
    await screen.findByText(t('image.remoteBlocked'))
    expect(screen.queryByRole('img')).toBeNull()
    expect(fetchRemoteImageMock).toHaveBeenCalledTimes(1)
  })
})

describe('local out-of-root flow (T-57)', () => {
  it('aggregates one prompt per directory with count and defaults to a session grant', async () => {
    checkResourceAccessMock.mockResolvedValue(outsideRoot())
    renderHarness([
      { src: 'one.png', alt: '图一' },
      { src: 'two.png', alt: '图二' },
    ])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('dialog.authLocal.scope', { path: LOCAL_ROOT }))).toBeTruthy()
    expect(within(dialog).getByText(t('dialog.authLocal.count', { count: 2 }))).toBeTruthy()
    const remember = within(dialog).getByRole('checkbox', {
      name: t('dialog.authLocal.remember'),
    })
    expect((remember as HTMLInputElement).checked).toBe(false)

    grantLocalRootMock.mockResolvedValue({
      grantId: 'g-dir',
      kind: 'directory',
      scope: 'session',
      canonicalPath: LOCAL_ROOT,
      grantedAtMs: 1,
    })
    checkResourceAccessMock.mockImplementation(({ rawSrc }: { rawSrc: string }) =>
      Promise.resolve(allowed(`asset://local/${rawSrc}`, `${LOCAL_ROOT}/${rawSrc}`)),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: t('dialog.authLocal.allow') }))
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
    expect(grantLocalRootMock).toHaveBeenCalledWith({
      docId: 'd-a',
      rootPath: LOCAL_ROOT,
      persist: false,
    })
  })

  it('requests a persistent grant only when the remember checkbox is ticked', async () => {
    checkResourceAccessMock.mockResolvedValue(outsideRoot())
    grantLocalRootMock.mockResolvedValue({
      grantId: 'g-dir',
      kind: 'directory',
      scope: 'persistent',
      canonicalPath: LOCAL_ROOT,
      grantedAtMs: 1,
    })
    renderHarness([{ src: 'one.png', alt: '图一' }])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: t('dialog.authLocal.remember') }),
    )
    checkResourceAccessMock.mockResolvedValue(allowed('asset://local/one.png', `${LOCAL_ROOT}/one.png`))
    fireEvent.click(within(dialog).getByRole('button', { name: t('dialog.authLocal.allow') }))
    await screen.findByRole('img', { name: '图一' })
    expect(grantLocalRootMock).toHaveBeenCalledWith({
      docId: 'd-a',
      rootPath: LOCAL_ROOT,
      persist: true,
    })
  })

  it('keeps placeholders after a denial and only the explicit action re-opens the prompt', async () => {
    checkResourceAccessMock.mockResolvedValue(outsideRoot())
    renderHarness([{ src: 'one.png', alt: '图一' }])
    await screen.findByText(t('image.outsideRoot'))

    fireEvent.click(screen.getByRole('button', { name: t('dialog.authLocal.blocked') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(t('image.outsideRoot'))).toBeTruthy()

    await act(async () => {
      resourceInvalidation.bump('d-a')
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t('image.allowScope') }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('dialog.authLocal.count', { count: 1 }))).toBeTruthy()
  })

  it('treats a failed grant like a denial: error surfaced once, placeholder kept, no auto re-prompt', async () => {
    checkResourceAccessMock.mockResolvedValue(outsideRoot())
    grantLocalRootMock.mockRejectedValue({
      code: 'PS_DB_FAILURE',
      category: 'storage',
      messageKey: 'error.storage.dbFailure',
      retryable: true,
    } satisfies ErrorPayload)
    renderHarness([{ src: 'one.png', alt: '图一' }])
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: t('dialog.authLocal.allow') }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onErrorSpy).toHaveBeenCalledTimes(1)
    expect(onErrorSpy.mock.calls[0][0]).toMatchObject({ code: 'PS_DB_FAILURE' })
    expect(screen.getByText(t('image.outsideRoot'))).toBeTruthy()

    await act(async () => {
      resourceInvalidation.bump('d-a')
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
