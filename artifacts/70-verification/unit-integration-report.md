# 纸栈 PaperStack · wp-32 T-59–T-62 全量测试执行、向量与校准报告（Unit/Integration/Performance）

- **Producer**: agent:test-engineer
- **Artifact ID**: ART-70-VERIFY-WP32
- **Artifact Type**: Verification Report（固定样例与契约向量、全量测试执行、稳定性矩阵、NF04–NF07 校准；含原始数据与 UNVERIFIED 清单）
- **Status**: VALID（待质量审查与 Gate）
- **Revision**: 1
- **Owner**: test-engineer
- **Task**: `wp-32-testexec`（任务分支 `task/wp-32-testexec`；父分支 `feat/v0.1.0`；基线提交 `d63f7b7a70106a4b91390092b755ab0826e8aa56`；产出提交主题 `test(verification): add fixtures, vectors and full execution evidence`）
- **Components**: C-19 测试基础设施与固定样例（`fixtures/**`、`tests/contracts/**`、`tests/perf/**`、`src-tauri/tests/**`）；被验证对象为 C-04（`FilesService::search_source`）、C-11（解析管线/源映射/搜索分段）、C-14（搜索语义）、C-02（错误分类）。
- **Last Verified**: 2026-10-07
- **Scope**: `fixtures/`、`tests/perf/`、`tests/contracts/`、`src-tauri/tests/`、`artifacts/70-verification/`。未修改 `src/`、`src-tauri/src/`、`vite.config.ts`、`package.json`、锁文件、pinned 输入或框架文件。

> 本报告为 **校准与验证证据**：所有 NF04–NF06 数值来自本机（12 核/15 GiB，非基准机），按计划 §5.4 只作为校准数据，**不得**读作达标声明。固定样例与向量为 T-59/T-61 的交付；T-62 的全量执行、稳定性矩阵与 NF07 结果见后文。

## 1. 输入与基线核验（pinned inputs）

Pinned 输入在 2026-10-07 复核（SHA-256 与 `state/handoffs/wp-32-testexec.json` 一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a28be026338af865bb6b9725785cdfcd08ce4ca2fd137bb9d70143919` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |
| `artifacts/70-verification/early-run.md` | `76622428d0b201402b288bf7ec28321cd3f83f7003f45be2642fd8e1e902c134` | ✓ |
| `artifacts/60-implementation/wp-28-update.md` | `41676e10749721091abdf1fde589101741a8744c0f447bbf929f4722d5db958b` | ✓ |

分支 `task/wp-32-testexec`；进入时工作树干净；`swe_guard.py begin` 校验通过（任务此前已 ACTIVE，快照 `refs/swe/snapshots/20261007T085138Z-wp-32-testexec-c01ea1c5` 覆盖 `fixtures/`、`src-tauri/tests/`、`artifacts/70-verification/`）。

## 2. 交付物（T-59–T-62）

### 2.1 固定样例 `fixtures/**`（T-59）

| 路径 | 内容 |
|---|---|
| `fixtures/README.md` | 夹具索引（各目录用途与契约引用）。 |
| `fixtures/rendering/`（9 个样例 + README） | rendering-pipeline §7 八类：`mixed-cn-en.md`、`math.md`、`code.md`（12 语言 + 未知语言 + 45 行折叠块）、`tables.md`、`mermaid.md`、`images.md`、`links.md`、`edge-cases.md`，另有 `source-map.md`（CJK/emoji/组合字符/CRLF 源映射）。 |
| `fixtures/search/search-samples.md` + README | 折叠命中、公式源、行内/围栏代码、alt、CJK、emoji、组合字符（不做归一）、大小写三态、零结果控制。 |
| `fixtures/security/malicious.md` + README | `<script>`/事件属性/style/iframe/`javascript:`/`data:`/`vbscript:`/`file:`/路径穿越（unix+windows）/SVG script/宏炸弹/50 节点 mermaid 溢出/复选框勾改。 |
| `fixtures/update/`（扩展） | 新增 `heading-moved.md`、`repeated-blocks.md`、`no-shared-anchor.md` 与 README 表格（歧义/近似/无锚点更新场景）。 |
| `fixtures/.gitattributes` | 为 `rendering/edge-cases.md` 的硬换行样例声明 `-whitespace`（与既有 `encoding/crlf.md` 同口径）。 |

样例消费测试：`tests/contracts/rendering-fixtures.test.ts` 用真实解析管线逐个解析（确定性、块/分段范围、指纹形状、锚点唯一性、语义覆盖 needle、恶意样例无可执行节点/事件属性/危险协议、宏炸弹局部 `PS_PARSE_LOCAL`、details/summary 与只读复选框）。

### 2.2 契约语义向量（T-61）

| 路径 | 内容 |
|---|---|
| `tests/contracts/vectors/search-parity.json` | 11 个字面搜索一致性用例（同一 corpus → 相同 UTF-8 字节偏移/1 基行号）+ 1 个固定文件用例 + 2 个“边界分歧”用例（每侧期望值）。 |
| `tests/contracts/vectors/utf16-utf8.json` | UTF-16 ↔ UTF-8 边界向量（ASCII/CJK/emoji/组合字符/CRLF/多字节+换行）。 |
| `tests/contracts/vectors/utf16-utf8-js-only.json` | 代理对内部索引与孤立代理的 JS 侧钳制向量（Rust 有效 UTF-8 不可能出现）。 |
| `tests/contracts/vectors/error-taxonomy.json` | contracts §5 的 32 个稳定错误码（category/messageKey/retryable/sourceRange）。 |
| `tests/contracts/vitest.config.ts` + 4 个 `*.test.ts` + README | 前端侧执行器（根 `vite.config.ts` 只收录 `src/**`，本套件由独立配置运行；见 README 命令）。 |
| `src-tauri/tests/contract_search_parity.rs` | Rust 侧执行器：`search_source` 逐用例、错误表逐字段、UTF-16 向量逐点 `encode_utf16`。 |

折叠规则（向量文件 `foldingRule` 字段，出自 contracts §2.1/ADR-007）：字面子串；`caseSensitive=false` 时双方按 Unicode 默认小写折叠（JS `String.prototype.toLowerCase` / Rust `char::to_lowercase`）；不做归一化、无正则；最左非重叠、文档顺序；偏移为原文 UTF-8 字节；行号为 1 基 LF 计数。向量期望值由该规范独立推导（不是实现输出）。

### 2.3 性能/资源脚本（T-60）

`tests/perf/`：`generate-corpus.mjs`（确定性 100KiB/1MiB/10MiB/52MiB，生成于被忽略的 `artifacts/70-verification/evidence/generated/`，**绝不提交生成物**）、`measure-nf04-startup.sh`（冷启动/冷打开/暖移交；窗口可见为首次屏幕代理）、`measure-nf05-search.sh` + `nf05.measure.ts`（解析/索引就绪与首次查询）、`measure-nf06-memory.sh` + `proc_tree.py`（进程树 PSS/RSS 与 `ss` 套接字观测）、`soak-service.sh`、`soak-desktop.sh`、`xwait.c`、`vitest.config.ts`、README（可复跑命令与口径）。无 sudo、无 tcpdump。

### 2.4 新增 Rust 测试

| 路径 | 内容 |
|---|---|
| `src-tauri/tests/contract_search_parity.rs` | 5 个测试：搜索一致性用例（≥20 个查询）、固定文件用例、两个边界分歧、32/32 错误表、UTF-16 向量。 |
| `src-tauri/tests/nf07_soak.rs` | 500 次 open → refresh → switch（“关闭”）循环，每 50 次采样 RSS/fd/注册数；句柄与内存趋势断言。 |

## 3. 执行环境与修订

| 项 | 值 |
|---|---|
| 修订（基线） | `d63f7b7a70106a4b91390092b755ab0826e8aa56`（`task/wp-32-testexec`）；本任务只新增 `fixtures/**`、`tests/**`、`src-tauri/tests/**` 与报告/证据，未修改产品代码；产出提交主题 `test(verification): add fixtures, vectors and full execution evidence` |
| 工具链 | Node v24.15.0；pnpm 10.34.6；rustc/cargo 1.96.0；vitest 5.0.3 |
| 机器 | 12 核 / 15 GiB（非基准机）；内核 `7.0.0-34-generic` |
| 桌面 | X11 `DISPLAY=:1`（Xorg）；窗口 1280×800；release 二进制 SHA-256 `436f57521c4d00e15cfacfff07889131e1e1d1d72deb25051f4148480686c3b1`（`pnpm tauri build --no-bundle`，2026-10-07） |
| 前端套件 | `pnpm test -- --run`（根配置，只收录 `src/**`；运行于 jsdom） |
| 契约套件 | `pnpm vitest run --config tests/contracts/vitest.config.ts`（`tests/contracts/**`；jsdom） |
| Rust 套件 | `cargo test --manifest-path src-tauri/Cargo.toml`（unit + 19 integration，含新增 2 个） |
| 原始证据 | `artifacts/70-verification/evidence/wp-32/`（`suite-*.log`、`static-checks.log`、`stability/`、`perf/`、`nf07-*.txt`） |

## 4. T-62 全量测试执行（本分支最终修订）

| 套件 | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 前端单元/组件/集成 | `pnpm test -- --run` | Test Files **69 passed (69)**；Tests **499 passed (499)**；14.5s | 0 |
| 契约/语义向量（前端侧） | `pnpm vitest run --config tests/contracts/vitest.config.ts` | Test Files **4 passed (4)**；Tests **43 passed (43)** | 0 |
| Rust（unit + integration + contract + soak） | `cargo test --manifest-path src-tauri/Cargo.toml` | 21 suites：**254 passed; 0 failed**（51 lib unit + 197 既有集成 + 5 contract + 1 soak） | 0 |
| 静态检查 | `pnpm lint`、`pnpm typecheck` | eslint 0 诊断；tsc 0 诊断 | 0 |

测试总数 **796**（前端 499 + 契约 43 + Rust 254）。无 `skip`/`only`/`quarantine` 计入 PASS；`nf07_soak` 重复 2 次（全量 + 单独复跑）均通过。

## 5. 稳定性矩阵（T-62）

已知易抖文件（wp-28 D-28-7/D-28-13）加两个最重文件（按测试时长：`ReaderScreen` 5.6s、`SettingsDialog` 1.2s），各单独重复 12 次；另加全量套件 5 轮与四文件合并 8 轮。flake 定义为任何非确定性失败；失败原样保留并在 §8 诊断。

| 文件 | 单文件重复 | 结果 | 备注 |
|---|---|---|---|
| `src/features/search/search-integration.test.tsx` | 12 | **12/12 PASS**（12 tests/轮） | D-28-7 修复后未见丢事件 |
| `src/features/settings/PrivacySection.test.tsx` | 12 | **12/12 PASS** | D-28-13 在单文件负载下未复现 |
| `src/features/reader/ReaderScreen.test.tsx`（最重 #2） | 12 | **12/12 PASS**（34 tests/轮） | |
| `src/features/settings/SettingsDialog.test.tsx`（最重 #3） | 12 | **12/12 PASS**（4 tests/轮） | |
| 全量套件重复 | 5 | **4 PASS / 1 FAIL** | 第 2 轮 1 个失败：`PrivacySection > suppresses cleared write-back categories…`（`Unable to find role="dialog"`）→ 已复现并根因定位，见 F-32-4 |
| 四文件合并（并发）重复 | 8 | **8/8 PASS**（56 tests/轮） | 未复现 |

结论：48/48 单文件重复与 8/8 合并重复干净；全量并发 5 轮中 1 轮暴露同一测试用例的既有竞态（测试侧，非产品代码），根因与经验证的修复方案见 F-32-4。原始日志：`artifacts/70-verification/evidence/wp-32/stability/`（含失败原文、复现脚本与日志）。

## 6. 性能/资源校准（T-60；非基准机）

### 6.1 NF04 启动/打开（代理：进程启动 → 可见的 ≥200×200 窗口；OS 页缓存未丢弃）

| 组 | n | p50 | p95 | min/max | 失败 |
|---|---|---|---|---|---|
| cold-start（无文档） | 30 | **121 ms** | **127 ms** | 111 / 195 ms | 0 |
| cold-open 100KiB | 30 | **116 ms** | **129 ms** | 110 / 131 ms | 0 |
| warm-handoff 1MiB（CLI 进程存活 → 退出代理） | 30 | **105 ms** | **106 ms** | 104 / 106 ms | 0 |

口径说明：xwait 只匹配 ≥200×200 的可见 `paperstack` 窗口（GTK 在真正 toplevel 之前会创建同名小窗口；首版探针错误命中这些小窗口，已修正并重跑）。上述数值是**窗口映射**代理；应用无首帧标记、页缓存无法在无 sudo 下丢弃，故首屏内容可见时间与冷 OS 缓存场景保持 UNVERIFIED（§9）。早期误命中版本的数据（40–70ms）已作废、不再引用。原始 CSV 与 meta：`perf/nf04-*.csv`。

### 6.2 NF05 解析/索引就绪与首次查询

| 语料 | n | 解析/索引就绪 p50 / p95 | 首次查询 p50 / p95 | 命中数 |
|---|---|---|---|---|
| 100KiB（生成，`needle-4`） | 30 | **237.8 ms / 369.6 ms** | **0.61 ms / 1.13 ms** | 1 |
| 1MiB（生成，`needle-3`，重跑为最终原始文件） | 30 | **13212 ms / 18465 ms** | **31.7 ms / 38.1 ms** | 5 |
| 1MiB（生成，密集命中 `段落`，额外压力探针） | 5 | 16038 ms（p50） | **12886 ms / 14468 ms** | 2333 |

解释（校准，非达标声明）：解析/索引成本随语料呈明显超线性（100KiB→1MiB 约 10× 数据、p50 约 **56×**），与按块做 O(全文偏移) 的 UTF-16→UTF-8 换算一致（代码阅读假设，见 F-32-2）；首次查询成本随命中数近似线性放大（每命中一次 O(全文) 偏移换算 + 前缀行数统计，F-32-3）。100KiB 场景两项均在 NF05 目标量级内；1MiB 小命中场景首次查询达标量级，但解析远超 NF04 的“1MiB 全文可搜 ≤3s”设计目标（仅校准口径，达标结论待基准机）。原始 JSON：`perf/nf05-100KiB-raw.json`、`perf/nf05-1MiB-raw.json`、`perf/nf05-1MiB-dense-raw.json`。

### 6.3 NF06 进程树资源

采样：应用进程树（主进程 + WebKit 辅助进程）PSS/RSS 每 200 ms，启动后立即采样 12 s；`ss -tanp` 记录树内套接字。

| 场景 | 样本 n | PSS 峰值 / 中位 | RSS 峰值 | 套接字 |
|---|---|---|---|---|
| idle（无文档，先稳定 3 s） | 55 | **283.4 / 282.6 MiB** | 463.3 MiB | 0 |
| open 100KiB | 54 | **425.6 / 396.1 MiB** | 608.1 MiB | 0 |
| open 1MiB | 53 | **425.7 / 421.7 MiB** | 606.0 MiB | 0 |
| open 10MiB（恰为阈值；`>10MiB` 才提示，故本轮为全量解析压力） | 52 | **1318.9 / 942.6 MiB** | 1499.5 MiB | 0 |

口径说明：数值含 WebKitGTK 辅助进程（NF06 要求不能只报主进程）；idle 已高于 NF06 的 250MiB 设计预算、1MiB 打开高于 500MiB 峰值预算（**仅本机校准，达标结论待基准机**；计划 §5.4 明确不得据此宣称达标）。10MiB 语料恰等于阈值（10,485,760 B），分类器按“未超阈值”走完整解析，因此该行同时是压力观测与阈值边界事实；200ms 采样可能漏掉瞬时峰值。套接字观测为 0（无 sudo 的 `ss` 替代口径，抓包级证据见 §9）。原始 `.raw` + `.sockets`：`perf/nf06-*`。

## 7. NF07 500 次循环（T-62）

- **服务级（`src-tauri/tests/nf07_soak.rs`，500 次 open → refresh → switch）**：**PASS**，500/500 循环无失败，耗时 **4069 ms**（约 8.1 ms/循环）。句柄趋势：`/proc/self/fd` 全程恒为 **4**（首末一致，无泄漏）；内存趋势：RSS 4216 kB → 4860 kB（前 50 循环分配器预热后稳定在 ~4.8 MB 平台，+644 kB，远低于 16 MiB 守护阈值）；注册文档 ≤2、快照缓存 ≤1（容量 1 的 LRU 上界持续成立）。原始样本 `artifacts/70-verification/evidence/wp-32/nf07-soak-samples.txt`，日志 `nf07-soak.log`。
  - 说明：contracts 无“关闭文档”命令（标签关闭是前端状态；服务侧经 generation 失效与 LRU 释放文本），循环以“打开另一文档强制逐出缓存”表达 close，并在每循环断言缓存/注册上界；`NoWaitTimer` 仅去掉 S1 等待，稳定读取协议本身仍执行。
- **桌面级短循环（`soak-desktop.sh`，open → WM_DELETE_WINDOW close，refresh 不自动化）**：**PASS**，30/30 循环干净退出（`exit_0`），launch 窗口代理均值 **122.3 ms**（max 131 ms），close 150–180 ms，0 失败。原始 CSV `nf07-desktop-loop.csv`；refresh 腿由服务级覆盖（本轮无产品失败；F-32-2/3 属性能校准发现）。
- 两个层面的 NF07 均未观察到崩溃、句柄增长或内存单调上升；取消/迟到任务语义由既有 `session`/`ReaderScreen` 测试覆盖（本任务全量执行含在内）。

## 8. 发现与失败（不掩盖）

### F-32-1（合同偏差，Rust 侧；低用户影响）：`search_source` 的小写折叠缺少 Final_Sigma 上下文

- **证据**：向量 `greek-final-sigma-context-fold`（`tests/contracts/vectors/search-parity.json`）。corpus `ΟΔΟΣ οδος`，insensitive 查询 `οδος`：前端（JS `toLowerCase`，整串，含 Unicode Final_Sigma 规则 `Σ→ς`）命中 2 处；Rust（`char::to_lowercase` 逐码点，无上下文 `Σ→σ`）仅命中 1 处。两侧执行器均以“分歧已固定”断言纳入：`tests/contracts/search-parity.test.ts` 与 `src-tauri/tests/contract_search_parity.rs`。
- **违反**：contracts §2.1 “`caseSensitive=false` 时按与前端一致的 `toLowerCase` 折叠”。影响面：仅 >50MiB 源码窗口模式（命令 38）在含大写希腊 Sigma 词尾的文本上。
- **必须的修复（不在本任务写范围）**：`src-tauri/src/services/files.rs` 的 `fold_segment`/`fold_query` 需实现与 JS `toLowerCase` 等价的上下文折叠（Final_Sigma：`Σ` 位于词尾/非 cased 字符前时映射为 `ς`），或在合同修订中显式缩小承诺。修复后必须重跑 `contract_search_parity` 并把该用例从 `contract-divergence` 改为一致性用例。

### F-32-2（性能校准发现，产品侧；需独立修复任务）：1MiB 解析/索引成本超线性，校准值 ~15s（NF04 设计目标 ≤3s）

- **证据**：NF05 同一生成语料 p50 237.8ms（100KiB）→ 13212ms（1MiB 最终重跑），约 **56×** per 10× 数据；全部块/分段语义正确。
- **代码阅读假设（非最终 RCA，交 debug/perf 任务确认）**：`src/document/transforms/blocks.ts:80` 对每个块调用 `utf16RangeToUtf8Bytes(text, range)`，而 `src/document/source-map.ts` 的 `utf16IndexToUtf8ByteOffset` 每次从索引 0 逐码点计数 → 聚合 O(块数 × 文本长度)。1MiB 生成语料约 1.5k 块，与观测耗时量级一致。
- **必须的修复方向（不在本任务写范围）**：单次前向扫描预计算 UTF-16↔UTF-8 映射表（或增量累积字节偏移），供块/分段/诊断共用；修复后重跑 `tests/perf/measure-nf05-search.sh 100KiB/1MiB` 与根套件。达标结论需基准机复测（计划 §5.4）。

### F-32-3（性能校准发现，产品侧；中影响）：首次查询成本随命中数 O(命中 × 全文)

- **证据**：1MiB、5 命中 → p50 34.6ms；1MiB、2333 命中（`段落`）→ p50 **12886ms**（`perf/nf05-1MiB-dense-raw.json`，n=5）；100KiB、1 命中 → 0.61ms。实现上 `findSourceHits` 对每个命中调用 `utf16IndexToUtf8ByteOffset` 与 `countLines(prefix)`，两者都从文本起点重算（`src/features/search/search-core.ts`）。
- **影响**：常见词在较大文档中命中数千次时，查询提交到结果展示可达数秒，超出 NF05 的 200ms 目标量级。
- **必须的修复方向（不在本任务写范围）**：每次查询/每文档一次性构建行起始表与字节偏移表（或对命中映射做单次前向遍历），保持“字面 + 无归一化”语义不变；修复后重跑 NF05 与 `search-core` 单测。

### F-32-4（测试竞态，已复现、根因已定位、修复已在本任务内验证；修复目标文件在写范围外）：`PrivacySection` 清除按钮点击早于数据就绪

- **失败原文（全量第 2 轮，原样保留）**：`FAIL src/features/settings/PrivacySection.test.tsx > PrivacySection > suppresses cleared write-back categories and refreshes the overview — TestingLibraryElementError: Unable to find role="dialog"`（完整输出见 `stability/full-suite-repeats.log`）。
- **根因**：`PrivacySection` 的清除按钮 `disabled={overview === null}`（数据未就绪时禁用，属产品正确行为）；测试用 `fireEvent.click(await screen.findByRole('button', …))` 只等待按钮**存在**（初始渲染即存在但禁用）。并发负载下 `get_storage_overview` 的完成晚于 `findByRole` 首次命中时，点击落在禁用按钮上被忽略，随后 `findByRole('dialog')` 超时。同一模式存在于该文件三处（行 126/167/179）。
- **复现与修复验证（in-scope 临时测试，已删除、日志保留）**：`stability/privacy-race-repro.log` — 人为延迟 overview 50ms 后，① 现有模式 100% 复现“无 dialog”；② 等待按钮 enabled 再点击 100% 打开 dialog。临时文件 `tests/contracts/tmp-privacy-race.test.ts` 运行后已删除，未入库。
- **必须的修复（不在本任务写范围，`src/features/settings/PrivacySection.test.tsx`）**：三处改为先等待启用再点击，例如
  ```ts
  const clearButton = await screen.findByRole('button', { name: t('settings.privacy.clear') })
  await waitFor(() => expect((clearButton as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(clearButton)
  ```
  修复后应重跑 `PrivacySection` 单文件 ×12 与全量套件 ×5；本任务已提供复现模板与日志可供修复任务做回归对照。
- **未弱化任何断言**：本任务未修改该测试或产品代码来完成“变绿”；矩阵结果如实记录（5 轮全量 4 通过 1 失败）。

### 受限边界（非缺陷，供 Gate 知悉）

- **İ（U+0130）长度变化折叠**：前端把折叠串索引钳回原串，Rust 映射回原字符；ADR-007 明确接受该边界，向量 `dotted-capital-i-length-changing-fold` 固定双方行为，防止静默漂移。
- **OS 页缓存 / 首次绘制帧**：无法在无 sudo 下丢弃缓存或无标记地测首帧；NF04 采用“可见窗口”代理并如实标注（§9）。

## 9. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 |
|---|---|
| 干净系统安装（`dpkg -i`）、Wayland 会话、抓包级零请求证据 | 无 sudo / 本机仅 X11 / 无 tcpdump；按计划 §5.5 以提取运行 + `ss` 套接字观测替代；抓包口径保持 UNVERIFIED。 |
| NF04–NF06 P95 达标结论、NF09 达标 | 本报告仅本机校准（12 核/15 GiB，非基准机）；达标需基准环境复测。 |
| 首次绘制帧（first paint）与暖打开的可视确认 | 无应用内计时标记；以“可见窗口/CLI 移交”为代理。OS 页缓存无法在无 sudo 下丢弃。 |
| 10MiB 桌面完整渲染（恰为阈值：`>10MiB` 才提示；本轮 10MiB 语料走完整解析，仅记录资源压力）与 52MiB 桌面全量渲染/滚动 | 10MiB 提示/简化行为属 wp-28/34 范围；52MiB 仅生成脚本验证尺寸/哈希，未做桌面全量渲染（>50MiB 源码窗口闭环亦见下行）。 |
| 真实布局/字体/图片解码、真实 IME、200% 缩放、深色主题 | jsdom/校准脚本不覆盖；属 wp-34 桌面走查。 |
| `>50MiB` 源码窗口在真实文件上的 IPC 闭环 | 本任务只测固定语义向量与生成语料；真实后端走查属 wp-31/34。 |
| 表格/代码块局部横向滚动实际触发 | 校准脚本不驱动 UI；wp-34。 |

## 10. 复现方式

```sh
pnpm test -- --run                                                # 根套件
pnpm vitest run --config tests/contracts/vitest.config.ts         # 契约向量（前端侧）
cargo test --manifest-path src-tauri/Cargo.toml                   # Rust
tests/perf/soak-service.sh && tests/perf/soak-desktop.sh 30       # NF07
node tests/perf/generate-corpus.mjs                               # 生成语料（不入库）
tests/perf/measure-nf04-startup.sh cold-start "" 30                 # 其余 NF04–NF06 见 tests/perf/README.md
```

## 11. 追溯

- **implementation-plan §4.4（T-59–T-62）/ §5.1（L1–L7）/ §5.4（校准口径）/ §5.5（UNVERIFIED）**；**rendering-pipeline §7（八类样例）**；**contracts §1.2/§2.1/§5/§8**；**ADR-007**（字面搜索、双实现共享向量、`toLowerCase` 一致性）；**NF07/NF11**；**wp-28 §6（D-28-7/D-28-13）与 EA-RUN §7（未验证清单）**。
