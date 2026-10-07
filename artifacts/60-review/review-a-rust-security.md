# 纸栈 PaperStack · 独立评审 A（Rust 服务与安全核心）

- **Producer**: agent:quality-reviewer
- **Artifact ID**: ART-60-REVIEW-A
- **Artifact Type**: Independent Review Report（T-64；Rust 服务、路径/授权/资源策略、只读保证、诊断脱敏、命令表面与能力、存储门禁、监测、错误分类、测试质量）
- **Status**: VALID
- **Revision**: 2
- **Owner**: quality-reviewer
- **Task**: `wp-35-review-a`（任务分支 `task/wp-35-review-a`；父分支 `feat/v0.1.0`；基线/评审修订 `aac72e1ef676965bfa743597c1f0820e8e3efed8`；快照覆盖 `src-tauri/src/`、`src-tauri/tests/`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/`）
- **Last Verified**: 2026-10-07
- **Review base**: `aac72e1`（HEAD，工作树评审前/后 `git status --porcelain` 为空；只读评审，未修改任何 `src/`、`src-tauri/`、tests 或框架文件；本报告为唯一写入）
- **Scope**: 计划 §6.1 评审 A 清单的 Rust 侧全部（评审目标为上述快照路径）；判定仅对本修订有效。
- **Verdict**: **FAIL**（1 blocker + 1 major + 6 minor；详见 §2、§5）。授权算法本身、只读保证、诊断脱敏、能力/CSP、存储门禁、监测与错误分类的证据总体很强；失败集中在“撤销/清除授权的运行时语义”两处。Rev 2 仅新增可执行验证附录（§9），未改变任何判定。

**Pinned inputs（SHA-256 于 2026-10-07 实测复核，全部一致）**

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/security-model.md` | `a0e892ea…3f47f74` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…c3ac88a` | ✓ |
| `artifacts/30-architecture/data-model.md` | `0e263230…b8369d1` | ✓ |
| `artifacts/20-requirements/requirements-baseline.md` | `42784f67…5e35b85d` | ✓ |
| `artifacts/70-verification/unit-integration-report.md` | `a4c90529…157d261` | ✓ |
| `artifacts/70-verification/acceptance-at.md` | `e9fc554b…fb1cd7e2` | ✓ |

---

## 1. 方法与证据

1. **修订与范围固定**：`git rev-parse HEAD` = `aac72e1`，与 handoff `base_commit`/`parent_commit` 一致；评审前工作树干净，评审期间只运行只读命令与既有测试。
2. **规范逐条核对**：`security-model.md` §2–§8、`contracts.md` §1–§9、`data-model.md` §2–§7、`requirements-baseline.md` R01–R30/NF01–NF12，与 Rust 实现逐条对照；同时参考 `artifacts/35-models/session-and-version-models.md` §8–§10、`artifacts/30-architecture/architecture.md` §5.8 与已记录的实现报告（`wp-10-files.md`、`wp-14-commands.md`、`wp-14a-assetfix.md`）。
3. **全量静态阅读**：`src-tauri/src/` 全部 37 个 Rust 文件（含 tests 内联单测）与 `src-tauri/tests/` 18 个集成测试文件；`Cargo.toml`、`tauri.conf.json`、`capabilities/default.json`；前端仅为验证命令语义读取（`src/services/`、`src/features/reader/{use-reader.ts,ReaderScreen.tsx}`），不构成前端评审（属 Review B）。
4. **本修订测试复跑（只读）**：`cargo test --manifest-path src-tauri/Cargo.toml --offline` → **21 个套件 261 passed / 0 failed**（lib 55、commands_surface 20、contract_search_parity 5、contract_shape 3、files_open 13、files_read 12、files_source 18、migration_faults 11、nf07_soak 1、remote_policy 24、security_paths_auth 24、storage_fixtures 2、storage_gating 8、storage_records 21、storage_session 6、tree_listing 9、watch_registry 20、watch_runtime 2、app_open_requests 7）。与 wp-32 报告（254）相比为同一代码修订上的新增测试与计数增长，无失败、无 `ignore`。
5. **对抗性验证（尝试证伪的安全声明）**：对 §2 算法依次构造了百分号编码 scheme/`%00`、根内 `..`、符号链接逃逸、大小写、绝对路径、缺失目标、目录前缀字符串比较、授权根替换（TOCTOU）等用例，逐条走查代码与既有向量；对远程策略构造 http/userinfo/重定向到未允许域/重定向降级 http/私网与 IPv4-mapped/字面 IP/大小与超时/缓存跨会话复用等用例。除 §2 列出的发现外未发现可绕过的直通路径；不可执行部分列入 §4。
6. **边界声明**：本评审不修改代码，不修复；所有发现只给出方向，修复后须新提交并重跑受影响测试与复审。

---

## 2. 逐区域判定（对照计划 §6.1）

| # | 区域 | 判定 | 关键证据 |
|---|---|---|---|
| 1 | 路径授权与资源策略（`paths.rs`/`auth.rs`/`resources.rs`） | **FAIL** | §2.2 算法顺序、canonicalize/组件匹配、TOCTOU 复检、符号链接逃逸、grant/revoke/启动复核、远程策略矩阵全部核对通过；但撤销语义有 **A-01（blocker）**、**A-02（major）**，另有 A-03/A-07（minor）。见 §3.1–§3.3 |
| 2 | 只读保证 R04/NF01 | **PASS** | `files.rs` 仅 `File::open`/`metadata`/`canonicalize`，无写 API；`diagnostics` 仅写 app 数据/用户选定导出目标（§7 校验+原子写）；cache 仅写 `<appCacheDir>/remote-images`（`resolve_cache_path` 拒绝 `..`/绝对路径）；storage 仅写 app 数据目录；`known_sources` 仅在内存。既有 `files_open::open_and_read_never_write_to_the_source`、`files_source::source_access_never_writes_to_the_source`、`storage_gating::clear_never_touches_source_files`、AT04 哈希对照均通过 |
| 3 | 诊断与脱敏 | **PASS** | 结构化日志无自由文本 API，`LogField::Path/Url` 生产零调用，`Text` 值仅稳定码/i18n 键；`record_app_error` 不写 details；滚动 10MiB 上限（含单条超限计数与截断标记）；预览字节即导出字节、TTL/8 条上限；导出校验次序与 `protected-source`/`target-exists` 区分（D-34b-3 修复）；`known_sources` 修复错误态源目录保护（`export_protects_error_state_source_directories_too`）；A-08（minor，硬编码白名单仅靠“无人产生非白名单键”维持） |
| 4 | 命令表面与能力 | **PASS** | `command_surface!` 宏为 38/38 注册与 `COMMANDS` 表单一来源（`commands/mod.rs:49-115`），`commands_surface` 以契约独立副本逐行断言；capabilities 仅 `core:default`+close/destroy+clipboard write-text；CSP 与 security-model §6 逐字一致，devCsp 仅多 `ws://localhost:1420`；`lib.rs` 仅注册 dialog/clipboard/opener/single-instance，无 fs/shell/http；asset 静态 scope 为空、仅 Rust 运行时扩缩；A-04（minor） |
| 5 | 存储 | **PASS（附 minor）** | schema v1 与 data-model §2 逐字一致（STRICT、FK、CHECK、索引）；迁移单事务/失败回滚/拒绝降级（`migration_faults` 11 项含损坏/磁盘满/只读挂载/中断）；写入门禁矩阵与 data-model §6 一致（`storage_gating::write_gate_matrix_by_category`）；分类清除逐类计数与抑制（INV-WB-01…09）；授权类清除运行时效果接线（`apply_authorization_clear`，失败不伪装清除）；recents ≤100；positions 锚点往返；A-05（minor，read-only 降级与“重建本地数据库”未接线） |
| 6 | 监测/事件 | **PASS** | 注册=文档+父目录+已验证资源+资源父目录；W1 静默窗合并/重置、替换保存 last-op-wins、文档优先于资源、每 docId 每窗至多一次（`watch_registry` 20 项）；载荷无正文（`payload_serialization_contains_no_document_content`）；unwatch 后静默（`watch_runtime`）；事件名与 payload 字段对照契约 §4/§7；单实例队列一次排空（`app_open_requests` 7 项） |
| 7 | 错误分类 | **PASS** | `ErrorCode::ALL` 32/32 与 contracts §5 顺序一致；category/messageKey/retryable/sourceRange 策略逐条一致（单测+`contract_search_parity` 32/32）；`zh-CN.json` 键与 32 码一一对应（`every_message_key_exists_in_the_zh_cn_locale_catalog`）；`details` 生产键仅 `rootCandidate/scheme/newOrigin/reason`，均在白名单内 |
| 8 | 测试质量（Rust） | **PASS（附缺口）** | 安全向量以临时目录真实路径/字面地址矩阵为 oracle，非实现输出；TOCTOU 用脚本化 probe；契约列表在测试中独立复制；缺口：A-01/A-02 无回归测试（及测试对 A-06 的 oracle 偏移）。详见 §6 |

---

## 3. 发现（findings）

> 严重度定义：**blocker** = 违反 Must 级安全/授权条款且可在真实流程确定性复现，阻断安全核心验收；**major** = 违反规范条款、可在真实流程复现但影响面受限；**minor** = 失败路径/防御深度/契约文本债。所有发现针对修订 `aac72e1`；均未修复。

### A-01（blocker）启动恢复对已撤销/已清除的授权自动重新授予

- **位置**：
  - `src-tauri/src/commands/files.rs:96-160`（`open_one`）——第 117–128 行：无论 `req.entry` 为何值，成功打开后一律 `grant_file`（失败再 `grant_file_session`）；第 86–90 行仅对 `entry != "restore"` 恢复记录写回，却未对授权做任何区分。
  - `src/features/reader/use-reader.ts:1128-1133`——启动恢复对 `listRecents` 中 `available` 的每个已存标签调用 `open_documents({ paths:[canonicalPath], entry:'restore' })`，不检查有效授权。
- **证据/复现**（代码级确定性，真实桌面流程）：
  1. 打开 `/x/a.md`（`open_one` 写入 `kind=file, scope=persistent` 授权与 `documents/recents`）；
  2. 设置 → 隐私 → 持久授权列表 → 撤销该授权（`revoke_grant` 删除注册表行与 DB 行）；
  3. 干净退出（`session_tabs` 仍保存该标签，撤销不影响会话）；
  4. 无参数重启：`load_session` → `listRecents`（`available=true`，因为只检查文件存在/可读）→ `open_documents(entry='restore')` → `open_one` 无条件 `grant_file` → `read_document` 经 `authorize_registered`（`has_local_access` 现为真）读取成功，文档照常显示。
- **违反条款**：
  - `artifacts/35-models/session-and-version-models.md:686` §10.2：“授权已撤销 | 持久授权失效 | **使用时重新确认；不自动授予**”；`:592` INV-AZ-10“最近列表不得作为隐性授权来源；清除授权后不得自动重新授予”；
  - `data-model.md:149` §3.2“清除授权…**不得**从最近列表自动重新授予”；`data-model.md:147` 启动复核失败“使用时重新确认”；
  - `requirements-baseline.md:124` R06 异常：“**已撤销授权必须重新确认**”；
  - `security-model.md:28` T6 控制：“**清除授权不自动恢复**”；
  - `architecture.md:245,247` §5.8：“逐标签恢复：文档存在性 **授权复核** R25”“授权已撤销 → 提示重新确认”。
- **影响**：用户“撤销授权/清除授权”的决定在重启后被静默推翻；`recents/session` 成为隐性授权来源，正是 T6 点名要防的场景。也覆盖 `clear_records(["authorizations"])` 后的同类路径（清除后标签若仍在会话中，重启即自动重授）。
- **建议方向（不实施）**：`entry="restore"` 不得自动授予；恢复前应以注册表（`has_local_access`/`list_grants`）判定，未授权时返回 `PS_AUTH_REVOKED`/不可用态并由 UI 发起显式重新确认（用户手势走 `open_documents(entry='recent'|'dialog')` 或专用确认）。`retryTab`（`use-reader.ts:1546-1571`，用户点击“重试”）属用户手势，可保留 grant 语义；修复需补回归测试并重跑 AT06/AT25/AT27 桌面项。

### A-02（major）目录授权撤销后 `read_directory` 仍可继续扫描

- **位置**：
  - `src-tauri/src/services/tree.rs:113-148`（`read_directory`）——只查进程内 `TreeService.roots` 与 `is_within_root`，**从不查询 `AuthRegistry`**；
  - `src-tauri/src/commands/tree.rs:39-49`——命令层也不做授权复核；
  - `src-tauri/src/commands/auth.rs:227-235`（`revoke_grant`）——仅 `AuthRegistry::revoke`，不清 `TreeService` 根；
  - `src-tauri/src/commands/storage.rs:193-241`（授权类清除运行时效果）——只遍历 `revoke_all_for_clear` + 远程缓存，同样不清树根。
- **证据/复现**（代码级确定性；真实界面同样可达）：
  1. 打开目录 `/docs`（`open_directory` 注册 session 目录授权 + `TreeService` 根）；
  2. 隐私设置中撤销该目录授权（或“清除授权”类别）；
  3. 对保留的 `rootId` 继续调用 `read_directory`（界面侧即展开任一已列出节点）→ 仍返回该目录列表（`tree_listing` 无撤销用例，故既有测试未覆盖）。
- **违反条款**：
  - `security-model.md:42` §2.1 目录读取撤销效果：“**停止新读取/扫描/资源加载**；不清空最近列表”；
  - `artifacts/35-models/session-and-version-models.md:575` §8.2 同款“停止新读取/扫描/资源加载”、`:588` INV-AZ-06“撤销本地授权**立即停止新读取/扫描/资源加载**”；
  - `requirements-baseline.md:290-291` R25：“设置可撤销授权并**停止新读取**”。
- **影响**：撤销后仍可在同进程内枚举目录（文件名/结构泄露），直到重启；`clear_records(["authorizations"])` 同样不生效于该路径。文件内容读取（`read_document`/`check_resource_access`）不受影响（仍正确拒绝），因此影响面限定为目录扫描/结构信息。
- **建议方向（不实施）**：`read_directory` 以根 canonical path 复核注册表（无有效 directory 授权 → `PS_AUTH_REVOKED`），或在 `revoke`/`revoke_all_for_clear` 时同步逐出 `TreeService` 对应根；补“撤销后 read_directory 被拒”的集成测试。

### A-03（minor）`revoke` 在持久化删除失败时跳过 asset scope 缩容，且重试无法完成

- **位置**：`src-tauri/src/services/auth.rs:349-384`。顺序为：从 `grants` 移除 → `store.delete(grant_id)?`（第 360–362 行，失败即早退）→ `drop_scope_for`/`scope.revoke`（第 363–372 行）。
- **证据**：`recording store.delete` 返回 `PS_DB_FAILURE` 时，函数早退，内存 `AssetScope` 与运行时 Tauri scope 均未 forbid；而注册表行已删除，随后重试 `revoke` 返回 `PS_IO_NOT_FOUND`（第 356–358 行），**该进程内没有路径再触发缩容**（forbidden 集不可逆本身不构成问题；此处是 allow 残留）。既有 `persistence_hook_receives_upserts_and_deletes` 未覆盖 delete 失败。
- **违反条款**：`security-model.md:77`“撤销：revoke_grant 停止新读取并**移除 asset scope**”；`contracts.md:60` 命令 27 的撤销语义；注释自称 fail-closed，实际为部分残留。
- **影响**：仅在数据库写失败（磁盘满/损坏）时出现；新读取已由注册表停止（`has_local_access=false`），但**已经发给前端的 asset URL 在进程剩余生命周期内仍可服务**。已如实返回错误，不静默。
- **建议方向**：先做（或始终做）scope 缩容再持久化删除，或删除失败时仍执行缩容并把删除失败作为错误返回。

### A-04（minor）`revoke_remote_session` 在 scope 缩容失败时 reject，与契约“不拒绝”冲突

- **位置**：`src-tauri/src/commands/resources.rs:60-74` 与 `80-100`（`revoke_remote_cache` 中 `state.asset_scope.revoke_file(path)?`）；`contracts.md:62` 命令 29 错误列为“—”，`§1.7` 声明其幂等。
- **证据**：`AssetScopeController::revoke_file` 依赖 Tauri scope `forbid_file`，失败即 `PS_INTERNAL` 冒泡为命令 reject；此时注册表已撤销、缓存清理计数丢失。
- **影响**：仅在运行时 scope 操作失败（glob 编译失败类）时发生；fail-closed 方向正确，但契约文本为“永不 reject”。建议把 scope 失败降级为 `RevokeResult` 内可报告量或按契约修订明确。

### A-05（minor）NF08：只读降级未接线，“重建本地数据库”动作缺失

- **位置**：`src-tauri/src/services/storage.rs:408-418`（`open_read_only_path` 仅为测试调用，生产零调用点）；`src-tauri/src/state.rs:105-118`（`Storage::open` 失败即 `storage=None` 内存降级）。
- **证据**：`grep open_read_only_path src-tauri/src` 仅定义处；`AppState::create` 不尝试只读打开，也不记录/展示“只读降级”状态；`contracts.md` 38 条命令中没有任何“重建本地数据库”入口。
- **违反条款**：`data-model.md:184` §4.4（隐私页**显式**“重建本地数据库”动作）、`:185` §4.5（高于支持修订 → “拒绝写入、**只读降级提示**”）；NF08“不能静默清空记录掩盖问题”。
- **影响**：数据库不可写/版本更高时，用户得到的是内存降级（设置默认、记录不可读）而非可读的只读降级；“重建”入口在当前契约下无法实现（上游契约缺口）。文件原样保留、错误如实上报，无数据破坏。建议由架构侧裁决：补 r2 命令或明确降级口径。

### A-06（minor）搜索折叠：契约文本为 `toLowerCase`，实现（双方）为逐码点折叠

- **位置**：`src-tauri/src/services/files.rs:492-517`（`fold_segment`/`fold_query` 逐 `char::to_lowercase`）；前端 `src/features/search/search-core.ts:83-93`（wp-32a 改为逐码点 `foldLower` 以对齐 Rust）；`contracts.md:79`“按与前端一致的 `toLowerCase` 折叠”；`tests/contracts/vectors/search-parity.json:4,428-430` 记录该解析。
- **证据**：F-32-1（`unit-integration-report.md:153-157`）曾要求 Rust 实现 Final_Sigma 或修订承诺；实际修复改为前端对齐 Rust 的逐码点语义，双方一致性由共享向量保证（`greek-final-sigma-per-code-point` 在双方套件同断言）。
- **影响**：无用户可见不一致；但契约字面（`toLowerCase`）与实现（逐码点）不符。属契约文本债，建议 r2 显式改写折叠规则并在 Change Impact 中登记。

### A-07（minor）`fetch_remote_image` 自身未拒绝携带凭据的 URL

- **位置**：`src-tauri/src/services/resources.rs:640-651`（`fetch` 仅 `parse_remote_url`，不检查 userinfo）对照 `:175-183`（`origin_for_remote_reference` 明确拒绝凭据）。
- **证据**：`check_resource_access` 对 `https://user:pass@allowed-origin/img` 返回 `unsupported`（`commands/auth.rs:299-315` 单测），正常 UI 不会继续；但直接调用命令 30 时，若 origin 已允许，reqwest 会带凭据请求该服务端，且 `Redact` 仅用于日志。
- **违反条款**：`security-model.md:96` §4“最小化：不使用 Cookie 持久化；不发送 Referer；固定 UA”的精神与“文档内容不获得凭据/令牌外泄通道”的隔离目标（防御深度，非可达漏洞）。建议 `fetch` 复用同款凭据拒绝。

### A-08（minor）`details` 白名单是“按构造”而非“按过滤”

- **位置**：`src-tauri/src/services/diagnostics.rs:346-352`（`sanitize_details` 生产零调用）；所有生产 details 键为 `rootCandidate`/`scheme`/`newOrigin`/`reason`（均在 `DETAIL_KEY_ALLOWLIST`）。
- **证据**：`grep sanitize_details` 仅定义与单测；`record_app_error` 不落 details，bundle 的 `DiagnosticIssue` 无 details 字段，故当前无泄露；但未来任一服务新增键不会经过白名单过滤。
- **违反条款**：`security-model.md:166` §7“`details` 只允许白名单键”目前满足（无越界键），此条为加固建议：在 `to_payload`/日志边界执行白名单过滤或加编译期约束。

---

## 4. 已记录/接受的边界（不作为本次新发现，复核确认其记录诚实）

| 项 | 记录位置 | 复核结论 |
|---|---|---|
| Tauri forbidden 集进程内不可逆：撤销后同进程“重新确认/重新打开”同一路径的 asset 不会恢复，直到重启 | `wp-14a-assetfix.md` §7.2 | 方向为安全优先的超额阻止，无绕过；R25/IX10 的“再次确认”在同进程内受限，属架构级已知项 |
| >50MiB 打开增加一次流式全量 SHA-256（契约仅要求 64KiB 探测+stat） | `files.rs:10-16`、`wp-10-files.md` | 只读、不缓冲全文，使 `contentHash`/relink 契约字段有效；属已记录偏差 |
| remote `grantId` 公式折入 `docId`（data-model §3.2 公式仅 origins-joined） | `auth.rs:696-707` | 避免跨文档同 origin 集合的主键冲突；id 为不透明值，已记录 |
| İ（U+0130）长度变化折叠、JS 侧孤立代理 | `unit-integration-report.md` §8 | 向量固定双方行为，无静默漂移 |
| 焦点复核 helpers（`watch.rs:175-209`）无 Rust 生产调用，行为由前端 `ReaderScreen.tsx:1104-1108` 的 `recheckActive()` 触发 | 本评审观察 | 契约 §7.5 的可观察效果由前端实现；Rust 侧 stable read 提供协议；建议 Review B 确认“全部可见文档”覆盖 |
| 启动时持久授权不回填运行时 asset scope | `state.rs:146-151` | 图片经逐文件 `check_resource_access` 重新 allow，行为不受影响；scope 保守为空 |
| 预览“包含完整路径”不会向 bundle 加入路径（契约模型无路径字段），仅影响 displayName/copySummary | `diagnostics.rs:672-721`、`models/diagnostics.rs:110-120` | 偏保守、无泄露；属文案/模型限制 |
| 刷新时持久授权 `exists && is_readable` 不再 canonicalize | `auth.rs:487-496` | 存储的是 canonical path；路径被外部替换为符号链接的风险属“本机其他进程修改源文件”的模型外范围 |

---

## 5. 明确“无法在此验证”

1. **WebView 侧 asset:// 实际字节加载与 scope 命中**（含 forbidden 集行为）：需真实应用运行；既有 AT13/AT25/AT26 桌面证据引用于 `acceptance-at.md` Rev 3，本次未复跑桌面。
2. **DNS 解析与地址钉扎（`resolve_to_addrs`）在真实 DNS/rebinding 下的行为**：无网络测试；仅确认每个已解析地址在连接前被检查、且解析结果传入传输层（`resources.rs:802-838, 350-367`）。
3. **抓包级“默认零请求”**（AT26）：沿用既有进程树 socket 证据，本轮未复跑。
4. **系统级写监测（strace/inotify）**：以静态阅读 + 既有 AT04 哈希/目录清单证据替代；atime 不计。
5. **打包安装下的 capabilities/CSP 生效**（干净系统、Wayland）：需 wp-40/45 环境；本轮只验证配置文本与编译期注册。
6. **A-01/A-02 修复后的端到端行为**：属修复任务与 Review B/桌面复跑范围。
7. **多 locale 键一致性**：v0.1.0 仅 `zh-CN.json` 一个 locale，跨 locale 校验无对象（新增 locale 时必须扩展 `every_message_key_exists_in_the_zh_cn_locale_catalog` 的等价约束）。

---

## 6. Rust 测试质量评估

**强项（oracle 独立性）**

- 路径/授权向量使用真实 `tempfile` 目录与显式构造的期望（如 `outside_root_is_denied_with_root_candidate` 以 canonical 外部目录断言 `rootCandidate`），安全分支来自 security-model §2.2 文本；TOCTOU 用 `ScriptedProbe` 脚本化 resolution，不依赖真实竞态。
- 远程策略以 mock resolver/transport/cache 驱动，阻断地址矩阵、3/4 跳边界、逐跳重解析、无自动重试、跨会话不复用等均为规格数字直接断言；`default_caps_match_the_security_model` 冻结 20MiB/5s/15s/3 跳/256MiB。
- 命令表面在测试内保留契约 §2 的**独立副本**（`CONTRACT_COMMANDS`/`CONTRACT_MODULES`）并与宏表、`fixtures/contracts/commands.json` 三方对齐；未以实现输出反推清单。
- 存储门禁/清除/迁移故障注入（磁盘满、损坏、只读挂载、中断回滚）覆盖 NF08 的正反路径，并断言“清除不触碰源文件”。
- 本次复跑 261/261 通过（§1.4），无 flake 复现；`watch_runtime` 为真实 notify 的窄时序测试，连续两次运行稳定。

**缺口**

1. 无“撤销目录授权后 `read_directory` 必须失败”（A-02）与“`entry=restore` 不得自动重授”（A-01）用例——这两个缺口正是对应缺陷逃逸的原因；修复时须补测试并纳入回归。
2. `greek-final-sigma-per-code-point` 的期望值在 wp-32a 随“前端对齐 Rust”变更，属实现协商后的共享语义（A-06），该向量不再是“从契约文本独立推导”的 oracle；需在契约 r2 中补齐说明，避免后续把它当作不可变的规范依据。
3. `unreadable_persistent_grant_is_marked_unavailable` 在 root 权限下自行跳过（已打印说明），CI 以 root 运行时该不变量失去覆盖。
4. `reqwest_transport_constructs_without_network_access` 只验证构造，未验证地址钉扎/no-proxy/no-cookie/UA 实际生效（属 §5.2 无法在此验证）。
5. `export` 的 `includeFullPaths` 对 bundle 无实际差异，未被测试覆盖（见 §4）。
6. `nf07_soak` 以“打开另一文档强制逐出缓存”表达关闭，属服务级近似；桌面级 30 循环已有独立证据。

---

## 7. 结论与建议（overall recommendation: **FAIL**）

- **判定范围**：Rust 安全核心（评审目标快照），修订 `aac72e1`；证据见 §1–§6。
- **失败依据**：**A-01（blocker）** 使“撤销/清除授权不自动恢复”的强制控制（R06/R25/R27、T6、models INV-AZ-10、§10.2、架构 §5.8）在真实重启流程中被推翻；**A-02（major）** 使目录撤销无法停止扫描（INV-AZ-06/§2.1/R25）。两处均为确定性代码路径且无测试覆盖。
- **其余区域**：路径算法本体、只读保证、诊断脱敏、能力/CSP 最小性、存储迁移与门禁、监测与事件、错误分类的逐条核对均通过，证据质量高；6 个 minor 多为失败路径、契约文本债与防御深度。
- **建议处置**：
  1. 形成修正工作包（新提交）：A-01 在 `entry="restore"` 上取消自动授权并接“重新确认”流程；A-02 在 `read_directory`/撤销路径上闭环树扫描；A-03/A-04 调整撤销顺序与错误呈现；A-06/A-08 建议随契约 r2 或加固一并处理；A-05 交架构侧裁决（补命令或明确口径）。
  2. 修复后重跑受影响测试（`security_paths_auth`、`tree_listing`、`storage_gating`、`commands_surface` 合约面）与 AT06/AT25/AT27（含 §6 桌面 UNVERIFIED 项按既有口径），并对新修订**重新发起独立评审**；旧证据作废。
  3. 若协调方决定以“restore 视为授权动作”重新解释 A-01，则必须先统一修订 `security-model.md`、`data-model.md` 与 models §10.2，并按 Change Impact 记录，不得由实现自行选取较宽松语义（requirements-baseline §1.1 冲突规则）。
- **未做**：本评审未修改任何代码/测试/配置，未创建修正；§2 之外无更高严重度问题。

## 8. 追溯

| 条款 | 本文承接 |
|---|---|
| 计划 §6.1 评审 A；T-64 | §2 逐区域、§3 发现、§6 测试质量 |
| security-model §2–§8 | §2.1–§2.4 核对；A-01…A-08 |
| contracts r1 §1–§9 | §2.3/§2.4/§2.7；A-04/A-06 |
| data-model §2–§7；models §8–§10 | §2.5；A-01/A-02/A-05 |
| requirements R04/R06/R07/R17/R18/R25/R26/R27/R28、NF01–NF03/NF08/NF11 | §2 与 §3 逐条引用 |
| wp-14a §7、wp-32 §8、wp-34c/34d 验收 | §4 已记录边界；F-32-1 现状（A-06） |
| 本评审证据 | `cargo test --manifest-path src-tauri/Cargo.toml --offline`：261 passed/0 failed（2026-10-07，修订 `aac72e1`） |
| Rev 2 追加证据 | §9：`/tmp/opencode/review-a-verify` 只读 harness（A-01/A-02 可执行复现；仓库外，不构成交付物） |

---

## 9. Revision 2 — Verification Addendum（2026-10-07）

### 9.1 元数据修正（流程说明；无内容变更）

- 首次 `finish` 被 guard 阻塞：`BLOCKED: snapshot_paths does not cover required predecessor/review target: artifacts/60-review/review-a-rust-security.md`——原 handoff 的 `snapshot_paths` 只覆盖评审目标，而 `finish` 会把“已存在且与 `writes`（`artifacts/60-review/`）重叠的 deliverable”视为需快照覆盖的对象。该阻塞周期已由 orchestrator 归档；handoff 以同一任务、同一分支重钉（`base_commit=95e68ac`，`parent_commit=aac72e1`，`writes=[]`，deliverable 为唯一输出）。
- **评审对象未变**：`git diff aac72e1..HEAD -- src-tauri/` 为空（HEAD `95e68ac` 相对 `aac72e1` 仅新增本报告；`git diff --stat aac72e1..HEAD` = 1 file changed），6 项 pinned 输入 SHA-256 复核仍一致。§3 的全部发现原样有效，未增删或改写。

### 9.2 A-01 追加验证（可执行复现）

**精确调用链**：

- `src/features/reader/use-reader.ts:1128-1133`（启动恢复）：对 `listRecents` 中每个 `available` 条目调用 `openDocuments({paths:[canonicalPath], entry:'restore'})`；`known.available` 仅来自 `list_recents` 的“存在且可读”复核（`storage.rs:1011`），**不含授权检查**。
- `src-tauri/src/commands/files.rs:96-160`（`open_one`）：`FilesService::open_document`（无授权前置）→ 第 117-128 行**无条件** `grant_file`（失败再 `grant_file_session`）；唯一按 `entry` 分支的是第 86-90 行的记录写回恢复（`entry != restore`）。
- 读取闸门：`commands/files.rs:255-267`（`authorize_registered`）只查 `AuthRegistry::has_local_access`；第 4 步的 `grant_file` 使该闸门重新为真。

**只读复现（外部 harness，不修改产品代码）**：`/tmp/opencode/review-a-verify/`（Cargo path-dependency，仅调用冻结的 `paperstack_lib` 公共服务；`git diff aac72e1..HEAD -- src-tauri/` 为空证明字节一致）。命令与实测输出：

```text
$ cd /tmp/opencode/review-a-verify
$ CARGO_TARGET_DIR=<repo>/src-tauri/target cargo run --offline
== A-01: open_documents(entry="restore") auto re-grant ==
  open: doc_id=d-948c330a4b498b71 open_needs_grant=false; grant scope=Persistent
  read after grant: ok, 4 decoded bytes
  after revoke_grant: has_local_access=false
  restart (fresh registry from empty grant set): has_local_access=false
  restore open_document + grant_file: status=opened doc_id=d-948c330a4b498b71 re-granted scope=Persistent
  read after restore: ok, 4 decoded bytes -> revoked authorization silently restored
ALL VERIFICATIONS REPRODUCED (A-01, A-02)
```

harness 复刻的命令序列即 `open_one` 的两步（open → grant，见上）；输出证明：撤销后空注册表上，`entry="restore"` 语义所走的 open+grant 路径把 `has_local_access` 从 false 翻回 true 并成功读取。**限制（不过度声明）**：未直接调用 `open_documents` 命令本体（需 Tauri `AppHandle`/IPC harness，超出“快速只读”范围）；命令层“无条件 grant”由 `commands/files.rs:117-128` 源码行与上述 4 步输出共同佐证。

### 9.3 A-02 追加验证（可执行复现）

**精确调用链**：

- `src-tauri/src/commands/tree.rs:39-48`（`read_directory`）直接调用 `TreeService::read_directory`，**无任何 AuthRegistry 查询**。
- `src-tauri/src/services/tree.rs:113-148`：只查进程内 `roots` 与 `is_within_root`；`TreeService` 没有任何按授权撤销逐出根的路径。
- `src-tauri/src/commands/auth.rs:227-235`（`revoke_grant`）仅 `AuthRegistry::revoke`；`src-tauri/src/commands/storage.rs:193-241`（授权类清除）仅注册表撤销 + 远程缓存清理：两者都不触碰 `TreeService`。

**只读复现（同一 harness；真实 `TreeService`/`AuthRegistry`）**：同一 `cargo run` 输出第二段：

```text
== A-02: directory revoke does not stop read_directory ==
  open_directory: root_id=r-70450c79e4fea6d6 scope=Session
  before revoke: read_directory entries=2
  after revoke_grant: registry has_local_access=false
  after revoke: read_directory still Ok -> root entries=2 sub entries=1
```

输出证明：真实 `AuthRegistry::revoke` 之后，同一 `rootId` 与子目录的 `read_directory` 仍返回完整列表，与 `commands/tree.rs:39-48` 无授权检查的源码行一致，A-02 成立（`clear_records(["authorizations"])` 复用同一路径，见 §9.3 调用链）。

### 9.4 判定重申（Rev 2 权威）

- 逐区域判定不变：**1 FAIL**（路径授权与资源策略，因 A-01/A-02）、2 PASS、3 PASS、4 PASS、5 PASS（附 A-05 minor）、6 PASS、7 PASS、8 PASS（附缺口）；**overall recommendation 仍为 FAIL**（1 blocker A-01 + 1 major A-02 + 6 minor）。
- 本附录仅新增证据与流程说明；§3 发现、§4 边界、§5 无法验证项、§6 测试质量、§7 建议均保持原样有效。
- 证据可复跑：`cargo test --manifest-path src-tauri/Cargo.toml --offline`（261/261，§1.4）与 `/tmp/opencode/review-a-verify`（本附录 9.2/9.3；harness 位于仓库外，不作为交付物）。
