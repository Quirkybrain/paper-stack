# 纸栈 PaperStack · wp-11 SQLite 存储与会话服务实现报告（T-12 – T-14）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP11
- **Artifact Type**: Implementation Evidence Report（`services/storage.rs`、`services/session.rs` 的构建、测试与验证证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-11-storage`（任务分支 `task/wp-11-storage`；父分支 `feat/v0.1.0`；基线提交 `bbc3c35d20cee6f9afd7559478f4cf6137e379a9`）
- **Component**: C-05（Rust 存储服务）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 T-12..T-14：连接参数、schema v1 DDL、`PRAGMA user_version` 前向迁移框架；settings/recents(≤100)/positions/session_tabs/session_meta/sidebar_state/authorizations/cache_meta 仓库；写入门禁与分类清除；缓存 LRU 元数据；`session.rs` 会话映射与恢复读取助手。**不新增 Tauri 命令表面**（wp-15）、不含日志/诊断滚动（wp-14）、不含远程缓存文件获取（wp-13）、不含内容正文（零正文策略）。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（`swe_guard.py begin` 冻结，本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/data-model.md` | `0e263230d6212cfe0d2092572f8c0e96f1b8cb33a2563f6eb526e3ba7b8369d1` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/30-architecture/adr/ADR-004-persistence-sqlite.md` | `765025a8f91dffaece7a67425999664f849b76a769117d6a3c500b87e749ec0a` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |

基线提交 `bbc3c35` 与 handoff 一致；进入时工作树干净；`SWE snapshot` ref `refs/swe/snapshots/20261006T212642Z-wp-11-storage-2af196c0`（commit `ce678e33`）覆盖 `src-tauri/src/` 修改前字节。`fixtures/` 本任务未改。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `src-tauri/src/services/storage.rs` | 连接参数（`foreign_keys=ON`、`journal_mode=WAL`、`synchronous=NORMAL`、`busy_timeout=3000`）；schema v1 DDL（9 表 + 5 索引，全部 `STRICT`，逐字对应 data-model §2）；`PRAGMA user_version` 前向迁移框架（每步单事务、失败回滚、修订不连续报错、高于支持修订拒绝降级）；`open_path` 读写打开与 `open_read_only_path` 只读降级（`query_only`）；全部仓库：settings（类型化、SRS §6.1 默认值、越界保留旧值）、documents、recents（≤100 截断 + `opened_at DESC`）、positions（AnchorRecord JSON 映射）、session_tabs/session_meta、sidebar_state（≤64KiB + JSON 校验）、authorizations（wp-08 `GrantPersistence` 实现 + 启动 session 清理）、cache_meta（LRU 淘汰 + `rel_path` 防目录逃逸 + 单条移除）；写入门禁与进程内抑制状态；分类清除逐类结果；`storage_overview`；故障注入接口 `set_max_page_count` |
| `src-tauri/src/services/session.rs` | `normalize_tabs`（排序、重复 tabId/docId 拒绝、多活动标志收敛）、`active_tab_id`、`persist_session`、`restore_session`（容忍读取 + 活动标签重算） |
| `src-tauri/src/services/mod.rs` | 声明 `pub mod session;`、`pub mod storage;`（未改 Tauri 命令表面、未新增依赖） |
| `src-tauri/tests/migration_faults.rs` | T-12/T-14 故障注入矩阵（11 测试） |
| `src-tauri/tests/storage_records.rs` | 仓库往返、缓存 LRU、授权注册表持久化（21 测试） |
| `src-tauri/tests/storage_gating.rs` | 门禁矩阵、分类清除、抑制与恢复、不触碰源文件（8 测试） |
| `src-tauri/tests/storage_session.rs` | 会话映射/恢复助手集成（6 测试） |
| `artifacts/60-implementation/wp-11-storage.md` | 本报告 |

依赖未变：仅 `rusqlite`（bundled，既有）、`serde`/`serde_json`、`thiserror`（既有）与 `tempfile`（dev，既有）；未新增 crate。

## 3. 任务→测试映射（T-12..T-14）

| T | 测试（文件::测试名） |
|---|---|
| T-12 连接/schema/迁移框架 | `migration_faults`：空库→v1（9 表/5 索引/全 STRICT/WAL）、v1 库幂等重开且设置保留、更高修订拒绝读写并只读降级、损坏字节保留且报 `PS_DB_MIGRATION`、只读目录干净失败、只读降级拒损坏文件；`storage::tests`：固定上限与 `FrozenLimits` 一致 |
| T-13 仓库与门禁 | `storage_records`：默认值/越界旧值/重开持久；rememberRecords 独立门禁；recents ≤100 顺序、路径刷新、未知 docId、可用性复核；positions 往返/FK 拒绝；session 往返/排序/活动标签；sidebar 往返/64KiB/非法 JSON；authorizations 往返、session 清理、wp-08 注册表注入-恢复-撤销；cache 往返/touch/LRU 淘汰（文件+元数据）/删除失败保留/逃逸路径仅删元数据/单条移除；`storage_gating`：门禁矩阵、确认要求、逐类计数（2/1/5/2/2/0）、抑制后写入 `saved:false` 且不重建、`resume_recording` 按类别/全部恢复、显式打开恢复、缓存部分失败暴露 `PS_IO_WRITE_FAILED`、清除不触碰源文件、overview 计数；`storage_session`：排序/活动/持久化/恢复/陈旧 active 丢弃/重复拒绝/抑制 |
| T-14 故障注入 | `migration_faults`：中断迁移（v2 部分 DDL 后失败）→ 回滚且 `user_version=1`、b 表不存在；磁盘满（`max_page_count` 页预算）迁移回滚至 0 且无表；记录写入磁盘满 → `PS_DB_FAILURE` 且数据库仍可读 |

## 4. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS（无 diff） |
| 2 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS，0 warning（`Finished dev profile ... 4.63s`） |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：159 passed / 0 failed（见下表） |

| 测试目标 | 结果 |
|---|---|
| lib（含 storage 3、session 2、既有 30） | 35 passed; 0 failed |
| `contract_shape`（既有） | 3 passed; 0 failed |
| `files_open` / `files_read` / `files_source`（既有） | 12 / 12 / 18 passed; 0 failed |
| `migration_faults`（新） | 11 passed; 0 failed |
| `security_paths_auth`（既有） | 24 passed; 0 failed |
| `storage_gating`（新） | 8 passed; 0 failed |
| `storage_records`（新） | 21 passed; 0 failed |
| `storage_session`（新） | 6 passed; 0 failed |
| `tree_listing`（既有） | 9 passed; 0 failed |
| main / doc-tests | 0 passed; 0 failed |

新增测试合计 51（5 单元 + 46 集成）。故障注入与安全相关用例（迁移中断、磁盘满×2、只读目录、损坏文件、LRU 部分失败、源文件只读）连续 3 次复跑全绿（0.02–0.07s/套）。

## 5. 实现决策与契约张力（明确记录）

1. **错误码映射**：打开/迁移失败（损坏、权限、磁盘满、更高修订）→ `PS_DB_MIGRATION`，文件原样保留（data-model §4.4“迁移/打开失败→`PS_DB_MIGRATION` 诊断”）；仓库运行时读写失败 → `PS_DB_FAILURE`；`PS_STORAGE_UNAVAILABLE` 留给命令层在 `Storage` 构造失败时表达“内存降级”（wp-15）。被抑制/失败的安全写入按 `SaveResult{saved:false,error?}` 返回，不抛异常（ADR-004 §6）。
2. **抑制范围遵循 data-model §6**：仅 `recents/positions/session` 可被抑制（suppression 为进程内状态）；`cache`、`authorizations` 恒可写，`logs` 不在存储门禁内（`write_allowed(Logs)=false`，日志文件归 wp-14）。handoff 括号列举的“cache/authorizations”按模型语义处理为“不受清除抑制影响”。`sidebar_state` 归入 `session` 类别（清除与门禁一致）。
3. **策略性缺陷与故障注入**：`set_max_page_count` 为文档化的维护/测试接缝，将 `PRAGMA max_page_count` 钉在当前位置后真实触发 `SQLITE_FULL`（迁移与仓库写入两条路径均验证），不使用 mock 或伪造错误。
4. **只读降级 API**：`open_read_only_path`（`SQLITE_OPEN_READ_ONLY` + `query_only`）供“更高修订拒绝写入、只读降级提示”使用（data-model §4.5）；不自动降级 schema、不重命名/删除文件。“显式重建本地数据库”（改名 `.corrupt-<ts>`）为 wp-15/16 的界面动作，本服务不提供自动重建。
5. **settings.revision 语义未在契约冻结**：实现为**进程内**单调计数（每次成功持久化 +1，重启归零），仅作 UI 失效令牌；未持久化、未新增列，契约字段形状不变。
6. **`logs` 类别清除返回 0**：日志滚动/删除属 `services/diagnostics`（wp-14）；存储层对 `logs` 返回 `cleared:0,error:None`，命令层合并。`storage_overview` 同样将 logs 记为 0，由 wp-14 替换/补充。
7. **`recents.last_path` 与 `canonical_path`**：`RecentEntry.canonicalPath` 取 `documents.canonical_path`（当前权威路径），`recents.last_path` 在每次 touch 时同步刷新（丢失文件提示备用），两列均不含正文。
8. **单语句写入使用 SQLite 隐式事务**：多语句流程（迁移、session 替换、清除）显式事务；单条 upsert 依赖 SQLite 隐式事务保证原子性（ADR-004 §6 的显式事务要求由多语句边界满足）。
9. **加载容忍度**：settings 单字段损坏/越界回退默认值（R23）；positions 的 `source_range_json=NULL` 防御性回退 `{0,0}` 且 `block_fingerprint=NULL` 回退 `""`（保存路径始终写值）；session 恢复容忍陈旧 `active_tab_id` 并重算 `is_active`。表级错误仍按类别降级（命令层）。
10. **缓存文件安全**：`resolve_cache_path` 拒绝绝对路径、`..`、`.`、空路径；不安全的 `rel_path` 仅移除元数据行、绝不触碰缓存目录外文件；删除失败的条目保留行待下次 LRU 重试（data-model §7）。

## 6. 限制与风险

- LRU 淘汰按 `cache_meta.size_bytes` 汇总与实际磁盘文件同步；若文件被外部删除，`enforce` 将其视为已删除并清行（可重建缓存，符合 R27）。
- settings 表未知键被忽略读取；未来字段新增需前向迁移（未实施）。
- `PS_DB_MIGRATION`/`PS_DB_FAILURE` 的命令层错误映射（含 `PS_STORAGE_UNAVAILABLE` 降级决策）由 wp-15 接线并做契约形状测试。
- 单连接串行写入对单窗口场景可忽略（ADR-004 已固化）；所有调用仍需经 `spawn_blocking`（wp-15）。
- 迁移仅 v1；更高修订读取依赖未来表结构向后兼容，属 §4.5 已声明行为。

## 7. 提交

任务分支 `task/wp-11-storage` 上单一提交：`feat(storage): add sqlite persistence and session services`。提交前 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 全绿；`git diff --cached --check` 干净；仅提交声明范围（`src-tauri/src/`、`src-tauri/tests/`、`artifacts/60-implementation/`；`fixtures/` 无改动）。
