import { act, render, screen, waitFor } from '@testing-library/react'
import type { Element } from 'hast'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkResourceAccessMock = vi.hoisted(() => vi.fn())

vi.mock('../../../services', () => ({
  auth: { checkResourceAccess: checkResourceAccessMock },
}))

import { t } from '../../../app/i18n'
import { resourceInvalidation } from '../view/resource-invalidation'
import { ImageBlock } from './ImageBlock'

/**
 * Image resource invalidation oracle (contract §7.6; models §2.2(e);
 * INV-VC-07; T-55): a `kind=resource` event re-resolves exactly the affected
 * raw `src` (new Rust `?v=` URL, remounted image) and a simplified view never
 * decodes images.
 */

function imgNode(src: string, alt: string): Element {
  return {
    type: 'element',
    tagName: 'img',
    properties: { src, alt },
    children: [],
  }
}

function allowed(url: string, canonicalPath?: string) {
  return {
    status: 'allowed',
    kind: 'local',
    ...(canonicalPath === undefined ? {} : { canonicalPath }),
    assetUrl: url,
  }
}

beforeEach(() => {
  resourceInvalidation.reset()
  checkResourceAccessMock.mockReset()
})

describe('ImageBlock resource handling', () => {
  it('renders the Rust-generated asset URL and remounts it on a resource event', async () => {
    checkResourceAccessMock.mockResolvedValue(allowed('asset://docs/pic.png?v=1', '/docs/pic.png'))
    render(<ImageBlock docId="d-a" node={imgNode('pic.png', '图示')} />)
    const first = await screen.findByRole('img')
    expect(first.getAttribute('src')).toBe('asset://docs/pic.png?v=1')

    checkResourceAccessMock.mockResolvedValue(allowed('asset://docs/pic.png?v=2', '/docs/pic.png'))
    await act(async () => {
      resourceInvalidation.bump('d-a', '/docs/pic.png')
    })
    await waitFor(() =>
      expect(screen.getByRole('img').getAttribute('src')).toBe('asset://docs/pic.png?v=2'),
    )
    expect(checkResourceAccessMock).toHaveBeenCalledTimes(2)
  })

  it('re-resolves only the matching image among several', async () => {
    checkResourceAccessMock.mockImplementation(({ rawSrc }: { rawSrc: string }) =>
      Promise.resolve(allowed(`asset://${rawSrc}?v=1`, `/docs/${rawSrc}`)),
    )
    render(
      <>
        <ImageBlock docId="d-a" node={imgNode('pic.png', '图一')} />
        <ImageBlock docId="d-a" node={imgNode('other.png', '图二')} />
      </>,
    )
    await screen.findByRole('img', { name: '图一' })
    expect(checkResourceAccessMock).toHaveBeenCalledTimes(2)

    checkResourceAccessMock.mockImplementation(({ rawSrc }: { rawSrc: string }) =>
      Promise.resolve(allowed(`asset://${rawSrc}?v=2`, `/docs/${rawSrc}`)),
    )
    await act(async () => {
      resourceInvalidation.bump('d-a', '/docs/pic.png')
    })
    await waitFor(() => expect(checkResourceAccessMock).toHaveBeenCalledTimes(3))
    expect(screen.getByRole('img', { name: '图一' }).getAttribute('src')).toBe(
      'asset://pic.png?v=2',
    )
    expect(screen.getByRole('img', { name: '图二' }).getAttribute('src')).toBe(
      'asset://other.png?v=1',
    )
  })

  it('re-checks every image of the document for an unmatched resource path', async () => {
    checkResourceAccessMock.mockImplementation(({ rawSrc }: { rawSrc: string }) =>
      Promise.resolve(allowed(`asset://${rawSrc}?v=1`, `/docs/${rawSrc}`)),
    )
    render(
      <>
        <ImageBlock docId="d-a" node={imgNode('pic.png', '图一')} />
        <ImageBlock docId="d-a" node={imgNode('other.png', '图二')} />
      </>,
    )
    await screen.findByRole('img', { name: '图一' })
    expect(checkResourceAccessMock).toHaveBeenCalledTimes(2)

    checkResourceAccessMock.mockImplementation(({ rawSrc }: { rawSrc: string }) =>
      Promise.resolve(allowed(`asset://${rawSrc}?v=3`, `/docs/${rawSrc}`)),
    )
    await act(async () => {
      resourceInvalidation.bump('d-a', '/docs/appeared-later.png')
    })
    await waitFor(() => expect(checkResourceAccessMock).toHaveBeenCalledTimes(4))
  })

  it('skips decoding entirely in simplified reading and keeps the alt text', () => {
    render(<ImageBlock docId="d-a" node={imgNode('pic.png', '图示')} simplified />)
    expect(screen.getByText(t('document.badge.simplified'))).toBeTruthy()
    expect(screen.getByText('图示')).toBeTruthy()
    expect(checkResourceAccessMock).not.toHaveBeenCalled()
  })

  it('keeps the in-block placeholder for a blocked decision', async () => {
    checkResourceAccessMock.mockResolvedValue({ status: 'remote-blocked', kind: 'remote' })
    render(<ImageBlock docId="d-a" node={imgNode('https://x/y.png', '图')} />)
    expect(await screen.findByText(t('image.remoteBlocked'))).toBeTruthy()
  })
})
