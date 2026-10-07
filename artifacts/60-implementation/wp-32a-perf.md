# 纸栈 PaperStack · wp-32a 解析/查询性能修复与搜索折叠对齐实现报告

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP32A
- **Artifact Type**: Implementation Evidence Report（wp-32 校准发现 F-32-1–F-32-4 的整改：源映射索引、命中映射、折叠对齐、测试竞态）
- **Status**: VALID
- **Revision**: 2
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-32a-perf`（任务分支 `task/wp-32a-perf`；父分支 `feat/v0.1.0`；基线提交 `0e84c262db1bdcc74c063e280cb8811fc415cc62`；产出提交主题 `perf(document): optimize offset mapping and align search folding`）
- **Components**: C-11（解析管线/源映射/搜索分段）、C-14（搜索语义）、C-19（测试基础设施：竞态修复与向量更新）
- **Scope**: `src/`、`tests/contracts/`、`artifacts/60-implementation/`。未修改 `tests/perf/`（按原样执行）、`package.json`、`src-tauri/`、pinned 输入或框架文件；无新增依赖；无接口/契约字段变更。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 `state/handoffs/wp-32a-perf.json` 逐字一致，只读未改）：

| 输入 | SHA-256（前 8/后 8） | 一致 |
|---|---|---|
| `artifacts/70-verification/unit-integration-report.md` | `a4c90529…81157d261` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a…d70143919` | ✓ |
| `artifacts/30-architecture/adr/ADR-007-search.md` | `b8e56f8d…e625db1` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…6a8b02967f` | ✓ |

任务在 `swe_guard.py` 中已 ACTIVE（快照 `refs/swe/snapshots/20261007T100733Z-wp-32a-perf-bb58a9aa`，覆盖 `src/`、`tests/contracts/`、`artifacts/60-implementation/`）。修复前用提交的校准脚本在 1MiB 语料（`artifacts/70-verification/evidence/generated/corpus-1MiB.md`，SHA-256 `ced07f39…f34ef763192`）复现了 wp-32 §6.2 的量级：解析 p50 **13136 ms**（n=3）、密集查询 p50 **10946 ms**（n=2）。

## 2. 发现修复（F-32-1 – F-32-4）

### 2.1 F-32-2 解析/索引超线性（C-11；性能缺陷）

- **根因（证实）**：`src/document/transforms/blocks.ts` 对每个顶层块调用 `utf16RangeToUtf8Bytes(text, range)`，而 `src/document/source-map.ts` 的两个方向换算与行统计每次都从文本索引 0 重新逐码点扫描。1MiB 语料约 1.5k 块 → 聚合 O(块数 × 文本长度)。基线 10× 数据 56× 成本的超线性形态与之一致（F-32-2 代码阅读假设，本任务实测确认）。
- **修复**：`src/document/source-map.ts` 新增 `createSourceOffsetIndex(text): SourceOffsetIndex`（声明交付物，已改）：单次前向扫描建立每 256 个 UTF-16 单元的检查点（UTF-16 位置、累计 UTF-8 字节、1 基 LF 行号），查询用二分 + ≤256 单元局部扫描，总成本 O(n)；钳制、代理对半程、孤立代理（U+FFFD，3 字节）语义与既有单次换算函数逐一相同。
- **接线**：`pipeline.ts` 每文档构建一次索引，块注册表（`runMdastTransforms` 新增可选第三参）、引擎源范围（KaTeX/Shiki/Mermaid 的 `toSourceRangeBytes`）、诊断 `sourceRange`、`stats.bytesUtf8` 全部共用；`blocks.ts` 不再逐块换算。
- **行为不变性**：索引与既有换算函数在全部 UTF-16 索引/UTF-8 字节上的交叉一致性由新增单测覆盖（含跨检查点的混合文本），块/分段夹具、契约向量与全量套件均通过；1MiB 语料命中数（5/5、2333/2333）与修复前一致。

### 2.2 F-32-3 首次查询 O(命中 × 全文)（C-14；性能缺陷）

- **根因（证实）**：`src/features/search/search-core.ts` 的 `findSourceHits` 对每个命中调用 `utf16IndexToUtf8ByteOffset`（起止各一次）与 `countLines(rawText.slice(0, start))`，均从文本起点重算；2000+ 命中时近 11 s。
- **修复**：一次查询构建一个 `SourceOffsetIndex`，字节偏移与 1 基行号都在索引内 O(log + 256) 解析（F-32-3 声明交付物）；`hitSnippet` 新增**可选** `offsetIndex` 参数（缺省回退原换算，签名向后兼容），`SearchBar` 在搜索面板打开期间按 `rawText` memo 一份索引，200 行结果列表不再每行两次数百万码点扫描。
- **行为不变性**：命中集合、字节偏移、行号与修复前一致（契约/夹具向量 + 新增密集命中单测），密集场景命中数 2333/2333 前后相同。

### 2.3 F-32-1 折叠分歧（C-14；合同一致性）

- **根因（证实）**：前端 `fold` 使用整串 `String.prototype.toLowerCase()`，会应用 Unicode Final_Sigma 上下文规则（词尾 `Σ`→`ς`）；Rust `char::to_lowercase` 逐码点折叠（`Σ`→`σ`）。向量 `greek-final-sigma-context-fold`：`ΟΔΟΣ οδος` + 查询 `οδος` 前端 2 命中 / Rust 1 命中。
- **修复**：`search-core.ts` 导出唯一折叠助手 `foldLower`（搜索全路径唯一折叠入口：`findMatchRanges` → `findBodyHits`/`findSourceHits` 共用）：逐码点 `String.fromCodePoint(cp).toLowerCase()`；Final_Sigma 是 Unicode SpecialCasing 中唯一上下文相关的小写规则，故不含 U+03A3 的字符串走原生整串快速路径（结果一致且无性能回退）。İ（U+0130）长度变化折叠仍按 ADR-007 接受，行为不变。
- **向量**：`foldingRule` 明确"双方逐码点、禁用整串 `toLowerCase`"；新增常规用例 `greek-final-sigma-per-code-point`（两条查询，覆盖 `Σ→σ`/`ς` 两方向），由前端套件与 `src-tauri/tests/contract_search_parity.rs` **两侧同样断言**（Rust 侧随常规 `cases` 循环逐值断言）。
- **偏差（必须知悉）**：`greek-final-sigma-context-fold` 边界用例已解决，但 `src-tauri/tests/contract_search_parity.rs`（本任务写范围外）硬断言边界用例恰为 2 且其一 `kind="contract-divergence"`、且每例 `rust ≠ frontend`，因此无法在范围内把它改成一致性用例。现处理：该边界条目保留 `kind` 但 **queries 清空**（不再包含任何"分歧数据"），`resolvedIn: "wp-32a-perf"` 并注明指向共享用例；前端测试新增结构断言（resolved 条目必须指向同 corpus 的共享 parity 用例）。Rust 套件在 2.4 中通过。**后续任务（src-tauri 范围）**：断言共享用例、去掉 `assert_ne`/`kinds` 分歧检查并删除该空壳。

### 2.4 F-32-4 PrivacySection 清除按钮竞态（C-19；测试缺陷）

- **根因（wp-32 已定位、此处复核）**：产品在 `get_storage_overview` 完成前禁用清除按钮（正确行为）；测试只等待按钮**存在**就点击，全量并发下点击落在禁用按钮上被忽略。三处（原 126/167/179 行）同模式。
- **修复**：三处改为 `findByRole` → `waitFor(disabled === false)` → `fireEvent.click`；未删除、未弱化任何断言（对话框打开、部分失败、写回抑制、概览刷新次数均原样保留）。

## 3. 性能前后对照（本机校准，非基准机；plan §5.4）

命令（脚本原样，未修改；原始 JSON 在 git-ignored 的 `artifacts/70-verification/evidence/generated/`）：

```sh
PS_PERF_QUERY=needle-3 PS_PERF_N=30     tests/perf/measure-nf05-search.sh 1MiB   # 标准
PS_PERF_QUERY=段落     PS_PERF_N=10     tests/perf/measure-nf05-search.sh 1MiB   # 密集命中
```

| 场景（1MiB 语料） | 指标 | 修复前（本机复跑 / wp-32 报告） | 修复后（本机） | 改善 |
|---|---|---|---|---|
| `needle-3`（5 命中） | 解析/索引就绪 p50 | **13136.2 ms**（n=3；报告 n=30：13212 ms） | **885.6 ms**（n=30） | **≈14.8×** |
| `needle-3` | 解析/索引就绪 p95 | 13136.2 ms（n=3；报告 18465 ms） | **938.1 ms**（min 847.5 / max 1267.2） | ≈14×/19× |
| `needle-3` | 首次查询 p50 | 30.83 ms（n=3；报告 31.7 ms） | **10.61 ms**（p95 15.82） | ≈2.9× |
| `段落`（2333 命中） | 解析/索引就绪 p50 | 13144.0 ms（n=2；报告 16038 ms n=5） | **888.3 ms**（n=10） | ≈14.8×（报告 ≈18×） |
| `段落` | 首次查询 p50 | **10946.4 ms**（n=2；报告 12886 ms n=5） | **18.03 ms**（p95 20.70） | **≈607×** |

口径与诚实说明：以上为 12 核/15 GiB 非基准机校准（vitest 开发变换，绝对值为上限参考；规模趋势为算法性），不构成 NF04/NF05 达标声明；基准机结论待 wp-38/复测。修复后 1MiB"解析/索引就绪"p50 已进入 NF04 的 ≤3s 设计目标量级、首次查询进入 NF05 的 200ms 目标量级（仅本机）。未在单测中加入任何计时阈值（脆弱）；性能回归观察保持在脚本级原始证据（本表 + 原始 JSON）。密集命中数、标准命中数前后完全一致，语义未漂移。

## 4. 折叠规则（唯一助手）

- **规则**：`caseSensitive=false` 时双方按 Unicode 默认小写**逐码点**折叠（前端 `foldLower`，Rust `char::to_lowercase`）；无正则、无归一化、无分词；最左非重叠、文档顺序；偏移 UTF-8 字节、行号 1 基 LF 计数。
- **单一入口**：搜索路径只经 `src/features/search/search-core.ts` 的 `foldLower`（`findMatchRanges` 内）；无第二处折叠实现。`outline`/`shiki` 的 `toLowerCase` 与锚点 slug、语言别名有关，与搜索语义无关，未动。
- **快速路径**：仅当字符串不含 U+03A3 时使用整串 `toLowerCase`（Final_Sigma 唯一上下文规则的等价性），含则逐码点；İ 长度变化折叠为 ADR-007 已接受边界，向量中保留。
- **快速路径等价性验证（一次性本地穷举，非入库测试）**：对全部 1,112,063 个有效码点（排除 U+03A3）与 20 万条多码点上下文 fuzz，整串 `toLowerCase` 与逐码点折叠**零分歧**；含 U+03A3 语料按逐码点路径，结果与 Rust `char::to_lowercase` 期望一致（希腊/ẞ/K/Å/İ 向量）。

## 5. 验证命令与结果（工作目录 = 项目根；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit`，无诊断 | 0 |
| 2 | `pnpm lint` | `eslint .`，无诊断 | 0 |
| 3 | `pnpm test -- --run` | Test Files **69 passed (69)**；Tests **508 passed (508)**（基线 499 + 新增 9） | 0 |
| 4 | `pnpm vitest run --config tests/contracts/vitest.config.ts` | Test Files **4 passed (4)**；Tests **45 passed (45)**（基线 43 + 新增 2） | 0 |
| 5 | `pnpm build` | `tsc && vite build`，`✓ built`（仅既有 >500 kB chunk 提示，非错误） | 0 |
| 6 | `cargo test --manifest-path src-tauri/Cargo.toml` | 21 suites：**254 passed; 0 failed**（含 contract_search_parity 5/5） | 0 |

测试总数 **807**（前端 508 + 契约 45 + Rust 254；修复前 796）。无 `skip`/`only`/quarantine。新增确定性用例：源映射索引交叉一致性 ×3、密集命中映射 ×1、折叠/快速路径 ×3、sigma 语义 ×1、hitSnippet 索引等价 ×1（根套件 +9）；共享希腊 parity ×1、resolved 边界结构 ×1（契约 +2）。

## 6. 稳定性矩阵（wp-32 D-28-7/D-28-13 四个易抖/最重文件）

| 文件 | 重复 | 结果 | 备注 |
|---|---|---|---|
| `src/features/search/search-integration.test.tsx` | 12 | **12/12 PASS** | |
| `src/features/settings/PrivacySection.test.tsx` | 12 | **12/12 PASS** | F-32-4 修复后单文件负载 |
| `src/features/reader/ReaderScreen.test.tsx` | 12 | **12/12 PASS** | 最重 #2（34 tests/轮） |
| `src/features/settings/SettingsDialog.test.tsx` | 12 | **12/12 PASS** | 最重 #3 |
| 全量套件（`pnpm test -- --run`，F-32-4 原复现条件） | 5 | **5/5 PASS（每轮 508/508）** | wp-32 曾在第 2 轮复现竞态；修复后未再复现 |

48/48 单文件重复与 5/5 全量重复均无非确定性失败；原始日志：`artifacts/70-verification/evidence/generated/wp-32a/stability/`（git-ignored）。

## 7. 变更文件清单

| 路径 | 变更 |
|---|---|
| `src/document/source-map.ts`（声明交付物） | 新增 `SourceOffsetIndex`/`createSourceOffsetIndex`（检查点单遍索引，含行号） |
| `src/document/transforms/blocks.ts` | 块范围经共享索引；`runMdastTransforms` 可选索引参数（缺省自建）；移除逐块 O(offset) 换算 |
| `src/document/pipeline.ts` | 每文档一个索引：变换、引擎源范围、诊断、`stats.bytesUtf8` 共用 |
| `src/features/search/search-core.ts`（声明交付物） | `foldLower` 唯一折叠助手；`findSourceHits` 单索引映射；`hitSnippet` 可选 `offsetIndex` |
| `src/features/search/SearchBar.tsx` | 面板打开期间按 `rawText` memo 索引并传入 `hitSnippet` |
| `src/features/settings/PrivacySection.test.tsx` | 三处先等启用再点击（F-32-4），断言未弱化 |
| `src/document/source-map.test.ts`、`src/features/search/search-core.test.ts` | 新增 9 个确定性用例（§5） |
| `tests/contracts/vectors/search-parity.json` | 折叠规则、希腊共享 parity 用例、resolved 边界空壳（`resolvedIn`） |
| `tests/contracts/search-parity.test.ts` | 支持 resolved 边界结构断言；计数更新 |

## 8. 明确 UNVERIFIED / 后续

| 项 | 原因 / 要求 |
|---|---|
| NF04/NF05 达标结论（基准机） | 本报告仅本机校准（非基准机）；绝对值与 P95 达标需基准环境复测（延续 wp-32 §9）。 |
| Rust `contract_search_parity.rs` 的边界断言收尾 | 该文件在本任务写范围外；当前通过 `resolvedIn` 空壳（无分歧数据）保持 cargo 绿色，**必须**由 src-tauri 范围任务把 `greek-final-sigma-per-code-point` 变为其唯一断言并删除空壳（详见 §2.3 偏差）。 |
| 大规模真实文档的桌面级性能 | 校准脚本在 vitest 下运行；真实 WebView/Worker 的绝对耗时属 wp-34 桌面走查。 |
| `>50MiB` 源码窗口 Rust 流式扫描性能 | 平台侧实现未改；其 folding 语义现与前端一致（向量两侧断言），但性能不在本任务范围。 |

## 9. 复现方式

```sh
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
pnpm vitest run --config tests/contracts/vitest.config.ts
cargo test --manifest-path src-tauri/Cargo.toml
PS_PERF_QUERY=needle-3 PS_PERF_N=30 tests/perf/measure-nf05-search.sh 1MiB
PS_PERF_QUERY=段落     PS_PERF_N=10 tests/perf/measure-nf05-search.sh 1MiB
```

## 10. 追溯

- **wp-32 报告 §8 F-32-1..F-32-4、§6.2（NF05 校准）**；**rendering-pipeline §2.4b–c/§3（源映射契约）**；**ADR-007 §Decision（字面 + 双方共享语义、toLowerCase 一致性）**；**contracts §2.1 命令 38**；**implementation-plan §4.4（T-59–T-62）、§5.4（校准口径）、§5.5（UNVERIFIED）**；**NF05/NF11**。

## 11. Rev 2（wp-32b-parityclean）：Rust 侧边界清理

- **范围**：`src-tauri/tests/contract_search_parity.rs` 与本报告。任务分支 `task/wp-32b-parityclean`；父分支 `feat/v0.1.0`；基线 `87d89956be872703a4838879694f1402af9c76bb`；产出提交主题 `test(contracts): clean resolved search parity divergence shell`。
- **清理内容**：
  - 删除已解决分歧的遗留期望：`boundary.len() == 2` 与 `kinds.contains("contract-divergence")`；测试更名为 `search_boundary_cases_pin_the_accepted_divergence`，只保留 ADR-007 接受的 İ 长度变化折叠钉子（逐查询 `rust` 断言与 `rust ≠ frontend` 断言原样保留、未弱化）。
  - 希腊 Final_Sigma 用例改由常规 `cases` 机制显式断言：`cases.len() >= 12`，且 `greek-final-sigma-per-code-point` 必须出现在常规向量循环中并逐值断言（查询矩阵 ≥20 保持不变）；文件头注释同步更新。错误表与 UTF-16 向量测试未改动。
- **偏差（须记录）**：修复前 `cargo fmt --check` **在基线即失败**——wp-32 新增的两个测试文件（本文件与 `src-tauri/tests/nf07_soak.rs`）入库时未 rustfmt 化（crate 其余文件干净）。为使本任务要求的 fmt 门禁真正通过，两文件均做 rustfmt 规范化并一并提交（`nf07_soak.rs` 纯格式、无语义变化）；这超出任务第 4 步"仅提交 parity 测试与报告"的字面清单，但仍在 handoff `writes`（`src-tauri/tests/`）内，且不在 `src-tauri/tests/` 留下未提交改动。
- **验证（2026-10-07，本机）**：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` 退出 0；`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` 退出 0；`cargo test --manifest-path src-tauri/Cargo.toml` 21 套件 **254 passed / 0 failed**（`contract_search_parity` 5/5，含更名后的边界测试与希腊共享用例）。本任务未改 `src/`、`tests/contracts/`，前端/契约套件不受影响。
- **剩余**：向量文件中的 resolved 空壳（`boundaryCases.greek-final-sigma-context-fold`，`queries: []`）仍然存在，因其位于 `tests/contracts/`（本任务写范围外）；Rust 侧已不依赖它，删除只需一个 tests/contracts 范围的小改动（前端 resolved 边界检查在空壳删除后同样成立）。
