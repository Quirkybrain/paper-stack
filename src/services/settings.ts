import { invokeCommand } from './invoke'

import type { GlobalSettings, SettingsBundle, UpdateSettingsResult } from './types'

/** Settings service (contracts §8): commands 22–23. */

export function getSettings(): Promise<SettingsBundle> {
  return invokeCommand<SettingsBundle>('get_settings')
}

export function updateSettings(patch: Partial<GlobalSettings>): Promise<UpdateSettingsResult> {
  return invokeCommand<UpdateSettingsResult>('update_settings', { req: { patch } })
}
