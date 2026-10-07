# 纸栈 PaperStack · wp-41 系统验证报告（System Verification）

- **Producer**: agent:system-verifier
- **Artifact ID**: ART-70-VERIFY-SYSVER
- **Artifact Type**: System Verification Report（R/NF/IT/DR 双向追溯、证据新鲜度审计、release Stage 就绪与缺口清单）
- **Status**: VALID
- **Revision**: 1
- **Owner**: system-verifier
- **Task**: `wp-41-sysver`（任务分支 `task/wp-41-sysver`；父分支 `feat/v0.1.0`；基线提交 `b41a0d374d95effaf43d13d8daa0f69d432f9959`；快照 `refs/swe/snapshots/20261007T153257Z-wp-41-sysver-6e81fb43`；产出提交主题 `docs(verification): system verification report`）
- **Last Verified**: 2026-10-07
- **Scope**: 只读系统验证；验证修订 `b41a0d3`（产品树与验收构建修订 `5d977ea` 字节一致，见 §7.2）。本任务只写入本报告；未修改产品代码、测试、配置、pinned 输入或框架文件；未执行任何发布动作。
- **Verdict**: **PASS-WITH-CONDITIONS**（可进入最终发布准备；**Release Stage Gate 当前不可通过**——条件、阻塞与环境限制见 §9、§10）

**Pinned inputs（SHA-256 于 2026-10-07 实测复核，全部与 `state/handoffs/wp-41-sysver.json` 一致）**

| 输入 | SHA-256（实测=pin） | 一致 |
|---|---|---|
| `artifacts/20-requirements/requirements-baseline.md` | `42784f67…5b85d` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…02967f` | ✓ |
| `artifacts/70-verification/acceptance-at.md`（Rev 4） | `e096dad4…c9a1db` | ✓ |
| `artifacts/70-verification/integration-report.md` | `e5f8bfd7…c5022e` | ✓ |
| `artifacts/70-verification/unit-integration-report.md`（Rev 1） | `a4c90529…7d261` | ✓ |
| `artifacts/60-review/review-rereview.md` | `99bcc709…843525` | ✓ |
| `artifacts/30-architecture/CHANGE-IMPACT-note-1.md` | `a6bb391a…e3398c` | ✓ |

---

## 1. 结论摘要

1. **追溯完整（需求侧）**：R01–R30 均具备实现路径、测试与 AT 判定，无孤儿需求；生产树（`src/`、`src-tauri/src/`）可逐目录归入计划 §3 的 C-01–C-21 组件图，未发现无需求/无决策归属的生产模块。IT01–IT08 **尚未执行**（下一任务，按派发口径记 pending，不记 missing，§5）。
2. **现行修订测试全绿（本任务独立复跑）**：前端 71 文件 / **547 passed**；Rust 21 target / **274 passed / 0 failed**；契约与集成边界 6 文件 / **89 passed**（Type Errors 0）；定向 cargo（commands_surface 20、contract_search_parity 5、contract_shape 3）通过（§7.3）。
3. **证据新鲜度存在一项实质缺口**：AT 的 **30/30 PASS 判定中仅 10 项产自当前产品修订的 release 二进制**（`054040ba…`，构建于 `5d977ea`=当前产品树）；其余 **20 项为前代二进制结转判定**，其中多项的实现文件在最后一次执行后被 `wp-35a`/`wp-36a`（及 wp-34 系列）修改（§7.4）。验收报告“修正未触及”为总体性判断，未逐项附差异审计。
4. **存在过期/被取代的文档级表述**：`unit-integration-report.md` 的数值（499/43/254）与 F-32-2/F-32-3“必须修复”已被 `wp-32a`/`wp-32b` 修复取代且未在该文件内标注；`integration-report.md` §6 对 F-32-2/F-32-3 的“保持既有结论，属性能任务”表述已过时；根 `README.md` 仍为 wp-23 的 v0 状态（声明多个已实现功能“尚未完成”）（§7.5）。
5. **复审关闭与集成**：`review-rereview.md` 的 18/18 VERIFIED（A 8/8、B 10/10）逐项映射到真实代码与测试，抽查一致（§7.6）；wp-40 Integration Gate 已 PASS（`gates/wp-40-gate.md`）。
6. **Release 就绪**：SRS §8.4 六项条件中，1/2/5 已有结果或满足，3/4/6 未完成或待执行；`LICENSE`/`THIRD_PARTY_NOTICES.md`/`.deb`/README 完整版/IT01–IT08 均为 OPEN；A9（源码入口）为所有者输入阻塞，A4（Wayland）为环境阻塞（§8、§9）。
7. **推荐**：**PASS-WITH-CONDITIONS**——可进入最终发布准备（许可证/打包、README/文档、IT 运行、发布就绪评审），但条件 C1–C6 与阻塞 B1/B2 必须在 Release Stage Gate 前关闭（§10）。

---

## 2. 方法与验证边界

- **验证链**：Requirement（SRS/基线）↔ 设计/契约（架构、contracts Rev 2、models、ui-spec）↔ 实现（生产代码路径）↔ 测试（前端/Rust/契约）↔ AT/IT 证据 ↔ DR-01–DR-08。
- **实际执行的复核**（本任务，2026-10-07）：
  1. 7 项 pinned 输入 SHA-256 实测；
  2. `input/` 三份权威来源 SHA-256 与需求基线 pinned 值比对（DR-08）；
  3. 修订等价性与二进制哈希/证据归属核对；
  4. 独立复跑：`pnpm test -- --run`、`cargo test --manifest-path src-tauri/Cargo.toml --offline`、`pnpm vitest run --config tests/contracts/vitest.config.ts`、定向 cargo 契约 target；
  5. 逐项核对 acceptance Rev 4 引用的证据文件（89 PNG、`runs.log` 4046 行、套件/守卫日志、占位扫描、`superseded/`）；
  6. 复审 18 项发现的关键代码位置与命名测试抽查（§7.6）；
  7. 全 artifacts 树 Producer 元数据机械扫描（132/132，§7.7）；
  8. 修正历史对 AT 路径影响的 `git diff` 审计（§7.4）。
- **未执行**：未重新执行任何桌面交互（系统验证为只读；桌面证据的新鲜度以修订/二进制/差异审计判定，而非重跑）；未复跑性能校准脚本（引用 wp-32/wp-32a 原始数据）；未做用户验收、未做发布动作。
- **判定纪律**：未执行或不可执行的项一律标注 **UNVERIFIED**，不读作通过；结转证据显式标注来源二进制代次。

---

## 3. R01–R30 双向追溯（compact）

- **说明**：`AT 证据代次`——**F** = `evidence/at-rerun3/`（二进制 `054040ba…`，= 当前产品树）；**R3** = `evidence/at-rerun2/`（`f5542857…`，wp-34c 后）；**R2** = `evidence/at-rerun/`（`c077db07…`，wp-34a 后）；**R1** = `evidence/at/`（`748ca730…`，初版）。结转代次已在 §7.4 审计。
- **DR 列约定**：DR-01（真实应用代码）、DR-04（按需求执行测试、禁止等价替换）、DR-05（未执行标 UNVERIFIED）、DR-07（仅 v0.1.0、无占位）、DR-08（input 只读、编号保留）为**跨切**适用（§6）；行内仅列特有 DR。
- R↔AT 为 30/30 一一对应（需求基线 §7.1，SRS §8.1/§8.3；本次未发现断链）。

| R | 组件（计划） | 关键实现路径 | 主要测试 | AT（代次） |
|---|---|---|---|---|
| R01 | C-04/06/09/10/12 | `src-tauri/src/commands/files.rs`、`services/files.rs`；`src/features/reader/open/entry.ts`、`src/app/events.ts` | `files_open.rs`(13)、`app_open_requests.rs`(7)、`entry.test.ts` | AT01（R1） |
| R02 | C-04/13 | `services/tree.rs`、`commands/tree.rs`；`src/features/reader/nav/FileTree.tsx`、`tree-model.ts` | `tree_listing.rs`(11)、`FileTree.test.tsx`、`tree-model.test.ts` | AT02（**F**） |
| R03 | C-04 | `services/files.rs`；`commands/files.rs` | `files_open.rs` | AT03（R1） |
| R04 | C-04/09/15/18 | `services/files.rs`（只读路径）；导出保护见 `commands`/`commands_surface` | `files_read.rs`(12)、`commands_surface.rs`（`export_protects_error_state_source_directories_too`） | AT04（R1） |
| R05 | C-12 | `src/features/reader/tabs/TabBar.tsx`、`reader-state.ts`、`ReaderScreen.tsx` | `ReaderScreen.test.tsx`、`reader-state.test.ts` | AT05（R3） |
| R06 | C-05/09/13 | `services/storage.rs`、`session.rs`、`commands/files.rs`（Restore）；`welcome/**`、`use-reader.ts` | `storage_session.rs`(6)、`storage_records.rs`(21)、`WelcomePage.test.tsx` | AT06（**F**） |
| R07 | C-04/06/12 | `services/watch.rs`；`use-reader.ts`（unavailable/relink）、`ReaderScreen.tsx` | `watch_registry.rs`(20)、`watch_runtime.rs`(2)、`ReaderScreen.test.tsx` | AT07（R2） |
| R08 | C-11 | `src/document/pipeline.ts`、`transforms/**`；`settings/sections/SyntaxSection.tsx` | `pipeline.test.ts`、`modes.test.ts` | AT08（R1） |
| R09 | C-11 | `src/document/sanitize.ts`、`SanitizedNode.tsx` | `single-trusted-html-entry.test.ts`、`pipeline.test.ts` | AT09（**F**） |
| R10 | C-11/15 | `plugins/katex.ts`；`inspect/MathBlock.tsx`、`FormulaPanel.tsx` | `katex.test.ts`、`FormulaPanel.test.tsx` | AT10（R1） |
| R11 | C-11/12/15 | `plugins/shiki.ts`；`inspect/CodeBlock.tsx`、`copy-feedback.ts` | `shiki.test.ts`、`CodeBlock.test.tsx` | AT11（R1） |
| R12 | C-11/12 | `plugins/mermaid.tsx`；`body/MermaidBlock.tsx`、`zoom/ZoomOverlay.tsx` | `mermaid.test.ts`、`MermaidBlock.test.tsx` | AT12（**F**） |
| R13 | C-12/03/07 | `body/ImageBlock.tsx`；`resources/resource-auth.ts`、`ResourceAuthDialogs.tsx` | `ImageBlock.test.tsx`、`resource-flow.test.tsx` | AT13（R1） |
| R14 | C-11/13 | `transforms/outline.ts`；`nav/OutlineTree.tsx`、`use-outline-tracking.ts` | `outline.test.ts`、`OutlineTree.test.tsx` | AT14（**F**） |
| R15 | C-11/03/04/08 | `ReaderScreen.tsx`（链接路由）；`open/entry.ts`、`services/opener.ts` | `ReaderScreen.test.tsx`、`entry.test.ts`、`mapping.test.ts` | AT15（**F**） |
| R16 | C-14 | `src/features/reader/history/history.ts`、`use-reader-history.ts` | `history.test.ts`、`ReaderScreen.test.tsx` | AT16（**F**） |
| R17 | C-14/11/04 | `src/features/search/search-core.ts`、`SearchBar.tsx`；`services/search.ts`；Rust `services/files.rs#search_source` | `search-core.test.ts`、`search-integration.test.tsx`、`contract_search_parity.rs`(5) | AT17（R3） |
| R18 | C-15/04/12 | `source/SourceView.tsx`、`source/mapping.ts`；`services/files.rs`（源码窗口） | `SourceView.test.tsx`、`mapping.test.ts`、`files_source.rs`(18) | AT18（R1） |
| R19 | C-11/12/05 | `position/position.ts`、`use-reader.ts`；`services/storage.ts` | `position.test.ts`、`ReaderScreen.test.tsx` | AT19（R3） |
| R20 | C-12/13/05 | `nav/NavPanel.tsx`、`nav-memory.ts`、`reader-state.ts` | `NavPanel.test.tsx`、`nav-memory.test.ts` | AT20（R1） |
| R21 | C-12/06 | `update/UpdateBanner.tsx`、`update-model.ts`、`use-reader.ts` | `UpdateBanner.test.tsx`、`update-model.test.ts` | AT21（R1） |
| R22 | C-06/12/10 | `services/watch.rs`、`view/resource-invalidation.ts`、`use-reader.ts` | `watch_runtime.rs`(2)、`resource-invalidation.test.ts`、`ReaderScreen.test.tsx` | AT22（R1） |
| R23 | C-16/10/05 | `settings/controls.tsx`、`TypographyPopover.tsx`、`SettingsDialog.tsx`；`services/settings.ts` | `SettingsDialog.test.tsx`、`TypographyPopover.test.tsx` | AT23（R1） |
| R24 | C-10–C-17（横切） | `components/SkipLink.tsx`、`Modal.tsx`、`Drawer.tsx`；`styles/base.css`、`tokens.css` | `Modal.test.tsx`、`Drawer.test.tsx`、`base-css.test.ts` | AT24（R1） |
| R25 | C-03/16/13 | `services/paths.rs`、`auth.rs`、`asset_scope.rs`、`commands/auth.rs`；`dialogs/AuthScopeDialog.tsx` | `security_paths_auth.rs`(26)、`tree_listing.rs`(11)、`AuthScopeDialog.test.tsx` | AT25（**F**） |
| R26 | C-07/16/12 | `services/resources.rs`、`commands/resources.rs`；`resources/RemoteImageDialog.tsx` | `remote_policy.rs`(26)、`RemoteImageDialog.test.tsx` | AT26（R3） |
| R27 | C-05/08/16 | `services/storage.rs`（`clear_records`）；`PrivacySection.tsx`、`ClearDataDialog.tsx`、`write-suppression.ts` | `PrivacySection.test.tsx`、`storage_records.rs`(21) | AT27（**F**） |
| R28 | C-08/16/10 | `services/diagnostics.rs`、`commands/diagnostics.rs`；`DiagnosticsPanel.tsx`、`ExportPreviewDialog.tsx` | `DiagnosticsPanel.test.tsx`、`ExportPreviewDialog.test.tsx`、`commands_surface.rs`（导出保护） | AT28（R3） |
| R29 | C-04/11/17 | `services/files.rs`；`document/modes/modes.ts`、`largeDoc/LargeDocDialog.tsx`、`SourceView.tsx` | `files_source.rs`(18)、`modes.test.ts`、`LargeDocDialog.test.tsx` | AT29（R1） |
| R30 | C-18/08/16/21 | `services/info.rs`、`commands/app.rs`；`settings/sections/AboutSection.tsx`、`About/LegalTextViewer.tsx`；`tauri.conf.json`（bundle） | `AboutSection.test.tsx`、`commands_surface.rs` | AT30（**F**；许可证/源码入口子项 OPEN） |

**反向（代码→需求）**：`src/`、`src-tauri/src/` 全部文件可归入组件图 C-01–C-21；未发现无需求/无 ADR/无维护依据的生产代码。`tests/**`、`fixtures/**` 归 C-19（NF11）；`scripts/**` 为框架工具，非产品件。**未发现孤儿需求、孤儿生产代码或断链**；唯一“链”缺口为 §7.4 的 AT 证据与现行修订的时效错配（证据侧，非需求/代码侧）。

---

## 4. NF01–NF12 验证状态

| NF | 证据（路径/修订） | 状态 |
|---|---|---|
| NF01 原文完整（零写入） | AT04 哈希/目录快照（R1 桌面，`at04-hash-diff.txt` 四段 IDENTICAL）；现行修订 `files_read.rs`(12) + 导出保护测试通过 | **满足（附结转条件）**：行为在现行修订有测试证据；桌面哈希证据为 R1 结转 |
| NF02 离线与隐私 | AT26 socket 级 0 请求（R3）；`remote_policy.rs`(26) 现行通过 | 满足（socket 替代口径）；**抓包级 UNVERIFIED** |
| NF03 内容安全 | AT09（F）+ `fixtures/security` + `single-trusted-html-entry` 2/2 + 安全评审 A 关闭 | 满足（现行修订） |
| NF04 启动与打开 | wp-32 §6.1（窗口映射代理，cold-start p95 127ms、cold-open 100KiB p95 129ms、warm 1MiB p95 106ms；n=30） | **校准（未认证）**：非基准机；首帧/冷缓存 UNVERIFIED |
| NF05 搜索与反馈 | wp-32a §3（修复后 1MiB 解析/索引 p50 885.6ms、首次查询 p50 10.61ms；密集命中 2333 时 p50 18.03ms；n≥10） | **校准（未认证）**：修复前超线性问题已修复；达标结论待基准机 |
| NF06 资源预算 | wp-32 §6.3（idle PSS 峰值 283.4MiB > 250MiB 预算；1MiB 425.7MiB；10MiB 压力 1318.9MiB） | **校准（未认证）**：idle 超设计预算；§8.4 要求的影响说明/目标评审**待执行** |
| NF07 稳定与取消 | `nf07_soak.rs` 500/500（本任务现行复跑通过）；桌面 30/30 短循环（历史） | 满足（行为验收） |
| NF08 持久化可靠性 | `migration_faults.rs`(12)、`storage_gating.rs`(8)、`storage_session.rs`(6) 现行通过；降级路径见 Change Impact note §5 | 满足（故障注入） |
| NF09 可访问性 | AT24（R1）+ 组件测试；200% 抽查通过、完整任务链/认证 UNVERIFIED | **部分/目标非认证** |
| NF10 运行兼容 | X11 实测（F 及其他代次）；Wayland 无会话 | **X11 满足；Wayland UNVERIFIED（A4）** |
| NF11 可测试边界 | `fixtures/**`、`tests/contracts/vectors/**`、锁文件（`pnpm-lock.yaml`、`Cargo.lock`）、契约套件 89 现行通过 | 满足 |
| NF12 发行一致性 | LICENSE/第三方声明/.deb 缺失（§9 G-02/G-03）；`sourceEntryUrl=null`+原因 | **OPEN（发布阻塞）** |

---

## 5. IT01–IT08（端到端验收场景）

- 状态：**全部 pending**——IT 运行是 wp-41 之后的下一任务（派发口径），**不记 missing**。
- 计划输入：Rev 4 release 二进制（或在发布候选上重建）；X11 `DISPLAY=:1` 任务链；证据目录 `evidence/it/**`；交付物 `acceptance-it.md`（计划 T-68）。

| IT | 任务链要点 | 计划依赖 | 预期限制（不得读作通过） |
|---|---|---|---|
| IT01 | 系统打开中文路径→选区→任务框→复制→关闭；哈希/目录集合不变 | AT01/03/04 证据与现行测试 | 拖放入口 UNVERIFIED（无法产生 XDND 源） |
| IT02 | 大纲→脚注→搜索→跨文档→后退 | AT14/15/16/17 | 前进分支清除等桌面细项 UNVERIFIED |
| IT03 | 选区下外部更新→稍后→源码→现在更新 | AT21/22/18 | 替换保存桌面演示 UNVERIFIED |
| IT04 | 乱序 v1/v2→关闭→旧任务完成 | 组件层乱序为主证据（AT22、watch/生成测试） | 桌面级近似 |
| IT05 | 断网/越界/远程图→拒绝→单次允许→撤销 | AT25/26 | 抓包级 UNVERIFIED（socket 替代）；断网命名空间不可用 |
| IT06 | 恢复多标签→移走源文件→清除记录→重启 | AT06/07/27 | — |
| IT07 | 键盘→大文件→搜索尾部→复制→200%→关抽屉 | AT24/29；200% 手段见计划 §5.3 | 200% 完整任务链/真实 IME UNVERIFIED |
| IT08 | 干净安装→系统打开→中文输入→关于→离线许可 | 发布候选（.deb 提取运行） | 真正干净安装不可用（无 sudo）；Wayland 侧 UNVERIFIED；“匹配源码入口可用”受 **A9 阻塞** |

---

## 6. DR-01–DR-08 状态

| DR | 证据 | 状态 |
|---|---|---|
| DR-01 实际应用代码 | `src/`、`src-tauri/` 可构建；EA-RUN（`early-run.md`）与 AT 证据在真实 release 二进制 | **DONE** |
| DR-02 尽早真实运行主阅读页并逐项核对 | `early-run.md`（wp-22/21）+ 后续 AT 走查 | **DONE** |
| DR-03 固定条件截图与检查 | acceptance Rev 1–4：X11、浅色、`text-scaling-factor=1.25`、1280×800/1600×900、截图+逐项观察 | **DONE（附限制）**：深色主题、200% 完整链等 UNVERIFIED |
| DR-04 测试执行；编译≠交互、截图≠视觉、浏览器≠桌面 | ADR-010 桌面协议；全部 AT 为真实应用运行；复审与桌面证据核对 | **DONE（附 §7.4 结转条件）** |
| DR-05 未执行检查标 UNVERIFIED | acceptance §6、unit §9、integration §8、wp-32a §8 的 UNVERIFIED 清单 | **DONE** |
| DR-06 最终交付物清单（源码/验证 .deb/测试结果/已知限制/使用说明/完整开源信息） | 源码与测试结果 DONE；`.deb`、LICENSE/THIRD_PARTY_NOTICES、README 完整版、对应源码入口 OPEN | **OPEN（阻塞，见 §9）** |
| DR-07 仅 v0.1.0；无占位 | 占位扫描 `at30-r4-placeholder-scan.txt`：NO MATCHES；F01–F07/UI08 未预置 | **DONE** |
| DR-08 input 只读、编号保留 | `input/` 三份权威来源 SHA-256 = 基线 pinned（`c991164f…`、`a6280863…`、`786096e3…`）；R/NF/AT 编号未改 | **DONE** |

---

## 7. 证据新鲜度与有效性审计

### 7.1 Pinned 输入与引用文件

- 7 项 pinned 输入 SHA-256 全部一致（表见页首）。
- acceptance Rev 4 引用的仓库内证据全部存在：`evidence/at-rerun3/` **89 PNG**、`runs.log` 4046 行、`build.log`、`app-binary.sha256`、`unit-suite-r4.log`（**547**）、`i18n-guard-r4.log`（6/6）、`at30-r4-placeholder-scan.txt`（NO MATCHES）、`superseded/`（3 张旧截图，已隔离）。
- integration 证据 `evidence/wp-40/`：`runs.log`、`session-db-dump.txt`、`app.log`（0 行）、4 PNG 存在。
- 复审与集成引用的临时日志（`/tmp/opencode/wp39-*.log`、`/tmp/opencode/wp40/*.log`）当前仍在磁盘；属仓库外一次性证据，非交付物（不影响判定；结论可由报告内命令复现）。

### 7.2 修订等价性与二进制归属

- `git rev-parse HEAD` = `b41a0d3`（rm-40 合并证据）；工作树干净。
- `git diff 5d977ea..HEAD -- src src-tauri` = **0 行**；`git diff f2f2a3d..HEAD -- src src-tauri` = **0 行**；`git diff dc63d9f..HEAD -- src src-tauri` = **0 行**。
- 磁盘二进制 `src-tauri/target/release/paperstack` SHA-256 = `054040bae1d6b041e184cf545a55e70ba150894cb1caeba4cfacbeef89ce1d9e`，与 `evidence/at-rerun3/app-binary.sha256` 一致（32,318,216 B；mtime 2026-10-07 22:34:52）。
- 结论：**Rev 4 桌面证据绑定的二进制与当前产品树字节一致**；integration 与复审所评的产品树均等于当前树。

### 7.3 本任务独立复跑（现行修订）

| 套件 | 命令 | 实测 | 期望（引用报告） | 结论 |
|---|---|---|---|---|
| 前端全量 | `pnpm test -- --run` | **71 files / 547 passed / 0 failed**；EXIT=0 | 547（integration §5.1） | ✓ |
| Rust 全量 | `cargo test --manifest-path src-tauri/Cargo.toml --offline` | **21 targets / 274 passed / 0 failed**；EXIT=0 | 274（integration §5.2） | ✓ |
| 契约/集成边界 | `pnpm vitest run --config tests/contracts/vitest.config.ts` | **6 files / 89 passed**；`Type Errors no errors` | 89（integration §3） | ✓ |
| 定向契约 | `--test commands_surface --test contract_search_parity --test contract_shape` | **20 / 5 / 3 passed** | 20/5/3（integration §3.1、复审 §2） | ✓ |

### 7.4 AT 证据时效分级（重要发现）

AT 判定按“最后一次成功执行所依据的二进制”分级（全部证据留在 `evidence/at*`，历史修订在报告内已声明）：

| 代次 | 二进制（SHA 前 8 位） | 构建修订 | 覆盖 AT | 数量 |
|---|---|---|---|---|
| **F（现行）** | `054040ba` | `5d977ea`（= 当前产品树） | 02、06、09、12、14、15、16、25、27、30 | **10** |
| R3 | `f5542857` | `f6e5608`（wp-34c 后） | 19、26、28 + 回归 05、17 | 5 |
| R2 | `c077db07` | `33dd600`（wp-34a 后） | 07 | 1 |
| R1 | `748ca730` | `613b465`（初版） | 01、03、04、08、10、11、13、18、20、21、22、23、24、29 | 14 |

- **事实**：30/30 判定存在，但**仅 10 项产自当前产品修订的二进制**；20 项为结转判定。acceptance Rev 4 §R4.3 以“修正未触及”支持结转；该判断是总体性的，**未逐项附差异审计**。
- **可证实的路径漂移（示例，`git diff f6e5608..5d977ea -- src src-tauri` 共 38 文件）：**
  - **AT07/AT19/AT21/AT22**：`src/features/reader/use-reader.ts`（B-06 `adoptRelinkResult`、B-07 `recheckOpenTabs`）、`ReaderScreen.tsx`、`src-tauri/src/commands/files.rs`（A-01）在最后一次桌面执行之后被修改——AT07 的 relink 子项、AT19 的位置/恢复链、AT21/22 的更新复核链直接位于改动面。
  - **AT26**：`src-tauri/src/services/resources.rs`（A-07 凭据拒绝、A-06 折叠措辞对应的折叠助手不改行为）、`commands/resources.rs`（A-04）在其 R3 执行后被修改。
  - **AT28**：`src-tauri/src/error.rs`（A-08 `details` 过滤）、`commands/storage.rs`（A-04）在其 R3 执行后被修改；导出保护的服务端语义在现行修订有 `commands_surface.rs` 测试证据。
  - **AT01/03**：`commands/files.rs`（A-01 Restore/grant 门）在 R1 执行后被修改。
- **缓解事实**：现行修订的单元/组件/契约/集成证据（§7.3）与复审 18/18 关闭（§7.6）覆盖了上述改动语义；Integration Gate 已在 `f2f2a3d` 产品树上以 PASS 授予。但按 DR-04 与“代码修改使受影响验证失效”的框架规则，桌面级结转判定不能自动等同现行修订的桌面验收。
- **结论**：记为 **G-01（条件）**——在 Release Stage Gate 前对结转 AT（至少上列 6 项，建议全部 20 项）在发布候选构建上做定向桌面复跑；或由 Orchestrator 记录一项显式接受（附逐项差异审计与理由），否则 AT 覆盖应表述为“10/30 现行、20/30 结转（未逐项复核）”。

### 7.5 过期/被取代的表述（文档级）

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| S-1 | `unit-integration-report.md` §4/§6/§8 | 数值 499/43/254 与 F-32-2/F-32-3“必须修复”为修复前状态；wp-32a/wp-32b 已修复（含修复后校准与共享向量清理），该文件未标注取代关系 | 在文档整理任务中加“Superseded by wp-32a/32b”指注；判定维持历史有效 |
| S-2 | `integration-report.md` §6 | “F-32-2/F-32-3 … 保持既有结论，属性能任务/基准机”表述过时；修正已落地，应引 wp-32a §3 的修复后校准，且仍属校准非认证 | 同上（文档级更正） |
| S-3 | `README.md`（根，wp-23 v0） | 声明“欢迎/最近、侧栏、搜索、源码视图、设置/隐私/关于/诊断、更新、锚点、大文档”等**尚未完成**，与现状（M4 完成、547 测试）不符；且称本地图片“允许加载路径未验证”（已被 AT13/AT25 覆盖） | README 完整版任务重写（G-04） |
| S-4 | `acceptance-at.md` §R4.3 等 | “修正未触及”总体性表述与 §7.4 的路径漂移事实不完全吻合；另引用“wp-41/45”为插入任务前的编号（现派发口径下 wp-41=本系统验证，许可证工作待 wp-42） | 以本报告 §7.4 与派发编号为准；复跑或显式接受 |
| S-5 | `review-rereview.md` §5.1 A-03 残余 | `delete` 成功后 runtime scope `forbid_*` 失败的残余形状（错误如实返回，非静默） | 作为已知残余跟踪（G-11，非阻塞） |

### 7.6 复审 18/18 映射抽查

- 计数确认：A-01…A-08（8/8）、B-01…B-10（10/10）= **18 VERIFIED / 0 PARTIAL / 0 NOT VERIFIED**；`gates/wp-39-gate.md` 以 PASS-WITH-NOTES 关闭。
- 抽查（现行修订，覆盖全部 18 项的代表点）：
  - A-01 `commands/files.rs:104-127,:153`（Restore 前置复核/不入 grant 块）、`services/auth.rs:221-236`、`security_paths_auth.rs:633`；A-02 `services/tree.rs:159-172`；A-03 `services/auth.rs:397-432`、`security_paths_auth.rs:790`、`services/asset_scope.rs:448`；A-05 `migration_faults.rs:146/205`（测试名存在）；A-06 `contracts.md` **Rev 2** + §2.1 逐码点 `foldLower`（第 16/80 行）；A-07 `resources.rs:133-149/169-188/710-716`；A-08 `error.rs:391-399`、`diagnostics.rs:346`、`payload_drops_non_allowlisted_details`。
  - B-01 `SanitizedNode.tsx:26`（全 `src/` 唯一 DSIH 生产站点）+ `single-trusted-html-entry.test.ts` 2/2；B-02 `sanitize.ts:100/119` + `pipeline.test.ts` 脚注往返用例；B-03 `pipeline.ts:51/60/95`；B-04 `DocumentInfoPanel.test.tsx` 4/4 + `ReaderToolbar.tsx:165-195`；B-05 `ReaderToolbar.tsx:266-272` + `ReaderScreen.test.tsx:1661`；B-06 `use-reader.ts:937-970` + `ReaderScreen.test.tsx:1672`；B-07 `use-reader.ts:1637-1642` + `:1708`；B-08 `mermaid.tsx:94-103`；B-09 `no-hardcoded-strings.test.ts` 扫描目录/白名单；B-10 `sanitize.ts` 仅 `LANGUAGE_CLASS_PATTERN` + `katex.test.ts`。
- 结论：18 项均映射到现行修订的真实文件与命名测试；复审结论对本报告有效。

### 7.7 Producer 元数据审计（Spot audit，全树机械扫描）

- `artifacts/**/*.md`（排除 `evidence/`）在本任务前共 **132** 个受管文档；逐文件提取元数据区 Producer 行，**132/132 声明 Producer，无缺失**（含本次新增报告共 133）。
- 逐文件元数据分布：`agent:repository-manager` 41（40 份 merge 记录 + `repo-prep-01.md`）、`orchestrator:main-session` 40（40 份 Gate 记录，Deviation 声明符合框架规则）、`agent:implementation-engineer` 22、`agent:solution-architect` 16、`agent:quality-reviewer` 3、`agent:test-engineer` 2、`agent:experience-designer` 2、`agent:requirements-analyst` 1、`agent:asset-analyst` 1、`agent:system-modeler` 1、`agent:delivery-planner` 1、`agent:technical-writer` 1、`agent:integration-engineer` 1、`agent:system-verifier` 1（本报告）。
- 40 份 gate + 40 份 merge + `repo-prep-01.md` 均有 Producer；无未声明偏离。

---

## 8. Release Stage 就绪（对照 SRS §8.4）

| §8.4 条件 | 现状 | 判定 |
|---|---|---|
| 1. R01–R30 全部本版验收与 NF01–NF12 适用检查**有结果** | AT 30/30 判定存在（10 项现行、20 项结转，§7.4）；NF 全部有结果（NF04–06/09 校准、NF10 Wayland/NF02 抓包级 UNVERIFIED） | **部分满足**（附 G-01 时效条件） |
| 2. 源码保护、权限、安全、版本误标、核心任务崩溃**为零** | AT04 零写入（R1 结转 + 现行单测）；安全评审 18/18 关闭；NF07 无崩溃；无未修复 FAIL | **满足（现行证据）** |
| 3. 真实安装包与源码版本、资源清单、许可证一致 | 无 `.deb`、无 `LICENSE`/`THIRD_PARTY_NOTICES.md`；资源随包与元数据一致未验 | **未满足**（G-02/G-03） |
| 4. 公开声明仅覆盖已实际验证的系统与格式 | 限制清单已存在于 acceptance §6 / unit §9 / integration §8；发布文档须携带同一限制 | **待执行**（发布文档） |
| 5. 不能执行时登记环境阻塞，不视为通过 | 各报告 UNVERIFIED 清单齐备且一致 | **满足** |
| 6. 性能预算未达标说明影响并评审目标 | NF06 idle PSS 校准超 250MiB 预算、NF04/05 未认证；影响说明/目标评审未落档 | **待执行**（G-08） |

---

## 9. 缺口清单

> 级别：**B**=Release Stage Gate 阻塞（未关闭前 Gate 不可通过）；**C**=条件（应在 Gate 前关闭或显式接受）；**N**=非阻塞跟踪。

| ID | 缺口 | 证据/路径 | 归口（剩余 wp） | 阻塞？ |
|---|---|---|---|---|
| G-01 | AT 结转证据时效：20/30 判定非现行二进制；AT07/19/21/22/26/28 等改动面可证实（§7.4） | `acceptance-at.md` §R4.3–R4.6；`evidence/at*`；`git diff f6e5608..5d977ea` | 下一桌面/IT 任务定向复跑，或 Orchestrator 显式接受 + 差异审计 | **C（建议按 B 处理，Gate 前关闭）** |
| G-02 | `LICENSE`（未改写 GPLv3 全文）与 `THIRD_PARTY_NOTICES.md` 缺失；AT30 许可证查看器「找不到文件或资源。」（预期） | 仓库根无此二文件（2026-10-07 实测）；`at30-r4-c` | **wp-42 许可/打包** | **B** |
| G-03 | `.deb` 安装包未产出；包元数据/离线资源/提取运行/干净安装未验 | 无 `*.deb`、无 `bundle/` 目录 | **wp-42（打包）**；干净安装受环境限制（见 G-10） | **B** |
| G-04 | README 完整版未产出；现 README v0 内容过期（§7.5 S-3） | `README.md`（wp-23） | README/文档任务（wp-42/后续） | **B（DR-06）** |
| G-05 | IT01–IT08 未执行 | 无 `acceptance-it.md`/`evidence/it/**` | **下一任务（派发口径）** | **B（发布完成条件）** |
| G-06 | **A9 对应源码入口**未配置；`sourceEntryUrl=null`+原因已在产品中诚实呈现 | `services/info.rs`；`checkpoint` CP-03；验收 §6 | **所有者输入**（Orchestrator 澄清门） | **BLOCKED（owner）** |
| G-07 | **A4 Wayland** 会话不可用；NF10/R30/AT30/IT08 的 Wayland 侧 | `acceptance-at.md` §6；计划 §5.5 | 环境（所有者/未来会话） | **BLOCKED（环境）**；公开声明受限 |
| G-08 | NF04–NF06/NF09 达标未认证；NF06 idle 超预算需影响说明与目标评审（§8.4-6） | wp-32 §6/§9；wp-32a §3/§8 | 发布就绪评审（wp-44）/所有者；基准机复测 | **C（发布声明条件）** |
| G-09 | 字符串目录增量对账（381 键；`largeDoc.hardLimit` 备注）+ 文档过期表述 S-1/S-2/S-4 | `wp-34a-fixes.md` §4、`wp-36a…`、gate 路由记录 | 文档/目录任务（wp-42 路由） | N |
| G-10 | 环境受限子项：抓包级零请求、真正干净安装、WebDriver、拖放、复制失败路径、映射回退文案、前进分支清除、面板状态记忆、2000 截断/节点状态、横滚触发、GIF/WebP、替换保存、深色主题/真实 IME、200% 完整链 | acceptance §6（逐项） | 环境/未来补验 | N（公开声明须排除） |
| G-11 | A-03 残余：scope `forbid_*` 失败路径的半撤销形状（错误如实返回，非静默） | `review-rereview.md` §5.1 | 后续加固任务（非 v0.1.0 阻断） | N |
| G-12 | AT30 许可证查看/关于页许可内容与源码入口子项未关闭 | 同 G-02/G-06 | wp-42 / 所有者 | **B**（并入 G-02） |

---

## 10. 建议（Recommendation）

### 10.1 判定

**PASS-WITH-CONDITIONS** —— 允许进入**最终发布准备**（许可/打包 → README/文档 → IT 运行 → 发布就绪评审 → 最终验收）。**Release Stage Gate 当前不可通过**：G-02/G-03/G-04/G-05（及 G-12）未关闭，G-06 为所有者输入阻塞，G-01/G-08 为 Gate 前需处理的条件。

### 10.2 条件（Gate 前关闭或显式接受）

- **C1（G-01）**：在发布候选构建上对结转 AT 做定向桌面复跑（至少 AT07、AT19、AT21、AT22、AT26、AT28；建议全部 20 项）；或在 Checkpoint 记录 Orchestrator 的显式接受，并附逐项“修正→AT 影响”差异审计。
- **C2（G-02/G-03/G-12）**：加入未改写 GPLv3 全文与 `THIRD_PARTY_NOTICES.md`（与锁文件核对）；产出 `.deb`，核对包元数据/离线资源/许可一致性；在包上复验 AT30 许可查看器。
- **C3（G-05）**：执行 IT01–IT08（X11 可覆盖部分），证据落 `evidence/it/**`；环境受限子项按 §5 标注。
- **C4（G-04/G-09）**：README 完整版（命令复跑、已知限制、许可位置）；清理 S-1…S-4 的过期表述并完成字符串目录对账。
- **C5（G-08）**：NF04–NF06/NF09——在基准机复测，或按 SRS §8.4/§9.2 落档影响说明与目标评审（校准数据不得写成达标）。
- **C6**：发布文档与公开声明携带 §9 G-07/G-10 的限制（Wayland/抓包级/干净安装/性能认证等），排除未验证项。

### 10.3 显式 BLOCKED

- **B1（G-06，A9）**：对应源码入口需所有者提供真实可访问 URL；未提供前按 R30/NF12 记录发布阻塞，**不放伪地址**，公开发行不能宣告。
- **B2（G-07，A4）**：无 Wayland 会话 → Wayland 侧验收维持 UNVERIFIED；公开发布声明相应受限。

### 10.4 排除与边界

- 本报告**不构成**用户验收（用户价值判断未发生）；不构成 Release Stage Gate 裁决（归 Orchestrator）；未执行任何发布/打包动作；性能数值均为本机校准、非认证。
- 验证判定仅对修订 `b41a0d3` 有效；其产品树与 `5d977ea`（验收二进制）、`f2f2a3d`（集成）、`dc63d9f`（复审）字节等价（§7.2）。上游变更或修复提交后须按 Change Impact 重验。

**NEXT_ACTION**：Orchestrator 按 §10.2 派出剩余工作包（许可/打包 wp-42 → IT 运行 → 文档 → 发布就绪与最终验收），并在 Checkpoint 记录 C1 的处置（复跑或显式接受）与 B1/B2 状态。

---

## 11. 变更记录与追溯

### Rev 1 — 2026-10-07（wp-41-sysver）

- **Producer** `agent:system-verifier`；只读验证修订 `b41a0d3`；方法见 §2；独立复跑证据（本机 2026-10-07）：前端 547、Rust 274、契约 89、定向 20/5/3。
- **承接条款**：计划 §6.3（T-67 系统验证）、§5.5（UNVERIFIED 纪律）、§8（最小必要路径）、§9（追溯）；需求基线 §7（R/NF/DR 追溯）、§8.4（发布条件）；`gates/wp-40-gate.md`（集成 PASS → 进入系统验证）。
- **输入**：本报告页首 7 项 pinned + 仓库树、`gates/wp-38/39/40`、`evidence/at*`、`evidence/wp-40`、`tests/**`、`fixtures/**`。
- **结论**：PASS-WITH-CONDITIONS；缺口 G-01…G-12；阻塞 B1（A9，owner）/B2（A4，环境）。
