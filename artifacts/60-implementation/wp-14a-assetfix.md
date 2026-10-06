# 纸栈 PaperStack · wp-14a-assetfix 实现报告（asset 协议运行时 scope）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP14A
- **Artifact Type**: Implementation Evidence Report（asset 协议启用、运行时 scope 扩缩、授权清除运行时效果、单元测试与开发态 CSP 冒烟证据）
- **Status**: VALID
- **Revision**: 3
- **Owner**: implementation-engineer
- **Task**: `wp-14a-assetfix`（任务分支 `task/wp-14a-assetfix`；父分支 `feat/v0.1.0`；Rev 3 基线 `80bcfff61c5b26caa710382bd178f90e515f5d25`，含 Rev 1 `4ba7980`、lockfile 修复 `8415cd7`、Rev 2 `80bcfff`）
- **Component**: C-03（Rust 路径与授权服务，asset scope 授予/撤回、授权清除运行时效果）、C-09（命令表面与能力/CSP）
- **Last Verified**: 2026-10-07
- **Revision History**: Rev 1（`4ba7980`）asset 协议启用 + 运行时 scope 映射；Rev 2（`80bcfff`）`clear_records(["authorizations"])` 运行时撤销；Rev 3（本修订）tokio 直接特性显式锁定（消除对传递 feature 统一的依赖，落实 wp-12 §5.12 记录的风险项）。
- **Scope**: 解除 wp-14 记录的唯一跨范围阻塞（§7 决策 1），按 `security-model.md` §6、§2.2 第 9 步、§3、§4 与 `contracts.md` §2.1/§9 实现：`protocol-asset` feature + `assetProtocol.enable=true`（静态 scope 空）+ 运行时 scope 单一映射点（授予扩、撤销缩、远程缓存文件、会话清理）+ 授权类清除的运行时撤销（R25/R27/IX12）+ tokio 直接依赖特性按真实用法显式化 + 单元测试 + 开发态 CSP 冒烟。不改上游 Artifact/契约，不新增业务功能。
- **Depends On**: `artifacts/30-architecture/security-model.md`（§2.2/§3/§4/§6）、`artifacts/30-architecture/contracts.md`（§2.1 命令 24/25/27/29/30、§9 asset 行）、`artifacts/30-architecture/data-model.md`（§3.2/§7）、`artifacts/60-implementation/wp-14-commands.md`（§7 决策 1、§8 限制）。
- **Downstream**: wp-16 TS 接线后的端到端图片显示；质量审查（STRICT）；集成运行验证（`asset://` URL 真实加载）。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 `swe_guard.py check` 复核一致（本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/60-implementation/wp-14-commands.md` | `0dccf98205e4c8b6cf8ce469f38ef6e20e8a65e0bbdbfecc5df8e68e57c31f9c` | ✓ |

基线：Rev 1 的 `b76541f6`（工作树干净、快照 `refs/swe/snapshots/20261006T221316Z-wp-14a-assetfix-b1a0d257`）；Rev 2 的 `8415cd7ea0c196933931a00cc03368eb555b867c`（含 `4ba7980` 与 Cargo.lock 修复 `8415cd7`；快照 `…222424Z-…2cd84a68`）；Rev 3 的 `80bcfff61c5b26caa710382bd178f90e515f5d25`（快照 `refs/swe/snapshots/20261006T222837Z-wp-14a-assetfix-e4ab385c`）。Rev 3 只改 `src-tauri/Cargo.toml` 与 `artifacts/60-implementation/`；`Cargo.lock` 无变化（见 §3.2）。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `src-tauri/Cargo.toml`（改） | Rev 1：`tauri = { version = "2", features = ["protocol-asset"] }`；与 `assetProtocol.enable=true` 成对，满足 `tauri-build` 的 feature 校验（wp-14 §7 决策 1 的一行改动）。Rev 3：`tokio = { version = "1", features = ["rt"] }`（唯一直接调用的 `runtime` API；§3.2）。 |
| `src-tauri/tauri.conf.json`（改） | `app.security.assetProtocol = { "enable": true, "scope": [] }`（静态 scope 为空）；生产 `csp` 与 `devCsp` 逐字保持 wp-14 版本，未放宽。 |
| `src-tauri/src/services/asset_scope.rs`（新） | 运行时 scope 单一映射点：`AssetScopeBackend` trait（allow/forbid × file/directory(recursive)）+ `TauriAssetScope`（`AppHandle::asset_protocol_scope()` 生产实现）+ `AssetScopeController`（`grant`/`revoke` 把 `GrantRecord` 映射为精确文件或子树操作；`allow_file`/`revoke_file` 映射无 grant 记录的精确文件）。11 个确定性单元测试（记录型 backend，可注入 forbid 失败，断言调用序列）。 |
| `src-tauri/src/services/auth.rs`（改） | Rev 1：新增 `runtime_scope: Option<AssetScopeController>` 与 `set_runtime_scope`；`grant_file`/`grant_directory`（含幂等重授与 session→persistent 升级路径）、`grant_*_session` 降级路径、`authorize_local_read` 成功路径（§2.2 第 9 步）扩 scope；`revoke` 与 `revalidate_startup` 的 session 清除缩 scope；`RevalidationReport` 新增 `scope_revoke_failures`。Rev 2：新增 `revoke_all_for_clear()` 与 `ClearRevocationOutcome`/`ClearRevokeItem`/`ClearRevokeStatus`——授权类清除的运行时撤销入口（见 §3.1）。 |
| `src-tauri/src/services/resources.rs`（改） | `RemoteService::session_cache_paths(doc_id, cache_dir)`：回传文档会话当前归属的绝对缓存路径（须在 `revoke_session` 前读取，因为后者清除簿记）。 |
| `src-tauri/src/state.rs`（改） | `AppState.asset_scope`（共享 controller）；启动顺序：`load_grants` → `revalidate_startup`（静态 scope 初始为空，会话清除无运行时缩容对象）→ 之后挂接 `TauriAssetScope`，避免把上进程的 session 记录误加入本进程 forbidden 集。 |
| `src-tauri/src/commands/{files,tree,auth,resources}.rs`（改） | Rev 1：授权落点：session 降级授权现返回 `Result`，失败记诊断不失败打开/目录操作；命令 29 在缓存删除成功后仅对**仍存在**的缓存文件 `revoke_file`；命令 30 在生成 URL 前对缓存文件 `allow_file`。Rev 2：把命令 29 的远程缓存清理抽取为共享 `revoke_remote_cache(state, doc_id)`（命令 29 与授权清除共用）。 |
| `src-tauri/src/commands/storage.rs`（改） | Rev 2：`clear_records` 在数据库删除成功的 `authorizations` 类别上调用 `apply_authorization_clear`：注册表 `revoke_all_for_clear()` → 逐条 scope forbid → 逐远程文档清理缓存并 forbid 残留文件（R26）；逐条 scope 失败上浮为类别错误，`cleared` 计数保留；结构化日志 `authorizations_cleared`。 |
| `src-tauri/src/commands/mod.rs`、`services/mod.rs`（改） | 更新 `asset_url` 注释（阻塞已解除）；声明 `asset_scope` 模块。 |
| `artifacts/60-implementation/evidence/wp-14a-dev-smoke-app-window.png`、`…-window-frame.png` | 开发态冒烟截图（应用窗口与含标题栏窗口）。 |
| `artifacts/60-implementation/wp-14a-assetfix.md` | 本报告。 |

## 3. 映射与调用序列（安全模型依据）

| 事件 | 映射（`AssetScopeController`） | 依据 |
|---|---|---|
| file 授权（持久/会话/重授/升级后新记录） | `allow_file(canonical)` | security-model §6“scope 只能由 Rust 在 §2 校验后运行时扩缩”；contracts §9 |
| directory 授权 | `allow_directory(root, recursive=true)` | §2.1 目录根授权 |
| `authorize_local_read` 成功 | 重做 `allow_file(canonical)`（第 9 步：稳定 canonical 结果才授权） | §2.2 第 9 步 |
| 拒绝/缺失/越界决策 | **不**扩 scope | §2.2 第 10 步；R25 |
| `revoke_grant` | `forbid_file` / `forbid_directory(root, true)` | §3“撤销：停止新读取并移除 asset scope”；AT25 |
| `revalidate_startup` 移除 session 记录 | `forbid_*`（生产启动序先于挂接，不误缩容） | data-model §3.2 |
| `revoke_remote_session` | 删除失败的缓存文件另加 `forbid_file`（删除成功的文件无字节可服务，不加入 forbidden） | §4“撤销会话授权即删除对应条目与文件”；R26 |
| `fetch_remote_image` 成功写缓存 | `allow_file(cache_path)` 后才生成 URL | §4/§6 |

所有操作集中在 `services/asset_scope.rs`：新增授权路径只需调用 controller，不会散落 `asset_protocol_scope()` 调用（生产 crate 内该类调用仅此一模块，可用静态检索复核）。

### 3.1 授权类清除的运行时效果（Rev 2；contracts §2.1、IX12、R25/R27）

```text
clear_records(["authorizations"], confirm=true):
  1. Storage::clear_records 在自身事务中删除 authorizations 行（现状不变）。
  2. 仅当该类别删除成功（error=null）：
     AuthRegistry::revoke_all_for_clear()
       ├─ 内存 grants 全部移出（session 与 persistent 一视同仁）
       ├─ 内存 AssetScope 逐条 drop_scope_for
       ├─ 运行时 scope 逐条 forbid（file 精确 / directory 递归）
       └─ 返回逐条 ClearRevokeItem{status=Revoked|ScopeFailed} + remoteDocIds（去重）
  3. 每个 remoteDocIds → revoke_remote_cache：删除该文档会话缓存；删除失败（文件仍存在）的 forbid（R26）。
  4. 任一 scope/缓存清理失败 → 该类别 ClearResult.error=PS_INTERNAL（cleared 计数保留），日志 authorizations_cleared。
```

- **不做自动重授**：清除后没有任何路径被重新加入 grants；后续读取需要新的显式授权（data-model §3.2“不得从最近列表自动重新授予”）。单元测试断言清除后 `authorize_local_read` 返回 `PS_AUTH_OUTSIDE_ROOT`、`active_origins` 为空、零新 allow 调用。
- **存储失败不假装清除**：数据库删除失败（或降级存储）时不动内存注册表，避免内存已清除而数据库行在下次启动“复活”（AT27）。
- **逐条结果**：`revoke_all_for_clear` 返回 `ClearRevocationOutcome{items, remote_doc_ids}`，`ClearRevokeStatus::ScopeFailed` 精确标记哪条 grant 的 scope 缩容失败（实际仅 glob 编译失败可触发，逃逸后的 canonical 路径不会失败）。

### 3.2 tokio 直接依赖特性显式锁定（Rev 3；落实 wp-12 §5.12 风险项）

**背景（此前记录的偏差）**：wp-12 §5.12 记录 `services/resources.rs` 的 `ReqwestTransport` 构建 current-thread runtime 需要 tokio `rt`，当时依赖 `hyper-util`/`reqwest`/tauri 链上传递激活的 `rt`/`rt-multi-thread` 特性合并通过编译，并建议“在可写清单的工作包把 `rt` 显式钉入 tokio features”；wp-12 门禁亦记录该项待依赖冻结时处理。wp-07 §7.4 当时保留的 `sync`+`time` 是前瞻性声明，非实际调用。

**实际用法核查（Rev 3 实测）**：`grep -rn "tokio" src-tauri/src src-tauri/tests` 仅命中 `services/resources.rs` 的 `tokio::runtime::Runtime`/`Builder::new_current_thread`；无 `tokio::sync`、`tokio::time`、`tokio::select!`、`#[tokio::test]`、`#[tokio::main]` 调用。

| | 特性声明 | 理由 |
|---|---|---|
| 变更前（wp-07/wp-08 起） | `["sync", "time"]` | 前瞻性声明（防抖/同步原语），但核心代码直接使用的 `rt` 反而未声明，依赖传递特性合并 |
| 变更后（Rev 3） | `["rt"]` | 唯一被本 crate 直接调用的 tokio API（`runtime::Builder`/`Runtime`/`block_on`）所需特性；`macros` 未使用故不声明 |

**验证**：
- `cargo tree -e features -i tokio` 实测变更前后统一特性集合完全一致（`bytes, default, fs, io-util, libc, mio, net, rt, rt-multi-thread, socket2, sync, time`）——即移除 `sync`/`time` 声明不减少最终构建可用特性（reqwest/tauri 仍需并激活它们），但 paperstack 自身的编译不再依赖该传递合并。
- `cargo metadata` + `git diff src-tauri/Cargo.lock` = **0 行**：Cargo.lock 不记录 features；tokio 本就作为 paperstack 的直接依赖列在 lock（`dependencies` 数组含 `"tokio"`），新增/调整特性不改变解析图，故本修订无 lock 变更（§7.7）。
- `cargo fmt --check` PASS；`cargo test` 248/248 PASS（§5）。

## 4. 新增与受影响的测试

新增 11 个 lib 单元测试（`services/asset_scope.rs`，确定性：临时目录 fixture + 记录型 backend 断言精确调用序列；8 个 Rev 1 + 3 个 Rev 2）：

| 测试 | 断言 |
|---|---|
| `file_grant_allows_the_exact_path_and_revoke_forbids_it` | file 授权 allow 精确文件；撤销 forbid 同路径 |
| `directory_grant_allows_recursively_and_revoke_forbids_the_subtree` | directory 授权/撤销均 recursive=true |
| `remote_grant_maps_to_no_scope_operation` | 远程 grant 不产生文件 scope 操作 |
| `exact_file_helpers_map_to_allow_and_forbid` | 远程缓存文件辅助函数映射 |
| `denied_decisions_never_expand_the_scope` | 无授权与缺失目标两种拒绝均零 allow |
| `grants_reads_and_revocations_drive_the_scope_in_order` | 注册表授权→读取 allow→撤销 forbid 的完整顺序；内存镜像同步 |
| `session_grants_allow_and_session_cleanup_forbids` | 会话降级授权 allow；`revalidate_startup` 清除会话时 forbid，`scope_revoke_failures=0` |
| `idempotent_regrant_reapplies_the_allow_mapping` | 幂等重授再次 allow（自愈/持久授权载入后重开） |
| `clear_revokes_all_grants_forbids_each_local_path_and_denies_reads`（Rev 2） | 持久目录 + 持久文件 + 会话文件 + 远程 grant 全被撤销；逐条 `Revoked`；每一条本地路径 forbid（目录递归、文件精确）；清除前可读的 `sub/b.md` 清除后被拒（`PS_AUTH_OUTSIDE_ROOT`）；`remote_doc_ids=["d-1"]`；内存 scope 空 |
| `clear_reports_scope_failures_per_item_without_blocking_removal`（Rev 2） | 注入 forbid 失败：逐条 `ScopeFailed`，失败不阻止 grant 撤销（列表与内存 scope 仍清空），失败条数可报告 |
| `clear_reports_remote_documents_and_does_not_re_grant`（Rev 2） | 同一文档多条远程授权去重为 `["d-1","d-2"]`；清除后 `active_origins` 为空、读取被拒、无任何新 allow（不自动重授） |

既有测试未改（`src-tauri/tests/` 不在写范围）；`AuthRegistry::new()` 无 runtime scope，全部既有集成测试行为不变。Rev 2 新增测试均为 `#[cfg(test)]` 模块内单元测试，无真实 app handle、无 sleep、无外部时钟。

## 5. DoD 执行证据（工作目录=项目根，Rev 3 修订上复跑）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS（无 diff） |
| 2 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS，0 warning |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：**248 passed / 0 failed** |
| 4 | `cargo metadata --manifest-path src-tauri/Cargo.toml` + `cargo tree -e features -i tokio` | PASS；解锁无变化，feature `rt` 已由本 crate 直接声明，统一特性集合不变（§3.2） |
| 5 | `cargo build`（Rev 1 经 `pnpm tauri dev` 的 `cargo run`；Rev 2/3 无构建配置或依赖图变化） | PASS，`tauri-build` 接受 `assetProtocol.enable=true` + `protocol-asset` feature |

测试分布（Rev 3 全绿）：lib **51**（40 既有 + 8 Rev 1 + 3 Rev 2）、`commands_surface` 19、`contract_shape` 3、`app_open_requests` 7、`files_open` 12、`files_read` 12、`files_source` 18、`migration_faults` 11、`remote_policy` 23、`security_paths_auth` 24、`storage_fixtures` 2、`storage_gating` 8、`storage_records` 21、`storage_session` 6、`tree_listing` 9、`watch_registry` 20、`watch_runtime` 2、main/doc 0。合计 **248**（Rev 3 无 `src/` 变更，计数与 Rev 2 一致）。

## 6. 开发态 CSP 冒烟（wp-14 §7 决策 10 / §8 风险 4）

**结论：`pnpm tauri dev` 在现有 `devCsp` 下正常渲染，无需放宽 CSP；生产 `csp` 与 `devCsp` 均未改动。**

精确命令（DISPLAY=:1；后台）：

```sh
setsid bash -c 'echo $$ > /tmp/opencode/tauri-dev.pid; exec env DISPLAY=:1 pnpm tauri dev' \
  > /tmp/opencode/tauri-dev.log 2>&1 < /dev/null &
# 轮询：DISPLAY=:1 xwininfo -root -tree | grep "纸栈 PaperStack"        → 30s 内出现
# 窗口：0x2200003 "纸栈 PaperStack"（wm class paperstack/Paperstack）1280x800；外框 0x600a79
DISPLAY=:1 xwd -id 0x2200003 -silent | ffmpeg -y -i - artifacts/60-implementation/evidence/wp-14a-dev-smoke-app-window.png
DISPLAY=:1 xwd -root -silent        | ffmpeg -y -i - /tmp/opencode/smoke/root.png
kill -TERM -- -$(cat /tmp/opencode/tauri-dev.pid)   # 结束进程组；复核端口 1420 释放、无残留进程
```

观测：

- Vite 8.3.3 dev server ready（246ms）；`cargo run` 24s 后启动；窗口标题“纸栈 PaperStack”。
- 应用窗口截图显示 React 占位壳 `<h1>纸栈 PaperStack</h1>` 已渲染（见 §2 两张证据图），说明 `script-src 'self'` 未阻断 Vite/React 模块加载；`style-src`、`img-src` 未受影响。
- `ss -tnp` 实测 WebKit 网络进程到 `127.0.0.1:1420` 的 ESTAB 连接（`ws://localhost:1420` HMR 通道在 `devCsp.connect-src` 白名单内），HMR 通道可用。
- 应用启动日志（真实数据目录 `~/.local/share/com.quirkybrain.paperstack/logs/paperstack.log`）无错误：`startup version="0.1.0"`、`startup_revalidation sessionRemoved=0 persistentChecked=0 persistentUnavailable=0`。

**UNVERIFIED（诚实记录）**：`asset://localhost/...` URL 的真实字节加载未在本任务观察——占位前端（wp-07 壳）不调用命令 24/30，无可用 WebDriver（ADR-010）；运行时 scope 的 WebView 侧行为留待 wp-16 接线后的集成验证（现场已验证：feature + 空静态 scope 可编译启动、窗口正常、映射有确定性单元测试）。

## 7. 已知限制与风险（明确记录）

1. **`src-tauri/Cargo.lock` 范围缺陷（已解决）**：Rev 1 启用 `protocol-asset` 后 Cargo 解析新增 `http-range v0.1.5`；当时 handoff 未包含该文件，`finish` 以“actual change outside declared output: src-tauri/Cargo.lock”阻塞并如实上报。协调方随后以 `8415cd7`（`build(deps): lock http-range for protocol-asset feature`）机械提交该 lockfile 修复；本修订不再改动 `Cargo.lock`。修订 `8415cd7` 起 `cargo build --locked` 可用。
2. **Tauri forbidden 集在进程内不可逆**（tauri 2.12.1 `scope::fs::Scope` 只提供 `forbid_*`，无移除 API，`is_allowed` 先查 forbidden）：撤销后的路径在本进程内不可再服务。因此“撤销后再重新确认/重新打开同一路径”时，`read_document` 等读取正常，但该路径的 asset 图片会保持不可加载直到重启。需求侧（IXD §12.2“下一次需要时重新确认”）在 v0.1.0 下据此受限；若必须同进程内可逆，需要自定义 URI scheme 处理器或上游 Tauri API 支持，属架构级变更（建议 ADR/后续工作包裁决）。本实现选择安全优先（撤销必须立即停止服务，AT25）。授权类清除（§3.1）同样受此约束。
3. **远程缓存撤销条件性 forbid**：删除成功的缓存文件不加入 forbidden（文件已不存在，无法服务，避免不必要的进程级不可逆封锁）；仅删除失败（文件仍存在）的文件 forbid（fail-closed，旧 URL 不得提供已撤销字节）。命令层条件分支无 WebView 级测试，逻辑由 `session_cache_paths` + `revoke_file` 单元映射与代码复核覆盖；授权类清除复用同一 `revoke_remote_cache` 实现。
4. **授权类清除的存储降级路径**：仅当数据库删除成功（`error=null`）才执行运行时撤销，避免“内存已清除、数据库行下次启动复活”（AT27）；存储降级时该类别返回 `PS_STORAGE_UNAVAILABLE` 且不改内存注册表。命令级 `apply_authorization_clear` 分支由注册表/共享缓存的单元测试与代码复核覆盖，WebView 级调用留待 wp-16 接线验证。
5. 启动序列的会话清除发生在运行时 scope 挂接之前：静态 scope 为空，无对象可缩容；若未来在进程中途运行 `revalidate_startup`，映射会正确 forbid 被移除的 session 记录（有单元测试），但同样受限制 2 的不可逆性约束。
6. `scope_revoke_failures` 仅在 `revalidate_startup` 报告；`revoke` 的 scope 失败以错误返回（命令 27 reject），此时注册表/存储已完成撤销，调用方按失败重试语义处理（实际仅 glob 编译失败才可能触发，逃逸后的 canonical 路径不会失败）。
7. **tokio 特性显式化不产生 Cargo.lock 变更（Rev 3）**：本 handoff 的 `commit_paths` 含 `src-tauri/Cargo.lock`，但依赖特性不进入锁文件——`tokio` 自 wp-07 起就是 paperstack 的直接依赖并列入 lock 的 `dependencies`，`["sync","time"] → ["rt"]` 只改 Cargo.toml 声明，`cargo metadata` 后 lock 零 diff（实测）。因此本修订提交只改 `src-tauri/Cargo.toml` 与报告；若门禁要求 `Cargo.lock` 出现真实变更，只能是依赖图变化（版本更新或新增包），那不属于“特性锁定”任务。

## 8. 追溯

| 条款 | 本承接 |
|---|---|
| R25/AT25 | §2 静态 scope 空 + 仅 Rust 授权后扩 scope；撤销即缩（forbidden 优先） |
| R07 | `revoke_grant` 后 `has_local_access` 失败（既有）+ scope 移除（本任务） |
| R26 | 远程缓存文件 allow/revoke；删除失败 fail-closed |
| R09/NF03 | scope 仅由受信 Rust 代码操作；前端不得自造 URL（`asset_url` 仅 Rust） |
| security-model §2.2 第 9 步、§3、§4、§6 | 本报告 §2/§3 |
| contracts §2.1 命令 24/27/29/30、§9 asset 行 | 命令层调用序列 |
| R27/IX12；contracts §2.1 命令 20 | 授权类清除的运行时撤销与远程缓存清理（§3.1、§4 三个 Rev 2 测试） |
| wp-14 §7 决策 1（阻塞解除）、§8 风险 4（devCsp） | §5、§6 证据 |

## 9. 提交

任务分支 `task/wp-14a-assetfix` 上的提交（每次提交前三条 DoD 命令全绿；`git diff --cached --check` 干净；仅暂存声明路径）：

1. Rev 1 — `4ba7980` `fix(security): enable runtime-scoped asset protocol`：协议启用、运行时 scope 映射、命令接线、8 个单元测试、证据图、本报告 Rev 1（`src-tauri/Cargo.toml`、`src-tauri/src/`、`src-tauri/tauri.conf.json`、`artifacts/60-implementation/`）。
2. `8415cd7` `build(deps): lock http-range for protocol-asset feature`：Cargo.lock 修复（协调方机械提交，非本 Agent 产出；见 §7 限制 1）。
3. Rev 2 — `fix(auth): apply authorization clear to registry and asset scope`：`revoke_all_for_clear` + 授权清除接线 + 共享 `revoke_remote_cache` + 3 个单元测试 + 本报告 Rev 2（`src-tauri/src/`、`artifacts/60-implementation/`；`Cargo.lock` 未再改动）。
4. Rev 3 — `build(deps): pin tokio features explicitly`：tokio 直接特性 `["sync","time"] → ["rt"]`（§3.2）；仅 `src-tauri/Cargo.toml` 与本报告 Rev 3；`Cargo.lock` 零 diff（§7.7）。
