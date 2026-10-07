import { beforeEach, describe, expect, it } from 'vitest'

import {
  NAV_DEFAULT_WIDTH,
  navMemory,
  readOutlineMemory,
  readOutlineScroll,
  readRootScroll,
  rememberOutlineExpansion,
  rememberOutlineScroll,
  rememberRootExpanded,
  rememberRootScroll,
  resolveNavLayout,
} from './nav-memory'

/**
 * Navigation memory and responsive layout (ui-spec §3.3/§4; T-41): state is
 * remembered per authorized root / document and the 1180/840 thresholds select
 * side-by-side, overlay and full-width modes.
 */

describe('resolveNavLayout (ui-spec §4)', () => {
  it('uses side-by-side at >=1180px', () => {
    expect(resolveNavLayout(1440)).toBe('side')
    expect(resolveNavLayout(1180)).toBe('side')
  })

  it('uses an overlay between 840 and 1179px', () => {
    expect(resolveNavLayout(1179)).toBe('overlay')
    expect(resolveNavLayout(840)).toBe('overlay')
  })

  it('uses the full-width overlay below 840px', () => {
    expect(resolveNavLayout(839)).toBe('full')
    expect(resolveNavLayout(320)).toBe('full')
  })
})

describe('navMemory (ui-spec §3.3 state memory)', () => {
  beforeEach(() => {
    navMemory.reset()
  })

  it('remembers expansion and scroll independently per authorized root', () => {
    rememberRootExpanded('root-a', new Set(['/a/src']))
    rememberRootScroll('root-a', 120)
    rememberRootExpanded('root-b', new Set(['/b/docs']))

    expect([...navMemory.root('root-a').expanded]).toEqual(['/a/src'])
    expect(readRootScroll('root-a')).toBe(120)
    expect([...navMemory.root('root-b').expanded]).toEqual(['/b/docs'])
    expect(readRootScroll('root-b')).toBe(0)
  })

  it('defaults the panel width to 248 and remembers per-root overrides', () => {
    expect(navMemory.root('root-a').width).toBe(NAV_DEFAULT_WIDTH)
    navMemory.root('root-a').width = 300
    expect(navMemory.root('root-a').width).toBe(300)
    expect(navMemory.root('root-b').width).toBe(NAV_DEFAULT_WIDTH)
  })

  it('remembers outline expansion and scroll per document', () => {
    rememberOutlineExpansion('doc-a', new Set(['ps-h-intro']))
    rememberOutlineScroll('doc-a', 64)
    const memoryA = readOutlineMemory('doc-a')
    expect(memoryA.touched).toBe(true)
    expect([...memoryA.expanded]).toEqual(['ps-h-intro'])
    expect(readOutlineScroll('doc-a')).toBe(64)
    expect(readOutlineMemory('doc-b').touched).toBe(false)
  })
})
