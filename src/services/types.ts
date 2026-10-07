/**
 * Hand-written TypeScript mirror of the shared Rust/TS models in
 * `artifacts/30-architecture/contracts.md` §3 (`paperstack-ipc-r1`).
 *
 * Field names and shapes are contract, not convenience: the Rust structs use
 * serde `rename_all = "camelCase"`, and a contract-shape test guards the
 * boundary. Do not add, rename or retype fields here without a contract
 * revision (contracts §3; §Compatibility).
 */

/** UTF-8 byte offsets into the decoded source text; half-open `[start, end)`. */
export interface SourceRange {
  startByte: number
  endByte: number
}

// ---------------------------------------------------------------------------
// §3.1 Documents and versions
// ---------------------------------------------------------------------------

export interface DocIdentity {
  /** Opaque stable id: `"d-" + sha256(canonicalPath)[..16]`. */
  docId: string
  canonicalPath: string
  displayName: string
  format: 'markdown'
  encoding: 'utf-8' | 'utf-8-bom'
  /** sha256 hex (lowercase, 64 chars) of the last successful read. */
  contentHash: string
  sizeBytes: number
  lastSeenAtMs: number
}

export interface VersionInfo {
  /** sha256 hex; the version key is the content hash. */
  contentHash: string
  sizeBytes: number
  /** Disk mtime in epoch ms. */
  modifiedAtMs: number
  /** When this application finished the read. */
  observedAtMs: number
}

export interface DocumentSnapshot {
  docId: string
  identity: DocIdentity
  version: VersionInfo
  /** Decoded text, BOM stripped, original newlines preserved. */
  text: string
  /** 1-based line count matching the source view. */
  lineCount: number
}

export type OpenStatus = 'opened' | 'duplicate' | 'rejected'

export interface OpenOutcome {
  /** Original input path. */
  path: string
  status: OpenStatus
  docId?: string
  identity?: DocIdentity
  duplicateOfDocId?: string
  error?: ErrorPayload
}

export type OpenEntry = 'dialog' | 'drop' | 'cli' | 'system' | 'tree' | 'recent' | 'restore'

export interface OpenDocumentsRequest {
  paths: string[]
  entry: OpenEntry
}

/** Items keep request order (contracts §2.1). */
export interface OpenDocumentsResult {
  items: OpenOutcome[]
}

export interface PickResult {
  cancelled: boolean
  /** Empty when `cancelled` is true. */
  paths: string[]
}

export type ReadDocumentPurpose = 'initial' | 'refresh' | 'restore' | 'relink'

export interface ReadDocumentRequest {
  docId: string
  purpose: ReadDocumentPurpose
}

export interface RelinkRequest {
  docId: string
  newPath: string
}

export type RelinkStatus = 'reassociated' | 'new-version'

export interface RelinkResult {
  status: RelinkStatus
  snapshot: DocumentSnapshot
}

export interface SourceInfo {
  docId: string
  version: VersionInfo
  encoding: 'utf-8' | 'utf-8-bom'
  totalLines: number
}

export interface ReadSourceWindowRequest {
  docId: string
  /** 1-based. */
  startLine: number
  /** 1..2000. */
  maxLines: number
}

export interface SourceWindow {
  docId: string
  version: VersionInfo
  startLine: number
  endLine: number
  text: string
  eof: boolean
}

/** Literal substring search; only used for the >50MiB source-window mode. */
export interface SearchSourceRequest {
  docId: string
  query: string
  caseSensitive: boolean
  maxResults: number
}

export interface SourceMatch {
  startByte: number
  endByte: number
  /** 1-based. */
  lineNumber: number
}

export interface SourceSearchResult {
  docId: string
  version: VersionInfo
  /** Document order (byte order). */
  matches: SourceMatch[]
  scannedBytes: number
  totalBytes: number
  /** `false` means incomplete (budget/cancel); never report partial as complete. */
  complete: boolean
}

// ---------------------------------------------------------------------------
// §3.2 Directory tree
// ---------------------------------------------------------------------------

export interface OpenDirectoryRequest {
  path: string
  /** Defaults to false: session-scoped unless explicitly persisted (R25). */
  persist: boolean
}

export interface DirectoryRoot {
  rootId: string
  canonicalPath: string
  displayName: string
  scope: 'session' | 'persistent'
}

export interface ReadDirectoryRequest {
  rootId: string
  /** Must stay inside `rootId`'s authorized root. */
  dirPath: string
}

export type DirectoryNodeKind = 'file' | 'directory' | 'symlink' | 'other'

export type DirectoryNodeStatus =
  | 'ok'
  | 'missing'
  | 'no-permission'
  | 'out-of-root'
  | 'symlink-inside'
  | 'symlink-outside'

export interface DirectoryNode {
  name: string
  path: string
  kind: DirectoryNodeKind
  status: DirectoryNodeStatus
  /** Only for directory / symlink-inside; lazy expansion. */
  hasChildren?: boolean
  /** Only for files; extension check is case-insensitive. */
  isMarkdown?: boolean
  /** Only for symlinks; omitted when unresolvable. */
  symlinkTarget?: string
}

/** Initial cap per directory: 2000 entries. */
export interface DirectoryListing {
  dirPath: string
  entries: DirectoryNode[]
  truncated: boolean
}

// ---------------------------------------------------------------------------
// §3.3 Watch
// ---------------------------------------------------------------------------

export interface WatchRequest {
  docId: string
  /** Each call replaces the whole resource set (contracts §1.7/§7.1). */
  resourcePaths?: string[]
}

export type WatchKind = 'modified' | 'removed' | 'appeared' | 'resource'

export interface WatchChangedPayload {
  docId: string
  kind: WatchKind
  resourcePath?: string
  observedAtMs: number
}

// ---------------------------------------------------------------------------
// §3.4 Storage and records
// ---------------------------------------------------------------------------

export interface AnchorRecord {
  /** Content hash at recording time. */
  versionHash: string
  /** Heading path; `[]` means the document top. */
  headingPath: string[]
  /** `"fp1:" + sha256(blockSearchText)[..16]`. */
  blockFingerprint: string
  /** In-block ratio 0..1. */
  offsetRatio: number
  /** UTF-8 byte range in the recorded version. */
  sourceRange: SourceRange
}

export interface PositionRecord {
  docId: string
  anchor: AnchorRecord
  updatedAtMs: number
}

export interface SavePositionRequest {
  docId: string
  anchor: AnchorRecord
}

export interface SaveResult {
  saved: boolean
  error?: ErrorPayload
}

export interface RecentEntry {
  docId: string
  displayName: string
  canonicalPath: string
  openedAtMs: number
  available: boolean
}

export interface SessionTab {
  tabId: string
  docId: string
  orderIndex: number
  isActive: boolean
}

export interface SaveSessionRequest {
  tabs: SessionTab[]
}

export interface SessionSnapshot {
  tabs: SessionTab[]
  activeTabId: string | null
  savedAtMs: number
}

export type StorageCategory =
  | 'recents'
  | 'positions'
  | 'session'
  | 'cache'
  | 'authorizations'
  | 'logs'

export interface StorageCategoryInfo {
  category: StorageCategory
  count: number
  bytes?: number
}

export interface StorageOverview {
  categories: StorageCategoryInfo[]
  databasePath: string
  cacheDir: string
}

export interface ClearRecordsRequest {
  categories: StorageCategory[]
  confirm: boolean
}

export interface ClearResult {
  category: StorageCategory
  cleared: number
  error?: ErrorPayload
}

/** Omitted categories mean "all" (contracts §3.4). */
export interface ResumeRecordingRequest {
  categories?: StorageCategory[]
}

// ---------------------------------------------------------------------------
// §3.5 Settings
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark'

export type SyntaxMode = 'technical' | 'standard'

export type UpdateMode = 'keep' | 'follow'

export interface GlobalSettings {
  theme: ThemePreference
  /** 14..24, default 17. */
  fontSizePx: number
  /** 1.5..2.2, default 1.8. */
  lineHeight: number
  /** 560..960, default 760. */
  maxContentWidthPx: number
  /** Default technical (R08). */
  syntaxMode: SyntaxMode
  /** Default keep (R21). */
  updateModeDefault: UpdateMode
  /** Default true (R06). */
  restoreSession: boolean
  /** Default true (R06/R27). */
  rememberRecords: boolean
}

/** Frozen limits: 100 recents / 256MiB cache / 10MiB logs (SRS §6.1). */
export interface FrozenLimits {
  recentLimit: number
  cacheMaxBytes: number
  logMaxBytes: number
}

export interface SettingsBundle {
  global: GlobalSettings
  defaults: GlobalSettings
  limits: FrozenLimits
  revision: number
}

export interface UpdateSettingsRequest {
  patch: Partial<GlobalSettings>
}

export interface UpdateSettingsResult {
  applied: GlobalSettings
  persisted: boolean
  revision: number
  error?: ErrorPayload
}

// ---------------------------------------------------------------------------
// §3.6 Authorization and resources
// ---------------------------------------------------------------------------

export interface CheckResourceAccessRequest {
  docId: string
  /** Raw reference exactly as written in the document. */
  rawSrc: string
}

export type AccessStatus =
  | 'allowed'
  | 'remote-blocked'
  | 'outside-root'
  | 'missing'
  | 'unsupported'
  | 'denied'

export type AccessKind = 'local' | 'remote' | 'inline' | 'other'

/** Never rejects; the status drives the UI decision (contracts §2.1). */
export interface AccessDecision {
  status: AccessStatus
  kind: AccessKind
  /** local. */
  canonicalPath?: string
  /** allowed only; generated by Rust with the `?v=` observation key. */
  assetUrl?: string
  /** outside-root: canonical directory suggested for confirmation. */
  rootCandidate?: string
  /** remote. */
  origin?: string
  reason?: ErrorPayload
}

export interface GrantRecord {
  grantId: string
  kind: 'file' | 'directory' | 'remote'
  scope: 'session' | 'persistent'
  canonicalPath?: string
  origins?: string[]
  docId?: string
  grantedAtMs: number
}

export interface GrantLocalRootRequest {
  docId: string
  rootPath: string
  persist: boolean
}

export interface GrantRemoteSessionRequest {
  docId: string
  /** Each entry is `"https://host[:port]"`. */
  origins: string[]
}

export interface FetchRemoteImageRequest {
  docId: string
  url: string
}

export interface RemoteImageResult {
  assetUrl: string
  mime: string
  sizeBytes: number
  finalUrl: string
  cacheKey: string
  fromCache: boolean
}

export interface RevokeResult {
  revoked: boolean
  cancelledRequests: number
  removedCacheEntries: number
}

// ---------------------------------------------------------------------------
// §3.7 Diagnostics and application
// ---------------------------------------------------------------------------

export type ErrorCategory =
  | 'io'
  | 'encoding'
  | 'auth'
  | 'resource'
  | 'parse'
  | 'storage'
  | 'limit'
  | 'internal'

/** Normalized command failure; the UI only shows `messageKey` (contracts §5). */
export interface ErrorPayload {
  /** Stable code from contracts §5, e.g. `PS_IO_NOT_FOUND`. */
  code: string
  category: ErrorCategory
  /** i18n key, e.g. `error.io.notFound`. */
  messageKey: string
  retryable: boolean
  /** Present when applicable (parse/resource localization). */
  sourceRange?: SourceRange
  /** Sanitized key/value pairs for the "technical details" fold. */
  details?: Record<string, string | number | boolean>
}

export interface DiagnosticIssue {
  code: string
  category: ErrorCategory
  messageKey: string
  sourceRange?: SourceRange
  count: number
  firstSeenAtMs: number
}

export interface DiagnosticsBundle {
  bundleVersion: 1
  generatedAtMs: number
  app: {
    name: string
    version: string
    ipcContract: string
    tauriVersion?: string
    webkitVersion?: string
    os?: string
  }
  documents: Array<{
    docIdShort: string
    displayNameRedacted: string
    versionHash: string
    status: string
    issues: DiagnosticIssue[]
  }>
  limits: FrozenLimits & {
    largeFileBytes: number
    hardLimitBytes: number
    imageBytes: number
  }
  redactions: string[]
}

export interface DiagnosticsPreviewRequest {
  includeSourceContext: boolean
  includeFullPaths: boolean
}

export interface DiagnosticsPreview {
  exportId: string
  generatedAtMs: number
  text: string
  sections: Array<{ name: string; bytes: number }>
  redactionCount: number
  expiresAtMs: number
}

export interface ExportDiagnosticsRequest {
  exportId: string
  targetPath: string
  overwrite: boolean
}

export interface ExportResult {
  writtenPath: string
  bytes: number
}

export interface AppInfo {
  name: '纸栈 PaperStack'
  version: string
  owner: 'Quirkybrain'
  license: 'GPL-3.0-only'
  ipcContract: 'paperstack-ipc-r1'
  locale: 'zh-CN'
  tauriVersion?: string
  webkitVersion?: string
  os?: string
  legal: {
    sourceEntryUrl: string | null
    sourceEntryNote?: string
    licenseAvailable: boolean
    thirdPartyAvailable: boolean
  }
}

export interface OpenRequest {
  paths: string[]
  cwd: string | null
  source: 'cli' | 'second-instance'
}

export type LegalTextKind = 'license' | 'third_party_notices'

export interface ReadLegalTextRequest {
  kind: LegalTextKind
}

export interface LegalTextResult {
  text: string
  resourceName: string
}
