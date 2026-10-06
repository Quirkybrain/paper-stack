/// <reference types="node" />
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { fingerprintBlockText, sha256Hex } from './hash'

const UNICODE_VECTORS = [
  '',
  'abc',
  '你好',
  'a😀b',
  'e\u0301',
  'line one\r\nline two',
  'The quick brown fox jumps over the lazy dog',
]

describe('sha256Hex', () => {
  it('matches fixed FIPS vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('matches node:crypto for unicode, combining characters and CRLF', () => {
    for (const value of UNICODE_VECTORS) {
      const reference = createHash('sha256').update(value, 'utf8').digest('hex')
      expect(sha256Hex(value)).toBe(reference)
    }
  })

  it('matches node:crypto across multiple 64-byte blocks', () => {
    const value = `${'段落😀'.repeat(40)}\n${'x'.repeat(300)}`
    expect(value.length).toBeGreaterThan(256)
    expect(sha256Hex(value)).toBe(createHash('sha256').update(value, 'utf8').digest('hex'))
  })

  it('encodes lone surrogates like TextEncoder (U+FFFD)', () => {
    const value = 'a\uD800b'
    expect(sha256Hex(value)).toBe(createHash('sha256').update(value, 'utf8').digest('hex'))
  })
})

describe('fingerprintBlockText', () => {
  it('is fp1: plus the first 16 hex characters of the digest', () => {
    const fingerprint = fingerprintBlockText('hello')
    expect(fingerprint).toBe(`fp1:${sha256Hex('hello').slice(0, 16)}`)
    expect(fingerprint).toMatch(/^fp1:[0-9a-f]{16}$/)
  })

  it('is deterministic and stable across repeated computation', () => {
    const text = '2.1 数据 Data😀\r\nmore'
    expect(fingerprintBlockText(text)).toBe(fingerprintBlockText(text))
  })

  it('changes when block search text changes', () => {
    expect(fingerprintBlockText('alpha')).not.toBe(fingerprintBlockText('alpha '))
  })
})
