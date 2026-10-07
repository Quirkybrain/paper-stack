import { invokeCommand } from './invoke'

import type {
  DocumentSnapshot,
  OpenDocumentsRequest,
  OpenDocumentsResult,
  PickResult,
  ReadDocumentRequest,
  ReadSourceWindowRequest,
  RelinkRequest,
  RelinkResult,
  SourceInfo,
  SourceWindow,
} from './types'

/** Documents service (contracts §8): commands 1–8. */

export function pickFiles(): Promise<PickResult> {
  return invokeCommand<PickResult>('pick_files')
}

export function pickDirectory(): Promise<PickResult> {
  return invokeCommand<PickResult>('pick_directory')
}

export function pickExportTarget(): Promise<PickResult> {
  return invokeCommand<PickResult>('pick_export_target')
}

export function openDocuments(req: OpenDocumentsRequest): Promise<OpenDocumentsResult> {
  return invokeCommand<OpenDocumentsResult>('open_documents', { req })
}

export function readDocument(req: ReadDocumentRequest): Promise<DocumentSnapshot> {
  return invokeCommand<DocumentSnapshot>('read_document', { req })
}

export function relinkDocument(req: RelinkRequest): Promise<RelinkResult> {
  return invokeCommand<RelinkResult>('relink_document', { req })
}

export function getSourceInfo(docId: string): Promise<SourceInfo> {
  return invokeCommand<SourceInfo>('get_source_info', { docId })
}

export function readSourceWindow(req: ReadSourceWindowRequest): Promise<SourceWindow> {
  return invokeCommand<SourceWindow>('read_source_window', { req })
}
