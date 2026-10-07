# 纸栈 PaperStack · wp-16 前端基础实现报告（服务层、会话/全局 Store、i18n 运行时、设计令牌与通用组件）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP16
- **Artifact Type**: Implementation Evidence Report（`src/services/**`、`src/app/**`、`src/styles/**`、`src/components/**` 的构建、测试与验证证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-16-shell`（任务分支 `task/wp-16-shell`；父分支 `feat/v0.1.0`；基线提交 `0ed1d4767fd5dda016ce410877c684f01d2dbb6e`；产出提交主题 `feat(shell): add frontend services, session store and ui foundation`）
- **Components**: C-10..C-17 前端基础（服务封装、状态与提交规则、i18n、令牌、通用组件）
- **Last Verified**: 2026-10-07
- **Scope**: 仅前端基础（T-21、T-22、T-24、T-25、T-26 与 T-23 的事件订阅助手部分）：contracts §8 全部 TS 服务签名与 §5 错误归一化；§6 提交规则的前端单点实现与 `DocumentModel` LRU 缓存；i18n 运行时（插值/回退链/开发警告）；ui-spec §5 设计令牌与基础样式；ui-spec §2.1 通用组件与 §6 焦点/aria 规则；App 壳装配。**不含任何功能屏幕**（欢迎页/阅读器/设置等留给后续任务），未接线事件桥（`src/app/bridge.ts`）与退出会话保存，未新增 npm 依赖，未修改 `package.json`/锁文件/`src-tauri/`/`vite.config.ts`/`index.html`/输入 Artifacts。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（`swe_guard.py begin` 冻结，本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/30-architecture/adr/ADR-003-state-management.md` | `8b6ffa99d97b91868dee6186097b0b7e70b75b4e8450dac68b3c4815b372d745` | ✓ |
| `artifacts/30-architecture/adr/ADR-009-i18n.md` | `9527eccc213c95ee549b791d73e42ec5528498c73451e4fc9e3ad6de4a480454` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817ac450b230fbd5f52525970fdf9af8755d1310012d3481a60749052e28` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69ca733d802622f7e0e18fb22b113008a646117f09da37de183fb5065c0` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |

基线提交 `0ed1d47` 与 handoff 一致；进入时工作树干净；快照 `refs/swe/snapshots/20261006T223409Z-wp-16-shell-fb62c176`（commit `826908c0`）覆盖 `src/` 修改前字节。Rust 命令表面（wp-14、wp-14a）已核对参数名（`req`/`docId`/`grantId`/`url`/`path`）与事件名（`paperstack://watch-changed`、`paperstack://open-requested`）；`clipboard-manager:allow-write-text` 能力与 `tauri-plugin-clipboard-manager` 注册已核对（§5 决策 D-2）。

## 2. 交付物（新增/修改文件）

| 路径 | 内容 |
|---|---|
| `src/services/types.ts` | contracts §3.1–§3.7 全部共享模型的 TS 手工镜像（字段名/字面量联合与契约逐字一致），供全部服务与功能层复用。 |
| `src/services/invoke.ts` | 唯一 IPC 入口 `invokeCommand<Response>(command, args?)`；`ErrorPayload` 形状守卫 `isErrorPayload`；`PaperStackError`（code/category/messageKey/retryable/sourceRange?/details?，`message=messageKey`，`isCancelled`，`toPayload`，`static from`）；非契约拒绝归一化为 `PS_INTERNAL`/`error.internal.unexpected`（contracts §5；§8）。 |
| `src/services/events.ts` | `subscribe<T>(eventName, handler)`（仅转发 payload）与 `SubscriptionBag`（track/dispose；dispose 后解析完成的订阅立即 unlisten，无泄漏）。 |
| `src/services/files.ts` | 命令 1–8：`pickFiles`/`pickDirectory`/`pickExportTarget`/`openDocuments`/`readDocument`/`relinkDocument`/`getSourceInfo`/`readSourceWindow`。 |
| `src/services/tree.ts` | 命令 9–10：`openDirectory`/`readDirectory`。 |
| `src/services/search.ts` | 命令 38：`searchSource`（注明仅 >50MiB 源码窗口模式）。 |
| `src/services/watch.ts` | 命令 11–12 + `onWatchChanged`（`WATCH_CHANGED_EVENT`）。 |
| `src/services/storage.ts` | 命令 13–21：含 `resumeRecording(req?)` 省略参数语义。 |
| `src/services/settings.ts` | 命令 22–23：`getSettings`/`updateSettings(patch)`。 |
| `src/services/auth.ts` | 命令 24–27：`checkResourceAccess`（不 reject 语义注明）/`grantLocalRoot`/`listGrants`/`revokeGrant(grantId)`。 |
| `src/services/resources.ts` | 命令 28–30：`grantRemoteSession`/`revokeRemoteSession`/`fetchRemoteImage`；按契约 §2/§8 以 `remote` 命名空间导出（见 §5 D-1）。 |
| `src/services/opener.ts` | 命令 31–32：`openExternalUrl`/`revealInFolder`。 |
| `src/services/diagnostics.ts` | 命令 36–37：`previewDiagnostics`/`exportDiagnostics`。 |
| `src/services/app.ts` | 命令 33–35 + `onOpenRequested`（`OPEN_REQUESTED_EVENT`）。 |
| `src/services/clipboard.ts` | `copyText(text)` → `{ok:true}` / `{ok:false,error}`；仅系统剪贴板确认成功后返回 ok（R11）；经单一 invoke 入口调用插件命令（见 §5 D-2）。 |
| `src/services/index.ts` | 服务层唯一导入面：命名空间与 contracts §2 命令索引一致（`files/tree/search/watch/storage/settings/auth/remote/opener/diagnostics/app/clipboard/events`）+ `invoke`/`types` 重导出。 |
| `src/app/session.ts` | 每标签会话状态与 contracts §6 提交规则单点实现：`TaskToken`、`canCommit`（(a) docId、(b) generation、(c) 版本目标）、全部动作/动作创建器/选择器、`createTaskToken`（display/pending/discovery）、`DocumentModel` 模块级缓存（`docId+version`，LRU ≤2 版本/文档，关闭即释放）。 |
| `src/app/store.ts` | 全局 AppStore（ADR-003 Option C；ui-spec §2.1 `AppStore` 职责）：settings（+revision）、recents、互斥辅助区 `activePanel`、模态栈 `overlays`、toast 队列；reducer + Context Provider + hooks + 选择器 + 动作创建器。 |
| `src/app/i18n.ts` | i18n 运行时：`registerLocale`/`hasLocale`/`setLocale`/`getLocale`/`lookup`/`t(key, params?)`；zh-CN 基准、`{param}` 插值、回退链（活动 locale → zh-CN → 原样 key ＋开发警告，不抛异常）。 |
| `src/styles/tokens.css` | ui-spec §5 精确定义：浅/深色 `[data-theme]` 色板与派生色、间距/控件/图标/结构尺寸/动效/焦点环变量、`prefers-reduced-motion` 清零、系统字体栈。 |
| `src/styles/base.css` | 基础 reset、排版刻度（H1 30/H2 23/H3 19，代码 14/1.65，正文可覆盖变量）、`:focus-visible` 焦点环、`::selection`、`.ps-scroll-x/.ps-scroll-y` 局部横滚、`.ps-content-column`、`.ps-visually-hidden`、`.ps-skip-link`、减少动效兜底。 |
| `src/components/Icon.tsx` | 手写内联 SVG 图标集（VC-01，18–20px、`currentColor`、`aria-hidden`、无远程资源）。 |
| `src/components/Button.tsx` | 主/次/危险按钮；busy 防重复提交；禁用必带原因（title + `aria-describedby` 隐藏文本）。 |
| `src/components/IconButton.tsx` | 图标按钮：`aria-label` 必填；禁用原因同上。 |
| `src/components/Modal.tsx` | 模态：`role=dialog`+`aria-modal`+`aria-labelledby`、焦点陷阱（Tab/Shift+Tab 循环）、Esc 取消、卸载回触发点、初始焦点（含 `initialFocusRef` 安全默认）、可选 scrim 取消（默认关）。 |
| `src/components/Drawer.tsx` | 非模态辅助区：`role=complementary`+`aria-label`、不困焦点（可 Tab 离开）、Esc 关闭并回触发点。 |
| `src/components/Popover.tsx` | 锚定非模态浮层：外点/Esc 关闭并回锚点，`useAnchoredPosition` 跟踪 resize/scroll。 |
| `src/components/Menu.tsx` | 菜单：roving tabindex、Arrow/Home/End/Enter/Space/Esc/Tab、禁用项 `aria-disabled`+原因、外点关闭、Esc 回锚点。 |
| `src/components/Banner.tsx` | 非模态状态条 `role=status`，tone info/warn/danger，actions 插槽。 |
| `src/components/Toast.tsx` | 成功 1.5s 自动消失 `role=status`；错误持久 `role=alert`+关闭按钮；均不抢焦点。 |
| `src/components/Toolbar.tsx` | `role=toolbar` 52px 容器，默认名称 `t('toolbar.aria')`。 |
| `src/components/EmptyState.tsx` | 空状态（标题/说明/动作），不占满屏、无插画。 |
| `src/components/StatusBadge.tsx` | 文本状态标签（`update.badge`/`document.badge.*`），文字＋图标不以色为唯一表达。 |
| `src/components/Placeholder.tsx` | 无动画加载占位＋阶段行＋可选取消（`role=status`，无百分比）。 |
| `src/components/SkipLink.tsx` | “跳到正文” SkipLink 与 `DOCUMENT_BODY_ID`。 |
| `src/components/useAnchoredPosition.ts` | Popover/Menu 共用的锚点定位内部助手（非组件）。 |
| `src/App.tsx` | 壳装配：`AppStoreProvider` + SkipLink + `main` landmark（`aria.documentBody`）+ 占位正文（全部文案经 `t()`）。 |
| `src/main.tsx` | 挂载时引入 tokens/base 样式，设置 `documentElement.lang = getLocale()`。 |
| 测试文件（13 个） | 见 §4；`src/app/i18n.keys.test.ts` 未修改（目录 378 键不变）。 |
| `artifacts/60-implementation/wp-16-shell.md` | 本报告。 |

## 3. 任务→测试映射（T-21..T-26）

| T | 实现 | 测试（文件::用例） |
|---|---|---|
| T-21 服务封装与错误归一化 | `services/*.ts`（§8 全签名）、`invoke.ts`、`events.ts` | `invoke.test.ts` 全部 8 项（成功透传、ErrorPayload→PaperStackError 全字段、取消位、幂等重抛、非契约/畸形载荷→PS_INTERNAL、`toErrorPayload`、形状守卫）；`commands.test.ts` 全部 12 项（各命令名与参数名逐条、clipboard 成功/失败、错误传播）；`events.test.ts` 全部 4 项（payload 转发、两条契约事件名、SubscriptionBag 释放与“dispose 后迟到订阅立即 unlisten”） |
| T-22 Store 与提交规则 | `app/store.ts`、`app/session.ts` | `session.test.ts` 全部 13 项：初始提交与缓存、AT22 慢 v1/快 v2（INV-VC-01/02/04/09）、陈旧代次拒绝（INV-VC-02/03）、关闭后全部迟到结果与释放（INV-VC-06）、同哈希读取不产生 pending（INV-VC-08）、失败可见性（INV-VC-10）、空会话失败、无 pending 不提交、relink 采纳、token 构造、LRU ≤2 与合并写入；`store.test.tsx` 全部 6 项（辅助区互斥、recents、settings、模态栈、toast 持久性、Provider 集成） |
| T-23（部分）事件订阅助手 | `services/events.ts`、`watch.onWatchChanged`、`app.onOpenRequested` | 同上 `events.test.ts`。**事件桥装配（bridge/退出保存/拖放）不在本任务交付**（见 §5 D-7） |
| T-24 令牌与主题 | `styles/tokens.css`、`styles/base.css` | 令牌值与 ui-spec §5 逐条人工核对（构建产物 CSS 3.69kB）；无独立令牌快照测试（后续 UI 回归按 DR-03/DR-05 执行，本任务不宣称视觉通过） |
| T-25 通用组件与焦点管理 | `components/*.tsx` | `Modal.test.tsx` 4 项（labelled dialog、焦点陷阱循环、Esc 关闭并回触发点、初始焦点、默认不响应 scrim/显式 scrim 关闭）；`Drawer.test.tsx` 2 项（complementary、Tab 可离开不困焦点、Esc）；`Toast.test.tsx` 3 项（status 自动消失、alert 持久+关闭、不抢焦点）；`Menu.test.tsx` 3 项（跳过禁用项、aria-disabled+原因、Esc 回锚点）；`App.test.tsx`（壳渲染、SkipLink 目标） |
| T-26 i18n 运行时 | `app/i18n.ts` | `i18n.test.ts` 8 项（目录样例逐字、无空值、插值/缺参/多余参、缺失键回退+警告、部分语言包→zh-CN 回退+警告、lookup/注册、活动 locale）；`no-hardcoded-strings.test.ts` 3 项（组件/app 源码无 CJK 字面量、`t()` 键均存在于 zh-CN 包、检测器自测） |

## 4. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm typecheck` | PASS（`tsc --noEmit`，0 错误） |
| 2 | `pnpm lint` | PASS（`eslint .`，0 error / 0 warning） |
| 3 | `pnpm test -- --run` | PASS：**13 个测试文件，70/70 通过** |
| 4 | `pnpm build` | PASS（`tsc && vite build`；dist CSS 3.69 kB、JS 241.28 kB / gzip 76.94 kB） |

测试分布（新增/更新 61 项，另有 2 个文件为 wp-07 既有并保持通过）

| 测试文件 | 数量 | 状态 |
|---|---|---|
| `src/services/invoke.test.ts`（新） | 8 | PASS |
| `src/services/commands.test.ts`（新） | 12 | PASS |
| `src/services/events.test.ts`（新） | 4 | PASS |
| `src/app/session.test.ts`（新） | 13 | PASS |
| `src/app/store.test.tsx`（新） | 6 | PASS |
| `src/app/i18n.test.ts`（扩展，原 6） | 8 | PASS |
| `src/app/i18n.keys.test.ts`（既有，未改） | 3 | PASS（378 键计数保持） |
| `src/test/no-hardcoded-strings.test.ts`（新） | 3 | PASS |
| `src/components/Modal.test.tsx`（新） | 4 | PASS |
| `src/components/Drawer.test.tsx`（新） | 2 | PASS |
| `src/components/Toast.test.tsx`（新） | 3 | PASS |
| `src/components/Menu.test.tsx`（新） | 3 | PASS |
| `src/App.test.tsx`（新） | 1 | PASS |
| 合计 | **70** | 全绿 |

## 5. 决策、偏差与已知限制（如实报告）

- **D-1 文件命名映射**：handoff 清单要求 `src/services/resources.ts`；contracts §8 注明 `remote.ts`、§2 命令索引使用 `remote.*` 命名空间。实现：函数位于 `resources.ts`（与 Rust `commands/resources.rs` 镜像），由 `index.ts` 以 `remote` 命名空间导出（`import { remote } from '../services'`→`remote.fetchRemoteImage`）。契约签名逐字一致；仅文件名义与本报告显式记录。
- **D-2 clipboard 依赖**：`@tauri-apps/plugin-clipboard-manager` 的 JS 包不在依赖中，本任务禁止新增 npm 依赖。实现经单一 invoke 入口调用 `plugin:clipboard-manager|write_text`（官方 JS 封装的同一条 IPC 调用；Rust 插件与 `clipboard-manager:allow-write-text` 能力已注册/授予，见 `src-tauri/src/lib.rs`、`capabilities/default.json`），失败归一化为 `ErrorPayload`，仅成功返回 `{ok:true}`。后续若引入官方 JS 包，仅需替换该文件内部实现，签名不变。
- **D-3 `ipc.ts` 注释**：contracts §8 注释把 `PaperStackError` 标在 `ipc.ts`；handoff 交付物指定 `src/services/invoke.ts`。类定义与归一化单点位于 `invoke.ts`，`index.ts` 统一重导出；所有封装仍只经 `invokeCommand` 单一入口。
- **D-4 Store 文件命名**：handoff 指定 `src/app/store.ts`；ui-spec §2.1 表为 `AppStore.tsx`。实现为 `store.ts`（reducer/selectors/actions 纯逻辑 + `AppStoreProvider`/`useAppState`/`useAppDispatch`，无 JSX 以便单测），职责与 ADR-003 第 1 条一致。
- **D-5 generation 语义细化**：按 models §2.2(a) 时序，替换 pending 候选（v1→v2）**不**递增 generation（该时序中 v1 任务以 g1 派发、接受 v2 时才到 g2）；陈旧 pending 任务由条件 (c)（token.version ≠ 当前目标版本）拒绝（INV-VC-09），已由测试覆盖。generation 在打开/重开、采纳候选（`updateCommitted`）、relink 采纳、关闭、撤销授权时严格递增，只增不减（INV-VC-03）。
- **D-6 OI-02 严格解释**：pending 候选的预取解析结果即使先完成并写入缓存，采纳时也不计入 `preparedVersion`（display 任务需在采纳后重新派发）；模型 OI-02 已记录该严格解释，实现与之一致。
- **D-7 范围边界（未做）**：`src/app/bridge.ts`（watch-changed/open-requested/focus/close-requested/drag-drop 桥接与退出保存）不在 handoff 条目清单内，本任务只交付其订阅基元（`events.ts`、`onWatchChanged`、`onOpenRequested`）；功能屏幕、主题跟随系统解析（`data-theme` 由设置流程写入）、设置持久化桥均留给后续任务。T-23 的桥接装配需在后续任务中完成（计划 §4.2 将 T-23 列在 wp-16，实际交付边界以 handoff 条目为准，此处显式记录差异）。
- **D-8 i18n 警告范围**：除“最终缺失返回 key”告警外，活动 locale 缺键但可回退 zh-CN 时也发出开发警告（帮助发现翻译缺口），生产环境静默；行为有测试覆盖，不改变调用契约。
- **D-9 令牌验证方式**：ui-spec §5 变量为逐字实现，未引入视觉快照测试；UI 回归截图/对比属于后续 UI 回归任务（DR-03/DR-05），本报告不宣称视觉验收通过。
- **D-10 静态 i18n 守卫范围**：`no-hardcoded-strings` 扫描 `.ts/.tsx`（排除 `*.test.*`，含注释）；因此源码注释保持英文。动态 `t(variable)` 键无法静态校验（当前源码仅 `StatusBadge` 用常量表间接调用，键值已人工核对）。
- **D-11 TS 契约镜像**：`types.ts` 为手工镜像；Rust 侧契约形状测试（wp-14）保证命令表面，本任务在 TS 侧以编译期类型 + 逐命令参数断言测试守护（非运行期全量形状比对）。

## 6. 追溯摘要

- **contracts §5/§8**：T-21 全部服务签名与 `PaperStackError` 归一化；任务→测试见 §3。
- **contracts §6 / models §2（INV-VC-01/02/04/06/08/09/10）**：`session.ts` 单点提交规则 + `session.test.ts` 乱序/陈旧/关闭用例（AT22 前端可注入乱序）。INV-VC-03/05/11 由 generation 单调、`selectHasPendingUpdate`、`updateCommitted(position)` 承载。
- **models §1/§4/§7**：会话状态字段、pending 候选合并规则、关闭释放与代次失效；更新模式（keep/follow）的条件判断留给阅读器功能任务，本任务只提供提交动作。
- **ADR-003**：全局 store + 每标签会话 + 模块级 `DocumentModel`（LRU ≤2）+ 无外部状态库、无 localStorage。
- **ADR-009 / PC-06 / ui-spec EDGE-12**：i18n 运行时、键完整性守卫、硬编码扫描；zh-CN 目录 378 键未增删。
- **ui-spec §2.1/§5/§6（VC-01/02/04/08/11/13/14/18、EDGE-01/02/03/10/11、R24 横切）**：通用组件与焦点/aria 基础规则；完整 R24 键盘/缩放/回流验证属后续 UI 回归任务。

## 7. 校验说明

本报告为生产型交付的持久记录：所有命令在本修订（`task/wp-16-shell`，父基线 `0ed1d47`）上实测；未修改任何 pinned 输入、`package.json`、锁文件、`src-tauri/`、`vite.config.ts`、`index.html` 或框架文件。工作树内变更仅 `src/` 与本报告。
