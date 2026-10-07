import { beforeEach, describe, expect, it } from 'vitest'

import {
  isWriteBackSuppressed,
  resetWriteSuppression,
  resumeSuppressedWrites,
  suppressWriteBack,
} from './write-suppression'

/**
 * Frontend write-back gate (models §9.1/§9.3; R27/AT27). The Rust storage
 * layer owns the authoritative gate; these cases pin the mirrored behavior
 * the webview relies on to avoid rebuilding cleared records.
 */
describe('write-back suppression gate', () => {
  beforeEach(() => {
    resetWriteSuppression()
  })

  it('starts writable for every category', () => {
    expect(isWriteBackSuppressed('recents')).toBe(false)
    expect(isWriteBackSuppressed('positions')).toBe(false)
    expect(isWriteBackSuppressed('session')).toBe(false)
  })

  it('suppresses only the categories that were cleared', () => {
    suppressWriteBack(['recents'])
    expect(isWriteBackSuppressed('recents')).toBe(true)
    expect(isWriteBackSuppressed('positions')).toBe(false)
    expect(isWriteBackSuppressed('session')).toBe(false)
  })

  it('resumes selected categories and all categories on explicit reopen', () => {
    suppressWriteBack(['recents', 'positions', 'session'])
    resumeSuppressedWrites(['recents'])
    expect(isWriteBackSuppressed('recents')).toBe(false)
    expect(isWriteBackSuppressed('positions')).toBe(true)

    resumeSuppressedWrites()
    expect(isWriteBackSuppressed('positions')).toBe(false)
    expect(isWriteBackSuppressed('session')).toBe(false)
  })
})
