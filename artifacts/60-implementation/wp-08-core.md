# 纸栈 PaperStack · wp-08 核心 Rust 模型、错误分类与授权核心实现报告（T-03, T-04, T-05, T-06, T-07）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP08
- **Artifact Type**: Implementation Evidence Report（契约模型 / 错误分类 / 契约 fixtures / 路径授权 / 授权注册表的构建与测试证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-08-core`（任务分支 `task/wp-08-core`；父分支 `feat/v0.1.0`；基线提交 `9b926ef15889e154e6541aff92f929b5c79bc6f7`）
- **Component**: C-02（Rust 模型与错误分类）、C-03（Rust 路径与授权服务）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 T-03..T-07：contracts §3.1–§3.7 全量 serde 模型、32 稳定错误码 `AppError→ErrorPayload`、38 命令契约 fixtures 与 round-trip 测试、security-model §2.2 路径算法、授权注册表（含启动复核与 asset scope 内存记账）。不含 SQLite（wp-11）、文件/目录服务（wp-10）、远程策略（wp-13）、命令表面与真实 Tauri asset scope（wp-15）。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（`swe_guard.py` 在 `begin` 时冻结，本任务只读未改）：

| 输入 | SHA-256（handoff 冻结） | 一致 |
|---|---|---|
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | ✓ |
| `artifacts/30-architecture/data-model.md` | `0e263230d6212cfe0d2092572f8c0e96f1b8cb33a2563f6eb526e3ba7b8369d1` | ✓ |
| `artifacts/30-architecture/adr/ADR-005-authorization-and-resources.md` | `3bf1687f72fdcde6b9e4a1671cc02172a0e287f58653276e56b11889ce1d05ed` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69ca733d802622f7e0e18fb22b113008a646117f09da37de183fb5065c0` | ✓ |

基线提交 `9b926ef` 与 handoff 声明一致；任务分支 `task/wp-08-core`，进入时工作树干净；`SWE snapshot` ref `refs/swe/snapshots/20261006T210038Z-wp-08-core-62a59983`（commit `88e3c92`）覆盖 `src-tauri/src/`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 的改动前字节。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `src-tauri/src/models/mod.rs` | 模块聚合与重导出；`SourceRange`、`TaskToken`（§1.2/§1.6/§6） |
| `src-tauri/src/models/document.rs` | §3.1 文档与版本（含 `SourceInfo`/`SourceWindow`/`SearchSourceRequest`/`SourceSearchResult`） |
| `src-tauri/src/models/directory.rs` | §3.2 目录（`DirectoryNode` 等） |
| `src-tauri/src/models/watch.rs` | §3.3 监测（`WatchRequest`/`WatchKind`/`WatchChangedPayload`） |
| `src-tauri/src/models/storage.rs` | §3.4 存储/记录（`AnchorRecord`/`PositionRecord`/`RecentEntry`/`SessionTab`/`ClearResult` 等） |
| `src-tauri/src/models/settings.rs` | §3.5 设置（`GlobalSettings`/`GlobalSettingsPatch`/`FrozenLimits`/`SettingsBundle`） |
| `src-tauri/src/models/auth.rs` | §3.6 授权与资源（`AccessDecision`/`GrantRecord` 及 grant 请求/远程结果） |
| `src-tauri/src/models/diagnostics.rs` | §3.7 诊断/应用 + 错误载荷（`ErrorPayload`/`DetailValue`/`DiagnosticsBundle`/`AppInfo`/`OpenRequest` 等） |
| `src-tauri/src/error.rs` | `ErrorCode`（32 稳定码全表：code/category/retryable/messageKey/sourceRange 策略）、`AppError`（thiserror）→ `ErrorPayload` |
| `src-tauri/src/services/mod.rs` | services 模块声明（paths、auth） |
| `src-tauri/src/services/paths.rs` | security-model §2.2 固定顺序算法（纯函数 + `PathProbe` 注入） |
| `src-tauri/src/services/auth.rs` | 授权注册表、asset scope 内存记账、启动复核、`GrantPersistence` 持久化钩子 |
| `src-tauri/src/lib.rs` | 声明 `pub mod error; pub mod models; pub mod services;`，保持 `run()` 外壳不变 |
| `fixtures/contracts/commands.json` | 38 命令各一条有效 request+response 样例 |
| `fixtures/contracts/models.json` | 非命令载荷模型样例（`TaskToken`、`WatchChangedPayload`、`DiagnosticsBundle`） |
| `src-tauri/tests/contract_shape.rs` | fixtures 反序列化 + 重新序列化归一化比较；缺必需字段防御性测试 |
| `src-tauri/tests/security_paths_auth.rs` | tempfile 路径安全向量 + 注册表行为（24 个集成测试） |
| `src-tauri/Cargo.toml` / `Cargo.lock` | 新增直接依赖 `hex = "0.4"`（0.4.3，已在 lock 中传递存在；见 §5.6） |
| `artifacts/60-implementation/wp-08-core.md` | 本报告 |

## 3. 计数（实测）

| 指标 | 计数 | 复现命令（`src-tauri/`） |
|---|---|---|
| 契约模型 struct | **68** | `grep -rhoE '^pub struct [A-Za-z0-9_]+' src/models | wc -l` |
| 契约模型 enum | **21** | `grep -rhoE '^pub enum [A-Za-z0-9_]+' src/models | wc -l` |
| 覆盖契约章节 | §3.1–§3.7 全量 + `TaskToken`（§1.6/§6） | 逐节核对（§6 追溯） |
| 稳定错误码 | **32/32** | `ErrorCode::ALL`（`ALL entries: 32`）；`cargo test ... every_message_key_exists_in_the_zh_cn_locale_catalog` |
| messageKey ↔ `src/locales/zh-CN.json` | **32/32 存在且互为全集**（catalog 中 `error.*` 键恰为 32） | 同上单元测试 |
| 命令 fixtures | **38/38**（唯一、按 §2 索引顺序） | `contract_shape::command_fixtures_cover_all_38_commands_in_contract_order` |
| Rust 测试 | **47 passed / 0 failed**（lib 20 + contract_shape 3 + security_paths_auth 24；main/doc 0） | `cargo test --manifest-path src-tauri/Cargo.toml` |

## 4. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cargo fmt --manifest-path src-tauri/Cargo.toml && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS（`FMT OK`，无 diff） |
| 2 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS，无 warning（`Finished dev profile ... 4.25s`） |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：lib `20 passed`、`contract_shape` `3 passed`、`security_paths_auth` `24 passed`、0 failed |
| 4 | `cargo check --manifest-path src-tauri/Cargo.toml --all-targets` | PASS（辅助确认，2.60s） |

测试构成：

- 单元（20）：error.rs 7（32 码唯一/retryable/来源范围策略/messageKey↔catalog/payload 转换/io 映射/Display）；models 5（TaskToken null、SourceRange、DiagnosticsLimits flatten、ErrorPayload details、LegalTextKind snake_case）；paths 6（百分号解码、scheme、词法清理、扩展名大小写、组件级根判定）；auth 2（grantId 形态与确定性、AssetScope 子树撤销）。
- 集成（27）：`contract_shape.rs` 3（38 命令覆盖与 round-trip、模型 fixtures、缺字段拒绝）；`security_paths_auth.rs` 24（路径向量 + 注册表行为，见 §5.2）。

## 5. 实现要点与决策

### 5.1 T-06 路径算法（security-model §2.2 固定顺序）

1. 空串/NUL（原文与百分号解码后）→ `PS_IO_NOT_FOUND`；2. `http/https` → `LocalReadOutcome::Remote`（交 §4 远程策略，不算错误）；其它 scheme（`data:`/`javascript:`/`file:`/`vscode:` 等，RFC 3986 形态判定）→ `PS_RESOURCE_UNSUPPORTED`；3. `%XX` 解码（仅 URL 语义必需，非法序列保留字面、非 UTF-8 结果按步骤 1 拒绝）；4. 基准目录由调用方从 Rust 注册表取得；5. 相对 join + 词法清理（根内 `../` 合法，`/..` 按 POSIX 归 `/`）；6. 目标缺失 → 最近存在祖先 canonicalize 后仍参与授权判定（根内 → `PS_RESOURCE_MISSING`；根外 → `PS_AUTH_OUTSIDE_ROOT`）；7. `canonicalize` 完全解析符号链接，权限/循环映射为 `PS_IO_PERMISSION`/`PS_IO_NOT_FOUND`；8. 组件级匹配（`Path::starts_with`，禁止字符串前缀），file 精确相等、directory 根内；符号链接逃逸因第 7 步自然拒绝；9. 通过后重新 canonicalize 一次；变化则从第 4 步重试一次，仍不稳定 → 拒绝；10. 失败 → `PS_AUTH_OUTSIDE_ROOT`，`rootCandidate`=目标 canonical 父目录（经 `ErrorPayload.details` 传递）。大小写：路径比较敏感，扩展名判断忽略大小写（`has_markdown_extension`，供 wp-10 复用）。

### 5.2 T-07 授权注册表

- `grant_file`（data-model §3.2：file 行固定 `scope=persistent`）、`grant_directory`（session/persistent，持久化升级不产生重复行）、`grant_remote_session`（每文档会话，origins 排序去重）、`revoke`/`revoke_remote_session`、`list`/`get`。
- 幂等：同目标同 scope 重复授权返回既有 `grantId`（contracts §1.7）；重新授权清除“不可用”标记。
- 撤销效果：立即从注册表移除并清空对应 asset scope（file 精确、directory 子树 `revoke_under`）；未知 `grantId` → `PS_IO_NOT_FOUND`（命令 27）。
- 启动复核 `revalidate_startup`：删除全部 session 行；persistent 行逐条复核「存在 + 可读」，失败保留记录并标记不可用，使用时需重新确认；`RevalidationReport` 返回计数明细。
- `authorize_local_read`：用有效授权跑 §2.2 算法，成功后把 canonical 文件写入内存 `AssetScope`；实际 Tauri asset scope 接线归 wp-15。
- 持久化钩子 `GrantPersistence { load_all, upsert, delete }`（trait，未实现 SQLite）；`AuthRegistry::with_persistence` 注入后 grant/revoke 同步落库，失败返回 `PS_DB_FAILURE` 且不产生内存授权。

### 5.3 T-04 错误分类

`ErrorCode` 单表 32 码 + `category`（8 类）+ `retryable`（13 个可手动重试）+ `messageKey` + `source_range_policy`（`Unused`/`Optional`/`Required`，Required=`PS_PARSE_LOCAL`、`PS_LIMIT_MERMAID`），与 contracts §5 表逐条一致；`AppError`（thiserror，`Display` 含稳定码）支持 `with_source/with_source_range/with_details/with_message`，`to_payload()`/`From` 生成 `ErrorPayload`。`details` 使用 `BTreeMap<String, DetailValue>`（string/number/bool 联合），符合“已脱敏、仅白名单键”。

### 5.4 T-03 模型约定

除 `T | null` 显式可空字段（`TaskToken.version`、`SessionSnapshot.activeTabId`、`OpenRequest.cwd`、`AppLegalInfo.sourceEntryUrl`）外，全部 `Option` 字段带 `skip_serializing_if`，缺失即省略；时间 `i64` epoch ms、大小/行号/计数 `u64`；`DiagnosticsLimits` 用 `#[serde(flatten)]` 表达 `FrozenLimits & {...}` 交叉类型。

### 5.5 T-05 fixtures

`fixtures/contracts/commands.json` 38 条（10 条无参命令 request=null；`watch_document` 等 6 条响应 `{}`）；`models.json` 补齐事件/任务令牌/诊断包。测试按命令名映射到 §3 类型做「反序列化→序列化→与 fixture 归一化 JSON 全等」，从而同时钉住 camelCase、枚举拼写（kebab-case 的 `new-version`/`symlink-outside`、snake_case 的 `third_party_notices` 等）与 Option 省略规则；另有缺必需字段必须报错的防御用例。

### 5.6 偏差与决策（相对 pinned 输入的偏离均在此声明）

1. **未新增 `uuid`**：`docId = "d-" + sha256(canonicalPath)[..16]`（data-model §3.1）、`grantId = "g-" + first16hex(sha256(...))`（§3.2）均为确定性哈希标识，无 UUID 调用点；按 handoff“仅在真正需要时加依赖”不加 `uuid`（“never busywork”）。
2. **新增 `hex = "0.4"`（0.4.3）**：sha256 小写 hex 前缀格式化（docId/grantId 形态）直接使用；该版本已在 lock 中传递存在，仅提升为直接依赖，`Cargo.lock` 中 paperstack 依赖列表新增一行 `hex`。
3. **远程 `grantId` 哈希并入 `docId`**：data-model §3.2 公式写作 `sha256(kind | canonicalPath or origins-joined | scope)`，未提 `docId`；远程授权是“按文档会话”，若不并入 `docId`，两个文档授权相同 origins 会得到同一 `grantId`（与 `authorizations.grant_id PRIMARY KEY` 冲突且无法区分会话）。实现为 `sha256("remote|{docId}|{origins-joined}|session")`，确定性、仍不透明；file/directory 严格采用原公式（分隔符 `|`、remote origins 用 `,` 连接并排序去重——公式未规定分隔符，属实现常数）。
4. **TOCTOU“仍不稳定”返回 `PS_IO_CHANGED`**：算法只说“拒绝”；选择“读取期间内容不稳定”码更贴近语义（可能在同一根内两个路径间摆动），未泄露路径信息。
5. **`rootCandidate` 承载位置**：contracts §3.6 的 `AccessDecision.rootCandidate` 是命令层字段；`AppError` 经 `ErrorPayload.details["rootCandidate"]` 携带（step 10），避免在错误分类中新增非契约字段。
6. **`grant_file` 仅 persistent**：data-model §3.2 明确 file 行 `scope='persistent'`；“session vs persistent”行为通过目录与远程授权覆盖（测试 `directory_grant_promotes_session_to_persistent_without_duplicates`、`startup_revalidation_...`）。
7. **`revoke_remote_session` 吞掉持久化删除错误**：命令 29 契约无错误通道且效果是会话级；本地 `revoke` 则传播 `PS_DB_FAILURE`。
8. **`AssetScope` 为内存集合**：算法第 9 步“授予 asset scope”在 wp-08 以内存记账实现（`allow_file`/`revoke_*`），真实 Tauri scope 扩缩归 wp-15（契约 §9 已固定由 Rust 执行）。
9. **提交主题按 guard 限长缩短**：handoff 指定主题 `feat(core): add rust contract models, error taxonomy and authorization core` 长 75 字符；本 handoff 未提供 `commit_policy_path`，`swe_guard.py` 默认提交策略要求主题 ≤72 字符，故采用语义等价的 `feat(core): add rust contract models, error taxonomy and auth core`（66 字符）。如需原始长主题，需 Orchestrator 在 handoff 中提供自定义提交策略。

## 6. 追溯

- T-03：contracts §3.1–§3.7 → `src-tauri/src/models/**`；测试 `contract_shape.rs`、模型单元测试。
- T-04：contracts §5 → `src-tauri/src/error.rs`；32/32 码表与 messageKey↔`src/locales/zh-CN.json` 单元测试。
- T-05：contracts §2 → `fixtures/contracts/**` + `tests/contract_shape.rs`（38/38）。
- T-06：security-model §2.2、ADR-005 §Decision 2、R25/NF03 → `services/paths.rs` + 路径向量测试。
- T-07：data-model §3.2、ADR-005 §Decision 1/5、contracts 24–27 → `services/auth.rs` + 注册表测试。
- 组件：C-02（DoD：全类型 round-trip fixture、32 错误码完整性）、C-03（DoD：tempfile 用例：根内 `../` 合法、根外/符号链接逃逸拒绝、TOCTOU 重检、scheme 处理）。

## 7. 已知限制 / 未验证项（UNVERIFIED）

- 注册表为进程内实现；SQLite repos/迁移（wp-11）、真实 Tauri asset scope 与 38 命令注册（wp-15）、远程策略与缓存计数（wp-13）未实现：`RevokeResult.cancelledRequests/removedCacheEntries` 对本地授权恒为 0，待资源服务接线。
- `has_markdown_extension` 已在 paths 中提供并测试，但文件服务调用与编码矩阵属 wp-10。
- `is_readable` 采用 `File::open` 语义（Linux-first；目录只读打开成功）；权限拒绝用例在 root/无模式强制文件系统上会自动跳过断言（测试内显式前置检查，非静默通过）。
- 契约形状测试当前为 Rust 侧单向（fixture↔Rust）；与 TS 类型（`src/services/types.ts`）的双向断言属 wp-16/L3。
- 未运行真实 Tauri 窗口：本任务不涉及命令/IPC 表面。

## 8. 下一步

交 `quality-reviewer`/门禁独立检查：32 码表与 contracts §5 逐行核对、38 fixtures 与 §2 命令索引核对、路径算法顺序与安全向量（含符号链接/TOCTOU）、注册表幂等与启动复核、`Cargo.toml` 依赖新增最小性；通过后由 `repository-manager` 以 `rm-08` 合并入 `feat/v0.1.0`。
