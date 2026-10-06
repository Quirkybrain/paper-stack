# 纸栈 PaperStack · wp-14-commands 实现报告（T-18 – T-20，M2 完成）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP14
- **Artifact Type**: Implementation Evidence Report（诊断/应用信息、38 命令表面、能力与 CSP 的构建、测试与运行证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-14-commands`（任务分支 `task/wp-14-commands`；父分支 `feat/v0.1.0`；基线提交 `8dc1d41346c345a77bf01bd732073ca9ce8bd456`）
- **Component**: C-08（诊断/导出）、C-09（应用信息/合法文本）、C-10（命令表面/状态/能力）
- **Last Verified**: 2026-10-07
- **Scope**: 合并执行原 wp-14（T-18/T-19：`services/{diagnostics,info}.rs`）与 wp-15（T-20：`commands/**`、`state.rs`、38 命令注册、capabilities/CSP）。不改任何上游 Artifact/契约；不新增依赖；不实现前端。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（`swe_guard.py begin` 冻结，本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | ✓ |
| `artifacts/30-architecture/architecture.md` | `50e1e588bceba05f288efdd876b3b66fa66dc0157d3b913fdb364c9abb07a224` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69ca733d802622f7e0e18fb22b113008a646117f09da37de183fb5065c0` | ✓ |

基线 `8dc1d41` 与 handoff 一致；进入时工作树干净；`SWE snapshot` ref `refs/swe/snapshots/20261006T215218Z-wp-14-commands-c3278d84` 覆盖 `src-tauri/src/`、`tauri.conf.json`、`capabilities/` 修改前字节。未修改任何冻结输入。依赖未变（未改 `Cargo.toml`/`Cargo.lock`/`package.json`）。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `src-tauri/src/services/diagnostics.rs`（新，1131 行） | 结构化本地日志：`LogEvent`（无自由文本 API，`Path`/`Url` 字段按变体脱敏、`Text` 值 JSON 转义），滚动单文件上限 10MiB（超出时在行/UTF-8 边界裁掉最旧字节并写截断标记，`total_bytes() ≤ cap`；单条超出则丢弃计数）。脱敏：家目录→`~`、中间目录→`<dir>`、保留末两级；URL 仅保留 `scheme://host[:port]`（query/fragment/userinfo 全部剥离）；`details` 白名单键（`rootCandidate`/`scheme`/`newOrigin`/`operation`/`failures`/`degraded`）。诊断束构造：`DiagnosticsBundle`（app/documents/limits/redactions），issue 聚合 `(code, messageKey, sourceRange)` 计数与首见时间，`category`、`versionHash`、`sourceRange`、`messageKey`（reason）、`retryable`（recovery）齐备；预览即导出字节（`exportId`、TTL 15min、内存上限 8）。导出校验按 security-model §7 顺序：绝对路径 → exportId 未过期 → 不等于已打开文档 → 不在任一已打开文档 canonical 父目录内（组件级）→ 已存在须 `overwrite=true` → 同目录临时文件+原子重命名；失败保留预览。`copy_summary` 默认排除路径与源范围（除非显式勾选）。`atomic_write_file` 为通用原子写助手。 |
| `src-tauri/src/services/info.rs`（新，216 行） | `InfoService::app_info`（纸栈 PaperStack / 真实 crate 版本 / Quirkybrain / GPL-3.0-only / `paperstack-ipc-r1` / zh-CN；`legal.sourceEntryUrl=null` + `sourceEntryNote="about.sourceUnconfigured"`（i18n key，Rust 不返回用户可见文本，A9）；`licenseAvailable`/`thirdPartyAvailable` 按资源目录实况）；`read_legal_text`（`LICENSE`/`THIRD_PARTY_NOTICES.md`，缺失→`PS_IO_NOT_FOUND`）；`validate_external_url`（仅 http/https 且有 host，余者 `PS_RESOURCE_UNSUPPORTED`）；`resolve_reveal_target`（canonicalize + 授权注册表判定，缺失→`PS_IO_NOT_FOUND`，无授权→`PS_AUTH_OUTSIDE_ROOT`）。 |
| `src-tauri/src/state.rs`（新，237 行） | `AppState` 受管状态：`Mutex<AuthRegistry>`、`Mutex<FilesService>`、`Mutex<TreeService>`、`Mutex<WatchState>`（`WatchRuntime`）、`Option<Storage>`（降级即 `None`，NF08）、`Mutex<Option<RemoteService>>`、`Mutex<SettingsCache>`、`Mutex<AppService>`、`DiagnosticsService`（内部锁，`&self` 线程安全）、`InfoService`、`cache_dir`。启动：数据/缓存/资源目录解析（失败降级临时目录）→ 诊断日志 → Storage 打开/迁移（失败记录并内存降级）→ `purge_session_grants` + 载入授权 + `revalidate_startup` → 远程服务（含跨会话缓存清理）→ 启动参数入队。`start_watch` 幂等启动 `WatchRuntime` 并将 payload 发为 `paperstack://watch-changed`；`handle_second_instance` 聚焦主窗口并排队或发 `paperstack://open-requested`。`lock()` 助手恢复毒锁。 |
| `src-tauri/src/commands/mod.rs`（新，204 行） | `command_surface!` 单一来源：一次列表同时生成 `COMMANDS: [CommandSpec; 38]`（name/module/contract_row/request/response）与 `invoke_handler()`（`tauri::generate_handler!`，Wry）——注册与表不可漂移，列表长度不足/超出 38 直接编译失败。`dispatch()`：`spawn_blocking` 执行同步服务调用、失败记录诊断、`AppError→ErrorPayload` 映射、JoinError→`PS_INTERNAL`。`asset_url()`：`WebviewWindow::convert_file_src` + `?v=` 观察键（mtime+size）。`diagnostics_app_info()`。 |
| `src-tauri/src/commands/files.rs`（新，264 行） | 命令 1–8、38 薄适配：对话框（Rust-only，md/markdown 过滤；导出目标默认名 `paperstack-diagnostics.txt`）；`open_documents` 逐项校验/解码/去重、持久文件授权（持久化失败降级会话授权）、`documents` 行 upsert、`entry != restore` 恢复记录写入门禁；`read_document`/`get_source_info`/`read_source_window`/`search_source` 先经注册表+授权复核（撤销→`PS_AUTH_REVOKED`）；`relink_document` 以用户选择为新授权。 |
| `src-tauri/src/commands/tree.rs`（新，47 行） | 命令 9–10：`open_directory`+目录授权（session/persistent，持久化失败降级）；`read_directory`。 |
| `src-tauri/src/commands/watch.rs`（新，93 行） | 命令 11–12：文档存在/授权复核；`resourcePaths` 逐项走 `authorize_local_read`，仅授权范围内的本地文件进入注册集合，未授权/缺失/远程项跳过并记诊断（不失败文档监测）；`unwatch` 未知文档成功。 |
| `src-tauri/src/commands/storage.rs`（新，256 行） | 命令 13–23：recents/positions/session 读写与写入门禁、`get_storage_overview` 合并 logs 用量、`clear_records` 合并 logs 清理（storage 不可用时逐类返回 `PS_STORAGE_UNAVAILABLE`，logs 仍可清）、`resume_recording`（可选参数）、`get_settings`（DB 失败降级内存值并记诊断）、`update_settings`（先内存后持久化；失败返回 `applied`+`persisted=false`+error；revision 单调）。 |
| `src-tauri/src/commands/auth.rs`（新，218 行） | 命令 24–27：`check_resource_access` 永不 reject——remote 分类/允许判定、local 走 §2.2 算法后生成 asset URL（`allowed` 才给），outside-root 附 `rootCandidate`，其余按 `ResourceMissing/Unsupported/Permission` 映射 `missing/unsupported/denied`；`grant_local_root`（存在、可读目录、用户确认）；`list_grants`；`revoke_grant`。 |
| `src-tauri/src/commands/resources.rs`（新，126 行） | 命令 28–30：origin 归一化（`https://host[:port]`）与文档注册校验；撤销合并注册表与缓存删除计数；`fetch_remote_image` 要求非空会话允许集合→受控获取→缓存文件存在时给出 Rust 生成 asset URL。 |
| `src-tauri/src/commands/app.rs`（新，89 行） | 命令 31–35：外部 URL 白名单+系统浏览器；`reveal_in_folder` 授权后交文件管理器；`get_app_info`；`read_legal_text`；`take_pending_open_requests`。 |
| `src-tauri/src/commands/diagnostics.rs`（新，94 行） | 命令 36–37：预览文档行来自已注册文档（仅元数据），limits 使用冻结常量；导出受保护源来自已打开文档集合；成功导出记结构化日志。 |
| `src-tauri/src/lib.rs`（改） | `Builder`：single-instance（最先）→ dialog → clipboard-manager → opener；`setup` 创建并 `manage` `AppState`、启动 watch（失败记诊断不阻塞）；`invoke_handler(commands::invoke_handler())`；插件白名单与 security-model §6 一致，无 fs/shell/http。 |
| `src-tauri/capabilities/default.json`（改） | 最小权限：`core:default` + `core:window:allow-close` + `core:window:allow-destroy` + `clipboard-manager:allow-write-text`。 |
| `src-tauri/tauri.conf.json`（改） | 生产 `csp`（security-model §6 逐字）与 `devCsp`（仅额外 `ws://localhost:1420`）。 |
| `src-tauri/src/error.rs`（改，+19 行） | `AppError::from_payload`：嵌套 `SaveResult.error` 以命令失败上浮时保留 code/details/sourceRange。 |
| `src-tauri/src/services/auth.rs`（改，+104 行） | 新增 `grant_file_session`/`grant_directory_session`/`grant_remote_session_memory`（持久化失败时的内存降级，返回诚实的 session scope；既有 `grant_*` 语义与测试不变）；`normalize_origins`/`remote_record` 抽取消除重复。 |
| `src-tauri/src/services/storage.rs`（改） | 抽取纯函数 `apply_settings_patch`（R23 越界保留旧值），`update_settings` 复用；行为仅在“补丁与现值相同”时不再写入（值等价，revision 不再空增）。 |
| `src-tauri/src/services/files.rs`（改，+6 行） | `registered_documents()` 访问器（诊断束/受保护源）。 |
| `src-tauri/src/services/watch.rs`（改，+4 行） | `EVENT_WATCH_CHANGED` 事件名常量。 |
| `src-tauri/src/services/mod.rs`（改） | 声明 `diagnostics`、`info`。 |
| `src-tauri/tests/commands_surface.rs`（新，881 行） | 表面表 ↔ 契约/ fixture 对照、38 命令请求/响应类型 round-trip、日志滚动/脱敏/issue 聚合、预览与导出拒绝矩阵、原子写无残留、copy_summary 显/隐规则、应用元数据一致性（Cargo.toml/tauri.conf.json/package.json）、合法文本、reveal 授权。 |
| `artifacts/60-implementation/wp-14-commands.md` | 本报告。 |

## 3. 38/38 命令映射表（命令 → 命令模块 → 后端服务 → 契约行）

| # | Rust 命令 | commands 模块 | 后端服务/路径 | 契约 §2 行 |
|---|---|---|---|---|
| 1 | `pick_files` | files | tauri-plugin-dialog（Rust-only） | 1 |
| 2 | `pick_directory` | files | tauri-plugin-dialog | 2 |
| 3 | `pick_export_target` | files | tauri-plugin-dialog | 3 |
| 4 | `open_documents` | files | `FilesService::open_document` + `AuthRegistry::grant_file` + `Storage::upsert_document` + `resume_after_explicit_open` | 4；§2.1 |
| 5 | `read_document` | files | 注册/授权复核 + `FilesService::read_document` | 5；§2.1/§7.4 |
| 6 | `relink_document` | files | `FilesService::relink_document` + 新路径文件授权 | 6；§2.1 |
| 7 | `get_source_info` | files | `FilesService::get_source_info` | 7；§2.1 |
| 8 | `read_source_window` | files | `FilesService::read_source_window` | 8；§2.1 |
| 9 | `open_directory` | tree | `TreeService::open_directory` + `AuthRegistry::grant_directory` | 9 |
| 10 | `read_directory` | tree | `TreeService::read_directory` | 10 |
| 11 | `watch_document` | watch | `AuthRegistry::authorize_local_read`（资源集合）+ `WatchRuntime::watch_document` | 11；§7.1 |
| 12 | `unwatch_document` | watch | `WatchRuntime::unwatch_document` | 12；§1.7 |
| 13 | `list_recents` | storage | `Storage::list_recents` | 13；§3.4 |
| 14 | `touch_recent` | storage | `Storage::touch_recent` | 14；§6 门禁 |
| 15 | `save_position` | storage | `Storage::save_position` | 15 |
| 16 | `load_position` | storage | `Storage::load_position` | 16 |
| 17 | `save_session` | storage | `session::persist_session` → `Storage::save_session_tabs` | 17 |
| 18 | `load_session` | storage | `session::restore_session` → `Storage::load_session_snapshot` | 18 |
| 19 | `get_storage_overview` | storage | `Storage::storage_overview` + `DiagnosticsService::log_usage` | 19 |
| 20 | `clear_records` | storage | `Storage::clear_records` + `DiagnosticsService::clear_logs`（logs 类） | 20；§6 |
| 21 | `resume_recording` | storage | `Storage::resume_recording` | 21；§6 |
| 22 | `get_settings` | storage | `Storage::load_settings` + `SettingsCache`（失败降级） | 22；§2.1 |
| 23 | `update_settings` | storage | `Storage::update_settings`/`apply_settings_patch` + `SettingsCache` | 23；§2.1 |
| 24 | `check_resource_access` | auth | `paths::classify_reference` + `AuthRegistry::{authorize_local_read,active_origins}` + `asset_url` | 24；§2.1 |
| 25 | `grant_local_root` | auth | `AuthRegistry::grant_directory`（+会话降级） | 25；R25 |
| 26 | `list_grants` | auth | `AuthRegistry::list` | 26 |
| 27 | `revoke_grant` | auth | `AuthRegistry::revoke` | 27 |
| 28 | `grant_remote_session` | resources | `normalize_origin` + `AuthRegistry::grant_remote_session`（+内存降级） | 28；§4 |
| 29 | `revoke_remote_session` | resources | `AuthRegistry::revoke_remote_session` + `RemoteService::revoke_session` | 29；§4 |
| 30 | `fetch_remote_image` | resources | `RemoteService::fetch` + `asset_url` | 30；§4 |
| 31 | `open_external_url` | app | `info::validate_external_url` + opener 插件 | 31；R15 |
| 32 | `reveal_in_folder` | app | `info::resolve_reveal_target` + opener 插件 | 32；R07/R09 |
| 33 | `get_app_info` | app | `InfoService::app_info` | 33；R30 |
| 34 | `read_legal_text` | app | `InfoService::read_legal_text` | 34；R30 |
| 35 | `take_pending_open_requests` | app | `AppService::take_pending_open_requests` | 35；§2.1/§4 |
| 36 | `preview_diagnostics` | diagnostics | `DiagnosticsService::{build_bundle,render_bundle,preview}` | 36；§7 |
| 37 | `export_diagnostics` | diagnostics | `DiagnosticsService::export` + `ProtectedSources` + `atomic_write_file` | 37；§7 |
| 38 | `search_source` | files | `FilesService::search_source` | 38；§2.1 |

命令参数约定（供 wp-16 TS 封装）：§2 请求为 §3 模型的命令一律单参数 `req`（如 `invoke("read_document", { req: { docId, purpose } })`）；标量请求直接用命名参数（`docId`/`grantId`/`url`/`path`）；`resume_recording` 的 `req` 可省略或 `null`。事件：`paperstack://watch-changed`（watch runtime 发射）、`paperstack://open-requested`（单实例移交）。

## 4. 能力与 CSP 核对（security-model §6）

**capabilities/default.json**（tauri-build 解析产物 `out/capabilities.json` 实测）：

| 项 | 值 | 依据 |
|---|---|---|
| 核心 | `core:default` | §6“窗口/事件基础” |
| 退出流程 | `core:window:allow-close`、`core:window:allow-destroy` | §6 显式要求 |
| 插件（JS 可见） | `clipboard-manager:allow-write-text`（唯一） | §6；R11 |
| dialog/opener | 未授予 JS 权限（仅 Rust 调用） | §6/§9 |
| single-instance | 仅 Rust，无 JS 权限 | §6 |
| fs/shell/http | 不注册、不授予 | PC-02/T9 |
| 应用自定义命令 | 不需要 capability（无 app ACL manifest，`generate_handler` 全量注册） | Tauri 2 语义 |
| asset 协议 | **未启用**（见 §7 决策 1，被 `Cargo.toml` feature 阻塞） | §6 待补 |

**tauri.conf.json `app.security.csp`（生产，逐指令）**：

| 指令 | 值 | 说明 |
|---|---|---|
| `default-src` | `'self'` | 离线资产，无远程来源 |
| `script-src` | `'self'` | 文档内容不可执行脚本（配合消毒 schema，R09） |
| `style-src` | `'self' 'unsafe-inline'` | KaTeX/Shiki/Mermaid 受信输出内联 style 的唯一受控取舍（ADR-001）；文档内 `style` 已被消毒剥离 |
| `img-src` | `'self' asset: http://asset.localhost data: blob:` | 本地/asset 图片；data:/blob: 为公式/图表输出 |
| `font-src` | `'self' data:` | 字体随包，无 CDN（R30/NF02） |
| `connect-src` | `'self' ipc: http://ipc.localhost` | 仅 Tauri IPC；无文档网络请求 |
| `worker-src` | `'self' blob:` | 解析 Worker（ADR-002） |
| `object-src`/`frame-src` | `'none'` | 禁止插件/框架注入 |
| `base-uri`/`form-action`/`frame-ancestors` | `'none'` | 防基址劫持/表单外发/嵌套 |
| `devCsp` | 同上，`connect-src` 额外 `ws://localhost:1420` | 仅 Vite HMR；生产 `csp` 不含 |

## 5. 任务→测试映射（T-18..T-20）

| T | 测试（文件::测试名） |
|---|---|
| T-18 日志滚动 10MiB | `commands_surface`：`rolling_log_cap_keeps_the_newest_lines_within_the_limit`、`oversized_single_entries_are_dropped_and_counted`；lib：`path_redaction_keeps_home_marker_and_last_two_levels`、`url_redaction_drops_query_fragment_and_userinfo`、`details_sanitizer_drops_unknown_keys` |
| T-18 脱敏（无正文/私人路径/令牌） | `commands_surface`：`log_entries_never_contain_full_paths_or_url_tokens`、`command_failures_log_reason_range_and_recovery_and_aggregate_issues`、`bundle_default_redaction_drops_source_context_and_counts_it`、`copy_summary_excludes_paths_and_ranges_unless_explicitly_selected` |
| T-18 导出拒绝矩阵/覆盖确认/原子写/失败保留预览 | `commands_surface`：`export_rejects_open_documents_and_their_parent_directories`、`export_requires_absolute_target_and_overwrite_confirmation`、`export_leaves_no_temp_files_behind`、`preview_holds_the_exact_export_bytes_and_a_bounded_id`、`protected_sources_match_component_level` |
| T-19 元数据一致性 | `commands_surface`：`app_info_matches_crate_package_and_tauri_metadata`；lib：`app_info_is_contract_fixed_and_source_entry_is_explicitly_unconfigured` |
| T-19 合法文本/协议白名单/授权检查 | `commands_surface`：`legal_texts_read_bundled_resources_and_report_missing_ones`、`reveal_target_requires_registration_and_authorization`；lib：`external_url_validation_accepts_only_http_and_https_with_host` |
| T-20 38/38 形状 | `commands_surface`：`command_table_matches_contract_order_names_rows_and_modules`、`command_table_is_covered_by_the_contract_fixtures`、`every_command_shape_round_trips_through_its_contract_types`；既有 `contract_shape`（fixture round-trip 38/38）不回归 |
| T-20 诊断模型形状 | `commands_surface`：`diagnostic_issue_serialization_matches_the_contract_shape` |

## 6. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS（无 diff） |
| 2 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS，0 warning |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：**237 passed / 0 failed**（见下表） |
| 4 | `cargo build --manifest-path src-tauri/Cargo.toml` | PASS |
| 5 | 运行时冒烟：`DISPLAY=:1 cargo run` + `xwininfo -root -tree` | 进程存活 15s 无 panic；`xwininfo` 实测窗口 `"纸栈 PaperStack" 1280x800`（wm class `paperstack/Paperstack`）；真实数据目录生成 `paperstack.sqlite3`（WAL/迁移成功）与 `logs/paperstack.log`（结构化行：`startup version="0.1.0"`、`startup_revalidation ...`） |

| 测试目标 | 结果 |
|---|---|
| lib（40 = 既有 35 + 新 5） | 40 passed; 0 failed |
| `commands_surface`（新） | 19 passed; 0 failed |
| `contract_shape`（既有） | 3 passed; 0 failed |
| `app_open_requests`（既有） | 7 passed; 0 failed |
| `files_open` / `files_read` / `files_source`（既有） | 12 / 12 / 18 passed; 0 failed |
| `migration_faults`（既有） | 11 passed; 0 failed |
| `remote_policy`（既有） | 23 passed; 0 failed |
| `security_paths_auth`（既有） | 24 passed; 0 failed |
| `storage_fixtures` / `storage_gating` / `storage_records` / `storage_session`（既有） | 2 / 8 / 21 / 6 passed; 0 failed |
| `tree_listing`（既有） | 9 passed; 0 failed |
| `watch_registry` / `watch_runtime`（既有） | 20 / 2 passed; 0 failed |
| main / doc-tests | 0 passed; 0 failed |

新增测试合计 24（19 集成 + 5 单元）；端到端保持确定性（日志/预览时钟注入 `ManualDiagnosticsClock`；导出用 `tempfile`）。

## 7. 实现决策与契约张力（明确记录）

1. **asset 协议被 `Cargo.toml` feature 阻塞（跨范围阻塞，需上级裁决）**：security-model §6 要求 `assetProtocol.enable=true` 且 scope 由 Rust 运行时扩缩；但 `tauri-build` 会校验 `tauri.conf.json` 期望的 features（`Config::features()` 在 `asset_protocol.enable=true` 时要求 `tauri` 依赖含 `protocol-asset`，见 `tauri-build::manifest::check`），而 `Cargo.toml` 不在本 handoff 写入范围（guard 会拒绝）。因此本任务**未**打开 `assetProtocol`（打开即构建失败），命令 24/30 的授权判定与 `WebviewWindow::convert_file_src` + `?v=` URL 生成为真实实现，但 WebView 在补上 `tauri = { features = ["protocol-asset"] }` + `assetProtocol.enable=true`（静态 scope 空）之前**无法加载**这些 URL。后续工作包（wp-16 接线前）需一行 `Cargo.toml` 改动；本项不影响 IP-1（无图片加载）与全部确定性测试。
2. **远程获取缓存失败回退**：`RemoteService::fetch` 返回 `memory_bytes` 时（缓存写失败）命令层无诚实的 asset URL 可发，返回 `PS_REMOTE_FAILED`（可手动重试），不虚报成功；已成功写缓存的正常路径不受影响（wp-12 记录交 wp-15 决定，此处决定并记录）。
3. **`get_settings` 降级语义**：契约“主要错误码 PS_DB_FAILURE（降级返回默认）”。响应类型无 error 字段，实现为：DB 失败时返回内存缓存（启动时来自默认值）并以诊断记录错误、不 reject；避免 UI 无法读取设置而白屏（NF08）。
4. **`update_settings` revision**：命令层内存 `revision` 单调（有效变更 +1），并吸收 storage 的 `settings_revision`（取 max），保证内存-持久化混合路径不回退；契约未冻结 revision 语义（wp-11 报告同）。
5. **未被产出的错误码（记录解释）**：`grant_local_root` 不产出 `PS_AUTH_OUTSIDE_ROOT`（任何存在且可读的目录经用户确认即可授权，越界概念只用于读取目标）；`relink_document` 不产出 `PS_AUTH_DENIED`（重定位是用户显式选择新文件，等同打开，构成授权决定）。契约的错误列为“主要错误码”，非每码必达。
6. **`watch_document` 的资源集合**：`resourcePaths` 原始引用逐项经 `authorize_local_read`（基准目录取自 Rust 注册表），仅授权的本地 canonical 文件进入注册；未授权/缺失/远程引用跳过并记诊断（不致整个文档监测失败），事件 `resourcePath` 回填 canonical 路径。资源授权同时把文件加入 asset scope（§7.1“已验证的资源文件集合”）。
7. **打开桥接 `documents` 行**：`open_documents` 成功后 `Storage::upsert_document`（recents/positions 的外键依赖），失败仅记诊断不失败打开（NF08）。
8. **`clear_records`/`get_storage_overview` 的 logs 归属**：storage 层对 `logs` 返回 0；命令层经 `DiagnosticsService` 合并实际文件数/字节与清除结果（T-13/T-18 边界注释所约定）。
9. **对既有服务的最小增补（非重实现）**：`AuthRegistry` 三个内存降级授权（持久化失败时会话级生效，既有 `grant_*` 失败语义与测试保持）；`AppError::from_payload`；`Storage::apply_settings_patch` 纯函数抽取；`FilesService::registered_documents`；`watch::EVENT_WATCH_CHANGED`。
10. **dev CSP 风险提示**：`devCsp` 按 security-model 只额外放行 HMR `ws://localhost:1420`。Vite React 插件的 refresh preamble 为内联 module script，`script-src 'self'` 在 `pnpm dev` 下可能拦截；本任务不含前端（wp-16 首现），已记录为 M3 集成风险，若出现则需在 devCsp 增加 `'unsafe-inline'`（仅开发）或调整 Vite 注入策略，需架构侧确认。
11. **诊断束字段语义**：`docIdShort` 直接使用本就不透明且不含路径信息的 `docId`（`d-`+哈希）；`displayNameRedacted` 默认仅去目录前缀（保留单段文件名，与 `fixtures/contracts/models.json` 一致）；“reason”=messageKey，“recovery”=命令失败的 `retryable` 字段与导出失败“预览保留可复制/重试”的恢复路径（契约 `DiagnosticIssue` 无 retryable 字段，故该维度承载在实时 ErrorPayload 与日志行）。
12. **日志与预览参数**：日志时间戳用 epoch ms（避免引入格式化依赖；契约 §1.1 即 epoch ms）；预览 TTL 15min、内存 ≤8 条为契约留白的实现参数（可校准，测试经注入时钟固定）。

## 8. 限制与风险

- 命令表面经编译期注册（`generate_command!` 与表同源）+ fixture 形状核对，但未在真实 WebView 中逐条 invoke（无 WebDriver，ADR-010）；命令级运行验证留待 M3/IP-1 集成。
- asset URL 不可加载（§7 决策 1）：阻塞 `check_resource_access`/`fetch_remote_image` 的端到端图片显示，非授权逻辑。
- `pnpm dev` 下 Vite 内联 preamble 与严格 devCsp 的兼容性（§7 决策 10）。
- 远程图片缓存写入失败时用户仅得可重试错误，无内存回退展示（诚实性优先）。
- `grant_local_root` 允许授权任意可读目录（由 UI 模态确认把关，R25）；Rust 侧只校验存在/目录/可读。
- 单实例回调在状态尚未 manage 的极窄竞态窗口会忽略移交（`try_state`），不排队；实际发生在 setup 前，概率可忽略，记录备案。
- 本机为 X11；Wayland 下的窗口/能力行为保持 UNVERIFIED（架构 §12 A4）。

## 9. 提交

任务分支 `task/wp-14-commands` 上的唯一提交（提交前三条 DoD 命令全绿；`git diff --cached --check` 干净；仅暂存声明路径 `src-tauri/src/`、`src-tauri/tests/`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/`、`artifacts/60-implementation/`）：

1. `feat(commands): register ipc surface with minimal capabilities and csp`：上述 §2 交付物（38 命令、state、诊断/信息、capabilities、CSP、测试、本报告）。
