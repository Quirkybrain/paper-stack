# 纸栈 PaperStack · v0.1.0 数据模型（Data Model）

- **Producer**: agent:solution-architect
- **Artifact ID**: ART-30-DATA
- **Artifact Type**: Data Model（SQLite schema、迁移策略、记录格式、保留/清除规则）
- **Status**: VALID
- **Revision**: 1
- **Owner**: solution-architect
- **Task**: `wp-03-architecture`（任务分支 `task/wp-03-architecture`；父分支 `feat/v0.1.0`；基线提交 `7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b`；产出提交主题 `docs(architecture): define v0.1.0 architecture and contracts`）
- **Last Verified**: 2026-10-07
- **Scope**: 仅应用自身的持久数据（设置、最近、位置、会话、授权、缓存索引）与记录格式。**不包含任何原文快照**；原始文档始终只读（R04、R06、SRS §6.2）。
- **Depends On**: `artifacts/30-architecture/architecture.md`、`contracts.md`（§3.4、§3.5）；ART-20-RB（§5、R06、R19、R23、R27、NF08）；SRS §6；计划书 §3.6。
- **Downstream**: Rust `services/storage`、`services/session` 实现；迁移测试；R27 清除界面；NF08 故障注入测试。

---

## 1. 存储位置与所有权

| 位置 | 内容 | 所有者 | 可重建 | 依据 |
|---|---|---|---|---|
| 应用数据目录 `<appDataDir>/paperstack.sqlite3` | 设置、文档身份、最近、位置、会话、侧栏状态、授权、缓存索引、日志索引（表见 §2） | Rust `Storage`（单连接 + `Mutex`） | 否（授权/设置丢失需重新确认） | 计划书 §3.6；R27 |
| `<appDataDir>/logs/` | 结构化日志滚动文件（≤10MiB） | `services/diagnostics` | 是 | R28；SRS §6.1 |
| `<appCacheDir>/remote-images/` | 会话允许后缓存的远程图片 | `services/resources` | 是 | R26、R27；SRS §6.1 |
| `<appDataDir>/exports/`（默认建议，非强制） | 用户导出诊断的默认目录（实际由用户选择） | 用户 | 是 | R28 |
| 源文件与源目录 | 用户文档 | 用户 | — | **应用零写入**（NF01） |

- Tauri 应用标识 `com.quirkybrain.paperstack`；`appDataDir`/`appCacheDir` 按平台约定解析，不硬编码家目录。
- 原文件、应用数据、可重建缓存三者分目录；任何清除操作均不触碰原文件（R27；计划书 §3.6）。

## 2. SQLite Schema（v1，rusqlite bundled）

启动连接参数：`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=3000;`。所有表 `STRICT`（bundled SQLite ≥3.37）。修订号经 `PRAGMA user_version` 管理（本版 = 1）。

```sql
-- v1: initial schema (PRAGMA user_version = 1)

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL              -- epoch ms
) STRICT;

CREATE TABLE documents (
  doc_id         TEXT PRIMARY KEY,         -- "d-<hex16>"（§3.1）
  canonical_path TEXT NOT NULL UNIQUE,
  display_name   TEXT NOT NULL,
  format         TEXT NOT NULL CHECK (format IN ('markdown')),
  encoding       TEXT NOT NULL CHECK (encoding IN ('utf-8','utf-8-bom')),
  content_hash   TEXT,                     -- sha256 hex；最后成功读取
  size_bytes     INTEGER,
  last_seen_at   INTEGER NOT NULL          -- epoch ms
) STRICT;

CREATE TABLE recents (
  doc_id     TEXT PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
  opened_at  INTEGER NOT NULL,             -- epoch ms；列表按此倒序，上限 100
  last_path  TEXT NOT NULL                 -- 最近已知路径，用于丢失文件提示
) STRICT;

CREATE TABLE positions (
  doc_id            TEXT PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
  version_hash      TEXT NOT NULL,
  heading_path_json TEXT NOT NULL DEFAULT '[]',
  block_fingerprint TEXT,
  offset_ratio      REAL NOT NULL DEFAULT 0.0 CHECK (offset_ratio >= 0.0 AND offset_ratio <= 1.0),
  source_range_json TEXT,                  -- {"startByte":n,"endByte":n}
  updated_at        INTEGER NOT NULL
) STRICT;

CREATE TABLE session_tabs (
  tab_id      TEXT PRIMARY KEY,
  doc_id      TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1)),
  updated_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE session_meta (
  key        TEXT PRIMARY KEY,             -- 如 "active_tab_id"、"saved_at_ms"
  value_json TEXT NOT NULL
) STRICT;

CREATE TABLE sidebar_state (
  kind        TEXT NOT NULL CHECK (kind IN ('directory','document')),
  state_key   TEXT NOT NULL,               -- 目录: canonical path；文档: doc_id
  state_json  TEXT NOT NULL,               -- 展开集合/滚动位置（UI 序列化，非正文）
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (kind, state_key)
) STRICT;

CREATE TABLE authorizations (
  grant_id          TEXT PRIMARY KEY,      -- "g-<hex16>"（§3.2）
  kind              TEXT NOT NULL CHECK (kind IN ('file','directory','remote')),
  canonical_path    TEXT,                  -- file/directory 必填
  origins_json      TEXT,                  -- remote: ["https://host"]
  scope             TEXT NOT NULL CHECK (scope IN ('session','persistent')),
  source_doc_id     TEXT,                  -- 由哪个文档会话发起（remote 必填）
  granted_at        INTEGER NOT NULL,
  last_confirmed_at INTEGER,
  CHECK ((kind = 'remote' AND origins_json IS NOT NULL) OR (kind != 'remote' AND canonical_path IS NOT NULL))
) STRICT;

CREATE TABLE cache_meta (
  cache_key        TEXT PRIMARY KEY,       -- "c-<hex16>"（URL 哈希）
  kind             TEXT NOT NULL CHECK (kind IN ('remote-image')),
  rel_path         TEXT NOT NULL,          -- 相对 cacheDir，防目录逃逸
  size_bytes       INTEGER NOT NULL,
  source_url_hash  TEXT,
  created_at       INTEGER NOT NULL,
  last_access_at   INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_recents_opened       ON recents(opened_at DESC);
CREATE INDEX idx_positions_updated    ON positions(updated_at);
CREATE INDEX idx_session_tabs_order   ON session_tabs(order_index);
CREATE INDEX idx_auth_scope           ON authorizations(scope);
CREATE INDEX idx_cache_last_access    ON cache_meta(last_access_at);
```

- **无全文表**：任何表中不得出现文档正文/原句/选区副本；位置只存锚点（§3.3），查询与选区仅内存（R06、R19、R20、SRS §6.1–§6.2）。诊断日志同样不写正文（R28）。
- **监测注册表不持久化**：`watch` 订阅（文档 + 资源集合）为进程内运行时状态，每次打开/恢复时由前端重新 `watch_document` 建立；数据库不保存 watch 记录（R22 语义与授权复核入口一致）。
- **`sidebar_state.state_json`** 仅保存展开/滚动等 UI 状态，不得内嵌正文；实现侧限制单条 ≤64KiB。

## 3. 记录格式（规范）

### 3.1 文档身份 `DocIdentity`（表 `documents`）

```text
docId = "d-" + first16hex( sha256( UTF-8 bytes of canonicalPath ) )
记录   = { docId, canonicalPath, displayName, format, encoding,
           contentHash | null, sizeBytes | null, lastSeenAtMs }
```

- `docId` 不透明、跨重启稳定；**不是权限凭证**，授权检查永远基于 canonicalPath 与注册表（R25）。
- 同一 canonicalPath 去重复用（R05）；`relink_document` 后 `canonicalPath` 更新而 `docId` 保留（R07）。
- 记录不含正文；`contentHash`/`sizeBytes` 来自最后成功读取（SRS §6.2）。

### 3.2 授权 `authorizations`

```text
file       : { kind:"file", canonicalPath, scope:"persistent" }     # 单文件打开按文档记录、可撤销（R25；SRS §6.1）
directory  : { kind:"directory", canonicalPath, scope:"session"|"persistent" }  # 默认 session；“记住”才 persistent
remote     : { kind:"remote", origins:["https://host[:port]"], scope:"session", sourceDocId }  # 仅当前文档会话（R26）
grantId    = "g-" + first16hex( sha256( kind | canonicalPath or origins-joined | scope ) )
```

- 应用启动时：删除全部 `scope='session'` 行；`persistent` 行保留但逐条复核 canonicalPath 存在性与系统权限，失败保持记录并标记不可用，使用时重新确认（R25）。
- 撤销 `file`/`directory`：立即停止新读取并移除 asset scope；撤销 `remote`：取消在途请求、删除对应缓存文件与 `cache_meta` 行、卸载资源（R26、IX10）。
- “清除授权”类别删除所选行；**不得**从最近列表自动重新授予（R25、R27）。

### 3.3 阅读锚点 `AnchorRecord`（表 `positions`）

```text
AnchorRecord = {
  versionHash:      string,              # 记录时的 contentHash
  headingPath:      string[],            # 如 ["2. 方法","2.1 数据"]；[] = 文档顶部
  blockFingerprint: string,              # "fp1:" + first16hex(sha256(blockSearchText))
  offsetRatio:      number,              # 0..1，块内比例
  sourceRange:      { startByte, endByte }  # UTF-8 字节；记录版本
}
blockSearchText = 该块搜索分段按文档顺序拼接，仅做 LF 换行归一（\r\n|\r → \n），
                  不做其它 Unicode 归一（SRS §5.3；与搜索索引同源，ADR-002/007）。
```

- 恢复规则：同版本 → 按 `sourceRange` 精确恢复；跨版本 → 仅当 `headingPath + blockFingerprint` 唯一可靠匹配时宣称精确，否则回最近可信标题并标“近似”，多候选时不得任选一处称精确（R19；SRS §5.1）。
- 字体/宽度/图片变化允许一次稳定校正，不无限追逐滚动（R19）；滚动保存去抖 ≥500ms、写入节流 ≥2s。

### 3.4 最近与会话

```text
RecentEntry  = { docId, displayName, canonicalPath, openedAtMs, available }   # available 为读取时复核结果
SessionTab   = { tabId, docId, orderIndex, isActive }                          # tabId 前端生成，如 "t-<counter>"
SessionSnapshot = { tabs: SessionTab[], activeTabId | null, savedAtMs }
```

- `recents` 上限 100：插入/更新后按 `opened_at DESC` 截断（R06；SRS §6.1）。
- 会话保存仅元数据与锚点；查询、选区、临时网络授权不恢复（R06、IX13）。

## 4. 迁移策略（NF08）

1. **修订管理**：`PRAGMA user_version` 为唯一修订来源；v1 = 本文 schema。迁移脚本按修订顺序前向执行，**不支持回退迁移**。
2. **v0 → v1**：空库或旧模板库（无 schema）→ 单事务执行全部 `CREATE TABLE/INDEX`，提交后设置 `user_version=1`。
3. **执行**：启动时在打开常规读写前运行；迁移处于**单一事务**（DDL 在 SQLite 中可事务化）；任何一步失败 → `ROLLBACK`，数据库保持迁移前状态。
4. **失败处理（不静默清空）**：迁移/打开失败 → 应用进入内存降级阅读（正文可读，设置用默认值，记录不写），记 `PS_DB_MIGRATION` 诊断；数据库文件原样保留。隐私页提供**显式**“重建本地数据库”动作（确认后把失败文件改名为 `paperstack.sqlite3.corrupt-<ts>`，新建空库）；不得自动删除或覆盖。
5. **兼容**：高于本应用支持修订的数据库（例如未来版本写过）→ 拒绝写入、只读降级提示，不自动降级 schema。
6. **测试**：空库、已有 v1 库、损坏文件、只读挂载、磁盘满、迁移中断等故障注入（NF08；SRS §8.4）。

## 5. 默认值（SRS §6.1 冻结为 v0.1.0）

| 设置键（`settings.key`） | 默认值 | 范围/说明 | 需求 |
|---|---|---|---|
| `display.theme` | `"system"` | system/light/dark | R23 |
| `display.fontSizePx` | `17` | 14–24 | R23 |
| `display.lineHeight` | `1.8` | 1.5–2.2 | R23 |
| `display.maxContentWidthPx` | `760` | 560–960 | R23 |
| `syntax.mode` | `"technical"` | technical/standard；当前文档覆盖仅内存 | R08、R23 |
| `update.modeDefault` | `"keep"` | keep/follow；修改仅作用于后续新会话 | R21 |
| `startup.restoreSession` | `true` | — | R06 |
| `privacy.rememberRecords` | `true` | 关闭后停止写最近/位置/会话 | R06、R27 |
| （冻结上限，非用户可改） | `recentLimit=100`；`cacheMaxBytes=256MiB`；`logMaxBytes=10MiB`；`largeFileBytes=10MiB`；`hardLimitBytes=50MiB`；`imageBytes=20MiB`；`imagePixels=32MP` | 可统一调整但需同步交互/帮助/验收（SRS §6.1） | R06、R27–R29 |

- 全局持久设置经 `settings` 表；越界输入保留上一有效值（R23）。
- 当前文档级覆盖（行内公式开关、更新模式、语法模式）**仅内存**，不写库、不跨重启（SRS §6.1）。
- 恢复显示默认只重置 `display.*`，不触碰记录、权限、更新与语法覆盖（IXD §13.3）。

## 6. 写入门禁与分类清除（R06/R27）

**写入门禁（Rust `services/storage` 统一执行）**：

```text
write_allowed(category) =
     (category ∈ {recents, positions, session}) ? (settings.privacy.rememberRecords AND NOT session_suppressed(category))
   : (category = cache)  ? true
   : (category = authorizations) ? true
   : false
```

- `session_suppressed` 为进程内内存标志，仅由 `clear_records` / 隐私动作设置；`resume_recording` 或**显式打开文档**（`open_documents` 的 `entry != "restore"`）恢复相应类别（R27、IX13 §14.3）。
- 被抑制的写入返回 `SaveResult{saved:false}`，不产生用户可见错误；正文阅读与内存导航不受影响。

**分类清除映射**：

| 类别 | 数据库行 | 文件系统 | 运行时效果 | 依据 |
|---|---|---|---|---|
| `recents` | `recents` 选中或全部 | — | 列表移除；按门禁停止后续写入直至恢复记录 | R27；IX12 |
| `positions` | `positions` | — | 下次不恢复位置；当前会话停止写回 | R27；IX12 |
| `session` | `session_tabs`、`session_meta`、`sidebar_state` | — | 下次不恢复会话；停止写回 | R27；IX12 |
| `cache` | `cache_meta` | `remote-images/` 文件 | 移除可重建缓存；内存中已有合法视图可继续 | R27；IX12 |
| `authorizations` | `authorizations` 选中或全部 | — | 停止新读取；不自动从最近重新授予 | R25、R27 |
| `logs` | — | `logs/` 指定文件 | 移除日志；不上传 | R27、R28 |

- 清除前显示类别、数量/空间与“不会删除原始文档”；`confirm=true` 才执行；逐类返回实际结果（R27、IX12）。
- 清除“位置与会话”后**不得**被滚动、后台任务或退出自动保存悄悄重建（IX13 §14.3）。

## 7. 并发、恢复与一致性

- 单连接 + `Mutex`，所有写操作使用事务；命令经 `spawn_blocking` 调用，不阻塞异步运行时。
- `positions`/`session_tabs` 使用“最后成功提交”语义：异常退出最多恢复到上一次提交（NF08）；写入失败不静默丢状态（返回 `SaveResult.error`）。
- 缓存 LRU：超过 256MiB 时按 `last_access_at` 淘汰并同步删除文件；删除失败保留行并下次重试。
- 恢复时任何表级错误按类别降级，不使应用无法启动（NF08）。

## 8. 与需求的追溯

| 需求 | 数据模型承接 |
|---|---|
| R04/NF01 | 无源写路径；无正文副本；导出校验受保护源位置 |
| R05/R06 | `documents`、`recents`（≤100）、`session_tabs`/`session_meta` |
| R07 | `documents.canonical_path` 可更新 + contentHash 比较决定重关联/新版本 |
| R19 | `positions`（AnchorRecord §3.3） |
| R20 | `sidebar_state`（目录/文档分别保存） |
| R23 | `settings`（默认值 §5；越界保留旧值由实现与 UI 共同保证） |
| R25/R26 | `authorizations`（scope/复核/撤销） |
| R27 | §6 分类清除与写入门禁 |
| R28/NF02 | 日志无正文；诊断导出脱敏 |
| NF08 | §4 迁移与 §7 恢复；损坏不移除、需显式重建 |
| SRS §6.1/§6.2 | 默认值 §5；记录不含全文快照 |
