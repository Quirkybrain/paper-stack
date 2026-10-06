# 纸栈 PaperStack · wp-17/wp-18 文档解析管线实现报告（管线核心、变换、Worker 边界与 React 映射）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP17
- **Artifact Type**: Implementation Evidence Report（`src/document/**` 的构建、测试与验证证据；T-27..T-30 合并交付）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-17-pipeline`（任务分支 `task/wp-17-pipeline`；父分支 `feat/v0.1.0`；基线提交 `0af74e3cacc27719bb5fc4e6ba56970f9befb857`；产出提交主题 `feat(document): add markdown pipeline, transforms and react mapping`）
- **Components**: C-11 文档解析/渲染管线（①–⑩ Worker 可执行部分与 ⑪–⑫ 主线程部分）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 `src/document/**`、`package.json`、`pnpm-lock.yaml` 与本报告。按 handoff 要求合并 wp-17（T-27 管线核心）与 wp-18（T-28..T-30 变换/映射/Worker）；**不含** KaTeX/Shiki/Mermaid 引擎实现（wp-19），不含任何阅读器 UI 功能，未修改 `src-tauri/`、其它 `src/` 路径、框架文件或 pinned 输入。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（与 handoff 及 `swe_guard.py begin` 冻结一致，本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a28be026338af865bb6b9725785cdfcd08ce4ca2fd137bb9d70143919` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | ✓ |
| `artifacts/30-architecture/adr/ADR-002-single-parse-pipeline.md` | `a194db0d3299e4c1210c94f97ac25e71b8070a6eff6275f2448b293f651708a3` | ✓ |
| `artifacts/30-architecture/adr/ADR-007-search.md` | `b8e56f8d267cf864d8814782e14fd45e6dd349fc4f3740eebb14cd524e625db1` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |

基线提交 `0af74e3` 与 handoff 一致；进入时工作树干净；快照 `refs/swe/snapshots/20261006T224610Z-wp-17-pipeline-6e7cbece`（commit `c7ef4c94`）覆盖 `package.json`/`pnpm-lock.yaml` 修改前字节。契约核对：`TaskToken {docId, version, generation, taskId}`（contracts §1.6/§6）、`ErrorPayload` 形状（§3.7）、`PS_WORKER_FAILED`/`PS_PARSE_DOC`/`PS_PARSE_LOCAL`/`PS_TASK_CANCELLED` 码与 `messageKey`（§5）；`data-src-*` 为 UTF-8 字节、内部 UTF-16（§1.2；rendering-pipeline §3）。

## 2. 交付物（新增/修改文件）

| 路径 | 内容 |
|---|---|
| `src/document/types.ts` | 管线共享类型：`SourceRangeUtf16`/`SourceRangeBytes`、`DocumentDiagnostic`、`OutlineEntry`、`BlockRecord`（含 `sourceRange` UTF-16 与 `sourceRangeBytes` 双表示）、`SearchSegment`、`PipelineStats`、`ParseDocumentOptions`、结构化克隆产物 `ParseDocumentResult {status, hast, outline, blocks, segments, diagnostics, stats}`。 |
| `src/document/source-map.ts` | UTF-16↔UTF-8 偏移助手：`utf8ByteLength`/`utf8Encode`（孤立代理项按 U+FFFD，与 `TextEncoder` 一致）、双向索引换算（代理对/中点/越界钳制）、`utf16RangeToUtf8Bytes`/`utf8RangeToUtf16`、`positionToUtf16Range`、`nodeSourceRangeBytes`（mdast/hast 节点→源范围）。 |
| `src/document/hash.ts` | 无依赖同步 SHA-256（FIPS 180-4）与 `fingerprintBlockText` = `"fp1:" + sha256hex16`（rendering-pipeline §2.4b；data-model §3.3）。 |
| `src/document/sanitize.ts` | security-model §5.2 精确 schema：允许标签 32 个；`strip` 19 个原始标签（含 script/style/iframe/svg 原始/math 原始）；全局属性无；逐元素 `a/img/h1–h6/code/li/input/details/td/th/section` 规则与协议白名单（href http/https/mailto、src http/https）；`clobberPrefix: ''`；`required.input`；`rehypeForceTaskCheckboxDisabled()` 后置补丁。 |
| `src/document/engines.ts` | 引擎插槽注册表：`ENGINE_SLOT_ORDER = ['math','code','mermaid']`、`registerEngine`（返回注销器）、`listEngines`、`clearEngines`、`EngineContext {options, text, addDiagnostic, toSourceRangeBytes}`。当前注册表为空。 |
| `src/document/plugins/register.ts` | wp-19 注册接缝（无副作用占位）；`pipeline.ts` 以副作用 import，worker 与主线程回退共享同一注册表实例。 |
| `src/document/transforms/html-text.ts` | 允许子集原始 HTML 可见文本提取（去标签/注释；script/style/iframe 等隐藏内容跳过；索引用途，非安全边界）。 |
| `src/document/transforms/outline.ts` | 变换 a：标题纯文本提取（emphasis/inlineCode/image alt/raw HTML）、slug 归一（ASCII、小写、空白/标点→`-`、≤100 字符、CJK-only 标题用 8 位 SHA-256 回退保持确定性）、文档序 `-1/-2` 去重、`ps-h-*` 锚点。 |
| `src/document/transforms/segments.ts` | 变换 c：mdast 上的扁平 `SearchSegment` 草案（text/code/inline-code/image-alt/math/html-text），覆盖正文、代码、行内代码、图片 alt、未来公式源、允许子集 HTML 可见文本；排除属性、链接目标、GFM 生成脚注标签；CRLF 原样保留。 |
| `src/document/transforms/blocks.ts` | 变换 a→b→c 编排：标题锚点经 `hProperties.id` 注入 mdast；顶层语义块注册（`b1..bn`、kind、`headingPath`、UTF-16+UTF-8 范围、`fp1:` 指纹、`segIds`）；`blockSearchText`（拼接 + 仅 LF 归一）；`segmentHeadingPath`（分段的语义路径入口）。 |
| `src/document/transforms/index.ts` | 变换模块导出面。 |
| `src/document/pipeline.ts` | 单遍管线：①`remark-parse` → ②`remark-gfm`（仅 technical）→ ④ a→b→c 变换 → ⑤`remark-rehype`（`allowDangerousHtml:true`、`clobberPrefix:'ps-'`）→ ⑥`rehype-raw` → ⑦`rehype-sanitize`（精确 schema）→ checkbox 补丁 → ⑧⑨⑩ 引擎插槽（严格顺序，逐槽 try/catch 隔离）→ 产物。文档级防御性失败返回 `PS_PARSE_DOC` + `hast:null`。 |
| `src/document/annotate.ts` | ⑫（纯函数半）：按块源范围把顶层 hast 重组为 `<section data-block-id data-src-start data-src-end>`（UTF-8 字节）；文本节点按“精确位置 → 包含位置 → 同块文本回退”包裹 `<span data-seg-id>`；`code`/`img` 元素直接携带 segId；代码内部文本不包裹（复制保真）；无位置生成节点（脚注 section）不包裹且不改动。 |
| `src/document/BlockErrorBoundary.tsx` | 块级 React 错误边界：回退渲染源码片段 + 经注入 `translate` 解析的诊断标签（错误携带 `messageKey` 时优先，否则 `error.parse.local`），不白屏；默认无自然语言字面量。 |
| `src/document/map.tsx` | ⑪–⑫：`renderDocument({hast, blocks, segments}, {components, translate, sourceExcerptFor, onBlockError})` 经 `rehype-react`（`passNode`）映射；`section` 包装块 + 错误边界；`input` 强制 checkbox/disabled/readOnly；`planMountShards` 与 `useProgressiveMount`（首屏分片→空闲追加，generation 变化立即失效）。 |
| `src/document/worker/protocol.ts` | Worker 任务协议：`ParseTaskRequest {type, taskId, generation, docId, text, options}`、`CancelTaskRequest`、`ParsedTaskResponse`/`FailedTaskResponse`；`runPipelineTask`（产物结构化克隆、异常→`PS_INTERNAL` 信封）；`createWorkerHandler`（最新任务胜出、取消/废弃结果返回 `null`）；`installParseWorker(scope)`。 |
| `src/document/worker/parse.worker.ts` | 专用 Worker 入口：`installParseWorker(self)`；①–⑩ 在 Worker 内执行。 |
| `src/document/worker/client.ts` | 主线程客户端与回退：`createPipelineWorkerClient`（taskId 匹配、失败信封拒绝、cancel 以 `TaskAbortedError` 拒绝、dispose 终止）；`parseDocumentWithFallback`（Worker 不可用/崩溃 → 同管线本地执行 + `PS_WORKER_FAILED` 诊断；取消不静默回退）；共享惰性客户端与 `resetPipelineWorkerClient`。 |
| 测试（9 个文件，94 项） | 见 §3/§4。 |
| `package.json` / `pnpm-lock.yaml` | 新增 8 个运行时依赖与 3 个类型依赖（§5 D-9）。 |
| `artifacts/60-implementation/wp-17-pipeline.md` | 本报告。 |

## 3. 任务→测试映射（T-27..T-30，handoff 合并范围）

| 交付项 | 实现 | 测试（文件::覆盖） |
|---|---|---|
| T-27 管线核心 ①–⑦（remark-parse/gfm/rehype/raw/sanitize 精确 schema + checkbox 补丁） | `pipeline.ts`、`sanitize.ts` | `pipeline.test.ts`（16）：mode 默认/组合；对抗样例中 script 文本不出现、`onerror`/`onclick`/`style` 剥离、iframe/style/svg 原始剥离、`javascript:` href 剥离、http(s) 链接保留、details/summary(`open`) 保留、任务复选框 `disabled=true`、标题锚点存活；JSON 序列化/`structuredClone` 克隆性；`PS_PARSE_DOC` 防御路径；链接目标与 title 不进索引 |
| 管线顺序（消毒先于引擎注入） | `pipeline.ts` 引擎循环 | `pipeline.test.ts`：探测引擎按 `math→code→mermaid` 顺序调用；每个槽收到的树已无 script/style/事件属性；探测引擎注入的受信 `style`/`className` 不被二次消毒；抛错引擎仅产生 `PS_PARSE_LOCAL`（不含文档文本）且不阻塞后续槽 |
| T-28a 大纲与唯一锚点 | `transforms/outline.ts`、`transforms/blocks.ts` | `outline.test.ts`（9）：层级/顺序/源范围；重复英文标题 `-1/-2`；重复中文标题唯一且匹配 `^ps-h-[a-z0-9-]{1,128}$`；CJK-only 哈希回退确定性；长标题截断；emphasis/inlineCode/image/html 纯文本；重复解析确定性 |
| T-28b 块注册表与 `fp1:` 指纹 | `transforms/blocks.ts`、`hash.ts` | `blocks.test.ts`（11）：`b1..bn` 源序与 12 类 kind（含 mermaid/details/image/footnote/hr）；标题路径（标题块含自身）；definition 跳过；segIds；指纹稳定/追加不变/行内标记不敏感/CRLF=LF/`fp1:` 格式；CJK 源码字节范围切片；`segmentHeadingPath`。`hash.test.ts`（7）：固定 FIPS 向量、node:crypto 交叉验证（中文/emoji/组合字符/CRLF/孤立代理项/多块长度）、指纹格式与确定性 |
| T-28c 搜索分段与源映射 | `transforms/segments.ts`、`source-map.ts` | `segments.test.ts`（8）：CJK/emoji 文本切片相等；CRLF 原样；code（去围栏）/inline-code；image alt 且排除链接目标/title；HTML 可见文本（script 内容排除）；GFM 脚注标签排除、脚注正文包含；math 未来节点；空文本跳过。`source-map.test.ts`（14）：UTF-8 长度/编码（对照 `TextEncoder`）、UTF-16↔UTF-8 全边界往返（CJK/emoji/组合字符/CRLF/混合）、代理对/越界钳制、范围互转、节点→字节范围 |
| T-29 Worker 边界（协议、取消/废弃、回退同构） | `worker/protocol.ts`、`worker/parse.worker.ts`、`worker/client.ts` | `worker/protocol.test.ts`（14）：任务产物结构化克隆；取消后返回 `null`；新任务废弃旧任务；`installParseWorker` 只回传当前结果；回退与 Worker 产物 tree/outline/blocks/segments 深度相等且追加 `PS_WORKER_FAILED`；客户端拒绝/失败信封触发回退；成功时原样透传；取消重抛不静默回退；主线程回退与 `parseDocument` 同构；无 Worker 环境明确报错；FakeWorker 端到端（resolve/cancel/terminate/failed 信封/`parseDocumentWithFallback` 走 Worker） |
| T-30 rehype-react 映射与块包装 | `map.tsx`、`annotate.ts`、`BlockErrorBoundary.tsx` | `map.test.tsx`（9）：`section[data-block-id]` 与 UTF-8 `data-src-*`；`data-seg-id` 标注；代码字面文本可复制（含尾换行）；details/summary 与任务复选框；`hast:null` 返回 null；块渲染抛错→错误边界回退（源码片段+`T:error.parse.local`+`data-block-id`）且其它块正常；分片边界；渐进挂载全量与 generation 重置。`annotate.test.ts`（6）：块包装字节属性、文本/代码/图片 segId、硬换行丢失位置的回退匹配、脚注 section 不包装、不改动输入树 |

## 4. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm typecheck` | PASS（`tsc --noEmit`，0 错误） |
| 2 | `pnpm lint` | PASS（`eslint .`，0 error / 0 warning） |
| 3 | `pnpm test -- --run` | PASS：**22 个测试文件，164/164 通过**（其中 `src/document/**` 9 文件 94 项） |
| 4 | `pnpm build` | PASS（`tsc && vite build`；dist JS 241.28 kB / gzip 76.94 kB，CSS 3.69 kB） |
| 5 | `pnpm exec prettier --check "src/document/**/*.{ts,tsx}"` | PASS（全部符合仓库格式） |

`src/document` 测试分布：

| 测试文件 | 数量 | 状态 |
|---|---|---|
| `src/document/hash.test.ts` | 7 | PASS |
| `src/document/source-map.test.ts` | 14 | PASS |
| `src/document/pipeline.test.ts` | 16 | PASS |
| `src/document/annotate.test.ts` | 6 | PASS |
| `src/document/map.test.tsx` | 9 | PASS |
| `src/document/transforms/outline.test.ts` | 9 | PASS |
| `src/document/transforms/blocks.test.ts` | 11 | PASS |
| `src/document/transforms/segments.test.ts` | 8 | PASS |
| `src/document/worker/protocol.test.ts` | 14 | PASS |
| 合计 | **94** | 全绿 |

依赖新增（`package.json` 范围 / 实测锁定版本）：

| 依赖 | 范围 | 锁定版本 | 用途 |
|---|---|---|---|
| `unified` | `^11.0.5` | 11.0.5 | 处理器 |
| `remark-parse` | `^11.0.0` | 11.0.0 | ① CommonMark mdast |
| `remark-gfm` | `^4.0.1` | 4.0.1 | ② GFM 子集（technical） |
| `remark-rehype` | `^11.1.2` | 11.1.2 | ⑤ mdast→hast（`allowDangerousHtml`、`clobberPrefix:'ps-'`） |
| `rehype-raw` | `^7.0.0` | 7.0.0 | ⑥ 原始 HTML→hast（未消毒） |
| `rehype-sanitize` | `^6.0.0` | 6.0.0 | ⑦ 白名单消毒 |
| `rehype-react` | `^8.0.0` | 8.0.0 | ⑪ hast→React |
| `unist-util-visit` | `^5.1.0` | 5.1.0 | 树遍历 |
| `@types/hast`（dev） | `^3.0.5` | 3.0.5 | hast 类型 |
| `@types/mdast`（dev） | `^4.0.4` | 4.0.4 | mdast 类型 |
| `@types/unist`（dev） | `^3.0.3` | 3.0.3 | `Position` 类型（见 D-9） |

未新增：katex/rehype-katex/shiki/mermaid/remark-math 及其它任何依赖；未新增 fixture 目录（全部样例为测试内联字符串）。

## 5. 决策、偏差与已知限制（如实报告）

- **D-1 合并交付**：handoff 明确将 wp-17（T-27）与 wp-18（T-28..T-30）合并到本任务、引擎留到 wp-19；`src/document/**` 一次成型，避免半成品状态。计划书 §4.2 的 wp-17/wp-18 边界不构成两个提交。
- **D-2 引擎空槽与 wp-19 接缝**：`engines.ts` 提供定序注册表；`plugins/register.ts` 为 wp-19 的唯一注册文件，由 `pipeline.ts` 副作用 import，Worker 与主线程回退共用同一实例。当前 `listEngines()` 为空；顺序规则（math→code→mermaid）与“消毒后注入”由测试锁定。
- **D-3 未引入 `remark-math`（③）**：handoff 明确“引擎-free 部分”，且依赖清单不含 remark-math/rehype-katex。管线选项已冻结 `inlineMath`（technical 默认 true）并传入 `EngineContext.options`，供 wp-19 在 ③ 与 ⑧ 补齐。**集成风险**：security-model §5.2 当前 schema 未允许 math 标记（`div.math`/`span.math` 类不在允许列表；`div` 不在允许标签），而 pipeline §2.8 要求对 `.math` 元素做逐节点 KaTeX；wp-19 必须作为 Change Impact 明确该缺口（扩展 schema 或在消毒前以受控标记传递），本任务按“EXACT schema”要求未预放开。该风险已在此显式记录，不作为隐藏偏差。
- **D-4 锚点 ASCII 化**：security-model §5.2 的标题 id 正则 `^ps-h-[a-z0-9-]{1,128}$` 不接受 CJK；对纯中文标题采用 8 位 SHA-256 稳定回退（`ps-h-h-<8hex>`），重复标题仍按文档序 `-1/-2` 去重。无 ASCII 内容的标题不会产生不稳定顺序锚点；有测试。
- **D-5 标题 id 注入点**：在 mdast 阶段经 `hProperties.id` 注入（remark-rehype 复制），满足“id 由变换产生、经消毒白名单存活、与 sanitize 解耦”；原始 HTML 中的 `<h*>` 不参与大纲，不获得生成 id（其自带 `ps-h-*` 形态 id 由 schema 允许，属文档作者输入，记录在案）。
- **D-6 脚注 id 前缀**：`remark-rehype` 设 `clobberPrefix:'ps-'`，使 GFM 脚注 `li id`/`a href` 片段为 `ps-fn…`/`ps-fnref…`，与 security-model §5.2 正则一致；`a` 的脚注辅助属性（`dataFootnoteRef`/`ariaLabel`/backref 类）按“a 仅 href/title”剥离，链接功能不受影响（有测试）。
- **D-7 `BlockRecord` 双范围字段**：规范类型给 `sourceRange {startUtf16,endUtf16}`，§3 又要求 `data-src-*` 与锚点为 UTF-8 字节；实现同时携带 `sourceRangeBytes`（解析时用原文转换一次），避免下游为字节换算重复传全文。属对规范类型的兼容性扩展，非语义替换。
- **D-8 搜索分段“path”**：规范 `SearchSegment` 字段为 `{segId, blockId, kind, text, startUtf16, endUtf16}`；handoff 提到的 `path` 通过 `segmentHeadingPath(segment, blocks)` 从块取得（避免逐段复制 headingPath），语义路径与块注册表/锚点同源（有测试）。
- **D-9 类型依赖**：handoff 允许“types if needed”。pnpm 严格解析下 `hast`/`mdast`/`unist` 的类型包必须直接声明；除 `@types/hast`、`@types/mdast` 外增加 `@types/unist@3.0.3`（`Position` 为两个类型包的公共依赖，未直接声明时 `tsc` 无法解析）。均为 devDependencies，不影响运行时。
- **D-10 原始 HTML 文本近似**：`html-text` 分段的位置按 §3 item 3 使用外层 raw 节点范围（近似）；可见文本提取为标签感知的受控启发式（跳过 script/style/iframe/svg/表单等隐藏内容，实体不解码），注释被丢弃。仅影响搜索索引可见文本，非安全边界（安全由 ⑦ 消毒保证，有对抗测试）。
- **D-11 硬换行位置回退**：mdast→hast 转换会丢失硬换行后文本节点的 position（如 `alpha\`+换行+`beta`），`annotate.ts` 增加“同块未使用分段文本精确匹配”回退，保证这些节点仍获得 `data-seg-id`；其余无位置生成节点（GFM 脚注 section）不包装（有测试）。
- **D-12 渐进挂载**：`useProgressiveMount` 以 `requestIdleCallback` 追加分片、`setTimeout(0)` 兜底（jsdom 环境），generation 变化时在渲染推导层立即失效旧进度（避免 effect 内同步 setState）；该 hook 为后续阅读器装配件，本任务只交付基础设施并有单测。
- **D-13 Worker 客户端行为**：`failed` 信封（仅未预期异常时产生）使调用方回退本地解析；取消（`TaskAbortedError`）向上抛出、绝不静默本地重解析（避免取消语义被掩盖）。无超时机制（规范未要求；大文档终止/重建 Worker 属后续大文档任务）。
- **D-14 `inputs`/`security` 边界**：未执行任何 Tauri/DOM 访问于 `src/document/**`（`map.tsx` React、`worker/**` 为规范允许例外）；模块不 import `services`/`features`/`components`/`app`（architecture §7 规则），无 `dangerouslySetInnerHTML`。

## 6. 失败隔离策略（rendering-pipeline §4 落地）

| 失败点 | 实现 | 用户可见结果 |
|---|---|---|
| 单个引擎（⑧⑨⑩）抛错 | `pipeline.ts` 逐槽 `try/catch`；保留上一棵受信树 + `PS_PARSE_LOCAL` 诊断（`details.engine`，不携带错误文本/正文） | 其余块正常渲染 |
| 变换/解析阶段整体抛错（防御性） | `parseDocument` 文档级 `catch` → `{status:'failed', hast:null, diagnostics:[PS_PARSE_DOC]}` | 调用方回退源码视图 |
| Worker 初始化/运行失败 | `parseDocumentWithFallback` 本地同管线 + `PS_WORKER_FAILED` | 功能不降级，诊断可见 |
| 单块 React 渲染抛错 | 每个 `<section data-block-id>` 外 `BlockErrorBoundary`：源码片段 + 经 `translate` 的 `messageKey` 标签（默认 `error.parse.local`） | 仅该块回退，不白屏、不清空其它块 |

边界实现单测覆盖：引擎抛错隔离、Worker 回退诊断、块错误边界回退与其它块存活。

## 7. wp-19 引擎插槽接口（交付给下一任务）

```ts
// src/document/engines.ts（已实现）
registerEngine(
  slot: 'math' | 'code' | 'mermaid',
  engine: {
    name: string,
    transform(tree: Root, context: EngineContext): Root | Promise<Root> | void | Promise<void>,
  },
): () => void // 注销器（测试/卸载）

interface EngineContext {
  options: { mode: 'technical' | 'standard'; inlineMath: boolean }
  text: string
  addDiagnostic(input: {
    code: string
    category: DocumentDiagnostic['category']
    messageKey: string
    retryable: boolean
    sourceRange?: SourceRangeUtf16   // 内部 UTF-16；pipeline 转为字节写入诊断
    details?: Record<string, string | number | boolean>
  }): void
  toSourceRangeBytes(range: SourceRangeUtf16): SourceRangeBytes
}
```

- 注册位置：`src/document/plugins/register.ts`（当前为空模块）内 `registerEngine(...)`；`pipeline.ts` 已副作用 import，Worker 与主线程自动生效。
- 顺序契约：`math → code → mermaid`，全部在 `rehype-sanitize` 之后；引擎输出为受信节点，不会再次消毒、也不会从文档文本重新解析（有顺序测试锁定）。
- 输入约定：math 槽处理 `.math` 元素（`remark-math` 的 ③ 接入与 schema 权限见 D-3）；code 槽处理 `pre > code.language-*`（`className` 已在 schema 允许且大小写/字符集受限，字面文本保真）；mermaid 占位从 `code.language-mermaid` 识别（`BlockRecord.kind === 'mermaid'` 已就绪）。
- 诊断 sourceRange 传 UTF-16（与 mdast/hast position 同域），由 `EngineContext.addDiagnostic` 统一换算 UTF-8 字节；局部失败只影响本公式/本代码块/本图表。
- 大文档简化模式属后续任务；本任务产物（blocks/segments/源映射）在简化模式下保持同构，供其复用。

## 8. 追溯摘要

- **ADR-002 §1–§3**：单遍管线、`data-src-*`/`data-seg-id`、UTF-16↔UTF-8 转换、`fp1:` 指纹、①–⑩ Worker 结构化克隆产物、`PS_WORKER_FAILED` 回退；见 `pipeline.ts`、`annotate.ts`、`worker/**` 与对应测试。
- **rendering-pipeline §1/§2.4/§2.7/§2.11–§2.12/§3–§4/§6**：顺序与模式表、a→b→c、消毒 schema、块包装与渐进挂载、源映射契约、失败隔离表、Worker 边界；测试映射见 §3。
- **security-model §5.1/§5.2**：消毒先于引擎、精确白名单、`clobberPrefix:''`、协议白名单、复选框强制禁用；对抗样例见 `pipeline.test.ts`。D-3 记录的 math schema 缺口留给 wp-19 Change Impact。
- **ADR-007 / §2.4c**：字面分段搜索的覆盖/排除、无 Unicode 归一、CJK/emoji/CRLF 样例；`segments.test.ts`。
- **data-model §3.3 / rendering-pipeline §2.4b**：`blockSearchText` 仅 LF 归一、`fp1:` = sha256 前 16 hex；`blocks.test.ts`、`hash.test.ts`。
- **contracts §1.2/§1.6/§3.7/§5/§6**：偏移单位、TaskToken/代次废弃语义、诊断形状与稳定码；`worker/protocol.test.ts`、`pipeline.ts`、`client.ts`。

## 9. 校验说明

本报告为持久交付记录：所有命令在本修订（`task/wp-17-pipeline`，父基线 `0af74e3`）实测；未修改任何 pinned 输入、`src-tauri/`、其它 `src/` 路径、`vite.config.ts`、`index.html`、框架文件或 `src/locales/zh-CN.json`。工作树内变更仅为 `src/document/**`、`package.json`、`pnpm-lock.yaml` 与本报告；提交仅包含 handoff 声明的 `commit_paths`。
