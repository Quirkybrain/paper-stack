/**
 * Integration boundary check — frozen command fixtures ↔ front-end service
 * layer (`paperstack-ipc-r1`; plan T-66).
 *
 * Layer 1 (runtime, executed here): every sample in
 * `fixtures/contracts/commands.json` is validated against the service-layer
 * request/response models (required fields, field types, no unknown fields)
 * and replayed through the real `src/services/*` wrapper with only the Tauri
 * core mocked. The wrapper must dispatch exactly the fixture command with the
 * contract argument envelope, and the fixture response must pass through
 * unmodified.
 *
 * Layer 2 (type level, enforced by the suite's Vitest typecheck step configured
 * in `tests/contracts/vitest.config.ts`): the command order, request/response
 * models, argument envelopes and runtime shape specs below are bound to the
 * actual service function signatures, so service or type drift that the
 * fixtures no longer satisfy fails the same suite command.
 *
 * The fixtures are frozen contract input; this file never modifies them.
 * Unit responses are normalized to `{}` in the fixtures (mirrors
 * `src-tauri/tests/contract_shape.rs::expect_empty_response`).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'

import * as app from '../../src/services/app'
import * as auth from '../../src/services/auth'
import * as diagnostics from '../../src/services/diagnostics'
import * as files from '../../src/services/files'
import * as opener from '../../src/services/opener'
import * as remote from '../../src/services/resources'
import * as search from '../../src/services/search'
import * as settings from '../../src/services/settings'
import * as storage from '../../src/services/storage'
import * as tree from '../../src/services/tree'
import * as watch from '../../src/services/watch'
import type {
  AccessDecision,
  AnchorRecord,
  AppInfo,
  CheckResourceAccessRequest,
  ClearRecordsRequest,
  ClearResult,
  DiagnosticsPreview,
  DiagnosticsPreviewRequest,
  DirectoryListing,
  DirectoryNode,
  DirectoryRoot,
  DocIdentity,
  DocumentSnapshot,
  ErrorPayload,
  ExportDiagnosticsRequest,
  ExportResult,
  FetchRemoteImageRequest,
  GlobalSettings,
  GrantLocalRootRequest,
  GrantRecord,
  GrantRemoteSessionRequest,
  LegalTextResult,
  OpenDocumentsRequest,
  OpenDocumentsResult,
  OpenDirectoryRequest,
  OpenOutcome,
  OpenRequest,
  PickResult,
  PositionRecord,
  ReadDocumentRequest,
  ReadDirectoryRequest,
  ReadLegalTextRequest,
  ReadSourceWindowRequest,
  RecentEntry,
  RelinkRequest,
  RelinkResult,
  RemoteImageResult,
  ResumeRecordingRequest,
  RevokeResult,
  SavePositionRequest,
  SaveResult,
  SaveSessionRequest,
  SearchSourceRequest,
  SessionSnapshot,
  SessionTab,
  SettingsBundle,
  SourceInfo,
  SourceMatch,
  SourceRange,
  SourceSearchResult,
  SourceWindow,
  StorageOverview,
  UpdateSettingsRequest,
  UpdateSettingsResult,
  VersionInfo,
  WatchRequest,
} from '../../src/services/types'

// ---------------------------------------------------------------------------
// Contract command surface (contracts §2, index order)
// ---------------------------------------------------------------------------

/** All 38 commands of `paperstack-ipc-r1` in contract index order. */
const COMMAND_ORDER = [
  'pick_files',
  'pick_directory',
  'pick_export_target',
  'open_documents',
  'read_document',
  'relink_document',
  'get_source_info',
  'read_source_window',
  'open_directory',
  'read_directory',
  'watch_document',
  'unwatch_document',
  'list_recents',
  'touch_recent',
  'save_position',
  'load_position',
  'save_session',
  'load_session',
  'get_storage_overview',
  'clear_records',
  'resume_recording',
  'get_settings',
  'update_settings',
  'check_resource_access',
  'grant_local_root',
  'list_grants',
  'revoke_grant',
  'grant_remote_session',
  'revoke_remote_session',
  'fetch_remote_image',
  'open_external_url',
  'reveal_in_folder',
  'get_app_info',
  'read_legal_text',
  'take_pending_open_requests',
  'preview_diagnostics',
  'export_diagnostics',
  'search_source',
] as const

type CommandName = (typeof COMMAND_ORDER)[number]

/** Inline request envelopes from contracts §2 that have no named §3 model. */
interface DocIdRequest {
  docId: string
}
interface GrantIdRequest {
  grantId: string
}
interface UrlRequest {
  url: string
}
interface PathRequest {
  path: string
}

/** Contract request model per command (`null` = no-argument command). */
type RequestModels = {
  pick_files: null
  pick_directory: null
  pick_export_target: null
  open_documents: OpenDocumentsRequest
  read_document: ReadDocumentRequest
  relink_document: RelinkRequest
  get_source_info: DocIdRequest
  read_source_window: ReadSourceWindowRequest
  open_directory: OpenDirectoryRequest
  read_directory: ReadDirectoryRequest
  watch_document: WatchRequest
  unwatch_document: DocIdRequest
  list_recents: null
  touch_recent: DocIdRequest
  save_position: SavePositionRequest
  load_position: DocIdRequest
  save_session: SaveSessionRequest
  load_session: null
  get_storage_overview: null
  clear_records: ClearRecordsRequest
  resume_recording: ResumeRecordingRequest
  get_settings: null
  update_settings: UpdateSettingsRequest
  check_resource_access: CheckResourceAccessRequest
  grant_local_root: GrantLocalRootRequest
  list_grants: null
  revoke_grant: GrantIdRequest
  grant_remote_session: GrantRemoteSessionRequest
  revoke_remote_session: DocIdRequest
  fetch_remote_image: FetchRemoteImageRequest
  open_external_url: UrlRequest
  reveal_in_folder: PathRequest
  get_app_info: null
  read_legal_text: ReadLegalTextRequest
  take_pending_open_requests: null
  preview_diagnostics: DiagnosticsPreviewRequest
  export_diagnostics: ExportDiagnosticsRequest
  search_source: SearchSourceRequest
}

/** Contract response model per command (service return type, `void` units kept). */
type ResponseModels = {
  pick_files: PickResult
  pick_directory: PickResult
  pick_export_target: PickResult
  open_documents: OpenDocumentsResult
  read_document: DocumentSnapshot
  relink_document: RelinkResult
  get_source_info: SourceInfo
  read_source_window: SourceWindow
  open_directory: DirectoryRoot
  read_directory: DirectoryListing
  watch_document: void
  unwatch_document: void
  list_recents: RecentEntry[]
  touch_recent: void
  save_position: SaveResult
  load_position: PositionRecord | null
  save_session: SaveResult
  load_session: SessionSnapshot | null
  get_storage_overview: StorageOverview
  clear_records: ClearResult[]
  resume_recording: void
  get_settings: SettingsBundle
  update_settings: UpdateSettingsResult
  check_resource_access: AccessDecision
  grant_local_root: GrantRecord
  list_grants: GrantRecord[]
  revoke_grant: RevokeResult
  grant_remote_session: GrantRecord
  revoke_remote_session: RevokeResult
  fetch_remote_image: RemoteImageResult
  open_external_url: void
  reveal_in_folder: void
  get_app_info: AppInfo
  read_legal_text: LegalTextResult
  take_pending_open_requests: OpenRequest[]
  preview_diagnostics: DiagnosticsPreview
  export_diagnostics: ExportResult
  search_source: SourceSearchResult
}

/** Service function per command; keys must equal `CommandName`. */
const SERVICE_FUNCTIONS = {
  pick_files: files.pickFiles,
  pick_directory: files.pickDirectory,
  pick_export_target: files.pickExportTarget,
  open_documents: files.openDocuments,
  read_document: files.readDocument,
  relink_document: files.relinkDocument,
  get_source_info: files.getSourceInfo,
  read_source_window: files.readSourceWindow,
  open_directory: tree.openDirectory,
  read_directory: tree.readDirectory,
  watch_document: watch.watchDocument,
  unwatch_document: watch.unwatchDocument,
  list_recents: storage.listRecents,
  touch_recent: storage.touchRecent,
  save_position: storage.savePosition,
  load_position: storage.loadPosition,
  save_session: storage.saveSession,
  load_session: storage.loadSession,
  get_storage_overview: storage.getStorageOverview,
  clear_records: storage.clearRecords,
  resume_recording: storage.resumeRecording,
  get_settings: settings.getSettings,
  update_settings: settings.updateSettings,
  check_resource_access: auth.checkResourceAccess,
  grant_local_root: auth.grantLocalRoot,
  list_grants: auth.listGrants,
  revoke_grant: auth.revokeGrant,
  grant_remote_session: remote.grantRemoteSession,
  revoke_remote_session: remote.revokeRemoteSession,
  fetch_remote_image: remote.fetchRemoteImage,
  open_external_url: opener.openExternalUrl,
  reveal_in_folder: opener.revealInFolder,
  get_app_info: app.getAppInfo,
  read_legal_text: app.readLegalText,
  take_pending_open_requests: app.takePendingOpenRequests,
  preview_diagnostics: diagnostics.previewDiagnostics,
  export_diagnostics: diagnostics.exportDiagnostics,
  search_source: search.searchSource,
} as const

/** Every command must have exactly one service function, and vice versa. */
type ServiceFunctionCoverage = Assert<Exactly<keyof typeof SERVICE_FUNCTIONS, CommandName>>

// ---------------------------------------------------------------------------
// Compile-time assertions (checked by the Vitest typecheck step)
// ---------------------------------------------------------------------------

type Assert<T extends true> = T
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/** `ResponseModels` must be exactly the return type of the real service call. */
type ServiceReturn<K extends CommandName> = Awaited<ReturnType<(typeof SERVICE_FUNCTIONS)[K]>>
type ResponseModelBinding = {
  [K in CommandName]: Exactly<ServiceReturn<K>, ResponseModels[K]> extends true ? true : K
}

// ---------------------------------------------------------------------------
// Runtime shape specs (declared against the service-layer types above)
// ---------------------------------------------------------------------------

type RequiredKeys<T> = { [P in keyof T]-?: undefined extends T[P] ? never : P }[keyof T] & string
type OptionalKeys<T> = { [P in keyof T]-?: undefined extends T[P] ? P : never }[keyof T] & string
/** Strips `undefined` (optional markers) while preserving `null` unions. */
type Defined<T> = Exclude<T, undefined>

interface StringSpec {
  kind: 'string'
}
interface EnumSpec<T extends string> {
  kind: 'enum'
  values: readonly T[]
}
interface NumberSpec {
  kind: 'number'
}
interface BooleanSpec {
  kind: 'boolean'
}
interface ScalarSpec {
  kind: 'scalar'
}
interface NullSpec {
  kind: 'null'
}
interface VoidSpec {
  kind: 'void'
}
interface ArraySpec {
  kind: 'array'
  items: Spec
}
interface RecordSpec {
  kind: 'record'
  values: Spec
}
interface NullableSpec {
  kind: 'nullable'
  of: Spec
}
interface ObjectSpec {
  kind: 'object'
  required: Record<string, Spec>
  optional?: Record<string, Spec>
}
type Spec =
  | StringSpec
  | EnumSpec<string>
  | NumberSpec
  | BooleanSpec
  | ScalarSpec
  | NullSpec
  | VoidSpec
  | ArraySpec
  | RecordSpec
  | NullableSpec
  | ObjectSpec

/**
 * Compile-time spec shape derived from a service-layer type: required keys are
 * exactly `RequiredKeys<T>`, optional keys are exactly `OptionalKeys<T>`, and
 * string unions may be pinned to an enum whose values must be members of `T`.
 */
type SpecOf<T> = [T] extends [void]
  ? VoidSpec
  : [T] extends [null]
    ? NullSpec
    : null extends T
      ? NullableSpec & { of: SpecOf<Exclude<T, null>> }
      : [T] extends [string]
        ? StringSpec | (T extends string ? EnumSpec<T> : never)
        : [T] extends [number]
          ? NumberSpec
          : [T] extends [boolean]
            ? BooleanSpec
            : [T] extends [readonly (infer U)[]]
              ? ArraySpec & { items: SpecOf<U> }
              : [T] extends [object]
                ? string extends keyof T
                  ? RecordSpec & { values: ScalarSpec }
                  : ObjectSpec & {
                      required: { [P in RequiredKeys<T>]: SpecOf<Defined<T[P]>> }
                      optional?: { [P in OptionalKeys<T>]?: SpecOf<Defined<T[P]>> }
                    }
                : never

const STORAGE_CATEGORIES = ['recents', 'positions', 'session', 'cache', 'authorizations', 'logs'] as const

// --- shared model specs -----------------------------------------------------

const SOURCE_RANGE: SpecOf<SourceRange> = {
  kind: 'object',
  required: { startByte: { kind: 'number' }, endByte: { kind: 'number' } },
}

const ERROR_PAYLOAD: SpecOf<ErrorPayload> = {
  kind: 'object',
  required: {
    code: { kind: 'string' },
    category: {
      kind: 'enum',
      values: ['io', 'encoding', 'auth', 'resource', 'parse', 'storage', 'limit', 'internal'],
    },
    messageKey: { kind: 'string' },
    retryable: { kind: 'boolean' },
  },
  optional: {
    sourceRange: SOURCE_RANGE,
    details: { kind: 'record', values: { kind: 'scalar' } },
  },
}

const DOC_IDENTITY: SpecOf<DocIdentity> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    canonicalPath: { kind: 'string' },
    displayName: { kind: 'string' },
    format: { kind: 'enum', values: ['markdown'] },
    encoding: { kind: 'enum', values: ['utf-8', 'utf-8-bom'] },
    contentHash: { kind: 'string' },
    sizeBytes: { kind: 'number' },
    lastSeenAtMs: { kind: 'number' },
  },
}

const VERSION_INFO: SpecOf<VersionInfo> = {
  kind: 'object',
  required: {
    contentHash: { kind: 'string' },
    sizeBytes: { kind: 'number' },
    modifiedAtMs: { kind: 'number' },
    observedAtMs: { kind: 'number' },
  },
}

const DOCUMENT_SNAPSHOT: SpecOf<DocumentSnapshot> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    identity: DOC_IDENTITY,
    version: VERSION_INFO,
    text: { kind: 'string' },
    lineCount: { kind: 'number' },
  },
}

const PICK_RESULT: SpecOf<PickResult> = {
  kind: 'object',
  required: {
    cancelled: { kind: 'boolean' },
    paths: { kind: 'array', items: { kind: 'string' } },
  },
}

const OPEN_OUTCOME: SpecOf<OpenOutcome> = {
  kind: 'object',
  required: {
    path: { kind: 'string' },
    status: { kind: 'enum', values: ['opened', 'duplicate', 'rejected'] },
  },
  optional: {
    docId: { kind: 'string' },
    identity: DOC_IDENTITY,
    duplicateOfDocId: { kind: 'string' },
    error: ERROR_PAYLOAD,
  },
}

const OPEN_DOCUMENTS_RESULT: SpecOf<OpenDocumentsResult> = {
  kind: 'object',
  required: { items: { kind: 'array', items: OPEN_OUTCOME } },
}

const RELINK_RESULT: SpecOf<RelinkResult> = {
  kind: 'object',
  required: {
    status: { kind: 'enum', values: ['reassociated', 'new-version'] },
    snapshot: DOCUMENT_SNAPSHOT,
  },
}

const SOURCE_INFO: SpecOf<SourceInfo> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    version: VERSION_INFO,
    encoding: { kind: 'enum', values: ['utf-8', 'utf-8-bom'] },
    totalLines: { kind: 'number' },
  },
}

const SOURCE_WINDOW: SpecOf<SourceWindow> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    version: VERSION_INFO,
    startLine: { kind: 'number' },
    endLine: { kind: 'number' },
    text: { kind: 'string' },
    eof: { kind: 'boolean' },
  },
}

const DIRECTORY_ROOT: SpecOf<DirectoryRoot> = {
  kind: 'object',
  required: {
    rootId: { kind: 'string' },
    canonicalPath: { kind: 'string' },
    displayName: { kind: 'string' },
    scope: { kind: 'enum', values: ['session', 'persistent'] },
  },
}

const DIRECTORY_NODE: SpecOf<DirectoryNode> = {
  kind: 'object',
  required: {
    name: { kind: 'string' },
    path: { kind: 'string' },
    kind: { kind: 'enum', values: ['file', 'directory', 'symlink', 'other'] },
    status: {
      kind: 'enum',
      values: ['ok', 'missing', 'no-permission', 'out-of-root', 'symlink-inside', 'symlink-outside'],
    },
  },
  optional: {
    hasChildren: { kind: 'boolean' },
    isMarkdown: { kind: 'boolean' },
    symlinkTarget: { kind: 'string' },
  },
}

const DIRECTORY_LISTING: SpecOf<DirectoryListing> = {
  kind: 'object',
  required: {
    dirPath: { kind: 'string' },
    entries: { kind: 'array', items: DIRECTORY_NODE },
    truncated: { kind: 'boolean' },
  },
}

const RECENT_ENTRY: SpecOf<RecentEntry> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    displayName: { kind: 'string' },
    canonicalPath: { kind: 'string' },
    openedAtMs: { kind: 'number' },
    available: { kind: 'boolean' },
  },
}

const ANCHOR_RECORD: SpecOf<AnchorRecord> = {
  kind: 'object',
  required: {
    versionHash: { kind: 'string' },
    headingPath: { kind: 'array', items: { kind: 'string' } },
    blockFingerprint: { kind: 'string' },
    offsetRatio: { kind: 'number' },
    sourceRange: SOURCE_RANGE,
  },
}

const POSITION_RECORD: SpecOf<PositionRecord> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    anchor: ANCHOR_RECORD,
    updatedAtMs: { kind: 'number' },
  },
}

const SAVE_RESULT: SpecOf<SaveResult> = {
  kind: 'object',
  required: { saved: { kind: 'boolean' } },
  optional: { error: ERROR_PAYLOAD },
}

const SESSION_TAB: SpecOf<SessionTab> = {
  kind: 'object',
  required: {
    tabId: { kind: 'string' },
    docId: { kind: 'string' },
    orderIndex: { kind: 'number' },
    isActive: { kind: 'boolean' },
  },
}

const SESSION_SNAPSHOT: SpecOf<SessionSnapshot> = {
  kind: 'object',
  required: {
    tabs: { kind: 'array', items: SESSION_TAB },
    activeTabId: { kind: 'nullable', of: { kind: 'string' } },
    savedAtMs: { kind: 'number' },
  },
}

const STORAGE_OVERVIEW: SpecOf<StorageOverview> = {
  kind: 'object',
  required: {
    categories: {
      kind: 'array',
      items: {
        kind: 'object',
        required: {
          category: { kind: 'enum', values: STORAGE_CATEGORIES },
          count: { kind: 'number' },
        },
        optional: { bytes: { kind: 'number' } },
      },
    },
    databasePath: { kind: 'string' },
    cacheDir: { kind: 'string' },
  },
}

const CLEAR_RESULT: SpecOf<ClearResult> = {
  kind: 'object',
  required: {
    category: { kind: 'enum', values: STORAGE_CATEGORIES },
    cleared: { kind: 'number' },
  },
  optional: { error: ERROR_PAYLOAD },
}

const GLOBAL_SETTINGS: SpecOf<GlobalSettings> = {
  kind: 'object',
  required: {
    theme: { kind: 'enum', values: ['system', 'light', 'dark'] },
    fontSizePx: { kind: 'number' },
    lineHeight: { kind: 'number' },
    maxContentWidthPx: { kind: 'number' },
    syntaxMode: { kind: 'enum', values: ['technical', 'standard'] },
    updateModeDefault: { kind: 'enum', values: ['keep', 'follow'] },
    restoreSession: { kind: 'boolean' },
    rememberRecords: { kind: 'boolean' },
  },
}

const SETTINGS_BUNDLE: SpecOf<SettingsBundle> = {
  kind: 'object',
  required: {
    global: GLOBAL_SETTINGS,
    defaults: GLOBAL_SETTINGS,
    limits: {
      kind: 'object',
      required: {
        recentLimit: { kind: 'number' },
        cacheMaxBytes: { kind: 'number' },
        logMaxBytes: { kind: 'number' },
      },
    },
    revision: { kind: 'number' },
  },
}

const UPDATE_SETTINGS_RESULT: SpecOf<UpdateSettingsResult> = {
  kind: 'object',
  required: {
    applied: GLOBAL_SETTINGS,
    persisted: { kind: 'boolean' },
    revision: { kind: 'number' },
  },
  optional: { error: ERROR_PAYLOAD },
}

const ACCESS_DECISION: SpecOf<AccessDecision> = {
  kind: 'object',
  required: {
    status: {
      kind: 'enum',
      values: ['allowed', 'remote-blocked', 'outside-root', 'missing', 'unsupported', 'denied'],
    },
    kind: { kind: 'enum', values: ['local', 'remote', 'inline', 'other'] },
  },
  optional: {
    canonicalPath: { kind: 'string' },
    assetUrl: { kind: 'string' },
    rootCandidate: { kind: 'string' },
    origin: { kind: 'string' },
    reason: ERROR_PAYLOAD,
  },
}

const GRANT_RECORD: SpecOf<GrantRecord> = {
  kind: 'object',
  required: {
    grantId: { kind: 'string' },
    kind: { kind: 'enum', values: ['file', 'directory', 'remote'] },
    scope: { kind: 'enum', values: ['session', 'persistent'] },
    grantedAtMs: { kind: 'number' },
  },
  optional: {
    canonicalPath: { kind: 'string' },
    origins: { kind: 'array', items: { kind: 'string' } },
    docId: { kind: 'string' },
  },
}

const REVOKE_RESULT: SpecOf<RevokeResult> = {
  kind: 'object',
  required: {
    revoked: { kind: 'boolean' },
    cancelledRequests: { kind: 'number' },
    removedCacheEntries: { kind: 'number' },
  },
}

const REMOTE_IMAGE_RESULT: SpecOf<RemoteImageResult> = {
  kind: 'object',
  required: {
    assetUrl: { kind: 'string' },
    mime: { kind: 'string' },
    sizeBytes: { kind: 'number' },
    finalUrl: { kind: 'string' },
    cacheKey: { kind: 'string' },
    fromCache: { kind: 'boolean' },
  },
}

const APP_INFO_LEGAL: SpecOf<AppInfo['legal']> = {
  kind: 'object',
  required: {
    sourceEntryUrl: { kind: 'nullable', of: { kind: 'string' } },
    licenseAvailable: { kind: 'boolean' },
    thirdPartyAvailable: { kind: 'boolean' },
  },
  optional: { sourceEntryNote: { kind: 'string' } },
}

const APP_INFO: SpecOf<AppInfo> = {
  kind: 'object',
  required: {
    name: { kind: 'enum', values: ['纸栈 PaperStack'] },
    version: { kind: 'string' },
    owner: { kind: 'enum', values: ['Quirkybrain'] },
    license: { kind: 'enum', values: ['GPL-3.0-only'] },
    ipcContract: { kind: 'enum', values: ['paperstack-ipc-r1'] },
    locale: { kind: 'enum', values: ['zh-CN'] },
    legal: APP_INFO_LEGAL,
  },
  optional: {
    tauriVersion: { kind: 'string' },
    webkitVersion: { kind: 'string' },
    os: { kind: 'string' },
  },
}

const LEGAL_TEXT_RESULT: SpecOf<LegalTextResult> = {
  kind: 'object',
  required: { text: { kind: 'string' }, resourceName: { kind: 'string' } },
}

const OPEN_REQUEST: SpecOf<OpenRequest> = {
  kind: 'object',
  required: {
    paths: { kind: 'array', items: { kind: 'string' } },
    cwd: { kind: 'nullable', of: { kind: 'string' } },
    source: { kind: 'enum', values: ['cli', 'second-instance'] },
  },
}

const DIAGNOSTICS_PREVIEW: SpecOf<DiagnosticsPreview> = {
  kind: 'object',
  required: {
    exportId: { kind: 'string' },
    generatedAtMs: { kind: 'number' },
    text: { kind: 'string' },
    sections: {
      kind: 'array',
      items: {
        kind: 'object',
        required: { name: { kind: 'string' }, bytes: { kind: 'number' } },
      },
    },
    redactionCount: { kind: 'number' },
    expiresAtMs: { kind: 'number' },
  },
}

const EXPORT_RESULT: SpecOf<ExportResult> = {
  kind: 'object',
  required: { writtenPath: { kind: 'string' }, bytes: { kind: 'number' } },
}

const SOURCE_MATCH: SpecOf<SourceMatch> = {
  kind: 'object',
  required: {
    startByte: { kind: 'number' },
    endByte: { kind: 'number' },
    lineNumber: { kind: 'number' },
  },
}

const SOURCE_SEARCH_RESULT: SpecOf<SourceSearchResult> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    version: VERSION_INFO,
    matches: { kind: 'array', items: SOURCE_MATCH },
    scannedBytes: { kind: 'number' },
    totalBytes: { kind: 'number' },
    complete: { kind: 'boolean' },
  },
}

// --- request model specs ----------------------------------------------------

const OPEN_DOCUMENTS_REQUEST: SpecOf<OpenDocumentsRequest> = {
  kind: 'object',
  required: {
    paths: { kind: 'array', items: { kind: 'string' } },
    entry: {
      kind: 'enum',
      values: ['dialog', 'drop', 'cli', 'system', 'tree', 'recent', 'restore'],
    },
  },
}

const READ_DOCUMENT_REQUEST: SpecOf<ReadDocumentRequest> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    purpose: { kind: 'enum', values: ['initial', 'refresh', 'restore', 'relink'] },
  },
}

const RELINK_REQUEST: SpecOf<RelinkRequest> = {
  kind: 'object',
  required: { docId: { kind: 'string' }, newPath: { kind: 'string' } },
}

const DOC_ID_REQUEST: SpecOf<DocIdRequest> = {
  kind: 'object',
  required: { docId: { kind: 'string' } },
}

const READ_SOURCE_WINDOW_REQUEST: SpecOf<ReadSourceWindowRequest> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    startLine: { kind: 'number' },
    maxLines: { kind: 'number' },
  },
}

const OPEN_DIRECTORY_REQUEST: SpecOf<OpenDirectoryRequest> = {
  kind: 'object',
  required: { path: { kind: 'string' }, persist: { kind: 'boolean' } },
}

const READ_DIRECTORY_REQUEST: SpecOf<ReadDirectoryRequest> = {
  kind: 'object',
  required: { rootId: { kind: 'string' }, dirPath: { kind: 'string' } },
}

const WATCH_REQUEST: SpecOf<WatchRequest> = {
  kind: 'object',
  required: { docId: { kind: 'string' } },
  optional: { resourcePaths: { kind: 'array', items: { kind: 'string' } } },
}

const SAVE_POSITION_REQUEST: SpecOf<SavePositionRequest> = {
  kind: 'object',
  required: { docId: { kind: 'string' }, anchor: ANCHOR_RECORD },
}

const SAVE_SESSION_REQUEST: SpecOf<SaveSessionRequest> = {
  kind: 'object',
  required: { tabs: { kind: 'array', items: SESSION_TAB } },
}

const CLEAR_RECORDS_REQUEST: SpecOf<ClearRecordsRequest> = {
  kind: 'object',
  required: {
    categories: { kind: 'array', items: { kind: 'enum', values: STORAGE_CATEGORIES } },
    confirm: { kind: 'boolean' },
  },
}

const RESUME_RECORDING_REQUEST: SpecOf<ResumeRecordingRequest> = {
  kind: 'object',
  required: {},
  optional: {
    categories: { kind: 'array', items: { kind: 'enum', values: STORAGE_CATEGORIES } },
  },
}

const GLOBAL_SETTINGS_PATCH: SpecOf<Partial<GlobalSettings>> = {
  kind: 'object',
  required: {},
  optional: {
    theme: { kind: 'enum', values: ['system', 'light', 'dark'] },
    fontSizePx: { kind: 'number' },
    lineHeight: { kind: 'number' },
    maxContentWidthPx: { kind: 'number' },
    syntaxMode: { kind: 'enum', values: ['technical', 'standard'] },
    updateModeDefault: { kind: 'enum', values: ['keep', 'follow'] },
    restoreSession: { kind: 'boolean' },
    rememberRecords: { kind: 'boolean' },
  },
}

const UPDATE_SETTINGS_REQUEST: SpecOf<UpdateSettingsRequest> = {
  kind: 'object',
  required: { patch: GLOBAL_SETTINGS_PATCH },
}

const CHECK_RESOURCE_ACCESS_REQUEST: SpecOf<CheckResourceAccessRequest> = {
  kind: 'object',
  required: { docId: { kind: 'string' }, rawSrc: { kind: 'string' } },
}

const GRANT_LOCAL_ROOT_REQUEST: SpecOf<GrantLocalRootRequest> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    rootPath: { kind: 'string' },
    persist: { kind: 'boolean' },
  },
}

const GRANT_ID_REQUEST: SpecOf<GrantIdRequest> = {
  kind: 'object',
  required: { grantId: { kind: 'string' } },
}

const GRANT_REMOTE_SESSION_REQUEST: SpecOf<GrantRemoteSessionRequest> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    origins: { kind: 'array', items: { kind: 'string' } },
  },
}

const FETCH_REMOTE_IMAGE_REQUEST: SpecOf<FetchRemoteImageRequest> = {
  kind: 'object',
  required: { docId: { kind: 'string' }, url: { kind: 'string' } },
}

const URL_REQUEST: SpecOf<UrlRequest> = {
  kind: 'object',
  required: { url: { kind: 'string' } },
}

const PATH_REQUEST: SpecOf<PathRequest> = {
  kind: 'object',
  required: { path: { kind: 'string' } },
}

const READ_LEGAL_TEXT_REQUEST: SpecOf<ReadLegalTextRequest> = {
  kind: 'object',
  required: { kind: { kind: 'enum', values: ['license', 'third_party_notices'] } },
}

const DIAGNOSTICS_PREVIEW_REQUEST: SpecOf<DiagnosticsPreviewRequest> = {
  kind: 'object',
  required: {
    includeSourceContext: { kind: 'boolean' },
    includeFullPaths: { kind: 'boolean' },
  },
}

const EXPORT_DIAGNOSTICS_REQUEST: SpecOf<ExportDiagnosticsRequest> = {
  kind: 'object',
  required: {
    exportId: { kind: 'string' },
    targetPath: { kind: 'string' },
    overwrite: { kind: 'boolean' },
  },
}

const SEARCH_SOURCE_REQUEST: SpecOf<SearchSourceRequest> = {
  kind: 'object',
  required: {
    docId: { kind: 'string' },
    query: { kind: 'string' },
    caseSensitive: { kind: 'boolean' },
    maxResults: { kind: 'number' },
  },
}

const UNIT_RESPONSE: SpecOf<void> = { kind: 'void' }

// ---------------------------------------------------------------------------
// Fixture ↔ service layer tables
// ---------------------------------------------------------------------------

/** Request spec per command (`null` exactly for no-argument commands). */
const REQUEST_SPECS = {
  pick_files: null,
  pick_directory: null,
  pick_export_target: null,
  open_documents: OPEN_DOCUMENTS_REQUEST,
  read_document: READ_DOCUMENT_REQUEST,
  relink_document: RELINK_REQUEST,
  get_source_info: DOC_ID_REQUEST,
  read_source_window: READ_SOURCE_WINDOW_REQUEST,
  open_directory: OPEN_DIRECTORY_REQUEST,
  read_directory: READ_DIRECTORY_REQUEST,
  watch_document: WATCH_REQUEST,
  unwatch_document: DOC_ID_REQUEST,
  list_recents: null,
  touch_recent: DOC_ID_REQUEST,
  save_position: SAVE_POSITION_REQUEST,
  load_position: DOC_ID_REQUEST,
  save_session: SAVE_SESSION_REQUEST,
  load_session: null,
  get_storage_overview: null,
  clear_records: CLEAR_RECORDS_REQUEST,
  resume_recording: RESUME_RECORDING_REQUEST,
  get_settings: null,
  update_settings: UPDATE_SETTINGS_REQUEST,
  check_resource_access: CHECK_RESOURCE_ACCESS_REQUEST,
  grant_local_root: GRANT_LOCAL_ROOT_REQUEST,
  list_grants: null,
  revoke_grant: GRANT_ID_REQUEST,
  grant_remote_session: GRANT_REMOTE_SESSION_REQUEST,
  revoke_remote_session: DOC_ID_REQUEST,
  fetch_remote_image: FETCH_REMOTE_IMAGE_REQUEST,
  open_external_url: URL_REQUEST,
  reveal_in_folder: PATH_REQUEST,
  get_app_info: null,
  read_legal_text: READ_LEGAL_TEXT_REQUEST,
  take_pending_open_requests: null,
  preview_diagnostics: DIAGNOSTICS_PREVIEW_REQUEST,
  export_diagnostics: EXPORT_DIAGNOSTICS_REQUEST,
  search_source: SEARCH_SOURCE_REQUEST,
} satisfies {
  [K in CommandName]: RequestModels[K] extends null ? null : SpecOf<RequestModels[K]>
}

/** Response spec per command. */
const RESPONSE_SPECS = {
  pick_files: PICK_RESULT,
  pick_directory: PICK_RESULT,
  pick_export_target: PICK_RESULT,
  open_documents: OPEN_DOCUMENTS_RESULT,
  read_document: DOCUMENT_SNAPSHOT,
  relink_document: RELINK_RESULT,
  get_source_info: SOURCE_INFO,
  read_source_window: SOURCE_WINDOW,
  open_directory: DIRECTORY_ROOT,
  read_directory: DIRECTORY_LISTING,
  watch_document: UNIT_RESPONSE,
  unwatch_document: UNIT_RESPONSE,
  list_recents: { kind: 'array', items: RECENT_ENTRY },
  touch_recent: UNIT_RESPONSE,
  save_position: SAVE_RESULT,
  load_position: { kind: 'nullable', of: POSITION_RECORD },
  save_session: SAVE_RESULT,
  load_session: { kind: 'nullable', of: SESSION_SNAPSHOT },
  get_storage_overview: STORAGE_OVERVIEW,
  clear_records: { kind: 'array', items: CLEAR_RESULT },
  resume_recording: UNIT_RESPONSE,
  get_settings: SETTINGS_BUNDLE,
  update_settings: UPDATE_SETTINGS_RESULT,
  check_resource_access: ACCESS_DECISION,
  grant_local_root: GRANT_RECORD,
  list_grants: { kind: 'array', items: GRANT_RECORD },
  revoke_grant: REVOKE_RESULT,
  grant_remote_session: GRANT_RECORD,
  revoke_remote_session: REVOKE_RESULT,
  fetch_remote_image: REMOTE_IMAGE_RESULT,
  open_external_url: UNIT_RESPONSE,
  reveal_in_folder: UNIT_RESPONSE,
  get_app_info: APP_INFO,
  read_legal_text: LEGAL_TEXT_RESULT,
  take_pending_open_requests: { kind: 'array', items: OPEN_REQUEST },
  preview_diagnostics: DIAGNOSTICS_PREVIEW,
  export_diagnostics: EXPORT_RESULT,
  search_source: SOURCE_SEARCH_RESULT,
} satisfies { [K in CommandName]: SpecOf<ResponseModels[K]> }

/** Service call replayed with the fixture request; returns the fixture model. */
const INVOCATIONS = {
  pick_files: () => files.pickFiles(),
  pick_directory: () => files.pickDirectory(),
  pick_export_target: () => files.pickExportTarget(),
  open_documents: (req) => files.openDocuments(req),
  read_document: (req) => files.readDocument(req),
  relink_document: (req) => files.relinkDocument(req),
  get_source_info: (req) => files.getSourceInfo(req.docId),
  read_source_window: (req) => files.readSourceWindow(req),
  open_directory: (req) => tree.openDirectory(req),
  read_directory: (req) => tree.readDirectory(req),
  watch_document: (req) => watch.watchDocument(req),
  unwatch_document: (req) => watch.unwatchDocument(req.docId),
  list_recents: () => storage.listRecents(),
  touch_recent: (req) => storage.touchRecent(req.docId),
  save_position: (req) => storage.savePosition(req),
  load_position: (req) => storage.loadPosition(req.docId),
  save_session: (req) => storage.saveSession(req),
  load_session: () => storage.loadSession(),
  get_storage_overview: () => storage.getStorageOverview(),
  clear_records: (req) => storage.clearRecords(req),
  resume_recording: (req) => storage.resumeRecording(req),
  get_settings: () => settings.getSettings(),
  update_settings: (req) => settings.updateSettings(req.patch),
  check_resource_access: (req) => auth.checkResourceAccess(req),
  grant_local_root: (req) => auth.grantLocalRoot(req),
  list_grants: () => auth.listGrants(),
  revoke_grant: (req) => auth.revokeGrant(req.grantId),
  grant_remote_session: (req) => remote.grantRemoteSession(req),
  revoke_remote_session: (req) => remote.revokeRemoteSession(req.docId),
  fetch_remote_image: (req) => remote.fetchRemoteImage(req),
  open_external_url: (req) => opener.openExternalUrl(req.url),
  reveal_in_folder: (req) => opener.revealInFolder(req.path),
  get_app_info: () => app.getAppInfo(),
  read_legal_text: (req) => app.readLegalText(req.kind),
  take_pending_open_requests: () => app.takePendingOpenRequests(),
  preview_diagnostics: (req) => diagnostics.previewDiagnostics(req),
  export_diagnostics: (req) => diagnostics.exportDiagnostics(req),
  search_source: (req) => search.searchSource(req),
} satisfies {
  [K in CommandName]: (req: RequestModels[K]) => Promise<ResponseModels[K]>
}

/** IPC argument envelope expected on the wire for each fixture request. */
const EXPECTED_ARGS = {
  pick_files: () => undefined,
  pick_directory: () => undefined,
  pick_export_target: () => undefined,
  open_documents: (req) => ({ req }),
  read_document: (req) => ({ req }),
  relink_document: (req) => ({ req }),
  get_source_info: (req) => ({ docId: req.docId }),
  read_source_window: (req) => ({ req }),
  open_directory: (req) => ({ req }),
  read_directory: (req) => ({ req }),
  watch_document: (req) => ({ req }),
  unwatch_document: (req) => ({ docId: req.docId }),
  list_recents: () => undefined,
  touch_recent: (req) => ({ docId: req.docId }),
  save_position: (req) => ({ req }),
  load_position: (req) => ({ docId: req.docId }),
  save_session: (req) => ({ req }),
  load_session: () => undefined,
  get_storage_overview: () => undefined,
  clear_records: (req) => ({ req }),
  resume_recording: (req) => ({ req }),
  get_settings: () => undefined,
  update_settings: (req) => ({ req: { patch: req.patch } }),
  check_resource_access: (req) => ({ req }),
  grant_local_root: (req) => ({ req }),
  list_grants: () => undefined,
  revoke_grant: (req) => ({ grantId: req.grantId }),
  grant_remote_session: (req) => ({ req }),
  revoke_remote_session: (req) => ({ docId: req.docId }),
  fetch_remote_image: (req) => ({ req }),
  open_external_url: (req) => ({ url: req.url }),
  reveal_in_folder: (req) => ({ path: req.path }),
  get_app_info: () => undefined,
  read_legal_text: (req) => ({ req: { kind: req.kind } }),
  take_pending_open_requests: () => undefined,
  preview_diagnostics: (req) => ({ req }),
  export_diagnostics: (req) => ({ req }),
  search_source: (req) => ({ req }),
} satisfies {
  [K in CommandName]: (req: RequestModels[K]) => Record<string, unknown> | undefined
}

// ---------------------------------------------------------------------------
// Runtime shape validation
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeValue(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function collectErrors(value: unknown, spec: Spec, path: string, errors: string[]): void {
  switch (spec.kind) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${path}: expected string, got ${describeValue(value)}`)
      }
      break
    case 'enum':
      if (typeof value !== 'string' || !spec.values.includes(value)) {
        errors.push(
          `${path}: expected one of [${spec.values.join(', ')}], got ${JSON.stringify(value)}`,
        )
      }
      break
    case 'number':
      if (typeof value !== 'number') {
        errors.push(`${path}: expected number, got ${describeValue(value)}`)
      }
      break
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`${path}: expected boolean, got ${describeValue(value)}`)
      }
      break
    case 'scalar':
      if (!['string', 'number', 'boolean'].includes(typeof value)) {
        errors.push(`${path}: expected string|number|boolean, got ${describeValue(value)}`)
      }
      break
    case 'null':
      if (value !== null) {
        errors.push(`${path}: expected null, got ${describeValue(value)}`)
      }
      break
    case 'void':
      // Unit commands normalize to an empty object in the frozen fixtures.
      if (!isPlainObject(value) || Object.keys(value).length > 0) {
        errors.push(`${path}: expected {} for a unit response, got ${JSON.stringify(value)}`)
      }
      break
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${describeValue(value)}`)
        break
      }
      value.forEach((item, index) => collectErrors(item, spec.items, `${path}[${index}]`, errors))
      break
    case 'record':
      if (!isPlainObject(value)) {
        errors.push(`${path}: expected record, got ${describeValue(value)}`)
        break
      }
      for (const [key, item] of Object.entries(value)) {
        collectErrors(item, spec.values, `${path}.${key}`, errors)
      }
      break
    case 'nullable':
      if (value !== null) collectErrors(value, spec.of, path, errors)
      break
    case 'object': {
      if (!isPlainObject(value)) {
        errors.push(`${path}: expected object, got ${describeValue(value)}`)
        break
      }
      const allowed = new Set([
        ...Object.keys(spec.required),
        ...Object.keys(spec.optional ?? {}),
      ])
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${path}.${key}: field is not part of the service-layer type`)
        }
      }
      for (const [key, child] of Object.entries(spec.required)) {
        if (!(key in value)) {
          errors.push(`${path}.${key}: required field missing`)
        } else {
          collectErrors(value[key], child, `${path}.${key}`, errors)
        }
      }
      for (const [key, child] of Object.entries(spec.optional ?? {})) {
        if (key in value) collectErrors(value[key], child, `${path}.${key}`, errors)
      }
      break
    }
  }
}

function shapeErrors(value: unknown, spec: Spec): string[] {
  const errors: string[] = []
  collectErrors(value, spec, '$', errors)
  return errors
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

interface CommandFixtureEntry {
  command: string
  request: unknown
  response: unknown
}

interface CommandsFixtureFile {
  contract: string
  commands: CommandFixtureEntry[]
}

const repoRoot = process.cwd()
const fixture = JSON.parse(
  readFileSync(join(repoRoot, 'fixtures/contracts/commands.json'), 'utf8'),
) as CommandsFixtureFile

const invokeMock = vi.mocked(invoke)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('frozen command fixtures ↔ service layer surface', () => {
  it('covers all 38 commands of paperstack-ipc-r1 in contract order', () => {
    expect(fixture.contract).toBe('paperstack-ipc-r1')
    expect(fixture.commands).toHaveLength(38)

    const names = fixture.commands.map((entry) => entry.command)
    expect(names).toEqual([...COMMAND_ORDER])
    expect(new Set(names).size).toBe(38)

    for (const entry of fixture.commands) {
      const name = entry.command as CommandName
      expect(typeof SERVICE_FUNCTIONS[name], `${name}: service function`).toBe('function')
      expect(typeof INVOCATIONS[name], `${name}: invocation`).toBe('function')
      expect(entry).toHaveProperty('request')
      expect(entry.response, `${name}: response sample`).not.toBeUndefined()
    }
  })

  it('runtime shape validator rejects missing, unknown and mistyped fields', () => {
    const valid: Record<string, unknown> = {
      code: 'PS_INTERNAL',
      category: 'internal',
      messageKey: 'error.internal.unexpected',
      retryable: true,
    }
    expect(shapeErrors(valid, ERROR_PAYLOAD)).toEqual([])

    const missing = { code: 'PS_INTERNAL', category: 'internal', messageKey: 'x' }
    expect(shapeErrors(missing, ERROR_PAYLOAD).some((error) => error.includes('retryable'))).toBe(
      true,
    )

    const mistyped = { ...valid, retryable: 'yes' }
    expect(shapeErrors(mistyped, ERROR_PAYLOAD).some((error) => error.includes('retryable'))).toBe(
      true,
    )

    const badEnum = { ...valid, category: 'bogus' }
    expect(shapeErrors(badEnum, ERROR_PAYLOAD).some((error) => error.includes('category'))).toBe(
      true,
    )

    const unknownField = { ...valid, extra: 1 }
    expect(shapeErrors(unknownField, ERROR_PAYLOAD).some((error) => error.includes('extra'))).toBe(
      true,
    )

    expect(shapeErrors('not-an-object', ERROR_PAYLOAD)).toHaveLength(1)
  })

  it('service call surface and response models are type-bound to src/services', () => {
    // Runtime no-ops; the Vitest typecheck step evaluates the declarations.
    expectTypeOf<ServiceFunctionCoverage>().toEqualTypeOf<true>()
    expectTypeOf<ResponseModelBinding>().toEqualTypeOf<Record<CommandName, true>>()
  })
})

describe('per-command fixture replay through the service layer', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  for (const [index, entry] of fixture.commands.entries()) {
    const name = entry.command as CommandName

    it(`${index + 1}. ${entry.command}`, async () => {
      expect(COMMAND_ORDER[index]).toBe(name)

      const requestSpec = REQUEST_SPECS[name]
      if (requestSpec === null) {
        expect(entry.request, `${name}: no-argument command`).toBeNull()
      } else {
        expect(shapeErrors(entry.request, requestSpec), `${name}: request sample`).toEqual([])
      }
      expect(shapeErrors(entry.response, RESPONSE_SPECS[name]), `${name}: response sample`).toEqual(
        [],
      )

      invokeMock.mockResolvedValue(entry.response as never)
      const replay = INVOCATIONS[name] as (req: unknown) => Promise<unknown>
      const expectedArgs = EXPECTED_ARGS[name] as (
        req: unknown,
      ) => Record<string, unknown> | undefined

      const resolved = await replay(entry.request)

      expect(invokeMock, `${name}: exactly one IPC dispatch`).toHaveBeenCalledTimes(1)
      expect(invokeMock, `${name}: command and argument envelope`).toHaveBeenLastCalledWith(
        name,
        expectedArgs(entry.request),
      )
      expect(resolved, `${name}: fixture response passes through unmodified`).toEqual(
        entry.response,
      )
    })
  }
})
