# ADR-002 单遍解析管线与源映射（Single Parse Pipeline and Source Mapping）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `rendering-pipeline.md` §1–§4/§6、`contracts.md` §1.2、`security-model.md` §5

## Context

计划书 §3.5 要求“一次基础解析，输出可复用的结构和源位置，供正文、大纲、复制与页内搜索使用”，并明确“不使用两个解析器分别处理显示和搜索”，以避免标题、公式或代码边界解释不一致。R08–R14、R17–R19 依赖标题锚点、块指纹、搜索范围与源位置；NF11 要求这些语义有固定样例、依赖升级不隐式改变承诺。前端还需要在不可信内容上完成消毒，并保证公式/高亮/图表这些**受信引擎输出**不被文档文本污染或反过来污染消毒边界。

## Options

- **A：显示与搜索各用一套解析**（如正文 remark、搜索正则/纯文本抽取）。实现快，但边界不一致会直接违反 §5.1 的固定样例与 R17 的范围承诺；否决。
- **B：单遍统一的 remark→rehype 管线 + 自定义 mdast/hast 变换，消毒后注入引擎输出**。解析树即大纲、块、索引、源映射的唯一来源；顺序即契约。
- **C：直接把 DOM 文本作为搜索与映射来源**。折叠/未挂载内容与公式源文本会丢失，且 HTML 属性会污染结果；否决。
- **D（B 的执行位置变体）**：管线在主线程 vs Web Worker。Worker 收益（首屏、取消）显著，选择 B+D。

## Decision

1. 采用 B+D：`rendering-pipeline.md` §1 的 ①–⑫ 顺序为规范；变换顺序 a→b→c 固定。
2. **消毒先于引擎注入**：⑦ rehype-sanitize 必须早于 ⑧ KaTeX、⑨ Shiki、⑩ Mermaid 占位与 Mermaid 渲染；引擎输出为受信节点，永不从文档文本重新解析，也永不因恢复效果放开 style/事件（R09）。
3. 源映射契约（`rendering-pipeline.md` §3）：顶层块 `data-block-id`/`data-src-*`；文本段 `data-seg-id`；IPC 边界统一 UTF-8 字节偏移，前端内部 UTF-16 offset，转换经 CJK/emoji/组合字符测试；禁止把字节偏移当用户字符位置（SRS §5.3）。
4. 块指纹 `fp1:<sha256hex16(blockSearchText)>` 与搜索文本同源、仅 LF 归一（data-model §3.3），用于跨版本锚点唯一匹配。
5. ①–⑩ 在专用 Web Worker 执行，产物结构化克隆到主线程；`src/document/**` 不 import Tauri/DOM，保证 vitest 与运行时同源；Worker 失败回退主线程并记 `PS_WORKER_FAILED`（仅大文档自动降级）。
6. Mermaid 渲染必须在主线程（依赖 DOM 测量），保持“占位→可见时按需渲染”；KaTeX/Shiki 可在 Worker 内完成。

## Consequences

- 管线顺序、消毒 schema、映射接口成为实现与审查的硬约束；任何调整需 Change Impact（升级 remark 生态属 NF11 风险点）。
- 搜索、大纲、锚点、复制共享同一棵树，边界解释一致；新格式（未来 F02/F04）通过适配器实现，不新增第二解析器。
- Worker 引入序列化成本与一份任务协议（taskId/generation），换取首屏与可取消性；主线程回退路径必须与 Worker 输出同构。
- 已知取舍：原始 HTML 内部文本的源位置为外层 raw 节点近似；跨公式宏共享不作为 v0.1.0 承诺（未知宏仅本公式报错）。

## Constraints

- 不同时引入 markdown-it/react-markdown、MathJax（计划书 §4.1；PC-02）。
- 原始 HTML 只允许明确安全子集（如 details/summary），事件/脚本/iframe/全局 CSS 禁止（R09）。
- 解析行为变更必须伴随固定样例更新与版本锁定记录（NF11）。

## Affected Artifacts

- `rendering-pipeline.md`（全部）、`contracts.md`（偏移单位、命令 5/7/8/38 的语义）。
- `security-model.md` §5（消毒与 `dangerouslySetInnerHTML` 禁令）。
- 下游：`src/document` 管线与 worker、搜索/锚点实现、fixtures、质量审查清单。
