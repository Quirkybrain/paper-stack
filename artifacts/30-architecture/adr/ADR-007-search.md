# ADR-007 搜索实现（Search Implementation）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `rendering-pipeline.md` §2.4c/§3/§5、`contracts.md` 命令 38、`architecture.md` §5.3

## Context

R17：首版**字面子串搜索、无正则**；默认正文范围，覆盖正文、代码、图片替代文本与公式源码，**不含界面标签与 HTML 属性**；源码范围搜索解码原文；输入法组合期间不提交；结果按文档顺序。R19/SRS §5.3：默认大小写不敏感，不做改变含义的 Unicode 归一；中文/emoji/组合字符/换行有样例；区分“无结果/索引未就绪/超预算不完整”。IX04/IXD §7：去抖计算但**不自动滚动**；折叠与未显示块仍可命中并先展开再定位；公式源命中标“公式源码匹配”；旧批次不得污染新查询。NF05：1MiB 首结果 P95 ≤200ms。R29/IX15：>50MiB 的源码窗口模式仍需“可查找和复制，说明已完成索引范围”。

## Options

- **A：搜索 DOM `textContent`**。实现快，但折叠/未挂载块、公式源文本、alt 会遗漏或重复；HTML 属性/界面文本会污染结果；违反 R17 范围；否决。
- **B：正文用解析树分段索引（前端）；源码用内存原文扫描（前端）**。与显示同源、范围可精确控制、结果可映射到块；1MiB 内 `indexOf` 远快于预算。
- **C：全部搜索下沉 Rust**。正文范围需要把解析分段序列化；跨语言维护两套范围语义；额外 IPC 成本；不采用（除非大文档）。
- **D：引入全文检索库（如 minisearch）**。分词/归一化语义与“字面子串、无归一化”冲突；否决。
- **E：>50MiB 源码窗口模式**：前端无全文，选择 Rust 流式扫描（复用同一“字面 + toLowerCase”语义），返回可定位偏移与行号，并显式报告扫描覆盖。

## Decision

采用 B + E：

1. **正文范围**（≤50MiB）：使用 ④c 生成的 `SearchSegment[]`（文本/代码/行内代码/alt/公式源/允许子集内的 HTML 文本）；排除属性（alt 除外）、界面标签、GFM 生成脚注标题；无 Unicode 归一，`caseSensitive=false` 时双方 `toLowerCase`。
2. **源码范围**（≤50MiB）：对 `DocumentModel.rawText` 直接扫描 + 行起始索引得行号；覆盖原始文本（包括被清理的 HTML 原文与公式分隔符，R17“源码范围搜索解码原文”）。
3. **>50MiB 源码窗口模式**：命令 38 `search_source` 在 Rust 流式扫描当前展示版本，返回 `{matches(startByte,endByte,lineNumber), scannedBytes, totalBytes, complete}`；语义与前端一致；版本在扫描前后校验，不一致 `PS_IO_CHANGED`；超预算 `complete=false` 并给 `PS_LIMIT_SEARCH`（R29；IX15“说明已完成索引范围”）。
4. 结果按文档顺序；命中映射到 `(blockId, segId, offset)`；点击命中先挂载/展开目标块再定位（折叠不改变索引与复制范围）。
5. 查询提交：IME 组合期间不提交（`compositionstart/end` 门控）；去抖初值 150ms；新旧批次以 generation 隔离，旧计数不得闪回；“索引未就绪/无结果/超预算不完整”三态独立文案。
6. 大小写选项、范围切换只改变查询执行，不写磁盘；查询仅内存（R20、SRS §6.1）。
7. 高亮经 `data-seg-id` 与分段偏移在文本节点内切片；公式源命中定位公式块并标“公式源码匹配”。

## Consequences

- 正面：与渲染同源的边界解释；折叠/未挂载内容不遗漏；无新依赖；语义单一定义（toLowerCase + 字面），测试样例可覆盖 CJK/emoji/组合字符。
- 代价：索引内存约为文本量级；两端实现（前端字面搜索与 Rust 流式扫描）需要一套共享的语义测试向量防止漂移（NF11）。
- 性能：1MiB 级扫描与 `indexOf` 在预算内（NF05 待实测）；大文档扫描在 Rust `spawn_blocking` 执行，可取消。
- 已知限制：不做拼音/分词/模糊/语义检索；不做跨目录全文搜索（F01 排除，DR-07）。

## Constraints

- 无正则、无改变含义的 Unicode 归一（SRS §5.3；R17）。
- 索引状态与结果完整性必须如实呈现，不把部分计数称完整（R17、IXD §7.2）。
- 搜索不得写源文件或磁盘记录（R20）。

## Affected Artifacts

- `rendering-pipeline.md` §2.4c/§3/§5（分段与映射规范）。
- `contracts.md` 命令 38 与流程矩阵“搜索”行。
- 下游：`features/search`、`document` 分段实现、Rust `search_source` 服务与共享语义测试向量。
