# 纸栈 PaperStack · v0.1.0 IPC 契约（Contracts）

- **Producer**: agent:solution-architect
- **Artifact ID**: ART-30-IPC
- **Artifact Type**: Interface Contract（Tauri 命令 / 事件 / 数据模型 / 错误分类 / 版本正确性规范）
- **Status**: VALID
- **Revision**: 1
- **Owner**: solution-architect
- **Contract ID**: `paperstack-ipc-r1`
- **Task**: `wp-03-architecture`（任务分支 `task/wp-03-architecture`；父分支 `feat/v0.1.0`；基线提交 `7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b`；产出提交主题 `docs(architecture): define v0.1.0 architecture and contracts`）
- **Last Verified**: 2026-10-07
- **Scope**: v0.1.0 前端（WebView/TS）与 Rust 本地服务之间的全部命令与事件。Rust 命令名 `snake_case`；TS 封装名 `camelCase`；JSON 字段一律 `camelCase`（serde `rename_all = "camelCase"`）。
- **Depends On**: `artifacts/30-architecture/architecture.md`（ART-30-ARCH）；ART-20-RB（Rev 1）；SRS §4–§6；IXD §4–§15。
- **Downstream**: 实现（Rust 命令/服务、TS services）、UI 规格、模型、测试工程（契约形状测试）、追溯矩阵。
- **Compatibility**: `r1` 为 v0.1.0 唯一修订。新增命令/事件/可选字段 → `r2` 并同步 TS 类型；删除或改变字段语义必须提升主修订并在架构/变更影响中记录。

---

## 1. 通用约定

1. **单位**：时间一律 epoch 毫秒 UTC，后缀 `AtMs`；大小后缀 `Bytes`；像素后缀 `Px`；比例 `0..1`；行号 1 起始。
2. **偏移单位（强制）**：IPC 中的 `SourceRange {startByte, endByte}` 为**解码后原文的 UTF-8 字节偏移**，半开区间 `[start, end)`。前端内部（mdast/hast position、JS 字符串）使用 UTF-16 code unit；跨边界处用经 CJK/emoji/组合字符测试的转换助手互转（SRS §5.3；NF11）。
3. **路径**：跨边界路径为 UTF-8 字符串；在 Rust 内部完成规范化与 canonicalize（security-model §2），前端传来的路径**不构成权限凭证**（R25）。
4. **可选性**：字段后 `?` 表示可为 `undefined`/`null` 省略；Rust 侧 `Option<T>` + `skip_serializing_if`。
5. **错误**：命令失败统一 `reject(ErrorPayload)`（§5）；不返回裸字符串或堆栈。TS 端 `services/ipc.ts` 归一化为 `PaperStackError`（含同字段）。
6. **任务令牌（强制）**：任何跨异步边界的工作以 `TaskToken {docId, version: string | null, generation: number, taskId: string}` 派发；提交规则见 §6。
7. **幂等与重复调用**：`watch_document` 以最新调用为准（替换注册）；`unwatch_document` 对未注册文档返回成功；`grant_local_root`/`grant_remote_session` 对同目标重复授权返回既有 `grantId`。
8. **无副作用声明**：除 `save_position`、`save_session`、`touch_recent`、`update_settings`、`clear_records`、`resume_recording`、`export_diagnostics`、`grant_*`、`revoke_*`、`watch_*`、`open_directory` 外，其余命令不写应用数据；**任何命令都不写源文件或源目录**（R04/NF01）。

## 2. 命令索引（全部 38 条）

| # | Rust 命令 | TS 封装（`src/services/`） | 请求 → 响应 | 主要错误码 | 需求/交互 |
|---|---|---|---|---|---|
| 1 | `pick_files` | `files.pickFiles()` | 无参（内部用系统对话框，过滤 .md/.markdown） → `PickResult` | — | R01；IX01 |
| 2 | `pick_directory` | `files.pickDirectory()` | 无参 → `PickResult` | — | R02；IX02 |
| 3 | `pick_export_target` | `files.pickExportTarget()` | 无参（保存对话框） → `PickResult` | — | R28；IX14 |
| 4 | `open_documents` | `files.openDocuments(req)` | `OpenDocumentsRequest` → `OpenDocumentsResult` | `PS_FMT_UNSUPPORTED` `PS_ENC_UNSUPPORTED` `PS_IO_*` | R01–R03、R05；IX01 |
| 5 | `read_document` | `files.readDocument(req)` | `ReadDocumentRequest` → `DocumentSnapshot` | `PS_IO_*` `PS_ENC_*` `PS_AUTH_REVOKED` `PS_LIMIT_SIZE` | R03、R07、R18、R22；IX05/08/09 |
| 6 | `relink_document` | `files.relinkDocument(req)` | `RelinkRequest` → `RelinkResult` | `PS_IO_*` `PS_ENC_*` `PS_AUTH_DENIED` | R07；IX09 |
| 7 | `get_source_info` | `files.getSourceInfo(docId)` | `{docId}` → `SourceInfo` | `PS_IO_*` `PS_AUTH_REVOKED` | R18、R29；IX15 |
| 8 | `read_source_window` | `files.readSourceWindow(req)` | `ReadSourceWindowRequest` → `SourceWindow` | `PS_IO_*` `PS_AUTH_REVOKED` | R18、R29；IX15 |
| 9 | `open_directory` | `tree.openDirectory(req)` | `OpenDirectoryRequest` → `DirectoryRoot` | `PS_IO_*` `PS_AUTH_DENIED` | R02、R25；IX02 |
| 10 | `read_directory` | `tree.readDirectory(req)` | `ReadDirectoryRequest` → `DirectoryListing` | `PS_IO_NOT_FOUND` `PS_AUTH_OUTSIDE_ROOT` `PS_IO_PERMISSION` | R02；IX02 |
| 11 | `watch_document` | `watch.watchDocument(req)` | `WatchRequest` → `{}` | `PS_AUTH_REVOKED` `PS_IO_NOT_FOUND` | R21、R22；IX08/09 |
| 12 | `unwatch_document` | `watch.unwatchDocument(docId)` | `{docId}` → `{}` | — | R05、R22 |
| 13 | `list_recents` | `storage.listRecents()` | 无参（≤100 条） → `RecentEntry[]` | `PS_STORAGE_UNAVAILABLE` | R06；IX13 |
| 14 | `touch_recent` | `storage.touchRecent(docId)` | `{docId}` → `{}` | `PS_STORAGE_UNAVAILABLE` | R06 |
| 15 | `save_position` | `storage.savePosition(req)` | `SavePositionRequest` → `SaveResult` | `PS_STORAGE_UNAVAILABLE` `PS_DB_FAILURE` | R19、R27；IX03/13 |
| 16 | `load_position` | `storage.loadPosition(docId)` | `{docId}` → `PositionRecord \| null` | `PS_STORAGE_UNAVAILABLE` | R19；IX13 |
| 17 | `save_session` | `storage.saveSession(req)` | `SaveSessionRequest` → `SaveResult` | `PS_STORAGE_UNAVAILABLE` `PS_DB_FAILURE` | R06、R27；IX13 |
| 18 | `load_session` | `storage.loadSession()` | 无参 → `SessionSnapshot \| null` | `PS_STORAGE_UNAVAILABLE` | R06；IX13 |
| 19 | `get_storage_overview` | `storage.getStorageOverview()` | 无参 → `StorageOverview` | `PS_DB_FAILURE` | R27；IX12 |
| 20 | `clear_records` | `storage.clearRecords(req)` | `ClearRecordsRequest` → `ClearResult[]` | 每类独立 `error?`（`PS_DB_FAILURE` `PS_IO_WRITE_FAILED`） | R27；IX12 |
| 21 | `resume_recording` | `storage.resumeRecording(req?)` | `ResumeRecordingRequest` → `{}` | — | R06、R27 |
| 22 | `get_settings` | `settings.getSettings()` | 无参 → `SettingsBundle` | `PS_DB_FAILURE`（降级返回默认） | R23；IX11 |
| 23 | `update_settings` | `settings.updateSettings(patch)` | `UpdateSettingsRequest` → `UpdateSettingsResult` | `persisted=false` + `error?`（`PS_DB_FAILURE`） | R23；IX11 |
| 24 | `check_resource_access` | `auth.checkResourceAccess(req)` | `CheckResourceAccessRequest` → `AccessDecision` | 结果内 `reason?`（不 reject） | R13、R15、R25、R26；IX07/10 |
| 25 | `grant_local_root` | `auth.grantLocalRoot(req)` | `GrantLocalRootRequest` → `GrantRecord` | `PS_IO_NOT_FOUND` `PS_AUTH_OUTSIDE_ROOT` | R25；IX10 |
| 26 | `list_grants` | `auth.listGrants()` | 无参 → `GrantRecord[]` | `PS_DB_FAILURE` | R25、R27；IX12 |
| 27 | `revoke_grant` | `auth.revokeGrant(grantId)` | `{grantId}` → `RevokeResult` | `PS_IO_NOT_FOUND` | R25、R07；IX10/12 |
| 28 | `grant_remote_session` | `remote.grantRemoteSession(req)` | `GrantRemoteSessionRequest` → `GrantRecord` | `PS_REMOTE_PROTOCOL` | R26；IX10 |
| 29 | `revoke_remote_session` | `remote.revokeRemoteSession(docId)` | `{docId}` → `RevokeResult` | — | R26；IX10 |
| 30 | `fetch_remote_image` | `remote.fetchRemoteImage(req)` | `FetchRemoteImageRequest` → `RemoteImageResult` | `PS_REMOTE_BLOCKED` `PS_REMOTE_PROTOCOL` `PS_REMOTE_REDIRECT_BLOCKED` `PS_REMOTE_LIMIT` `PS_REMOTE_FAILED` | R26；IX07/10 |
| 31 | `open_external_url` | `opener.openExternalUrl(url)` | `{url}` → `{}` | `PS_RESOURCE_UNSUPPORTED`（非 http/https） | R15；IX03 |
| 32 | `reveal_in_folder` | `opener.revealInFolder(path)` | `{path}` → `{}` | `PS_IO_NOT_FOUND` `PS_AUTH_OUTSIDE_ROOT` | R07、R09；IX09 |
| 33 | `get_app_info` | `app.getAppInfo()` | 无参 → `AppInfo` | — | R30；IX14 |
| 34 | `read_legal_text` | `app.readLegalText(kind)` | `ReadLegalTextRequest` → `LegalTextResult` | `PS_IO_NOT_FOUND` | R30；IX14 |
| 35 | `take_pending_open_requests` | `app.takePendingOpenRequests()` | 无参（排空） → `OpenRequest[]` | — | R01；IX01 |
| 36 | `preview_diagnostics` | `diagnostics.previewDiagnostics(req)` | `DiagnosticsPreviewRequest` → `DiagnosticsPreview` | `PS_IO_WRITE_FAILED` | R28；IX14 |
| 37 | `export_diagnostics` | `diagnostics.exportDiagnostics(req)` | `ExportDiagnosticsRequest` → `ExportResult` | `PS_IO_EXPORT_BLOCKED` `PS_IO_WRITE_FAILED` `PS_IO_NOT_FOUND`（exportId 过期） | R04、R28；IX14 |
| 38 | `search_source` | `search.searchSource(req)` | `SearchSourceRequest` → `SourceSearchResult` | `PS_IO_*` `PS_LIMIT_SEARCH` | R17、R29；IX15 |

### 2.1 命令行为补充（超出签名的语义）

- `open_documents`：逐项独立校验与授权；同批同路径去重；首项成功者建议获得焦点（前端决定）；`entry="restore"` 不重启记录（R27）；`entry="tree"` 只为该文件授权读取。校验包含：扩展名（忽略大小写）、存在、可读、是否为普通文件、编码探测（BOM/二进制识别）。**大小不构成拒绝依据**：≤50MiB 执行完整解码校验并缓存解码文本与哈希，供紧随的 `read_document(initial)` 使用；>50MiB 仅做前 64KiB 探测与 stat（供简化/源码窗口模式，架构 §7）。
- `read_document(purpose)`：`initial|restore` 可命中校验快照缓存；`refresh` 必须执行稳定读取（§7）；`relink` 用于重定位后的内容读取。任何成功结果携带新的 `VersionInfo`，且 `contentHash` 为新读取字节的 SHA-256。
- `relink_document`：新文件与最后已知 `contentHash` 相同 → `status="reassociated"`；不同 → `status="new-version"`（同一 `docId` 继续，位置只近似恢复），先说明后由前端采用（R07；IX09）。
- `get_source_info` / `read_source_window`：仅对已注册 `docId` 可用（含被 `PS_LIMIT_SIZE` 拒绝全量读取的 >50MiB 文档）；按行边界返回，`totalLines` 由 Rust 行索引给出（懒构建、版本变化即失效）；窗口读取同样受授权与存在性检查（R18、R29）。
- `search_source`：**仅用于 >50MiB 源码窗口模式**（此时前端不持有全文）；Rust 流式扫描当前展示版本的解码文本，字面子串、无正则；`caseSensitive=false` 时按与前端一致的 `toLowerCase` 折叠；同一 `docId` 的版本在扫描前后校验，不一致 → `PS_IO_CHANGED`；结果按文档顺序，超预算返回 `complete=false` 并附 `PS_LIMIT_SEARCH`（R17、R29；IX15“说明已完成索引范围”）。
- `check_resource_access` 永不 reject：返回状态供 UI 决策；只有 `allowed` 才返回 `assetUrl`，且 URL 由 Rust 生成（含 `?v=` 观察键），前端不得自造（R25）。
- `fetch_remote_image`：仅当 `(docId, origin)` 已会话授权；执行受控获取（security-model §4），成功后写入应用缓存并返回 asset URL；**不自动重试**，用户手动重试重新调用。
- `save_position`/`save_session`/`touch_recent` 受写入门禁（持久偏好 `rememberRecords` 与会话抑制标志，data-model §6）；被抑制时返回 `SaveResult{saved:false}` 且不报错（R27）。
- `update_settings`：先应用到内存（`applied`），再尝试持久化（`persisted`）；失败保留本次有效显示并返回错误供 UI 提示（R23）。
- `clear_records`：需 `confirm=true`；逐类返回实际结果（数量或错误）；清除成功时设置对应会话写抑制（R27；data-model §6）；清除授权类需与 `revoke_*` 一致的运行时效果。
- `preview_diagnostics`/`export_diagnostics`：预览生成 `exportId`（内存缓存、有 TTL 与小上限），导出必须使用同一 `exportId` 写预览字节；目标校验与覆盖语义见 security-model §7。
- `take_pending_open_requests`：启动参数与单实例移交的排队请求，一次取走；后续请求经 `paperstack://open-requested` 事件送达。

## 3. Rust/TS 共享模型（字段即契约）

> Rust 结构体名与字段名如下表；serde `rename_all="camelCase"`；TS 类型在 `src/services/types.ts` 手工镜像并以契约形状测试守护。

### 3.1 文档与版本

```ts
interface SourceRange { startByte: number; endByte: number; }   // UTF-8 bytes, [start,end)

interface DocIdentity {
  docId: string;                       // 不透明稳定标识: 首次打开时 "d-" + sha256(canonicalPath)[..16]
  canonicalPath: string;               // 绝对、canonicalize 后
  displayName: string;                 // 文件名单段，用于标签
  format: "markdown";                  // v0.1.0 仅此值（计划书 §3.5 适配器边界）
  encoding: "utf-8" | "utf-8-bom";
  contentHash: string;                 // sha256 hex（小写 64 字符），最后成功读取
  sizeBytes: number;                   // 原始字节数
  lastSeenAtMs: number;
}

interface VersionInfo {
  contentHash: string;                 // sha256 hex；版本即内容哈希
  sizeBytes: number;
  modifiedAtMs: number;                // 磁盘 mtime
  observedAtMs: number;                // 本应用读取完成时间
}

interface DocumentSnapshot {
  docId: string;
  identity: DocIdentity;
  version: VersionInfo;
  text: string;                        // 解码文本；BOM 已剥离；原文换行保留（不重组）
  lineCount: number;                   // 与源码视图行号一致（1 起始计数）
}

interface OpenOutcome {
  path: string;                        // 原始输入路径
  status: "opened" | "duplicate" | "rejected";
  docId?: string;
  identity?: DocIdentity;
  duplicateOfDocId?: string;
  error?: ErrorPayload;
}

interface OpenDocumentsRequest { paths: string[]; entry: "dialog" | "drop" | "cli" | "system" | "tree" | "recent" | "restore"; }
interface OpenDocumentsResult { items: OpenOutcome[]; }      // 与请求同序
interface PickResult { cancelled: boolean; paths: string[]; } // cancelled=true 时 paths=[]

interface ReadDocumentRequest { docId: string; purpose: "initial" | "refresh" | "restore" | "relink"; }
interface RelinkRequest { docId: string; newPath: string; }
interface RelinkResult { status: "reassociated" | "new-version"; snapshot: DocumentSnapshot; }

interface SourceInfo { docId: string; version: VersionInfo; encoding: "utf-8" | "utf-8-bom"; totalLines: number; }
interface ReadSourceWindowRequest { docId: string; startLine: number; maxLines: number; }  // startLine ≥1；maxLines 1..2000
interface SourceWindow { docId: string; version: VersionInfo; startLine: number; endLine: number; text: string; eof: boolean; }
interface SearchSourceRequest { docId: string; query: string; caseSensitive: boolean; maxResults: number; }  // 仅 >50MiB 源码窗口模式；query 为字面串
interface SourceSearchResult {
  docId: string;
  version: VersionInfo;
  matches: Array<{ startByte: number; endByte: number; lineNumber: number }>;  // 按字节序 = 文档顺序；行号 1 起始
  scannedBytes: number;
  totalBytes: number;
  complete: boolean;                   // false = 超预算/取消导致不完整（PS_LIMIT_SEARCH 情形，不虚报完整）
}
```

### 3.2 目录

```ts
interface OpenDirectoryRequest { path: string; persist: boolean; }   // persist 默认 false（R25）
interface DirectoryRoot { rootId: string; canonicalPath: string; displayName: string; scope: "session" | "persistent"; }
interface ReadDirectoryRequest { rootId: string; dirPath: string; }  // dirPath 必须位于 root 内
interface DirectoryNode {
  name: string;
  path: string;                        // canonical 绝对路径（symlink 为其自身路径，目标是 symlinkTarget）
  kind: "file" | "directory" | "symlink" | "other";
  status: "ok" | "missing" | "no-permission" | "out-of-root" | "symlink-inside" | "symlink-outside";
  hasChildren?: boolean;               // 仅 directory/symlink-inside；懒展开
  isMarkdown?: boolean;                // 仅 file；扩展名忽略大小写
  symlinkTarget?: string;              // 仅 symlink；不可解析时省略
}
interface DirectoryListing { dirPath: string; entries: DirectoryNode[]; truncated: boolean; }  // 单目录初始上限 2000 项
```

### 3.3 监测

```ts
interface WatchRequest { docId: string; resourcePaths?: string[]; }  // resourcePaths 每次调用整体替换；Rust 校验其在授权范围内
type WatchKind = "modified" | "removed" | "appeared" | "resource";
interface WatchChangedPayload { docId: string; kind: WatchKind; resourcePath?: string; observedAtMs: number; }
```

### 3.4 存储 / 记录

```ts
interface AnchorRecord {
  versionHash: string;                 // 记录时的内容哈希
  headingPath: string[];               // 标题路径；[] 表示文档顶部
  blockFingerprint: string;            // "fp1:" + sha256(blockSearchText)[..16]
  offsetRatio: number;                 // 块内比例 0..1
  sourceRange: SourceRange;            // 记录版本中的 UTF-8 字节范围
}
interface PositionRecord { docId: string; anchor: AnchorRecord; updatedAtMs: number; }
interface SavePositionRequest { docId: string; anchor: AnchorRecord; }
interface SaveResult { saved: boolean; error?: ErrorPayload; }

interface RecentEntry { docId: string; displayName: string; canonicalPath: string; openedAtMs: number; available: boolean; }
interface SessionTab { tabId: string; docId: string; orderIndex: number; isActive: boolean; }
interface SaveSessionRequest { tabs: SessionTab[]; }
interface SessionSnapshot { tabs: SessionTab[]; activeTabId: string | null; savedAtMs: number; }

type StorageCategory = "recents" | "positions" | "session" | "cache" | "authorizations" | "logs";
interface StorageCategoryInfo { category: StorageCategory; count: number; bytes?: number; }
interface StorageOverview { categories: StorageCategoryInfo[]; databasePath: string; cacheDir: string; }
interface ClearRecordsRequest { categories: StorageCategory[]; confirm: boolean; }
interface ClearResult { category: StorageCategory; cleared: number; error?: ErrorPayload; }
interface ResumeRecordingRequest { categories?: StorageCategory[]; }  // 省略 = 全部恢复
```

### 3.5 设置

```ts
interface GlobalSettings {
  theme: "system" | "light" | "dark";        // 默认 system
  fontSizePx: number;                        // 14..24，默认 17
  lineHeight: number;                        // 1.5..2.2，默认 1.8
  maxContentWidthPx: number;                 // 560..960，默认 760
  syntaxMode: "technical" | "standard";      // 默认 technical（R08）
  updateModeDefault: "keep" | "follow";      // 默认 keep（R21）
  restoreSession: boolean;                   // 默认 true（R06）
  rememberRecords: boolean;                  // 默认 true（R06/R27）
}
interface FrozenLimits { recentLimit: number; cacheMaxBytes: number; logMaxBytes: number; }  // 100 / 256MiB / 10MiB（SRS §6.1）
interface SettingsBundle { global: GlobalSettings; defaults: GlobalSettings; limits: FrozenLimits; revision: number; }
interface UpdateSettingsRequest { patch: Partial<GlobalSettings>; }
interface UpdateSettingsResult { applied: GlobalSettings; persisted: boolean; revision: number; error?: ErrorPayload; }
```

### 3.6 授权与资源

> 授权“请求”不经 Rust→TS 事件：UI 由 `check_resource_access`/`fetch_remote_image` 返回的状态生成确认对话框；用户的“决定”经 `grant_local_root`/`grant_remote_session` 回传。因此 Rust 模型中没有单独的 AuthRequest 载荷，`AccessDecision` 与 `GrantRecord` 即授权请求/决定的载体（R25、R26；IX10）。

```ts
interface CheckResourceAccessRequest { docId: string; rawSrc: string; }  // 文档中的原始引用
interface AccessDecision {
  status: "allowed" | "remote-blocked" | "outside-root" | "missing" | "unsupported" | "denied";
  kind: "local" | "remote" | "inline" | "other";
  canonicalPath?: string;              // local
  assetUrl?: string;                   // allowed：由 Rust 生成，含 ?v=<observationKey>
  rootCandidate?: string;              // outside-root：建议确认的 canonical 目录
  origin?: string;                     // remote
  reason?: ErrorPayload;
}
interface GrantRecord { grantId: string; kind: "file" | "directory" | "remote"; scope: "session" | "persistent"; canonicalPath?: string; origins?: string[]; docId?: string; grantedAtMs: number; }
interface GrantLocalRootRequest { docId: string; rootPath: string; persist: boolean; }
interface GrantRemoteSessionRequest { docId: string; origins: string[]; }   // 每项为 "https://host[:port]"
interface FetchRemoteImageRequest { docId: string; url: string; }
interface RemoteImageResult { assetUrl: string; mime: string; sizeBytes: number; finalUrl: string; cacheKey: string; fromCache: boolean; }
interface RevokeResult { revoked: boolean; cancelledRequests: number; removedCacheEntries: number; }
```

### 3.7 诊断 / 应用

```ts
interface ErrorPayload {
  code: string;                        // §5 稳定码
  category: "io" | "encoding" | "auth" | "resource" | "parse" | "storage" | "limit" | "internal";
  messageKey: string;                  // i18n key，如 "error.io.notFound"
  retryable: boolean;
  sourceRange?: SourceRange;           // 适用时（parse/resource 定位）
  details?: Record<string, string | number | boolean>;  // 已脱敏，供“详细技术信息”折叠
}
interface DiagnosticIssue { code: string; category: ErrorPayload["category"]; messageKey: string; sourceRange?: SourceRange; count: number; firstSeenAtMs: number; }
interface DiagnosticsBundle {
  bundleVersion: 1;
  generatedAtMs: number;
  app: { name: string; version: string; ipcContract: string; tauriVersion?: string; webkitVersion?: string; os?: string; };
  documents: Array<{ docIdShort: string; displayNameRedacted: string; versionHash: string; status: string; issues: DiagnosticIssue[]; }>;
  limits: FrozenLimits & { largeFileBytes: number; hardLimitBytes: number; imageBytes: number; };
  redactions: string[];                // 已应用的脱敏说明
}
interface DiagnosticsPreviewRequest { includeSourceContext: boolean; includeFullPaths: boolean; }
interface DiagnosticsPreview { exportId: string; generatedAtMs: number; text: string; sections: Array<{ name: string; bytes: number }>; redactionCount: number; expiresAtMs: number; }
interface ExportDiagnosticsRequest { exportId: string; targetPath: string; overwrite: boolean; }
interface ExportResult { writtenPath: string; bytes: number; }

interface AppInfo {
  name: "纸栈 PaperStack"; version: string; owner: "Quirkybrain"; license: "GPL-3.0-only";
  ipcContract: "paperstack-ipc-r1"; locale: "zh-CN";
  tauriVersion?: string; webkitVersion?: string; os?: string;
  legal: { sourceEntryUrl: string | null; sourceEntryNote?: string; licenseAvailable: boolean; thirdPartyAvailable: boolean; };
}
interface OpenRequest { paths: string[]; cwd: string | null; source: "cli" | "second-instance"; }
interface ReadLegalTextRequest { kind: "license" | "third_party_notices"; }
interface LegalTextResult { text: string; resourceName: string; }
```

## 4. Rust → TS 事件

| 事件名 | 载荷 | 发射条件 | 需求 |
|---|---|---|---|
| `paperstack://watch-changed` | `WatchChangedPayload` | `watch_document` 注册后，经防抖/稳定判定确认的变更提示；同一 `docId` 在每个静默窗口至多一次。**不携带内容** | R22；§7 |
| `paperstack://open-requested` | `OpenRequest` | 第二实例启动时经 single-instance 插件移交的参数（`source="second-instance"`）；启动参数经 `take_pending_open_requests` 拉取 | R01；IX01 |

**运行时内建事件（由 Tauri/窗口提供，前端桥接消费）**：

| 事件 | 载荷 | 用途 |
|---|---|---|
| `tauri://drag-enter` / `tauri://drag-drop` / `tauri://drag-leave`（`onDragDropEvent()`） | `{paths: string[], position: {x,y}}` | 拖放打开（entry=`drop`）；非文档路径交 `open_documents` 按项拒绝，不解释为命令 |
| `tauri://close-requested`（`onCloseRequested`） | 无 | 退出前会话保存（§10 末行“退出/会话保存”）；保存失败由 UI 决策 |
| `tauri://focus` / `blur`（`onFocusChanged`） | `{focused: boolean}` | 窗口重新聚焦复核（§7）；后台标签处理在激活时进行 |

## 5. 错误分类（Error Taxonomy）

**分类枚举**：`io | encoding | auth | resource | parse | storage | limit | internal`。`retryable` 指 UI 可提供“重试”动作（用户触发；除远程图片外**无自动重试**）。

| 稳定码 | 分类 | 含义 | messageKey | retryable | sourceRange |
|---|---|---|---|---|---|
| `PS_IO_NOT_FOUND` | io | 文件/资源不存在（不自动重建） | `error.io.notFound` | 是（外部恢复后） | — |
| `PS_IO_PERMISSION` | io | 系统权限不足/不可读 | `error.io.permission` | 是 | — |
| `PS_IO_READ_FAILED` | io | 读取失败（磁盘/IO 错误） | `error.io.readFailed` | 是 | — |
| `PS_IO_WRITE_FAILED` | io | 应用目录/导出写失败 | `error.io.writeFailed` | 是 | — |
| `PS_IO_CHANGED` | io | 读取期间内容不稳定或已被替换，需重试 | `error.io.changed` | 是 | — |
| `PS_IO_EXPORT_BLOCKED` | io | 导出目标为受保护源位置或需覆盖确认 | `error.io.exportBlocked` | 否（改选目标） | — |
| `PS_ENC_UNSUPPORTED` | encoding | 非 UTF-8 / 解码失败 / 二进制 | `error.encoding.unsupported` | 否 | — |
| `PS_FMT_UNSUPPORTED` | encoding | 非 .md/.markdown、目录误当文件、未知格式 | `error.encoding.formatUnsupported` | 否 | — |
| `PS_AUTH_DENIED` | auth | 需要用户授权且当前被拒绝/未确认 | `error.auth.denied` | 否（走授权流程） | — |
| `PS_AUTH_REVOKED` | auth | 授权被撤销，新读取停止 | `error.auth.revoked` | 否 | — |
| `PS_AUTH_OUTSIDE_ROOT` | auth | 目标逃逸授权根（含符号链接解析后） | `error.auth.outsideRoot` | 否（重新授权） | — |
| `PS_REMOTE_BLOCKED` | resource | 远程资源未获会话允许 | `error.resource.remoteBlocked` | 否（先允许） | — |
| `PS_REMOTE_PROTOCOL` | resource | 非 HTTPS 或不允许的协议 | `error.resource.remoteProtocol` | 否 | — |
| `PS_REMOTE_REDIRECT_BLOCKED` | resource | 重定向到未确认域/不允许地址 | `error.resource.redirectBlocked` | 否 | — |
| `PS_REMOTE_LIMIT` | resource | 远程大小/超时帽超限 | `error.resource.remoteLimit` | 是（手动） | — |
| `PS_REMOTE_FAILED` | resource | 允许后的网络/TLS/HTTP 失败 | `error.resource.remoteFailed` | 是（手动） | — |
| `PS_RESOURCE_MISSING` | resource | 本地资源缺失 | `error.resource.missing` | 是 | 可选 |
| `PS_RESOURCE_DECODE` | resource | 图片无法解码/格式不支持（含 SVG 直载） | `error.resource.decode` | 否 | 可选 |
| `PS_RESOURCE_UNSUPPORTED` | resource | 不支持的 URL/协议（如未知危险协议） | `error.resource.unsupported` | 否 | 可选 |
| `PS_PARSE_LOCAL` | parse | 单块解析/渲染诊断（公式、图表、高亮） | `error.parse.local` | 否 | 有 |
| `PS_PARSE_DOC` | parse | 文档级解析失败（防御性） | `error.parse.document` | 是 | 可选 |
| `PS_DB_FAILURE` | storage | 数据库读写失败（可能降级） | `error.storage.dbFailure` | 是 | — |
| `PS_DB_MIGRATION` | storage | 迁移失败，记录不可用（不静默清空） | `error.storage.migration` | 否（需显式重置） | — |
| `PS_STORAGE_UNAVAILABLE` | storage | 存储完全不可用（内存降级阅读） | `error.storage.unavailable` | 是 | — |
| `PS_LIMIT_SIZE` | limit | 超过全量读取/渲染硬上限（>50MiB），提供源码分段 | `error.limit.size` | 否 | — |
| `PS_LIMIT_COMPLEXITY` | limit | 复杂度超预算，切换简化阅读 | `error.limit.complexity` | 否 | 可选 |
| `PS_LIMIT_IMAGE` | limit | 单图 >20MiB 或 >32MP | `error.limit.image` | 否 | 可选 |
| `PS_LIMIT_MERMAID` | limit | 图表节点/超时超帽 | `error.limit.mermaid` | 否 | 有 |
| `PS_LIMIT_SEARCH` | limit | 搜索超预算，结果不完整 | `error.limit.search` | 否 | — |
| `PS_INTERNAL` | internal | 未预期错误（给错误编号与安全重试） | `error.internal.unexpected` | 是 | — |
| `PS_TASK_CANCELLED` | internal | 任务被取消（非错误，不展示为失败） | `error.internal.cancelled` | 否 | — |
| `PS_WORKER_FAILED` | internal | 解析 Worker 不可用，已回退 | `error.internal.worker` | 是 | — |

**规则**：UI 只展示 `messageKey` 对应文案（异常时另有错误编号）；`details` 仅供“详细技术信息”展开；诊断/日志永不包含正文与私人完整路径（R28；security-model §7）。

## 6. 版本/代次正确性规则（规范文本，R22/AT22）

```text
COMMIT RULE (normative, paperstack-ipc-r1):
每个标签维护 DocumentSession { docId, displayVersion, generation, pendingVersion?, status }。

1. generation 单调递增，在任何“目标改变”时递增：打开/重定位、接受新的待更新候选、关闭标签、撤销授权。
2. 任何异步任务（解析、资源解析、锚点恢复、源码窗口、诊断生成）派发时必须携带
   TaskToken { docId, version?, generation, taskId }。
3. 结果只在以下全部成立时允许提交（commit）到用户可见状态：
   (a) token.docId 仍等于该标签当前 docId；且
   (b) token.generation 等于该标签当前 generation；且
   (c) 对版本绑定的结果（解析/资源/位置），token.version 等于标签当前目标版本
       （displayVersion 或已接受的 pendingVersion，取该任务派发时的目标）。
4. 若任务完成时已有更新的目标被接受，旧结果 MUST 丢弃；显示 MUST NOT 回退到更旧版本。
   例：v1 任务晚于 v2 完成 → v1 结果丢弃，界面保持 v2（AT22 要求人为制造该乱序）。
5. 取消、关闭标签、权限撤销通过递增 generation 使任务失效；迟到结果 MUST NOT 重建标签、
   重挂资源或覆盖更新的诊断（R05/IT04）。
6. 错误结果同样受 (a)(b)(c) 约束；陈旧任务的错误不得覆盖新状态。
7. 分区：显示内容、磁盘新旧、资源授权、任务状态分别记录（SRS §6.3），提交规则不合并这些维度。
```

## 7. 监测/稳定/复核契约（规范文本，R21/R22）

```text
WATCH & STABILIZE (normative):
1. watch_document(docId, resourcePaths?) 注册：文档文件 + 其父目录（替换保存检测）+ 已验证的
   资源文件集合；同一 docId 重复调用以新集合替换。
2. notify 事件仅视为“提示”。Rust 按 docId 合并事件，静默窗口 W1（初始 300ms，可校准调参）
   内至多发出一条 watch-changed；窗口内新事件重置计数。
3. kind 语义：modified（写入/截断）、removed（删除/缺失）、appeared（父目录中重建，
   典型为替换保存）、resource（resourcePaths 中某文件变化，携带 resourcePath）。
   事件 MUST NOT 携带正文内容。
4. 稳定读取（仅 read_document(refresh) 与重定位后读取执行）：读取 → 等待 S1（初始 150ms）
   → 再读；两次 contentHash 相同才判定稳定；否则最多重试 N=5 次；仍不稳定返回
   PS_IO_CHANGED。不稳定期间保留已展示版本，稍后经下一次事件或复核重试（R22）。
5. 窗口重新聚焦复核（focus re-check）：聚焦时对活动标签与全部可见文档比较 stat
   （size+mtimeMs）与最近观察；不一致则触发稳定读取。该复核补偿 missed event，避免
   过期内容被误认为已同步。
6. 资源失效：kind=resource 事件使对应图片重新解析；asset URL 的 ?v= 观察键变化以绕过
    WebView 缓存；只重挂相关块，不重建整篇（IXD §10.3）。
7. 关闭标签、unwatch_document、撤销授权、退出：移除注册与计时器，并使在途任务失效（§6）。
8. 初值 W1/S1/N 为可校准参数；测试固定后方可作为回归依据（NF11）。
```

## 8. TS 服务接口（`src/services/`，签名即契约）

```ts
// ipc.ts
export class PaperStackError extends Error { code: string; category: ErrorCategory; messageKey: string; retryable: boolean; sourceRange?: SourceRange; details?: Record<string, string | number | boolean>; }

// files.ts
pickFiles(): Promise<PickResult>;
pickDirectory(): Promise<PickResult>;
pickExportTarget(): Promise<PickResult>;
openDocuments(req: OpenDocumentsRequest): Promise<OpenDocumentsResult>;
readDocument(req: ReadDocumentRequest): Promise<DocumentSnapshot>;
relinkDocument(req: RelinkRequest): Promise<RelinkResult>;
getSourceInfo(docId: string): Promise<SourceInfo>;
readSourceWindow(req: ReadSourceWindowRequest): Promise<SourceWindow>;

// tree.ts
openDirectory(req: OpenDirectoryRequest): Promise<DirectoryRoot>;
readDirectory(req: ReadDirectoryRequest): Promise<DirectoryListing>;

// search.ts（仅 >50MiB 源码窗口模式走 Rust；≤50MiB 两范围均在前端内存中完成）
searchSource(req: SearchSourceRequest): Promise<SourceSearchResult>;

// watch.ts
watchDocument(req: WatchRequest): Promise<void>;
unwatchDocument(docId: string): Promise<void>;
onWatchChanged(cb: (p: WatchChangedPayload) => void): Promise<UnlistenFn>;

// storage.ts
listRecents(): Promise<RecentEntry[]>;
touchRecent(docId: string): Promise<void>;
savePosition(req: SavePositionRequest): Promise<SaveResult>;
loadPosition(docId: string): Promise<PositionRecord | null>;
saveSession(req: SaveSessionRequest): Promise<SaveResult>;
loadSession(): Promise<SessionSnapshot | null>;
getStorageOverview(): Promise<StorageOverview>;
clearRecords(req: ClearRecordsRequest): Promise<ClearResult[]>;
resumeRecording(req?: ResumeRecordingRequest): Promise<void>;

// settings.ts
getSettings(): Promise<SettingsBundle>;
updateSettings(patch: Partial<GlobalSettings>): Promise<UpdateSettingsResult>;

// auth.ts
checkResourceAccess(req: CheckResourceAccessRequest): Promise<AccessDecision>;
grantLocalRoot(req: GrantLocalRootRequest): Promise<GrantRecord>;
listGrants(): Promise<GrantRecord[]>;
revokeGrant(grantId: string): Promise<RevokeResult>;

// remote.ts
grantRemoteSession(req: GrantRemoteSessionRequest): Promise<GrantRecord>;
revokeRemoteSession(docId: string): Promise<RevokeResult>;
fetchRemoteImage(req: FetchRemoteImageRequest): Promise<RemoteImageResult>;

// clipboard.ts（插件封装，非命令）
copyText(text: string): Promise<{ ok: true } | { ok: false; error: ErrorPayload }>;  // 仅系统剪贴板确认成功后返回 ok

// opener.ts
openExternalUrl(url: string): Promise<void>;      // 仅 http/https；由用户点击触发
revealInFolder(path: string): Promise<void>;      // 经授权检查

// diagnostics.ts
previewDiagnostics(req: DiagnosticsPreviewRequest): Promise<DiagnosticsPreview>;
exportDiagnostics(req: ExportDiagnosticsRequest): Promise<ExportResult>;

// app.ts
getAppInfo(): Promise<AppInfo>;
readLegalText(kind: ReadLegalTextRequest["kind"]): Promise<LegalTextResult>;
takePendingOpenRequests(): Promise<OpenRequest[]>;
onOpenRequested(cb: (p: OpenRequest) => void): Promise<UnlistenFn>;
```

## 9. 插件使用与能力边界

| 插件 | 使用方式 | 权限/能力 | 说明 |
|---|---|---|---|
| `tauri-plugin-dialog` | **仅 Rust**（`pick_files`/`pick_directory`/`pick_export_target` 内部） | 不向 WebView 暴露 JS 权限 | 选择器结果不构成授权；授权由 `open_documents`/`grant_*` 决定（计划书 §4.2；R25） |
| `tauri-plugin-clipboard-manager` | TS 显式调用 `writeText` | `clipboard-manager:allow-write-text` | 仅写；只在成功后提示“已复制”（R11） |
| `tauri-plugin-opener` | **仅 Rust**（`open_external_url`/`reveal_in_folder` 内部） | 不向 WebView 暴露 JS 权限 | 用户点击后交系统浏览器/文件管理器；协议白名单 http/https（R15） |
| `tauri-plugin-single-instance` | Rust 回调 → 排队/`paperstack://open-requested` | 仅 Rust | 第二实例参数移交（R01） |
| 通用 fs/shell/http 插件 | **不使用、不注册** | — | 文档内容不得获得文件写入、Shell、SQL 或脚本执行（PC-02；R09） |
| asset 协议 | 仅由 Rust 在授权检查后扩大 scope 并生成 URL | `app.assetProtocol.enable=true`，初始 scope 为空 | 前端不得自造 asset URL（R25） |

## 10. 流程覆盖矩阵（与任务清单逐项对应）

| 流程 | 命令/事件 | 契约要点 |
|---|---|---|
| 对话框/拖放/CLI/系统打开 | 1、4；拖放内建事件；35、`open-requested` | 统一校验语义；非文档按项拒绝（R01） |
| 批量打开 | 4 | 输入顺序；单项失败不清空；首个成功获得焦点 |
| 目录打开 + 懒加载树 | 2、9、10 | 子目录按需；symlink/越界/隐藏状态（R02、R25） |
| 最近列表 + 会话恢复 | 13、14、17、18 | ≤100；无参数恢复；逐标签独立失败（R06） |
| 位置保存/加载 | 15、16 | AnchorRecord §3.4；同版本精确/唯一匹配才宣称精确（R19） |
| 设置读写 | 22、23 | applied 与 persisted 分离；越界保留旧值（R23） |
| 文档重载/重定位 | 5（refresh）、6 | 稳定读取；同字节重关联/异字节新版本（R07、R22） |
| 源码视图（同版本） | 快照 `text`、7、8 | 不读盘新版本；>50MiB 分段（R18、R29） |
| 搜索（正文/源码、大小写） | ≤50MiB：无命令（前端：正文用解析树索引、源码用内存原文）；>50MiB 源码窗口：38 | 字面、无正则、无归一化；旧批次失效；不完整时显式说明（R17、NF05、IX15） |
| 剪贴板 | `clipboard.copyText`（插件） | 成功才提示（R11） |
| 文件夹展示 / 外部 URL | 32、31（opener） | 授权检查；协议白名单（R07、R15） |
| 授权请求/决定/撤销 | 24、25、26、27 | 一次性目录确认；默认会话级；默认不勾“记住”（R25） |
| 远程图片允许/受控获取/撤销 | 24、28、29、30 | 会话级；HTTPS/重定向/私网/大小/超时；不自动重试（R26） |
| 监测订阅/取消 + 变更事件 | 11、12、`watch-changed` | §7 规范（R22） |
| 诊断导出 | 36、37 | 预览字节即导出字节；默认脱敏；受保护源位置拒绝（R04、R28） |
| 应用信息/关于 | 33、34 | 版本/Quirkybrain/GPL-3.0-only/第三方/源码入口（R30） |
| 单实例移交 | 35、`open-requested` | 第二实例参数进入既有实例的打开流程（R01） |
| 退出/会话保存 | 17 + `close-requested` 内建事件 | 保存确认状态；失败不谎报（R06、NF08） |
