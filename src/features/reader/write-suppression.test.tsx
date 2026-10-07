import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { resetWriteSuppression, suppressWriteBack } from '../../app/write-suppression'
import type { DocumentSnapshot } from '../../services/types'
import { useReader } from './use-reader'

/**
 * Persisted-write gate at the reader boundary (models §9.1; INV-WB-01/02):
 * while the `session` category is suppressed, the quit-time save performs no
 * `save_session` command and reports `saved:false` without an error; an
 * explicit open (entry != restore) lifts the suppression again.
 */

function Harness() {
  const reader = useReader()
  const [result, setResult] = React.useState('')
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void reader.saveSession().then((save) => setResult(JSON.stringify(save)))
        }}
      >
        save
      </button>
      <button type="button" onClick={() => void reader.openPaths(['/docs/a.md'], 'dialog')}>
        open-explicit
      </button>
      <span data-testid="result">{result}</span>
    </>
  )
}

// React import is required for the JSX runtime in this minimal harness.

const SNAPSHOT: DocumentSnapshot = {
  docId: 'd-a.md',
  identity: {
    docId: 'd-a.md',
    canonicalPath: '/docs/a.md',
    displayName: 'a.md',
    format: 'markdown',
    encoding: 'utf-8',
    contentHash: 'v1',
    sizeBytes: 10,
    lastSeenAtMs: 1,
  },
  version: { contentHash: 'v1', sizeBytes: 10, modifiedAtMs: 1, observedAtMs: 2 },
  text: '# a\n',
  lineCount: 1,
}

beforeEach(() => {
  resetWriteSuppression()
  invokeMock.mockReset()
  invokeMock.mockImplementation((command: string) => {
    switch (command) {
      case 'save_session':
        return Promise.resolve({ saved: true })
      case 'open_documents':
        return Promise.resolve({
          items: [
            {
              path: '/docs/a.md',
              status: 'opened',
              docId: 'd-a.md',
              identity: SNAPSHOT.identity,
            },
          ],
        })
      case 'read_document':
        return Promise.resolve(SNAPSHOT)
      default:
        return Promise.resolve(undefined)
    }
  })
})

afterEach(() => {
  resetWriteSuppression()
})

describe('reader persisted-write gate', () => {
  it('skips save_session while session is suppressed and reports saved:false without error', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('{"saved":true}'))
    expect(invokeMock).toHaveBeenCalledWith('save_session', { req: { tabs: [] } })

    invokeMock.mockClear()
    suppressWriteBack(['session'])
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('{"saved":false}'))
    expect(invokeMock).not.toHaveBeenCalledWith('save_session', expect.anything())
  })

  it('resumes writes after an explicit open (entry != restore)', async () => {
    render(<Harness />)
    suppressWriteBack(['recents', 'positions', 'session'])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open-explicit' }))
    })
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('open_documents', {
        req: { paths: ['/docs/a.md'], entry: 'dialog' },
      }),
    )
    expect(invokeMock).not.toHaveBeenCalledWith('resume_recording', expect.anything())
    // The gate is lifted in the frontend mirror; the Rust side receives the
    // explicit entry through open_documents and lifts its own gate.
    const { isWriteBackSuppressed } = await import('../../app/write-suppression')
    expect(isWriteBackSuppressed('session')).toBe(false)
    expect(isWriteBackSuppressed('recents')).toBe(false)
  })
})
