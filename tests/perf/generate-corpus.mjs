#!/usr/bin/env node
/**
 * Deterministic corpus generator for the NF04–NF06 calibration scripts
 * (T-60). Generated files are machine-local measurement inputs and MUST NOT be
 * committed: they land under `artifacts/70-verification/evidence/generated/`,
 * which is inside the git-ignored `artifacts/` area. The script is safe to
 * re-run; pass --force to overwrite existing files.
 *
 *   node tests/perf/generate-corpus.mjs [--force] [--sizes 100KiB,1MiB,10MiB,52MiB]
 *
 * Content is a realistic mixed CN/EN technical document: ~500-byte
 * paragraphs, headings every few blocks, sparse lists/code/tables/formulas.
 * Byte sizes are exact (the last line is padded with spaces to hit the
 * target).
 */

import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(repoRoot, 'artifacts', '70-verification', 'evidence', 'generated')

const SIZES = {
  '100KiB': 100 * 1024,
  '1MiB': 1024 * 1024,
  '10MiB': 10 * 1024 * 1024,
  '52MiB': 52 * 1024 * 1024,
}

function parseArgs(argv) {
  let force = false
  let sizes = Object.keys(SIZES)
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--force') force = true
    else if (argv[index] === '--sizes') {
      sizes = argv[index + 1].split(',').map((value) => value.trim())
      index += 1
    }
  }
  return { force, sizes }
}

function paragraph(index) {
  const tail = index % 43 === 0 ? ` Search marker needle-${index % 13} here.` : ''
  return (
    `段落 ${index}: 这是一段确定性的中英混排技术文本，用于校准解析与搜索性能。` +
    `English sentence ${index} carries numbers 0123456789 and stable wording so the ` +
    `UTF-8 byte offsets stay deterministic across runs. 第二句补充中文内容，保持与 ` +
    `English 混排的比例接近真实技术文档，并包含标点、数字与 CJK 字符。` +
    ` Third sentence keeps the block length realistic (hundreds of bytes).` +
    `${tail}\n\n`
  )
}

function block(index) {
  const kind = index % 20
  if (kind === 0) {
    return `## 章节 ${index}\n\n`
  }
  if (kind === 9) {
    return `- item-${index} alpha\n- item-${index} beta 中文列表\n- item-${index} gamma\n- item-${index} delta English\n- item-${index} epsilon\n\n`
  }
  if (kind === 14) {
    return '```rust\nfn sample() -> u32 {\n    42 // fixed code block\n}\n```\n\n'
  }
  if (kind === 17) {
    return `| 列 | value | note |\n| --- | --- | --- |\n| ${index} | cell-${index % 89} | 中文单元格 |\n\n`
  }
  if (kind === 19) {
    return `公式 $x_{${index}} = ${index}$ 与行内文字混排。\n\n`
  }
  return paragraph(index)
}

function generate(targetBytes) {
  const parts = []
  let bytes = 0
  let index = 0
  while (bytes < targetBytes) {
    const piece = block(index)
    parts.push(piece)
    bytes += Buffer.byteLength(piece)
    index += 1
  }
  const buffer = Buffer.from(parts.join(''), 'utf8')
  if (buffer.length === targetBytes) return buffer
  // Trim on a line boundary, then pad the final line with spaces so the file
  // has the exact calibration size.
  const trimmed = buffer.subarray(0, targetBytes)
  const lastNewline = trimmed.lastIndexOf(0x0a)
  const cut = lastNewline === -1 ? trimmed : trimmed.subarray(0, lastNewline + 1)
  const remaining = targetBytes - cut.length
  return Buffer.concat([cut, Buffer.alloc(remaining, 0x20)])
}

function main() {
  const { force, sizes } = parseArgs(process.argv.slice(2))
  for (const size of sizes) {
    if (!(size in SIZES)) throw new Error(`unknown size ${size}; expected ${Object.keys(SIZES)}`)
  }
  mkdirSync(outDir, { recursive: true })
  for (const size of sizes) {
    const target = SIZES[size]
    const path = join(outDir, `corpus-${size}.md`)
    if (existsSync(path) && !force) {
      console.log(`skip ${path} (exists; use --force)`)
      continue
    }
    const buffer = generate(target)
    writeFileSync(path, buffer)
    const hash = createHash('sha256').update(buffer).digest('hex')
    console.log(`${size}\t${statSync(path).size}\t${hash}\t${path}`)
  }
  console.log('done')
}

main()
