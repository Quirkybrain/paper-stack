# 纸栈 PaperStack · WP-39 联合聚焦复审报告（Review A′/B′ 合并）

- **Producer**: agent:quality-reviewer
- **Artifact ID**: ART-60-REVIEW-REREVIEW
- **Artifact Type**: Independent Re-Review Report（wp-39：评审 A `A-01…A-08` 与评审 B `B-01…B-10` 在修正后修订上的逐项关闭验证 + 当前修订全量测试证据 + 增量写入路径的对抗性抽查 + wp-38 桌面证据与代码一致性核对）
- **Status**: VALID
- **Revision**: 1
- **Owner**: quality-reviewer
- **Task**: `wp-39-rereview`（任务分支 `task/wp-39-rereview`；父分支 `feat/v0.1.0`；评审修订 `dc63d9f0e6ebf6627505430a33ee8cc7edc089c3`；快照 `refs/swe/snapshots/20261007T150544Z-wp-39-rereview-211c6c2b`）
- **Last Verified**: 2026-10-07
- **Review base**: HEAD `dc63d9f`（评审前后 `git status --porcelain` 为空；只读复审：未修改任何 `src/`、`src-tauri/`、`tests/`、`fixtures/`、配置或框架文件；本报告为唯一写入）
- **Scope**: 两份修复清单的 18 个发现（评审 A §10.2 `A-01…A-08`；评审 B §9 `B-01…B-10`）在**当前修订**上的逐项复核；三套件复跑；两项对抗性抽查；对 wp-38 桌面复跑（`acceptance-at.md` Rev 4）证据与代码的一致性核对。判定仅对本修订有效；未被修正触及其它区域的旧评审结论不在本文重开。
- **Verdict**: **PASS-WITH-NOTES**（18/18 VERIFIED；0 PARTIAL；0 NOT VERIFIED；残余风险与“无法在此验证”见 §5）

**Pinned inputs（SHA-256 于 2026-10-07 实测复核，全部与 handoff 一致）**

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/60-review/review-a-rust-security.md` | `72a45b48…8b21e7` | ✓ |
| `artifacts/60-review/review-b-frontend-pipeline.md` | `68515a88…1dbc596d` | ✓ |
| `artifacts/60-implementation/wp-35a-fix-rust.md` | `f54c156b…75b5de` | ✓ |
| `artifacts/60-implementation/wp-36a-fix-frontend.md` | `89c769b5…d3ed23` | ✓ |
| `artifacts/70-verification/acceptance-at.md` | `e096dad4…c9a1db` | ✓ |
| `artifacts/30-architecture/CHANGE-IMPACT-note-1.md` | `a6bb391a…e3398c` | ✓ |
| `config/git-policy.json` | `3b8ddffd…9241a014` | ✓ |

---

## 1. 方法与修订固定

1. **修订与快照**：`git rev-parse HEAD` = `dc63d9f`，与 handoff `base_commit`/`parent_commit` 一致。快照 `0fe8872` 为 `dc63d9f` 的子提交；`git diff <snap> HEAD -- src-tauri/src src-tauri/tests src tests/desktop` 的唯一差异是 **`tests/desktop/xdo-helper`（gitignored 的编译辅助二进制；快照 pin 纳入了 ignored 产物，HEAD 不追踪它）**；该文件在工作树现存且字节/构建 ID 与快照一致（21856 B，`1d3e66…` 同 BuildID），不影响任何评审目标字节。其余路径逐字节一致。
2. **只读声明**：全部检查为只读命令、既有测试复跑、仓库外（`/tmp/opencode/`）一次性探针；未修改产品/测试/框架文件。复跑后 `git status --porcelain` 为空。
3. **复跑范围**（本修订，2026-10-07 23:06–23:12）：`pnpm test -- --run`、`cargo test --manifest-path src-tauri/Cargo.toml --offline`、`pnpm vitest run --config tests/contracts/vitest.config.ts`，以及两份清单点名的定向测试文件与 grep 扫描。桌面证据（X11 release 二进制 `054040ba…`）按 wp-38 Rev 4 记录逐图/逐段核对，不重复执行桌面。
4. **判定口径**：VERIFIED = 清单验收标准在当前修订上有代码 + 测试/证据双层支持且我独立复核通过；PARTIAL = 部分满足；NOT VERIFIED = 不满足或证据缺失。§5 单列“残余风险”与“无法在此验证”，不与判定混淆。

## 2. 套件结果（本修订实测）

| 套件 | 命令 | 实测输出 | 期望 | 结论 |
|---|---|---|---|---|
| 前端全量 | `pnpm test -- --run` | `Test Files 71 passed (71)` / `Tests 547 passed (547)`；EXIT=0 | 547 | ✓ 一致 |
| Rust 全量 | `cargo test --manifest-path src-tauri/Cargo.toml --offline` | 21 个 `test result` 行全部 ok；**274 passed / 0 failed / 0 ignored**；EXIT=0 | 274 | ✓ 一致 |
| 契约/语义向量（前端侧） | `pnpm vitest run --config tests/contracts/vitest.config.ts` | `Test Files 4 passed (4)` / `Tests 44 passed (44)`；EXIT=0 | 44 | ✓ 一致 |

Rust 套件分布（合计 274）：lib 61、app_open_requests 7、commands_surface 20、contract_search_parity 5、contract_shape 3、files_open 13、files_read 12、files_source 18、migration_faults 12、nf07_soak 1、remote_policy 26、security_paths_auth 26、storage_fixtures 2、storage_gating 8、storage_records 21、storage_session 6、tree_listing 11、watch_registry 20、watch_runtime 2（main 0、doc-tests 0）。日志：`/tmp/opencode/wp39-{pnpm-test,cargo-test,contracts}.log`。

定向复跑（点名用例/守卫，全部 ✔）：Rust 11 个新增/扩展用例 11/11（§3 逐项列出）；前端 `single-trusted-html-entry` + `no-hardcoded-strings` + `DocumentInfoPanel` + `FormulaPanel` = 14/14；`pipeline` + `katex` + `mermaid` + `ReaderScreen` = 96/96。

## 3. 逐项判定（A-01…A-08 / B-01…B-10）

**计数：A 8/8 VERIFIED；B 10/10 VERIFIED；合计 18 VERIFIED / 0 PARTIAL / 0 NOT VERIFIED。**

### 3.1 评审 A（Rust 安全核心）

| # | 判定 | 关键证据（位置 / 测试 / 桌面） |
|---|---|---|
| A-01 | **VERIFIED** | `commands/files.rs:104-127`（`entry==Restore` 先复核，无授权→`PS_AUTH_REVOKED` rejected，任何读取之前）；`:153` grant 块受 `entry != OpenEntry::Restore` 保护；`services/auth.rs:221-236` restore 分支只观察注册表、从不 `grant_file`。测试：`restore_does_not_regrant_revoked_authorization`（`security_paths_auth.rs:633`：撤销→空注册表→`NeedsConfirmation`、`list_grants` 不新增、upsert 不触发、`has_local_access=false`、读取仍拒；有效授权时 `Restored` 行为不变）+ `commands::files::tests` 3 项（`files.rs:310/322/334`：Restore vs Dialog/Drop/Cli/System/Tree/Recent 边界）。桌面（Rev 4 最终迭代，`runs.log:916-1012`）：授权转储 **1→0→0**；`at06-r4-k` 显示恢复标签不可用 + `PS_AUTH_REVOKED`，`at06-r4-l` 显示重试仍拒；与代码路径一致。复审 grep（`entry`）命中 104/153 两处保护点。 |
| A-02 | **VERIFIED** | `services/tree.rs:159-172`（`read_directory_checked`：解析根→以注册根 canonical path 评估决策→再读盘；拒绝 `PS_AUTH_REVOKED`）；`commands/tree.rs:49-57`（tree→auth 同一持锁、薄接线）与 `:63-69`（命令真实调用体）。测试：`tree_listing.rs:279/310`（撤销后根与子目录均拒；显式重开恢复；清除类别后拒且注册表为空）+ `services/tree.rs:320`（决策收到根 canonical path、拒绝在读盘前、未知根仍 `PS_IO_NOT_FOUND`）。锁序核对：全仓仅 `commands/tree.rs` 同持 tree→auth，`storage.rs` 授权清除只触 auth，无反向嵌套。桌面：`at25-r4-h/i`（核销后展开拒绝 + 重试拒绝）、`at25-r4-j` + 授权转储（显式重开→`session` 目录授权），`runs.log:3314-3315`。对抗性抽查见 §4.1。 |
| A-03 | **VERIFIED** | `services/auth.rs:397-432`：`store.delete(grant_id)?` 前置于任何内存变更（`:407-410`），删除失败即整体保持 (a) 语义。测试：`revoke_delete_failure_keeps_the_grant_and_retry_completes`（`security_paths_auth.rs:790`：失败后 list/has_local_access/asset scope 全保留；重试成功；二次撤销 `PS_IO_NOT_FOUND`）+ `revoke_persistence_failure_keeps_the_scope_and_completes_on_retry`（`asset_scope.rs:448`：失败零 `forbid_*`、恢复后恰好一次）。残余故障类见 §5.1。 |
| A-04 | **VERIFIED** | `commands/resources.rs:56-98`（命令 29 恒 `Ok`；失败计数 + `remote_revoke_failures` 诊断）；`revoke_remote_cache`（`:114-144`）无 `?` 冒泡、`is_err()` 计数；`commands/storage.rs:193-241` 同样按计数并入类别错误。测试：`revoke_session_counts_failed_removals_without_failing`（`remote_policy.rs:702`：`failed_removals=2`、无 panic、缓存保留、后续 fetch 不复用旧字节）。命令层“恒 Ok”由 grep 静态确认（清单允许）。 |
| A-05 | **VERIFIED** | `services/storage.rs:412-431`（生产梯子 `open_with_degrade` 调用 `open_read_only_path`）；`state.rs:105-133`（`AppState::create` 走梯子；只读时加载 grants/settings、跳过 session 行清理；`PS_DB_MIGRATION` 如实记录 + `storage_read_only_degrade` 事件；`Storage::is_read_only()` 提供降级状态）。测试：`migration_faults.rs:146`（扩展：高版本库→只读 Storage，`is_read_only`、`schema_revision=2`、grants 可读、只读写 `PS_DB_FAILURE`、`user_version` 不被降级；并走 `open_with_degrade` 断言梯子可达）+ `:205`（健康库读写无降级；损坏库 `None` + `DbMigration` + 字节原样）。UI 提示与“重建入口”按 Change Impact note §5 显式落档为 v0.1.0 范围外（见 §5.2）。 |
| A-06 | **VERIFIED** | `contracts.md` **Revision 2** 第 80 行：`search_source` 折叠条款改写为“与前端一致的逐码点 `foldLower` 折叠（逐码点 Unicode 默认小写、双方一致；无 Final_Sigma 上下文规则；不做归一化；与向量 `foldingRule` 一致；İ 边界按 `boundaryCases` 逐侧固定）”；`tests/contracts/vectors/search-parity.json` 的 `foldingRule` 逐句对应（并明确禁止整串 `toLowerCase`）；`CHANGE-IMPACT-note-1.md` §2/§3.1 记录 Artifact 修订提升与无行为变化；`Contract ID` 保持 `paperstack-ipc-r1`。双方一致性复跑：`contract_search_parity` 5/5 + 契约套件 44/44。 |
| A-07 | **VERIFIED** | `services/resources.rs:135-147`（`parse_remote_url` 在 scheme/host 后拒绝 `username`/`password`）；`:171-186`（`origin_for_remote_reference` 保留同款拒绝）；`:714`（重定向目标同样拒绝）。测试：`credential_urls_are_rejected_before_any_io`（`remote_policy.rs:261`：`user:pass@`/`user@` 且 origin 本会命中允许表 → `PS_REMOTE_PROTOCOL`，`resolver_calls()==0`、`transport_calls()==0`、缓存空）。grep 命中 4 处凭据校验（两条解析入口 + 重定向复检）。 |
| A-08 | **VERIFIED** | `error.rs:391-399`：`AppError::to_payload()`（唯一 wire 出口）经 `sanitize_details` 过滤 `details`（`services/diagnostics.rs:346` 现为生产可达）；源头 `AppError` 保留完整 details。测试：`payload_drops_non_allowlisted_details`（`error.rs:590`：`secretToken`/`absolutePath` 被移除、`rootCandidate`/`operation` 保留）。 |

### 3.2 评审 B（前端与渲染管线）

| # | 判定 | 关键证据（位置 / 测试 / 桌面） |
|---|---|---|
| B-01 | **VERIFIED** | 全 `src/` 扫描 `dangerouslySetInnerHTML`：生产代码站点**恰为 1 个模块** `src/document/SanitizedNode.tsx:26`（另一命中是该模块引用安全模型原文的注释），无第二站点；`grep -rn … | grep -v test` 输出仅该模块。消费者均改走封装：`MermaidBlock.tsx:137,147`、`FormulaPanel.tsx:57`。公式预览复用冻结帽：`FormulaPanel.tsx:28-38`（`katexOptions({})` + `displayMode:false/throwOnError:false`）；`katex.ts:45-53`（`trust:false`、`maxSize:20`、`maxExpand:1000`）。测试：`single-trusted-html-entry.test.ts` 2/2（递归扫描全部生产文件断言单点 + 两消费者不含原始注入）；`FormulaPanel.test.tsx` 断言调用参数逐字等于 `katexOptions({})` 且 `\rule{100em}` 被钳制为 `width="20em"`。桌面：AT12（`at12-r4-f` 放大覆盖层内 Mermaid SVG 正常渲染，两注入点均经封装）。 |
| B-02 | **VERIFIED** | `sanitize.ts:100,119`：`FOOTNOTE_REF_ID_PATTERN = /^ps-fn(ref)?-[A-Za-z0-9-]+$/` 用于 `a id`；`li` 保持更紧的 `^ps-fn-…$`；`security-model.md` Rev 2 §5.2 已同步该行文与 href 片段。解析级测试：`pipeline.test.ts:304`（同脚注两处引用：4 个 `#…` 目标全部命中既有 id；`ps-fn-1`/`ps-fnref-1`/`ps-fnref-1-2` 均存活）、`:327`（任意 `evil` id 被剥离）。组件级：`ReaderScreen.test.tsx:1611`（点 `↩`/`↩²` 分别滚动到第一/第二引用处，无“未找到该标题”）。桌面：`at15-r4-f/g/h/i`（脚注区↩/↩² 与两处引用分别回跳）与 `at16-r4-c/e/f`（Alt+←/→ 历史往返）；`at15-r4-f` 同时显示本地化标题「脚注」。对抗性抽查见 §4.2。 |
| B-03 | **VERIFIED** | `pipeline.ts:51,60,95`（`footnoteLabel` 参数化 + `BLANK_FOOTNOTE_LABEL=' '` 防上游 falsy 回退英文）；`types.ts:124`；App 层注入 `use-reader.ts:443`（`t('document.footnoteLabel')` → `zh-CN.json` `"document.footnoteLabel": "脚注"`）。测试：`pipeline.test.ts:334`（注入标签生效；无注入输出不含 `Footnotes`）。桌面：AT15 `at15-r4-f` 脚注区标题「脚注」，无英文默认。说明：`' '` 空白回退只影响无注入的直接管线运行，应用路径始终注入。 |
| B-04 | **VERIFIED** | 新组件 `src/features/reader/info/DocumentInfoPanel.tsx`（编码懒读 `get_source_info`、完整路径、显示版本 hash、资源类诊断列表/空态、只读标记；全部经 `t()`）；`ReaderToolbar.tsx:165-195`（文件名按钮 `aria-haspopup=dialog`/`aria-expanded` + 非模态 `Popover`，关闭回触发点；无文档时禁用 + `document.info.disabled` 原因）；`ReaderScreen.tsx:335-337,1240-1241`（`resourceIssues` 取显示版本诊断的 resource 切片；`docVersion` 传入）。测试：`DocumentInfoPanel.test.tsx` 4/4 + `ReaderScreen.test.tsx:1631/1650`（打开/内容/关闭回焦/无文档禁用原因）。catalog：7 个 `document.info.*` 键全部经 `t()` 消费，不再悬空（383=378+2+3）。桌面：AT30 `at30-r4-e`（编码 utf-8、完整路径、内容版本、资源问题空态、只读、显式关闭）。 |
| B-05 | **VERIFIED** | `ReaderToolbar.tsx:266-272`（更多菜单在“查看源码/返回阅读”之后新增“更新行为”项）；`ReaderScreen.tsx` `onOpenUpdateBehavior → openSettings('fileUpdate')`；`menu.updateBehavior` 已消费（`zh-CN.json:45`）。测试：`ReaderScreen.test.tsx:1661`（菜单项存在 + 激活后为“文件与更新”分类）。桌面：AT30 最终迭代（与提交脚本一致，`runs.log:3762-3780`）以 5×Down+Return 经含“更新行为”的 5 项菜单到达“关于”；观察 O-38-4 记录位置变化。 |
| B-06 | **VERIFIED** | `use-reader.ts:937-970`：`adoptRelinkResult` 在 await 后按 `tabId` 重读当前标签，要求 `docId` 与 `generation` 未变，否则零可见影响丢弃；`reassociated`/`new-version` 两分支均在复核之后派发；关闭标签由 tabs 缺失覆盖（不可重建）；`relinkTab`/`relinkRecent` 传入 await 前的快照并复用该复核。测试：`ReaderScreen.test.tsx:1672`（在途期间同标签导航至另一文档→迟到结果被丢弃，无提示、无陈旧正文）。 |
| B-07 | **VERIFIED** | `use-reader.ts:1637-1642`：`recheckOpenTabs` 对全部已打开标签执行 `refreshTab`（后台候选只进入 pending，激活后按 keep/follow/选区/检查层决策）；`ReaderScreen.tsx:1106-1114` 聚焦节流 300ms 调用。测试：`ReaderScreen.test.tsx:1708`（后台标签 missed event + 聚焦→派发 `read_document(refresh)`；激活后仍显示旧版本、仅出现更新横幅，INV-UM-04）。真实桌面聚焦行为未复跑（§5.3）。 |
| B-08 | **VERIFIED** | `mermaid.tsx:94-103`：`countSvgNodesLazy` 用 `DOMParser.parseFromString(svg,'image/svg+xml')` 惰性解析计数，无 `DOMParser` 时字符串计数；**:165** 默认计数器接线；活 DOM `createElement`+`innerHTML` 路径已移除（grep `innerHTML` 无命中）。测试：`mermaid.test.ts:127-147`（含 `onload`/`<image>` 桩 SVG：`createElement` 零调用、处理器不执行、活页面无 `<image>`）。 |
| B-09 | **VERIFIED** | `no-hardcoded-strings.test.ts:22-26,54-58`：`SCAN_DIRS = {app,components,features,document,services}`（递归、排除 `*.test.*`），扫描前剥离块/行注释，保留 1 条已分类非 UI 类型字面量白名单；`t()` 键存在性检查同范围。测试自证 + 全量套件在扩围后全绿。独立复核（本次自写 Python 扫描，去注释后全 `src` 生产文件）：CJK 代码字面量仅 `src/services/types.ts:538` 的 `name: '纸栈 PaperStack'`（类型字面量，非运行时 UI），无其它违规。 |
| B-10 | **VERIFIED** | `sanitize.ts:103,121`：`MATH_MARKER_CLASS_PATTERN`/`CODE_CLASS_PATTERN` 已删除，`code` className 仅 `LANGUAGE_CLASS_PATTERN = /^language-[A-Za-z0-9_+-]{1,32}$/`；`security-model.md` Rev 2 §5.2 登记 D-3 增量移除。测试：`katex.test.ts:120`（严格 schema 下 `$x^2$`/`$$y$$` 仍渲染为 KaTeX；`evil`、`math-inline`、`math-display` 均被剥离）。桌面：AT09 `at09-r4-g`（D-3 移除后数学实际渲染、script 无痕）。 |

## 4. 对抗性抽查（独立探针，仓库外）

### 4.1 A-02 目录授权门：过度阻断 / 欠阻断 / 失效授权（`/tmp/opencode/wp39-probe-a02`，path-dependency 调用冻结的 `paperstack_lib`）

```text
case1 parent grant covers sub root: ALLOWED entries=1
case2 file grant does not authorize tree scan: DENIED PS_AUTH_REVOKED (expected)
case3 unavailable grant keeps scan denied after readability returns: DENIED PS_AUTH_REVOKED (expected, grant_id=g-f322273e455052e4)
ALL ADVERSARIAL PROBES PASSED (A-02: no over-blocking, no under-blocking)
```

结论：覆盖父目录的合法授权仍可扫描子根（不过度阻断）；根内文件授权**不会**误开目录扫描（不欠阻断）；启动复核标记 `unavailable` 的目录授权在恢复可读后仍拒绝（fail-closed）。与 `has_local_access` 语义（File 需精确匹配、Directory 需包含）及命令层锁序一致。

### 4.2 B-02 脚注回引 id 模式：敌意 id 与往返（`/tmp/opencode/wp39-probe-b02`，真实 `parseDocument` 管线）

```text
Test Files  1 passed (1)
     Tests  3 passed (3)
```

- 合法形状（`ps-fnref-1`、`ps-fnref-1-2`、`ps-fnref-1-2-3`、`ps-fn-1`…）存活；16 个敌意值（含 `ps-fnref-1" onmouseover=…`、`ps-fnref-1' onfocus=…`、空格/Tab/冒号/斜杠/分号/`<img>`/NUL/全角空格/前缀粘连/控制字符）全部被剥离子，且无任何 `on*` 属性存活；3 引用文档所有 `#…` href 目标均存在；`javascript:`/`data:` href 回归检查仍被剥离。
- **边界记录**：按 `security-model §5.2` Rev 2 的既定正则，`ps-fnref--`、`ps-fnref-1-` 这类尾随连字符值属“形状允许”（`[A-Za-z0-9-]+` 含 `-`）。它们是纯字符串 id、无安全影响；如需更紧的形状可由架构在 r2 收窄正则（非缺陷）。

### 4.3 附加独立扫描（B-09 承诺）

去注释后扫描全部 `src/**/*.{ts,tsx}`（排除 `locales/`、`*.test.*`）：CJK 代码字面量仅前述 1 条已分类类型字面量；无未提取用户可见中文串。

## 5. 残余风险与“无法在此验证”（不得读作通过）

1. **A-03 残余故障类（非清单验收失败）**：持久化删除**成功后**、runtime scope `forbid_*` 失败时（Tauri glob 编译失败类，罕见），`revoke` 返回错误但注册表已移除、scope 仍允许，重试 `PS_IO_NOT_FOUND`——即清单标题所述的半撤销形状在该故障域仍可构造；本修订对清单明确的 **`delete` 失败路径已完整实现 (a) 语义**并有双层测试。建议后续加固（forbid 失败时回置注册表或标记待补偿），当前为已知残余、非静默（错误如实返回）。
2. **A-05 UI 面**：只读降级状态可经 `Storage::is_read_only()`/诊断读取；专用“只读降级提示”面板与“重建本地数据库”入口明确不在 v0.1.0（Change Impact note §5 落档，r2 范围）。
3. **B-07 真实桌面聚焦复核 / B-06 系统对话框模态交错**：组件级已测（本修订复跑通过）；真实 WebKit/X11 聚焦事件与对话框时序未复跑（wp-36a §5.2 已如实记录，wp-38 复跑项未含）。
4. **A-01 命令层 in-repo 注入测试边界**：`open_one` 无并发命令级测试（需 Tauri `AppHandle`）；端到端由 AT06 桌面链（1→0→0 + 截图 k/l）覆盖，命令层由源码行与注册表谓词测试佐证。
5. **沿用 acceptance Rev 4 §R4.6 的环境未验证项（不变）**：Wayland 会话、抓包级零请求（现为 socket 级替代）、真正干净系统安装、WebDriver/tauri-driver、拖放打开、IME/200%/深色真实走查、LICENSE/第三方声明内容与对应源码入口等。
6. **AT30 许可证查看器**：打开即「找不到文件或资源。」（既有 O-38-3，wp-41/45 范围，不构成回归）。
7. **多 locale**：v0.1.0 仅 `zh-CN`，跨 locale 键一致性仍无对象；新增 locale 时须扩展 `i18n.keys.test.ts` 等价约束。
8. **证据卫生（记录性）**：`runs.log` 的 at30/at25 段含被最终迭代取代的中间迭代（截图由最终迭代覆写；最终迭代与提交脚本一致，如 AT30 的 5×Down 路径）；`superseded/` 保留了 3 张 at25 中间截图。不影响判定。
9. **快照/工作树**：`tests/desktop/xdo-helper` 为 gitignored 编译产物（磁盘存在、字节与快照一致、HEAD 不追踪）；不影响评审目标字节。

## 6. 总体建议（overall recommendation: **PASS-WITH-NOTES**）

- **判定范围**：两份清单的 18 个发现，修订 `dc63d9f`；证据见 §2–§4。
- **结论**：**18/18 VERIFIED（A 8/8 + B 10/10；0 PARTIAL / 0 NOT VERIFIED）**。原先的 3 个 major/blocker 路径（A-01、A-02、B-01、B-02、B-04）均在代码、测试与桌面证据三层闭合；A-06 的上游契约文本与 B-02/B-10 的 §5.2 schema 已由 Rev 2 架构同步 + Change Impact 落档；其余 minor 全部落实到清单点名的测试或明确的静态复核点。
- **建议处置**：该修正工作包可进入整合/Gate 流程；§5.1（A-03 scope 故障类加固）与 §5.3（B-07/B-06 桌面项）建议作为后续工作包或已知限制跟踪，不阻断本次关闭。
- **复审有效性**：本报告由**未参与修复的作者**出具；修复期间的旧评审证据以其评估修订为对象保持历史有效，但对新修订的关闭判定以本报告为准。
- **未做**：未修改任何代码/测试/配置；未复跑桌面（按 wp-38 既有证据逐图/逐段核对）。

## 7. 追溯

| 条款 | 本文承接 |
|---|---|
| 评审 A §10.2 / §10.3；评审 B §9 / §9.1 | §3 逐项判定；§2 复跑；§5 残余 |
| `security-model.md` Rev 2 §2.1/§4/§5.2/§7；`contracts.md` Rev 2 §2.1/§2；`data-model.md` §4.4/§4.5；models §8.2/§10.2/INV-AZ-06/10 | A-01…A-08；B-02/B-10 |
| `ui-spec.md` §2.2/§3.2；ADR-009；ADR-007 | B-03/B-04/B-05/B-09；A-06 |
| `wp-35a-fix-rust.md`、`wp-36a-fix-frontend.md`、`CHANGE-IMPACT-note-1.md`、`acceptance-at.md` Rev 4 | §3 证据引用；§1 修订固定 |
| 本报告证据 | 套件日志 `/tmp/opencode/wp39-*.log`；探针 `/tmp/opencode/wp39-probe-a02/`、`/tmp/opencode/wp39-probe-b02/`（仓库外一次性，非交付物）；快照 `refs/swe/snapshots/20261007T150544Z-wp-39-rereview-211c6c2b` |
