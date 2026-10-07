# 纸栈 PaperStack · wp-25 页内搜索与导航历史实现报告（Search & Navigation History）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP25
- **Artifact Type**: Implementation Evidence Report（T-42–T-44 实现证据；UI03 页内搜索 + models §5 每标签导航历史）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-25-search`（任务分支 `task/wp-25-search`；父分支 `feat/v0.1.0`；基线提交 `6d0f9455bcf81daf4dc7adfe3ed02b533bc52854`；产出提交主题 `feat(search): add in-page search and navigation history`）
- **Components**: UI03 搜索条（`src/features/search/**`）；导航历史（`src/features/reader/history/**`）；ReaderScreen 装配（Ctrl+F、Alt+←/→、工具栏后退/前进/查找、`<mark>` 高亮、跨文件当前标签导航）
- **Last Verified**: 2026-10-07
- **Scope**: `src/**`（实现与测试）与 `artifacts/60-implementation/**`（本报告）。未修改 `package.json`、`src-tauri/`、`fixtures/`、pinned 输入、locale 键表或其他 Artifact。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-25-search.json` 逐字一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/40-ux/ui-spec.md` | `3a68817a…052e28` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69c…b5065c0` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `artifacts/30-architecture/adr/ADR-007-search.md` | `b8e56f8d…e625db1` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…b02967f` | ✓ |

基线 `6d0f945`；任务开始时工作树干净；分支 `task/wp-25-search`；`python3 scripts/swe_guard.py status` 显示本任务 ACTIVE；所有产出均在 handoff `writes` 范围内。文案全部取自冻结的 `src/locales/zh-CN.json`（378 键，未新增、未删除）；`no-hardcoded-strings` 与 `i18n.keys` 守卫随测试通过。

## 2. 交付物与文件清单

### 2.1 新增

| 路径 | 内容 |
|---|---|
| `src/features/search/search-core.ts` | 字面子串搜索纯函数：正文分段命中（`BodySearchHit`：blockId/segId/kind/段内偏移/文档序）、源码原文命中（字节偏移+1-based 行号）、`toLowerCase` 折叠（`caseSensitive=true` 关闭）、公式源判定、结果片段 |
| `src/features/search/use-search-session.ts` | 每标签搜索会话存储 + hook：IME 门控、150ms 去抖、三态（idle/indexing/results/noResults）、旧批次 `runId` 隔离、EDGE-05 Enter 语义与循环提示、`complete=false` 不完整提示、取消提示、Esc 保留查询与选区；模块级按标签内存（仅内存、不写盘） |
| `src/features/search/SearchBar.tsx` | UI03：`role=search`、正文/源码范围、输入框、区分大小写、当前/总数计数、上一项/下一项、关闭、索引/无结果/循环/不完整提示、公式源码匹配标签 + 检查源码入口、点击结果定位 |
| `src/features/search/search.css` | 搜索条与结果列表样式、VC-16 `<mark>` / 当前命中轮廓 |
| `src/features/reader/history/history.ts` | 每标签 `back`/`forward` 栈纯模型：`NavPoint{from,to}`、5 种 kind、提交/后退/前进、搜索会话 upsert 合并、新导航清 forward、容量上限 100（models §5.4 P-01 建议值）、精确/近似文案键 |
| `src/features/reader/history/use-reader-history.ts` | React 绑定（同步 ref 镜像；`commit`/`search`/`back`/`forward`） |

### 2.2 修改

| 路径 | 变更 |
|---|---|
| `src/features/reader/ReaderScreen.tsx` | 搜索会话宿主（高亮数据、结果定位、公式检查）；导航历史集成（大纲/脚注/fragment/搜索/跨文件）；Alt+←/→ 与 Ctrl+F；搜索定位队列（挂载/展开后聚焦）；Esc 焦点回最后命中；历史提示 Banner；工具栏新 props；`resolveDocumentLink` 纯函数；>50MiB 时接入 `search.searchSource` |
| `src/features/reader/body/DocumentView.tsx` | 覆盖组件改为模块级 + Context 传值（修复“每次搜索状态变化重建整棵文档树、丢失块内展开状态”的隐患）；`<mark>` 高亮渲染；相对链接点击路由；`revealBlockId` 透传渐进挂载 |
| `src/document/map.tsx` | `useProgressiveMount` 支持 `revealIndex`：命中/恢复目标块立即挂载并保持挂载（不跳过未挂载块） |
| `src/features/reader/inspect/CodeBlock.tsx` | 展开按钮加稳定类 `ps-code-expand`（定位命中时先展开折叠代码块） |
| `src/features/reader/reader-state.ts` | `tab/docReplace` action：当前标签内切换文档（保留 tabId/激活序，`session/opened` 递增代次使旧任务失效） |
| `src/features/reader/use-reader.ts` | `navigateDocument(tabId, path, anchorId)`：经 `files.openDocuments` 校验后替换当前标签文档并重新读取；失败/取消返回 null（不产生历史） |
| `src/features/reader/toolbar/ReaderToolbar.tsx` | 后退/前进启用并给出禁用原因；查找按钮启用/`aria-pressed`；新增 `canGoBack/canGoForward/searchAvailable/searchOpen/onBack/onForward/onToggleSearch` props |

## 3. 验证命令与结果（工作目录 = 项目根；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit`，无诊断 | 0 |
| 2 | `pnpm lint` | `eslint .`，无诊断（含 react-hooks v7 新规则） | 0 |
| 3 | `pnpm test -- --run` | **Test Files 46 passed (46)；Tests 344 passed (344)**，Duration 9.47s（基线 41 文件/290 测试 + 新增 5 文件/54 测试） | 0 |
| 4 | `pnpm build` | `tsc && vite build`，`✓ built`（仅既有 >500 kB chunk 提示，非错误） | 0 |

测试无 `skip`/`only`；组件级集成用例使用真实计时器 + `findBy*/waitFor`，会话级用例使用 `vi.useFakeTimers()` 精确推进去抖，全部确定性。

## 4. 测试清单（新增 54）

| 测试文件 | 用例数 | 覆盖（DoD 映射） |
|---|---|---|
| `src/features/search/search-core.test.ts` | 15 | 字面/正则字面量、非重叠顺序、大小写（不归一）；CJK 短查询、emoji/组合字符偏移；代码/行内代码/公式源分段与文档序；公式源判定；源码原文命中（字节偏移+行号、清理掉的内容）；`complete=false` 透传；片段摘要 |
| `src/features/search/use-search-session.test.tsx` | 9 | 150ms 去抖与旧计数立即清除；IME 组合门控导航；EDGE-05 首/尾与 next/prev 矩阵、循环提示；索引未就绪；无结果三态；异步源码旧批次隔离（晚到 A 不覆盖 B）；`complete=false` 不完整与取消提示；关闭保留查询/选区、按标签隔离；点击结果并清提示 |
| `src/features/search/SearchBar.test.tsx` | 8 | `role=search` 与聚焦；去抖计数 0/N 与点击结果；composition 期间不提交/Enter 不定位、结束后提交；Enter/Shift+Enter 与循环提示；公式源标签 + 检查源码动作；索引/无结果文案；重开时已有查询被选中；Esc 关闭并回调宿主 |
| `src/features/reader/history/history.test.ts` | 10 | INV-NH-01 标签隔离；INV-NH-02 每成功导航恰 1 项；后退恢复来源/前进恢复目标；INV-NH-04 后退不清 forward、新导航清 forward（含合并更新）；INV-NH-05 会话合并为 1 项且末次目标胜出/重开会话新项；INV-NH-07 初始禁用；容量上限；INV-NH-08 精确/近似文案键 |
| `src/features/search/search-integration.test.tsx` | 12 | Ctrl+F → 去抖 → `<mark>` 全部高亮 → Enter 定位与当前轮廓；折叠代码尾部命中先展开后定位；公式源命中标签 + 检查抽屉；图片 alt 命中块内聚焦；源码范围找到被清理内容并进入源码视图；搜索会话合并为 1 项 + Esc 保留 + Alt+←/→；无结果不产生历史；大纲导航 1 项 + 精确恢复文案；跨文件链接当前标签导航（单标签不变）且后退返回；被拒目标不产生历史；阅读/源码视图切换不产生历史；标签级查询与历史隔离 |

## 5. 行为说明、偏差与已知缺口（不掩盖）

- **D-25-1 结果列表为展示性上限**：`SEARCH_RESULT_DISPLAY_LIMIT = 200` 仅限制可点击结果行的渲染数量（大文档渲染保护）；计数器始终显示完整命中数与序号，未把裁剪列表表述为完整结果。
- **D-25-2 缺失 fragment 的行为**：同页 `#` 链接在目标锚点不存在时保持当前位置且不产生历史项（“失败/取消不消费”）。规格 §3.3 要求“保持位置并说明”，但冻结文案目录没有对应句子键，未新增文案；该“说明”缺口见 §6 UNVERIFIED/待上游裁决。
- **D-25-3 近似恢复分支**：`nav.return.approx` 仅在记录的锚点/块在当前版本中找不到时出现（落到文档顶部，绝不任选一处）；UI 集成用例覆盖精确路径，近似映射由 `restoreMessageKey` 单测保证，未构造 UI 级近似场景。
- **D-25-4 `search_source` 路径就绪但无法端到端触发**：窗口模式（>50MiB，无内存原文）时 ReaderScreen 会把源码范围搜索接到 `search.searchSource`（命令 38，`maxResults=500`），`complete=false`/取消语义由会话 hook 单测覆盖；wp-28 完成大文档窗口流程前无法在真实 UI 走通（见 §7）。
- **D-25-5 跨标签同 docId**：models §5.2 要求跨文件链接默认作用于当前标签（“即使其他标签显示目标”），因此同一 docId 可能出现在两个标签；`selectTabByDocId`（wp-19）按首个匹配处理 watch-changed。属规格允许的既有语义，wp-30 入口集成时复核。
- **D-25-6 历史容量**：按 models §5.4 P-01 建议值 100/标签实现（超出丢最旧），该参数仍为“待验证参数”，不作为验收阈值。
- **D-25-7 DocumentView 重挂载隐患修复**：原实现每次渲染重建覆盖组件身份；wp-25 新增的高亮状态会因此整树重挂并丢代码块展开状态。已改为模块级覆盖组件 + `DocumentOverrideContext` 传值；此修复对既有功能是纯稳定性改进（既有 290 测试全部保持通过）。
- **D-25-8 搜索查询仅内存**：无任何 `storage` 调用；关闭/重启不恢复（models §10.2 “不恢复清单”）。

## 6. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 |
|---|---|
| 缺失 fragment 的“说明”文案 | 冻结文案目录无对应键；行为（保持位置、零历史）已实现，说明缺失待上游补键或裁决 |
| >50MiB 源码窗口的 `search_source` 端到端（扫描覆盖说明、`PS_LIMIT_SEARCH` UI 呈现） | wp-28（T-51/T-52）范围；本任务接好服务与完整性状态机 |
| UI 级“近似恢复”提示（`nav.return.approx`） | 需要构造目标块消失/版本变化场景；wp-29 更新提交流程落地后复核 |
| 真实窗口的键盘/IME/焦点走查（含 200% 缩放、深浅主题） | EA-RUN/wp-34 口径；本任务以 jsdom 组件与集成测试覆盖行为 |
| 结果列表超过 200 行的渲染表现 | 无真实大文档样例；显示上限属实现保护，未实测 |

## 7. 追溯

- **implementation-plan §4.3**：T-42（SearchBar + useSearchSession：IME/去抖/范围/大小写/计数/EDGE-05/三态）、T-43（正文分段/源码原文、`<mark>`、折叠先展开、公式源标签、跨块顺序）、T-44（每标签栈、来源记录、搜索会话合并、后退清 forward、Alt+←/→、返回定位文案）；Standards：STRICT。
- **ADR-007**：字面子串、无正则/归一；正文用 `SearchSegment[]`（文本/代码/行内代码/alt/公式源/可见 HTML 文本）；源码扫描解码原文；结果按文档序并映射到 `(blockId, segId, offset)`；命中先挂载/展开再定位；IME 门控 + 150ms 去抖 + generation 隔离；三态独立文案；查询仅内存；公式源命中标“公式源码匹配”；>50MiB 走 `search_source`（`complete=false` 如实呈现）。
- **models §5 / INV-NH-01..08**：每标签栈、`{entryId, kind, from, to, committedAt}`、搜索会话至多 1 项、后退与新导航规则、失败/取消 0 项、返回定位文案；§5.4 去抖 150ms、容量建议值。
- **ui-spec §3.4**（UI03 全部行为）、**§6.1**（Ctrl+F、Enter/Shift+Enter、Alt+←/→、Esc 层级）、**§6.2/§6.3**（`role=search`、计数状态文本）、**§6.4**（后退/前进/查找禁用原因）、**EDGE-04/05/07**、**VC-16**。
- **contracts §8 命令 38 `search_source`**：仅在窗口模式调用；未新增命令、字段或依赖。
- **strings 目录（378 键冻结）**：`search.*`、`nav.return.*`、`toolbar.*`、`code.action.*` 均为既有键；无硬编码自然语言。
- **wp-24 接口**：`OutlineTree.onNavigate(entry, fromAnchorId)` 来源锚点回调被消费（大纲历史项）；`ReaderUi` 公式检查入口用于“检查源码”。

## 8. 结论与下一步

UI03 页内搜索（正文/源码范围、IME 门控、去抖、三态、EDGE-05、公式源标签、`<mark>`、折叠/未挂载先展开后定位）与每标签导航历史（来源记录、搜索会话合并、后退清 forward、Alt+←/→、精确/近似恢复文案、跨文件当前标签导航）已按冻结规格接入真实服务与展示版本；`pnpm typecheck`、`pnpm lint`、`pnpm test -- --run`（344/344）、`pnpm build` 四项 DoD 全部通过，提交 `feat(search): add in-page search and navigation history`。待独立质量审查（quality-reviewer）与 Gate；§6 清单随 wp-28/29/34 与上游文案裁决闭环。
