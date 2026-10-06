import { invokeCommand } from './invoke'

import type {
  ClearRecordsRequest,
  ClearResult,
  PositionRecord,
  RecentEntry,
  ResumeRecordingRequest,
  SavePositionRequest,
  SaveResult,
  SaveSessionRequest,
  SessionSnapshot,
  StorageOverview,
} from './types'

/** Storage and records service (contracts §8): commands 13–21. */

export function listRecents(): Promise<RecentEntry[]> {
  return invokeCommand<RecentEntry[]>('list_recents')
}

export function touchRecent(docId: string): Promise<void> {
  return invokeCommand<void>('touch_recent', { docId })
}

export function savePosition(req: SavePositionRequest): Promise<SaveResult> {
  return invokeCommand<SaveResult>('save_position', { req })
}

export function loadPosition(docId: string): Promise<PositionRecord | null> {
  return invokeCommand<PositionRecord | null>('load_position', { docId })
}

export function saveSession(req: SaveSessionRequest): Promise<SaveResult> {
  return invokeCommand<SaveResult>('save_session', { req })
}

export function loadSession(): Promise<SessionSnapshot | null> {
  return invokeCommand<SessionSnapshot | null>('load_session')
}

export function getStorageOverview(): Promise<StorageOverview> {
  return invokeCommand<StorageOverview>('get_storage_overview')
}

export function clearRecords(req: ClearRecordsRequest): Promise<ClearResult[]> {
  return invokeCommand<ClearResult[]>('clear_records', { req })
}

/** Omitted request means "resume every category" (contracts §3.4). */
export function resumeRecording(req?: ResumeRecordingRequest): Promise<void> {
  return invokeCommand<void>('resume_recording', req === undefined ? undefined : { req })
}
