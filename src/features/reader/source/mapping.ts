import { utf16IndexToUtf8ByteOffset, utf8ByteOffsetToUtf16Index } from '../../../document/source-map'
import type { BlockRecord } from '../../../document/types'
import type { SourceRange } from '../../../services/types'

/**
 * Reading ↔ source position mapping helpers (ui-spec §3.5; T-45, R18).
 *
 * All IPC ranges are UTF-8 bytes; the DOM works in code units, so conversions
 * go through `document/source-map` only (contracts §1.2). Mapping failures are
 * explicit results, never a silent guess: the caller falls back to the saved
 * anchor and shows `source.notLocated`.
 */

/** 1-based line count; the empty document is one (empty) line. */
export function countLines(text: string): number {
  let lines = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1
  }
  return lines
}

/** 1-based line containing a UTF-8 byte offset. */
export function lineForByteOffset(text: string, byteOffset: number): number {
  const codeUnitIndex = utf8ByteOffsetToUtf16Index(text, byteOffset)
  return countLines(text.slice(0, codeUnitIndex))
}

/** UTF-8 byte offset of the first character of a 1-based line. */
export function byteOffsetForLine(text: string, line: number): number {
  const target = Math.max(1, line)
  let codeUnitIndex = 0
  for (let current = 1; current < target; current += 1) {
    const newline = text.indexOf('\n', codeUnitIndex)
    if (newline === -1) return text.length === 0 ? 0 : utf16IndexToUtf8ByteOffset(text, text.length)
    codeUnitIndex = newline + 1
  }
  return utf16IndexToUtf8ByteOffset(text, codeUnitIndex)
}

/** Block containing a byte offset (half-open ranges); null when unmappable. */
export function findBlockForByteOffset(
  blocks: readonly BlockRecord[],
  byteOffset: number,
): BlockRecord | null {
  for (const block of blocks) {
    if (byteOffset >= block.sourceRangeBytes.startByte && byteOffset < block.sourceRangeBytes.endByte) {
      return block
    }
  }
  return null
}

export interface ReturnTargetInput {
  blocks: readonly BlockRecord[]
  rawText: string | null
  byteOffset: number | null
  savedAnchorBlockId: string | null
}

export interface ReturnTarget {
  kind: 'block' | 'fallback' | 'none'
  blockId: string | null
}

/**
 * Return mapping (ui-spec §3.5): prefer the exact block under the source
 * position; otherwise fall back to the nearest saved anchor with the
 * `source.notLocated` message. `none` means there is no anchor at all.
 */
export function resolveReturnTarget(input: ReturnTargetInput): ReturnTarget {
  if (input.rawText !== null && input.byteOffset !== null) {
    const block = findBlockForByteOffset(input.blocks, input.byteOffset)
    if (block) return { kind: 'block', blockId: block.blockId }
  }
  if (input.savedAnchorBlockId !== null) {
    return { kind: 'fallback', blockId: input.savedAnchorBlockId }
  }
  return { kind: 'none', blockId: null }
}

/** Byte start offset for a block id, or null when the block is unknown. */
export function blockRangeFor(
  blocks: readonly BlockRecord[],
  blockId: string | null,
): SourceRange | null {
  if (blockId === null) return null
  const block = blocks.find((candidate) => candidate.blockId === blockId)
  return block ? block.sourceRangeBytes : null
}

/**
 * Best-effort mapping of the current reading position to a block id: the last
 * top-level block whose top edge is above the viewport threshold (ui-spec
 * §3.5 "进入时优先将当前正文块映射到源码行"). Layout-dependent; environments
 * without real layout still return a deterministic first/last id.
 */
export function findVisibleBlockId(
  container: HTMLElement | null,
  offsetPx = 80,
): string | null {
  if (!container) return null
  const elements = container.querySelectorAll<HTMLElement>('[data-block-id]')
  if (elements.length === 0) return null
  const containerTop = container.getBoundingClientRect().top
  let current: string | null = null
  for (const element of elements) {
    const id = element.dataset.blockId
    if (!id) continue
    if (element.getBoundingClientRect().top - containerTop <= offsetPx) current = id
    else break
  }
  return current ?? elements[0]?.dataset.blockId ?? null
}
