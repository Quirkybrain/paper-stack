# 纸栈 PaperStack · wp-30 入口集成与授权对话框实现报告（Entry Integration & Authorization Dialogs）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP30
- **Artifact Type**: Implementation Evidence Report（T-56–T-58 实现证据；wp-30 + wp-31 合并任务）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-30-entry`（任务分支 `task/wp-30-entry`；父分支 `feat/v0.1.0`；基线提交 `b9bd0ab497c7630d6870f339623fff66758d5c1a`；产出提交主题 `feat(reader): add entry integration and authorization dialogs`）
- **Components**: 四入口集成（`src/features/reader/open/**`、`use-reader` 批量管线、ReaderScreen 事件桥接线）；本地越界资源聚合与授权对话框（`src/features/reader/resources/**`、`src/features/settings/dialogs/AuthScopeDialog.tsx`）；远程图片会话授权/受控获取/撤销（`ImageBlock`、`ResourceAuthDialogs`、`RemoteImageDialog`、`use-reader` 会话生命周期）。
- **Scope**: `src/**`、`artifacts/60-implementation/**`（本报告）。未修改 `package.json`、`pnpm-lock.yaml`、`src-tauri/`、`src/locales/zh-CN.json`、pinned 输入或其他 Artifact；无新增依赖。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-30-entry.json` 逐字一致，只读未改）：

| 输入 | SHA-256（前 8/后 8） | 一致 |
|---|---|---|
| `artifacts/40-ux/ui-spec.md` | `3a68817a…49052e28` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…f6c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…93f47f74` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…6b02967f` | ✓ |

基线 `b9bd0ab`；分支 `task/wp-30-entry`；全部产出均在 handoff `writes`（`src/`、`artifacts/60-implementation/`）范围内。文案全部取自冻结的 `src/locales/zh-CN.json`（378 键，未新增/删除，`i18n.keys.test` 通过）。

## 2. 交付物与文件清单

### 2.1 新增（实现）

| 路径 | 内容 |
|---|---|
| `src/features/reader/open/entry.ts`（handoff 交付物） | 四入口适配器（命令 1/2/4/9/35）：`openFromFileDialog`（取消零变化）、`openFromDirectoryDialog`（`open_directory` session 根，picker 结果不自带授权）、`openFromDrop`（空载荷忽略，非文档/无效/越权路径按项拒绝，绝不是独立命令）、`entryForOpenRequest`/`openFromRequest`（cli→`cli`、second-instance→`system`）、`drainPendingOpenRequests`（按输入顺序排空一次，后续经事件逐个处理）；`planOpenBatch` 批量判定纯函数：保持请求顺序、首个成功项获得焦点、duplicate 复用 canonical 标签（R05）、拒绝项汇总且不清空成功项 |
| `src/features/reader/resources/resource-auth.ts` | 授权聚合存储（`ResourceAuthStore`）：按目录范围聚合本地 `outside-root`（每目录一个提示、资源计数、不逐图弹窗）；按文档会话聚合远程 `remote-blocked`（origins 首见序、去重、计数）；拒绝/授权失败标记 blocked 后仅显式点击重开（INV-AZ-02/05）；远程授权按文档会话登记，撤销/换文档即清除（INV-AZ-03/07/09）；`clearPromptsFor` 在文档会话结束时丢弃排队提示 |
| `src/features/reader/resources/ResourceAuthDialogs.tsx` | 对话框宿主：订阅聚合队列；本地决定经 `auth.grantLocalRoot({docId, rootPath, persist})`（persist 仅来自默认不选的复选框，绝不隐式升级）；远程决定经 `remote.grantRemoteSession({docId, origins})`（仅当前文档会话）；成功后 `resolvePrompt` + 失效重解析（`resourceInvalidation.bump`），失败按拒绝处理并经 `onError` 上报一次（无自动重试循环） |
| `src/features/reader/resources/RemoteImageDialog.tsx`（handoff 交付物） | 远程授权模态：仅列出目标域名（`https://host[:port]`，不含完整 URL/令牌）、会话级说明；初焦点=保持阻止，Esc=阻止，Tab 受限（Modal） |
| `src/features/settings/dialogs/AuthScopeDialog.tsx`（handoff 交付物） | 本地范围授权模态：显示规范化范围 + 资源数量 + “不会写入原文件”；“记住此目录授权”默认不选（session 默认）；初焦点=保持阻止，Esc=阻止；无“始终允许全部”快捷项 |

### 2.2 新增（测试）

| 路径 | 用例数 | 覆盖 |
|---|---|---|
| `src/features/reader/open/entry.test.ts` | 12 | 四入口路由与等价性表格、picker 取消零变化、目录入口 session 根、空 drop 忽略、CLI/单实例顺序排空、排空失败上报与畸形载荷容忍、批量顺序/首成功焦点/duplicate 复用/拒绝汇总、非文档拒绝不是命令 |
| `src/features/reader/resources/resource-auth.test.ts` | 11 | 本地按目录聚合计数、不同目录各自排队、无 rootCandidate 忽略、拒绝后不再自动追问+显式重开计数、队列推进、快照稳定/订阅、远程按会话聚合 origins、已授权 origin 不提示、拒绝到显式重开、撤销清授权、会话结束清提示而不设 blocked |
| `src/features/settings/dialogs/AuthScopeDialog.test.tsx` | 5 | 范围/数量/不写原文件文案、无“始终允许”项、复选框默认关（session）与勾选后 persistent、安全默认焦点+Esc=阻止、Tab 循环 |
| `src/features/reader/resources/RemoteImageDialog.test.tsx` | 3 | 仅列域名、安全默认焦点+Esc=阻止、显式允许回调 |
| `src/features/reader/resources/resource-flow.test.tsx` | 9 | 远程默认零请求+域名聚合提示（对话框不含完整 URL）、授权后 fetch 恰好一次并渲染 asset URL、重定向阻止文案+仅显式重试（无自动循环）、拒绝后占位保留且仅显式动作重开、撤销卸载回占位、本地同目录聚合一次（计数 2）+默认 session 调用、勾选后 persistent 调用、本地拒绝不追问、授权失败=拒绝+错误上报一次 |
| `src/features/reader/ReaderScreen.test.tsx`（+4，共 34） | 34 | 新增：单实例 `open-requested` 事件→`entry="system"`；批量拒绝汇总且成功标签保留（首成功焦点）；duplicate 复用已有 canonical 标签（零重读、零新标签）；远程授权→fetch→关闭时 `revoke_remote_session`→新文档会话再次阻止（零新请求、重新给出确认） |

### 2.3 修改

| 路径 | 变更 |
|---|---|
| `src/features/reader/use-reader.ts` | 入口接线：`pickAndOpen`/`pickDirectory`/`openRequest`/新增 `openDrop` 全部经 `open/entry` 适配器与模块级 `ENTRY_SERVICES`；启动队列改为 `drainPendingOpenRequests`（按序、守卫卸载后提交）；`openPaths` 改用 `planOpenBatch`（顺序/首成功焦点/duplicate 复用/失败汇总，行为与基线等价）；新增 `reportOpenError`（对话框失败上报，不清空已有汇总）；文档会话离开（关标签/当前标签换文档）时 `resourceAuth.revokeRemote` + `clearPromptsFor` + `remote.revokeRemoteSession(docId)`（会话授权取消、缓存清理由 Rust 返回 `RevokeResult`） |
| `src/features/reader/ReaderScreen.tsx` | 拖放事件改走 `reader.openDrop`（仍经同一 `open_documents` 校验）；挂载 `ResourceAuthDialogs onError={reader.reportOpenError}` |
| `src/features/reader/body/ImageBlock.tsx` | blocked 决定进入聚合存储；`outside-root` 占位附“选择允许的范围”、`remote-blocked` 占位附“本次允许”显式重开入口；远程仅在本文档会话已授权该 origin 时调用 `fetch_remote_image`（默认零请求）；失败显示契约 `messageKey`（如 `error.resource.redirectBlocked`）并附“重试”按钮，每次点击恰好一次尝试（`retryNonce`），无自动重试 |
| `src/features/reader/reader.css` | 占位操作行与授权对话框最小样式（令牌变量，无新颜色） |

## 3. 验证命令与结果（工作目录 = 项目根；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit`，无诊断 | 0 |
| 2 | `pnpm lint` | `eslint .`，无诊断 | 0 |
| 3 | `pnpm test -- --run` | **Test Files 69 passed (69)；Tests 499 passed (499)**（基线 64/455 + 新增 5 文件/44 用例） | 0 |
| 4 | `pnpm build` | `tsc && vite build`，`✓ built`（仅既有 >500 kB chunk 提示，非错误） | 0 |

全量套件在最终代码上连续 2 轮 499/499 通过（10:33:54、10:34:32 UTC 本地时间）；无 `skip`/`only`，全部确定性（服务调用均 mock，无假计时器依赖）。

## 4. 测试增量

| 文件 | 新增 | 累计 |
|---|---|---|
| `src/features/reader/open/entry.test.ts` | 12 | 12 |
| `src/features/reader/resources/resource-auth.test.ts` | 11 | 11 |
| `src/features/reader/resources/resource-flow.test.tsx` | 9 | 9 |
| `src/features/settings/dialogs/AuthScopeDialog.test.tsx` | 5 | 5 |
| `src/features/reader/resources/RemoteImageDialog.test.tsx` | 3 | 3 |
| `src/features/reader/ReaderScreen.test.tsx` | 4 | 34 |
| **合计** | **44** | 全库 **499**（69 文件） |

## 5. INV-AZ → 测试/边界映射（本任务 oracle）

| 不变量 | 前端证据 | 说明 |
|---|---|---|
| INV-AZ-01 单文件打开只授予该文件 | `entry.test`（open_documents 唯一入口、入口等价）；既有 `security_paths_auth`（Rust） | 前端不因入口差异扩大任何范围 |
| INV-AZ-02 越界按目录一次聚合、显示范围与数量 | `resource-auth.test`（同目录计数、异目录排队）；`resource-flow.test`（两图一个对话框、计数 2） | 不逐图弹窗 |
| INV-AZ-03 目录默认 session；“记住”默认不选；远程仅文档会话 | `AuthScopeDialog.test`（默认关）；`resource-flow.test`（persist=false/true 两条调用断言）；`resource-auth.test`（远程按 docId） | 无隐式升级、无“始终允许” |
| INV-AZ-04 判定只在 Rust；界面路径不是凭证 | `ResourceAuthDialogs` 仅回传 `rootCandidate`/`origins` 给 grant 命令；`ImageBlock` 只用 Rust 返回的 `assetUrl` | 无前端 asset URL 构造（静态约束） |
| INV-AZ-05 拒绝只影响对应目标；占位保留；仅显式点击重开 | `resource-flow.test`（本地/远程拒绝→重解析不弹窗→点击重开）；`resource-auth.test`（blocked 标记与显式重开） | 无追问循环 |
| INV-AZ-06 撤销本地授权停止新读取（已载内存可留） | Rust `security_paths_auth`（wp-08）；前端每次均 `check_resource_access`，无缓存旁路 | 运行时行为属 Rust/集成 |
| INV-AZ-07 撤销远程：取消在途/卸载/删缓存 | `ReaderScreen.test`（关闭→`revoke_remote_session(docId)`）；`resource-flow.test`（撤销→资源回阻止占位、无新 fetch） | 缓存条目数由 Rust `RevokeResult.removedCacheEntries`，运行时闭环待 wp-34/35 |
| INV-AZ-08 持久权限与临时权限不可互替 | `resource-flow.test`（两种 persist 调用）；`use-reader`（换文档即撤销会话授权，不回放历史许可） | 持久复核属 Rust |
| INV-AZ-09 会话授权随启动清除；持久逐条复核 | 前端存储为纯内存模块（无持久化路径）；Rust 启动复核（wp-08） | 前端不保留任何跨启动授权 |
| INV-AZ-10 最近列表不是隐性授权 | 既有 wp-24 入口均经 `open_documents`/`relink`；本任务未新增旁路 | — |
| INV-AZ-11 重定向到未确认域/私网必须阻止并重新确认 | `resource-flow.test`（`error.resource.redirectBlocked` 文案、无自动重试、仅显式重试）；逐跳/私网判定在 Rust `security-model §4` | 前端不自动扩大范围 |

## 6. 行为说明与决策（不掩盖）

- **D-30-1 拒绝标记跨文档重开保留**：`blockedLocal` 以 `(docId, rootPath)`、`blockedRemote` 以 `docId` 为键，标签关闭再打开同一文档仍不自动追问；仅占位上的显式按钮重开（ui-spec §3.8“仅用户再次主动点击才重开”）。撤销（非拒绝）不设 blocked：新会话按 models §8.1 `Revoked → Prompted` 重新给出确认（`ReaderScreen.test` 断言）。
- **D-30-2 启动队列畸形载荷容忍**：`drainPendingOpenRequests` 对非数组返回与缺 `paths` 的请求静默跳过（防御性；契约仍要求数组），避免契约外响应造成未处理拒绝。
- **D-30-3 前端不是授权权威**：聚合存储只做提示与显式决定的搬运；`grant_*` 的 `GrantRecord` 与 `check_resource_access` 的 `assetUrl` 均由 Rust 生成；关闭/换文档时前端立即清除会话可见授权并调用 `revoke_remote_session`。
- **D-30-4 拖放事件可用性**：Tauri 2 `getCurrentWindow().onDragDropEvent()` 为真实内建事件（wp-19 已桥接），仅 `type="drop"` 触发打开；jsdom 中通过窗口处理器直接派发验证语义，**不伪造不可用能力**；真实 X11 拖放属于 wp-34（T-63）。
- **D-30-5 远程重试粒度**：失败后每个图片块用局部 `retryNonce` 重跑“检查→（有授权时）获取”，一次点击恰好一次尝试，绝无定时/自动重试（R26；INV-AZ-11）。
- **D-30-6 聚合顺序**：多目录/多文档提示以一次性队列呈现，头部解决后依次显示；文档会话结束（关闭/替换）时 `clearPromptsFor` 丢弃该文档排队提示，防过期对话框。
- **D-30-7 授权失败=拒绝**：`grant_*` 命令失败经 `onError` 上报一次（就近横幅）并将范围标记 blocked；占位保留，显式点击可再次尝试（`resource-flow.test`）。
- **D-30-8 会话恢复（`load_session`）不在本 handoff 范围**：models §10 的“参数文件优先、恢复标签不抢焦点”在启动恢复流程落地时适用；本任务只保证 pending 队列按序、首个成功文件获得焦点。

## 7. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 |
|---|---|
| 真实 X11 `tauri://drag-drop` 拖放打开（含非文档路径拒绝） | jsdom 无 OS 拖放；事件桥与批语义已测，真实桌面走查属 wp-34（T-63） |
| 断网/抓包口径的远程默认零请求（AT26） | 以 mock 边界断言 `fetch_remote_image` 零调用；真实网络观测属 wp-34 |
| Rust 侧受控获取细节（私网/环回阻断、逐跳重定向、大小/超时帽、缓存删除计数） | `security-model §4` 由 Rust `services/resources` 实现；前端只消费 `PS_REMOTE_*` 文案与 `RevokeResult`，闭环属集成/系统验证 |
| 持久授权的启动逐条复核与 SQLite 落库（INV-AZ-09 后半） | Rust wp-08 注册表（持久化钩子）；本任务前端不持久化任何授权 |
| 真实 WebKit 下的模态焦点/Esc/屏幕阅读器行为 | jsdom + Modal 焦点陷阱测试；200% 缩放与真实 AT 属 wp-34 |
| `clear_records(authorizations)` 后已打开远程资源的内存卸载联动 | wp-27 清除流程与 Rust 效果已存在；reader 侧未订阅该事件（会话级远程授权不在持久授权列表中，关闭文档即撤销）；如需内存立即卸载属后续评审项 |

## 8. 追溯

- **implementation-plan §4.3**：T-56（四入口、单实例移交、批量顺序/首成功焦点、非文档拒绝）、T-57（本地授权对话框、越界聚合、范围/数量、记住默认不选、安全默认、拒绝不追问）、T-58（远程对话框、域名列表、会话级、重定向阻止文案、撤销卸载与缓存清理）；Standards：STRICT。
- **contracts §2.1**（命令 1/2/4/9/24–30/35 语义逐条消费：`open_documents` 项序与独立校验、`check_resource_access` 不 reject、`fetch_remote_image` 仅授权后且不自动重试、`take_pending_open_requests` 一次排空）、**§3.1/§3.6/§3.7**（`OpenOutcome`/`AccessDecision`/`GrantRecord`/`OpenRequest` 字段逐字段使用）、**§4**（`open-requested`、内建 `drag-drop`）、**§8**（`files`/`tree`/`auth`/`remote`/`app` 签名逐项使用；未新增命令或字段）。
- **security-model §2–§4**（授权类型与作用域、越界确认一次聚合、remote 默认阻止/ HTTPS 会话允许/重定向不自动扩权/撤销删除缓存）；**ADR-005**（B 方案：Rust 注册表为唯一判定；界面路径非凭证）。
- **models §8**（INV-AZ-01..11；状态机 None→Prompted→Session/Persistent/Blocked→Revoked 与显式重开；撤销效果）、**§10**（启动队列优先级：pending 参数先于恢复、不抢焦点——恢复流程未在本任务实现，D-30-8）。
- **ui-spec §3.1/§3.2**（打开反馈：首个成功激活、批量按输入顺序、失败不清空成功项、取消不改状态）、**§3.3**（目录入口授权根、单文件授权不开放整树）、**§3.6**（越界/远程占位与进入授权入口、多张权限错误汇总为一个提示）、**§3.8/IX10**（模态、范围+数量、不写原文件、记住默认不选、安全默认、Esc=保持阻止、拒绝后不反复、仅显式重开）、**§6.2/§6.3**（模态焦点限制、`role=dialog`+`aria-modal`、关闭回触发元素）、**§7**（EDGE-01/02/03）。
- **requirements**：R01（四入口）、R05（duplicate 复用 canonical 标签）、R25（本地聚合与显式授权）、R26（远程默认阻止与会话授权）；AT01、AT25、AT26 的前端可测部分。

## 9. 结论与下一步

wp-30 + wp-31（T-56–T-58）已在本任务合并实现：四入口适配器与批量语义（顺序/首成功焦点/duplicate 复用/失败汇总、取消零变化、非文档拒绝不是命令）；本地越界资源按目录一次聚合的授权对话框（范围/数量/不写原文件、记住默认不选、安全默认与 Esc=阻止、拒绝不追问）；远程图片默认零请求、按文档会话的域名授权、受控 `fetch_remote_image`、重定向阻止文案与仅显式重试、撤销卸载与关闭会话时 `revoke_remote_session`。四项 DoD（`pnpm typecheck`、`pnpm lint`、`pnpm test -- --run` 499/499、`pnpm build`）全部通过。待独立质量审查（quality-reviewer）与 Component/Gate 判定；§7 清单随 wp-34/35 的真实窗口、网络与 Rust 闭环验证。
