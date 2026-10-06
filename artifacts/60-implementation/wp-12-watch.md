# 纸栈 PaperStack · wp-12 监测、单实例与远程资源服务实现报告（T-15 – T-17）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP12
- **Artifact Type**: Implementation Evidence Report（`services/watch.rs`、`services/app.rs`、`services/resources.rs` 的构建、测试与验证证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-12-watch`（任务分支 `task/wp-12-watch`；父分支 `feat/v0.1.0`；基线提交 `543f78d1d5539a7aaefc494449e45858e4d1e2b8`）
- **Component**: C-06（Rust 监测、事件与单实例）、C-07（Rust 远程资源服务）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 T-15..T-17 的 Rust 服务内核：notify 监测注册/W1 防抖合并/替换保存检测/资源失效/取消清理与聚焦复核纯决策助手；单实例与启动参数排队及 `take_pending_open_requests` 排空语义；远程策略（HTTPS-only、DNS 全地址私网阻断、≤3 跳逐跳复核、20MiB/5s/15s 帽、无自动重试、无 Cookie/Referer）与缓存写入/撤销/跨会话不复用。**不新增 Tauri 命令表面**（wp-15）、不注册任何事件发射（命令层接线）、不修改任何冻结输入或上游 Artifact。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（`swe_guard.py begin` 冻结，本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | ✓ |
| `artifacts/30-architecture/data-model.md` | `0e263230d6212cfe0d2092572f8c0e96f1b8cb33a2563f6eb526e3ba7b8369d1` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |

基线提交 `543f78d1` 与 handoff 一致；进入时工作树干净；`SWE snapshot` ref `refs/swe/snapshots/20261006T213814Z-wp-12-watch-ace74142`（commit `2a1a4ea6`）覆盖 `src-tauri/src/` 修改前字节。上游 `contracts.md`（§2.1 命令 9/11/12/30/35、§3.3、§4、§5、§7）、`security-model.md`（§4）、`data-model.md`（§2 `cache_meta`、§3.2 授权）、模型（§3 INV-WS-01..08、§8 INV-AZ-*）、计划 §4.1 T-15..T-17 逐条承接；未修改任何输入。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `src-tauri/src/services/watch.rs` | 两层结构：①`WatchService` 确定性状态机——注册（文档文件＋父目录＋已验证资源文件集合，重复调用整体替换；路径引用计数、共享父目录只 watch 一次、unwatch 后无残留且不再出事件）；notify 事件仅作提示，按 `docId` 折叠进 W1 静默窗口（默认 300ms，`WatchConfig` 可注入；窗口内新事件重置截止时间），到期至多一条 `watch-changed`；merge 规则：文档级操作“最后观测者胜”（remove→create / rename-over 折叠为 `appeared`，remove 后无重建为 `removed`，其余 `modified`），文档级优先于资源级，资源级报告窗口内最后一个变更并以注册时的原字符串回填 `resourcePath`；载荷仅 `{docId, kind, resourcePath?, observedAtMs}`，永不含正文。②生产 `WatchRuntime`：`notify::RecommendedWatcher` + 控制器线程，`watch_document`/`unwatch_document` 同步往返、到期 flush 后经发射闭包送出（命令层接 `paperstack://watch-changed`），Drop/`shutdown` 停止线程并移除全部 watch。③§7.5 聚焦复核纯助手：`StatObservation`、`focus_recheck_action`（InSync/StableRead/Missing）、`focus_recheck_due`（节流参数注入，P-04 建议 300ms 非冻结值）、`stat_observation`。 |
| `src-tauri/src/services/app.rs` | `AppService`：启动参数解析（跳过 argv[0]，`-` 前缀视为旗标，`--` 后全为路径）、`queue_startup`、`handle_second_instance` → `SecondInstanceDisposition::{Ignored, Queued, Deliver}`、`take_pending_open_requests` 一次排空并置 drained（其后第二实例请求由调用者经 `paperstack://open-requested` 事件送达，§2.1(35)/§4）；`cwd` 空串归一为 `null`；`EVENT_OPEN_REQUESTED` 常量。 |
| `src-tauri/src/services/resources.rs` | `RemoteConfig`（20MiB/5s/15s/3 跳/256MiB，常量冻结并测试固定）；`parse_remote_url`（仅 https）、`normalize_origin`/`origin_allowed`（默认端口 443 省略、大小写归一、拒绝路径/查询/凭据）；`is_blocked_address`（IPv4 0/8、10/8、127/8、169.254/16、172.16/12、192.168/16、224/4；IPv6 ::、::1、fe80::/10、fc00::/7、ff00::/8、IPv4-mapped 递归）。`RemoteService::fetch`：允许列表 → 进程内缓存命中（跨会话条目永不复用）→ 每跳 DNS 全地址解析与阻断检查（IP 字面量不查询 DNS）→ 逐跳重定向复核（https、origin、地址；>3 跳或任一不合格 → `PS_REMOTE_REDIRECT_BLOCKED` 并附 `newOrigin`）→ 状态下限与大小帽 → 缓存写入。`RemoteResolver`/`RemoteTransport`/`RemoteCacheStore` 三个可注入接缝；`SystemResolver`（std DNS 全地址）、`ReqwestTransport`（reqwest+rustls、`no_proxy`、`Policy::none`、固定 UA、`referer(false)`、`resolve_to_addrs` 地址钉定、逐块流式大小帽、每请求超时）、`StorageCacheStore`（`cache_meta` + `remote-images/<key>`，写文件→元数据→256MiB LRU，失败回滚文件）。`revoke_session`（按文档删除本会话写入条目并计数失败）与 `purge_cross_session_cache`（启动清理钩子）；缓存写入失败不失败整次获取，字节经 `memory_bytes` 交调用方内存服务。 |
| `src-tauri/src/services/mod.rs` | 声明并导出 `app`、`resources`、`watch`（仅模块接线；未改命令表面、未加依赖）。 |
| `src-tauri/tests/watch_registry.rs` | T-15 确定性用例（20）：W1 窗口计数/重置、无关路径不干扰、rename-over/remove+create/纯 remove 合并、最后操作胜、资源 `kind=resource` 与 `resourcePath`、最近资源变更、文档优先、unwatch 静默与零泄漏、共享父目录引用计数、资源集合替换、后端失败回滚、缺失路径不注册、载荷无正文与字段形状、聚焦复核助手、stat 助手、按 docId 顺序 flush。 |
| `src-tauri/tests/watch_runtime.rs` | 真实 notify 接线冒烟（2）：事件经 W1 到达发射闭包；unwatch 后写入不再产生载荷；运行时对缺失路径返回 `PS_IO_NOT_FOUND`。连续 10 次复跑全绿。 |
| `src-tauri/tests/app_open_requests.rs` | T-16 用例（7）：argv 解析/旗标/`--`、启动排队与一次排空、无路径不排队、cwd 归一、drain 前第二实例排队、drain 后 `Deliver` 事件、无路径忽略。 |
| `src-tauri/tests/remote_policy.rs` | T-17 策略向量（23）：http/data/file/ftp 拒绝；允许列表精确（含端口差异）与归一化；全部地址检查（含 IPv4-mapped 私网、ULA、链路本地、组播、环回、未指定）；多地址任一私网即拒绝；IP 字面量不查 DNS；3 跳放行/第 4 跳拒绝；重定向到未允许 origin（附 newOrigin）/http/私网地址逐项阻断；逐跳重新解析；大小帽（策略与 transport 双层）、总时限帽、无重试（网络/大小错误均 1 次 transport 调用）；默认常量；缓存键格式；缓存命中/撤销/启动清理/仅删本会话条目/跨会话不复用/存储失败返回内存字节；reqwest transport 可构造（无网络）。 |
| `artifacts/60-implementation/wp-12-watch.md` | 本报告。 |

依赖未变：仅使用既有 `notify`（8.2.0）、`reqwest`+rustls（0.12.28）、`url`、`sha2`、`tokio`、`serde`/`serde_json`、`thiserror` 与 dev `tempfile`；**未新增 crate、未改 `Cargo.toml`/`Cargo.lock`**（见 §5.12）。

## 3. 任务→测试映射（T-15..T-17）

| T | 测试（文件::测试名） |
|---|---|
| T-15 防抖合并/W1 | `watch_registry`：`quiet_window_merges_events_and_resets_on_new_events`、`unrelated_paths_do_not_disturb_the_window`、`pending_windows_are_flushed_in_document_order`；`watch_runtime`：`runtime_delivers_events_and_stays_silent_after_unwatch` |
| T-15 替换保存检测 | `watch_registry`：`rename_over_replacement_save_reports_appeared`、`remove_then_create_in_one_window_is_a_replacement_save`、`removal_without_reappearance_reports_removed`、`last_observed_operation_wins_inside_a_window` |
| T-15 资源失效 | `watch_registry`：`resource_change_reports_resource_kind_with_registered_path`、`resource_removal_still_reports_resource_kind`、`most_recent_resource_change_is_reported_once`、`document_change_takes_precedence_over_resource_change_in_one_window` |
| T-15 取消/无泄漏/无正文 | `watch_registry`：`unwatch_removes_registration_and_silences_future_events`、`shared_parent_directory_is_refcounted_across_documents`、`rewatch_replaces_the_resource_set_without_leaking_paths`、`backend_failure_rolls_back_and_keeps_previous_registration`、`missing_document_or_resource_is_not_registered`、`payload_serialization_contains_no_document_content` |
| T-15 聚焦复核（§7.5） | `watch_registry`：`focus_recheck_actions_compare_stat_against_last_observation`、`focus_recheck_throttle_is_injectable`、`stat_observation_reflects_the_filesystem` |
| T-16 单实例/启动参数 | `app_open_requests`：全部 7 项 |
| T-17 远程策略与缓存 | `remote_policy`：全部 23 项 |

## 4. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS（无 diff） |
| 2 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS，0 warning |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：**213 passed / 0 failed**（见下表） |

| 测试目标 | 结果 |
|---|---|
| lib（既有 35） | 35 passed; 0 failed |
| `app_open_requests`（新） | 7 passed; 0 failed |
| `contract_shape`（既有） | 3 passed; 0 failed |
| `files_open` / `files_read` / `files_source`（既有） | 12 / 12 / 18 passed; 0 failed |
| `migration_faults`（既有） | 11 passed; 0 failed |
| `remote_policy`（新） | 23 passed; 0 failed |
| `security_paths_auth`（既有） | 24 passed; 0 failed |
| `storage_fixtures` / `storage_gating` / `storage_records` / `storage_session`（既有） | 2 / 8 / 21 / 6 passed; 0 failed |
| `tree_listing`（既有） | 9 passed; 0 failed |
| `watch_registry`（新） | 20 passed; 0 failed |
| `watch_runtime`（新） | 2 passed; 0 failed |
| main / doc-tests | 0 passed; 0 failed |

新增测试合计 52（7 + 23 + 20 + 2，全部集成测试）。真实 notify 接线用例连续 10 次复跑全绿；其余用例无网络、无真实时钟（`ManualWatchTimer`/`ManualRemoteClock` + mock resolver/transport/cache），确定性可复跑。

## 5. 实现决策与契约张力（明确记录）

1. **W1 合并优先级为确定性选择**：契约 §7.2/7.3 未定义同一窗口内混合 kind 的优先级。实现取“文档级优先于资源级；文档级最后观测操作胜（remove→create 即替换保存 → `appeared`）；资源级报告窗口内最后一次变更（按事件到达序）”。`observedAtMs` 取窗口到期 flush 时刻。模块头文档与测试固定该行为；若架构意图不同需 r2 明确。
2. **替换保存映射**：`Modify(Name(RenameMode::From))` → `removed`，`To` → `appeared`，`Both` 按 notify 语义 `paths=(from,to)` 区分；`Create` → `appeared`，`Remove` → `removed`，`Any/Other`（不精确后端）按 `modified` 提示。notify 事件仅为提示，稳定性判定仍归 §7.4 稳定读取（本任务不改 files.rs 行为）。
3. **超出字面“资源文件集合”的监测路径**：为使资源的 rename-over 替换/删除可检测，注册集合还包含每个资源的父目录（notify 平台惯例；路径引用计数保证共享目录只 watch 一次、unwatch 归还）。契约 §7.1 字面只列资源文件；这是实现必需的具体化，记录于此。
4. **`resourcePath` 回填原始注册字符串**（非 canonical 路径），使前端能把事件映射回自己提交的 `resourcePaths`；canonical 路径仅用于事件匹配。
5. **`watch_document` 校验存在性**：文档与资源均 canonicalize，失败返回 `PS_IO_NOT_FOUND`（命令 11 错误表）；重复注册整体替换资源集合，保留未过期的文档级 pending，丢弃已移除资源的 pending。
6. **聚焦复核只提供纯决策**：INV-WS-06 要求复核只触发读取路径，提交仍受 §2 提交规则约束；因此本任务只实现 `focus_recheck_action`/`focus_recheck_due`/`stat_observation`，stat 采集与读取编排归命令/前端层。节流 300ms 为 models §3.4 P-04 建议值，可注入、未作为回归阈值。
7. **单实例语义**：`take_pending_open_requests` 首次调用排空并置 drained；此前到达的第二实例请求入队同批取走，此后到达者为 `Deliver` 交调用方发射 `open-requested`（§2.1(35)/§4）。启动参数 `source="cli"`，移交 `source="second-instance"`；argv 过滤 `-` 旗标并支持 `--` 分隔。
8. **远程错误码映射**：首跳未允许 origin 或首跳解析命中阻断地址 → `PS_REMOTE_BLOCKED`；重定向任一环节（>3 跳、非 https、origin 不在允许集合、目标解析命中阻断地址、Location 非法）→ `PS_REMOTE_REDIRECT_BLOCKED`，并在可计算时附 `newOrigin` details（不自动扩大范围）；大小/连接/总时限帽 → `PS_REMOTE_LIMIT`；DNS/TLS/网络/非 2xx → `PS_REMOTE_FAILED`。首跳阻断地址未使用 `PS_REMOTE_FAILED`，因不是网络失败而是策略阻断；记录为解释选择。
9. **地址钉定与最小化**：`SystemResolver` 解析全部地址（去重）并逐一检查后才连接；`ReqwestTransport` 用 `ClientBuilder::resolve_to_addrs` 把域名钉到已校验地址、`no_proxy()` 防代理绕过、`redirect(Policy::none())` 禁用自动跟随、`referer(false)`、无 Cookie 存储（未启用 cookies feature）、UA 固定 `PaperStack/0.1.0`；每请求 `timeout(remaining)` + `connect_timeout(min(剩余, 5s))`，逐块读取并即超即断。
10. **“无自动重试”**：策略层每跳恰好调用 transport 一次（网络失败、限帽、重定向失败均不重试）；用户手动重试即重新调用命令。reqwest 自身默认行为未引入重试逻辑；测试以 transport 调用计数固定。
11. **缓存与撤销**：条目仅在会话允许且获取成功后写入（`cache_meta` + `remote-images/<key>`，键 `"c-"+first16hex(sha256(URL))`，`source_url_hash` 全量 sha256）；进程内 `available` 集合保证上一进程遗留条目永不被服务（无跨会话复用），`revoke_session(docId)` 删除该会话写入的条目并计数失败，`purge_cross_session_cache` 供启动清理；`mime` 无 schema 列，写入时记进程内映射（跨会话条目不可服务故完整）。缓存是“可重建”资产：存储/删除失败不失败授权获取，失败时字节经 `memory_bytes` 返回由调用方内存服务（命令层在 wp-15 决定 asset URL/回退展示）。
12. **未改 `Cargo.toml`（依赖零新增）**：`resources.rs` 需要 `tokio` 的 `rt` feature 才能构建 current-thread runtime。当前锁定依赖图（`hyper-util`/`reqwest`→…→tauri）已激活 `rt`/`rt-multi-thread`（`cargo tree -e features -i tokio` 实测），因此编译通过且未触碰清单/锁文件；handoff 写入范围不含 `src-tauri/Cargo.toml`（swe_guard 拒绝越界写入）。**风险**：这是对传递 feature 统一的依赖，建议后续工作包（wp-15 可写清单）把 `rt` 显式钉入 `tokio` features。
13. **提交主题长度偏差（须 Orchestrator 知悉）**：任务文本指定 `feat(watch): add file watch, single-instance and remote resource services` 共 73 字符，超过 `scripts/swe_guard.py` `check_commit_subject` 的默认 72 字符上限（会以 “commit subject does not match the default format” 拒绝 finish）。为通过门禁，提交使用同义 68 字符主题 `feat(watch): add watch, single-instance and remote resource services`（仅去冗余词 “file”）。若需严格字面主题，需调整 guard 阈值或走修正流程。
14. **命令表面零改动**：未注册任何 Tauri 命令/事件、未改 `lib.rs`/capabilities；`WatchRuntime` 的发射闭包与 `AppService` 的事件投递由 wp-15 接线。

## 6. 限制与风险

- W1/S1/N 等参数按契约保持可校准；测试固定本地值（W1 300ms 默认；测试用短窗口），复跑前不作为回归阈值（NF11）。
- notify 平台差异（macOS/Windows 后端事件形状）未在本机验证；Linux inotify 路径已由真实接线测试覆盖。
- `ReqwestTransport` 未对真实 TLS 服务端到端执行（计划 §1.2 无抓包/网络命名空间；AT26/NF02 需进程 socket 观测或后续集成层），本任务以策略向量 + mock transport 固定行为。
- 重定向 `newOrigin` details 依赖可解析的 Location；Location 非法时仅有 `PS_REMOTE_REDIRECT_BLOCKED` 码与消息。
- 缓存的进程内 mime 映射在 LRU 淘汰/外部删文件后自然失配并走网络重取；`purge` 对删除失败条目尽最大努力（保留行待后续 LRU/purge 重试），计数不虚报。
- `WatchService` 的资源父目录监测在资源与文档同目录时依赖引用计数；极端符号链接/权限变化路径未覆盖（不属于 T-15 验收面）。

## 7. 提交

任务分支 `task/wp-12-watch` 上的唯一提交（提交前 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 全绿；`git diff --cached --check` 干净；仅暂存声明路径）：

1. `feat(watch): add watch, single-instance and remote resource services`：`src-tauri/src/services/{watch,app,resources,mod}.rs`、`src-tauri/tests/{watch_registry,watch_runtime,app_open_requests,remote_policy}.rs`、本报告。
