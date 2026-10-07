# 纸栈 PaperStack · wp-36a 前端/管线修复实现报告（Review B 发现 B-01…B-10）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP36A
- **Artifact Type**: Implementation Evidence Report（独立评审 B `artifacts/60-review/review-b-frontend-pipeline.md` Rev 1 §9 修复清单的前端/管线整改证据）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-36a-fix-frontend`（任务分支 `task/wp-36a-fix-frontend`；父分支 `feat/v0.1.0`；基线提交 `a4de1b25a194797bafabada2b425282dc654171d`；产出提交主题 `fix(reader): resolve review b findings`）
- **Components**: C-10–C-17 前端/管线（`src/document/**`、`src/features/**`、`src/app/**`、`src/test/**`、`src/locales/**`）
- **Scope**: `src/`、`artifacts/60-implementation/`。未修改 `artifacts/30-architecture/`、`artifacts/35-models/`、`artifacts/40-ux/`、`src-tauri/`、pinned 输入或框架文件；无新增依赖。
- **Review base**: 评审 B 针对修订 `00259fe`；本修复基线为其后合并入 `feat/v0.1.0` 的 `a4de1b2`。前端评审目标与 `00259fe` 的字节关系见 §1。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 `state/handoffs/wp-36a-fix-frontend.json` 逐字一致，只读未改）：

| 输入 | SHA-256（前 8/后 8） | 一致 |
|---|---|---|
| `artifacts/60-review/review-b-frontend-pipeline.md` | `68515a88…1dbc596d` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a…70143919` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…93f47f74` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817a…49052e28` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69c…fb5065c0` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |

修复前基线（`a4de1b2`）：前端 `pnpm test -- --run` = **69 文件 / 529 passed**（与评审 §1.3 一致）；`pnpm typecheck`/`pnpm lint` 零诊断；契约套件 44 passed；Rust `cargo test` 274 passed（本次未触碰 Rust）。本修订净增 2 个测试文件、18 个用例（547 − 529）；未削弱任何既有断言。

## 2. 发现修复（B-01…B-10，10/10）

| # | 严重度 | 根因 | 修复位置 | 新增/扩展测试 | 状态 |
|---|---|---|---|---|---|
| B-01 | major | 第二处 DSIH 位于公式检查抽屉，且预览未复用冻结 KaTeX 帽 | 新增唯一受信封装 `src/document/SanitizedNode.tsx`；`FormulaPanel.tsx`（`katexOptions({})` + 封装）、`MermaidBlock.tsx`（两处注入改走封装） | `src/test/single-trusted-html-entry.test.ts`（2 项）；`FormulaPanel.test.tsx` 新增“预览复用 katexOptions / 20em 帽” | 修复 |
| B-02 | major | `a` 无 `id` 白名单 ⇒ 回引 `#ps-fnref-*` 目标被消毒剥离，`resolveFragment` 死分支 | `sanitize.ts` 新增 `FOOTNOTE_REF_ID_PATTERN` 并用于 `a`；消费侧无需改动（既有 `ps-fn(ref)?` 解析闭合） | `pipeline.test.ts`：`every fragment href resolves / a id 仅脚注形状`；`ReaderScreen.test.tsx`：回引点到第 1/第 2 个引用处 | 修复（上游 §5.2 同步见 §4） |
| B-03 | minor | `remarkRehype` 默认英文 `Footnotes` 标签进入渲染 | `ParseDocumentOptions.footnoteLabel`（`types.ts`/`pipeline.ts`）；App 层经 `t('document.footnoteLabel')` 注入（`use-reader.ts::parseOptionsFor`）；无注入时用非语言空白回退（库对 falsy 会回退英文默认值） | `pipeline.test.ts`：注入标签生效 + 无注入不含 `Footnotes`；`ReaderScreen` 脚注文档用例（B-02） | 修复 |
| B-04 | major | UI01“文档信息”端到端缺失、7 个 catalog 键悬空 | 新增 `src/features/reader/info/DocumentInfoPanel.tsx`；`ReaderToolbar.tsx` 文件名改按钮 + 非模态 `Popover`；`ReaderScreen.tsx` 传入 docId/显示版本/资源类诊断 | 新增 `DocumentInfoPanel.test.tsx`（4 项）；`ReaderScreen.test.tsx`：打开/内容/关闭回焦/无文档禁用原因 | 修复（选 (a)） |
| B-05 | minor | 更多菜单缺“更新行为”项、`menu.updateBehavior` 悬空 | `ReaderToolbar.tsx` 增菜单项（查看源码/返回阅读之后）；`ReaderScreen.tsx` 打开 `fileUpdate` 分类 | `ReaderScreen.test.tsx`：菜单项存在 + 激活后为文件与更新分类 | 修复 |
| B-06 | minor | relink 采用路径跨 await 无 docId/generation 复核 | `use-reader.ts::adoptRelinkResult`：await 后按 `tabId` 重读当前标签，要求 `docId` 与 `generation` 未变，否则零可见影响丢弃 | `ReaderScreen.test.tsx`：在途期间同标签导航至另一文档 → 迟到结果被丢弃 | 修复 |
| B-07 | minor | 聚焦复核仅活动标签 | `use-reader.ts::recheckOpenTabs`（原 `recheckActive`）：对所有已打开标签执行稳定刷新；后台候选只暂存，激活再评估（INV-UM-04） | `ReaderScreen.test.tsx`：后台标签 refresh 派发 + 激活后仍显示旧版本、仅出现新版本横幅 | 修复 |
| B-08 | minor | 节点计数在活 DOM `innerHTML` 解析，且计数在校验前植入 | `mermaid.tsx`：`countSvgNodesInDom` → `countSvgNodesLazy`（惰性 `DOMParser`，无 DOM/无 DOMParser 时字符串计数） | `mermaid.test.ts`：含 `onload`/`<image>` 桩 SVG 不建活元素、不触发处理/资源、不入页面 | 修复 |
| B-09 | minor | i18n 守卫仅扫 `app/components`，且注释会误报 | `src/test/no-hardcoded-strings.test.ts`：`SCAN_DIRS` 扩至 `{app,components,features,document,services}`，扫描前去注释，保留一个已分类的非 UI 类型字面量白名单；键存在性同范围 | 同文件新增“注释去噪”用例；全量套件在扩围后全绿 | 修复 |
| B-10 | minor | D-3 消毒增量非最小：严格 §5.2 schema 也能渲染数学 | `sanitize.ts` 删除 `math-(inline\|display)` 备选（`MATH_MARKER_CLASS_PATTERN`/`CODE_CLASS_PATTERN` 移除），`code` 仅 `^language-…$`；`katex.ts` 注释同步 | `katex.test.ts`：严格 schema 下内联/块数学仍渲染，`math-inline`/`math-display` 被剥离 | 修复（选 (a)） |

### 2.1 B-01（major）DSIH 收敛单点 + 冻结帽继承

- 唯一封装 `src/document/SanitizedNode.tsx` 承接 `dangerouslySetInnerHTML`；`grep -rn "dangerouslySetInnerHTML" src --include=*.tsx --include=*.ts | grep -v test` 只命中该模块（代码站点 1 处 + 引用安全模型原文的注释）。
- `FormulaPanel.renderFormulaPreview` 改为 `{...katexOptions({}), displayMode:false, throwOnError:false}`；测试以 spy 断言调用参数逐字等于冻结 options，并以 `\rule{100em}{1em}` 断言输出被 `maxSize:20em` 钳制（不含 `width="100em"`）；Mermaid 主渲染与放大层改用 `<SanitizedNode as="div" …>`。
- 两个消费点仍只注入 `trust:false`/`strict:'warn'` 引擎输出；封装点只承担单点注入，不改变任何引擎配置——属性级防护继续由消毒 schema 与引擎冻结配置承担。

### 2.2 B-02（major）脚注回引目标可达

- Schema：`a: ['href','title',['id', FOOTNOTE_REF_ID_PATTERN]]`，pattern 与 checklist 一致 `^ps-fn(ref)?-[A-Za-z0-9-]+$`；`li` 保持更紧的 `^ps-fn-…$`。任意其它 `a id`（如 `evil`）仍被剥离（负例覆盖）。
- 解析级不变量：含“同一脚注两处引用”的文档，全部 4 个 `href="#…"` 目标（`ps-fn-1`、`ps-fnref-1`、`ps-fnref-1-2` 及重复目标）均存在。
- 组件级：点击 `↩`/`↩²` 分别滚动到 `#ps-fnref-1`/`#ps-fnref-1-2`，且不再出现“未找到该标题。”。

### 2.3 B-03（minor）脚注区标题本地化

- `ParseDocumentOptions.footnoteLabel` 由 `parseOptionsFor` 注入 `t('document.footnoteLabel')`（新键 `脚注`）；`resolvePipelineOptions` 对无注入的直接调用使用 `BLANK_FOOTNOTE_LABEL = ' '`（`mdast-util-to-hast` 对 falsy 回退英文默认，故不可用空串），保证直接管线运行也不产生未翻译英文标题。

### 2.4 B-04（major）文档信息入口

- 工具栏文件名为按钮（`aria-haspopup=dialog`、`aria-expanded`）；展开非模态 `Popover` 承载 `DocumentInfoPanel`：编码（`get_source_info` 惰性读取，加载/不可用态如实显示）、完整路径、内容版本（显示版本 hash）、资源问题（资源类诊断列表/空态）、只读标记；显式关闭与 Esc 回触发点，无文档时禁用并给出 `document.info.disabled` 原因；7 个 `document.info.*` 键全部经 `t()` 消费，不再悬空。

### 2.5 B-06/B-07（minor）异步边界与聚焦复核

- `adoptRelinkResult` 在 await 之后以 `tabId` 重读当前标签并要求 `docId`/`generation` 相等；`reassociated` 与 `new-version` 两分支均在复核之后派发（关闭标签由 `tabs` 缺失覆盖，保持不可重建）。
- `recheckOpenTabs` 对全部已打开标签调用稳定刷新（后台结果仅进入 `pendingVersion`，激活时按 keep/follow/选区/检查层决策），与 contracts §7.5 与 models §3.2 W7 的“活动标签＋全部可见文档”一致。

### 2.6 B-08（minor）Mermaid 计数改惰性解析

- 默认计数不再向活 DOM 写入：`DOMParser.parseFromString(svg,'image/svg+xml')` 得到惰性文档并计数；测试以 `createElement` spy、`onload` 桩与活页面查询断言无副作用；超限仍在渲染结果返回前拒绝。

### 2.7 B-10（minor）D-3 增量移除

- 选择清单方案 (a)：删除两个 `math-*` 备选 token，`code` className 与 security-model §5.2 逐字一致（`^language-[A-Za-z0-9_+-]{1,32}$`）；`rehype-katex` 与本仓库引擎均以 `language-math` 识别，`$x^2$` 与 `$$y$$` 仍渲染（katex.test 断言）。

## 3. 验证证据（本修订，全部实测）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `pnpm typecheck` | 0 诊断 |
| Lint | `pnpm lint` | 0 诊断 |
| 前端全量 | `pnpm test -- --run` | **71 文件 / 547 passed / 0 failed**（基线 69/529；+18） |
| 契约/语义向量 | `pnpm vitest run --config tests/contracts/vitest.config.ts` | **4 文件 / 44 passed**（≥44 基准） |
| 生产构建 | `pnpm build` | 成功（仅既有 >500kB chunk 警告） |
| Rust（未触碰，保证性复跑） | `cargo test --manifest-path src-tauri/Cargo.toml --offline` | **274 passed / 0 failed** |
| DSIH 静态探针 | `grep -rn "dangerouslySetInnerHTML" src --include=*.tsx --include=*.ts \| grep -v test` | 仅 `src/document/SanitizedNode.tsx`（1 代码站点 + 规范引注注释） |
| D-3 残留探针 | `grep -n "MATH_MARKER_CLASS_PATTERN\|CODE_CLASS_PATTERN" src/document/sanitize.ts` | 无命中 |
| 脚注标签探针 | `grep -rn "footnoteLabel" src --include=*.ts --include=*.tsx` | 参数化路径存在；无 `Footnotes` 字面量 |
| 菜单/文档信息探针 | `grep -n "menu.updateBehavior" …`；`grep -rn "document.info" src --include=*.tsx` | 均命中实现 |

新增用例分布：`single-trusted-html-entry.test.ts`（+2）、`DocumentInfoPanel.test.tsx`（+4）、`pipeline.test.ts`（+3）、`katex.test.ts`（改写 D-3 用例）、`mermaid.test.ts`（+1）、`FormulaPanel.test.tsx`（+1）、`no-hardcoded-strings.test.ts`（+1）、`ReaderScreen.test.tsx`（+6：B-02/B-04×2/B-05/B-06/B-07）。

## 4. 清单项路由与记录（不在本任务写权限内）

1. **security-model §5.2 同步（B-02 方案 (a) 的上游文本）**：实现采用 checklist 给定的 `a id` 白名单 `^ps-fn(ref)?-[A-Za-z0-9-]+$`；`artifacts/30-architecture/security-model.md:121` 行文尚未列入 `a id`，按 Change Impact 路由 solution-architect 修订（本任务 scope 仅 `src/` + `artifacts/60-implementation/`，未改写架构件）。
2. **字符串目录增量（B-03/B-04）**：新增 3 键（`document.footnoteLabel`、`document.info.disabled`、`document.info.issues.none`），`zh-CN.json` 共 381 键；`i18n.keys.test.ts` 以 `WP_36A_FIX_KEY_COUNT = 3` 记录增量，同 wp-34a 先例留待 wp-42 目录对账。
3. **wp-19 D-3 历史记录**：wp-19 报告为历史证据，不再修改；本报告 §2.7 为其“必要性不成立”的复核与撤回记录（README/文档阶段的目录对账不属于本任务）。

## 5. UNVERIFIED（不得读作通过；由合并复审/桌面复跑承接）

1. 真实 WebView（WebKit/X11）中的 Mermaid strict 渲染、SVG 注入与 KaTeX CSP 表现——本任务为 jsdom + 构建验证。
2. Tauri 窗口聚焦事件在真实桌面上的后台标签复核（B-07）与系统文件对话框模态性（B-06 窗口交错）——组件级已测，桌面未复跑。
3. 受影响桌面项 AT09/AT12/AT14/AT15/AT16/AT30 的相关子项与 Review B′ 对抗性探针复跑——由合并复审执行（不同评审者）。
