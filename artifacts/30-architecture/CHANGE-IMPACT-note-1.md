# 纸栈 PaperStack · 架构文本同步变更影响（Change Impact note-1）

- **Producer**: agent:solution-architect
- **Artifact ID**: ART-30-CHANGE-IMPACT-1
- **Artifact Type**: Change Impact Record（A-06 折叠措辞、security-model §5.2 脚注 schema 同步、A-05 降级口径的记录）
- **Status**: VALID
- **Revision**: 1
- **Owner**: solution-architect
- **Task**: `wp-37-note`（任务分支 `task/wp-37-note`；父分支 `feat/v0.1.0`；基线提交 `12ffa9ce14a1dd9a8ab0e2ddc890f816e84bb2f1`；产出提交主题 `docs(architecture): sync fold wording and sanitize schema notes`）
- **Last Verified**: 2026-10-07
- **Scope**: `artifacts/30-architecture/`：编辑 `contracts.md`、`security-model.md`，新增本文件。未修改代码、测试、接口、配置、pinned 输入或其它 Artifact。

## 1. 摘要（结论先行）

- 本次为**文档同步**：把 `contracts.md` / `security-model.md` 的规范文本对齐到**已实现且已被共享证据接受**的语义（无代码/接口/行为变更）；同时按 A-05 记录 v0.1.0 的存储降级口径。
- **受影响代码：NONE**——实现早于本次同步已符合（提交与测试证据见 §3）。
- **下游证据：无一作废**——验证与评审证据以其评估的代码修订为对象，行为未变（见 §4）。
- **契约身份不变**：`Contract ID` 仍为 `paperstack-ipc-r1`；仅 Artifact `Revision` 提升（1→2）标记此次文本同步。
- 残余开放项（A9、A4）状态不变，仍由 Orchestrator 持有（见 §6）。

## 2. 变更项（前 → 后）

| Artifact | 修订 | 位置 | 变更 | 语义类别 |
|---|---|---|---|---|
| `contracts.md` | Rev 1 → Rev 2 | §2.1 `search_source` 条款 | “按与前端一致的 `toLowerCase` 折叠” → “按与前端一致的逐码点 `foldLower` 折叠（逐码点 Unicode 默认小写，双方一致；无 Final_Sigma 上下文规则；不做归一化；与共享向量 `foldingRule` 一致；İ 等长度变化折叠按 `boundaryCases` 逐侧固定，属 ADR-007 已接受项）” | 措辞修正（规范文本与既有实现/共享向量对齐；无行为变化） |
| `contracts.md` | — | 头字段 | `Revision: 2` + “变更记录”行 | 元数据 |
| `security-model.md` | Rev 1 → Rev 2 | §5.2 `a` 行 | 增加 `id`：`^ps-fn(ref)?-[A-Za-z0-9-]+$`（仅脚注回引锚点）；`href` 注明含脚注回引 `#ps-fn(ref)-…` 片段 | 同步已实现的脚注回引支持（B-02 上游行文） |
| `security-model.md` | — | §5.2 GFM 脚注行 | `li id` 精确为 `^ps-fn-[A-Za-z0-9-]+$`；`a id` 与 `a href` 片段匹配 `^ps-fn(ref)?-[A-Za-z0-9-]+$` | 与实现逐字对齐（最小安全） |
| `security-model.md` | — | §5.2 增补说明 | D-3 增量（`math-inline`/`math-display`）已移除：`code` className 仅 `^language-…$`，严格 §5.2 即可渲染 `$x^2$`/`$$y$$` | 登记已移除的门禁增量（B-10） |
| `security-model.md` | — | 头字段 | `Revision: 2` + “变更记录”行 | 元数据 |

**完整性核对（旧 → 新 SHA-256）**：

| Artifact | Rev 1（前） | Rev 2（后，本次提交） |
|---|---|---|
| `contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | `f4b15984927bc4d7ed4b0665b3e3234e0e5ef36e63d51dc9fe808fd80efd644d` |
| `security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | `b00228bdff8fdfb77c003ad97adb59875e662f69f4fb354b6a9ce122ffdd330f` |

Rev 1 字节可从 git 历史 `6355995`（两文件自创建后至本次未改）与本任务快照 `refs/swe/snapshots/20261007T142659Z-wp-37-note-3ff4a3fc`（覆盖 `artifacts/30-architecture/`）恢复。

## 3. 受影响代码：NONE（实现已符合，证据如下）

### 3.1 搜索折叠（A-06）

- 前端：`src/features/search/search-core.ts` `foldLower`（逐码点；无 U+03A3 时整串快速路径等价）；单测 `folds Greek sigma per code point, not with Final_Sigma context (F-32-1)`、`does not apply the context-sensitive Final_Sigma rule`、`keeps the accepted length-changing İ fold`。
- Rust：`src-tauri/src/services/files.rs` `fold_segment`/`fold_query`（`char::to_lowercase` 逐码点）。
- 共享向量：`tests/contracts/vectors/search-parity.json` 的 `foldingRule`（逐码点 Unicode 默认小写、禁用整串 `toLowerCase`、无归一化）+ `cases.greek-final-sigma-per-code-point` + `boundaryCases.dotted-capital-i-length-changing-fold`；两侧执行器 `tests/contracts/search-parity.test.ts`、`src-tauri/tests/contract_search_parity.rs` 读同一向量同断言。
- 提交：wp-32a `836046a`（前端对齐逐码点折叠、向量 `foldingRule` 定稿；合并 `0fd3622`）；wp-32b `06534f0`（清除已解决分歧壳；合并 `cffd373`）。既有复跑证据：wp-35a 报告 §4（`contract_search_parity` 5/5、前端契约套件 44/44）。
- 本次同步后复核（2026-10-07，只读）：`cargo test --manifest-path src-tauri/Cargo.toml --test contract_search_parity --offline` → 5 passed/0 failed；`pnpm vitest run --config tests/contracts/vitest.config.ts` → 4 files/44 passed。文本修正与共享向量一致，无行为变化。
- 结论：契约文本修正为已实现语义；**无需代码变更**。

### 3.2 脚注回引 schema / D-3 增量（B-02 / B-10）

- `src/document/sanitize.ts`：`a: ['href','title',['id', FOOTNOTE_REF_ID_PATTERN]]`，`FOOTNOTE_REF_ID_PATTERN = ^ps-fn(ref)?-[A-Za-z0-9-]+$`；`li.id` 保持 `^ps-fn-[A-Za-z0-9-]+$`；D-3 的 `math-(inline|display)` 备选已删除，`code` className 仅 `LANGUAGE_CLASS_PATTERN`。
- 测试：`src/document/pipeline.test.ts` `keeps every fragment href resolving to an existing id (B-02 footnote round-trip)`、`admits only footnote-shaped ids on links`；`src/features/reader/ReaderScreen.test.tsx` `returns to the exact reference through footnote back-references (B-02)`；`src/document/plugins/katex.test.ts` `renders math under the strict §5.2 code-class schema (B-10: no D-3 delta)`。
- 提交：wp-36a `04ef5a1`（合并 `2198204`）；Gate `artifacts/00-repository/gates/wp-36a-gate.md` 的 “Routed (architect note task)” 即本次同步。
- 结论：安全模型文本同步为已实现 schema（B-02 方案 (a) 的上游行文）；**无需代码变更**。

### 3.3 A-05 相关实现（既有，供 §5 口径引用）

- `src-tauri/src/state.rs`：`Storage::open_with_degrade` 生产调用；只读降级时 `record_app_error`（`PS_DB_MIGRATION`）+ `storage_read_only_degrade` 诊断事件；迁移故障测试 `newer_schema_revision_is_refused_read_write_and_readable_in_read_only_degrade`、`storage_open_degrade_ladder_prefers_read_write_and_reports_corruption`。
- 前端：`update_settings` 失败 → `persisted=false` + error → `settings.saveFailed` = “本次已生效，但未能保存到本地”（`src/locales/zh-CN.json:229`；`src/features/settings/controls.tsx`）。
- 提交：wp-35a `34ce447`（合并 `c0ab7b9`；Gate `artifacts/00-repository/gates/wp-35a-gate.md`）。

## 4. 下游证据影响：无作废

- **验证证据**（`unit-integration-report.md`、`acceptance-at.md` 等）绑定其评估的代码修订；本次不改代码/行为，判定与结论保持有效。
- **评审 A/B**：`review-a-rust-security.md`（修订 `aac72e1`）与 `review-b-frontend-pipeline.md`（修订 `00259fe`）的判定、发现与证据保持有效；两报告路由的文本债（A-06；B-02 的 §5.2 上游行；B-10 的 D-3 记录；A-05 口径）由本次同步关闭/记录，可作为其修复清单对应项的输入。
- **pinned 引用**：两份评审与 `unit-integration-report.md` 的 pinned 输入表引用 Rev 1 哈希（历史事实，保持准确）；后续 Artifact 校验与复审应以 Rev 2 哈希为准。
- **状态**：无新增 `STALE`/`UNVERIFIED`/`FAILED`；无 Component 需要重新验证；Minimum Necessary Path 不变。
- **已核对、未修改**：`rendering-pipeline.md`（不含折叠措辞，不受影响）；`ADR-007-search.md`（该决策的历史记录；其 `toLowerCase` 表述指“两侧同一小写折叠”语义，规范性以 `contracts §2.1` 与共享向量 `foldingRule` 为准；本次未改）；`data-model.md`、`architecture.md` 未涉及。

## 5. A-05 口径记录（NF08 降级与“重建本地数据库”）

- v0.1.0 **不提供**“重建本地数据库”命令（38 条命令中无此入口）；任何此类命令**明确不在 v0.1.0 范围**，如后续产品决定恢复该入口，须走 `paperstack-ipc-r2` + Change Impact。
- 存储只读降级（数据库版本更高/不可写）已由 wp-35a 接线（§3.3）：只读加载记录、写入失败如实报错；其用户可见面沿用既有**设置保存失败**通道（“本次已生效，但未能保存到本地”，R23）与**诊断记录**（`PS_DB_MIGRATION` + `storage_read_only_degrade`），未新增专用降级面板或命令。
- 本记录即架构侧对评审 A A-05 的处置留痕；`data-model.md` §4.4/§4.5 的“重建”入口如需落地属 r2 范围，不在 v0.1.0。

## 6. 残余项（均未被本次同步作废）

- **A9 源码入口（发布阻塞）**：仍待所有者提供真实入口；按 R30/NF12 诚实记录（`sourceEntryUrl=null` + 原因）；由 Orchestrator 持有（`state/checkpoint.md` CP-03 开放项）。
- **A4 Wayland**：无 Wayland 会话，相关验收行保持 UNVERIFIED；由 Orchestrator 持有（CP-03 开放项）。
- 本同步不新增、不作废任何残余项；Review A′/B′ 复审与桌面复跑等仍按既有路由执行。

## 7. 输入与核验（2026-10-07）

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/60-review/review-a-rust-security.md` | `72a45b48ad53c33e820f065136d97dfed3ca29b71b0235bef6cca689d98b21e7` | ✓ |
| `artifacts/60-review/review-b-frontend-pipeline.md` | `68515a88d0a1a6b431a25386b288c0b06737ba3bd511c21c34459a2f1dbc596d` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a28be026338af865bb6b9725785cdfcd08ce4ca2fd137bb9d70143919` | ✓ |
| `artifacts/30-architecture/adr/ADR-007-search.md` | `b8e56f8d267cf864d8814782e14fd45e6dd349fc4f3740eebb14cd524e625db1` | ✓ |

- 实现核验方式：只读阅读 `src/document/sanitize.ts`、`src/features/search/search-core.ts`、`src-tauri/src/services/files.rs`、`src-tauri/src/state.rs` 与所列测试/向量；未执行写操作。
- 汇编：本文件与 `contracts.md`、`security-model.md` 的 Rev 2 修订同属一个提交（`docs(architecture): sync fold wording and sanitize schema notes`）。

## 8. 追溯

| 条款 | 本文承接 |
|---|---|
| Review A §3 A-06、§10.2 A-06 清单 | §2/§3.1 折叠措辞同步；Revision 提升；Change Impact 登记 |
| Review A §3 A-05、§10.2 A-05 清单 | §5 降级口径与“重建”入口范围 |
| Review B §3 B-02（方案 (a)）、B-10 | §2/§3.2 §5.2 schema 同步与 D-3 移除记录 |
| `artifacts/60-implementation/wp-35a-fix-rust.md` §2.5/§5、`wp-36a-fix-frontend.md` §2.2/§2.7/§4 | 实现与测试证据（提交 `34ce447`、`04ef5a1`） |
| `state/checkpoint.md` CP-03 | 残余开放项 A9/A4（由 Orchestrator 持有） |
