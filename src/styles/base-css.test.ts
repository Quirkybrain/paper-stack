import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Skip-link regression (EA-RUN W-1): the unfocused link must be fully hidden,
 * not partially visible at the window top edge. The hidden offset must exceed
 * the element's own height, and focus-visible must bring it back.
 */

const css = readFileSync(path.resolve(process.cwd(), 'src/styles/base.css'), 'utf8')

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's').exec(css)
  return match?.[1] ?? ''
}

describe('skip link hidden state (W-1 regression)', () => {
  it('moves the unfocused link up by 200% of its own height', () => {
    const block = ruleBody('.ps-skip-link')
    expect(block).toContain('transform: translateY(-200%)')
    // The old fixed `top: calc(-1 * var(--ps-space-6))` left ~15px visible.
    expect(block).not.toContain('top: calc(-1')
  })

  it('brings the link back on focus-visible', () => {
    const focus = ruleBody('.ps-skip-link:focus-visible')
    expect(focus).toContain('transform: translateY(var(--ps-space-2))')
  })
})
