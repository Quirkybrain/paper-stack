# 纸栈 PaperStack · wp-27 设置、隐私、关于与诊断实现报告（Settings & Diagnostics）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP27
- **Artifact Type**: Implementation Evidence Report（T-48–T-50 实现证据；UI06 设置/隐私/关于 + UI07 诊断与导出）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-27-settings`（任务分支 `task/wp-27-settings`；父分支 `feat/v0.1.0`；基线提交 `adceeb57e235e170091c09b11e3c364c08505c34`；产出提交主题 `feat(settings): add settings, privacy, about and diagnostics ui`）
- **Last Verified**: 2026-10-07
- **Components**: UI06 Aa 浮层与五分类完整设置（`src/features/settings/**`）；隐私/清除/持久授权（`PrivacySection` + `ClearDataDialog`）；关于/许可离线查看（`AboutSection` + `LegalTextViewer`）；诊断面板与导出预览（`diagnostics/**`）；ReaderScreen/工具栏装配（Ctrl+,、Aa、更多菜单、错误面诊断入口、语法就地重渲染）；前端写回抑制镜像（`src/app/write-suppression.ts`）
- **Scope**: `src/**`（实现与测试）与 `artifacts/60-implementation/**`（本报告）。未修改 `package.json`、`pnpm-lock.yaml`、`src-tauri/`、`src/locales/zh-CN.json`、pinned 输入或其他 Artifact。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-27-settings.json` 逐字一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/40-ux/ui-spec.md` | `3a68817a…052e28` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69c…b5065c0` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…3f47f74` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…b02967f` | ✓ |

基线 `adceeb5`；分支 `task/wp-27-settings`；文案全部取自冻结的 `src/locales/zh-CN.json`（380 键，未新增、未删除）；所有产出均在 handoff `writes` 范围内。

## 2. 交付物与文件清单

### 2.1 新增（实现）

| 路径 | 内容 |
|---|---|
| `src/features/settings/settings-context.tsx` | 设置宿主：`get_settings` 装载；即改即预览（`update` 先合并再持久化）；applied/persisted 分离（`persisted=false` 或命令拒绝 → 应用值保留 + `saveState=failed`）；`retrySave` 只重发相对最后确认值的增量；主题/字号/行距/宽度写入 `document.documentElement` 而不重挂正文；系统主题经 `matchMedia` 跟随 |
| `src/features/settings/settings-model.ts` | 契约默认值、显示字段范围（14–24 / 1.5–2.2 / 560–960）、显示默认补丁（仅 4 字段）、增量比较、字节格式化 |
| `src/features/settings/controls.tsx` | `SettingsNumberField`（越界输入保留上次有效值 + `settings.reading.invalidValue`，有效输入与父状态同批提交）、`SaveFailureNotice`（“本次已生效，但未能保存到本地”+ 重试，绝不显示“已保存”）、`SettingSwitch` |
| `src/features/settings/TypographyPopover.tsx` | Aa 非模态浮层：字号/行距/宽度/主题/恢复显示默认；无“应用”按钮；无权限/日志/TeX 开关 |
| `src/features/settings/SettingsDialog.tsx` | 设置模态：阅读/文件与更新/语法/隐私/关于五分类；焦点陷阱 + Esc + 关闭回触发点（现有 `Modal`）；保存失败横幅；`currentDocument` 注入当前文档语法/更新覆盖 |
| `src/features/settings/sections/ReadingSection.tsx` | 字号/行距/宽度/主题/启动恢复偏好；恢复显示默认只动显示字段 |
| `src/features/settings/sections/FileUpdateSection.tsx` | 全局默认保持/跟随（持久化）+ 当前文档覆盖（会话级，wp-29 更新引擎消费）；作用域说明 |
| `src/features/settings/sections/SyntaxSection.tsx` | 全局标准/技术文档模式（持久化，就地重渲染）+ 当前文档行内美元开关（会话级，就地重渲染） |
| `src/features/settings/sections/PrivacySection.tsx` | “记住阅读记录”（独立偏好）、分类数量/空间、清除入口、持久授权列表 + 撤销（即时提示 `error.auth.revoked`，已载入内容不动） |
| `src/features/settings/dialogs/ClearDataDialog.tsx` | 清除确认模态：默认不预选；按钮按选择命名（如“清除{count}条最近记录”）；`confirm=true` 才执行；逐契约类别报告实际结果；任何失败 → `dialog.clear.result.partial`，绝不显示“清除完成” |
| `src/features/settings/privacy-model.ts` | UI 合并“位置与会话”行与契约类别映射、逐类描述键、清除后需抑制的类别 |
| `src/features/settings/sections/AboutSection.tsx` | 真实 `get_app_info`：产品/版本/所属者/GPL-3.0-only/GPL 与离线说明；构建信息折叠；`sourceEntryUrl=null` 时显示发布阻塞原因（`sourceEntryNote` 或 `about.sourceUnconfigured`），不伪造地址；外部 URL 仅点击后经 `opener.openExternalUrl` |
| `src/features/settings/about/LegalTextViewer.tsx` | 离线许可/第三方文本查看；资源未随包时显示错误消息（诚实降级），不渲染伪造文本 |
| `src/features/settings/diagnostics/diagnostics-model.ts` | 诊断条目模型（去重合并计数）、默认脱敏摘要（源码上下文/完整路径需显式勾选，计数已脱敏处）、`isProtectedExportTarget`（等于已打开文档或位于其 canonical 父目录内） |
| `src/features/settings/diagnostics/diagnostics-context.tsx` | 会话内存诊断收集器（错误面记录，去重计数） |
| `src/features/settings/diagnostics/DiagnosticsPanel.tsx` | 诊断模态：简明原因优先、类别/展示版本/源位置、详细技术信息折叠、复制脱敏摘要（默认不含正文/私人路径）、导出入口 |
| `src/features/settings/diagnostics/ExportPreviewDialog.tsx` | 导出流程：预览（脱敏选项变化即重新预览，预览可见）→ 选择保存位置 → 组件级源位置校验（受保护目标拒绝并解释）→ 写入 → 按实际结果提示；选择器取消不写；覆盖需明确确认；失败保留预览；不自动重试、不上传 |
| `src/features/settings/settings.css` | 设置/隐私/关于/诊断/导出样式（仅冻结设计令牌） |
| `src/features/settings/current-document.ts` | 当前文档设置上下文类型（会话级覆盖） |
| `src/features/settings/PrivacySection.tsx` | handoff 声明的顶层交付路径；按 ui-spec §2.3 规范路径 `sections/PrivacySection.tsx` 的显式再导出（路径调和，见 D-27-10） |
| `src/features/settings/AboutSection.tsx` | handoff 声明的顶层交付路径；按 ui-spec §2.3 规范路径 `sections/AboutSection.tsx` 的显式再导出（路径调和，见 D-27-10） |
| `src/app/write-suppression.ts` | 前端写回抑制镜像（models §9.1）：清除 recents/positions/session 后本地写调用门禁；显式打开（entry≠restore）或 `resumeSuppressedWrites` 恢复 |

### 2.2 修改

| 路径 | 变更 |
|---|---|
| `src/features/reader/ReaderScreen.tsx` | `SettingsProvider`/`DiagnosticsProvider` 装配；`ReaderSettingsBridge`（语法模式变化 → 就地重渲染，不读盘）；`DiagnosticsRecorder`（打开失败/活动标签错误/管线局部诊断入库）；Ctrl+, 打开设置（输入框内亦生效，IME 不拦截）；Aa 浮层宿主；更多菜单“完整设置/关于”；失败横幅与失败页加“诊断”入口；设置/诊断模态宿主 |
| `src/features/reader/toolbar/ReaderToolbar.tsx` | Aa 按钮启用并锚定 `TypographyPopover`（`aria-haspopup=dialog`/`aria-expanded`）；更多菜单新增“完整设置”“关于” |
| `src/features/reader/use-reader.ts` | `applySyntaxMode`（同 displayVersion/代次重解析内存文本，commit §6.3）；`inlineMathFor/setInlineMath`、`updateModeOverrideFor/setUpdateModeOverride`（会话级，关标签清理）；`saveSession` 在 session 抑制期返回 `{saved:false}`（无错误、不写库，INV-WB-01/02）；退出保存仅在带错误时阻止关闭；显式打开恢复本地抑制 |
| `src/components/Button.tsx` | 支持 React 19 ref-as-prop（清除确认模态初始焦点落在安全默认“取消”） |
| `src/test/setup.ts` | 每用例清理根元素主题/排版内联变量，避免设置宿主状态泄漏 |

## 3. 验证命令与结果（工作目录 = 项目根；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit`，无诊断 | 0 |
| 2 | `pnpm lint` | `eslint .`，无诊断（含 react-hooks v7 `set-state-in-effect`/`refs` 规则修正） | 0 |
| 3 | `pnpm test -- --run` | **Test Files 57 passed (57)；Tests 383 passed (383)**，Duration 12.42s（基线 46 文件/344 测试 + 新增 11 文件/39 测试） | 0 |
| 4 | `pnpm build` | `tsc && vite build`，`✓ built`（仅既有 >500 kB chunk 提示，非错误） | 0 |

测试无 `skip`/`only`；新增用例使用 `findBy*/waitFor` 等待异步服务 mock，无假计时器依赖；`SettingsProvider` 支持注入 `{getSettings, updateSettings}` mock（保存失败路径按需求注入）。**既有用例存在一个与本任务无关的稳定性问题**：`src/features/search/search-integration.test.tsx` 偶发（≈10–20%）在 Ctrl+F 后找不到 `searchbox`；在基线提交 `adceeb5` 的独立解包中同样复现（20 次单文件运行第 5 次失败，失败模式相同），非本任务引入。本任务分支全量 `pnpm test -- --run` 连续 3 次通过（383/383），见 D-27-11。

## 4. 测试清单（新增 39）

| 测试文件 | 用例数 | 覆盖（DoD 映射） |
|---|---|---|
| `src/app/write-suppression.test.ts` | 3 | 门禁初态可写；仅抑制被清除类别；按类别/全量恢复（显式重开语义） |
| `src/features/reader/write-suppression.test.tsx` | 2 | 抑制期 `save_session` 零调用且返回 `{saved:false}` 无错误；显式打开（dialog）恢复本地抑制 |
| `src/features/settings/settings-context.test.tsx` | 4 | 即改即预览 + `persisted=false` 保留应用值/失败态 + 重试增量；命令拒绝路径；恢复显示默认只发显示字段补丁且不动 `restoreSession`；`rememberRecords` 独立持久化 |
| `src/features/settings/TypographyPopover.test.tsx` | 4 | 越界保留上次有效值 + 说明、有效值同批应用；预览不重挂阅读位置且焦点留在字段；主题即时切换并持久化；恢复显示默认补丁范围 |
| `src/features/settings/SettingsDialog.test.tsx` | 4 | 五分类存在且切换内容（含关于真实版本）；保存失败横幅 + 重试清除且应用值仍在；焦点陷阱/Esc/焦点返回触发点；当前文档语法/更新覆盖接线 |
| `src/features/settings/PrivacySection.test.tsx` | 6 | 分类数量/空间 + 日志预算 + 持久授权；记住开关与清除互不影响；清除默认不预选、按钮按选择命名；部分失败逐类报告且无“清除完成”；清除后抑制 + 概览刷新 + 无 `resume_recording`/`save_session`；撤销即时生效且行移除 |
| `src/features/settings/AboutSection.test.tsx` | 4 | 真实版本/所属者/许可 + `sourceEntryUrl=null` 原因且无外部调用；配置 URL 仅点击后打开；离线许可文本逐字呈现；许可缺失时诚实降级且无伪造文本 |
| `src/features/settings/diagnostics/diagnostics-model.test.ts` | 4 | 重复合并计数/时间；默认脱敏源码上下文与完整路径并计数；显式勾选才包含；导出目标保护判定（等于文档/父目录内拒绝、相邻目录名不误杀） |
| `src/features/settings/diagnostics/DiagnosticsPanel.test.tsx` | 3 | 原因优先 + 详情默认折叠 + 错误编号/源位置；复制摘要默认脱敏；导出预览默认选项 + 勾选即重新预览 |
| `src/features/settings/diagnostics/ExportPreviewDialog.test.tsx` | 4 | 受保护目标拒绝且零写入、预览保留；选择器取消零写入；`PS_IO_EXPORT_BLOCKED` → 覆盖确认 → `overwrite=true` 重试成功；写失败保留预览 |
| `src/features/settings/syntax-rerender.test.tsx` | 1 | 集成：Ctrl+, 打开设置；行内美元关闭与全局模式切换均就地重渲染（DOM 变化）；`read_document` 始终 1 次（无磁盘重载） |

## 5. 行为说明、偏差与已知缺口（不掩盖）

- **D-27-1 写回抑制为镜像 + Rust 权威**：清除后的持久写入门禁由 Rust 存储层权威执行（wp-11，contracts `clear_records`/`resume_recording`）。前端镜像只覆盖 webview 自身发起的 `save_session` 调用，保证测试与 UI 不会在抑制期重建记录；`resume_recording` 命令不由前端隐式调用（models §9.1 的“显式打开”分支由 `open_documents` 的 `entry != restore` 在 Rust 侧解除）。
- **D-27-2 退出保存抑制语义**：抑制期 `saveSession()` 返回 `{saved:false}` 且无 `error`（逐字承接 models §9.1“不报错”），因此退出流程不弹“本次位置可能无法保存”的失败提示；只有带 `error` 的真实失败才阻止首次关闭。
- **D-27-3 导出覆盖判定**：contracts §5 将“受保护源位置”与“需覆盖确认”都归入 `PS_IO_EXPORT_BLOCKED`。前端先以已打开文档的 canonical 路径做组件级预检（security-model §7 步骤 2–3）并直接拒绝；其余目标在该错误码下作为覆盖确认提示，确认后以 `overwrite=true` 重试。
- **D-27-4 诊断源位置展示为字节范围**：`diagnostics.sourceLocation` 的值使用 `startByte-endByte`（信息面板无行映射可用），未伪造行号；`details` 仅来自契约已脱敏字段。
- **D-27-5 诊断入口覆盖面**：已接入打开失败横幅、活动标签读取/解析错误、管线局部诊断（公式/图表/代码）；`BlockErrorBoundary.onError`（文档层块级渲染失败）未单独上报，同一失败通常已由管线 `error.parse.local` 诊断覆盖。属“尽力接入”，见 §6。
- **D-27-6 关于页“项目网站”未渲染**：`AppInfo.legal` 仅提供 `sourceEntryUrl`，无项目网站 URL 字段；为避免伪造地址，未渲染网站入口（规格 §3.7 提到的网站入口待发行元数据/契约扩展）。`about.website` 键未被使用，键表未修改。
- **D-27-7 许可可用性标记**：`licenseAvailable=false` 时仍允许点开查看器，由 `read_legal_text` 的失败消息诚实呈现“未随包”，而非提前用界面断言资源不存在。
- **D-27-8 当前文档覆盖为会话状态**：行内美元开关与更新模式覆盖存于 `useReader` 内存（随标签关闭清理），只有全局默认/语法模式持久化——符合规格“覆盖仅本次文档会话”；更新模式覆盖由 wp-29（T-53）更新引擎消费。
- **D-27-9 系统主题跟随**：`matchMedia` 存在时跟随系统并监听变化；jsdom 无 `matchMedia`，测试环境回退为浅色（生产行为不受影响）。
- **D-27-10 交付路径调和**：handoff `deliverables` 声明 `src/features/settings/{PrivacySection,AboutSection}.tsx`，而 ui-spec §2.3 的组件树把二者放在 `settings/sections/`（与 Reading/FileUpdate/Syntax 一致）。实现保留在规范路径，handoff 声明的顶层路径为显式再导出模块（无逻辑重复），两处上游约束均满足。
- **D-27-11 既有搜索集成用例偶发失败（非本任务）**：`search-integration.test.tsx` 偶发在 Ctrl+F 后找不到 `searchbox`（单文件循环 ≈10–20%）。已在基线提交 `adceeb5` 的独立解包中复现同一失败模式，确认属既有稳定性问题；本任务新增的 39 个用例与其余既有用例在连续全量运行中稳定通过。是否修复由 wp-25 所有者/后续测试任务裁决，本次未改动该文件。

## 6. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 |
|---|---|
| 真实 Tauri 运行时端到端（`get_settings`/`update_settings`/`clear_records`/`list_grants`/`revoke_grant`/`preview_diagnostics`/`export_diagnostics`/`read_legal_text` 实际 IPC 与 Rust 行为） | 本任务范围内无真实后端联调；以 jsdom + 服务层 mock 覆盖 UI 语义；wp-31/集成阶段复核 |
| 撤销授权的运行时效果（取消在途请求、卸载远程资源、回阻止占位） | Rust 侧 R25/R26 语义；前端只呈现结果并更新列表；wp-31 范围 |
| 目标文件已存在时的覆盖拒绝（Rust 返回与 UI 确认的实际闭环） | 需要真实文件系统；前端按契约码实现确认分支 |
| 写回抑制的 Rust 侧行为（`saved:false` 不写库、显式打开解除） | models §9 权威在后端；前端镜像由单测/集成覆盖 |
| 块级渲染失败的独立诊断上报（`BlockErrorBoundary.onError`） | 见 D-27-5；未改造文档层组件 |
| 真实窗口的键盘/焦点/200% 缩放/深浅主题走查（含 Aa 浮层定位与模态嵌套） | EA-RUN/wp-34 口径；本任务以 jsdom 组件与集成测试覆盖行为 |
| 系统主题实时切换的视觉结果（`prefers-color-scheme` 变化） | 无真实桌面会话内切换证据 |
| `no-hardcoded-strings` 静态守卫对 `src/features/**` 的覆盖 | 既有守卫仅扫描 `src/components|app`；settings 组件全部经 `t(key)` 且仅使用既有键，但未纳入静态扫描范围（守卫范围外，见 D-27 备注） |

## 7. 追溯

- **implementation-plan §4.3**：T-48（TypographyPopover + SettingsDialog 五分类、即改即预览、applied/persisted 分离、恢复显示默认）、T-49（PrivacySection + ClearDataDialog + 持久授权：数量/空间、确认、逐类结果、抑制、撤销）、T-50（AboutSection + LegalTextViewer + DiagnosticsPanel + ExportPreviewDialog：离线许可、sourceEntryUrl=null + 原因、脱敏预览与目标选择）；Standards：STRICT。
- **ui-spec §3.7（UI06）**：Aa 浮层字段与即时预览/无应用按钮；完整设置五分类（无 LaTeX/PDF/批注/账号/插件）；保存失败提示与重试；恢复显示默认范围；语法变化就地重渲染；关于页版本/所属者/GPL/离线许可/构建/源码原因；Ctrl+,；Esc 层级。
- **ui-spec §3.8（UI07）**：清除选择默认空、动作命名、逐类结果与部分失败；记住记录独立；撤销效果一致；诊断“先原因后详情”、默认脱敏、源码上下文显式勾选且预览可见；导出顺序（预览 → 目标 → 校验 → 写入 → 实际结果）；覆盖确认；失败保留预览；不上传。
- **ui-spec §6/§7**：模态焦点陷阱/安全默认聚焦/Esc=取消/关闭回触发点（`Modal`）；非模态 Aa 浮层不困焦点、Esc 回触发按钮（`Popover`）；EDGE-01/02/03/04/10/12/13。
- **models §9（INV-WB-01..09）**：清除后写回抑制镜像与退出保存语义；`rememberRecords=false` 与抑制独立；逐类真实结果；清除不触碰源文件。
- **contracts §8**：仅消费既有服务签名（settings/storage/auth/diagnostics/app/opener/clipboard/files）；`UpdateSettingsResult.applied/persisted`、`ClearResult.error`、`DiagnosticsPreview`、`AppInfo.legal`、`ExportResult`、`RevokeResult` 逐字段使用；未新增命令或字段。
- **security-model §7**：默认脱敏（源码上下文/完整路径显式 opt-in、计数）；导出校验（等于已打开文档/位于其父目录内拒绝、覆盖确认、失败保留预览、不自动重试、不上传、不写源目录）。
- **strings 目录（380 键冻结）**：全部新界面文案取自既有 `settings.*`、`dialog.clear.*`、`storage.category.*`、`diagnostics.*`、`about.*`、`legal.*`、`error.*` 键；未新增/删除键，未硬编码自然语言。

## 8. 结论与下一步

T-48–T-50 已按冻结规格接入真实服务层：Aa 浮层与五分类设置（即改即预览、applied/persisted 分离、失败重试、恢复显示默认、语法就地重渲染无磁盘重载）、隐私（计数/空间、默认不预选、`confirm=true`、逐类实际结果、清除后写回抑制、撤销即时生效）、关于/许可（真实元数据、`sourceEntryUrl=null` 原因、离线文本诚实降级、外部链接仅点击）、诊断（原因优先、默认脱敏、导出预览/目标校验/覆盖确认/失败保留）。`pnpm typecheck`、`pnpm lint`、`pnpm test -- --run`（383/383）、`pnpm build` 四项 DoD 全部通过；待独立质量审查（quality-reviewer）与 Gate；§6 清单随 wp-31/34 与真实后端联调闭环。
