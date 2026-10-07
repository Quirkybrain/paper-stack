import type { UpdateMode } from '../../services/types'

/**
 * Per-document settings context handed to the settings dialog (ui-spec §3.7).
 *
 * "当前文档" controls are session-scoped: the inline-dollar switch and the
 * update-mode override live in the reader tab state and are never persisted.
 * `updateModeOverride === null` means "follow the global default".
 */
export interface CurrentDocumentSettings {
  displayName: string
  inlineMath: boolean
  updateModeOverride: UpdateMode | null
  onInlineMathChange(enabled: boolean): void
  onUpdateModeChange(mode: UpdateMode): void
}
