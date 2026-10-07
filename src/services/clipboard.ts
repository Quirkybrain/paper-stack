import { invokeCommand, toErrorPayload } from './invoke'

import type { ErrorPayload } from './types'

/**
 * Clipboard service (contracts §8/§9; not a Rust command of `paperstack-ipc-r1`).
 *
 * The Rust side registers `tauri-plugin-clipboard-manager` with the
 * `clipboard-manager:allow-write-text` capability. The plugin's JS package
 * (`writeText`) is not a dependency of this task, so this thin wrapper calls
 * the plugin's IPC command through the single invoke entry — the same call the
 * official JS wrapper makes — and reports `ok: true` only after the system
 * clipboard write succeeded (R11).
 */

export type CopyResult = { ok: true } | { ok: false; error: ErrorPayload }

export async function copyText(text: string): Promise<CopyResult> {
  try {
    await invokeCommand<void>('plugin:clipboard-manager|write_text', { text })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error) }
  }
}
