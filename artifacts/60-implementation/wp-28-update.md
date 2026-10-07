# 纸栈 PaperStack · wp-28 更新、锚点与大文档流程实现报告（Update, Anchor & Large-Document）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP28
- **Artifact Type**: Implementation Evidence Report（T-51–T-55 实现证据；wp-28 + wp-29 合并任务）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-28-update`（任务分支 `task/wp-28-update`；父分支 `feat/v0.1.0`；基线提交 `992096beb1fe192717ca1f007a25d5b2d4dda758`；产出提交主题 `feat(reader): add update, anchor and large-document flows`）
- **Components**: 大文档模式选择/简化阅读/源码窗口（`src/document/modes/**`、`src/features/reader/largeDoc/**`、pipeline 简化子集）；更新流程（`src/features/reader/update/**`、`use-reader` keep/follow 引擎）；版本正确性接线（`src/features/reader/view/**`、`ImageBlock`、relink 采用、关闭/迟到丢弃）；锚点保存/恢复（`src/features/reader/position/**` + ReaderScreen 接线）；测试夹具 `fixtures/update/**`。
- **Scope**: `src/**`、`fixtures/**`、`artifacts/60-implementation/**`（本报告）。未修改 `package.json`、`pnpm-lock.yaml`、`src-tauri/`、`src/locales/zh-CN.json`、pinned 输入或其他 Artifact；无新增依赖。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-28-update.json` 逐字一致，只读未改）：

| 输入 | SHA-256（前 8/后 8） | 一致 |
|---|---|---|
| `artifacts/35-models/session-and-version-models.md` | `65c36022…8568e1fad` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…f6c3ac88a` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a…d70143919` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817a…49052e28` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…6a8b02967f` | ✓ |

基线 `992096b`；分支 `task/wp-28-update`；全部产出均在 handoff `writes`（`src/`、`fixtures/`、`artifacts/60-implementation/`）范围内。文案全部取自冻结的 `src/locales/zh-CN.json`（378 键，未新增/删除，`i18n.keys.test` 通过）。

## 2. 交付物与文件清单

### 2.1 新增（实现）

| 路径 | 内容 |
|---|---|
| `src/document/modes/modes.ts`（handoff 交付物） | 阈值与复杂度预算：`LARGE_DOC_THRESHOLD_BYTES`（10MiB 冻结）、`HARD_LIMIT_BYTES`（50MiB 冻结）、`COMPLEXITY_BUDGET`（建议初值，可校准，非验收阈值）；`classifyLargeDocument`（硬上限 > 尺寸提示 > 复杂度提示 > full）；`resolveLargeDocChoice`（取消 → null，无幽灵标签）；`largeDocHonesty`（文本/渲染/索引完整性 + 徽标/覆盖说明键；source window 的 `indexComplete` 跟随 `search_source.complete`）；`simplifiedParseOptions` |
| `src/features/reader/largeDoc/LargeDocDialog.tsx` | 打开前模态：简化阅读 / 只读源码 / 取消；尺寸消息 `largeDoc.message`（`formatBytes`）；复杂度原因附 `error.limit.complexity`；覆盖说明 `largeDoc.coverage`；初焦点=简化阅读（安全默认）；Esc=取消 |
| `src/features/reader/update/update-model.ts` | keep/follow 决策总函数（无 pending → none；keep → 横幅；follow：后台 → 暂存、选区 → 暂停(selection)、检查层 → 暂停(inspect)、全部满足 → 提交）；`selectUpdateBanner`（hidden/banner/paused/collapsed + `更新并清除选区` 明确动作键）；`positionMessageKey`/`updatePositionForRestore`/`effectiveUpdateMode`/`pausedMessageKey` |
| `src/features/reader/update/UpdateBanner.tsx`（handoff 交付物） | 非模态 `Banner role=status`：`update.banner` + 现在更新/稍后；有选区时主按钮为 `更新并清除选区`；暂停态 `update.paused.*` + 继续阅读；折叠态为可再次展开的“有新版本”文本标记；不抢焦点 |
| `src/features/reader/position/position.ts`（handoff 交付物） | `AnchorRecord` 构建（仅 contract §3.4 五字段，ratio 0..1 归一）；§6.2 恢复决策树（同版本 sourceRange 精确；唯一指纹+同标题路径精确；重复指纹/多候选/章节删除 → 近似；唯一标题路径/最近可信祖先/顶部）；`PositionController`（每标签内存储 + ≥2s 节流（`POSITION_WRITE_INTERVAL_MS=2000`，data-model §3.3 下限）+ 抑制/`rememberRecords` 门禁 + 失败上报/重试 + flush 提交边界）；`LayoutStabilizer`（≤1 次/布局变化的合并校正，建议延迟 200ms = P-02） |
| `src/features/reader/view/resource-invalidation.ts` | `kind=resource` 失效存储：按 `check_resource_access` 返回的 canonicalPath 精确匹配 raw `src` 并只 bump 该项；未匹配（占位期间）回退到文档级 revision（仅本文件图重新解析）；订阅通知供 `useSyncExternalStore` |
| `fixtures/update/v1.md`、`v2.md` | 小型确定性 v1/v2 对（共享一段同文字锚点段落，另有差异），供测试与后续真实 save-replace 场景使用 |
| `fixtures/update/replacement-save.md`、`README.md` | rename-over 替换保存场景脚本注释（在 /tmp 副本上操作，不修改 fixtures）与夹具说明 |

### 2.2 修改

| 路径 | 变更 |
|---|---|
| `src/document/types.ts` | `ParseDocumentOptions.simplified` / `ResolvedPipelineOptions.simplified`（简化子集开关） |
| `src/document/pipeline.ts` | 简化模式跳过 ⑧KaTeX/⑨Shiki/⑩Mermaid 引擎槽；块/分段/源映射与完整管线一致（§5“同一管线的子集”） |
| `src/features/reader/reader-state.ts` | 新增 `ReaderPhase='largeDoc'`、`largeDocMode: 'full'|'simplified'|'sourceWindow'`、`tab/largeDoc` action；docReplace 复位模式 |
| `src/features/reader/use-reader.ts` | 集成核心：打开时大小分类（提示/硬上限源码窗口/正常）；`chooseLargeDoc`/`cancelLargeDoc`；>50MiB `startSourceWindow`（`get_source_info` 版本，不读全文）；解析后复杂度提示（每版本一次，取消不重复弹）；`commitUpdate`（pending 预解析 → §6 stale 校验 → `sessionUpdateCommitted(position)` → 成对恢复锚点记录 → 成功 Toast）；follow 自动提交条件与后台暂存/激活复核；选区（`selectionchange`）与检查层暂停；稍后折叠/再次展开；连续候选合并交由 session reducer；`handleWatchChanged` 资源事件走失效存储；relink 采用（同字节恢复身份 / 异字节先说明后采用 + 近似位置）；关闭标签/取消使在途任务失效；位置 observe/flush/错误/重试；布局校正 tick；`syncGlobalSettings` 消费 wp-27 的 `updateModeDefault`/`rememberRecords` |
| `src/features/reader/ReaderScreen.tsx` | 大文档对话框宿主；`UpdateBanner` 宿主 + 成功 Toast（`update.position.*`，1.5s，成对滚动到恢复块/顶部）；简化/源码窗口徽标与覆盖说明横幅（可关闭）；`document.position.notSaved` 失败横幅 + 重试；`main.onScroll` 生成并观察 AnchorRecord；单一布局校正 effect；检查层开关同步；资源事件不再触发文档横幅；全局快捷键/事件桥改用 `useLayoutEffect`（挂载即生效） |
| `src/features/reader/body/DocumentView.tsx` | `simplified` 上下文传入图片块（重型内容保持源码/占位） |
| `src/features/reader/body/ImageBlock.tsx` | 订阅资源 revision 重新 `check_resource_access`（Rust 生成的新 `?v=` URL 绕过 WebView 缓存），`key=assetUrl` 重挂该图；简化模式纯占位 + alt、不做解码/网络；加载完成通知布局校正 |
| `src/features/reader/toolbar/ReaderToolbar.tsx` | 新增 `modeBadge`（`document.badge.simplified` / `document.badge.sourceOnly`，VC-18 文本状态标签） |
| `src/features/reader/ui-context.tsx` | `ReaderUi.notifyLayoutChange?()`（图片解码等布局变化上报） |
| `src/components/Toast.tsx` | `onDismiss` 存入 ref：自动消失计时不再因父级重渲染的新函数标识而重置（VC-13 短暂成功提示） |
| `src/features/search/search-integration.test.tsx` | 既有 Ctrl+F 偶发丢事件（基线复现见 D-28-7）在测试夹具中显式 `await act(async () => {})` 冲刷挂载效果后派发 |
| 测试更新 | `ReaderScreen.test.tsx`（keep 提交/稍后/跟随/后台/选区/检查层/资源事件/关闭迟到/源码版本/大文档提示/取消/硬上限/候选合并/滚动保存/relink 新版本）、`reader-state.test.ts`（tab/largeDoc）、`pipeline.test.ts`（简化跳过引擎且块/分段一致） |

## 3. 验证命令与结果（工作目录 = 项目根；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit`，无诊断 | 0 |
| 2 | `pnpm lint` | `eslint .`，无诊断（含 react-hooks v7 `refs`/`preserve-manual-memoization` 修正） | 0 |
| 3 | `pnpm test -- --run` | **Test Files 64 passed (64)；Tests 455 passed (455)**（基线 383 + 新增 72），Duration ≈13.7s | 0 |
| 4 | `pnpm build` | `tsc && vite build`，`✓ built`（仅既有 >500 kB chunk 提示，非错误） | 0 |

测试无 `skip`/`only`；新增用例均为确定性（假计时器仅用于节流/校正纯类，服务与 watch 事件用 mock + `findBy*/waitFor`）。全量套件连续多轮复跑验证：最终稳定化后连续 12 轮 455/455 通过（其中 1 轮为下述罕见负载抖动，见 §6 D-28-13）。

## 4. 测试清单（新增 72）

| 测试文件 | 用例数 | 覆盖 |
|---|---|---|
| `src/document/modes/modes.test.ts` | 9 | 10MiB 边界、复杂度预算、50MiB 硬上限优先、选择映射、诚实标注（部分渲染必有徽标）、索引完整性跟随扫描、简化选项 |
| `src/features/reader/position/position.test.ts` | 14 | AnchorRecord 字段/裁剪/拷贝、同版本 sourceRange 精确、唯一指纹+标题精确、标题不一致降级、重复指纹歧义不精确、标题/祖先/顶部近似、≥2s 节流与最新锚点、抑制无写无错、`rememberRecords=false` 仅内存、失败可见+重试、≤1 次布局校正与 dispose |
| `src/features/reader/update/update-model.test.ts` | 14 | keep/follow 全矩阵（含后台、选区优先、检查层）、横幅选择（hidden/banner/paused/collapsed/提交后隐藏）、明确清除选区动作、暂停文案键、精确/近似消息键、会话覆盖模式 |
| `src/features/reader/update/UpdateBanner.test.tsx` | 5 | hidden 空渲染、非模态与不抢焦点、现在更新/稍后、更新并清除选区、暂停+继续阅读、折叠标记再展开 |
| `src/features/reader/largeDoc/LargeDocDialog.test.tsx` | 4 | 尺寸消息与三选项、安全默认聚焦、source/cancel/Esc、复杂度说明、简化选择回报 |
| `src/features/reader/view/resource-invalidation.test.ts` | 5 | 精确 raw src bump、跨文档隔离、未匹配文档级回退、订阅/退订、snapshot 稳定性 |
| `src/features/reader/body/ImageBlock.test.tsx` | 5 | `?v=` URL 渲染与资源事件重挂、仅匹配图重新解析、未匹配全文档重查、简化占位+alt 零调用、阻止占位 |
| `src/features/reader/ReaderScreen.test.tsx`（新增 14，共 30） | 30 | keep 显式提交+位置结果、稍后折叠/重开、follow 前台自动提交、后台暂存→激活提交、选区暂停+更新并清除选区、检查层暂停+关闭提交、资源事件无横幅/无版本变化、关闭后迟到读取丢弃、源码视图保持展示版本、>10MiB 提示+简化子集+KaTeX 关闭、取消无幽灵、>50MiB 直达源码窗口+硬上限说明、连续候选合并单横幅、滚动保存 AnchorRecord、relink 新版本说明 |
| `src/features/reader/reader-state.test.ts`（+1，共 13） | 13 | `tab/largeDoc` 模式切换不改标签身份/数量 |
| `src/document/pipeline.test.ts`（+1，共 17） | 17 | 简化模式跳过重型引擎且块/分段/stats 与完整管线一致 |

## 5. 不变量 → 测试映射（本任务 oracle）

| 不变量 | 覆盖测试 |
|---|---|
| INV-UM-01 默认 keep 不自动替换 | `update-model.test`（keep 矩阵）；`ReaderScreen.test`（keep 需点击 现在更新） |
| INV-UM-02 follow 提交条件 | `update-model.test`（follow-commit / 条件缺失→暂停）；`ReaderScreen.test`（前台自动提交、检查层暂停后关闭提交） |
| INV-UM-03 选区存在永不自动更新 | `update-model.test`（selection 优先 + 明确动作键）；`ReaderScreen.test`（暂停→更新并清除选区→选区清空） |
| INV-UM-04 后台暂存、激活复核 | `update-model.test`（follow-deferred）；`ReaderScreen.test`（双标签：后台不提交，激活后提交） |
| INV-UM-05 稍后仅折叠、可重开 | `update-model.test`（collapsed）；`UpdateBanner.test`；`ReaderScreen.test`（折叠→标记→展开） |
| INV-UM-06 连续候选合并单横幅 | `update-model.test`；`ReaderScreen.test`（v2→v3 单横幅、提交最新 v3，v2 内容不出现）；`app/session.test`（候选替换语义，既有） |
| INV-UM-07 文档级覆盖仅内存 | `update-model.test`（effectiveUpdateMode）；`use-reader` 会话 map + 关标签清理（代码路径）；settings 覆盖接线（wp-27 既有测试） |
| INV-UM-08 提交与位置结果成对 | `update-model.test`（positionMessageKey）；`ReaderScreen.test`（所有提交均出现 `update.position.exact/approx` Toast） |
| INV-AR-01 记录仅五字段、无正文 | `position.test`（字段集合/JSON 不含正文）；`ReaderScreen.test`（滚动后 `save_position` 载荷形状） |
| INV-AR-02 同版本 sourceRange 精确、不重读磁盘 | `position.test`（same-version exact） |
| INV-AR-03 跨版本精确仅唯一指纹+同标题 | `position.test`（唯一→精确；不同标题→近似；重复指纹→绝不精确） |
| INV-AR-04 歧义回最近可信标题并标近似 | `position.test`（heading/ancestor/top 三档）+ `commitUpdate` 无锚点时强制 approx（`ReaderScreen.test` 位置结果为 approx） |
| INV-AR-05 布局校正 ≤1 次/变化 | `position.test`（LayoutStabilizer 合并、二次布局允许、dispose 取消） |
| INV-AR-06 抑制时 saved:false 无错误、不写源文件 | `position.test`（抑制/rememberRecords）；既有 `write-suppression.test`（镜像） |
| INV-AR-07 保存失败可见可重试 | `position.test`（错误上报 + retry）；ReaderScreen `document.position.notSaved` + 重试/关闭（接线） |
| INV-AR-08 rememberRecords=false 仅内存 | `position.test` |
| INV-VC-01/02/03/09/10 提交规则与乱序 | `app/session.test`（既有 AT22：v1 晚完成不回退 v2、陈旧错误不可见、代次递增）；本任务未重复实现规则 |
| INV-VC-04/06 丢弃零可见影响、关闭后不复活 | `app/session.test`（既有）；`ReaderScreen.test`（关闭后迟到读取：无标签、缓存释放、零内容） |
| INV-VC-05 pending 标记 ⇔ 横幅/徽标 | `app/session.test`（既有）；`ReaderScreen.test`（横幅/标签徽标出现与消失） |
| INV-VC-07 资源变化不动版本/无横幅 | `resource-invalidation.test`；`ImageBlock.test`；`ReaderScreen.test`（resource 事件：仅该图重解析、无刷新读取、无横幅） |
| INV-VC-08 同哈希不产生 pending | `app/session.test`（既有） |
| INV-VC-11 提交与位置结果同一动作 | `ReaderScreen.test`；`ReaderScreen` 单一滚动 effect 绑定 notice nonce |
| INV-WS-07 资源事件只影响对应资源键 | `resource-invalidation.test` + `ImageBlock.test`（精确匹配/文档回退） |
| INV-WS-08 关闭移除在途任务 | `ReaderScreen.test`（close-during-task）；`app/session.test` |
| INV-DS-08 不把部分渲染称完整 | `modes.test`（部分渲染必有徽标、`renderComplete=false`）；`ReaderScreen.test`（简化徽标+`largeDoc.coverage`；硬上限 `error.limit.size`；源码范围由 `source.window` 说明） |
| R29 简化子集保留全文/搜索/复制/源码 | `pipeline.test`（块/分段与完整一致、重型引擎关闭）；`ReaderScreen.test`（简化后公式显示源码、正文可读） |

说明：INV-WS-01..06 与 INV-VC 的 Rust 侧部分属 wp-12/watch 与 wp-31 集成范围；前端只消费事件与提交规则（见 §7）。

## 6. 行为说明、决策与已知缺口（不掩盖）

- **D-28-1 硬上限文案**：>50MiB 直接进入只读源码窗口（rendering-pipeline §5），使用 `document.badge.sourceOnly` 徽标 + `error.limit.size`（“可用源码分段查看”）说明；未使用 `largeDoc.hardLimit`（其“请选择其他文件”与 §5 的源码窗口要求冲突）。未新增文案键（378 键冻结不变）。
- **D-28-2 复杂度提示发生在首次解析后**：尺寸在打开前可知，复杂度只有解析统计后才可知；超预算时弹同一对话框（reason=complexity，附 `error.limit.complexity`）。取消保留已渲染的完整视图，并只为该版本记录不再重复提示（不构成“已简化”虚报）。
- **D-28-3 ≤50MiB 用户选择“只读源码”**：仍执行一次 `read_document`（契约允许 ≤50MiB 全量）并保留内存文本，源码视图与内存内搜索可用；`search_source` 按契约仅用于 >50MiB。>50MiB 走 `get_source_info` + `read_source_window`，不调用 `read_document`。
- **D-28-4 follow 自动提交与 §6 提交规则分离**：`update-model` 只决定“何时可提交”，实际提交全部经 wp-16 session reducer 的 token/代次规则（INV-VC 不因策略变化被削弱，OI-02 按严格解释执行：接受候选递增代次）。
- **D-28-5 位置写入节流语义**：首写为 leading edge，其后每标签至少间隔 2s，最新锚点胜出；“提交边界 flush”同样受节流约束（规范下限≥2s），内存锚点始终保留。抑制镜像只挡前端写调用，Rust 侧门禁仍是权威（wp-27 D-27-1 口径延续）。
- **D-28-6 布局校正参数**：默认延迟 200ms 为 models §11 P-02 建议初值（可校准，非验收阈值）；请求合并，不追滚动。
- **D-28-7 既有 Ctrl+F 丢事件稳定性问题（已修，属测试夹具/监听注册时机）**：基线 `992096b` 独立解包复现：单文件 `-t debounces` 12 次中 1 次失败；全量套件 6 次中 2 次、8 次中 3 次失败（均为 “Unable to find role=searchbox”）。根因是全局快捷键监听在被动 effect 中注册，而 RTL 查询可能在注册前解析。修复：`search-integration.test.tsx` 的 `openSearch` 先 `await act(async () => {})` 冲刷挂载效果；同时把 ReaderScreen 的全局快捷键/事件桥 effect 改为 `useLayoutEffect`（挂载提交即注册，产品侧更稳）。修复后单文件 15/15、全量 12 轮连续通过。
- **D-28-8 Toast 计时稳定性**：成功 Toast 的 `onDismiss` 改由 ref 持有，父级重渲染不再重置 1.5s 自动消失计时（VC-13）。
- **D-28-9 源码窗口文档的刷新守卫**：>50MiB 且无内存文本时，watch/focus 复核不调用 `read_document(refresh)`（会 `PS_LIMIT_SIZE`）；窗口读取由 `SourceView` 版本校验路径负责（后续 wp-34/31 可补窗口重载）。
- **D-28-10 pending 预取失败静默**：提交时对候选的解析失败按 models §2.3“pending 预取失败静默”处理（横幅保留、可稍后重试）；当前展示任务的失败仍可见可重试（INV-VC-10 不变）。
- **D-28-11 更新结果反馈形态**：`update.position.exact/approx` 采用成功 Toast（约 1.5s、不抢焦点，VC-13）；暂停/横幅提示保持非模态持续，直至条件解除或用户动作。
- **D-28-12 relink 采用分支**：`relinkRecent` 的“已有标签内采用”为防御分支（welcome 入口在无标签时可见）；同字节/异字节两种结果消息均按 §3.8 文案呈现并测试。
- **D-28-13 罕见全量负载抖动（记录待 Gate 裁决）**：在 64 个 jsdom worker 并发时，`PrivacySection.test > suppresses cleared write-back categories…` 在多次全量运行中观察到 1 次失败；该文件单独 12/12、基线单独 12/12、随后全量 12/12 均通过，断言为精确调用计数（`get_storage_overview` = 2）。判定为环境负载时序抖动，非本任务改动（该组件不消费本任务代码）；已如实记录，供 quality-reviewer/Gate 参考。

## 7. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 |
|---|---|
| 真实“替换保存”（rename-over）端到端（watch `appeared` → 稳定读取 → 横幅/提交） | 需真实文件系统与运行中的应用；handoff 明确由 wp-34 观测。本次仅提供 `fixtures/update/**` 与前端事件路径测试 |
| 真实 >50MiB 文档的窗口/搜索 IPC 闭环（`get_source_info`/`read_source_window`/`search_source.complete=false`） | 尺寸在测试中合成；真实大文件与 Rust 行为属 wp-31/34 |
| Rust 侧监测稳定判定（S1=150ms、N=5、PS_IO_CHANGED）与焦点 stat 复核 | wp-12/watch 契约服务；前端只消费 `watch-changed` 与读取结果 |
| 复杂度预算数值校准（建议初值）与真实超大文档 | models §11 A8：校准前不作为验收阈值 |
| 真实布局/字体/图片解码触发的一次性校正（滚动落点、无追逐） | jsdom 无真实布局；已以纯类 + effect 接线覆盖，真实窗口走查属 wp-34 |
| WebKit 原生选区/剪贴板行为下的选区暂停 | 以 jsdom Selection 覆盖行为矩阵；真实浏览器差异未测 |
| 更新模式文档级覆盖的跨标签隔离与重启不继承 | 逻辑由 `update-model`/`use-reader` 内存 map 覆盖；重启路径属 wp-31 启动恢复范围 |

## 8. 追溯

- **implementation-plan §4.3**：T-51（大文档选择/简化子集/标注与索引范围）、T-52（>50MiB 源码窗口、范围说明、不称完整）、T-53（UpdateBanner + 跟随模式 keep/follow 条件）、T-54（锚点保存/恢复、精确/近似、≤1 次校正、节流）、T-55（乱序丢弃、资源 `?v=` 重挂、关闭失效、relink 说明后采用）；Standards：STRICT。
- **models §2**（INV-VC-01..11；提交规则与乱序，规则本体仍在 `app/session` 不重复实现）、**§3**（W5/W8/W9；资源事件与关闭失效）、**§4**（INV-UM-01..08；keep/follow 决策矩阵）、**§6**（INV-AR-01..08；记录字段、决策树、节流、抑制、单次校正）。
- **contracts §6**（提交/代次规则消费）、**§7**（`watch-changed` 语义、`kind=resource`、稳定读取）、**§8**（`read_document`/`relink_document`/`get_source_info`/`read_source_window`/`search_source`/`save_position`/`watch_*` 签名逐字段使用；未新增命令或字段）。
- **rendering-pipeline §5**（10/50MiB 阈值、模式选项、简化=同一管线子集、取消无幽灵）、**§2.12/§3**（源映射/块与分段一致性）。
- **ui-spec §3.2/§3.8**（更新横幅与稍后、跟随条件、明确清除选区、大文档提示与诚实说明、relink 先说明后采用）、**§6/§7**（`role=status` 非模态、不抢焦点、EDGE-08、VC-08/VC-13/VC-18）、**strings-zh-CN.md**（仅既有键：`update.*`、`largeDoc.*`、`document.badge.*`、`error.limit.*`、`source.*`、`document.position.notSaved` 等）。
- **requirements**：R07（relink）、R19（锚点）、R21（更新模式）、R22（版本正确性）、R29（大文档）；AT07/19/21/22/29。

## 9. 结论与下一步

wp-28 + wp-29（T-51–T-55）已在本任务合并实现：大文档阈值/提示/简化子集/源码窗口与诚实标注；keep/follow 更新矩阵（非模态横幅、稍后折叠、连续候选合并、后台暂存、选区/检查层暂停、更新并清除选区）；资源 `?v=` 重挂、关闭/迟到丢弃、relink 说明后采用、源码视图共享展示版本；AnchorRecord 保存/节流/抑制与 §6 恢复决策树、单次布局校正。四项 DoD（`pnpm typecheck`、`pnpm lint`、`pnpm test -- --run` 455/455、`pnpm build`）全部通过。待独立质量审查（quality-reviewer）与 Component/Gate 判定；§7 清单随 wp-31/34 的真实后端与窗口走查闭环，D-28-13 的负载抖动请 Gate 一并裁决。
