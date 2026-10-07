# 纸栈 PaperStack · wp-45 缺陷修复实现证据（D-IT-1 / D-IT-2 / D-IT-3）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP-45-FIX-IT
- **Artifact Type**: Implementation Evidence（承接 `acceptance-it.md` §5 的缺陷路由；逐缺陷给出根因、修复层、回归测试与前后测量；如实列出残余限制）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-45-fix-it`（任务分支 `task/wp-45-fix-it`；父分支 `feat/v0.1.0`；基线提交 `ade12444bc841dd0be63040ad3a8a6b87c2f39b3`；产出提交主题 `fix(reader): resolve it acceptance defects`）
- **Last Verified**: 2026-10-08
- **Scope**: `src/`、`src-tauri/src/`、`src-tauri/tests/`、`artifacts/60-implementation/`。未改 pinned 输入、`tests/desktop/**`、`fixtures/`、锁文件、配置。
- **Pinned inputs（已按 handoff 哈希核验，2026-10-08）**：
  - `artifacts/70-verification/acceptance-it.md` `7787e69e…`
  - `artifacts/30-architecture/rendering-pipeline.md` `6fe1f74a…`
  - `artifacts/30-architecture/contracts.md` `f4b15984…`
  - `artifacts/35-models/session-and-version-models.md` `65c36022…`
  - `artifacts/50-plan/implementation-plan.md` `ce6d7bc7…`

---

## 1. 缺陷 → 根因 → 修复 → 回归测试

### 1.1 D-IT-1（R15，非 ASCII 文件名文档链接）— 已修复

| 项 | 内容 |
|---|---|
| 现象 | 点击 `[中文名文档](./中文文档.md)` → `找不到文件或资源。(PS_IO_NOT_FOUND)`（IT02，`it02-n-cjk-link-attempt.png`） |
| 根因 | `remark-parse→remark-rehype` 将链接 destination 规范为百分号编码（`./%E4%B8%AD%E6%96%87%E6%96%87%E6%A1%A3.md`），而 `ReaderScreen.resolveDocumentLink` 只对 fragment 解码、路径段原样传给 `open_documents`，Rust 按字面编码名查找失败。 |
| 修复层 | 前端（`src/features/reader/ReaderScreen.tsx`）：路径**按 `/` 分段**逐段 `decodeURIComponent` 后再做 `./`/`../` 解析；fragment 保持原有单次解码。畸形转义与已解码路径原样保留；解码后含 `/` 的段保持字面（编码 `/` 永不改变路径结构）。绝对路径同样逐段解码。 |
| 回归测试 | 单元（`ReaderScreen.test.tsx`）：空格/CJK/emoji；编码 fragment 与路径各自只解码一次、fragment-only；`../` + 编码段组合；绝对路径与已解码路径不变；`100%.md` 与 `..%2Fescape.md` 保持字面。组件级：点击 `%E4%B8%AD%E6%96%87%E6%96%87%E6%A1%A3.md` 后断言 `open_documents` 收到 `paths: ['/docs/中文文档.md']` 并完成同标签导航。 |

### 1.2 D-IT-2（R22，替换保存进入“找不到原文件”）— 已修复（两层）

| 项 | 内容 |
|---|---|
| 现象 | `copyfile`+`os.replace` 的外部替换保存后，标签进入“找不到原文件。保留了已加载内容…”，需手动「重试」才出现更新横幅；原地写入对照正常（IT03，`it03-c-replace-unavailable.png` vs `it03-j-inplace-banner.png`）。 |
| 根因（实测） | 用临时探针（`notify` 8 + 真实文件系统，探针文件未提交）记录到替换保存的事件流：`Modify(Name(From))` → `Modify(Name(To))` → `Modify(Name(Both))` → `Modify(Metadata)` → **`Remove(File)`**（旧 inode 的删除/旧目录项 `IN_DELETE` 在 rename 事件之后到达）。`WatchService` 的“最后操作获胜”因此把已存在的文档报成 `removed`；前端收到 `removed` 后按契约提示直接进入 `unavailable`，且之后不再有 `appeared`/`modified` 事件，故停在手动重试。 |
| 修复层 A（主因，Rust `src-tauri/src/services/watch.rs`） | 静默窗口到期时以**文件系统为准**校正：窗口最后操作是 `Removed` 但文档路径在 flush 时存在 → 发送 `modified`（替换保存后内容确已变化）；路径确实缺失才发送 `removed`。新增可注入 `DocPresence` seam（生产 `FsDocPresence`= `fs::metadata`，测试可注 stub），不改变既有事件合并/去抖语义。 |
| 修复层 B（前端，`src/features/reader/use-reader.ts`，对齐 models §3.2 W3） | `removed` 只是提示：不再直接置 `unavailable`，而是执行一次 `read_document(refresh)` 稳定读——可读/读到新哈希 → 走正常 refresh/pending 流程（同哈希清候选、异哈希出更新横幅、follow 模式重新评估）；稳定读失败为 `PS_IO_NOT_FOUND` → `unavailable`（保留内容 + 重定位/重试，INV-DS-06）；其它失败（如 `PS_IO_CHANGED` 仍未稳定）保留展示版本并显示错误。>50MiB 源码窗口模式不能用 `read_document(refresh)`（`PS_LIMIT_SIZE`），保持直接 unavailable。 |
| 回归测试（Rust，与修复同层） | `watch_registry.rs`：完整替换保存事件序列 + 文件存在 → `modified`（不再 `removed`）；注入 presence stub 的确定性别（present→`modified` / absent→`removed`）；既有 `removal_without_reappearance` 与 `last_observed_operation_wins` 改为真实删除文件后仍断言 `removed`。`watch_runtime.rs`：真实 OS watcher 的 `copyfile+rename over` 复现 → 首个载荷非 `removed`，替换后原地写入仍产生载荷（父目录 watch 覆盖），真实删除仍报 `removed`。 |
| 回归测试（前端） | 新用例“removed 提示先验证、可读源进入 pending 流（D-IT-2/W3）”：发送 `removed` 且 refresh 可读、`refreshHash=v2` → 更新横幅出现、无 unavailable、内容保持；既有 AT07 三用例改为显式模拟 `PS_IO_NOT_FOUND`（真实缺源）后仍验证 unavailable/重试/重定位；B-06 用例同样先造真实缺源。 |

### 1.3 D-IT-3（R29，11MiB 简化阅读 >7 分钟未完成）— 已修复（有界快路径 + 两处二次方修复）

| 项 | 内容 |
|---|---|
| 现象 | 11MiB 语料选择「简化阅读」后 WebKitWebProcess 105–113% CPU >7 分钟仍未完成解析，搜索栏停在“正在建立全文索引”，尾搜/复制不可达（IT07，`it07-parse-cpu.txt`）。 |
| 根因（实测剖析，Node/同语料生成器） | ① 完整管线（remark-parse/GFM/math → transforms → rehype → annotate）在简化模式下仍全量执行，`remark-parse` 超线性（512KiB 0.97s → 1MiB 2.69s → 2MiB 8.41s，约 2.8–3.1×/倍增），11MiB 单解析即数分钟；② `annotateTree` 两处 O(n²)：`groupChildren` 对每个 hast 顶层子节点线性扫描 blocks（且**每次分片重挂载都重跑**），`annotateChildren` 对每个块 `filter` 全部 segments（2MiB 时首屏 `blockLimit=24` 1.58s、全量 48.8s，且随尺寸二次增长）；③ 重复标题的锚点去重从 `-1` 逐次重扫（同一标题 1.6 万次时仅此一项 ~22s）。 |
| 修复 | ① **简化快路径**（新 `src/document/simplified.ts`，由 `pipeline.ts` 在 `simplified && text.length > 1Mi UTF-16` 时选用）：单次线性行扫描，直接产出与完整管线同契约的 `hast/outline/blocks/segments/stats`——标题（唯一锚点/大纲）、段落、列表、引用、表格与围栏代码纯文本；代码块带可信 `code-block` 包装（无 Shiki 也可用复制/折叠/换行与精确载荷）；全文本进入搜索分段、UTF-16↔UTF-8 源映射与指纹保持同构；不加载 KaTeX/Shiki/Mermaid/图片解码。≤1Mi UTF-16 的简化文档仍走原管线子集（blockId/segId 与全量一致，测试固定）。② `annotate.ts`：blocks 二分查找 + segments 按块一次性分桶 + `blockLimit` 前缀截断。③ `extractOutline`/快路径锚点：按 base 记录下一个空闲后缀（输出序列不变）。 |
| 回归测试 | `src/document/simplified.test.ts`（13 用例）：结构与大纲、逐段“段文本=原文切片”与字节范围一致、代码包装/语言/精确载荷、列表/引用/表格、CJK/emoji/CRLF、未闭合围栏、空文档、400 组 needle 全文覆盖（含代码载荷逐条精确）、annotate 集成（section/data-seg-id）、阈值选择规则、小文档仍走管线子集（保留 math/inline-code 段）、>1Mi 走快路径且与直调结果一致、11MiB 级语料在预算内完成。 |

---

## 2. D-IT-3 前后测量（同机、同语料生成器）

语料：`evidence/generated/corpus-52MiB.md` 同型生成器（章节/段落/列表/围栏代码/表格/行内公式，混合中英），11MiB 截取版 = **11,534,838 B / 9,065,834 UTF-16**。测量 harness 为临时 vitest 文件（测完删除，未提交；方法 = 对与 IT 相同结构的语料逐阶段计时）。

### 2.1 修复前（旧路径；11MiB 未能在可观察窗口内完成）

| 阶段（同语料） | 512KiB | 1MiB | 2MiB | 11MiB |
|---|---|---|---|---|
| remark-parse（仅 CommonMark） | 0.97s | 2.69s | 8.41s | 未完成（超线性外推 ≥ 2.5–3min 仅解析；打包应用观察 >7min CPU，`it07-parse-cpu.txt`） |
| +remark-gfm+math | 1.23s | 3.24s | 10.1s | — |
| transforms a–c | 0.11s | 0.20s | 0.43s | — |
| rehype-raw+sanitize | 0.22s | 0.39s | 1.00s | — |
| annotateTree（首屏 24 块，二次方） | 0.06s | 0.28s | 1.58s | 外推约 40–50s，且每次分片重复 |
| annotateTree（全量，二次方） | 0.55s | 3.15s | **48.8s** | 外推数十分钟 |

### 2.2 修复后（本任务实测，2026-10-08）

| 测量 | 结果 |
|---|---|
| `parseDocument(text, {simplified:true})`（fast path）11MiB | **1,669ms**；blocks=144,463，segments=170,729；尾段搜索 token 在索引中 |
| `annotateTree` 首屏（`blockLimit=24`）11MiB | **91ms** |
| `annotateTree` 全量 11MiB | **362ms** |
| fast path 2MiB | **269ms**（旧简化路径同输入约 13s：解析 10.1s+rehype 1.0s+首屏 annotate 1.58s） |
| 全量模式 annotate 2MiB（未改全量解析） | 首屏 **7ms**（原 1.58s）、全量 **224ms**（原 48.8s） |
| 打包应用层复测 | 待 acceptance 复跑（本任务不含桌面运行；见 §4） |

结论：简化模式 11MiB 端到端（解析+索引+首屏标注）从“>7 分钟未完成”降到约 **1.8s**（同机 Node 口径），满足“可观察窗口内完成、全文搜索/复制可用”。

---

## 3. 变更文件与验证命令

### 3.1 变更（全部在声明写域内）

| 文件 | 内容 |
|---|---|
| `src/features/reader/ReaderScreen.tsx` | D-IT-1：`resolveDocumentLink` 路径分段解码 |
| `src/features/reader/use-reader.ts` | D-IT-2B：`verifyRemovedSource` + `handleWatchChanged` 接线（W3 稳定读验证） |
| `src/features/reader/ReaderScreen.test.tsx` | D-IT-1 单元 5 + 集成 1；D-IT-2 前端 1；AT07/B-06 用例改为真实缺源模型 |
| `src-tauri/src/services/watch.rs` | D-IT-2A：`DocPresence` seam + flush 时存在性校正 |
| `src-tauri/tests/watch_registry.rs` | +2 确定性回归；2 个既有用例适配真实删除 |
| `src-tauri/tests/watch_runtime.rs` | +1 真实 OS watcher 回归（IT03 复现） |
| `src/document/simplified.ts`（新） | D-IT-3：简化阅读线性快路径（含 `SIMPLIFIED_FAST_PATH_MIN_UTF16` 阈值） |
| `src/document/simplified.test.ts`（新） | D-IT-3：13 条功能/覆盖率/预算回归 |
| `src/document/pipeline.ts` | 简化模式超阈值时选用快路径 |
| `src/document/annotate.ts` | 二分查找 + 分段分桶 + 前缀截断（去二次方） |
| `src/document/transforms/outline.ts` | 重复标题锚点去重去二次方（输出不变） |

### 3.2 命令与结果（最终源码修订）

| 命令 | 结果 |
|---|---|
| `pnpm typecheck` | PASS（`tsc --noEmit`，无输出） |
| `pnpm lint` | PASS（`eslint .`，无输出） |
| `pnpm test -- --run` | **72 files / 568 tests passed, 0 failed**（基线 wp-44：71 / 547；新增 1 文件 21 用例） |
| `pnpm build` | PASS（tsc + vite build；仅既有 chunk-size 提示） |
| `node src/document/worker/smoke.worker-build.mjs` | PASS（built worker 无 DOM 全局、真实解析往返） |
| `cargo fmt --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `cargo test` | **282 passed / 0 failed**（20 个测试二进制 + doc-tests；新增 watch_registry 2、watch_runtime 1） |

---

## 4. 残余限制与诚实声明

1. **简化快路径的保真度取舍（有意的降级模式）**：内联强调/链接/行内代码/公式按源文本显示（不解析为可点击/样式化内联节点）、图片按源文本显示（无占位图组件）、不生成 GFM 脚注区、原始 HTML 仅作文本呈现（永不执行/注入）。全文文本均进入搜索分段、可选中复制；代码块经可信 `code-block` 包装保留精确复制/折叠/换行。这符合 rendering-pipeline §5 的“纯文本+基础结构+完整搜索/复制、关闭重型引擎”。
2. **阈值语义**：仅 `simplified && text.length > 1Mi UTF-16` 走快路径；更小的简化文档保持“同一管线子集”（blockId/segId 与全量一致，已有测试固定）。对 1Mi–10MiB 之间因复杂度提示而选择简化的文档，简化视图的块/分段集合与“全量渲染”不再逐字一致（结构等价、覆盖率不降；表格/列表标记会进入文本分段），这是可观察的行为差异，已在测试中固定阈值语义。
3. **全量模式未改为线性**：非简化（full）管线仍为超线性；>10MiB 从不进入 full（仅提示简化/源码），复杂文档拒绝简化后保留的已渲染 full 视图与后续更新重解析仍可能慢。本次任务按“有界修复”不重构全量解析；如需 full 模式大文档线性化，需单独架构评估（记录于此，不在本任务范围）。
4. **桌面/验收层未复跑**：本证据为组件/集成层（vitest + cargo + 构建 + worker smoke）。D-IT-1/2/3 在 `acceptance-it.md` 的关闭需要 wp-45/验收复跑打包产物（IT02/IT03/IT07 对应子项）；在此之前仍属待复验。
5. **D-IT-2 语义选择**：替换保存且窗口最终提示为删除时，Rust 修正为 `modified`（文件确已变化）而非 `appeared`；契约 §7.3 的 `appeared`（父目录重建、典型替换保存）亦可辩护，前端对两者处理一致。选择 `modified` 是保守语义（不对“曾经消失”作断言）。
6. **观察项处置（无义务）**：O-IT-1（图片错误态文案）、O-IT-3（gtk-launch 路径）、O-IT-4（更新 toast 近似标注）、O-IT-5（合成 Escape）均保持原样。O-IT-2（大文档提示重现遮挡）未修复、未定根因，建议在 IT 复跑时分诊；本任务对 2MiB 简化路径的提速会降低其触发窗口，但不消除该 UI 问题。
7. **性能数字口径**：前后均为本机原地测量（Node vitest 进程、同机同语料生成器），非基准机、非 P95；11MiB 修复前“未完成”引用 IT07 打包应用观测（>7min CPU），修复后为同机 Node 口径（首屏约 1.8s）；打包 WebKit 的实际数字需复跑记录。

---

## 5. 追溯

| 缺陷 | 需求 | 设计/契约 | 实现 | 回归 | 复验状态 |
|---|---|---|---|---|---|
| D-IT-1 | R15 | models §5.2；rendering-pipeline §2.11 | `ReaderScreen.tsx` | `ReaderScreen.test.tsx`（6） | 组件级 PASS；桌面 IT02 待复跑 |
| D-IT-2 | R21/R22 | contracts §7.1–7.4；models §3.2 W3 | `watch.rs`；`use-reader.ts` | `watch_registry.rs`、`watch_runtime.rs`、`ReaderScreen.test.tsx` | 组件/集成级 PASS；桌面 IT03 待复跑 |
| D-IT-3 | R29 | rendering-pipeline §5；models §1.4 | `simplified.ts`、`pipeline.ts`、`annotate.ts`、`outline.ts` | `simplified.test.ts`（13）、文档全量套件 | 组件级 PASS；桌面 IT07 待复跑 |
