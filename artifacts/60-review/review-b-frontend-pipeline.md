# 纸栈 PaperStack · 独立评审 B（前端与渲染管线）

- **Producer**: agent:quality-reviewer
- **Artifact ID**: ART-60-REVIEW-B
- **Artifact Type**: Independent Review Report（T-65；渲染管线顺序与消毒、`dangerouslySetInnerHTML` 禁令、引擎受信边界、提交规则单点、搜索语义与折叠、锚点与更新流、i18n 硬编码与键完整性、a11y 基本项、DR-07 范围纪律、测试质量）
- **Status**: VALID
- **Revision**: 1
- **Owner**: quality-reviewer
- **Task**: `wp-36-review-b`（任务分支 `task/wp-36-review-b`；父分支 `feat/v0.1.0`；评审修订 `00259fef53add65634d6b6d890b1c2bebc02567b`；快照 `refs/swe/snapshots/20261007T134334Z-wp-36-review-b-1fa0e32d`）
- **Last Verified**: 2026-10-07
- **Review base**: `00259fe`（HEAD；评审前工作树干净；快照与 HEAD 对抽样的评审目标字节一致；只读评审，未修改 `src/`、`src-tauri/`、`tests/`、`fixtures/`、配置或框架文件；本报告为唯一写入）
- **Scope**: 计划 §6.1 评审 B 清单的 C-10–C-17 前端/管线范围；评审目标 = handoff `review_targets`（`src/document/`、`src/features/`、`src/app/`、`src/components/`、`src/locales/`、`src/styles/`、`vite.config.ts`、`package.json`）。判定仅对本修订有效。
- **Verdict**: **FAIL**（3 major + 7 minor；详见 §2–§3）。核心消毒/strip/管线顺序/提交规则/搜索语义的对抗性验证总体通过；失败集中在 `dangerouslySetInnerHTML` 单点禁令（B-01）、脚注回引锚点被消毒剥离（B-02）与 UI01“文档信息”缺失（B-04）。

**Pinned inputs（SHA-256 于 2026-10-07 实测复核，全部一致）**

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a…0143919` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…93f47f74` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…6c3ac88a` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…8568e1fad` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817a…49052e28` | ✓ |
| `artifacts/70-verification/acceptance-at.md` | `e9fc554b…fb1cd7e2` | ✓ |
| `artifacts/70-verification/unit-integration-report.md` | `a4c90529…1157d261` | ✓ |
| `config/git-policy.json` | `3b8ddffd…9241a014` | ✓ |

---

## 1. 方法与证据

### 1.1 修订与范围固定

- `git rev-parse HEAD` = `00259fe`，与 handoff `base_commit`/`parent_commit` 一致；`git status --porcelain` 为空；分支 `task/wp-36-review-b` 未切换。
- 抽样核对快照 `20261007T134334Z-wp-36-review-b-1fa0e32d` 与 HEAD 的评审目标字节：`src/document/pipeline.ts`、`src/features/reader/use-reader.ts`、`src/locales/zh-CN.json`、`vite.config.ts`、`package.json` 全部 `same`（`git rev-parse <snap>:<path>` == `git rev-parse HEAD:<path>`）。
- 7 项 pinned 输入与 `config/git-policy.json` 的 SHA-256 实测一致（见上表）。

### 1.2 静态核对清单（全量阅读）

- 管线与消毒：`src/document/{pipeline,sanitize,engines,annotate,map,source-map,hash}.ts(x)`、`src/document/plugins/{register,katex,shiki,mermaid}.ts(x)`、`src/document/transforms/{blocks,segments,outline,html-text}.ts`、`src/document/modes/modes.ts`、`src/document/worker/{protocol,client}.ts`。
- 状态与提交：`src/app/{session,store,events,write-suppression,i18n}.ts`、`src/features/reader/{use-reader.ts,ReaderScreen.tsx,reader-state.ts}`、`src/features/reader/{update,position,view,resources,tabs,toolbar,inspect,zoom,source,body}` 的生产代码。
- 搜索：`src/features/search/{search-core,use-search-session,SearchBar}.ts(x)`、`tests/contracts/vectors/search-parity.json`、`tests/contracts/search-parity.test.ts` 与 `src-tauri/tests/contract_search_parity.rs`（只读对照，确认共享向量绑定双方）。
- i18n：`src/locales/zh-CN.json`、`src/app/i18n.ts`、`src/app/i18n.keys.test.ts`、`src/test/no-hardcoded-strings.test.ts`。
- 规范逐条对照：`rendering-pipeline` §1–§7、`security-model` §5–§6、`contracts` §5–§8、`models` §1–§6、`ui-spec` §1–§9、plan §6.1（评审 B 清单）。

### 1.3 本修订执行的检查（只读；命令与结果）

| 检查 | 命令 | 结果 |
|---|---|---|
| 前端全量套件 | `pnpm test -- --run` | **69 files / 529 passed**（0 failed；与 acceptance Rev 3 基线一致） |
| 契约/语义向量（前端侧） | `pnpm vitest run --config tests/contracts/vitest.config.ts` | **4 files / 44 passed** |
| 类型检查 | `pnpm typecheck` | 0 诊断 |
| Lint | `pnpm lint` | 0 诊断 |
| i18n 全量扫描（自写脚本，替代仅扫 `app/components` 的既有守卫） | Python 扫描 `src/**` 非测试文件 | 除注释外唯一 CJK 字面量为类型字面量 `'纸栈 PaperStack'`（`src/services/types.ts:538`，非运行时 UI 文案）；**0 处**未 `t()` 的用户可见中文字符串 |
| 键完整性（自写脚本） | 解析 `zh-CN.json` + 目录 `strings-zh-CN.md` | 380 键 = 目录 378 + 已记录增量 2（`nav.fragment.notFound`、`document.unavailable.banner`）；0 重复键、0 缺失键 |

### 1.4 对抗性探针（构造性尝试证伪）

探针 harness 位于仓库外 `/tmp/opencode/review-b/`（`vitest.config.ts` + `adversarial.test.ts` + `footnote.test.ts` + `d3.test.ts` + `focus.test.ts`；经符号链接使用仓库 `node_modules`，**不是交付物**，未写入仓库）。执行命令：

```sh
cd <repo> && node_modules/.bin/vitest run --config /tmp/opencode/review-b/vitest.config.ts adversarial.test.ts  # 17 passed
cd <repo> && node_modules/.bin/vitest run --config /tmp/opencode/review-b/vitest.config.ts d3.test.ts           # 2 passed
cd <repo> && node_modules/.bin/vitest run --config /tmp/opencode/review-b/vitest.config.ts footnote.test.ts     # 证据落盘 footnote-hast.json / footnote-ids.json
```

#### 1.4.1 对抗样例文档（原样内联；探针输入）

````md
# Probe heading

<script>window.__pwned=1</script>
<img src=x onerror="window.__pwned=2">
<svg onload="window.__pwned=3"><circle cx='1'/></svg>
<iframe src="https://example.com"></iframe>
<style>body{display:none}</style>
<form action="/x"><button type="submit">go</button></form>
<math><mi xlink:href="javascript:alert(1)">x</mi></math>
<div style="background:url(javascript:alert(1))">styled</div>
<video controls><source src="x.mp4"></video>

<a href="javascript:alert('x')">js link</a>
<a href="data:text/html,<script>alert(1)</script>">data link</a>
<a href="vbscript:msgbox(1)">vb link</a>
<a href="file:///etc/passwd">file link</a>
<a href="https://example.com/ok" title="ok">https link</a>

<details open ontoggle="window.__pwned=4"><summary>sum</summary><p>inner content</p></details>
<input type="checkbox" checked onchange="window.__pwned=5">
<input type="text" value="text input">

<!-- c --><noscript><p title="</noscript><img src=x onerror=window.__pwned=6>">n</p></noscript>

<h1 id="ps-h-evil">injected heading id</h1>
<h1 id="evil-id">not allowed heading id</h1>
<p id="ps-h-x">p id not allowed</p>

<pre><code class="language-mermaid">flowchart TD
  A-->B
</code></pre>

<code class="language-math math-inline">\href{javascript:alert(1)}{click me}</code>

<code class="language-math math-inline">\def\boom{\boom\boom}\boom</code>

<pre><code class="language-js">const x = "<img src=x onerror=window.__pwned=7>"</code></pre>

```js
const x = "<img src=x onerror=window.__pwned=7>"
```

<p>plain tail text</p>
````

探针 A（①–⑦ 迷你管线，精确复用 `sanitizeSchema` + `rehypeForceTaskCheckboxDisabled`）断言与实测（全部通过）：

1. `STRIPPED_RAW_TAGS`（script/style/iframe/object/embed/form/button/svg/math/video/audio/source/link/meta/base/template/textarea/select/option）与 `noscript` **全部不在**最终 hast。
2. 全部属性中**无** `/^on/i`、**无** `style`。
3. 全部 `href`/`src` **无** `javascript:|data:|vbscript:|file:|blob:|asset:`。
4. 存活 `input` 全部 `type=checkbox` + `disabled=true`；`<input type="text">` 文本输入不再以 text 形态出现。
5. `id` 仅 `ps-h-evil` 存活（`evil-id`、`<p id="ps-h-x">` 被剥离）；`code` className 仅命中 `language-*`/`math-(inline|display)`；`li` className 仅 `task-list-item`；`section` 仅 `footnotes`。
6. `__pwned` 从未出现在任何属性值；`details/summary` 与可读回退文本保留。

探针 B（完整 `parseDocument`）实测：

- `\def\boom{\boom\boom}\boom` → 1 个 `.math-error` 占位 + `PS_PARSE_LOCAL` 诊断（`details.engine='katex'`，诊断 JSON **不含**正文或 `javascript` 字样）。
- `\href{javascript:alert(1)}{…}`（trust:false）→ KaTeX 以红色错误 token 呈现，**不产生 `<a>`、不产生 href 属性**；`javascript:` 仅作为 MathML `<annotation>` 的**文本**出现（非属性，不可执行；单独探针 `focus.test.ts` 复核了该输出）。
- `language-mermaid` 代码块 → `div.mermaid-block` 占位（无 `svg` 节点，源码以文本携带）；`language-js` 围栏块 → `div.code-block`，`<img …>` 文本保持为**文本**（JSON 含 `__pwned=7`，无 `img` 元素）。
- 全篇 `svg` 标签数 = 0（mermaid 未在管线内渲染）。

探针 C（脚注，见 B-02）：输入 `Text with a footnote[^1] and a second reference[^1].\n\n[^1]: The note body.` 后 sanitize 产物：

```text
IDS:   [('li', 'ps-fn-1')]
HREFS: [('a', '#ps-fn-1'), ('a', '#ps-fn-1'), ('a', '#ps-fnref-1'), ('a', '#ps-fnref-1-2')]
href targets missing an id: ['#ps-fnref-1', '#ps-fnref-1-2']
```

即：注脚目标 `li id="ps-fn-1"` 存活，但两个**回引链接**的目标 id 不存在。

探针 D（D-3 必要性，见 B-10）：以“严格 §5.2”schema（`code` className 仅 `language-*`，即不含 D-3 增量）重建同管线，`$x^2$` 与 `$$y$$` **仍渲染为 KaTeX**（`language-math` 已足以被 `rehype-katex` 与本仓库引擎识别）；当前 schema 结果相同。

探针 E（会话提交规则，见 §2 区域 2）：`sessionReducer` 对 ① 过期 `generation`、② 非当前目标 `version`、③ 错误 `docId`、④ 关闭后任何迟到结果 **全部零变化**；`session/opened`（重开）在 closed 代次上严格递增；`canCommit` 三条件逐一为假时拒绝；v0→v1 提交后迟到的 v0 结果不改变 `displayVersion`（INV-VC-01）。17/17 通过。

探针 F（搜索）：字面子串（`a.b` 不被当作正则）、CRLF 行号（`needle` → byte 7–13 / line 2）、`foldLower('ΟΔΟΣ')='οδοσ'`、`foldLower('İ')='i\u0307'`、body 范围按 `text/code/math` 段按文档顺序命中。通过。

### 1.5 明确限制

本评审为静态阅读 + jsdom 探针 + 既有套件复跑；未重新执行桌面（X11）用例、未真实运行 Mermaid/WebKit 缓存/IME 场景；`acceptance-at.md` Rev 3 与 `unit-integration-report.md` 作为既证引用，不重复采信其结论以外的事实。详见 §5。

---

## 2. 逐区域判定（对照计划 §6.1 评审 B 清单）

| # | 区域 | 判定 | 关键证据 |
|---|---|---|---|
| 1 | 管线与消毒（①–⑫ 顺序、`allowDangerousHtml`/`rehype-raw` 策略、strip 保证、schema 精确性、DSIH 禁令、引擎受信边界） | **FAIL** | 顺序与 strip 探针全过；`rehype-sanitize` 位于引擎前（pipeline.ts:80-85,113-131）；但 **B-01（major，第二处 DSIH）**，另有 B-08/B-10（minor） |
| 2 | 提交规则与版本语义（§6 单点、generation 单调、关闭/重开失效、资源 `?v=`、大文档诚实性） | **CONCERN** | `canCommit` 单点 + 全量 dispatch 走 `tabSessionAction`（use-reader.ts:458-463）探针全过；资源失效 `resourceInvalidation.bump`→`key={assetUrl}` 重挂（ImageBlock.tsx:76-80,172-178）；`largeDocHonesty`（modes.ts:112-160）无“部分称全文”；**B-06（minor）** |
| 3 | 搜索与折叠（ADR-007 字面语义、`foldLower` 逐码点、共享向量绑定、折叠/未挂载命中、公式源标签、旧批次隔离、CJK/emoji/CRLF） | **PASS** | 向量文件被前端 `findSourceHits` 与 Rust `search_service` 同源执行（search-parity.test.ts:6,64-70；contract_search_parity.rs:96-130）；runId 失效（use-search-session.ts:226-249,303-348）；折叠先展开（ReaderScreen.tsx:686-693）；公式源 `isFormulaHit` + `search.formulaMatch`（SearchBar.tsx:199-212）；A-06 契约文本债随 A 评审保留 |
| 4 | 锚点与更新流程（INV-AR 决策树、单次布局校正、抑制、keep/follow、选区暂停、后台暂缓、无虚假“精确”） | **FAIL** | 决策树/校正/抑制与测试齐备（position.ts:105-154,321-362；position.test.ts 13 项）；keep/follow 矩阵与选区/检查层暂停（update-model.ts:42-49；ReaderScreen.tsx:405-434）；**B-02（major，脚注回引锚点不可达）**、**B-07（minor，焦点复核仅活动标签）** |
| 5 | i18n（硬编码扫描、键完整性、目录增量、回退） | **CONCERN** | 380=378+2 精确、无缺失、无重复、无原始键泄漏（D-34-1 已修：AboutSection.tsx:66-68）；**B-03（minor，生成的脚注标签 "Footnotes" 未走 `t()`）**、**B-04（major，文档信息缺失致 7 个 `document.info.*` 键悬空）**、**B-05（minor）**、**B-09（minor，守卫范围缺口）** |
| 6 | a11y 基本项（模态焦点陷阱/返回、抽屉不困焦点、角色/名称、键盘路径、禁用原因、无 hover-only、aria-live 使用） | **PASS（附观察）** | Modal 陷阱+返回（Modal.tsx:87-126）；Drawer 非模态（Drawer.tsx:60-71）；`role=toolbar/tablist/tree/search/complementary/dialog` 与 catalog 名称（TabBar.tsx:29；NavPanel.tsx:85-112；Toolbar.tsx:31；InspectDrawer.tsx:27；ZoomOverlay.tsx:218-220）；Button/IconButton/Menu 禁用原因 + `aria-describedby`（Button.tsx:71-91；IconButton.tsx:32-70）；操作条 hover 与 `:focus-within` 并存、无 `display:none`（reader.css:198-205,828-866）；`role=status/alert` 承担 aria-live 语义。观察：标签栏未实现方向键在 tab 间移动（Ctrl+Tab 路径存在，WAI-ARIA tabs 惯例为建议非强制） |
| 7 | 范围纪律（DR-07：无 v1.0/占位入口、无“建设中”） | **PASS** | 全 `src/` 检索无 TeX/PDF/批注/账号/插件入口、无 coming-soon/占位按钮；更多菜单与关于页仅实现项；`sourceEntryUrl` 未配置时显示真实原因（AboutSection.tsx:65-68,127-138） |
| 8 | 测试质量（需求 oracle、弱化/重复断言、flake、覆盖缺口） | **CONCERN** | 529+44 全绿且 oracle 独立（见 §6）；F-32-4 竞态已按建议修复（PrivacySection.test.tsx:126-131,172-177,189-194）；**缺 B-01/B-02/B-03/B-04 对应用例**，另有 B-09 |

---

## 3. 发现（findings）

> 严重度定义：**blocker** = 违反 Must 级安全/正确性条款且确定性可复现；**major** = 违反规范条款、真实流程可复现、影响面受限；**minor** = 失败路径/防御深度/文本债/测试缺口。所有发现针对修订 `00259fe`；本评审未修改任何代码。

### B-01（major）`dangerouslySetInnerHTML` 存在第二处未授权站点（公式检查抽屉）

- **位置**：
  - `src/features/reader/inspect/FormulaPanel.tsx:22-33`（`renderFormulaPreview`：`katex.renderToString` + `throwOnError:false, trust:false, strict:'warn'`）与 `:49-52`（`createElement('span', { dangerouslySetInnerHTML: { __html: previewHtml } })`）。
  - 对照允许点：`src/features/reader/body/MermaidBlock.tsx:138,150`（wp-19 报告 `artifacts/60-implementation/wp-19-reader.md:169` 自称“唯一 DSIH 位于 Mermaid 受信输出封装”）。
- **证据**：`grep -rn dangerouslySetInnerHTML src` → 4 命中（2 注释 + 2 代码站点）；仓库内**不存在** `Document/SanitizedNode` 组件；`wp-24-nav.md` §6 的偏差清单未记录该站点；`FormulaPanel` 的输入 `target.source` 来自文档公式文本（`MathBlock.tsx:62-82` 的 annotation/错误源或搜索命中段），属文档不可信输入。
- **违反条款**：`security-model.md:126`——“**`dangerouslySetInnerHTML` 禁令（强制）**：仅允许在‘消毒后受信引擎输出’单一封装组件（`Document/SanitizedNode`）内出现；代码中其它位置禁止；由质量审查静态检查（R09；ADR-002）”；plan §6.1 评审 B 清单“DSIH 禁令唯一入口”。
- **影响**：静态审计边界破裂；且该预览未使用管线冻结的 `katexOptions` 帽（`src/document/plugins/katex.ts:44-52` 的 `maxSize:20`/`maxExpand:1000`/宏上下文），超宽/宏展开公式在抽屉与放大层中不受 20em 帽约束（`maxExpand` 恰好同为 KaTeX 默认 1000，`maxSize` 缺省为 `Infinity`）。
- **复现**：静态（上述 grep 与文件阅读）。无已证实 XSS：内容仍是 `trust:false` 的 KaTeX 输出；本发现为禁令/边界违背与防御深度，不宣称可利用。
- **修复方向（不实施）**：抽取唯一受信封装组件（如 `TrustedEngineHtml`）供 Mermaid 与公式预览共用；预览复用 `katexOptions()`；新增静态单点测试。

### B-02（major）脚注回引链接不可达：`a id="ps-fnref-*"` 被消毒剥离，点击回引显示“未找到该标题。”

- **位置**：
  - `src/document/sanitize.ts:125`（`a: ['href','title']`——无 `id`）、`:130`（`li` 仅允许 `ps-fn-*`）、`:91`（`FOOTNOTE_ID_PATTERN`）。
  - 消费侧：`src/features/reader/ReaderScreen.tsx:650-660`（`resolveFragment` 明确支持 `ps-fn(ref)?-*` id 查找）、`:811-813`（`anchorKind` 同型正则）、`:905-946`（缺失 fragment → `nav.fragment.notFound`）。
- **证据**（探针 C，确定性）：同文档 sanitize 产物 `IDS: [('li','ps-fn-1')]`；回引链接 `HREFS: #ps-fnref-1, #ps-fnref-1-2`；`href targets missing an id: ['#ps-fnref-1','#ps-fnref-1-2']`。`resolveFragment` 的 `ps-fnref` 分支因此为**死分支**；点击后 `getElementById` 为 null → `setFragmentNotice('nav.fragment.notFound')`（“未找到该标题。”）。
- **违反条款**：`models` §5.2“脚注链接 | 跳到注释；**返回链接**/Alt+左回引用 | 同注释多处引用需回具体引用处”（session-and-version-models.md:403，R16/IXD §6.2）；R08 脚注为承诺的 GFM 子集（requirements-baseline.md:141）；R16 导航历史（requirements-baseline.md:208-212）。**上游缺口**：`security-model.md:121` 仅允许 `li id` 与 `a href` 片段，未允许承载 `fnref` 的 `a id`——即 §5.2 照字面实现也必然得到死链；实现忠实地跟随了出错的 schema。
- **影响**：任何含脚注的文档，从注脚返回引用处的“↩/↩²”链接失效且给出误导性文案；同注释多处引用场景（R16 明确要求“回具体引用处”）完全不可达。
- **修复方向（不实施）**：二选一并同步上游——(a) `security-model.md` §5.2 为 `a` 增加 `id` 白名单 `^ps-fn(ref)?-[A-Za-z0-9-]+$`，`sanitize.ts` 同步（`a: ['href','title',['id',FOOTNOTE_REF_PATTERN]]`）；或 (b) 前端不改 schema，改由 React 层回引组件按“第 k 个引用锚”（文档序）滚动定位，不依赖 DOM id。修复后必须补“每个 `href="#…"` 目标存在”的解析级测试。

### B-03（minor）生成的脚注区标题 “Footnotes” 为未提取的硬编码英文界面文案

- **位置**：`src/document/pipeline.ts:80-84`（`remarkRehype` 未传 `footnoteLabel`，使用上游默认英文 "Footnotes"）。
- **证据**（探针 C）：sanitize 产物含 `<h2>Footnotes</h2>`（脚注 section 内），直接进入阅读视图。
- **违反条款**：ADR-009 规则“界面文案不得硬编码于组件、服务或 Rust”（ADR-009-i18n.md:43）、“所有文案经 `t(key)`”（ui-spec EDGE-12，ui-spec.md:333）；ADR-007 §Decision 2 提到该标签仅用于**排除搜索**（ADR-007-search.md:28），未处理本地化。
- **影响**：中文界面中出现英文区标题；同时该文案不在 `zh-CN.json` 中、无法随语言切换。
- **修复方向（不实施）**：把 `footnoteLabel` 作为 `ParseDocumentOptions` 参数由 App 层经 `t()` 注入（新增 catalog 增量）；或由架构裁决记录为上游限制。

### B-04（major）UI01“文档信息”端到端缺失：工具栏文件名不可展开，无 `info/DocumentInfoPanel.tsx`，7 个 catalog 键悬空

- **位置**：`src/features/reader/toolbar/ReaderToolbar.tsx:138-140`（`<span className="ps-toolbar-filename" title=…>`，无点击/弹层）；`src/features/reader/info/**` 不存在；`src/locales/zh-CN.json:53-59`（`document.info.title/encoding/path/version/issues/readonly/close`）。
- **证据**：全 `src/` 无 `document.info` 引用、无 `DocumentInfoPanel`/`documentInfo`；`wp-24-nav.md` §6 未记录该缺口；AT01–AT30 无覆盖该项的用例。
- **违反条款**：ui-spec §2.2 `info/DocumentInfoPanel.tsx`（“编码、完整路径、内容版本、资源问题”，ui-spec.md:77）；§3.2 工具栏“当前文件名（**点击展开‘文档信息’**）”（ui-spec.md:123）；plan C-12 职责含“文档信息”（implementation-plan.md:127）。
- **影响**：v0.1.0 UI01 的既有规格入口缺失；用户无法从工具栏查看编码/完整路径/内容版本/资源问题；catalog 中 7 个键成为死键（键完整性审查项）。
- **修复方向（不实施）**：实现最小 `DocumentInfoPanel`（按钮化文件名 + 展开层，复用现有 `snapshot/issues` 数据与 catalog 键），或由产品侧明确移出 v0.1 范围并修订 ui-spec/计划、记录 Change Impact（二选一，不得静默）。

### B-05（minor）更多菜单缺少 ui-spec 的“更新行为”项（`menu.updateBehavior` 悬空）

- **位置**：`src/features/reader/toolbar/ReaderToolbar.tsx:198-239`（菜单仅：查看源码/返回阅读、关闭文档、完整设置、关于）；`src/locales/zh-CN.json:45`（`menu.updateBehavior`）。
- **违反条款**：ui-spec §3.2 更多菜单组成“查看源码/返回阅读、**更新行为**、关闭文档、完整设置、关于”（ui-spec.md:123）。
- **影响**：更新行为仍可从完整设置 → 文件与更新到达，故影响有限；但菜单组成与规格不符、键悬空。
- **修复方向**：加回菜单项（打开设置对应分类）或修订 ui-spec。

### B-06（minor）relink 采用走无令牌 `session/displayReplaced`，await 之后无 docId/generation 复核（提交规则单点缺口）

- **位置**：`src/features/reader/use-reader.ts:921-946`（`adoptRelinkResult`：await 之后直接 `dispatchSession(tab, sessionDisplayReplaced(...))` 并 `startParse(..., tab.session.generation + 1)`，其中 `tab` 为 awaits 前的快照）；调用方 `relinkRecent`（:954-985）、`relinkTab`（:1060-1083）；reducer `src/app/session.ts:410-428`（`displayReplaced` 无 docId/generation 可校）。
- **证据**：静态；其余异步路径（`startRead`:618-620、`startParse`:511-521、`commitUpdate`:699-706、`startSourceWindow`:652-653）都有代次/目标复核，唯 relink 采用路径没有。
- **违反条款**：contracts §6.2/§6.3（任何跨异步边界任务携带 `TaskToken`；提交需 (a)(b)(c) 全部成立，contracts.md:348-354）；models INV-VC-02/06（session-and-version-models.md:230-234）。
- **影响**：在“文件对话框 await 期间目标标签被文档导航替换”的窄窗口交错下，旧文档的 relink 快照可能被写入新文档会话（关闭场景已由 reducer 的 `closed` 检查挡住；替换场景无防护）。真实可达性低（系统对话框通常模态）。
- **修复方向**：await 后重新读取当前 tab，要求 `current.docId === tab.docId && current.session.generation === expected` 才 dispatch；或把 relink 结果纳入 token 化 action；补一条“await 期间文档被替换 → 不采用”的单测。

### B-07（minor）窗口聚焦复核仅覆盖活动标签，未覆盖“活动标签与全部可见文档”

- **位置**：`src/features/reader/ReaderScreen.tsx:1100-1117`（focus → `recheckActive()`，节流 300ms）；`src/features/reader/use-reader.ts:1613-1618`（只取 `selectActiveTab`）。
- **违反条款**：contracts §7.5“聚焦时对**活动标签与全部可见文档**比较 stat … 不一致则触发稳定读取”（contracts.md:377-379）；models §3.2 W7“活动标签＋已打开文档”（session-and-version-models.md:282）；models 开放项 OI-03 明确该范围待裁决（`活动标签＋全部已打开标签`为模型采用的解释，session-and-version-models.md:741）。
- **影响**：后台标签在“missed event”场景下不会被聚焦复核补偿，直到其自身收到 watch 事件或被激活（激活当前也不复核）。属补偿机制缺口，watch 事件为主路径。
- **修复方向**：聚焦时对全部已打开标签做 stat 比较（后台结果仅暂存并在激活时处理，INV-UM-04），或按 OI-03 由架构裁决范围并同步 §7.5 文本；补“后台标签 missed event + 聚焦”组件用例。

### B-08（minor）Mermaid 节点计数在“活 DOM”上 `innerHTML` 解析受信引擎输出，且计数在校验之前

- **位置**：`src/document/plugins/mermaid.ts:87-92`（`countSvgNodesInDom`：`document.createElement('div'); container.innerHTML = svg`）与 `:157-163`（先 `renderer.render` 得到 SVG，再 `countNodes`，超限才拒绝）。
- **证据**：静态；生产路径 `MermaidBlock.tsx:104-107` 未注入 `countSvgNodes`，即使用默认 DOM 解析。
- **违反条款/精神**：security-model §5.1/§5.2 受信引擎输出边界（引擎输出直接进入活 DOM 前的处理应最小化）；非已证实漏洞——主渲染路径（DSIH 到 React）同样插入同一 SVG，`securityLevel:'strict'`+`htmlLabels:false` 是实际控制。
- **影响**：防御深度：若 Mermaid strict 策略未来回归，元素解析（含潜在 `img`/事件属性）会先发生于活 DOM；节点帽在解析后生效，无法拦截“先解析再拒绝”。
- **修复方向**：改用惰性解析（`DOMParser.parseFromString(svg,'image/svg+xml')`，不加载资源/不触发事件）或在插入前以字符串/流式计数；补“含 `onload` 的桩 SVG 不产生活节点副作用”的单测。

### B-09（minor）i18n 守卫的扫描范围缺口：`no-hardcoded-strings` 仅覆盖 `src/app` 与 `src/components`

- **位置**：`src/test/no-hardcoded-strings.test.ts:21`（`SCAN_DIRS = ['components','app']`）；键存在性检查复用同一文件集（:67-76）。
- **证据**：`src/features/**`、`src/document/**`、`src/services/**` 不在扫描内；本次人工全量扫描显示当前无用户可见违规（除 B-03 的生成标签），故为**防回归缺口**而非现存泄漏。
- **违反条款**：ADR-009 规则 5“键完整性：`zh-CN.json` 与代码中出现的所有 `t()` key 由测试/审查核对”（ADR-009-i18n.md:31）与“由质量审查静态检查硬编码文本”（:38）；ui-spec EDGE-12。
- **修复方向**：把扫描扩到全部 `src` 生产文件（注释需先去注释或改为只扫字符串字面量，避免现有中文注释误报）；键存在性检查同扩；B-03 修复后把生成标签纳入。

### B-10（minor）D-3 消毒增量安全性通过，但“最小性”未证实：严格 §5.2 schema 亦可渲染数学

- **位置**：`src/document/sanitize.ts:96-109`（`MATH_MARKER_CLASS_PATTERN` / `CODE_CLASS_PATTERN`，为 `code` className 增加 `math-(inline|display)` 备选）；授权来源 `artifacts/00-repository/gates/wp-17-gate.md:25` 的 D-3、记录于 `artifacts/60-implementation/wp-19-reader.md` §4。
- **证据**（探针 D）：把 schema 回退为 §5.2 原文（`code` 仅 `^language-…$`）后，`$x^2$` 与 `$$y$$` 仍由 `rehype-katex` 渲染为 KaTeX（其判定键含 `language-math`；本仓库 `isMathMarker` 亦以 `language-math` 命中）；当前 schema 结果相同 → 两个增量 token 并非渲染所必需。
- **违反条款/风险**：security-model §5.2 的“精确 schema”要求与评审清单“delta 是否真正最小”；增量本身安全（仅允许两个字面 token，无新标签/属性/协议，探针 1.4.1 复核 `evil` 类被剥离）。
- **影响**：无当前安全影响；若未来有人以该增量能触发引擎为由扩大 schema，则缺少“必要性”证据。
- **修复方向**：二选一并落档——(a) 删除两个增量 token，恢复与 §5.2 逐字一致的 schema，复跑 `pipeline/katex` 测试；或 (b) 保留并在 wp-19 证据中补一条“移除即失败”的必要性测试与理由。

---

## 4. 已复核并保持有效的边界与已修项

| 项 | 记录/修复位置 | 复核结论 |
|---|---|---|
| D-34-1 关于页原始 i18n 键泄漏 | `AboutSection.tsx:66-68`（`t(info.legal.sourceEntryNote ?? 'about.sourceUnconfigured')`） | 已修；`sourceEntryNote` 为 i18n 键（`src-tauri/src/services/info.rs:40,80`），三处键均存在于 `zh-CN.json`（:340 等） |
| D-34-2/3/4 会话恢复、最近记录、跨重启位置 | `use-reader.ts:1096-1170`（restore + startRead restore）、`:808-811`（touchRecent）、`:472-499`（loadPosition→restorePosition）；`session.test.ts`/`ReaderScreen.test.tsx` 1092-1179,1357-1556 | 已接线；AT06/AT19 Rev 3 PASS 与本评审静态核对一致 |
| D-34-5/6/7 远程取图、页内 fragment、错误态导出保护 | 相关路径在 wp-34c 修正；`ReaderScreen.tsx:650-660,905-926`；`docs`/Rust 见 Review A | 修正路径存在；AT26/28 Rev 3 PASS（引用，未复跑桌面） |
| 焦点复核仅活动标签 | 见 B-07 | 与 Review A §4 的“建议 Review B 确认”一致，本次确认为缺口 |
| `clobberPrefix`：remark-rehype 用 `ps-`（pipeline.ts:81），sanitize 用 `''`（sanitize.ts:138） | security-model §5.2（clobberPrefix `''`；应用 id 建议 `app-` 前缀） | 安全等效：文档可生成的 id 被两套正则限死为 `ps-h-*`/`ps-fn-*`，应用 id（`ps-settings-*`/`ps-popover-*`/React `useId`）不可能与之碰撞；属文本层面偏差，不构成发现 |
| 应用内工具栏注释“update flow (wp-29) is still absent” | `ReaderToolbar.tsx:20` | 陈旧注释（wp-29 已并入且 UpdateBanner 已接线）；仅文档债，不构成发现 |
| A-06 搜索折叠契约文本（`toLowerCase` vs 逐码点） | Review A A-06；`tests/contracts/vectors/search-parity.json:4` | 共享向量已验证绑定双方（前端 `findSourceHits`、Rust `search_source`）；契约 r2 文本债由 A 评审跟踪，本评审不重复计 |
| catalog 悬空键分类（70 个） | `zh-CN.json` | `error.*` 9 个为 Rust `messageKey` 运行时消费（`t(payload.messageKey)`）——非悬空；`document.info.*` 7 个与 `menu.updateBehavior` 对应 B-04/B-05；`shortcuts.*` 15、`aria.inspectDrawer/zoomDialog/toolbar/tabpanel` 4、`tooltip.disabled.*` 3（与已用的 `toolbar.disabled.*` 重复）等为目录盈余；建议随 B-04/B-05 处理时一并清理 |

---

## 5. 明确“无法在此验证”（不得读作通过）

1. **真实 WebView 中的 Mermaid strict 渲染与 SVG 注入**：本评审仅核对冻结配置常量、占位管线与节点/超时逻辑；真实渲染（含 DOMPurify 行为、CSP 下执行）依赖 AT12/AT09 的既有桌面证据，未复跑。
2. **KaTeX/Shiki/Mermaid 内联样式在真实 CSP 下的表现**（`style-src 'unsafe-inline'` 受控取舍）：仅静态核对 CSP 与消毒剥离；未在打包构建中验证。
3. **`?v=` 观察键绕过 WebKit 缓存的真实效果**：组件层已核对重挂路径；真实缓存行为属桌面证据。
4. **真实 IME、200% 缩放、1024×640/深色主题走查**：jsdom 与静态阅读覆盖语义；视觉/输入法行为未复验。
5. **10MiB/50MiB 端到端 UI 流程**：`largeDocHonesty` 与分类纯函数已核对；真实大文档打开/简化/源码窗口属 AT29（引用）。
6. **Rust 侧 `foldLower` 逐码点等价的实际执行**：本评审运行了前端向量与共享向量绑定检查；Rust 侧执行依赖 `contract_search_parity` 套件（既有报告 5 passed，引用），未在本机复跑 cargo。
7. **系统级“零网络请求”与远程取图**：属 AT26/Review A 范围，未复测。
8. **`no-hardcoded-strings` 扩展扫描后的注释误报规模**：仅给出方向，未实测扩展后的全量结果（避免改动测试文件）。

---

## 6. 前端测试质量评估

**强项（oracle 独立性）**

- 消毒/管线测试以规范文本构造断言（脚本/style/iframe/svg 剥离、协议白名单、checkbox 强制 disabled、`ps-h-*` id 形状、引擎顺序 math→code→mermaid、引擎输出不再消毒、失败引擎隔离且错误消息不含正文）：`pipeline.test.ts:86-268` —— 均为需求派生 oracle，不依赖实现输出。
- 会话提交规则以“乱序 v1/v2、代次回退防护、pending 合并、关闭后迟到结果、陈旧错误不可见”等 INV-VC 条款构造：`session.test.ts:70-251`，与 `contracts §6` 逐条对应。
- 搜索共享向量由**双方执行器**分别读取（前端 `findSourceHits`、Rust `search_source`），期望值手推且 İ 边界按侧固定（`search-parity.json:4,481-528`）；`use-search-session.test.tsx` 以 fake timers 断言 150ms 去抖、旧批次不闪回、IME 门控、EDGE-05 循环语义。
- 锚点/更新 oracle：`position.test.ts`（决策树 9 项 + 抑制/节流/单次校正）、`update-model.test.ts`（keep/follow/选区/检查层/后台）、`ReaderScreen.test.tsx` 对 D-34b-1（approx+blockId reveal）、D-34-6（缺失 fragment 提示）、AT06 恢复、AT07 不可用横幅等均有独立用例。
- 本修订复跑：前端 529/529、契约 44/44、typecheck/lint 零诊断；wp-32 已知测试竞态 F-32-4 已按报告建议修复（等待按钮 enabled 再点击，三处）。

**缺口（与发现对应）**

1. **无 DSIH 单点静态检查**（B-01）：安全模型要求“由质量审查静态检查”，但无自动化测试防回归；建议加一条源码扫描测试（断言 DSIH 仅在唯一封装模块）。
2. **无“fragment 目标必须存在”不变量测试**（B-02）：现有测试只覆盖“缺失 fragment 提示”，未断言脚注回引/重复引用的目标 id 存在；修复时补解析级与组件级用例。
3. **生成标签未纳入 i18n 守卫**（B-03/B-09）：`Footnotes` 由管线生成，任何现有测试都不会捕获；建议在扩展后的 i18n 守卫或管线测试中断言无未翻译默认标签。
4. **文档信息无组件测试**（B-04）：不存在被测组件，属功能缺口而非测试缺口。
5. 轻微：`i18n.keys.test.ts` 以“精确计数 380”防漂移，健壮性一般（新增/删除键必须同步计数），但注释与目录语义已说明，接受。

---

## 7. 结论与建议（overall recommendation: **FAIL**）

- **判定范围**：C-10–C-17 前端/管线（评审目标快照），修订 `00259fe`；证据见 §1–§6。
- **失败依据**：
  1. **B-01（major）** 违反 `security-model §5.2` 的强制单点 DSIH 禁令（第二站点未授权、未记录）；
  2. **B-02（major）** 脚注回引链接在消毒后必然死链（R16/models §5.2 可达性缺陷，schema 与消费代码不闭合）；
  3. **B-04（major）** UI01“文档信息”规格功能端到端缺失（ui-spec §2.2/§3.2、plan C-12），并造成 7 个 catalog 键悬空。
- **其余区域**：管线顺序与 strip 保证、`rehype-raw`+`allowDangerousHtml` 策略、KaTeX trust:false/Shiki 转义/Mermaid strict 常量、提交规则 reducer 单点、搜索字面语义与共享向量、锚点决策树与单次校正、a11y 焦点合同、DR-07 范围纪律的核对总体通过，证据质量高；7 个 minor 多为 schema 最小性、异步边界硬化、i18n 守卫范围与目录盈余。
- **建议处置**：
  1. 形成修正工作包（新提交）：先 B-02（改 schema 或改回引解析，并同步 `security-model §5.2`）、B-01（合并 DSIH 单点 + 复用 KaTeX 帽）、B-04（实现文档信息或修订规格，二选一并落档）；再处理 B-03/B-05/B-06/B-07/B-08/B-09/B-10。
  2. 修复后重跑受影响层：`pnpm test -- --run`、`pnpm vitest run --config tests/contracts/vitest.config.ts`、新增的解析级/守卫级用例；受影响桌面项按既有口径复跑（至少 AT09/AT12/AT14/AT15/AT16/AT30 中的相关子项与 Review B' 探针）。
  3. 修复引发 schema 变更时按 Change Impact 更新 `security-model.md` 与相关 Artifact 修订号；旧证据作废，需**不同评审者**复审（作者不自审）。
- **未做**：本评审未修改任何产品代码/测试/配置；§3 之外无更高严重度问题；UNVERIFIED 清单见 §5。

---

## 8. 追溯

| 条款 | 本文承接 |
|---|---|
| plan §6.1 评审 B；T-65 | §2 逐区域、§3 发现、§6 测试质量 |
| rendering-pipeline §1–§7 | §1.4 探针（顺序 ①–⑫、§2.4c 分段、§2.9/§2.10 引擎、§5 大文档）；B-01/B-08/B-10 |
| security-model §5/§6 | §1.4.1–1.4.2 消毒与引擎边界；B-01/B-02/B-08/B-10 |
| contracts §5–§8 | §2 区域 2–3；B-02（§6/§7.5）、B-06 |
| models §1–§6 | §2 区域 2–4；B-02/B-06/B-07 |
| ui-spec §2–§9；ADR-007/009 | §2 区域 5–6；B-03/B-04/B-05/B-09 |
| requirements-baseline R08/R16 | B-02 |
| 既有验证证据 | `unit-integration-report.md`（529/44 基线、F-32 修复）、`acceptance-at.md` Rev 3（D-34 修复、AT 全过） |
| 本评审证据 | §1.3 命令输出；§1.4 `/tmp/opencode/review-b/` 探针（仓库外，非交付物）；`refs/swe/snapshots/20261007T134334Z-wp-36-review-b-1fa0e32d` |

---

## 9. Fix-Verification Checklist（B-01…B-10）

使用说明：每个修复项在**新提交**上完成；修复任务给出“实现位置 + 新增测试 + 复跑输出”；复审（Review B'）按第 3 列逐项确认，并复跑全量前端套件（基准 ≥529 passed）与契约套件（基准 ≥44 passed），新增用例计入。测试文件路径均为仓库相对路径。

- [ ] **B-01（major）DSIH 收敛为单点**
  - **验收标准**：`grep -rn dangerouslySetInnerHTML src` 在代码站点上**恰有 1 个模块**（唯一受信封装），Mermaid 与公式预览都经由它；公式预览使用管线冻结帽（`maxSize`/`maxExpand`，与 `katexOptions` 同源）；内容仍为 `trust:false` 引擎输出。
  - **必须新增/扩展的测试**：`src/test/`（或 `src/document/`）新增静态守卫 `single-trusted-html-entry.test.ts`：扫描 `src/**` 生产文件，断言 DSIH 模块集合等于声明的单点文件；`FormulaPanel.test.tsx` 增加“超宽公式被 20em 帽约束/预览复用 katexOptions”断言（可通过导出 options 纯函数断言）。
  - **复审扫描/命令**：`grep -rn "dangerouslySetInnerHTML" src --include=*.tsx --include=*.ts | grep -v test`；`pnpm test -- --run`；对照 `security-model.md:126`。

- [ ] **B-02（major）脚注回引目标可达**
  - **验收标准**：对含“多引用同一脚注”的文档，sanitize 后每个 `href="#…"` 目标都存在；点击 `#ps-fnref-1`/`#ps-fnref-1-2` 能回到对应引用处并记录历史；`security-model §5.2` 与实现同步（若选 (a)，`a id` 白名单为 `^ps-fn(ref)?-[A-Za-z0-9-]+$`）。
  - **必须新增/扩展的测试**：`src/document/pipeline.test.ts` 新增 `every_fragment_href_resolves_to_an_id`（解析含脚注/重复引用的文档，遍历 hast 断言 `#…` 目标存在）；`ReaderScreen.test.tsx` 新增“点击回引到达第 k 个引用处”用例；若选 (b)，删除 `resolveFragment` 的死分支并补等价组件用例。
  - **复审扫描/命令**：复跑 §1.4 探针 C（脚注；期望 `href targets missing an id: []`）；`pnpm test -- --run`；对照 R16 与 models §5.2。

- [ ] **B-03（minor）脚注区标题本地化**
  - **验收标准**：脚注区标题不再出现英文 `Footnotes`；文案经 `t()`（新增 catalog 增量并同步 `i18n.keys.test.ts` 计数），或架构记录为上游限制并移出范围。
  - **必须新增/扩展的测试**：管线测试断言默认渲染不含未翻译字面量（存在 `footnoteLabel` 参数化路径）；i18n 守卫生效（见 B-09）。
  - **复审扫描/命令**：`grep -rn "footnoteLabel" src`；`pnpm test -- --run`。

- [ ] **B-04（major）文档信息入口闭合**
  - **验收标准**：二选一并落档——(a) 工具栏文件名为按钮/可展开控件，展开 `DocumentInfoPanel`（编码/完整路径/内容版本/资源问题，全部经 `t()`，关闭回触发点）；或 (b) 产品/架构在 Artifact 中明确将其移出 v0.1 并修订 ui-spec §2.2/§3.2 与 plan C-12（Change Impact 记录）。
  - **必须新增/扩展的测试**：选 (a)：`ReaderScreen.test.tsx`/`DocumentInfoPanel.test.tsx` 覆盖打开/内容/关闭回焦点/无文档时禁用原因；选 (b)：无代码测试但需变更记录。
  - **复审扫描/命令**：`grep -rn "document.info" src --include=*.tsx`（选 (a) 时非空）；`pnpm test -- --run`；检查 ui-spec/plan 修订状态。

- [ ] **B-05（minor）更多菜单补“更新行为”**
  - **验收标准**：更多菜单含“更新行为”项（打开设置对应分类）或 ui-spec §3.2 同步修订；`menu.updateBehavior` 不再悬空。
  - **必须新增/扩展的测试**：`ReaderToolbar`/`ReaderScreen` 菜单项存在性与激活后设置分类断言。
  - **复审扫描/命令**：`grep -n "menu.updateBehavior" src`；`pnpm test -- --run`。

- [ ] **B-06（minor）relink 采用前复核目标**
  - **验收标准**：`adoptRelinkResult` 在 await 之后确认 `current.docId === tab.docId` 且代次/目标未变，否则零可见影响丢弃；关闭场景保持不可重建。
  - **必须新增/扩展的测试**：`use-reader`/`ReaderScreen` 用例：relink 命令在途期间将标签导航到另一文档（或关闭），完成后不改变新文档会话（INV-VC-02/06）。
  - **复审扫描/命令**：`grep -n "adoptRelinkResult" -A20 src/features/reader/use-reader.ts`（必须有复核分支）；`pnpm test -- --run`。

- [ ] **B-07（minor）聚焦复核覆盖全部已打开文档**
  - **验收标准**：窗口聚焦时对活动标签与全部已打开标签比较 stat，不一致者触发稳定读取（后台结果只暂存，激活再处理）；或按 OI-03 裁决范围并更新 contracts §7.5 文本。
  - **必须新增/扩展的测试**：`ReaderScreen.test.tsx`：后台标签 missed event + 聚焦 → 派发 refresh；激活时不自动提交（INV-UM-04）。
  - **复审扫描/命令**：`grep -n "recheckActive\|selectActiveTab" -B2 -A8 src/features/reader/use-reader.ts`；`pnpm test -- --run`。

- [ ] **B-08（minor）Mermaid 节点计数改惰性解析或先计数**
  - **验收标准**：节点计数不再把引擎 SVG 写入活 DOM（`document.createElement`+`innerHTML` 移除或替换为 `DOMParser` 惰性文档/字符串计数）；超限仍在渲染前/隔离路径拒绝。
  - **必须新增/扩展的测试**：`mermaid.test.ts` 新增：注入含 `onload`/`<image href>` 的桩 SVG，断言计数路径不创建活元素、不触发资源加载（以 spy 记录）。
  - **复审扫描/命令**：`grep -n "innerHTML" src/document src/features`；`pnpm test -- --run`。

- [ ] **B-09（minor）i18n 守卫扩到全部 `src`**
  - **验收标准**：守卫覆盖 `src/{app,components,features,document,services}` 生产文件（排除 `locales/` 与 `*.test.*`），并对注释去噪；`t()` 字面量键存在性检查同范围；B-03 修复后覆盖生成标签。
  - **必须新增/扩展的测试**：`src/test/no-hardcoded-strings.test.ts` 更新 `SCAN_DIRS` 与参数化用例；确保扩围后 `pnpm test -- --run` 仍全绿。
  - **复审扫描/命令**：`grep -n "SCAN_DIRS" src/test/no-hardcoded-strings.test.ts`；`pnpm test -- --run`。

- [ ] **B-10（minor）D-3 最小性落档**
  - **验收标准**：二选一——(a) `sanitize.ts` 删除 `math-(inline|display)` 备选，schema 与 `security-model §5.2` 逐字一致，`pipeline/katex` 测试仍全绿；或 (b) 保留并在 Artifact 中补“移除即失败”的必要性测试与理由（含探针 D 的对照结果）。
  - **必须新增/扩展的测试**：选 (a)：现有 `katex.test.ts` D-3 用例改为断言严格 schema 下数学仍渲染；选 (b)：新增必要性负例测试。
  - **复审扫描/命令**：`grep -n "MATH_MARKER_CLASS_PATTERN\|CODE_CLASS_PATTERN" src/document/sanitize.ts`；`pnpm test -- --run`。

### 9.1 修复后复审的最低证据集

1. 新修订上的 `pnpm test -- --run`（≥529 passed，含 §9 新增用例）与 `pnpm vitest run --config tests/contracts/vitest.config.ts`（≥44 passed）。
2. §1.4 对抗性探针在新修订上复跑：至少 `adversarial.test.ts`（17）、脚注探针（回引目标 `[]`）、D-3 探针（按所选方案预期）。
3. 受影响桌面项按既有口径复跑（至少 AT14/AT15/AT16 的 fragment/脚注路径、AT30 的关于页键路径；不可执行项按 §5 标注）。
4. 本文件的 B-01…B-10 勾选状态与新证据引用，作为 Review B' 的输入；Review B' 由**不同评审者**执行。

---

## 10. 版本历史

| 修订 | 内容 | 判定变化 | 提交 |
|---|---|---|---|
| Rev 1 | 对 `00259fe` 的独立评审：8 区域核对、B-01…B-10、对抗性探针（17+2+脚注证据）、UNVERIFIED 清单、修复验证清单 | 建立：FAIL（3 major + 7 minor） | 本提交 |
