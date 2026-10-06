/// <reference types="vitest/config" />
import { dirname, resolve as resolvePath } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, normalizePath, type Plugin } from 'vite'

// Tauri expects a fixed dev-server port (see src-tauri/tauri.conf.json).
// The Rust target directory is excluded from the watcher to avoid reload loops.

/**
 * Worker bundles and export conditions (wp-19a root-cause fix).
 *
 * Vite 8 resolves imports inside worker bundles (`new Worker(new URL(...))`)
 * with the browser export condition, because worker builds reuse the `client`
 * environment. There is no per-worker `resolve.conditions` option
 * (vitejs/vite#7439, still open) and `worker.plugins` config hooks cannot
 * change resolution. Packages that ship a DOM-free `worker` entry therefore
 * resolve to their browser DOM-only entry in the parse worker, which crashes at
 * module evaluation:
 *   - `decode-named-character-reference/index.dom.js` → `document.createElement`
 *   - `hast-util-from-html-isomorphic/lib/browser.js` → `new DOMParser`
 * (both reached through remark/micromark and rehype-katex).
 *
 * `worker.plugins` is the supported worker-scoped hook surface, so this plugin
 * remaps exactly those two specifiers to their `worker`/`default` export inside
 * worker bundles only. The browser entry is located with Vite's own resolver
 * (works under pnpm's non-hoisted node_modules) and the sibling DOM-free entry
 * is derived from it. The client bundle keeps browser resolution.
 *
 * Maintainers: add a dependency here if it publishes a DOM-only browser entry
 * consumed by the parse pipeline. The worker smoke
 * (`node src/document/worker/smoke.worker-build.mjs`) imports the built worker
 * chunk with no DOM globals and fails if any DOM reference is evaluated.
 */
const WORKER_SAFE_ENTRIES: Record<string, string> = {
  // browser: index.dom.js → worker/default: index.js
  'decode-named-character-reference': 'index.js',
  // browser: lib/browser.js → worker/default: ../index.js
  'hast-util-from-html-isomorphic': '../index.js',
}

function workerExportConditions(): Plugin {
  return {
    name: 'paperstack:worker-export-conditions',
    enforce: 'pre',
    async resolveId(source, importer) {
      const safeEntry = WORKER_SAFE_ENTRIES[source]
      if (safeEntry === undefined) return null
      const browserEntry = await this.resolve(source, importer, { skipSelf: true })
      if (!browserEntry || browserEntry.external) return null
      return normalizePath(resolvePath(dirname(browserEntry.id), safeEntry))
    },
  }
}

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  worker: {
    // Applies to dev worker graphs and to `new Worker(new URL(...))` bundles.
    plugins: () => [workerExportConditions()],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
