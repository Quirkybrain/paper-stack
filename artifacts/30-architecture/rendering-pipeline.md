# 纸栈 PaperStack · v0.1.0 渲染管线（Rendering Pipeline）

- **Producer**: agent:solution-architect
- **Artifact ID**: ART-30-RENDER
- **Artifact Type**: Detailed Design（单遍解析/渲染管线、源映射接口、失败隔离、大文档模式）
- **Status**: VALID
- **Revision**: 1
- **Owner**: solution-architect
- **Task**: `wp-03-architecture`（任务分支 `task/wp-03-architecture`；父分支 `feat/v0.1.0`；基线提交 `7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b`；产出提交主题 `docs(architecture): define v0.1.0 architecture and contracts`）
- **Last Verified**: 2026-10-07
- **Scope**: `src/document/**` 与 `src/features/reader|search` 的渲染/映射接口。UI 外观与视觉细节以 IXD 为权威，本文不重新设计。
- **Depends On**: `architecture.md`（§7）；`security-model.md`（§5）；`contracts.md`（§6–§7）；ART-20-RB（R08–R14、R17–R19、R22、R29）；SRS §5；计划书 §3.5、§4.1、§5.4。
- **Downstream**: `src/document` 实现（管线、变换、插件、索引）、`features/reader|search`、fixtures、vitest 单测、质量审查（消毒/管线顺序检查）。

---

## 1. 管线总览（唯一路径，顺序精确）

计划书 §3.5：一次基础解析，输出可复用结构与源位置；禁止两套解析器分别服务显示与搜索。

```text
rawText（当前展示版本，Rust 解码）
 → ① remark-parse                     CommonMark 基础语法树（mdast）
 → ② remark-gfm                       仅 technical 模式；表格/任务列表/删除线/自动链接/脚注
 → ③ remark-math                      $…$ 与 $$…$$；inline 开关按文档
 → ④ 自定义 mdast 变换（顺序固定）      a) outline+唯一锚点  b) 块注册表+指纹  c) 搜索分段+源映射
 → ⑤ remark-rehype                    allowDangerousHtml:true；脚注映射开启
 → ⑥ rehype-raw                       原始 HTML → hast 元素（仍未消毒）
 → ⑦ rehype-sanitize                  本应用白名单（security-model §5.2）
 → ⑧ 自定义公式插件（KaTeX，逐节点）    消毒后受信注入；错误→本公式占位+诊断
 → ⑨ 自定义代码插件（Shiki，按需）      消毒后受信注入；未知语言降级纯文本
 → ⑩ 自定义 Mermaid 占位插件            仅生成占位节点（源码携带）；渲染在可见时进行
 → ⑪ rehype-react                     hast → React 树（组件映射见 §2.10）
 → ⑫ 块包装与渐进挂载                   data-block-id / data-src-* / data-seg-id
```

**顺序规则（强制）**：⑦ 必须早于 ⑧⑨⑩——引擎输出永不再次经过文档消毒，也永不从文档文本重新解析；任何“为恢复公式/高亮而放开 style/事件”的做法禁止（R09；security-model §5.1）。③ 必须晚于 ①②（数学节点不在代码上下文产生）；⑤ 必须晚于 ④（变换基于 mdast）。

**模式选项（冻结的 v0.1.0 组合）**：

| 选项 | technical（默认） | standard |
|---|---|---|
| remark-gfm | 启用 | 关闭（仅 CommonMark） |
| remark-math + KaTeX | 启用；文档级可关 **行内**（`singleDollarTextMath:false`），`$$` 块公式保留 | 关闭；`$…$` 按原文显示 |
| Mermaid | 启用 | 关闭（原样代码块） |
| 脚注 | 启用（GFM） | 关闭（原样文本） |
| Front matter | 仅作元数据展示；**不得**修改任何设置（R08） | 同左 |

## 2. 各阶段规格

### 2.1 remark-parse
- 固定为 CommonMark 兼容解析；不做预归一化（原文换行保留）；输入为当前展示版本 `text`。
- 解析失败（防御性）→ 文档级诊断 `PS_PARSE_DOC` + 源码视图回退。

### 2.2 remark-gfm
- 表格、任务列表、删除线、自动链接、脚注（选定子集，R08）；GitHub 提示块未单独实现时按普通引用呈现。

### 2.3 remark-math（数学规则，R10 + SRS §5.1）

| 情形 | 规范行为 |
|---|---|
| 行内 `$x^2$` / 块 `$$…$$` | technical 且行内开关开 → 数学节点；否则原文显示 |
| 代码上下文中的 `$`（行内代码、围栏代码、缩进代码） | 永不产生数学节点（tokenizer 层面保证；回归样例覆盖） |
| 转义 `\$20` | 原文显示金额，不开始公式 |
| 未闭合 `$` | 保留可读原文，不吞并后文（固定样例） |
| 金额歧义（两个裸 `$`） | 不自动猜测；文档级“关闭行内数学”原样阅读（`singleDollarTextMath:false`；`$$` 块公式不受影响） |
| 未知宏/超限 | 仅影响本公式（§2.8 隔离），源码可查看/复制 |

### 2.4 自定义 mdast 变换（顺序 a→b→c，全部纯函数）

**a. 大纲与唯一锚点（R14）**：遍历标题 → `{level, text, anchorId, sourceRange}`；文本 slug 归一（小写、空白→`-`、去除标点）；重复标题依次加 `-1`、`-2`（文档序）；`anchorId = "ps-h-" + slug` 经消毒 `id` 白名单存活（security-model §5.2）。大纲点击先记录来源再跳转（历史合并见契约 §6 与 IXD §6）。

**b. 块注册表与指纹（R19）**：对每个顶层语义块（段落、标题、列表、引用、代码块、公式块、表格、图表、图片块、details 块）分配稳定 `blockId = "b" + 序号`，记录：
```ts
BlockRecord { blockId, kind, headingPath: string[], sourceRange: {startUtf16,endUtf16},
              fingerprint: "fp1:"+sha256hex16(blockSearchText), segIds: string[] }
```
`blockSearchText` = 块内搜索分段按文档顺序拼接，仅 LF 归一（与 data-model §3.3 同源）。指纹用于跨版本锚点匹配：唯一且与 `headingPath` 一致 → 可宣称精确。

**c. 搜索分段与源映射（R17）**：收集 `SearchSegment {segId, blockId, kind: text|code|inline-code|image-alt|math|html-text, text, startUtf16, endUtf16}`；规则：
- 覆盖：可读文本、代码（含折叠内容）、图片 `alt`、公式源字符串、允许子集内 HTML 的可见文本；
- 排除：HTML 属性（alt 除外）、界面标签、GFM 生成的脚注标题标签（`Footnotes`）、行号与按钮；
- 无 Unicode 内容归一（SRS §5.3）；CJK/emoji/组合字符/CRLF 有样例（NF11）；
- 索引在消毒后构建的等价集合：本步骤在 mdast 上建“准索引”，⑫ 挂载后以 `data-seg-id` 对齐文本节点；两者由同一 `segId` 关联。

### 2.5 remark-rehype
- `allowDangerousHtml: true`（原始 HTML 必须以节点形式进入 ⑥ 再统一消毒）；脚注选项开启；标题 id 沿用变换 a 的 `ps-h-*`。

### 2.6 rehype-raw
- 解析原始 HTML 字符串为 hast 元素；此阶段输出**不可信**，严禁提前注入 DOM。

### 2.7 rehype-sanitize
- 使用 security-model §5.2 的精确 schema（允许标签/属性/协议/正则、`clobberPrefix=""`）；消毒后不得存在事件属性、`style`、脚本、iframe、未知协议。
- 后置补丁：将任务列表 `input[type=checkbox]` 强制 `disabled=true`（R04）。

### 2.8 自定义公式插件（KaTeX，逐节点，R10）
- 对每个 `.math` 元素单独 `katex.renderToString(value, {trust:false, strict:"warn", maxSize, maxExpand, macros})`，成功 → 受信节点；失败 → `.math-error` 占位节点（公式源 + `PS_PARSE_LOCAL` 诊断 + sourceRange）。
- 宏上下文：每个文档渲染新建一次；跨文档不共享；同一文档内跨公式共享不作为 v0.1.0 承诺（未知宏仅本公式报错）。宽公式块级横向滚动由样式与容器保证（IXD §9）。

### 2.9 自定义代码插件（Shiki 按需，R11）
- 输入：`pre > code.language-*` 的字面文本；输出：受信高亮节点 + 行号（行号不参与复制）。
- 语言：首批验证 C/C++/Python/Rust/Java/JS/TS/Bash/JSON/YAML/SQL/纯文本；未知语言降级纯文本，不报失败。
- Shiki 经动态 `import()` 按需加载（首次出现代码时）；加载中先渲染纯文本占位，完成后替换（不阻塞首屏）。
- 复制载荷在 React 层由**字面文本**构造（去除围栏/行号/按钮），仅做逻辑换行 LF 归一（`\r\n|\r→\n`），保留缩进与尾换行；折叠（初始阈值 40 行、显示前 20 行，可调）只改变显示，不改变索引与复制范围。

### 2.10 Mermaid 占位与按需渲染（R12）
- 阶段 ⑩ 仅把 `code.language-mermaid` 替换为占位节点，携带源码与 sourceRange；**不在解析管线内渲染**。
- React `MermaidBlock` 在可见（IntersectionObserver）且模块按需加载后调用 `mermaid.render`：`securityLevel:'strict'`、`htmlLabels:false`、固定安全配置；节点数/超时帽（初始可调）→ 超限或错误 → 局部诊断（图种、引擎版本、错误摘要、源范围）+ 源码入口；不自动重试。
- 支持范围：流程图、时序图、类图；不支持图种给出兼容范围说明（IX07）。

### 2.11 rehype-react 组件映射
- `a` → 链接路由组件（页内 fragment / 相对文档 / http(s) / 不支持类型说明；`onClick` 只调用服务层；Ctrl+点击/中键经 UI 决策，R15）；
- `img` → 图片组件（经 `check_resource_access`/`fetch_remote_image` 决定占位/加载/阻止；尺寸帽；放大层入口，R13）；
- `input` → 只读复选框（强制禁用，R04）；
- `pre/code` → 代码块组件（复制/换行/折叠/检查，R11）；
- `table` → 横向滚动容器；`details/summary` → 原生受控子集；
- 每个顶层块外包 `<section data-block-id data-src-start data-src-end>`。

### 2.12 渐进挂载与取消
- 按块分片挂载：首屏优先 → 空闲追加；同一文档的挂载任务携带 `TaskToken`（契约 §6），代次不匹配立即停止（关闭/更新时不挂幽灵节点）。
- 搜索索引先于 DOM 完成；命中未挂载块时先挂载目标分片再定位（R17）。

## 3. 源映射接口（规范）

```text
SOURCE MAP CONTRACT:
1. 每个顶层块暴露 data-block-id / data-src-start / data-src-end（UTF-8 字节，半开），
   与 BlockRecord.sourceRange 一致（UTF-16↔UTF-8 转换经测试助手）。
2. 每个可搜索文本节点暴露 data-seg-id；SearchSegment 携带 (segId → blockId, startUtf16, endUtf16)。
3. “节点位置 → 源范围”：mdast/hast 的 position 提供行/列与 UTF-16 offset；保留到消毒后；
   原始 HTML 内部文本使用其外层 raw 节点的位置（标注为近似）。禁止把字节偏移当字符位置（SRS §5.3）。
4. 搜索命中 → blockId + segment 偏移 → 高亮（<mark>）与滚动定位；
5. 阅读位置 → blockId + offsetRatio + sourceRange → 保存锚点（data-model §3.3）；
6. 源码视图 → blockId 的 sourceRange.startByte → 二分行索引得起始行；反向按行区间取块；无可靠映射时
   提示“未能精确定位，已返回最近位置”（R18）。
7. 诊断 sourceRange 一律字节偏移（contracts.md §1.2），UI 展示换算后的行号（1 起始）。
```

## 4. 失败隔离（本地诊断，无白屏）

| 失败点 | 行为 |
|---|---|
| 单公式（未知宏/引擎限制） | 本公式占位 + 源码 + `PS_PARSE_LOCAL`（R10） |
| 单代码块（高亮器加载失败） | 降级纯文本 + 诊断；复制仍完整（R11） |
| 单图表（语法/图种/超时/节点超限） | 局部错误 + 源码 + 说明（R12） |
| 单图片（缺失/越界/未允许/超限/解码） | 块内占位 + 资源入口（R13、R26） |
| 单原始 HTML 节点（不允许/解析失败） | 文本化或剥离 + 可读回退（R08、R09） |
| 变换/插件抛错（防御性） | 捕获于逐节点包裹；块级错误边界；整篇失败回退源码视图 + `PS_PARSE_DOC` |

React 层为每块设错误边界；文档级错误不影响其他标签（IXD §11.3）。

## 5. 大文档模式（R29）

| 条件 | 行为 |
|---|---|
| ≤10MiB 且复杂度预算内 | 完整管线（§1） |
| >10MiB 或复杂度超预算（节点/块数初始阈值，可校准） | 打开前提示：**简化阅读 / 只读源码 / 取消**；简化阅读保留：完整文本、基础结构（标题/段落/列表/代码/表格纯文本）、**全文搜索、复制、源码视图**；关闭：KaTeX、Shiki、Mermaid、图片解码（占位 + alt）、重排版 |
| >50MiB | 不做全量渲染（也不经 IPC 传全文）：只读源码窗口模式（`get_source_info`/`read_source_window`/`search_source`），行号 + 选择复制 + 查找，并显式说明“已显示/已扫描范围”（IX15） |

- 简化模式仍是同一管线的子集（相同 blockId/源映射/搜索分段），保证“不静默遗漏搜索与复制内容”（IXD §11.2；计划书 §5.7）。
- 取消让在途任务失效，不产生幽灵标签（R05、IT04）。

## 6. Worker 边界与回退（ADR-002）

- ①–⑩ 在专用 Web Worker（`src/document/worker/parse.worker.ts`）内执行：纯函数、可单测；产物为可结构化克隆的 `{hast, outline, blocks, segments, diagnostics, stats}`；⑪–⑫（React 映射、Mermaid 渲染、图片解析、渐进挂载）在主线程。
- 任务协议：`{taskId, generation, docId, text, options}` → 结果带同一 `taskId`；取消/新任务只废弃旧结果；不要求中断运算本身（超大文档必要时终止并重建 Worker）。
- Worker 不可用（初始化失败/环境限制）→ 回退主线程同管线 + `PS_WORKER_FAILED` 诊断；大文档自动仅建议简化/源码模式。
- `document/**` 不得 import Tauri 或 DOM（§架构规则），保证 vitest 直接测试同一代码。

## 7. 固定样例与测试接缝（NF11）

| 类别 | 样例 |
|---|---|
| 数学 | 行内/块、代码内 `$`、转义、未闭合、金额歧义、未知宏、宽公式 |
| 代码 | 12 种语言、未知语言、CRLF 复制归一、40 行折叠与复制完整 |
| 图表 | 流程图/时序/类图、语法错误、不支持图种、超时/节点超限 |
| HTML/安全 | 脚本/事件/style/iframe/javascript:、details/summary、任务列表勾改尝试 |
| 链接/锚点 | 重复标题、页内 fragment、相对文档、外部、缺失 fragment |
| 搜索 | 折叠命中、公式源命中、alt 命中、大小写、CJK/emoji/组合字符、零结果 |
| 大文档 | 10MiB±、50MiB±（见 §5） |
| 源映射 | 每个块 data-src-* 与原文切片断言（含 CJK 多字节） |

## 8. 追溯

| 条款 | 本文承接 |
|---|---|
| R08/R09 | §1–§2.7（单管线、消毒顺序、原始 HTML 子集） |
| R10 | §2.3、§2.8（数学规则与逐节点隔离、文档级开关） |
| R11 | §2.9（完整复制、LF 归一、折叠不影响索引） |
| R12 | §2.10（strict、按需、超限/错误局部化） |
| R13 | §2.11 图片组件；security-model §3 |
| R14/R15 | §2.4a、§2.11（唯一锚点、链接路由） |
| R17 | §2.4c、§3（索引范围与命中定位） |
| R18/R19 | §3（同版本源映射与锚点接口） |
| R22 | §2.12（代次挂载）、contracts.md §6 |
| R29 | §5（阈值与模式）、§6（回退） |
| NF11 | §7 固定样例 |
