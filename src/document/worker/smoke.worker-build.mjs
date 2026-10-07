// Node smoke test for the BUILT parse worker (wp-19a worker export conditions).
//
// Imports `dist/assets/parse.worker-*.js` with worker-like globals but with
// `document`/`DOMParser` deliberately absent, then completes a real parse
// round-trip over the worker protocol (message in → `parsed` envelope out).
// This proves the emitted chunk initializes and parses without DOM APIs, which
// the browser-condition build did not (decode-named-character-reference's
// `index.dom.js` calls `document.createElement` at module evaluation).
//
// Run after `pnpm build`:
//   node src/document/worker/smoke.worker-build.mjs
//
// Exits non-zero on missing build output, a DOM reference, a timeout, or a
// malformed response.

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TASK_ID = 'smoke-1'

function fail(message) {
  console.error(`[worker-smoke] FAIL: ${message}`)
  process.exit(1)
}

if (typeof document !== 'undefined' || typeof DOMParser !== 'undefined') {
  fail('run this smoke without DOM globals (document/DOMParser must be undefined)')
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const assetsDir = join(projectRoot, 'dist', 'assets')
if (!existsSync(assetsDir)) fail('dist/assets is missing — run `pnpm build` first')
const workerFile = readdirSync(assetsDir).find((name) => /^parse\.worker-.*\.js$/.test(name))
if (!workerFile) fail('no parse.worker-*.js chunk found — run `pnpm build` first')

const listeners = []
let settle = null
const responsePromise = new Promise((resolveResponse) => {
  settle = resolveResponse
})

// Minimal worker scope: `self` with the two members `installParseWorker` uses.
globalThis.self = {
  postMessage(message) {
    if (message && message.type === 'parsed' && message.taskId === TASK_ID) settle(message)
  },
  addEventListener(type, listener) {
    if (type === 'message') listeners.push(listener)
  },
}

// Module evaluation must not touch `document`, `DOMParser`, `window`, etc.
await import(pathToFileURL(join(assetsDir, workerFile)).href)

if (listeners.length !== 1) fail(`expected exactly one message listener, got ${listeners.length}`)

const sample = [
  '# PaperStack worker smoke',
  '',
  'Entities: &amp; &copy; &notin; and CJK 中文 😀.',
  '',
  'Inline math $E = mc^2$ and display math:',
  '',
  '$$',
  '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
  '$$',
  '',
  '```rust',
  'fn main() { println!("hello"); }',
  '```',
  '',
  '- [x] done',
].join('\n')

listeners[0]({
  data: {
    type: 'parse',
    taskId: TASK_ID,
    generation: 1,
    docId: 'smoke-doc',
    text: sample,
    options: { mode: 'technical' },
  },
})

const timeoutMs = 15000
let response
try {
  response = await Promise.race([
    responsePromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`no response within ${timeoutMs} ms`)), timeoutMs),
    ),
  ])
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

if (response.type !== 'parsed') fail(`expected a parsed envelope, got ${response.type}`)
if (response.result.status !== 'ok') fail(`parse status is ${response.result.status}`)
if (!response.result.hast) fail('parsed result has no hast tree')
if (response.result.diagnostics.length > 0) {
  fail(
    `expected no parse diagnostics, got ${response.result.diagnostics
      .map((entry) => entry.code)
      .join(', ')}`,
  )
}
if (!Array.isArray(response.result.blocks) || response.result.blocks.length < 4) {
  fail(`expected at least 4 blocks, got ${response.result.blocks?.length ?? 'none'}`)
}
if (!Array.isArray(response.result.segments) || response.result.segments.length < 1) {
  fail('parsed result has no search segments')
}

function hasElement(node, predicate) {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'element' && predicate(node)) return true
  return (node.children ?? []).some((child) => hasElement(child, predicate))
}

const hasClassName = (node, token) =>
  Array.isArray(node.properties?.className) && node.properties.className.includes(token)

// Exercises the KaTeX engine, which calls rehype-katex →
// hast-util-from-html-isomorphic at parse time (the second DOM-only entry).
if (!hasElement(response.result.hast, (node) => hasClassName(node, 'katex'))) {
  fail('no KaTeX-rendered element found; the math engine did not produce output')
}
if (!hasElement(response.result.hast, (node) => hasClassName(node, 'katex-display'))) {
  fail('no display-math element found')
}
// Exercises the Shiki engine's lazy highlight path (language marker + shiki
// theme class live on the wrapping code-block element).
if (
  !hasElement(
    response.result.hast,
    (node) =>
      node.tagName === 'div' &&
      hasClassName(node, 'code-block') &&
      node.properties?.dataLanguage === 'rust',
  )
) {
  fail('no code block with data-language=rust found; the code engine did not run')
}

console.log(
  `[worker-smoke] PASS ${workerFile}: task=${response.taskId} status=${response.result.status} ` +
    `blocks=${response.result.blocks.length} segments=${response.result.segments.length} ` +
    `diagnostics=${response.result.diagnostics.length} (no DOM globals)`,
)
