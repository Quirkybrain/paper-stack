import { toErrorPayload } from '../../../services'
import type {
  DirectoryRoot,
  ErrorPayload,
  OpenDirectoryRequest,
  OpenDocumentsRequest,
  OpenDocumentsResult,
  OpenEntry,
  OpenOutcome,
  OpenRequest,
  PickResult,
} from '../../../services/types'

/**
 * Entry-point integration (T-56; contracts §2.1(4,35); ui-spec §3.1/§3.2).
 *
 * All four open entries — file dialog, directory dialog, drag-and-drop and
 * the CLI/system single-instance queue — are thin adapters over the same
 * `open_documents`/`open_directory` commands and the same batch pipeline
 * (`planOpenBatch` here, applied by `use-reader`):
 *
 * - a picker cancellation is not a command: no state of any kind changes;
 * - drag-and-drop paths (including non-document files, invalid paths and
 *   unauthorized paths) are never interpreted as commands of their own — they
 *   go through `open_documents` and come back as per-item `rejected` outcomes;
 * - the single-instance queue drains in input order; later requests arrive as
 *   `paperstack://open-requested` events through the same `openFromRequest`;
 * - batch semantics: request order is preserved, the first accepted outcome
 *   receives focus, duplicate outcomes reuse the canonical-path tab (R05) and
 *   rejections are summarized without clearing the successes.
 */

/** Injected command surface (contracts §2 commands 1, 2, 4, 9, 35). */
export interface OpenEntryServices {
  pickFiles(): Promise<PickResult>
  pickDirectory(): Promise<PickResult>
  openDocuments(req: OpenDocumentsRequest): Promise<OpenDocumentsResult>
  openDirectory(req: OpenDirectoryRequest): Promise<DirectoryRoot>
  takePendingOpenRequests(): Promise<OpenRequest[]>
}

export interface OpenEntryHandlers {
  /** Applies one validated batch through the single open pipeline. */
  openPaths(paths: readonly string[], entry: OpenEntry): Promise<void>
  /** Directory root from the picker; the picker result never authorizes by itself (R25). */
  setDirectory(root: DirectoryRoot): void
  reportError(error: ErrorPayload): void
}

/** File dialog entry (Ctrl+O): picker → `open_documents(entry="dialog")`. */
export async function openFromFileDialog(
  services: OpenEntryServices,
  handlers: OpenEntryHandlers,
): Promise<boolean> {
  let picked: PickResult
  try {
    picked = await services.pickFiles()
  } catch (error) {
    handlers.reportError(toErrorPayload(error))
    return false
  }
  // Cancel changes nothing: no command, no tab, no selection/focus change.
  if (picked.cancelled || picked.paths.length === 0) return false
  await handlers.openPaths(picked.paths, 'dialog')
  return true
}

/**
 * Directory dialog entry (Ctrl+Shift+O): picker → `open_directory`
 * (session scope unless the user persists it elsewhere). Cancel changes
 * nothing; the picker result never grants authorization by itself.
 */
export async function openFromDirectoryDialog(
  services: OpenEntryServices,
  handlers: OpenEntryHandlers,
): Promise<DirectoryRoot | null> {
  let picked: PickResult
  try {
    picked = await services.pickDirectory()
  } catch (error) {
    handlers.reportError(toErrorPayload(error))
    return null
  }
  if (picked.cancelled || picked.paths.length === 0) return null
  try {
    const root = await services.openDirectory({ path: picked.paths[0], persist: false })
    handlers.setDirectory(root)
    return root
  } catch (error) {
    handlers.reportError(toErrorPayload(error))
    return null
  }
}

/**
 * Drag-and-drop entry (`tauri://drag-drop` via the event bridge): an empty
 * payload is ignored; paths are validated per item by `open_documents`, so a
 * non-document drop is a rejection shown in place, never a command.
 */
export async function openFromDrop(
  handlers: OpenEntryHandlers,
  paths: readonly string[],
): Promise<void> {
  if (paths.length === 0) return
  await handlers.openPaths(paths, 'drop')
}

/** CLI/system entries share the single-instance `OpenRequest` shape. */
export function entryForOpenRequest(request: OpenRequest): OpenEntry {
  return request.source === 'cli' ? 'cli' : 'system'
}

/** One single-instance or startup request (contracts §2.1 command 35; §4). */
export async function openFromRequest(
  handlers: OpenEntryHandlers,
  request: OpenRequest,
): Promise<void> {
  if (!Array.isArray(request.paths) || request.paths.length === 0) return
  await handlers.openPaths(request.paths, entryForOpenRequest(request))
}

/**
 * Drains `take_pending_open_requests` exactly once, in input order. Later
 * hand-offs arrive as events and go through `openFromRequest` one by one.
 */
export async function drainPendingOpenRequests(
  services: OpenEntryServices,
  handlers: OpenEntryHandlers,
): Promise<void> {
  let pending: OpenRequest[]
  try {
    pending = await services.takePendingOpenRequests()
  } catch (error) {
    handlers.reportError(toErrorPayload(error))
    return
  }
  if (!Array.isArray(pending)) return
  for (const request of pending) await openFromRequest(handlers, request)
}

// ---------------------------------------------------------------------------
// Batch plan
// ---------------------------------------------------------------------------

export interface OpenBatchEntry {
  outcome: OpenOutcome
  /** Stable doc id from `docId` (opened) or `duplicateOfDocId` (duplicate). */
  docId: string
  /** First accepted item in request order: this item receives focus. */
  activate: boolean
  /** The document is already open: reuse the canonical-path tab (R05). */
  reuse: boolean
}

export interface OpenBatchPlan {
  /** Accepted outcomes, still in request order. */
  items: OpenBatchEntry[]
  /** Rejected items summarized for the error surface; successes stay. */
  failures: Array<{ path: string; error: ErrorPayload }>
  /** At least one outcome was accepted (opened or duplicate). */
  acceptedAny: boolean
}

/**
 * Pure batch oracle applied by `use-reader`: same order as the Rust result
 * (contract §2.1 "items keep request order"), one focus target, duplicates
 * marked for reuse, rejections collected for the summary.
 */
export function planOpenBatch(items: readonly OpenOutcome[]): OpenBatchPlan {
  const accepted: OpenBatchEntry[] = []
  const failures: OpenBatchPlan['failures'] = []
  let activationUsed = false
  for (const outcome of items) {
    if (outcome.status === 'rejected') {
      if (outcome.error !== undefined) failures.push({ path: outcome.path, error: outcome.error })
      continue
    }
    const docId = outcome.docId ?? outcome.duplicateOfDocId
    if (docId === undefined) continue
    const activate = !activationUsed
    if (activate) activationUsed = true
    accepted.push({
      outcome,
      docId,
      activate,
      reuse: outcome.status === 'duplicate',
    })
  }
  return { items: accepted, failures, acceptedAny: accepted.length > 0 }
}
