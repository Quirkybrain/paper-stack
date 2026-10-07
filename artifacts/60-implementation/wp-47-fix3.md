# 纸栈 PaperStack · wp-47-fix3 实现证据（D-IT-3 残余：11 MiB 简化阅读卡死）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP-47-FIX3
- **Artifact Type**: Implementation Evidence（承接 `acceptance-it.md` D-IT-3 残余与 `acceptance-at.md` AT29 子项；逐项给出根因、修复、前后测量与真机验证）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-47-fix3`（任务分支 `task/wp-47-fix3`；父分支 `feat/v0.1.0`；基线提交 `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b`；产出提交主题 `fix(reader): window large simplified documents`）
- **Last Verified**: 2026-10-08
- **Scope**: `src/`、`artifacts/60-implementation/`。未改 pinned 输入、`tests/`、`fixtures/`、锁文件、配置、`src-tauri/`。
- **Pinned inputs（已按 handoff 哈希核验，2026-10-08）**：
  - `artifacts/70-verification/acceptance-it.md` `7787e69e…`
  - `artifacts/70-verification/acceptance-at.md` `bc5d1160…`
  - `artifacts/60-implementation/wp-45-fix-it.md` `76b74260…`
  - `artifacts/30-architecture/rendering-pipeline.md` `6fe1f74a…`

---

## 1. 现象与根因

**现象（pinned 输入）**：11 MiB 语料选择「简化阅读」后内容可见（~5s）、索引可用（~10s），但 WebKitWebProcess **≥100% CPU 持续 75–360s+**；尾搜/下一项不前进；WM 关闭超时（D-IT-3 residual；IT07 `it07-parse-cpu.txt` 105–113% >7 分钟）。

**本任务在真实与合成两侧定位到两层根因**：

1. **无界渐进挂载（挂载层的 O(n²)）**：`DocumentView` 对全部文档使用 `useProgressiveMount`：每 24 块一次 `setTimeout(0)`/`requestIdleCallback` tick，**每次 tick 都重新执行 `renderDocument`（annotate + rehype-react 全前缀元素创建）并让 React 重渲染全部已挂载前缀**，直到把 145,360 块全部挂载。11 MiB 语料 = 6,057 个分片；合成剖析前 10 片均值 **82.6ms**，仅元素创建一项外推 ≥500s（不含 React DOM/布局），与 IT07 观察一致。

2. **摘录解析的全文扫描（渲染层的 O(n·size)）——本任务新发现，是“尾跳即冻结/关闭超时”的直接原因**：`DocumentView.sourceExcerptFor` 会对**每个已挂载 section** 执行一次块查找 + `utf8RangeToUtf16(rawText, block.sourceRangeBytes)`；而 `utf8ByteOffsetToUtf16Index` **从文本 0 位置线性扫描到目标字节偏移（每块 2 次）**。窗口跳转到文档尾部（600 块、偏移 ~11 MB）时单次渲染需 ~6.6×10⁹ 字符步进：真机诊断中尾块定位后 WebKitWebProcess **瞬时钉在 100–112% CPU，>70s 不回落**；首/二次 `WM_DELETE_WINDOW` 均无响应，13s 后由 SIGTERM 兜底（14.3s）。该计算发生在 React render 内（无提交、无 paint），因此表现为“计数不更新、下一项不动、关闭超时”。

> 说明：wp-45 的线性快路径修复了“解析/索引”，未触及上述挂载与摘录层；本次为 D-IT-3 residual 的有界修复。

---

## 2. 修复（全部在声明写域内）

| 层 | 文件 | 内容 |
|---|---|---|
| 窗口化挂载 | `src/features/reader/body/DocumentView.tsx` | 简化模式且 `blocks > 2000` 时使用**有界窗口** `[start,end)`：初始 120 块、每步 120、**硬上限 600**（每次提交有界）；`revealBlockId`+`revealNonce` 在**渲染期**解析目标窗口（与 locate effect 同一次提交，保证 mount→scroll 顺序，尾块可达）；滚动增长仅在真实滚动时发生（delta 方向 + 600px 边缘 + 程序化补偿 250ms 抑制 + 首个可见块锚点补偿），空闲零 tick；`generation/total` 变化回退初始窗口。 |
| 窗口标注 | `src/document/annotate.ts`、`src/document/map.tsx` | `AnnotateInput/RenderDocumentInput` 新增 `blockStart`，输出窗口 `[blockStart, blockStart+blockLimit)`；`blockLimit` 原语义与既有行为不变（默认 `blockStart=0` 走原路径）。 |
| 定位接线 | `src/features/reader/ReaderScreen.tsx` | `requestReveal`（nonce 递增）替换裸 `setRevealBlockId`（同一块重复请求也能重跳）；`resolveFragment` 返回 `blockId`，元素未挂载时经 reveal+`pendingLocate` 跳转（**大纲跳转与页内锚点**同样窗口可达）；正文查找/历史恢复不变。 |
| 摘录 O(1) | `src/features/reader/body/DocumentView.tsx` | 新 `createBlockExcerptResolver`：每文档一次 `Map<blockId, BlockRecord>` + 直接用块记录**已有的精确 UTF-16 源区间**切片，替代“线性块查找 + 全文字节扫描”；`sourceRangeBytes` 本就是由 `sourceRange` 派生的同一区间，语义不变。 |
| 回归测试 | `src/features/reader/body/DocumentView.test.tsx`（新）、`src/document/annotate.test.ts`、`src/features/search/SearchBar.test.tsx` | 窗口纯函数/钩子确定性用例；大简化文档首窗 120 块且**空闲无泵送**；尾目标 reveal 替换窗口；首屏代码块复制控件在窗；普通尺寸文档仍走渐进挂载；`blockStart` 窗口切片；单命中 Enter/下一项选中；摘录解析器正确性与晚块解析。 |

**兜底方案未采用**：任务给出的备选（>20k 块强制源码分段）不需要——窗口化挂载在本机 11 MiB 上已验证安全（见 §3），简化模式的全文/搜索/复制/基础排版契约保持。

---

## 3. 前后测量

### 3.1 合成剖析（同机、同语料生成器派生）

语料：`artifacts/60-implementation/wp-47-fix3-evidence/corpus-11MiB.md`
= `head -c 11534336 artifacts/70-verification/evidence/generated/corpus-52MiB.md`（与 acceptance IT07 同源同尺寸），sha256 `b84af672…`。

| 测量 | 修复前 | 修复后 |
|---|---|---|
| 简化快路径解析（wp-45 起已是线性） | — | **1,522ms**；blocks=145,360，segments=171,790 |
| 挂载通道 | 6,057 分片；前 10 片均值 82.6ms；**元素创建外推 ≥500s**，且每次 tick 重渲染全前缀 | 窗口渲染：初始 `[0,120)` **80ms**；中段 `[70000,70600)` **110ms**；尾部 `[144760,145360)` **141ms**（每次提交有界，空闲无 tick） |
| 摘录解析 | 每块 2 次全文线性扫描（尾部单块 ~2×11M 字符步进；600 块窗口 ~6.6×10⁹ 步进）→ 真机 >70s 100–112% CPU | O(1) Map 查找 + 直接 UTF-16 切片 |

### 3.2 真机验证（release 二进制，修复后）

对象：`pnpm tauri build --no-bundle` 产物 `src-tauri/target/release/paperstack`，sha256 `94a25e17…`（含本任务源码修订）；X11 `DISPLAY=:1`；数据/缓存隔离于证据目录；浅色固定条件；驱动器 `run-verify.sh`（键盘/点击经 `xdo-helper`；截图 `screenshot.sh`）。

| 项 | 结果 | 证据 |
|---|---|---|
| 内容可见时间 | 选择「简化阅读」后 **+2s 仍在「正在解析」、+3s 首屏正文可见**（≤5s 口径达成） | `v03-content-t1/t2/t3.png` |
| 索引/搜索可用 | 搜索 `fixed code block` → 1/13214；`x_{132139}` → 1/1 | `v05-code-hit/…`、`v09-tail-hit.png` |
| CPU 采样（100s，197 样本，0.5s 间隔） | 峰值 **150.9%**（t=2.5s，解析/挂载爆发）；t=10.7s 起 0%；**末 20s 均值 0.00%**（应用空闲） | `cpu-after-choice.csv`、`runs.log` cpu summary |
| 尾块导航 | `x_{132139}`（文档第 132,139/145,360 块）Return → 计数 **1/1**，视图跳至尾部（`公式 $x_{132139}…` 命中高亮 + `章节 132140`、`段落 132142`、`item-132143`）；Esc 后位置保持 | `v08-search-tail.png`、`v09-tail-hit.png`、`v10-tail-after-escape.png` |
| 首屏代码块复制 | 定位命中块 → Esc → Tab 聚焦「复制」→ Return → 剪贴板 **49 B**，精确载荷 `fn sample() -> u32 {\n    42 // fixed code block\n}` | `v05-code-hit.png`、`v06-code-focus.png`、`v07-clipboard.txt` |
| WM 关闭 | **0.12s** 干净退出（首次 `WM_DELETE_WINDOW`，无 NON-CLEAN/SIGTERM）；`pgrep` 无残留 | `runs.log` "WM close + exit took 0.12s"、`close-notes.txt` |
| 冻结复现对照（修复前构建，同序列） | 尾块定位后 **100–112% CPU 持续 >70s**；首/二次 WM_DELETE 超时，14.3s 后 SIGTERM 兜底 | `runs.log`（block probe 段：t=12.7s 起 107.9%）；修复后同序列 0.12s 关闭 |

### 3.3 修复前真机基线（wp-43 打包二进制）

对象：`output/paperstack_0.1.0_amd64.deb` 提取树二进制 `996f5c6c…`（`/tmp/opencode/ps-deb-it`；早于 wp-45 线性快路径，即 acceptance IT07 的原始观察对象）；同语料、同固定条件、同「简化阅读」选择路径；`run-before.sh`。

| 项 | 结果 | 证据 |
|---|---|---|
| CPU 曲线（150s/295 样本） | **0 个样本低于 20%**；max 507.3%（启动+解析并发），avg **114.7%**；t≈15s 起稳定 ~100–106%，末 30s 均值 106.7% | `before/cpu-before.csv`、`before/runs.log` |
| 内容时间线 | +5/+60/+150s 均停在「正在解析」（该二进制无 wp-45 快路径，超线性解析 150s 内未完成）——复现原始 D-IT-3（与 IT07 `it07-parse-cpu.txt` 同型） | `before/b03-content-t5/t60/t150.png` |
| WM 关闭 | 首/二次 WM_DELETE 均无响应，**14.26s** 后 SIGTERM 兜底（NON-CLEAN） | `before/close-notes.txt` |

**残余（post-wp-45）的修复前证据**来自 pinned acceptance Rev 2（内容 ~5s、索引 ~10s，但 ≥100% CPU 75–360s+、尾跳不前进、关闭超时）与本任务诊断构建复现：挂载/摘录修复前，尾块定位触发 WebKitWebProcess **107.9% CPU >70s**，关闭 14.3s 超时（`runs.log` block-probe 段）；修复后同序列见 §3.2（0.00% 空闲、0.12s 关闭）。

结论：修复后应用在首屏可见后 ~10s 内回落到空闲（末 20s 0.00%），尾跳/复制可用，WM 关闭即时；修复前（无论 wp-43 原始包还是 post-wp-45 残余路径）同场景 CPU 长时间饱和、关闭超时，与本任务的两层根因一致。

---

## 4. 验证命令与结果（最终源码修订）

| 命令 | 结果 |
|---|---|
| `pnpm typecheck` | PASS（`tsc --noEmit`，无输出） |
| `pnpm lint` | PASS（`eslint .`，无输出） |
| `pnpm test -- --run` | **73 files / 588 tests passed, 0 failed**（基线 wp-44：568；新增 `DocumentView.test.tsx` 17、`annotate.test.ts` +2、`SearchBar.test.tsx` +1） |
| `pnpm build` | PASS（tsc + vite build；仅既有 chunk-size 提示） |
| `pnpm tauri build --no-bundle` | PASS（release；`src-tauri/target/release/paperstack` sha256 `94a25e17…`） |
| 真机 `run-verify.sh` | PASS（§3.2 全部项；0.12s 干净关闭） |
| 真机 `run-before.sh`（修复前基线） | 记录于 §3.3（诊断对照，不作为修复判定） |

---

## 5. 残余限制与诚实声明

1. **窗口化仅用于简化模式**（`simplified && blocks > 2000`）；非简化（full）管线仍为无界渐进挂载（>10MiB 从不进入 full；≤10MiB 复杂度文档的 full 路径保持 wp-45 记录的状态）。`>50MiB` 仍走源码窗口模式，不经此路径。
2. **窗口是有界的 DOM**：滚动线性前进会按步替换窗口（硬上限 600）；跨文档任意中间位置的可达性依赖搜索/大纲/页内锚点跳转（均已接线并可尾块定位）。简化模式的“完整文本/搜索/复制/基础结构”契约不变；未被挂载的块不渲染 DOM，但文本仍通过搜索索引可达（IXD §11.2 不静默遗漏）。
3. **真机数字为本机原地测量**（非基准机、非 P95）；CPU 采样为 `/proc` 抖动计算的口径，反映相对行为与是否空闲。
4. **O-IT-2**（大文档提示重现）与 2 MiB 复杂度路径未在本任务复跑；本任务的窗口化只解除挂载层瓶颈，不改变提示组件行为。
5. **诊断期间发现的自动化伪差异**：`xdo-helper` 的窗口相对坐标受 WM 边框偏移影响，合成点击对搜索栏图标/结果行不可靠；最终证据采用键盘路径（Tab/Enter/Space）。这是测试工具行为，不是产品缺陷（纯按钮点击如横幅关闭在同一窗口坐标下工作正常）。
6. **诊断构建未提交**：根因定位期间使用的临时代码（DOM 计数器/控制台面包屑）已全部移除；最终提交源码经 `pnpm typecheck/lint/test/build` 与真机复验。

---

## 6. 追溯

| 项 | 需求/设计 | 实现 | 回归 | 验证状态 |
|---|---|---|---|---|
| D-IT-3 residual（R29/AT29/IT07） | rendering-pipeline §2.12/§5；ui-spec §3.4 | `DocumentView.tsx`（窗口化/摘录/定位）、`annotate.ts`+`map.tsx`（`blockStart`）、`ReaderScreen.tsx`（nonce/锚点跳转） | `DocumentView.test.tsx`（17）、`annotate.test.ts`（+2）、`SearchBar.test.tsx`（+1） | 组件级 PASS；真机 PASS（§3.2）；验收复跑（IT07/AT29 子项）由后续验证任务承接 |
| R11 复制 | rendering-pipeline §2.9 | 首窗含代码块 + CodeBlock 包装 | `DocumentView.test.tsx` 复制控件用例 | 真机字节核对 PASS（49 B） |
| R14/R15 大纲/锚点 | rendering-pipeline §2.4a/§2.11 | `ReaderScreen.resolveFragment/scrollToAnchor` reveal 回退 | 既有 AT14/15 用例保持；窗口机制单测 | 真机尾块导航 PASS（搜索路径）；大纲路径共用同一 reveal 机制 |

---

## 7. 证据清单（`artifacts/60-implementation/wp-47-fix3-evidence/`）

- `corpus-11MiB.md`（生成物，未入库；`sha256 b84af672…`，`head -c 11534336` 自 `artifacts/70-verification/evidence/generated/corpus-52MiB.md`）
- `run-verify.sh`、`run-before.sh`、`sample-cpu.py`（固定条件与可复跑驱动）
- 修复后：`v01…v10*.png`、`cpu-after-choice.csv`、`v07-clipboard.txt`、`runs.log`、`app.log`
- 修复前基线：`before/b03-content-t*.png`、`before/cpu-before.csv`、`before/runs.log`、`before/close-notes.txt`
- 根因诊断记录：`runs.log`（block-probe/pin-bisect 等段落，含修复前冻结时的 107.9% CPU 曲线与 14.3s 关闭超时）
