import { invokeCommand } from './invoke'

import type {
  DiagnosticsPreview,
  DiagnosticsPreviewRequest,
  ExportDiagnosticsRequest,
  ExportResult,
} from './types'

/** Diagnostics service (contracts §8): commands 36–37. */

export function previewDiagnostics(req: DiagnosticsPreviewRequest): Promise<DiagnosticsPreview> {
  return invokeCommand<DiagnosticsPreview>('preview_diagnostics', { req })
}

/** Writes the preview bytes for `exportId`; never regenerates them. */
export function exportDiagnostics(req: ExportDiagnosticsRequest): Promise<ExportResult> {
  return invokeCommand<ExportResult>('export_diagnostics', { req })
}
