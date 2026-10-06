import { invokeCommand } from './invoke'

/** Opener service (contracts §8): commands 31–32; http/https only, user-triggered. */

export function openExternalUrl(url: string): Promise<void> {
  return invokeCommand<void>('open_external_url', { url })
}

export function revealInFolder(path: string): Promise<void> {
  return invokeCommand<void>('reveal_in_folder', { path })
}
