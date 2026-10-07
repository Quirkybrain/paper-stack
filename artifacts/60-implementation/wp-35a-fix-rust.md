# 纸栈 PaperStack · wp-35a Rust 安全修复实现报告（Review A 发现 A-01…A-08）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP35A
- **Artifact Type**: Implementation Evidence Report（独立评审 A `artifacts/60-review/review-a-rust-security.md` Rev 3 §10.2 修复清单的 Rust 侧整改证据）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-35a-fix-rust`（任务分支 `task/wp-35a-fix-rust`；父分支 `feat/v0.1.0`；基线提交 `740f7a47f2bd166056cf9ad08a19d4b7b66eb43f`；产出提交主题 `fix(security): resolve review a findings`）
- **Components**: C-09（授权注册表/树服务/资源策略/诊断/存储接线；`src-tauri/src/`）、C-19（Rust 测试面；`src-tauri/tests/`）
- **Scope**: `src-tauri/src/`、`src-tauri/tests/`、`artifacts/60-implementation/`。未修改 `artifacts/30-architecture/`、`artifacts/35-models/`、pinned 输入、前端或框架文件；无新增依赖；无 IPC 字段/命令面变更（`commands_surface` 20/20 通过）。
- **Review base**: 评审 A 针对 `aac72e1`；本修复基线为其后的合并修订 `740f7a4`（`git diff aac72e1..740f7a4 -- src-tauri/` 为空，Rust 源码与评审对象字节一致）。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 `state/handoffs/wp-35a-fix-rust.json` 逐字一致，只读未改）：

| 输入 | SHA-256（前 8/后 8） | 一致 |
|---|---|---|
| `artifacts/60-review/review-a-rust-security.md` | `72a45b48…8b21e7` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…f3f47f74` | ✓ |
| `artifacts/30-architecture/data-model.md` | `0e263230…b8369d1` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…c3ac88a` | ✓ |

修复前基线（提交 `740f7a4`，工作树仅本任务改动）：`cargo test --manifest-path src-tauri/Cargo.toml --offline` = **21 套件 261 passed / 0 failed**（与评审 §1.4 一致）。未削弱任何既有测试；本修订净增 13 个用例（274 − 261）。

## 2. 发现修复（A-01…A-08，8/8）

| # | 严重度 | 根因 | 修复位置 | 新增/扩展测试 | 状态 |
|---|---|---|---|---|---|
| A-01 | blocker | `commands/files.rs::open_one` 对任何成功打开无条件 `grant_file`；`entry="restore"` 无授权复核 | `services/auth.rs`（`authorize_open_entry`/`OpenAuthorizationOutcome`）、`commands/files.rs::open_one` | `security_paths_auth::restore_does_not_regrant_revoked_authorization`；`commands::files::tests` 3 项边界（Restore vs Dialog/Drop/Cli/System/Tree/Recent） | 修复 |
| A-02 | major | `read_directory` 只查进程内树根，从不询问授权注册表；撤销/清除不逐出树根 | `services/tree.rs`（授权门 `read_directory_checked`）、`commands/tree.rs`（薄调用接线） | `tree_listing::read_directory_after_directory_revoke_is_denied`、`tree_listing::read_directory_after_authorization_clear_is_denied`；`services::tree::tests::read_directory_checked_gates_on_the_root_canonical_path` | 修复 |
| A-03 | minor | `revoke` 先删注册表再 `store.delete`，删除失败早退留下“注册表已无、scope 仍允许、重试 IO_NOT_FOUND” | `services/auth.rs::revoke` 持久化删除前置 | `security_paths_auth::revoke_delete_failure_keeps_the_grant_and_retry_completes`；`asset_scope::tests::revoke_persistence_failure_keeps_the_scope_and_completes_on_retry` | 修复 |
| A-04 | minor | 命令 29 经 `revoke_remote_cache(...)?` 把缓存/scope 失败冒泡为 reject，与契约“永不 reject”冲突 | `commands/resources.rs`（`RemoteCacheRevokeReport`，命令 29 计数 + 诊断日志不冒泡；`commands/storage.rs` 适配） | `remote_policy::revoke_session_counts_failed_removals_without_failing`（service 层 `failed_removals`；命令层由静态扫描确认） | 修复 |
| A-05 | minor | `open_read_only_path` 生产零调用；`AppState::create` 打开失败即内存降级 | `services/storage.rs::Storage::open_with_degrade`、`state.rs::AppState::create`（只读加载 grants/settings，如实记录 `PS_DB_MIGRATION` + `storage_read_only_degrade` 事件） | 扩展 `migration_faults::newer_schema_revision_is_refused_read_write_and_readable_in_read_only_degrade`；新增 `storage_open_degrade_ladder_prefers_read_write_and_reports_corruption` | 修复（口径 (a)） |
| A-06 | minor | 契约字面 `toLowerCase` 与双方逐码点折叠不一致 | 不修改代码（无行为不一致）；契约文本由 contract owner 修订 r2 | 复跑 `contract_search_parity` 5/5 + `pnpm vitest run --config tests/contracts/vitest.config.ts` 44/44 | 路由上游（见 §5） |
| A-07 | minor | `RemoteService::fetch` 仅 `parse_remote_url` 校验 scheme/host，未拒绝 userinfo | `services/resources.rs`（`parse_remote_url` 凭据拒绝；重定向目标同样拒绝） | `remote_policy::credential_urls_are_rejected_before_any_io`（断言 `PS_REMOTE_PROTOCOL`、resolver/transport 0 调用） | 修复 |
| A-08 | minor | `sanitize_details` 生产零调用，白名单仅“按构造”成立 | `error.rs::AppError::to_payload`（唯一 payload 出口过滤 `details`） | `error::tests::payload_drops_non_allowlisted_details` | 修复 |

### 2.1 A-01（blocker）restore 不再自动重授

- **根因**：`open_one` 打开成功后无条件 `grant_file`（失败再 `grant_file_session`），`entry` 仅用于记录写回；启动恢复对 `listRecents` 的 `available` 条目调 `open_documents(entry="restore")`，于是“撤销 → 干净退出 → 重启”把已撤销授权静默翻回可读（评审 §9.2 复现链）。
- **修复**：授权语义提取为注册表公共谓词 `AuthRegistry::authorize_open_entry`：`entry="restore"` 只观察注册表 —— 已有有效授权返回 `Restored`（行为不变），无有效授权返回 `NeedsConfirmation` 且不创建任何记录；显式用户入口（`dialog`/`drop`/`cli`/`system`/`tree`/`recent`）保持原有 grant-on-open（持久 + NF08 会话回退）。`open_one` 在 `entry="restore"` 时于**任何读取之前**做该复核（models §10.2：先授权复核后读取），未授权项以 `PS_AUTH_REVOKED` 逐项 rejected 返回，前端既有的 rejected/不可用分支（`use-reader.ts:1140-1163`）标记该标签不可用并提示；授权成功路径照常打开。
- **测试证据**：`restore_does_not_regrant_revoked_authorization` 走完“显式授权 → 撤销 → 空注册表恢复”链：`NeedsConfirmation`、`list_grants` 不新增、持久化 upsert 不触发、`has_local_access=false`、`authorize_local_read` 仍拒绝；随后重新显式授权时 restore 返回 `Restored` 且读取成功。`commands::files::tests` 覆盖 `Restore` vs 全部显式入口边界。
- **复审扫描**：`grep -n "entry" src-tauri/src/commands/files.rs` —— grant 块由 `entry != OpenEntry::Restore`（第 153 行）保护，复核块为 `entry == OpenEntry::Restore`（第 104 行）。

### 2.2 A-02（major）目录撤销/清除后停止扫描

- **根因**：`read_directory` 仅查 `TreeService.roots` + `is_within_root`；`revoke_grant`/`revoke_all_for_clear` 只动注册表。
- **修复**：`TreeService::read_directory_checked(root_id, dir_path, authorized)`（`services/tree.rs`）在解析根之后、任何 readdir 之前，用注册根的 canonical path 评估调用方决策，拒绝即 `PS_AUTH_REVOKED`；纯 `read_directory` 保留为无边效应的列表原语并注明“调用方须先持有授权决策”。命令 10 经可测命令体 `commands/tree::read_directory_checked(tree, auth, …)` 薄调用，传入 `auth.has_local_access` 决策（同一持锁内 tree → auth；代码中无反向获锁路径）。撤销目录授权与 `clear_records(["authorizations"])` 都会清空/移除相应授权，从而立即停止新扫描；用户显式 `open_directory` 重新授权后即可恢复（进程内 forbidden 集限制仅影响 asset，不影响树服务）。
- **测试证据**：两个命名用例调用命令真实调用体（非判定副本）：撤销后根与子目录扫描均 `PS_AUTH_REVOKED`，显式重开后恢复；清除类别后同样拒绝且注册表为空。`services::tree::tests::read_directory_checked_gates_on_the_root_canonical_path` 断言决策收到根 canonical path、拒绝时在读盘前中止、未知根仍 `PS_IO_NOT_FOUND`。

### 2.3 A-03（minor）撤销不留半撤销态

- **根因**：`revoke` 顺序为 注册表移除 → `store.delete(grant_id)?` 早退 → scope 缩容，删除失败时 allow 残留且重试 `PS_IO_NOT_FOUND`。
- **修复**：选择清单口径 **(a) 保留**：持久化删除前置于任何内存变更；删除失败时整个撤销未发生（grant 仍列出、仍可读、asset scope 仍允许），错误如实返回，存储恢复后重试可完成。无补偿删除需求，也不会“下次启动复活”。
- **测试证据**：`security_paths_auth::revoke_delete_failure_keeps_the_grant_and_retry_completes`（`RecordingStore` 新增 `fail_delete`）断言失败后 `list`/`has_local_access`/asset scope 保留、重试成功且第二次 `PS_IO_NOT_FOUND`；`asset_scope` 单测用 `ToggleDeleteStore` + `RecordingBackend` 断言失败时零 `forbid_*` 调用、恢复后 forbid 恰好一次。

### 2.4 A-04（minor）命令 29 不 reject

- **根因**：`revoke_remote_cache` 内 `state.asset_scope.revoke_file(path)?` 使命令返回 `Err`，而契约 §2 行 29 错误列为“—”（永不 reject）。
- **修复**：`revoke_remote_cache` 改为返回 `RemoteCacheRevokeReport { removed_cache_entries, failed_removals, scope_failures }`：缓存删除失败计入 `failed_removals`（来自 `RemoteService::revoke_session`），对仍存在的缓存文件继续执行 fail-closed forbid，forbid 失败计入 `scope_failures`；命令 29 始终返回 `Ok(RevokeResult)`（保留 `removedCacheEntries` 计数），失败以结构化诊断日志 `remote_revoke_failures` 呈现；`clear_records(["authorizations"])` 同样按计数把部分失败并入类别错误。
- **测试证据**：`remote_policy::revoke_session_counts_failed_removals_without_failing` 注入 `remove` 失败，断言 `failed_removals=2`、无 panic、缓存保留、后续 fetch 不复用旧字节；命令层无 `?` 冒泡由 `grep -n "revoke_remote_cache\|revoke_file" -B2 -A6 src-tauri/src/commands/resources.rs` 确认（仅 `is_err()` 计数分支）。

### 2.5 A-05（minor）NF08 只读降级接线（口径 (a)）

- **根因**：`Storage::open_read_only_path` 仅为测试调用；启动失败直接 `storage=None` 内存降级。
- **修复**：新增 `Storage::open_with_degrade(data_dir)`：先常规读写打开；失败则以同文件尝试只读打开（高版本/不可写 → 只读降级），成功时返回 `(Some(read_only_storage), Some(读写失败))`，失败（如损坏）返回 `(None, 错误)` 保持内存降级且文件原样。`AppState::create` 使用该梯子：只读加载 grants/settings，跳过不可执行的 session 行清理（内存注册表仍由 `revalidate_startup` 删除 session 授权），`record_app_error` 如实记录 `PS_DB_MIGRATION`，并记录 `storage_read_only_degrade` 事件与原因码；`Storage::is_read_only()` 作为降级状态可供后续命令读取。
- **测试证据**：扩展 `newer_schema_revision_is_refused_read_write_and_readable_in_read_only_degrade`：预置持久 grant → user_version=2 → 梯子返回只读 Storage（`is_read_only`、`schema_revision=2`、`load_grants` 读到记录、只读写返回 `PS_DB_FAILURE`、`user_version` 不被降级）；新增 `storage_open_degrade_ladder_prefers_read_write_and_reports_corruption` 覆盖健康库（读写、无降级错误）与损坏库（`None` + `DbMigration` + 字节原样）。
- **未闭环（路由上游）**：“只读降级提示”的 UI 展示与 data-model §4.4 “重建本地数据库”入口需要一个 r2 契约面（当前 38 命令无此入口）；本任务在契约允许范围内给出可读状态与如实诊断，见 §5。

### 2.6 A-07（minor）受控获取拒绝凭据 URL

- **根因**：`fetch` 只用 `parse_remote_url`（scheme/host），凭据不参与校验；origin 匹配忽略 userinfo，URL 可继续到缓存/DNS/传输。
- **修复**：`parse_remote_url` 在 host 校验后拒绝含 `username`/`password` 的 URL（`PS_REMOTE_PROTOCOL`），`fetch` 因此在任何 cache/allowlist/DNS/transport 动作前失败；`origin_for_remote_reference`/`normalize_origin` 既有校验保留（两条解析入口均校验）；重定向目标携带凭据时同样以 `PS_REMOTE_REDIRECT_BLOCKED` 拒绝（防御深度，不自动扩大范围）。
- **测试证据**：`remote_policy::credential_urls_are_rejected_before_any_io`：`https://user:pass@…` 与 `https://user@…`（origin 本会命中允许表）→ `PS_REMOTE_PROTOCOL`，`resolver_calls()==0`、`transport_calls()==0`、缓存为空。

### 2.7 A-08（minor）details 白名单在唯一出口生效

- **根因**：`sanitize_details` 无生产调用；白名单只靠“当前无人产生越界键”维持。
- **修复**：`AppError::to_payload()`（唯一 wire 出口）对 `details` 调用既有 `services::diagnostics::sanitize_details`（`DETAIL_KEY_ALLOWLIST`），非白名单键在出口被丢弃；源头 `AppError` 保留完整 details 供测试/日志内部使用，`sanitize_details` 不再是生产死代码。
- **测试证据**：`error::tests::payload_drops_non_allowlisted_details`：含 `secretToken`/`absolutePath` 的 details 只剩 `rootCandidate`/`operation`；既有 details 传递与值检查测试全部保持通过。

### 2.8 A-06（minor）搜索折叠契约文本（路由上游）

实现与共享向量一致（逐码点 Unicode 默认小写、无 Final_Sigma、无归一化），评审确认无用户可见不一致；`contracts.md:79` 的 `toLowerCase` 字面属契约文本债，按清单 A-06 由 contract owner 以 r2 显式改写并登记 Change Impact。本任务不改 `artifacts/30-architecture/`（不在写作用域）；复跑双方一致性证据见 §4。

## 3. §10.2 复审核对扫描（自检）

| 项 | 清单要求 | 实测 |
|---|---|---|
| A-01 | `grep -n "entry" src-tauri/src/commands/files.rs`：grant 块受 `entry != Restore` 或等价判定保护 | 第 153 行 `if entry != OpenEntry::Restore`（grant 块）；第 104 行 restore 复核；注册表谓词 `authorize_open_entry` 内部同样分支 |
| A-02 | `grep -n "has_local_access\|root_id\|read_directory" src-tauri/src/commands/tree.rs src-tauri/src/services/tree.rs`：读路径出现注册表判定 | `services/tree.rs::read_directory_checked` 授权门（`PS_AUTH_REVOKED`）；`commands/tree.rs` 传入 `auth.has_local_access` 决策 |
| A-03 | `grep -n "store.delete" -A8 src-tauri/src/services/auth.rs`：确认顺序/补偿 | 第 407-410 行：`store.delete(grant_id)?` 在 `grants.retain` 之前 |
| A-04 | `grep -n "revoke_remote_cache\|revoke_file" -B2 -A6 src-tauri/src/commands/resources.rs`：不得有 `?` 冒泡 | 无 `?`；`is_err()` 计数 + 日志，命令 29 恒 `Ok` |
| A-05 | `grep -n "open_read_only_path" src-tauri/src/state.rs src-tauri/src/services/storage.rs`：生产调用点出现 | `storage.rs:416`（`Storage::open_with_degrade` 生产梯子）；`state.rs:105` 调用梯子 |
| A-06 | 比对 `contracts.md` 与向量表述、Revision | 未修改（不在作用域）；差异已在评审 A-06 记录，路由 contract owner |
| A-07 | `grep -n "username\|password" src-tauri/src/services/resources.rs`：两条解析入口均校验 | 4 处：`parse_remote_url`、`normalize_origin`、`origin_for_remote_reference`、重定向复检 |
| A-08 | `grep -rn "sanitize_details\|to_payload" src-tauri/src/error.rs src-tauri/src/services/diagnostics.rs`：出口有过滤路径 | `error.rs:398` `details: self.details.as_ref().map(sanitize_details)` |

## 4. 精确命令与结果（2026-10-07）

全部在 `task/wp-35a-fix-rust` 工作树执行；无网络（`--offline`）。

| 命令 | 结果 |
|---|---|
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | PASS（无 diff） |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --offline -- -D warnings` | PASS（0 warning） |
| `cargo test --manifest-path src-tauri/Cargo.toml --offline` | **274 passed / 0 failed**（基线 261 + 13；见下表） |
| `cargo test --manifest-path src-tauri/Cargo.toml --offline --test security_paths_auth --test tree_listing --test storage_gating --test remote_policy --test migration_faults --test contract_search_parity --test commands_surface` | 26/26、11/11、8/8、26/26、12/12、5/5、20/20 |
| `cargo test --manifest-path src-tauri/Cargo.toml --offline --lib` | 61/61（基线 55 + 6） |
| 命名用例（`--exact`/模块限定） | `restore_does_not_regrant_revoked_authorization` ok；`revoke_delete_failure_keeps_the_grant_and_retry_completes` ok；`read_directory_after_directory_revoke_is_denied` ok；`read_directory_after_authorization_clear_is_denied` ok；`credential_urls_are_rejected_before_any_io` ok；`revoke_session_counts_failed_removals_without_failing` ok；`storage_open_degrade_ladder_prefers_read_write_and_reports_corruption` ok；`error::tests::payload_drops_non_allowlisted_details` ok；`services::asset_scope::tests::revoke_persistence_failure_keeps_the_scope_and_completes_on_retry` ok；`services::tree::tests::read_directory_checked_gates_on_the_root_canonical_path` ok；`newer_schema_revision_is_refused_read_write_and_readable_in_read_only_degrade` ok |
| `pnpm test -- --run`（前端回归，仅验证无前端变更需要） | 69 files / **529 passed / 0 failed** |
| `pnpm vitest run --config tests/contracts/vitest.config.ts`（A-06 双端一致性） | 4 files / 44 passed / 0 failed |

套件计数（修复后）：lib 61、app_open_requests 7、commands_surface 20、contract_search_parity 5、contract_shape 3、files_open 13、files_read 12、files_source 18、migration_faults 12、nf07_soak 1、remote_policy 26、security_paths_auth 26、storage_fixtures 2、storage_gating 8、storage_records 21、storage_session 6、tree_listing 11、watch_registry 20、watch_runtime 2；合计 **274 passed / 0 failed / 0 ignored**。

命令面未变（`commands_surface` 20/20、`COMMANDS` 38 行与 `fixtures/contracts/commands.json` 对齐），前端 529/529 未受影响。

## 5. 路由到其他所有者的事项（不在本写作用域）

1. **A-06 契约文本**：`artifacts/30-architecture/contracts.md:79` 的 `toLowerCase` → 建议 r2 明确“逐码点 Unicode 默认小写、无 Final_Sigma、无归一化”并与 `tests/contracts/vectors/search-parity.json` 的 `foldingRule` 对齐；登记 Change Impact。**owner: solution-architect（contract owner）**。实现侧无需改代码。
2. **A-05 只读降级展示与“重建本地数据库”入口**：data-model §4.4 的显式重建动作与 §4.5 的“只读降级提示”需要新的 IPC 面（命令或字段，r2）；本任务已按清单口径 (a) 完成运行时只读降级、记录加载与 `PS_DB_MIGRATION`/`storage_read_only_degrade` 如实记录，UI 展示与重建命令留待架构 r2 裁决。**owner: solution-architect / requirements 协调方**。
3. **A-01 的 `retryTab` 语义**：前端“重试”复用 `entry="restore"`（`use-reader.ts:1555`），因此撤销后的重试会保持不可用而不是重新授权；用户经“重新定位”（`relink_document`，显式选择）或 recents 显式打开即可重新确认。若产品希望“重试即重新确认”，属前端入口语义变更（`entry` 选择），需在后续工作包中处理。评审 §3 A-01 已注明 retryTab 为用户手势、可保留 grant 语义；本任务不扩前端作用域。
4. **A-01/A-02 的外部等价复现（评审 §10.3 第 2 项）**：`/tmp/opencode/review-a-verify` 复跑属 Review A'（不同评审者）的证据集；该 harness 位于工作树外，本任务 guard 禁止写工作树外文件（实测 `BLOCKED: active handoff cannot Write/Edit outside its worktree`），故未重建外部 harness。等价复现已固化在仓库测试中并调用命令真实判定函数（`AuthRegistry::authorize_open_entry`、`commands/tree::read_directory_checked`），可按 §4 精确复跑。

## 6. 残余 UNVERIFIED / 边界

1. **桌面验收未复跑**：评审 §10.3 要求修复后复跑 AT02/AT06/AT25/AT27（真实 WebView/asset scope/焦点）。本轮为 Rust 侧实现与测试证据；桌面项按评审 §4/§5 既有口径仍为 UNVERIFIED，交 Review A'/桌面复跑任务。
2. **外部 harness 未复跑**：见 §5.4（guard 限制）；由 Review A' 执行或按其等价步骤复跑仓库测试。
3. **A-05 展示面**：只读降级状态可经 `Storage::is_read_only()` 读取、诊断日志可查；“提示”的 UI 呈现与重建入口未实现（契约缺口，§5.2）。
4. **A-03 只读降级下的撤销**：只读存储使 `store.delete` 恒失败，按口径 (a) 撤销会被拒绝并保留授权（fail-closed、无复活）；可写恢复后重试可完成。这是口径 (a) 的固有取舍，已在测试中覆盖失败→重试路径。
5. **A-04 命令层分支**：`revoke_session_counts_failed_removals_without_failing` 覆盖 service 层计数；命令层“恒 `Ok`、无 `?` 冒泡”由静态扫描确认，未做 Tauri 命令级注入测试（命令层需 `AppHandle`，超出本任务可测边界）。
6. **A-07 重定向凭据**：重定向目标携带凭据的拒绝为本任务附加的防御深度（清单只点名初始 URL）；已由既有重定向测试保证无回归，无独立用例（未削弱任何测试）。

## 7. 追溯

| 条款 | 本文承接 |
|---|---|
| 评审 A §10.2 A-01…A-08 清单 | §2 逐项修复与测试；§3 复审核对扫描 |
| 评审 A §10.3 修复后最低证据集 | §4（全量 274/274）；§5.4/§6.1（外部 harness 与桌面项路由 Review A'） |
| security-model §2.1/§2.2/§4/§7、T6 | A-01/A-02/A-03/A-04/A-07/A-08 |
| data-model §3.2/§4.4/§4.5/§6 | A-01/A-02/A-05 |
| models §8.2/§10.2、INV-AZ-06/INV-AZ-10 | A-01/A-02 |
| contracts §1.7/§2 行 4/10/27/29、§2.1 | A-01/A-02/A-03/A-04 |
| R06/R07/R25/R26/R27、NF08 | 全部整改 |
| 本报告证据 | `cargo test`：274/274（2026-10-07，修订 `740f7a4` + 本提交）；前端 529/529；契约 44/44 |
