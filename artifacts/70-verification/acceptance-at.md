# 纸栈 PaperStack · wp-34 T-63 桌面验收运行报告（AT01–AT30）

- **Producer**: agent:test-engineer
- **Artifact ID**: ART-70-VERIFY-ACCEPTANCE-AT
- **Artifact Type**: Verification Report（真实 release 应用在 X11 `DISPLAY=:1` 上的 AT01–AT30 逐项验收；含原始证据、失败与明确 UNVERIFIED 清单）
- **Status**: VALID
- **Revision**: 7
- **Owner**: test-engineer
- **Task**: `wp-34-desktop-at`（任务分支 `task/wp-34-desktop-at`；父分支 `feat/v0.1.0`；基线提交 `613b4658c63e112c40b6ce171771e6b31732c75f`；产出提交主题 `test(acceptance): run desktop at scenarios and fix parity vector shell`）
- **Task (Rev 2)**: `wp-34b-atrerun`（任务分支 `task/wp-34b-atrerun`；父分支 `feat/v0.1.0`；基线提交 `33dd600fdf12c3a90b80e4589b856e9e348b8bd6`，已含 wp-34a 修正并入提交 `adf805b`；产出提交主题 `test(acceptance): re-run fixed at scenarios`）
- **Task (Rev 3)**: `wp-34d-rerun`（任务分支 `task/wp-34d-rerun`；父分支 `feat/v0.1.0`；基线提交 `f6e560802e8c3964a60594a7cd020afc20f91a56`，已含 wp-34c 修正并入提交 `dba385a`；产出提交主题 `test(acceptance): re-run at19/26/28 on fixed revision`）
- **Task (Rev 4)**: `wp-38-desktop-rerun`（任务分支 `task/wp-38-desktop-rerun`；父分支 `feat/v0.1.0`；基线提交 `5d977ea40c0d6bea353412f3b83f1cd0ee1e9b56`，已含 wp-35a（Rust 安全修正）与 wp-36a（前端/管线修正）并入；产出提交主题 `test(acceptance): post-fix desktop re-run`）
- **Task (Rev 5)**: `wp-42-atrefresh`（任务分支 `task/wp-42-atrefresh`；父分支 `feat/v0.1.0`；基线提交 `49f48baf336116a9ecc99545f6e02e11702c75b0`；系统验证 §7.4 G-01 条件 C1：全量 AT01–AT30 在同一现行 release 二进制上刷新；产出提交主题 `test(acceptance): refresh full at matrix on current tree`）
- **Task (Rev 6)**: `wp-46-itrerun`（任务分支 `task/wp-46-itrerun`；父分支 `feat/v0.1.0`；基线提交 `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b`，已含 wp-45 修复（`f8e4dae`，并入 `3a14102`）；复跑 wp-45 影响面 AT15/AT21/AT22/AT29；产出提交主题 `test(acceptance): verify it fixes and refresh evidence`）
- **Task (Rev 7)**: `wp-48-itrerun2`（任务分支 `task/wp-48-itrerun2`；父分支 `feat/v0.1.0`；基线提交 `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e`，已含 wp-45（`3a14102`）与 wp-47（`a86a20f`）修复并入；AT29/D-IT-3 残余在 wp-47 构建上的独立复验；产出提交主题 `test(acceptance): verify large-doc fixes`）
- **Components**: C-19 测试基础设施（`tests/desktop/` 新增验收驱动与工具）；被验证对象为桌面 release 二进制（M5 阶段全部已集成功能）；Rev 7 为当前树 release 二进制 `26c02d2d…`
- **Last Verified**: 2026-10-08（Rev 7：AT29 在 wp-47 修复构建 `26c02d2d…` 上独立复验，R5.6 计数项与尾导航/复制子项关闭；Rev 5：AT01–AT30 全量刷新于唯一 release 二进制 `054040ba…`，前向套件 71 文件 / 547 passed）
- **Scope**: Rev 1：`tests/desktop/**`、`tests/contracts/**`、`artifacts/70-verification/**`；Rev 2/3/4：`tests/desktop/**`、`artifacts/70-verification/**`；Rev 5：`tests/desktop/**`、`artifacts/70-verification/**`；Rev 7：`tests/desktop/**`、`artifacts/70-verification/**`。未修改 `src/`、`src-tauri/`、`fixtures/`、锁文件、pinned 输入或框架文件；产品缺陷只记录、未修补。

> **证据纪律**：本报告的每条判定都对应实际执行的操作与检查过的截图/日志/数据库内容；截图存在本身不作数。
> **FAIL 一律原样保留**（§5 发现）；未执行或不可执行的项在 §6 明确 UNVERIFIED，不计入 PASS。

> **Rev-merge note（2026-10-08，rm-48-merge-wp48 并集合并）**：本文件由 `feat/v0.1.0` 上两条并行修订链并集合并而成：wp-46-itrerun 的 Rev 6 复跑执行于树 `cb79a82`（早于 wp-47 展示层改动），wp-48-itrerun2 的 Rev 7 在最终树（已含 wp-47 修复）上刷新 AT29 判定。Rev 1–7 各节均按原文保留（Rev 6 由本次合并插入），未改写任何判定；**最新可用判定保持原样记录**（当前修订为 Rev 7；wp-46 中未被 wp-48 覆盖的记录照原文生效）。合并详情见 `artifacts/00-repository/merges/rm-48-merge-wp48.md`。

## Revision 7（2026-10-08，wp-48-itrerun2：wp-47 修复后 AT29 独立复验）

> **修订号口径**：派发引用的「Rev 6」（wp-46-itrerun 的 AT15/21/22/29 影响面复跑，其中 AT29 子项 FAIL：尾命中不推进/主线程饱和）由 `task/wp-46-itrerun`（提交 `472b1c1`）产出，但该任务**未并入本任务基线**（`feat/v0.1.0@fa424ef`，无 rm-46 合并记录；其报告、脚本与证据仅存在于该任务分支）。本任务按派发口径将本次独立复验编为 **Rev 7**，仅覆盖 **AT29**；**冲突时以本修订为准**。AT15/21/22 不在本任务范围，判定沿用 Rev 5；Rev 6 若并入，其 AT29 子项 FAIL 在本构建上不可复现（见 R7.2）。Rev 1–6（若有）原样保留为历史。本任务未修改任何产品代码。

### R7.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`it-rerun2/build.log`：`Finished release profile [optimized] target(s) in 40.29s`；`BUILD_EXIT=0`；与 acceptance-it Rev 3 同一构建产物） |
| 二进制 | `src-tauri/target/release/paperstack`；28,104,112 B；mtime 2026-10-08 04:33:35 +0800 |
| 二进制 SHA-256 | `26c02d2d8f4d254abb9aaf332be8e0f8d1857c1f3cf097464bb0050835f6a8c3`（`it-rerun2/app-binary.sha256`；`at-rerun5/runs.log` 各节头部重复记录；**≠** Rev 5 的 `054040ba…`、Rev 6（wp-46）的 `ee21ad20…`） |
| 修订 | `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e`（`task/wp-48-itrerun2`；父分支 `feat/v0.1.0`，已含 wp-45 快路径与 wp-47 窗口化挂载/O(1) 摘录并入）；`git diff HEAD -- src src-tauri :!**/tests/**` = 空 |
| Pinned 输入 | `acceptance-at.md` Rev 5 `bc5d1160…`、`acceptance-it.md` Rev 1 `7787e69e…`、`wp-47-fix3.md` `a7a7ec3c…` 与 handoff 逐一比对一致；`config/git-policy.json` `3b8ddffd…`（只读未改） |
| 语料 | `inputs/at29/doc-11MiB.md` = `head -c 11534336` 自 `evidence/generated/corpus-52MiB.md`（源 sha256 `7557cf7f…cfe94`）；派生 sha256 `b84af672…78767`（`runs.log` 记录） |
| 会话/固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `prefer-light`；`text-scaling-factor=1.25`；数据隔离于 `at-rerun5/data`，缓存 `cache-at29` |
| 驱动 | `tests/desktop/run-at-rerun5-wp48.sh`（分节 `at29\|all`，分节可重跑）；CPU 采样 `tests/desktop/sample-cpu.py` |
| 证据目录 | `evidence/at-rerun5/`：13 张 PNG + `runs.log`（两次 AT29 运行历史 + 补充 provenance）+ `at29-r7-cpu.csv`（118 样本）+ 剪贴板/期望载荷字节文件 + `at29-r7-close-notes.txt` |

### R7.2 AT29 复跑（旧 → 新）

| 来源 | 判定 | 说明 |
|---|---|---|
| Rev 5（旧，`054040ba…`） | PASS；R5.6：「11 MiB 简化模式搜索的最终命中计数」**UNVERIFIED**（8s 观察窗内处于「正在建立全文索引」；O-42-4） | 搜索框可用、无错误；尾命中导航未取得证据 |
| Rev 6（wp-46，未并入基线；`ee21ad20…`） | 子项 **FAIL 保留**：`段落 132144` 计数 1 可取得，但「下一项」/Return 2s 内未推进；主线程饱和；WM 关闭 8s 超时→SIGTERM | 证据仅存在于 `task/wp-46-itrerun` |
| **Rev 7（本修订，`26c02d2d…`）** | **PASS（R5.6 计数项与尾导航/复制子项全部关闭；Rev 6 所记 FAIL 不可复现）** | 下述子项均为真实执行并核对的证据 |

| # | 子项 | 本构建观测（2026-10-08） | 证据（`at-rerun5/`） |
|---|---|---|---|
| 1 | 阈值提示 | 打开 11 MiB 语料 → **「大文档阅读」** 对话框（「这个文档较大（11 MiB），请选择打开方式。」；简化阅读/只读源码/取消三选项；「已显示范围与全文索引范围将分别说明。」） | `at29-r7-a-threshold-dialog.png` |
| 2 | **取消路径** | 点击「取消」→ 对话框关闭、**文档不打开**、回到欢迎页（含最近阅读列表）；应用保持存活（`app alive=yes`）并可干净关闭 | `at29-r7-b-cancel-result.png`、`runs.log` |
| 3 | 简化阅读 + 覆盖说明 | 选择「简化阅读」→ 工具栏徽标 **「✓ 简化阅读」** + 范围说明横幅 **「已显示范围与全文索引范围将分别说明。」**；正文渲染 | `at29-r7-c…e` |
| 4 | 内容可见时间 | +3.17s 仍「正在解析」、**+5.18s 首屏正文可见**（`章节 0` 等）；不再出现 Rev 1/Rev 6 的分钟级卡死 | `at29-r7-d-content-t2/t3/t5`、`runs.log` 时间线 |
| 5 | 尾搜 + 尾命中导航（R5.6 项） | 唯一尾部探针 `x_{132139}` → **计数 0/1**、预览为目标尾段；点击「**下一项**」→ **计数 1/1、视图跳到文档尾部**（`章节 132140`、命中高亮、`item-132143` 可见）；随后干净关闭搜索面板。Return 键未推进（与 acceptance-it Rev 3 O-48-1 同族，合成输入观察） | `at29-r7-g`（0/1）、`h`（Return 尝试）、`i`（1/1+尾部） |
| 6 | 复制（字节核对） | 首屏代码块悬停→「复制」→ 剪贴板 **49 B**，与期望载荷 `fn sample() -> u32 {\n    42 // fixed code block\n}` `cmp` **EXACT**（3.08s） | `at29-r7-f-code-hover`、`at29-r7-code-clip.txt` + `at29-r7-code-payload.txt` |
| 7 | CPU 回落 | 118 样本/0.5s/60s：峰值 **229.7%**；尾导航引发有界爆发 t≈17–29s ~100%（Rev 6 为无界 75s+）；**35.63s 起 20 连续样本 <10%**；末 20 样本均值 **0.10%** | `at29-r7-cpu.csv`、`runs.log` cpu 摘要 |
| 8 | WM 关闭 | 11 MiB 实例首次 `WM_DELETE_WINDOW` → **0.12s** 干净退出；无 NON-CLEAN/SIGTERM；`pgrep` 无残留 | `at29-r7-close-notes.txt`、`runs.log` |
| 9 | 52 MiB 上限路径 | `corpus-52MiB.md` 直接进入源码分段模式：启动到窗口 **2808 ms**；RSS 182,380 KB；横幅 **「文件超过本版全量处理上限，可用源码分段查看。」** +「只读源码」徽标 + 「正在读取源码片段」 | `at29-r7-k-52mib-source.png`、`runs.log` |

### R7.3 汇总（Rev 7：AT29 复跑刷新 + 29 项沿用）

| 判定 | 数量 | AT |
|---|---|---|
| **PASS** | **30** | 01–30（Rev 5 的 29 项判定沿用 + AT29 复跑刷新） |
| **FAIL** | **0** | — |
| **子项 FAIL 保留** | **0** | Rev 6 的 AT29 子项 FAIL 在本构建上不可复现，本修订以通过证据取代 |
| **UNVERIFIED（整体）** | **0** | —（R5.6 的 AT29 计数项本次关闭） |

- **口径说明**：Rev 7 是 AT29/D-IT-3 的定向复验，**不替代** Rev 5 的全量 AT01–AT30 同树刷新；AT29 之外 29 项未复跑，判定沿用 Rev 5（wp-45/wp-47 未触及相应路径）。AT15/21/22 的 wp-46 复跑未并入本基线，不在本次范围。
- 前向套件：`pnpm test -- --run` → **Test Files 73 passed; Tests 588 passed; 0 failed**（与 acceptance-it Rev 3 同一构建/日志 `it-rerun2/unit-suite-wp48.log`）。
- 与 acceptance-it Rev 3 互证：IT07 与 AT29 在同一二进制 `26c02d2d…` 上先后独立执行，尾导航/复制/CPU/关闭结论一致。

### R7.4 执行观察（不改变上表判定）

| ID | 级别 | 说明 |
|---|---|---|
| O-48-4 | 观察（合成输入） | 搜索输入框聚焦时合成 **Return 不推进命中**（两次 AT29 运行与两次 IT07 运行一致）；「下一项」按钮正常推进。同 acceptance-it Rev 3 O-48-1。 |
| O-48-5 | 观察（有界性能） | 尾导航触发**有界** ~12s 单核 ~100% 工作量后回落（t≈17–29s 爆发、35.6s 起空闲；旧行为为 ≥75s–360s 无界）；期间关闭请求 0.12s 响应。建议按性能事项跟踪，不构成验收失败。 |
| O-48-6 | 观察（时间量级） | 内容首屏可见时间本机 3.2s–5.2s（wp-47 报告 ≤3s；Rev 1/6 为分钟级未完成），量级一致。 |
| O-48-7 | 观察（取消路径） | 取消后文档未打开，但该文件随后出现在欢迎页「最近阅读」（记录行为）；不影响取消语义与资源状态，供评审知悉。 |

### R7.5 证据卫生与 UNVERIFIED 刷新（Rev 7）

- 全部场景 `pgrep -x paperstack` 无遗留；`xclip` 已清理；`color-scheme=prefer-light`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 零写入（语料生成于 `at-rerun5/inputs/`）；产品路径仅含本任务脚本与报告。
- 无一次性脚本残留：`run-at-rerun5-wp48.sh` 为唯一新增驱动（分节可重跑）；首轮 30s CPU 窗口未覆盖回落，扩窗为 60s 后重跑，两次运行历史保留于 `runs.log`，最终判定采用第二次运行产物。
- UNVERIFIED 清单刷新：R5.6 中「**AT29 11 MiB 简化模式搜索的最终命中计数**」**本次获得证据并关闭**（0/1→1/1 + 尾导航 + 复制 49 B，证据见 R7.2）；R5.6 其余环境/范围受限项（Wayland、抓包级证据、干净安装、WebDriver/tauri-driver、拖放打开、IME、深色主题等）沿用不变；AT30 许可证查看器项沿用 R5.6。

### R7.6 追溯（Rev 7）

- **本任务新增**：`tests/desktop/run-at-rerun5-wp48.sh`、`artifacts/70-verification/evidence/at-rerun5/**`、本修订。
- **上游**：`wp-47-fix3.md` §1–§3；`acceptance-it.md` Rev 2（wp-46，IT07 残余）与 Rev 3（本任务，IT07 关闭）；需求基线 R29；Rev 5 §R5.2 AT29、§R5.6。

## Revision 6（2026-10-08，wp-46-itrerun：wp-45 修复影响面的 AT 复跑）

> Rev 1–5 原样保留为历史；本节为 wp-45（D-IT-1/2/3 修复，提交 `f8e4dae` 并入 `3a14102`）后**受影响 AT 子项**在当前树 release 二进制上的复跑证据与**最新判定**；冲突时以 Rev 6 为准。复跑对象为**当前树重建的 release 二进制**（`cb79a82`），**不是** Rev 5 的 `054040ba…`（其构建早于 wp-45，`output/*.deb` 亦然）。未复跑项沿用 Rev 5 判定（wp-45 未触及相应代码路径）。

### R6.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`it-rerun/build.log`：`Finished release profile [optimized] target(s) in 45.21s`；`BUILD_EXIT=0`） |
| 二进制 | `src-tauri/target/release/paperstack`；28,104,136 B；mtime 2026-10-08 02:53:33 +0800 |
| 二进制 SHA-256 | `ee21ad20ff190ef6c4fceb6d0e2314394009e2c75a127f4697e016d282c404a7`（`at-rerun4/app-binary.txt`；与 IT Rev 2 同一构建产物） |
| 修订 | `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b`（`task/wp-46-itrerun`；父分支 `feat/v0.1.0`）；`git diff HEAD -- src src-tauri :!**/tests/**` = 空 |
| Pinned 输入 | `acceptance-at.md` Rev 5 `bc5d1160…`、`acceptance-it.md` Rev 1 `7787e69e…`、`wp-45-fix-it.md` `76b74260…` 与 handoff 一致；`config/git-policy.json` `3b8ddffd…`（只读未改） |
| 会话/固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light`；`text-scaling-factor=1.25`；数据隔离于 `at-rerun4/data`，各节 `XDG_CACHE_HOME` 独立 |
| 驱动 | `tests/desktop/run-at-rerun-wp46.sh`（分节 `at15\|at21\|at22\|at29\|all`；沿用 `acceptance-lib.sh`；不改动历史脚本 `run-at-rerun4.sh`） |
| 证据目录 | `artifacts/70-verification/evidence/at-rerun4/`：PNG + `runs.log` + 剪贴板字节文件 |

### R6.2 复跑矩阵（旧 → 新判定）

| AT | Rev 5 | Rev 6 | 复跑操作 | 关键证据（`at-rerun4/`） |
|---|---|---|---|---|
| **AT15** | PASS | **PASS** | links.md：#duplicate-标题 跳转、缺失 fragment→「未找到该标题。」提示、页内 #more-links 跳转（未改动路径的抽查）；D-IT-1 影响面：新输入复跑非 ASCII 跨文件链接 `[中文名文档](./中文文档.md)` 与百分号编码空格目标 `[带 空格 文档](./带%20空格%20文档.md)`——**两者均真实打开目标**（标题+正文剪贴板字节核对）；Rev 5 的脚注链未复跑（wp-45 未触及，沿用 R5 判定） | `at15-r5-b-fragment-jump.png`、`at15-r5-c-missing-fragment-notice.png`、`at15-r5-d-page-internal-jump.png`、`at15-r5-f-cjk-opened-try1.png`、`at15-r5-h-space-opened-try1.png`、`at15-r5-cjk-clip-try1.txt`、`at15-r5-space-clip-try1.txt` |
| **AT21** | PASS | **PASS** | append v2→横幅→「现在更新」→内容 v2；**替换保存 v3（copyfile+os.replace）→ t≈0.8s 直接出现正常更新横幅**（无「找不到原文件」/unavailable）→「稍后」→折叠条+徽标→重开→「现在更新」→阅读含替换标记 | `at21-r5-b-banner-append.png`、`at21-r5-c-updated-v2.png`、`at21-r5-d-replace-fast.png`、`at21-r5-e-replace-banner.png`、`at21-r5-f-later-collapsed.png`、`at21-r5-h-updated-v3.png`、`at21-r5-reading-v3-clip.txt`（含 R5-REPLACE） |
| **AT22** | PASS | **PASS** | 150 ms 原地快速写入 A/B→合并为单候选→「现在更新」→RAPID-B、无回退；**150 ms 快速替换保存 C/D→直接更新横幅→「现在更新」**→终态含 **RAPID-B + RAPID-D、无 RAPID-C** | `at22-r5-a-rapid-banner.png`、`at22-r5-b/c-update-t1/t4.png`、`at22-r5-d-replace-banner.png`、`at22-r5-e/f`、`at22-r5-reading-clip.txt` |
| **AT29** | PASS（R5.6：11 MiB 搜索最终计数 UNVERIFIED） | **PASS（子项 FAIL 保留）** | 11 MiB → 大文档对话框 → 选择「简化阅读」（徽标+范围说明横幅）；尾段唯一探针 `段落 132144` 返回**最终命中数 1**（R5.6 计数项**本次关闭**）；但「下一项」/Return 在 2s 观察窗内**未推进**到命中（计数停在 0/1、视图未滚动至尾部），随后输入处理随主线程饱和变得不稳定（同 D-IT-3 残余，见 acceptance-it Rev 2 IT07）；52 MiB → 源码分段视图正常（启动到窗口 2815 ms、RSS 181,732 KB、横幅「文件超过本版全量处理上限…」） | `at29-r5-a-dialog.png`、`at29-r5-b-simplified.png`、`at29-r5-c-tail-search.png`、`at29-r5-d-tail-next.png`（0/1 计数+预览）、`at29-r5-e-tail-return.png`、`at29-r5-f-52mib-source.png`、`runs.log` |

### R6.3 汇总（Rev 6：4 项复跑刷新 + 26 项沿用）

| 判定 | 数量 | AT |
|---|---|---|
| **PASS** | **30** | 01–30（Rev 5 的 26 项判定沿用 + 4 项复跑刷新） |
| **FAIL（整体）** | **0** | — |
| **子项 FAIL 保留** | **1** | **AT29：11 MiB 简化阅读的尾命中导航/复制不可达**（D-IT-3 残余：解析/索引/首屏已被 wp-45 修复，超大 block 数的渐进挂载/渲染主线程仍饱和——与 acceptance-it Rev 2 IT07 同源证据；按既有缺陷路由，不隐瞒） |
| **UNVERIFIED（整体）** | **0** | —（R5.6 的 AT29 计数项本次关闭；其余环境受限项见 R6.5） |

- 前向套件：`pnpm test -- --run` → **Test Files 72 passed; Tests 568 passed; 0 failed**（`it-rerun/unit-suite-itrerun.log`；与 wp-45 §3.2 期望 568 一致）。
- **口径说明**：Rev 6 是 wp-45 影响面的定向复跑，**不替代** Rev 5 的全量 AT01–AT30 同树刷新；AT29 的「子项 FAIL 保留」是对 R29「简化模式……搜索与复制完整可用」的诚实标记（Rev 5 该子项为流程受限的 UNVERIFIED，本次已取得可复跑的失败证据）。

### R6.4 观察（不改变上表判定）

| ID | 级别 | 说明 |
|---|---|---|
| O-46-3 | 观察（主线程饱和） | AT29/IT07 的 11 MiB 实例：WM 关闭请求 8s 超时后由 SIGTERM 兜底终止；与渐进挂载持续占用主线程一致（参见 acceptance-it Rev 2 R2.4 O-46-2）。 |
| O-46-4 | 观察（既有缺陷） | O-IT-2（2 MiB 复杂度提示重现）两报告均仍开放；本次预跑探针在 2 MiB 语料再次观察到（探针未纳入证据目录），11 MiB 尺寸型提示未复现。 |

### R6.5 证据卫生与 UNVERIFIED（Rev 6）

- 每次场景结束 `pgrep -x paperstack` 无遗留；`xclip` 已清理；`color-scheme=prefer-dark`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 零写入（新增输入样张均在 `at-rerun4/inputs/` 生成）。
- 脚本：`tests/desktop/run-at-rerun-wp46.sh` 为唯一新增可复现驱动（分节可重跑）；无一次性脚本残留。
- UNVERIFIED 清单刷新：R5.6 中「AT29 11 MiB 简化模式搜索的最终命中计数」**本次获得证据并关闭**（计数 1）；R5.6 其余环境/范围受限项（Wayland、抓包级证据、干净安装、WebDriver、拖放打开等）沿用不变。新增子项 FAIL 见 R6.3，不再以 UNVERIFIED 表述。

## Revision 5（2026-10-08，wp-42-atrefresh：全量 AT01–AT30 同树刷新）

> 本节为 wp-42（系统验证 §7.4 G-01 条件 C1）的**全量同树刷新**：30/30 项均在**唯一记录的 release 二进制**上重新执行并判定，取代 Rev 1–4 的结转判定。判据口径同 §3（真实应用 + 脚本输入 + 截图/SQLite/哈希/字节级核对，不以脚本退出码代替核对）。本任务未修改任何产品代码：`git diff 5d977ea..HEAD -- src src-tauri`（排除 tests）为空，产品树与 Rev 4 二进制构建修订一致。
> **Rev 5 对发布目的的效力：此前各修订的 AT 判定全部被 Rev 5 的 30 项现行判定替代**（Rev 1–4 章节原样保留，仅作历史与追溯）。

### R5.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`at-final/build.log`：`Finished release profile [optimized] target(s) in 1m 15s`，`build exit=0`，墙钟 100 s） |
| 二进制 | `src-tauri/target/release/paperstack`；32,318,216 bytes；mtime 2026-10-07 23:47:18 +0800 |
| 二进制 SHA-256 | `054040bae1d6b041e184cf545a55e70ba150894cb1caeba4cfacbeef89ce1d9e`（`at-final/app-binary.sha256`；与 Rev 4 二进制逐字节相同——5d977ea 后产品代码未变、前端构建确定，故同一构建产物；**本修订的全部 30 项判定均产生自该哈希**，`wrapper.log` 每段结束重复记录哈希） |
| 修订 | `49f48baf336116a9ecc99545f6e02e11702c75b0`（`task/wp-42-atrefresh`；父分支 `feat/v0.1.0`）；`git diff 5d977ea..HEAD -- src src-tauri :!**/tests/**` = 空 |
| Pinned 输入 | 4 份输入 SHA-256 与 `state/handoffs/wp-42-atrefresh.json` 逐一比对一致（`acceptance-at.md` Rev 4 `e096dad4…`、`system-verification.md` `bc655b13…`、`wp-36a` `89c769b5…`、`wp-35a` `f54c156b…`）；`config/git-policy.json` = `3b8ddffd…` 一致（只读未改） |
| 会话/固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `color-scheme=prefer-light`；`text-scaling-factor=1.25`；应用数据隔离于 `at-final/data`，各节缓存另行隔离于 `at-final/cache*`（`XDG_CACHE_HOME`） |
| 驱动脚本 | `run-at-final.sh`（批驱动：core a–e → rerun2 → wp34d at19/26/28 → wp38 at02…at30）；`run-at-final-probes.sh`（AT11/21 补充）；`run-at-final-probes2.sh`（干净会话定向补测 AT01/04/05/08/11/17/29）——全部沿用 `acceptance-lib.sh`，分节可重跑 |
| 证据目录 | `artifacts/70-verification/evidence/at-final/`：340 张 PNG + `runs.log`（5242 行）+ `build.log`、`app-binary.sha256`、`wrapper.log`、`unit-suite-r5.log`、`unit-suite-r5-retry.log`、`at30-r4-placeholder-scan.txt`、`inputs/`、`superseded/`（12 个归档文件，见 R5.5） |

### R5.2 全量矩阵（Rev 5 判定，全部产生自 `054040ba…`）

| AT | 判定 | 证据与要点（`at-final/` 内） |
|---|---|---|
| **AT01** | **PASS** | `at01-a`（无参数欢迎页）、`b`（CLI 打开）、`c`（第二实例新增并激活标签）、`d`（同路径复用标签）、`e`（大小写不敏感扩展名）、`f`（无效路径 `PS_IO_NOT_FOUND`、既有标签不变；整屏回退，见 R5.5）、`k/l`（批量 2 文件按序、首个获焦）；选择器链：`at01-fp-b`（**键盘确认打开 tables.md**）、`at01-fp-c/d`（再次打开→Escape 取消，状态不变） |
| **AT02** | **PASS** | `at02-r4-a`（根 7 行，`link-broken`「已缺失」、`link-outside`「链接指向授权范围之外」行内标签）、`c`（sub→deep 展开）、`d`（打开 c.md）、`e/f`（符号链接状态行）、`h`（空目录「此目录为空。」）、`i`（不可读目录 `PS_IO_PERMISSION` 横幅）；core `at02-a…i` 备用 |
| **AT03** | **PASS** | `at03-a`（BOM 无字形）、`b`（emoji/组合字符）、`c`（「文档为空」）、`d`（CRLF）、`e`（`.mdx`→`PS_FMT_UNSUPPORTED`）、`f`（Latin-1）、`g`（二进制）→ `PS_ENC_UNSUPPORTED`；错误态均保留原文档 |
| **AT04** | **PASS** | `at04-hash-diff.txt` **四段 `IDENTICAL`**（fixtures/副本 哈希与文件清单，零写入）；`at04-a/b`（滚动、会话内搜索）；`at04-fp-a/b/c` + `at04-fp-source-diff.txt`（edge-cases 任务复选框点击前后一致、源文件 IDENTICAL——只读不可翻转） |
| **AT05** | **PASS** | `at05-fp-a`（干净 3 标签 math/code/tables）、`b/c`（Ctrl+Tab 切换）、`d`（关闭第三个）；**MRU 决定性**：`at05-fp2-b`（math 激活）→ `at05-fp2-c`（关 math 后 **tables 激活**，右邻回退会得到 code） |
| **AT06** | **PASS** | `at06-r4-a…g`（2 标签→激活 tables→干净退出→无参数重启恢复顺序/激活；偏好关→欢迎页 + 最近阅读列出两文档）；`at06-r4-h…l`（A-01 链：显式打开建 1 持久授权→撤销→退出→重启标签不可用 + `PS_AUTH_REVOKED`→重试仍拒）；`runs.log` DB：`session_tabs=2/recents=2`、grants `1→0→0`、`startup.restoreSession=false` |
| **AT07** | **PASS** | `at07-r2-b`（「找不到原文件。保留了已加载内容…」+ 重新定位/重试/关闭标签）、`c`（重试仍缺→横幅保留）、`d`（重试恢复→横幅消失）、`g`（重新定位同字节→「已重新关联同一文件，恢复原文档身份。」）、`i`（关闭→欢迎页） |
| **AT08** | **PASS** | `at08-fp-a`（技术文档模式：删除线/公式渲染）、`b`（语法设置）、`c`（**标准 Markdown：`~~删除线~~` 与 `$E=mc^2$`/`$x_{i+1}$` 按原文显示**）；core `at08-a…d` 备用 |
| **AT09** | **PASS** | `at09-r4-b`（越界图片占位、style/javascript:/data:/vbscript: 惰性文本）、`d`（宏炸弹仅本公式回退；50 节点 Mermaid 上限；复选框禁用）、`g`（**D-3 移除后 KaTeX 数学实际渲染**、script 无痕）；core `at09-b…f` 备用；全程无弹窗/外部进程 |
| **AT10** | **PASS** | `at10-a/b`（行内/块公式与宽公式渲染）、`c`（关闭行内美元公式）、`d`（`$…$` 按原文、`$$` 块公式不受影响） |
| **AT11** | **PASS** | `at11-clipboard-c.txt` = `int main(void) { return 0; }\n`（29 B）；`at11-fp2-clip-c.txt` 29 B、`at11-fp2-clip-cpp.txt` = `auto answer = 42; // C++\n`（25 B）；`at11-fp3-clip-fold.txt` = **450 B / 45 行**（`# line 01…45`，折叠状态复制不截断）；`at11-c`（首块动作条）、`at11-d`（折叠块视图） |
| **AT12** | **PASS** | `at12-r4-a/c`（flowchart/class 实际渲染 SVG）、`d`（语法错误局部回退 + pie 不支持说明）、`f`（放大覆盖层渲染、控件齐全）、`g`（关闭）；注入点均经唯一受信封装（`single-trusted-html-entry` 2/2） |
| **AT13** | **PASS** | `at13-b`（缺失/越界/遍历/file:/remote 占位文案 + 相对路径）、`at13-d/e`（允许本次读取→**本地图片实际显示**）、`at13-g`（8 列宽表完整，单元格无损） |
| **AT14** | **PASS** | `at14-r4-b`（大纲含「Duplicate 标题 (1)/(2)」）、`d`（点 (1) 滚动至第一处）、`e`（点 (2) 至第二处，两目标可区分） |
| **AT15** | **PASS** | `at15-r4-b`（`#fragment` 跳转成功）、`c`（缺失 fragment→「未找到该标题。」、位置不动）；脚注链 `f/g`（引用¹→脚注区→第一个 ↩ 返回第一处引用）、`h/i`（第二引用→↩² 返回第二处引用）；`at15-r2-*` 补充 |
| **AT16** | **PASS** | `at16-r4-b`（引用→脚注）、`c`（Alt+← 返回引用处 +「已恢复阅读位置」）、`d`（Alt+→ 前进回脚注）、`e/f`（第二引用→Alt+← 返回）；无错误横幅 |
| **AT17** | **PASS** | `at17-fp-b`（「中文」命中）、`c`（「SECRET」不区分大小写 **3** 命中）、`d`（勾选区分大小写 **1** 命中）、`e`（折叠代码块「line 45」命中，预览 `# line 43 # line 44 # line 45`）；core `at17-e/f`（公式源码匹配、零结果提示） |
| **AT18** | **PASS** | `at18-b`（源码·只读、行号、无可编辑态）、`at18-c`（返回阅读恢复正文） |
| **AT19** | **PASS** | `at19-r3-e`（同版本恢复、静默、滚动到位）、`f`（跨版本精确→「已恢复阅读位置」）、`g`（标题/祖先回退→「文档已更新，已恢复到相近章节」+ 视口滚入改写区块）、`i`（top 回退近似）；`runs.log` DB：`positions=1`、`display.fontSizePx=22` |
| **AT20** | **PASS** | `at20-a`（1600×900：面板并排、正文右移）、`b`（1024×640：面板覆盖层）、`c`（恢复）；面板互斥见 `at02-*`/`at14-*` |
| **AT21** | **PASS** | `at21-a…d`（v1→外部写入→非模态横幅 +「有新版本」徽标→「现在更新」→内容更新、结构保留→再次写入再出横幅）；`at21-fp-b/c/e`（第二次横幅→「稍后」→**折叠为「有新版本」条、徽标保留**） |
| **AT22** | **PASS** | `at22-a…c`（150 ms 连续写入合并为单候选；更新后「已更新，位置近似恢复」；t4 展示 **RAPID-B**、无回退） |
| **AT23** | **PASS** | `at23-b`（字号 22/行距 2 即时生效）、`c`（越界 99→「数值超出范围，已保留上一个有效值。」）、`e`（退出重开持久） |
| **AT24** | **PASS** | `at24-a`（未聚焦 skip link 不可见）、`b/c`（Tab 显示「跳到正文」焦点环、Enter 跳转）、`d`（指针点击后 Tab 焦点环仍可见）、`e`（键盘查找）、`f/h`（**200% 缩放**下阅读/搜索可用，随后恢复 1.25） |
| **AT25** | **PASS** | `at25-r4-a`（聚合对话框：范围/1 资源/「记住此目录授权」默认不勾选）、`b`（拒绝→占位保留）、`d/e`（撤销持久文件授权 + notice）、`f0-f3`（清除类别对话框：授权行可勾选、「授权 已清除 2 项」）、`g2/h`（核销后展开新扫描→行内「授权已被撤销…」+ 重试仍拒）、`j`（显式重开→恢复扫描）；grants dump：重开后 1 条 session 目录授权 |
| **AT26** | **PASS** | `at26-r3-a`（阻止对话框正确命名 `https://httpbin.org`）、`b`（占位保持）、`d/e`（允许后**图片真实渲染**）；`at26-r3-sockets-blocked.txt` **0 行**、`sockets-watch.txt` 5 行 ESTAB（→`54.159.186.149:443`）；隔离缓存 `remote-images/c-a2c48c6cdb4fc94f`（8090 B）；`at26-r3-app-log.txt` 0×`command_failed` |
| **AT27** | **PASS** | `at27-r4-a`（隐私计数：最近阅读 2/位置与会话 4/授权 2）、`d/e`（对话框勾选最近阅读+位置与会话+授权）、`f`（结果逐类：2/0/4/2）、`g`（关闭归零）、`h`（重启=欢迎页、无最近记录）；DB dump：`session_tabs=0/recents=0/positions=0/authorizations=0`（写回抑制生效） |
| **AT28** | **PASS** | `at28-r3-c`（预览默认脱敏、`已脱敏 0 处`）、`d`（错误态源目录→**「该位置是受保护的源文件或源目录，请另选位置。」**，0 写入）、`e1/e2/e3`（既存非源目标→覆盖确认→成功，427 B 字节副本）、`f`（新目标直接成功）、`h`（已注册文档场景同样专用拒绝，docs count=1） |
| **AT29** | **PASS** | `at29-a`（11 MiB 对话框）、`c`（简化阅读徽标 + 范围说明）、`e`（52 MiB→源码分段视图「文件超过本版全量处理上限…」）；`runs.log` 启动到窗口 3070 ms、到截图 7317 ms、RSS 记录；`at29-fp-a/b`（简化模式搜索框可用；最终计数见 R5.6） |
| **AT30** | **PASS** | `at30-r4-b`（关于页：名称/0.1.0/Quirkybrain/GPL-3.0-only/GPLv3+离线说明；「获取对应源码」显示**翻译后文案**「未配置对应源码入口；公开发行前必须补齐。」）；`c`（许可证查看器→见 R5.6）；`e/f`（B-04 文档信息面板：编码 utf-8/完整路径/内容版本哈希/资源问题空态/只读，显式关闭回阅读）；`at30-r4-placeholder-scan.txt` 生产源码 **0 命中** |

### R5.3 汇总（Rev 5：全部 30 项现行判定）

| 判定 | 数量 | AT |
|---|---|---|
| **PASS** | **30** | 01–30 |
| **FAIL** | **0** | — |
| **UNVERIFIED（整体）** | **0** | 无（环境受限子项见 R5.6） |

- **G-01 / 条件 C1 达成**：30/30 判定均为现行二进制 `054040ba…`（构建于当前产品树 `49f48ba`，`5d977ea..HEAD` 产品差异为空）上的真实桌面执行，**无任何结转判定**；不复存在“10/30 现行、20/30 结转”的表述。
- 前向套件：`pnpm test -- --run` 首跑（00:11，外部高负载：并行 Qt 编译 + 游戏进程，load ≈20）出现 **3 例 `Test timed out in 5000ms`**（`no-hardcoded-strings` 1 例、`ReaderScreen` AT19 相关 2 例；`unit-suite-r5.log` 原样保留）；**控制重跑**（00:22，load 2.5）→ **71 文件 / 547 passed / 0 failed，EXIT=0**（`unit-suite-r5-retry.log`）。失败归类为**环境性超时**（非断言失败、非产品缺陷），首跑日志保留以如实记录。
- 追溯（Rev 5）：`tests/desktop/run-at-final.sh`、`run-at-final-probes.sh`、`run-at-final-probes2.sh`；`at-final/**`；wp-35a A-01/A-02/A-07/A-08、wp-36a B-02/B-04/B-10 的桌面闭合证据（AT06/25、AT26、AT28、AT09/15/30）。

### R5.4 执行观察（不构成未通过项；判定已按证据取舍）

| ID | 级别 | 说明 |
|---|---|---|
| O-42-1 | 观察（脚本口径） | 会话恢复修复（wp-34a）使经典 a–e 组脚本的“标签页算术”失效：跨 launch 的标签累积导致 AT04/05/08/17 等部分场景点击落点偏移。已由 `run-at-final-probes2.sh` 以 `reset_data` 干净会话逐项重取（AT01/04/05/08/11/17/29），判定采用重取证据。 |
| O-42-2 | 观察（环境） | 桌面期间被并行占用（用户游戏/终端/编译）：`at01-f` 触发整屏回退（内容仍可读，保留）；AT17 首跑部分截图被终端窗口遮挡——已重取；00:10 的 AT11 重试点击被外部窗口拦截——归档 `superseded/at11fp-interference/`，00:20 以 fp2/fp3 重取（29 B/25 B/450 B 全部达成）。 |
| O-42-3 | 观察（文档口径） | AT30 旧链路（`run-at-e` 键盘 Down×3）因 wp-36a B-05 菜单新增「更新行为」而落在「设置」页——旧截图归档 `superseded/legacy-at30-menu/`；判定采用 wp38 `at30-r4-*`（Down×5 至「关于」）。 |
| O-42-4 | 观察（环境时序） | AT29 11 MiB 简化模式搜索：搜索框可用且已启动全文索引（「正在建立全文索引」），8 s 观察窗内未显示最终计数（大文档索引构建）。不构成 FAIL；列入 R5.6。 |
| O-42-5 | 观察（机制交互） | AT25 的目录核销链同 Rev 4 O-38-1：目录「打开」建立 session-scope root（不进持久授权列表），核销经 `clear_records(["authorizations"])` 达成，显式重开作对照。 |
| O-42-6 | 观察（构建） | 本构建与 Rev 4 二进制逐字节相同（`054040ba…`）且产品树自 `5d977ea` 未变——Rev 5 的价值在于**将 30/30 判定全部落在该单一二进制上**并补齐此前的结转缺口，而非新构建差异。 |

### R5.5 证据卫生

- 每次场景结束 `pgrep` 均无遗留 `paperstack`；最终复核 `pgrep -x paperstack`、`xclip` 均无匹配。
- `color-scheme=prefer-dark`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 零残留（`probe-out*`=0、baseline 后新文件=0）；产品路径 `git status` 仅含本任务脚本（未跟踪→已提交）。
- `superseded/`（原始字节保留，避免与最终证据混淆）：`driver-failure-broken-invocation.log`（驱动误调用）、`at01-picker-race/`（AT01 首跑选择器竞态 2 图）、`at11fp-interference/`（AT11 受扰重试 8 文件）、`legacy-at30-menu/`（B-05 前菜单链路 2 图）。
- 脚本：新增 3 个可复现驱动（`run-at-final.sh`、`run-at-final-probes.sh`、`run-at-final-probes2.sh`），分节可重跑；无一次性脚本残留。

### R5.6 明确 UNVERIFIED 清单（Rev 5：仅环境/范围受限项）

| 项 | 原因 / 状态 |
|---|---|
| Wayland 会话（NF10/R30/AT30/IT08 的 Wayland 侧） | 本机仅 X11 `:1`；XTEST/libxdo 不适用（沿用 §6） |
| 抓包级零请求证据（AT26/NF02） | 无 sudo/tcpdump；以进程树 `ss`（阻止态 0 行 + ESTAB 采样 + 缓存/日志）替代（沿用 §6 口径；本轮证据在 `at26-r3-*`） |
| 真正干净系统安装（AT30/IT08）、WebDriver/tauri-driver、拖放打开（AT01）、复制失败路径（AT11）、映射回退文案（AT18）、前进分支清除（AT16）、面板状态记忆（AT20）、2000 条截断/节点级状态（AT02）、横滚实际触发（AT13）、GIF/WebP（AT13）、替换保存/只改图片/关闭标签期间完成任务（AT22）、深色主题/真实输入/IME、200% 完整任务链、NF04–06/NF09 达标结论 | 沿用 §6，不变（组件/集成层覆盖或本机不可执行） |
| AT30 许可证/第三方声明内容查看 | 查看器打开即「找不到文件或资源。」（入口与说明存在；属 wp-41/45 打包范围） |
| AT29 11 MiB 简化模式搜索的最终命中计数 | 观察窗内处于「正在建立全文索引」；搜索框可用、无错误（环境时序；搜索语义由组件/集成层覆盖） |

### R5.7 结论（Rev 5）

AT01–AT30 在唯一记录二进制 `054040ba…`（当前产品树 `49f48ba`）上全量重新执行：**30 PASS / 0 FAIL / 0 整体 UNVERIFIED**；系统验证 §7.4 G-01 的 C1（同树全新桌面判定）达成，Rev 5 取代此前各修订的 AT 判定用于发布判断。本任务未修改任何产品代码；环境受限项与执行观察均如实列明。

## Revision 4（2026-10-07，wp-38-desktop-rerun：wp-35a/wp-36a 评审修正后的桌面复跑）

> Rev 1–3 原样保留为历史；本节为 wp-35a（Rust 安全修正）与 wp-36a（前端/管线修正）并入后的 release 二进制复跑证据与**最新判定**；冲突时以 Rev 4 为准。
> 复跑范围（评审 A §10.3(3) + 评审 B §9.1(3)）：AT02、AT06（含 A-01 新增「撤销后重启不复活」链）、AT09、AT12、AT14、AT15（含 B-02 脚注回引）、AT16、AT25、AT27、AT30（含 B-04 文档信息面板）；另执行全量前端套件与 i18n 守卫。本任务未修改任何产品代码。

### R4.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`at-rerun3/build.log`：`Finished \`release\` profile [optimized] target(s) in 43.15s`；`build.exit`=0） |
| 二进制 | `src-tauri/target/release/paperstack`；32,318,216 bytes；mtime 2026-10-07 22:34:52 +0800 |
| 二进制 SHA-256 | `054040bae1d6b041e184cf545a55e70ba150894cb1caeba4cfacbeef89ce1d9e`（`at-rerun3/app-binary.sha256`；**≠** Rev 1 `748ca730…`、Rev 2 `c077db07…`、Rev 3 `f5542857…`，确认复跑对象为 wp-35a/wp-36a 修正后构建） |
| 修订 | `5d977ea40c0d6bea353412f3b83f1cd0ee1e9b56`（`task/wp-38-desktop-rerun`；父分支 `feat/v0.1.0`；已含 wp-35a、wp-36a 修正并入） |
| Pinned 输入 | 5 份输入（本报告 Rev 3、wp-35a/wp-36a 修复报告、评审 A/B）SHA-256 与 `state/handoffs/wp-38-desktop-rerun.json` 逐一比对一致（只读未改） |
| 会话/固定条件 | 与 Rev 1–3 同口径：X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `color-scheme=prefer-light`；`text-scaling-factor=1.25`；应用数据隔离于 `at-rerun3/data`，各节缓存另行隔离于 `at-rerun3/cache-atNN` |
| 复跑脚本 | `tests/desktop/run-at-rerun-wp38.sh`（分节 `at02\|at06\|at06-revoke\|at09\|at12\|at14\|at15\|at16\|at25\|at27\|at30\|suite\|all`；沿用 `acceptance-lib.sh`，新增 `dump_grants` 只读授权转储） |
| 证据目录 | `artifacts/70-verification/evidence/at-rerun3/`：89 张 PNG + `runs.log`（4046 行）+ `build.log`、`app-binary.sha256`、`unit-suite-r4.log`、`i18n-guard-r4.log`、`at30-r4-placeholder-scan.txt`、`inputs/`（脚注/数学样张为脚本生成于证据目录的输入副本，未改 `fixtures/`；3 张中间迭代截图存于 `superseded/`） |

### R4.2 复跑矩阵（Rev 4 判定）

| AT | 复跑操作（同输入/同固定条件） | 关键证据 | 判定 |
|---|---|---|---|
| **AT02** | 目录选择器打开 `fixtures/tree/root`：根 7 行（含 link-broken「已缺失」、link-outside「链接指向授权范围之外」行内标签）→ 展开 sub→deep → 打开 c.md；空目录 dir2 →「此目录为空。」；不可读目录 → `PS_IO_PERMISSION` 横幅。A-02 授权门之后正常扫描无回归 | `at02-r4-a…i`（c.md 在文件名按钮中激活）；`runs.log` | **PASS** |
| **AT06** | (a) 正常链：math+tables → 激活 tables → 干净退出 → 无参数重启恢复 2 标签/顺序/激活（`session_tabs=2/recents=2`）；偏好关→欢迎页+最近阅读列出两文档。(b) **A-01 新链**：显式打开 doc.md（1 持久授权）→ 设置→隐私→撤销（「授权已被撤销，已停止新的读取。」）→ 退出（DB grants=0）→ 无参数重启：标签**不可用** + 正文 `PS_AUTH_REVOKED`（未静默重授）→ 重试仍被拒（grants 保持 0、无新授权） | `at06-r4-a…l`；`authorizations dump` 3 段（1→0→0）；DB dumps | **PASS** |
| **AT09** | 恶意样张（拒绝本地资源提示后）：`<script>` 整块剥离（无执行、无弹窗）、style/iframe/javascript:/data:/vbscript: 均为惰性文本；宏炸弹仅本公式回退；50 节点 Mermaid 触发上限；复选框不可改。另开「script+数学」样张：`$x^2+y^2=z^2$`、`$\alpha$`、`$$∫…$$` **实际渲染**（D-3 备选移除后 KaTeX 仍工作），script 无痕 | `at09-r4-b…g` | **PASS** |
| **AT12** | flowchart/sequence/class 实际渲染为 SVG；语法错误局部回退（图种/错误摘要/查看源码）；pie 不支持说明；「放大」覆盖层渲染并关闭——两处注入点均经唯一受信封装正常 | `at12-r4-a…g`；静态守卫 `single-trusted-html-entry.test.ts` 2/2 | **PASS** |
| **AT14** | links.md 大纲：点击 Duplicate (1)/(2) 分别滚动至第一/第二处重复标题（两目标可区分） | `at14-r4-a…e` | **PASS** |
| **AT15** | (a) links.md：`#duplicate-标题` 跳转成功且**无**「未找到该标题」；缺失 fragment → 横幅「未找到该标题。」、位置不动；`#more-links` 页内跳转。(b) **B-02 脚注**：同脚注两处引用 → 点引用¹滚动至脚注区（标题本地化「脚注」，无英文 `Footnotes`）→ 点第一个「↩」返回**第一处**引用；点第二引用 →「↩²」返回**第二处**引用；全程无「未找到该标题」 | `at15-r4-a…i` | **PASS** |
| **AT16** | 脚注导航历史：引用¹跳转 → Alt+← 返回引用处（「已恢复阅读位置」）→ Alt+→ 前进回脚注；第二引用跳转 → Alt+← 返回；无错误横幅 | `at16-r4-a…f` | **PASS** |
| **AT25** | 聚合授权对话框（范围/1 资源/「记住此目录授权」默认不勾选）→ 拒绝 → 占位保留；打开目录建立 session root；设置→隐私撤销**持久文件授权**（notice + 列表清空）；**清除记录→授权类别**（对话框可滚动、授权行可勾选、结果「授权 已清除 1 项」）后：展开尚未加载的 `sub` → 行内「授权已被撤销，已停止新的读取。」+重试；重试仍被拒；**对照**：显式重新打开目录后同一重试恢复扫描，DB 出现新的 session 目录授权 | `at25-r4-a…j`；`authorizations dump` | **PASS** |
| **AT27** | 种子（2 文档 + 目录 root）→ 隐私面板计数（最近阅读 2/位置与会话 4/授权 2）→ 清除对话框勾选 最近阅读+位置与会话+**授权** → 结果面板逐类计数（最近阅读 2/位置 0/会话 4/**授权 2**）→ 关闭后计数归零 → 干净退出：`session_tabs=0, recents=0, positions=0, grants=0`（**写回抑制生效**：两个打开标签未回写）→ 重启=欢迎页、无最近记录 | `at27-r4-a…h`；DB dumps + `authorizations dump` | **PASS** |
| **AT30** | 更多→关于：产品/版本 0.1.0/所属者 Quirkybrain/GPL-3.0-only/GPLv3 与离线说明；「获取对应源码」显示**翻译后文案**（无原始 i18n 键，D-34-1 修复保持）；许可证查看器同 Rev 2（「找不到文件或资源。」，属 wp-41/45 既有 UNVERIFIED）；**B-04 新面板**：文件名按钮展开「文档信息」= 编码 utf-8、完整路径正确、内容版本哈希、资源问题空态、只读；显式关闭回阅读；占位扫描（`coming soon/敬请期待/即将推出/建设中/under construction`）生产源码 **0 命中**；更多菜单含 B-05「更新行为」项 | `at30-r4-a…f`、`at30-r4-placeholder-scan.txt` | **PASS** |
| **套件** | `pnpm test -- --run` → **71 文件 / 547 passed / 0 failed**（与 wp-36a 期望 547 一致）；`no-hardcoded-strings`（扩展 i18n 守卫）与 `single-trusted-html-entry` 定向复跑 **6/6** | `unit-suite-r4.log`、`i18n-guard-r4.log` | **PASS** |

### R4.3 汇总（全部 30 项，Rev 4 最新判定）

| 判定 | 数量 | AT | 与 Rev 3 的差异 |
|---|---|---|---|
| **PASS** | **30** | 01–30 | 数量不变；10 项经 wp-35a/wp-36a 修正后二进制桌面复跑 + 全量套件刷新，其余 20 项沿用 Rev 3 |
| **FAIL** | **0** | 无 | 不变 |
| **UNVERIFIED（整体）** | **0** | 无 | 不变 |

- 复跑覆盖 Review A §10.3(3)（AT02/06/25/27）与 Review B §9.1(3)（AT09/12/14/15/16/30）的全部受影响桌面项。
- 修正映射：A-01→AT06 新链；A-02→AT02（正常扫描）+AT25（核销后扫描拒绝与显式重开对照）；B-01→AT12；B-02→AT15/AT16；B-03→AT15 脚注标题；B-04/B-05→AT30；B-09→套件守卫；B-10→AT09 数学渲染。未复跑的 20 项判定沿用 Rev 3（修正未触及；其中 AT19/26/28 属 Rev 3 已覆盖的 wp-34c 范围）。
- 未复跑项明细：01、03、04、05、07、08、10、11、13、17、18、19、20、21、22、23、24、26、28、29（及 Rev 3 的 AT05/17 回归抽查未再执行）。

### R4.4 观察（不构成未通过项）

| ID | 级别 | 说明 |
|---|---|---|
| O-38-1 | 观察（机制交互） | AT25/AT27 的目录授权核销路径：UI「打开目录」建立 **session-scope** root，不进入「持久授权」列表；因此目录扫描拒绝经 `clear_records(["authorizations"])` 取得（A-02 的第二条验收路径），并以「显式重新打开目录→重试恢复」作对照；文件级持久授权的撤销链由 AT06 覆盖。 |
| O-38-2 | 观察（交互） | AT06 撤销后：标签先显示不可用横幅 + `PS_AUTH_REVOKED` 正文与重试/诊断；点击「重试」后横幅切换为错误态视图（重试/诊断保留，正文仍为 `PS_AUTH_REVOKED`），授权计数保持 0——即重试仍不重新授权（与 wp-35a §5.3 的 retry=restore 语义一致）。 |
| O-38-3 | 观察（既有边界） | 「查看许可证」仍显示「找不到文件或资源。」，与 Rev 2 相同；LICENSE/第三方声明打包属 wp-41/45，沿用 §6 既有 UNVERIFIED，不构成回归。 |
| O-38-4 | 观察（菜单变化） | 更多菜单因 B-05 新增「更新行为」项，关于项由第 4 位移至第 5 位（键盘路径 Down×5）；界面与服务端行为正常。 |

### R4.5 证据卫生

- 每次场景结束 `pgrep` 均无遗留 `paperstack`（最终复核 `pgrep -x paperstack` 无匹配）；`color-scheme=prefer-dark`、`text-scaling-factor=1.25` 已恢复。
- `fixtures/` 无写入/残留（本任务输入样张均生成于 `at-rerun3/inputs/`）；`at02/noperm` 已恢复 755；产品路径 `git status` 干净（仅新增复跑脚本）。
- 中间迭代的 3 张过期截图移至 `at-rerun3/superseded/`（保留原始字节，避免与最终证据混淆）。
- 脚本：`tests/desktop/run-at-rerun-wp38.sh` 为唯一新增的可复现驱动（分节可重跑）；无一次性脚本残留。

### R4.6 明确 UNVERIFIED 清单（Rev 4 刷新；未列出条目沿用 §6）

| 项 | 原因 / 状态 |
|---|---|
| ~~撤销后重启不复活（A-01 桌面链）~~ | **本次关闭**：`at06-r4-h…l`（撤销→重启→不可用+`PS_AUTH_REVOKED`→重试仍拒），授权计数保持 0 |
| ~~目录授权核销后的扫描拒绝（A-02 桌面链）~~ | **本次关闭**：`at25-r4-h/i`（核销后展开拒绝+重试拒绝）与 `at25-r4-j`（显式重开恢复扫描） |
| Wayland 会话；抓包级零请求证据；真正干净系统安装；WebDriver/tauri-driver；拖放打开；复制失败路径；映射回退文案；前进分支清除；面板状态记忆；2000 条截断/节点级状态；横滚实际触发；GIF/WebP；替换保存；深色主题/真实输入/IME；200% 完整任务链；NF04–06/NF09 达标结论；LICENSE/第三方声明包内可得性与对应源码入口 | 沿用 §6，不变 |
| 许可证/第三方声明内容查看（AT30） | 查看器打开即「找不到文件或资源。」，与 Rev 2 相同；属 wp-41/45 |

- **追溯（Rev 4）**：`tests/desktop/run-at-rerun-wp38.sh`、`at-rerun3/**`；wp-35a §2.1（A-01）、§2.2（A-02）；wp-36a §2.1（B-01）、§2.2（B-02）、§2.3（B-03）、§2.4（B-04）、§2.5（B-05）、§2.7（B-10）；Review A §10.3；Review B §9.1。

## Revision 3（2026-10-07，wp-34d-rerun：wp-34c 修正后残留项复跑）

> Rev 1 §1–§10 与 Rev 2 原样保留为历史；本节为 wp-34c 修正后 release 二进制的复跑证据与**最新判定**；冲突时以 Rev 3 为准。
> 复跑范围：Rev 2 的 3 个 FAIL（AT19/26/28）+ 回归抽查（AT05/17）；其余 27 项（Rev 2 PASS）未重新执行，判定沿用 Rev 2。本任务未修改任何产品代码。

### R3.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`build.log`：`Finished release profile … in 49.45s`，`BUILD_EXIT=0`） |
| 二进制 | `src-tauri/target/release/paperstack`；32,291,296 bytes；mtime 2026-10-07 20:47 +0800 |
| 二进制 SHA-256 | `f55428573498851199465cd5040424a132640cf19e7c483aa5a7fb326d5431ce`（`at-rerun2/app-binary.sha256`；**≠** Rev 2 的 `c077db07…5cd269`，确认复跑对象为 wp-34c 修正后构建） |
| 修订 | `f6e560802e8c3964a60594a7cd020afc20f91a56`（`task/wp-34d-rerun`；含 `dba385a` wp-34c 修正并入） |
| 会话/固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `color-scheme=prefer-light`；`text-scaling-factor=1.25`；应用数据隔离于 `at-rerun2/data`，缓存另行隔离于 `at-rerun2/cache*`（`XDG_CACHE_HOME`，不影响被验行为） |
| 复跑脚本 | `tests/desktop/run-at-rerun-wp34d.sh`（wp-34d 统一复跑驱动，`at19|at26|at28|regression|all`）；工具 `find-gtk-accept.py`、新增 `find-app-button.py` |
| 证据目录 | `artifacts/70-verification/evidence/at-rerun2/`：截图、`runs.log`、`build.log`、`app-binary.sha256`、socket 快照、AT26 缓存副本、AT28 导出字节副本、`unit-suite-r3.log` |

### R3.2 复跑矩阵（旧判定 → 新判定）

| AT | Rev 2 | Rev 3 | 复跑操作（与 wp-34b 同输入/同环境） | 关键新证据 |
|---|---|---|---|---|
| **AT19** | FAIL（部分修复） | **PASS** | 字号 17→22 后退出、无参数重启（同版本）；追加重启（跨版本精确）；改写锚点块重启（标题/祖先回退近似）；全标题改写重启（top 回退对照） | `at19-r3-e`（同版本块级位置恢复、静默）；`f`（精确→「已恢复阅读位置」）；`g`（近似→「文档已更新，已恢复到相近章节」，且视口滚入恢复区块，落点为记录锚点段落、受信标题「数学公式」在其上方；修复前对照 Rev 2 `at19-r2-g` 为静默停在文首、无任何标签）；`i`（top 回退→近似标签+文首）；`runs.log` DB：`display.fontSizePx=22` 与 4 次 `positions` 记录（含 v3 指纹 `fp1:f2c391…`、`source_range 313–346`） |
| **AT26** | FAIL（部分修复） | **PASS** | 带路径真实图片 URL（`https://httpbin.org/image/png`）默认阻止→0 请求；「本次文档允许加载」→受控取图 | `at26-r3-a`（阻止对话框正确命名 `https://httpbin.org`）；`b`（占位符）；`at26-r3-sockets-blocked.txt` **0 行**；`at26-r3-sockets-watch.txt` 捕获应用进程至 `3.210.105.125:443` 的 ESTAB（取图调用**实际发起**）；隔离缓存 `remote-images/c-a2c48c6cdb4fc94f`（8090 B PNG）+ `at26-r3-cache-meta.txt`（cache_meta 行）；`at26-r3-app-log.txt` 0×`command_failed`；`d/e`（图片真实渲染） |
| **AT28** | FAIL（部分修复） | **PASS** | 错误态主文档导出到源目录；既有非源目标重复导出→覆盖确认→成功；全新非源目标→直接成功；已注册文档源目录→专用拒绝 | `at28-r3-d`（「该位置是受保护的源文件或源目录，请另选位置。」，**非**覆盖询问；`probe-out.txt.*` 0 个）；`e1`（首次非源导出成功）→`e2`（「目标文件已存在，是否覆盖？」+取消/确定）→`e3`（点「确定」后成功覆盖 427 B）；`at28-r3-a2-overwritten-export.txt`（覆盖后字节副本）；`f`（非源新目标直接成功；`at28-r3-caseB-export.txt`）；`h`（已注册文档场景同样专用拒绝，documents count=1） |
| AT05（回归） | PASS | **PASS** | 3 标签、Ctrl+Tab、关闭、MRU | `at05-r3-a`（3 标签）；`at05-r3-f`（关闭当前后 MRU 选中 code.md） |
| AT17（回归） | PASS | **PASS** | 中文/SECRET/零结果检索 | `at17-r3-b`、`c`、`d`（0/0+「未在当前正文中找到 · 可切换到源码查找」） |

### R3.3 汇总（全部 30 项，Rev 3 最新判定）

| 判定 | 数量 | AT | 与 Rev 2 的差异 |
|---|---|---|---|
| **PASS** | **30** | 01–30 | +3（AT19/26/28 修正生效；Rev 2 的 27 项沿用） |
| **FAIL** | **0** | 无 | −3 |
| **UNVERIFIED（整体）** | **0** | 无 | 不变 |

- 前向测试基线复核（本分支最终修订）：`pnpm test -- --run` → **Test Files 69 passed; Tests 529 passed**（与 wp-34c 修复报告一致；预期 529；`at-rerun2/unit-suite-r3.log`）。
- 回归抽查 AT05/17 在修正后二进制上通过；未复跑的 27 项判定沿用 Rev 2（wp-34c 仅改动位置恢复消费、远程取图与诊断导出三条路径及其测试）。
- 缺陷收敛：Rev 1 的 D-34-1…7 与 Rev 2 的 D-34b-1…3 均有修复映射（`artifacts/60-implementation/wp-34c-fixes.md`）并在 release 桌面复跑中取得通过证据。

### R3.4 观察（不构成未通过项）

| ID | 级别 | 说明 |
|---|---|---|
| O-34d-1 | 观察（机制交互） | AT19 标题/祖先回退近似恢复：修复已使非空 blockId 的近似恢复消费生效（滚动入恢复区块 + `nav.return.approx`，`at19-r3-g`）。因 AT19 同时持久化了字号变更，启动时设置载入触发单次布局稳定化校正（INV-AR-05），视口最终稳定在**记录的锚点段落**（改写后的「块公式」段落）而非标题行本身；受信标题「数学公式」位于其上方。修复前为静默停在文首且无标签。该交互不改变 D-34b-1 的修复判定，供评审参考。 |
| O-34d-2 | 观察（测试环境） | GTK 保存对话框会对位置栏输入的文件名追加扩展名（实测 `probe-out.txt` → `probe-out.txt.txt`、`out-existing.txt` → `out-existing.txt.md`/`.txt` 不等），应用按对话框返回的路径处理。AT28 的「目标已存在」路径通过重复导出同一输入复现（`at28-r3-a2-*`）。属测试环境行为，非产品缺陷。 |

### R3.5 方法、对照与证据卫生

- **AT26 取图证据链**：默认阻止 0 socket → 允许点击后 10 s 内以 0.1 s 间隔采样应用进程树 TCP 连接（捕获 `pid=…` 至 `3.210.105.125:443` 的 ESTAB 及 1 行保活）→ 隔离缓存出现 8090 B 的 `remote-images/` PNG 且 `cache_meta` 有对应行 → 截图显示图片实际渲染，应用日志 0×`command_failed`。仍未使用 tcpdump（无权限），与 §6 口径一致（socket 级替代）。
- **AT28 服务端语义**：`PS_IO_EXPORT_BLOCKED` 以 `details.reason` 区分受保护源（`protected-source`）与已存在目标（`target-exists`）；前端分别呈现专用说明与覆盖确认。错误态源目录导出修订前后均 0 写入，本次差异为**用户可见说明正确**（组件层用例见 wp-34c；本任务为 release 桌面证据）。
- **AT19 数据层**：`runs.log` 含 8 次只读 DB 转储（settings/positions/session/recents/documents），覆盖字号持久化与各阶段位置记录。
- **收尾核验**：全部场景 `pgrep` 无遗留 `paperstack` 进程；`color-scheme=prefer-dark`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 无 `probe-out*` 残留（`find`=0）；产品路径 `git status` 干净。
- **脚本合并**：wp-34d 的临时 `run-at-rerun5..8.sh` 已合并为 `run-at-rerun-wp34d.sh`（分节可选执行），并新增 `find-app-button.py`（按设计令牌颜色定位应用内按钮）；`run-at-rerun{1,1b,2,3,3b,4}.sh`（wp-34b）保留为历史。

### R3.6 明确 UNVERIFIED 清单（Rev 3 刷新；未列出条目沿用 §6）

| 项 | 原因 / 状态 |
|---|---|
| Wayland 会话（NF10/R30/AT30/IT08 的 Wayland 侧） | 本机仅 X11 `:1`；XTEST/libxdo 不适用（沿用 §6） |
| 抓包级零请求证据（AT26/NF02） | 无 sudo/tcpdump；以进程树 `ss`（阻止态 0 行 + 取图连接采样）替代（沿用 §6） |
| 真正干净系统安装（AT30/IT08）、WebDriver/tauri-driver、拖放打开、复制失败路径、映射回退文案、前进分支清除、面板状态记忆、目录 2000 条截断/节点级“无权限、越界”状态、横滚实际触发、GIF/WebP、替换保存、深色主题/真实输入/IME、200% 完整任务链、NF04–NF06/NF09 达标结论、LICENSE/第三方声明包内可得性与对应源码入口 | 沿用 §6，不变 |
| ~~已注册文档下的导出保护拒绝（AT28）~~ | **本次关闭**：`at28-r3-h` 在 release 上取得专用拒绝界面证据（0 写入，documents count=1）；Rev 1 §6 该项不再列为 UNVERIFIED |

## Revision 2（2026-10-07，wp-34b-atrerun：修正项复跑）

> Rev 1 的 §1–§10 原样保留为历史记录（其判定针对修正前的 Rev 1 二进制）。本节为 wp-34a 修正后的 release 二进制的复跑证据与**最新判定**；两者冲突时以 Rev 2 为准。
> 复跑范围：8 个 Rev 1 FAIL 项（AT06/07/14/15/19/26/28/30）+ 2 个回归抽查项（AT05/17）；其余 20 项（Rev 1 PASS）未重新执行，判定沿用 Rev 1。本任务未修改任何产品代码。

### R2.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`beforeBuildCommand = pnpm build`；`build.log`：`Finished release profile … in 39.28s`，总墙钟 46.1s，`BUILD_EXIT=0`） |
| 二进制 | `src-tauri/target/release/paperstack`；32,275,536 bytes；mtime 2026-10-07 19:54 +0800 |
| 二进制 SHA-256 | `c077db0780d85d1d73065042ab75d16a156ec40deb07b39b93f109c5475cd269`（`at-rerun/app-binary.sha256`；**≠** Rev 1 的 `748ca730…257d7b7`，确认复跑对象为 wp-34a 修正后构建） |
| 修订 | `33dd600fdf12c3a90b80e4589b856e9e348b8bd6`（`task/wp-34b-atrerun`；含 `adf805b` wp-34a 修正并入） |
| 会话/固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `color-scheme=prefer-light`；`text-scaling-factor=1.25`；应用数据隔离于 `at-rerun/data`（与 Rev 1 同口径） |
| 复跑脚本 | `tests/desktop/run-at-rerun{1,1b,2,3,3b,4}.sh` + `acceptance-lib.sh` 扩展（`AT_EVIDENCE` 覆盖、`db_dump` 记录转储；3b 为 AT28 服务器日志补充探针）；全部命令/退出码见 `at-rerun/runs.log`（1194 行） |
| 证据目录 | `artifacts/70-verification/evidence/at-rerun/`：78 张 PNG + `runs.log`、`app.log`、`build.log`、`app-binary.sha256`、socket 快照、`at28-r2-caseA-server-log.txt` |

### R2.2 复跑矩阵（旧判定 → 新判定）

| AT | Rev 1 | Rev 2 | 复跑操作（与 Rev 1 同输入/同环境） | 关键新证据 |
|---|---|---|---|---|
| **AT06** | FAIL | **PASS** | 全新数据：打开 math.md+tables.md、激活 tables、干净退出 → 无参数重启；随后关闭偏好再重启 | `at06-r2-c-restored-session.png`（2 标签、顺序 math→tables、激活 tables=重启前状态）；`at06-r2-f-pref-toggled-off.png`（切换为未勾选）+ `at06-r2-g-pref-off-welcome-recents.png`（欢迎页、未恢复、最近阅读列出两文档）；DB：`session_tabs=2/recents=2/startup.restoreSession=false` |
| **AT07** | FAIL | **PASS** | 会话中 `rm` 源文件；观察横幅与三动作；重试（缺失→恢复）；重新定位；关闭标签 | `at07-r2-b`（「找不到原文件。保留了已加载内容…」+ **重新定位/重试/关闭标签**，正文完整）；`c`（重试仍缺文件→横幅保留）；`d`（重试成功后横幅消失、正文可读）；`g`（重新定位同字节→「已重新关联同一文件…」）；`i`（关闭标签→欢迎页） |
| **AT14** | FAIL | **PASS** | links.md 大纲点击「Duplicate 标题 (1)/(2)」 | `at14-r2-d`（点击 (1) 后第一处重复标题置顶）、`at14-r2-e`（点击 (2) 后第二处置顶）——真实滚动，两目标可区分 |
| **AT15** | FAIL | **PASS** | 正文 `#fragment` 跳转、缺失 fragment、跨文件相对链接、Alt+← | `at15-r2-e`（`#duplicate-标题` 跳转成功）；`f`（缺失 fragment→横幅「未找到该标题。」且位置不动）；`b`（跨文件同标签导航仍正常）；`c`（Alt+← 返回并「已恢复阅读位置」）；`g`（`#more-links` 跳转至文档末尾最大滚动位置，目标可见） |
| **AT19** | FAIL | **FAIL（部分修复）** | 字号 17→22 后退出重启；同版本恢复；追加重启（精确）；改写锚点块重启（近似）；另跑 top 回退对照 | `d`（字号 22 同块保留）+ DB `display.fontSizePx=22`；`e`（同版本精确、静默、滚动到位）；`f`（跨版本精确→「已恢复阅读位置」）；**`g`（标题/祖先回退的近似恢复：不滚动、无标签——新缺陷 D-34b-1）**；`i`（对照：top 回退→「文档已更新，已恢复到相近章节」正常） |
| **AT26** | FAIL | **FAIL（部分修复）** | 带路径真实图片 URL（`https://httpbin.org/image/png`，curl 200）；阻止→占位符→确认→本次允许 | `a`（占位符「已阻止远程图片 / 相对路径：…/image/png」+ 确认对话框命名 `https://httpbin.org`——**分类缺陷已修**）；`b`（保持阻止后占位符）；默认 0 socket；**`d`（允许后「图片加载失败」，`fetch_remote_image` 从未发起——新缺陷 D-34b-2）** |
| **AT28** | FAIL | **FAIL（部分修复）** | 错误态主文档导出到源目录（含覆盖确认路径）；非源目标；已注册文档场景 | `d/d2/d3`（**0 文件写入**，但 UI 先误报「目标文件已存在，是否覆盖？」、确认后「保存失败」——新缺陷 D-34b-3）；`at28-r2-caseA-server-log.txt`（补充探针：2×`PS_IO_EXPORT_BLOCKED`，再次确认服务端两次拒绝）；`e`（非源目标写入成功）；`h`（已注册文档：正确显示「该位置是受保护的源文件或源目录，请另选位置。」且 0 文件） |
| **AT30** | FAIL | **PASS** | 无文档启动 → 更多 → 关于；许可证入口 | `at30-r2-a`（「获取对应源码」段渲染译文「未配置对应源码入口；公开发行前必须补齐。」，全页无原始 i18n 键）；`b`（许可证查看器） |
| AT05（回归） | PASS | **PASS** | 3 标签、Ctrl+Tab、关闭、MRU | `at05-r2-a`、`at05-r2-f` |
| AT17（回归） | PASS | **PASS** | 中文/SECRET/零结果检索 | `at17-r2-b`（中文 1 命中）、`c`（SECRET 3 命中）、`d`（零结果提示不变） |

### R2.3 汇总（全部 30 项，Rev 2 最新判定）

| 判定 | 数量 | AT | 与 Rev 1 的差异 |
|---|---|---|---|
| **PASS** | **27** | 01–05、08–18、20–25、27、29（Rev 1 的 22 项）+ **06、07、14、15、30** | +5（修正生效） |
| **FAIL** | **3** | **19、26、28** | −5（原 8 项中 5 项转 PASS；3 项以新缺陷形式残留，见 R2.4） |
| **UNVERIFIED（整体）** | **0** | 无 | 不变 |

- 未复跑的 20 个 PASS 项判定沿用 Rev 1（本次修正范围未触及；派发仅要求复跑 8 个修正项 + 回归抽查）。
- 前向测试基线复核（本分支最终修订）：`pnpm test -- --run` → **Test Files 69 passed; Tests 524 passed**（与 wp-34a 一致；预期 524）。
- **Rev 2 的 3 个 FAIL 与 Rev 1 的 8 个 FAIL 不是同一批缺陷**：D-34-1/2/3/5/6 已修复且复跑通过；D-34-4 部分修复（同版本/跨版本精确/ top 回退近似可用，标题/祖先回退不可用）；D-34-7 的保护结果成立（0 写入）但错误态路径的用户可见说明不正确。新缺陷 D-34b-1…3 如下。

### R2.4 Rev 2 新发现（未修补，原样保留）

| ID | 级别 | 位置 | 证据 | 说明（含必要修复方向） |
|---|---|---|---|---|
| **D-34b-1** | 中高 | `src/features/reader/ReaderScreen.tsx:515`（`setRevealBlockId` 仅 exact 分支）与 `:521-526`（消费 guard 要求 `revealBlockId === blockId`） | `at19-r2-g`（无滚动、无标签、视图停在文首）对照 `at19-r2-i`（top 回退正常）与 `at19-r2-f`（exact 正常）；`at19b` 数据目录 DB 对照 | 近似恢复且 `blockId≠null`（标题/祖先回退）时消费永不发生：不滚动、不显示 `nav.return.approx`，静默停在当前位置。组件测试仅覆盖 top 回退（blockId=null），未覆盖 heading/ancestor 回退。修复方向：approx+blockId 同样推进 reveal（或允许无 reveal 消费），并补相应组件用例 |
| **D-34b-2** | 高 | `src/features/reader/body/ImageBlock.tsx:105-132`（`allowed` 无 `assetUrl` 落入 `load-failed`，`fetchRemote` 仅存在于 `remote-blocked` 分支）；配合 `src-tauri/src/commands/auth.rs remote_decision`（已授权 origin 返回 `allowed`、`asset_url=None`） | `at26-r2-d`（允许后「图片加载失败」）；`at26-r2-sockets-after.txt` 0 行；`strace -f -e trace=network` 无 `connect`/`:443`；应用日志无 `command_failed`；对照：`curl` 直连与代理访问该 URL 均 200 | 授权后 `check_resource_access` 变为 allowed（无 assetUrl），受控取图 `fetch_remote_image` 从不发起 → R26「本次文档允许加载」在真实应用永远以「图片加载失败」结束且零网络请求。组件测试以固定的 `remote-blocked` mock 通过，未模拟授权后的 decision 变化。修复方向：allowed+remote+无 assetUrl 时调用 `fetchRemote`（或 `check_resource_access` 对已授权未缓存资源返回需取图状态），并补真实决策序列测试 |
| **D-34b-3** | 中 | `src/features/settings/diagnostics/ExportPreviewDialog.tsx:100-109`（`PS_IO_EXPORT_BLOCKED` 一律视为覆盖确认）+ 错误态文档无 tab（前端 `protectedPaths` 为空） | `at28-r2-d/d2/d3`（误报覆盖→确认→「保存失败」，0 文件）+ `at28-r2-caseA-server-log.txt`（2×`PS_IO_EXPORT_BLOCKED`，`run-at-rerun3b.sh` 补充探针）；对照 `at28-r2-h`（已注册文档正确说明） | 错误态源目录保护的**结果**成立（Rust 拒绝、0 写入），但用户可见说明错误：先提示「目标文件已存在，是否覆盖？」，确认后通用「保存失败」，而非「该位置是受保护的源文件或源目录」。修复方向：区分“受保护”与“已存在”两种拒绝原因（不同错误码/details 或前端携带受保护集合），并补错误态桌面用例 |

### R2.5 复跑方法、对照与证据卫生

- **AT26 环境排除**：允许流程失败曾被怀疑为网络环境（本机 HTTPS 走本地代理）；实测 `curl` 直连（`--noproxy '*'`）与代理均 200，且 `strace` 显示应用进程无任何 `connect` 调用、应用日志无命令失败 → 失败点在组件调用路径（D-34b-2），**不是**网络环境。
- **AT19 判别性对照**：`at19-r2-i`（全标题改写→top 回退）显示近似标签与滚动均正常；`at19-r2-g`（仅锚点块改写→标题回退）无任何变化 → 缺陷边界精确落在 `blockId≠null` 的近似路径。
- **数据层**：`at-rerun/runs.log` 内嵌 10 次只读 DB 转储（session_tabs/recents/positions/documents/settings），覆盖 AT06 偏好开关、AT19 字号持久化与位置记录。
- **AT28 补充探针**：`run-at-rerun3b.sh` 复现 Case A（含覆盖确认）并把当次应用日志原样保存为 `at28-r2-caseA-server-log.txt`（1×`PS_ENC_UNSUPPORTED` + 2×`PS_IO_EXPORT_BLOCKED`，0 文件），供评审直接核对服务端拒绝，而非仅凭 UI 截断观察。
- **收尾核验**：每次复跑结束 `pgrep` 均无遗留 `paperstack` 进程；`color-scheme=prefer-dark`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 无 `probe-out*` 残留（`find`=0）；产品路径 `git status` 干净；应用日志（`app.log`）为空。
- **UNVERIFIED 清单**：沿用 §6 **不变**（Wayland、抓包级零请求、干净系统安装、拖放、复制失败路径、映射回退、前进分支清除、面板状态记忆、2000 条截断、横滚实际触发、GIF/WebP、替换保存、深色主题/真实输入/IME、200% 完整任务链、NF04–NF06/NF09 达标、LICENSE/对应源码入口等）；本次复跑未新增整体 UNVERIFIED，AT26 仍以进程树 `ss` 0 行替代抓包级证据。
- **追溯（Rev 2）**：`tests/desktop/run-at-rerun{1,1b,2,3,3b,4}.sh`、`acceptance-lib.sh#AT_EVIDENCE/db_dump`；wp-34a 修正映射（D-34-1…7）；`artifacts/70-verification/evidence/at-rerun/**`。

## 1. 输入与基线核验（pinned inputs，2026-10-07）

SHA-256 与 `state/handoffs/wp-34-desktop-at.json` 一致（只读未改）；`config/git-policy.json` 一致：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/20-requirements/requirements-baseline.md` | `42784f67…e35b85d` | ✓ |
| `artifacts/70-verification/early-run.md` | `76622428…e902c134` | ✓ |
| `artifacts/70-verification/unit-integration-report.md` | `a4c90529…157d261` | ✓ |
| `artifacts/60-implementation/wp-32a-perf.md` | `f88d525b…8ce67664` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…8b02967f` | ✓ |
| `config/git-policy.json` | `3b8ddffd…9241a014` | ✓ |

任务分支 `task/wp-34-desktop-at`；进入与结束时 `git status` 对产品路径均干净（见 §7 收尾核验）。

## 2. 构建与运行环境

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`beforeBuildCommand = pnpm build`；`build.log`：`Finished release profile … in 1m 03s`，`BUILD_EXIT=0`） |
| 二进制 | `src-tauri/target/release/paperstack`；大小 32,268,568 bytes；mtime 2026-10-07 18:31:47 +0800 |
| 二进制 SHA-256 | `748ca730db7945be5c6212d11a70c4d9bf9776cf2a12cddbb3a7246ca257d7b7`（`at/app-binary.sha256`） |
| 修订 | `613b4658c63e112c40b6ce171771e6b31732c75f`（`task/wp-34-desktop-at`） |
| 会话 | X11 `DISPLAY=:1`（Xorg，mutter-x11-frames；屏幕 2520×1680）；**无 Wayland 会话** |
| 文字缩放（环境事实） | `text-scaling-factor = 1.25` → 1280×800 窗口 = **约 1024×640 CSS**。此事实影响面板并排/覆盖判定（见 AT20/§5 观察 O-2） |
| 固定条件 | 浅色：`gsettings color-scheme=prefer-light`（原值 prefer-dark，退出时恢复）+ `GTK_THEME=Adwaita:light`；应用数据隔离于 `at/data`（`XDG_DATA_HOME`），用户真实数据目录未被修改 |
| 工具链 | Node v24.15.0；pnpm 10.34.6；rustc 1.96.0；libxdo/XTEST；xclip；python3（PIL/sqlite3） |
| 驱动方式 | `tests/desktop/xdo-helper`（本轮扩展 `clickroot` 子命令）；`screenshot.sh`；GTK 文件选择器经 `Ctrl+L` 路径输入 + Return（目录/文件均可确认）；模态按钮需 **Space** 激活（Return 在本 WebKit/XTEST 组合下不触发 modal 内按钮） |

## 3. AT01–AT30 逐项结果

字段：输入样例 / 环境 / 操作 / 实际观察 / 截图 / 判定。证据目录 = `artifacts/70-verification/evidence/at/`。

### AT01 统一文件打开（R01）— **PASS**
- **输入**: `fixtures/rendering/mixed-cn-en.md`、`tables.md`、`math.md`；`at/inputs/at01/{sample.markdown,SAMPLE.MD,sample.mdx,does-not-exist.md}`
- **环境**: release 二进制；浅色；隔离数据；CLI、第二实例（系统打开等效路径）、GTK 文件选择器
- **操作/观察**:
  1. `.md` CLI 打开渲染成功（`at01-b`）；`.markdown` 经第二实例新增标签并激活（`at01-c`，2 标签）；
  2. 同路径重复打开**复用**既有标签（仍 2 标签，激活原标签；`at01-d`）；扩展名大小写不敏感 `.MD` 打开成功（`at01-e`，3 标签）；
  3. 无效路径 → 错误横幅 `PS_IO_NOT_FOUND`，既有 3 标签不受影响（`at01-f`）；
  4. 批量 2 文件按输入顺序打开、首个获焦（`at01-g` → `at01-h` 点击第二标签激活 tables）；
  5. GTK 文件选择器经键盘确认打开 `tables.md`（`at01-g/h`）；再次打开选择器后 Escape 取消 → 标签/激活文档不变（`at01-i` 与 `at01-j` 同一状态）。
- **UNVERIFIED（行内）**: 拖放打开（需 XDND 源，本机不可自动化）。
- **判定**: PASS（上述子项均有截图；拖放见 §6）。

### AT02 普通目录阅读（R02）— **PASS**
- **输入**: `fixtures/tree/root`（含 4 个符号链接）、`at/inputs/at02/dir2/{plain/note.md,sub-empty/}`、`at/inputs/at02/noperm`（chmod 000）
- **操作/观察**: GTK 目录选择器打开 `root` → 文件树列出全部 7 行；`link-broken` 行内标 **已缺失**、`link-outside` 行内标 **链接指向授权范围之外**（`at02-a`、`at02-e/f`）；展开 `sub`→`b.md/deep`、展开 `deep`→`c.md`（`at02-b/c`）；空目录 `sub-empty` 展开显示 **此目录为空。**（`at02-j`）；无权限目录 → 横幅 `PS_IO_PERMISSION`「没有读取权限。」（`at02-i`，输入目录本身不可读）；树仅列出根一层、不递归全盘（各级截图）。**打开树中文件**后续在 AT20/AT05 流程中验证（树点击 → open_documents(`entry:'tree'`)；小文档在覆盖模式下内容被面板遮挡属 AT20 判定范围）。
- **UNVERIFIED（行内）**: 2000 条截断、目录内“无权限/越界**节点**”的树内独立状态（本轮以横幅与行内标签观察；见 §6）。
- **判定**: PASS。

### AT03 文件类型、编码与空文件（R03）— **PASS**
- **输入**: `fixtures/encoding/{bom.md,utf8-cn-emoji.md,empty.md,crlf.md,latin1.md,binary.md}`；`at/inputs/at01/sample.mdx`
- **操作/观察**: BOM 文件标题/正文无 BOM 字形（`at03-a`；字节层 `xxd` 证实 `EF BB BF` 存在）；emoji/组合字符正常（`at03-b`）；空文件 → **文档为空**（`at03-c`）；CRLF 正常且行号按 LF（`at03-d`）；`.mdx` 拒绝 → `PS_FMT_UNSUPPORTED`「本版仅支持 .md 与 .markdown 文件。」且原文档保持（`at03-e`）；Latin-1 → `PS_ENC_UNSUPPORTED`（`at03-f`）；二进制 → `PS_ENC_UNSUPPORTED`（`at03-g`）。错误态均保留“诊断/关闭”入口与欢迎页的重新选择入口。
- **判定**: PASS（`.tex/.pdf` 与 `.mdx` 同过滤路径，本轮取 `.mdx` 为代表）。

### AT04 严格只读与文件保护（R04）— **PASS**
- **输入**: `fixtures/**`（全量哈希）+ `at/inputs/at04/{code.md,edge-cases.md,latin1.md}` 副本
- **操作**: 完整会话：打开副本 → 滚动 → 文本选择 + Ctrl+C → 搜索 → 打开设置 → 错误流程（latin1）→ 打开 edge-cases 并点击任务复选框 → 干净退出。
- **观察**: `at04-fixtures-before/after.sha256`、副本 before/after 哈希与文件清单 **全部 IDENTICAL**（`at04-hash-diff.txt` 四个 `IDENTICAL`）——应用对源目录写入为零；atime 不计。任务复选框点击后状态未翻转（`at04-f/g` 与源文件一致；配合组件测试）。错误流程不改写原文。
- **说明**: 本会话的“选择+复制”未产生剪贴板内容（XTEST 在非编辑文本上的拖选不可靠）；复制语义另由 AT11 的按钮复制精确字节证据覆盖。
- **判定**: PASS。

### AT05 标签、重复打开与关闭（R05）— **PASS**
- **输入**: `math.md`、`code.md`、`tables.md`
- **操作/观察**: 3 文件 → 标签栏出现 3 标签（`at05-a`）；`Ctrl+Tab` 依次激活（`at05-b/c`）；`Ctrl+W` 关闭当前标签后激活规则：关闭第 3 个 → 剩 2（`at05-d`）；**MRU 判定**：先激活 tables 再激活 math，关闭 math（当前）→ **tables 获焦**（MRU 胜出；右邻回退会得到 code.md）（`at05-i/j`）；重复打开复用见 AT01-d。
- **判定**: PASS。

### AT06 最近阅读与启动恢复（R06）— **FAIL**
- **输入**: 隔离数据；`math.md` + `tables.md`；无参数重启
- **操作/观察**: 打开 2 文档并干净退出 → SQLite 中 `session_tabs=2`、`session_meta` 记录、`startup.restoreSession=true`（`runs.log` AT06 段）；**无参数重启后仍为欢迎页，未恢复任何文档**（`at06-b`）；全程多次打开后 **`recents` 表始终为 0 行**，欢迎页“最近阅读”只有内置示例（`at06-b`/`at27-a`）。
- **根因（源码级，未修补）**: D-34-2 / D-34-3（§5）。
- **判定**: FAIL（R06 的“恢复上次打开文档”“最近列表记录”在真实应用中未生效）。

### AT07 外部删除、移动与权限变化（R07）— **FAIL**
- **输入**: `at/inputs/at07fix/doc.md`（v1 副本）
- **操作/观察**: 会话中 `rm` 源文件 → 4 秒后仍完整保留已加载内容（`at07-f`），且**目录中未重建同名文件**（`ls` 输出为空目录，见 `runs.log`）；但**没有出现“找不到原文件/可能不是最新”提示，也没有“重新定位/关闭标签”入口**（`at07-f/g` 全屏与主体区截图一致）。
- **根因（源码级）**: `watch 'removed'` 会派发 `sessionUnavailable`，但前端没有任何组件消费该状态渲染 `document.unavailable.*`（全仓 grep 无生产引用）。
- **判定**: FAIL（“保留内容”子项 PASS；R07 的通知与重新定位交互缺失）。

### AT08 Markdown 兼容范围（R08）— **PASS**
- **输入**: `mixed-cn-en.md`、`code.md`
- **操作/观察**: 技术文档模式（默认）：GFM 删除线、行内/块公式、Mermaid、未知围栏降级纯文本均渲染（`at08-a/e`、`at08-g` 恢复后）；设置 → 语法 → **标准 Markdown**：同一文档重渲染，`~~删除线~~` 与 `$E = mc^2$`/`$x_{i+1}$` 变为**原文**（`at08-f`），再切回技术文档恢复渲染（`at08-g`）。
- **UNVERIFIED（行内）**: Front matter “不作为设置执行”无真实样例（组件层覆盖）。
- **判定**: PASS。

### AT09 原始 HTML 与内容隔离（R09）— **PASS**
- **输入**: `fixtures/security/malicious.md`（本地越界图片提示先“保持阻止”）
- **操作/观察**: `<script>`、事件属性、`style` 注入、`iframe` 均未执行/未渲染为活动内容；“javascript url / data url / vbscript url”呈现为不可点击纯文本（`at09-t`）；`<script>` 行内代码保持字面（`at09-t/u`）；越界图片 → 局部“图片位于当前授权目录之外”占位（`at09-t`）；宏炸弹仅本公式回退「此处内容渲染失败，已显示可读回退。」（`at09-v`）；50 节点 Mermaid 触发上限而非冻结，显示查看源码/放大（`at09-w`）；复选框不可改（`at09-w`）。全程无弹窗、无外部进程。
- **判定**: PASS。

### AT10 数学公式阅读（R10）— **PASS**
- **输入**: `fixtures/rendering/math.md`
- **操作/观察**: 行内 `$x^2+y^2=z^2$`、`$\alpha$` 与块公式渲染（`at10-a`）；美元/转义/未闭合/金额歧义均按原文（`at10-a`、`at10-d`）；未知宏仅本公式回退（AT09/reader-min 截图）；宽公式完整显示（`at10-b`）；设置关闭**行内美元公式**后 `$…$` 全部按原文显示、`$$` 块公式不受影响（`at10-c/d`），随后恢复。
- **判定**: PASS。

### AT11 代码块阅读与完整复制（R11）— **PASS**
- **输入**: `fixtures/rendering/code.md`（首 C 块、第二 C++ 块、45 行折叠块）
- **操作/观察**: 复制按钮复制**解析后字面代码**：首块剪贴板 = `int main(void) { return 0; }\n`（29 字节，含尾换行，无围栏/行号；`at11-clipboard-c.txt`）；C++ 块 = `auto answer = 42; // C++\n`（25 字节；`at11-clipboard-first.txt`）；折叠块显示“已折叠：显示前 20 行，共 45 行”+「展开全部 45 行」（`at11-g`），**折叠状态复制仍含全部 45 行**（450 字节 = 45×10，逐行核对 `at11-clipboard-fold2.txt`）。折叠不改变复制范围。
- **UNVERIFIED（行内）**: 复制失败提示路径（无法制造系统剪贴板失败）。
- **判定**: PASS。

### AT12 Mermaid 图表阅读（R12）— **PASS**
- **输入**: `fixtures/rendering/mermaid.md`
- **操作/观察**: flowchart/sequence/class 三类实际渲染为 SVG（`at12-a/b/c`）；语法错误局部回退（图表渲染失败 + 图种 flowchart + 错误摘要 + 查看源码，`at12-d`）；不支持图种（pie）提示“本版支持流程图、时序图与类图；此图种不在支持范围内。”不崩溃（`at12-d`）；点「放大」打开覆盖层（缩小/放大/适宽/100%/×、提示文案、Esc 关闭，`at12-e/f`）。
- **判定**: PASS。

### AT13 图片、表格与宽内容（R13）— **PASS（含 UNVERIFIED 子项）**
- **输入**: `fixtures/rendering/images.md`；`fixtures/rendering/tables.md`；`at/inputs/at13/{doc.md,pic.png}`（16×16 红色 PNG）
- **操作/观察**: 缺失/越界/遍历图片 → 各自占位文案 + 相对路径 + 「选择允许的范围」（`at13-b`）；`file:` → 找不到这张图片；`data:` SVG → 相应拒绝；**本地图片允许路径打通**：单文件打开 → 聚合提示 → 「允许本次读取」→ 图片实际加载显示（`at13-c/d/e`，闭合 EA-RUN §7 的 W-3 UNVERIFIED）；窄表与 8 列宽表完整、单元格无破损（`at13-f/g`）。
- **UNVERIFIED（行内）**: 表格/代码/公式“局部横向滚动被实际触发”（本视口均未超宽；机制存在但未触发）；GIF/WebP 样例（本轮仅 PNG 本地样例）。
- **判定**: PASS。

### AT14 大纲与标题锚点（R14）— **FAIL**
- **输入**: `fixtures/rendering/links.md`（重复标题）
- **操作/观察**: Ctrl+B → 大纲按标题层级显示，**重复标题生成唯一标识**「Duplicate 标题 (1)/(2)」（`at14-a`）；点击 (1)/(2) 仅改变当前项高亮（`at14-d/e`，点 (1) 后高亮落在 (2)），**正文未发生可见跳转**；页内 `#fragment` 点击亦无跳转（AT15）；缺失 fragment 无任何“未找到该标题”提示（`at15-h`；源码 `ReaderScreen.tsx:836` 静默 return）。
- **判定**: FAIL（唯一锚点显示 PASS；跳转与缺失提示未生效）。

### AT15 本地、页内与外部链接（R15）— **FAIL**
- **输入**: `fixtures/rendering/links.md`
- **操作/观察**: 跨文件相对链接在当前标签导航成功（`at15-i`：links.md → mixed-cn-en.md，标签数不变）；外部链接经系统浏览器打开（chrome 窗口标题由「DeepSeek 开放平台」变为 **「Example Domain - Google Chrome」**；应用进程树套接字 0/0，`at15-windows-before/after.txt`、`at15-sockets-*-3.txt`、`at15-n`）；ftp/javascript 链接为不可点击/无外部进程（`at15-o/p`）。**页内 fragment 链接（#…）点击不跳转**（`at15-r`，mixed 页内链接；`at15-m`，links Page-internal）；缺失 fragment 无提示（`at15-h`）。
- **判定**: FAIL（页内链接与缺失提示不满足 R15/R14；跨文件与外链子项 PASS）。

### AT16 每标签导航历史（R16）— **PASS（含 UNVERIFIED 子项）**
- **输入**: links.md ↔ mixed-cn-en.md 导航
- **操作/观察**: 跨文件导航后 `Alt+←` 返回 links.md 并显示「已恢复阅读位置」（`at16-c`）；`Alt+→` 前进回 mixed-cn-en.md（`at16-d`）；普通滚动不产生历史（多张截图中滚动后前后按钮状态一致）。
- **UNVERIFIED（行内）**: “后退后新导航清除前进分支”未取得可判定截图（页内链接无跳转，无法作为新导航起点）；一个搜索会话仅形成一个起终点（组件测试覆盖）。
- **判定**: PASS。

### AT17 页内正文与源码搜索（R17）— **PASS**
- **输入**: `fixtures/search/search-samples.md`、`fixtures/rendering/code.md`
- **操作/观察**: 「中文」命中 1（`at17-b`）；「SECRET」不区分大小写 3 命中（`at17-c`）→ 勾选区分大小写后 **1 命中**（`at17-d`）；公式源查询「alpha x」→ 结果标注 **公式源码匹配**（`at17-i`）；零结果「quux-absent-token」→ **0/0 + 未在当前正文中找到 · 可切换到源码查找**（`at17-j`）；折叠块内查询「line 45」→ 命中（结果预览 `# line 43 # line 44 # line 45`，`at17-m`）——不截断折叠内容；结果计数 `n/m` 与高亮可见。
- **判定**: PASS（不做归一化、无序等由词向量与组件层覆盖）。

### AT18 只读源码与阅读视图切换（R18）— **PASS（含 UNVERIFIED 子项）**
- **输入**: `mixed-cn-en.md`
- **操作/观察**: 更多菜单 → 查看源码 → **源码 · 只读**，行号 1–21、可选择、无保存按钮/可编辑光标（`at18-b`）；返回阅读恢复正文（`at18-c`）。
- **UNVERIFIED（行内）**: 无可靠映射时的“未能精确定位，已返回最近位置”回退文案未在真实场景强制触发（组件/单测覆盖）。
- **判定**: PASS。

### AT19 阅读锚点与恢复（R19）— **FAIL**
- **输入**: `fixtures/reader-min/reader-min.md`（越界图片提示先阻止）
- **操作/观察**: 滚动至代码/任务区（`at19-b`）→ 设置字号 17→22 后同块保持可见（`at19-c`；设置库确认 `display.fontSizePx=22`）；**退出后无参数重启回欢迎页，未恢复阅读位置**（`at19-d`）；源码层 `loadPosition` 无生产调用、`anchorFor` 仅内存锚（§5 D-34-4）。
- **判定**: FAIL（字体变化校正子项 PASS；重启位置恢复未生效）。

### AT20 侧栏与局部状态（R20）— **PASS（含 UNVERIFIED 子项）**
- **输入**: `mixed-cn-en.md`
- **操作/观察**: 窗口 1600×900（CSS 1280 ≥1180）→ 面板**并排**、正文右移（`at20-a`）；窗口 1024×640（CSS 819）→ 面板**覆盖层**、可关闭（`at20-b/c`）；面板一次只显示一个（文件/大纲互斥，`at02-a`、`at14-a`）。
- **UNVERIFIED（行内）**: 面板展开/滚动状态记忆（跨开关、跨目录）未逐项断言。
- **判定**: PASS。

### AT21 保持阅读与跟随更新（R21）— **PASS**
- **输入**: `at/inputs/at21b/doc.md`（v1 副本）
- **操作/观察**: 外部追加写入 → 非模态横幅「文件已有新版本。你正在阅读的内容未改变。」+「现在更新/稍后」+ 文件名旁“有新版本”徽标（`at21-e`）；点「现在更新」→ 内容更新到 v2 且横幅消失、旧内容保留结构（`at21-f`）；再次写入 → 横幅再出现（`at21-g`）；点「稍后」→ 折叠为「有新版本」标记、徽标保留（`at21-h`）。
- **判定**: PASS。

### AT22 文件事件与异步版本正确性（R22）— **PASS（UI 层）**
- **输入**: `at/inputs/at22b/doc.md`；脚本 150ms 内连续写入 RAPID-A → RAPID-B
- **操作/观察**: 稳定读取合并为一次候选，用户点更新后展示 **RAPID-B**（`at22-e`），+3s 后仍为 RAPID-B、无回退（`at22-f`），并提示位置近似恢复；引用组件层 `session`/`ReaderScreen` 的 generation/代次测试作为深层不变量证据（wp-32 全量 508 已含）。
- **UNVERIFIED（行内）**: 替换保存（rename 覆盖）、只改图片、关闭标签期间完成任务、前台/选区暂停的桌面级演示（组件/集成层覆盖，`at22-*` 未逐一制造）。
- **判定**: PASS（UI 层可观察部分）。

### AT23 排版、主题与设置作用域（R23）— **PASS**
- **输入**: `mixed-cn-en.md`
- **操作/观察**: 字号 17→22、行距 1.8→2.0 即时生效（`at23-b/d`）；越界输入 99 → **数值超出范围，已保留上一个有效值。**（`at23-c`）；退出重开 → 设置值 22/2 持久（`at23-e`，DB `display.fontSizePx=22`）。
- **UNVERIFIED（行内）**: 持久化失败路径（需制造应用目录写失败）；“恢复显示默认”按钮本轮未点击（组件测试覆盖）。
- **判定**: PASS。

### AT24 键盘、焦点与无障碍（R24）— **PASS（W-2 复核）**
- **输入**: `mixed-cn-en.md`
- **操作/观察**: W-1 复核：**修复已生效**，未聚焦时 skip link 完全不可见（`at24-a`；`base.css` 有 W-1 fix 注释与 `translateY(-200%)`）；Tab → 「跳到正文」焦点环可见（`at24-b`）、Enter 跳正文（`at24-c`）；**W-2 复核：XTEST 指针点击后 Tab 仍显示可见焦点指示**（`at24-d`，公式块圆形焦点环）——EA-RUN 的 W-2 未复现；键盘 Ctrl+F 搜索可用（`at24-e`）；**200% 文字缩放**：gsettings 2.0 后启动/面板/搜索均可用、布局不丢关键操作（`at24-f/g/h`），随后恢复 1.25。
- **说明**: 合成输入无法完全替代真实硬件/IME；完整模态焦点陷阱走查见 §6。
- **判定**: PASS。

### AT25 本地授权范围与撤销（R25）— **PASS**
- **输入**: `reader-min.md`；`at/inputs/at13/doc.md`；`fixtures/tree/root` 符号链接
- **操作/观察**: 聚合提示一张/目录（非逐图）：范围、涉及资源数、**「记住此目录授权」默认不勾选**（`at25-a`、`at09-b`）；拒绝 → 占位保留（`at25-b`）；允许 → 本地图片加载（`at13-e`）；符号链接越界/失效状态（AT02）；设置「持久授权」列表含撤销按钮，撤销动作在键盘走查中被触发一次并显示「授权已被撤销，已停止新的读取。」（`at27-l`）。
- **判定**: PASS（撤销演示属附带触发，已如实记录）。

### AT26 远程图片与外部访问（R26）— **FAIL**
- **输入**: `fixtures/rendering/images.md`；`at/inputs/at26/nopath.md`（`https://httpbin.org`）；`at/inputs/at26/remote.md`（`https://httpbin.org/image/png`）
- **操作/观察**: 默认零请求：阻止态下应用进程树套接字 0 行（`at26-sockets-blocked/after.txt`）；**无路径 URL** 流程完整：默认「已阻止远程图片」→「了解连接范围」→ 远程确认对话框（目标域名 `https://httpbin.org`、仅当前文档会话生效、保持阻止/本次文档允许加载）（`at26-e/f`）。**带路径的真实图片 URL 被错误归类为“不支持此链接或资源类型。”**（`at26-c/g`），既不显示阻止态也没有确认入口——允许会话流程对所有真实图片 URL 不可达（§5 D-34-5）。
- **UNVERIFIED（行内）**: 抓包级零请求（无 tcpdump 权限）；重定向/新域拒绝的桌面演示（策略层单测覆盖）。
- **判定**: FAIL（默认零请求子项 PASS；允许流程因路径分类缺陷不可用）。

### AT27 阅读记录、缓存与分类清除（R27）— **PASS（附证据限制）**
- **输入**: 隔离数据；先打开 2 文档并退出（种记录）
- **操作/观察**: 隐私面板显示各类别数量与「清除操作不会删除原始文档。」（`at27-a`）；「清除已有记录」对话框可打开（遮罩态 `at27-k`）；经键盘（Space）勾选类别并确认后：`session_tabs` 2→0，且关闭应用时**未回写**（清除后的写回抑制生效；`runs.log` AT27 段）；授权列表与撤销按钮可见（`at27-l`）；`fixtures` 源文件哈希在全部会话前后一致（AT04）。
- **证据限制（如实）**: 清除对话框的分类勾选与结果面板未留下可读图文（仅遮罩态截图）；功能判定基于数据库与写回抑制的可观察后果。
- **判定**: PASS（附上述限制）。

### AT28 诊断分类与手动导出（R28）— **FAIL**
- **输入**: `fixtures/encoding/latin1.md`（错误流程）；`fixtures/rendering/math.md`（已注册文档）+ latin1（第二错误）
- **操作/观察**: 错误横幅 →「诊断」面板含类别/错误编号/文档展示版本/源位置/详细技术信息（`at28-b`、`at28-i`）；「复制诊断摘要」→ 剪贴板 `paperstack-diagnostics v1 …`，**不含完整路径/正文**（`at28-clip-summary*`）；「导出诊断」→ 预览对话框：默认脱敏、包含源码上下文/包含完整路径开关、`已脱敏 0 处`、清单中含 `document-text, details-allowlist, home-directory, absolute-paths-last-two, url-query-fragment`（`at28-e`）——预览与默认脱敏 PASS。
- **FAIL 子项（受保护目标）**: 在主文档处于**错误态**时（latin1 未注册），导出目标 `fixtures/encoding/probe-out.txt` 被**写入成功**（预览显示“已导出到 …/fixtures/encoding/probe-out.txt.txt”，文件实写入 427 字节；测试者随后删除，仓库恢复干净）。受保护集合仅来自“已注册文档及其父目录”，错误态文档不注册 → 无保护（§5 D-34-7）。已注册文档路径下的保护拒绝因自动化未在双错误面板中抵达保存按钮，保持 UNVERIFIED。
- **判定**: FAIL（预览/脱敏/复制 PASS；受保护源目标拒绝未在真实错误态下生效，已注册文档场景 UNVERIFIED）。

### AT29 大文档与资源降级（R29）— **PASS**
- **输入**: `at/inputs/at29/doc-11MiB.md`（11 MiB = 11,534,336 B，生成物，未入库）；`evidence/generated/corpus-52MiB.md`
- **操作/观察**: 11 MiB → 大文档对话框「这个文档较大（11 MiB），请选择打开方式。」+ 简化阅读/只读源码/取消（`at29-a/b`）；默认焦点=简化阅读，Enter 选用后徽标与简化渲染（`at29-c`），搜索可用（`at29-d`）。52 MiB → **无对话框**，直接“只读源码”徽标 +「文件超过本版全量处理上限，可用源码分段查看。」+ 源码窗口「已显示第 1–2000 行，共 1855780 行」（`at29-e/f`）；启动到窗口 **2811 ms**、到源码可见 **16933 ms**（本机口径），进程 RSS 见 `runs.log`。
- **判定**: PASS（覆盖范围如实标注：源码窗口为分段视图）。

### AT30 Linux 交付、归属与开源入口（R30）— **FAIL**
- **输入**: 无文档启动 → 更多 → 关于
- **操作/观察**: 关于页显示 纸栈 PaperStack、版本 0.1.0、所属者 Quirkybrain、GNU GPL v3.0（GPL-3.0-only）、GPLv3 说明与离线说明；与 `package.json`/`tauri.conf.json` 的 0.1.0 一致（`at30-a`）。**「获取对应源码」段落渲染出原始 i18n 键 `about.sourceUnconfigured`，而不是“未配置对应源码入口；公开发行前必须补齐。”**（`at30-a`；§5 D-34-1）。查看许可证/第三方声明入口存在（`at30-a`）。
- **UNVERIFIED（行内）**: 干净系统安装（无 sudo 不可 `dpkg -i`；属 wp-40/wp-45）；Wayland 侧；包内 LICENSE/第三方声明与离线读取（打包任务 wp-41/45）；对应源码入口未配置本身为既有发布阻塞（A9）。
- **判定**: FAIL（关于页错误态文案缺陷；归属/版本/许可证展示子项 PASS）。

## 4. 汇总

| 判定 | 数量 | AT |
|---|---|---|
| **PASS** | 22 | 01,02,03,04,05,08,09,10,11,12,13,16,17,18,20,21,22,23,24,25,27,29 |
| **FAIL** | 8 | 06,07,14,15,19,26,28,30 |
| **UNVERIFIED（整体）** | 0 | 所有 AT 均有可执行判定；不可执行子项在行内与 §6 列明 |

- 前向测试基线复核（本分支最终修订）：`pnpm test -- --run` → **Test Files 69 passed; Tests 508 passed**（DoD 预期 508）；契约套件 `pnpm vitest run --config tests/contracts/vitest.config.ts` → **44 passed**（折叠清理后比 wp-32a 的 45 少 1：resolved 空壳结构测试随空壳删除）；`cargo test --manifest-path src-tauri/Cargo.toml --test contract_search_parity` → **5 passed**（清理后双方仍以 `cases.greek-final-sigma-per-code-point` 断言共享语义）。

## 5. 发现（产品缺陷，原样保留；本任务未修补任何产品代码）

| ID | 级别 | 位置 | 证据 | 说明（含必要修复方向） |
|---|---|---|---|---|
| **D-34-1** | 高（AT30 阻断项） | `src/features/settings/sections/AboutSection.tsx:66` + `src-tauri/src/services/info.rs:43/80` | `at30-a`（关于页原样显示 `about.sourceUnconfigured`）；单测 mock 未含 `sourceEntryNote`，故未捕获 | Rust 按架构约定返回 i18n **键**，前端把它当正文直接渲染；应在 UI 侧 `t(sourceEntryNote)`（或约定清晰化），并补一条“后端真实载荷形状”的测试 |
| **D-34-2** | 高 | `src/services/storage.ts:38`（`loadSession` 无生产调用） | `at06-b`；DB `session_tabs=2`、`restoreSession=true`；重启不恢复 | R06 会话恢复未接线；需把 `load_session` 接入启动流程并重跑 AT06 |
| **D-34-3** | 中 | `src/services/storage.ts:22`（`touchRecent` 无生产调用） | `recents` 表全程 0 行；欢迎页仅内置示例（`at06-b`、`at27-a`） | R06 最近阅读未记录；需在打开/激活时调用 `touch_recent` |
| **D-34-4** | 高 | `src/features/reader/use-reader.ts:643`（`anchorFor` 仅内存）；`loadPosition` 无生产调用 | `at19-d`（重启回欢迎页）；DB positions 无恢复路径 | R19 跨重启位置恢复未接线；需加载 `load_position` 并在读取后应用锚点 |
| **D-34-5** | 高 | `src-tauri/src/commands/auth.rs`（`decide_access` 对 Remote 调用 `normalize_origin`，而该函数要求**无路径**） | `at26-c/g`（带路径 → “不支持此链接或资源类型。”）；`at26-e/f`（无路径 → 正常阻止/确认） | R26 允许会话流程对真实图片 URL 不可达；应改为“提取 origin 后校验”，并补带路径的 Rust/契约用例 |
| **D-34-6** | 高 | `src/features/reader/ReaderScreen.tsx:831-847`（`getElementById` 失败即静默 return） | `at15-r`（页内链接无跳转）、`at14-d/e`（大纲点击仅改高亮无跳转）、`at15-h`（缺失 fragment 无提示） | 同页 fragment 跳转与“未找到该标题”提示在真实应用未生效；需核对锚点 id 生成/查找并实现缺失提示，补真实 DOM 层测试 |
| **D-34-7** | 中高 | `ProtectedSources` 仅收集**已注册**文档及其父目录（`diagnostics.rs:452-483`；`collect_protected_sources`） | `at28-h`（错误态文档下导出成功写入 `fixtures/encoding/probe-out.txt`，427 B，测试后已删除）；受保护拒绝在已注册文档场景未取得桌面证据 | R04/R28 的源目录保护在“错误态未注册”时失效；需决定并实现错误路径的源目录保护（并把该真实路径补成集成用例），或明确契约边界 |
| **O-1** | 观察 | skip link 隐藏 | `at24-a` | W-1 已修复（`base.css` W-1 fix；未聚焦完全不可见） |
| **O-2** | 观察（环境） | 1280×800 + 1.25 文字缩放 = 1024 CSS | `at20-a/b`、`at02-*` | ui-spec §3.2 的 <1180px 覆盖层规则在此固定条件下生效；从树打开的小文档（如 b.md）在面板打开时正文完全落在覆盖层后，看似空白（关闭面板即见）。并排模式需窗口 ≥约 1475 设备像素（本轮以 1600×900 验证） |
| **O-3** | 观察 | 合成输入行为 | 全程 | 模态内按钮需 Space 激活（Return 不触发）；GTK 选择器以 Ctrl+L+路径+Return 可完整自动化（目录/文件/保存目标） |

## 6. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 / 状态 |
|---|---|
| Wayland 会话（NF10/R30/AT30/IT08 的 Wayland 侧） | 本机仅 X11 `:1`；XTEST/libxdo 不适用 |
| 抓包级零请求证据（AT26/NF02） | 无 sudo/tcpdump；以进程树 `ss` 套接字观测（0 行）替代 |
| 真正干净系统安装（AT30/IT08） | 无 sudo 不能 `dpkg -i`；属 wp-40/wp-45 |
| WebDriver／tauri-driver E2E | 驱动缺失且无 sudo |
| 拖放打开（AT01） | 需 XDND 源，脚本无法产生拖放 |
| GTK 选择器完全人工等价 | 已用键盘路径自动化打开/取消/保存；选择器内的浏览交互本身未逐项截图 |
| 复制失败路径（AT11）、映射回退文案（AT18） | 无法在真实场景可靠制造 |
| 前进分支清除（AT16）、面板状态记忆（AT20） | 未能构造可判定截图；组件层覆盖 |
| 2000 条目录截断 / 目录节点级“无权限、越界”独立状态（AT02） | 本轮以横幅与行内标签观察；节点级状态由 tree 组件/服务测试覆盖 |
| 表格/代码局部横滚实际触发（AT13）、GIF/WebP（AT13） | 本视口未超宽；仅有 PNG 本地样例 |
| 替换保存/只改图片/关闭标签期间完成任务（AT22） | 桌面级未逐一制造；组件/集成层覆盖 |
| 已注册文档下的导出保护拒绝（AT28） | 自动化未在双错误面板中抵达保存按钮；仅取得错误态（未注册）下“保护未生效”的反例 |
| 深色主题视觉走查、真实硬件键盘/鼠标、真实 IME | 固定条件为浅色 + 合成输入；EA-RUN 与计划 §5.5 的既有边界延续 |
| 200% 缩放下完整任务链、WCAG 2.2 AA 认证 | 本轮仅抽查可用性；认证不在目标内（不声明） |
| NF04–NF06/NF09 达标结论 | 本报告不重测性能；沿用 wp-32/32a 校准口径与“非基准机”声明 |
| LICENSE/第三方声明包内可得性与对应源码入口（AT30 实质部分） | 属 wp-41/45；本机仓库根无 LICENSE；A9 为既有发布阻塞 |

## 7. 证据与收尾核验

- **构建/环境**: `at/build.log`、`at/app-binary.sha256`、`at/runs.log`（全部命令、退出码、几何、时间戳；本轮 4975 行）。
- **数据层**: 隔离库 `at/data/com.quirkybrain.paperstack/paperstack.sqlite3`（settings/documents/recents/session_tabs/positions 快照见 `runs.log`）；`at/data/.../logs/paperstack.log`（应用诊断日志，重点段已在 §5 引用）。
- **哈希对照**: `at04-fixtures-*.sha256`、`at04-copy-*.sha256`、`at04-hash-diff.txt`（四段 `IDENTICAL`）、`at27-*-before/after.sha256`。
- **剪贴板**: `at11-clipboard-c.txt`、`at11-clipboard-first.txt`、`at11-clipboard-fold2.txt`、`at28-clip-summary*.txt`。
- **传输/进程**: `at15-sockets-*.txt`、`at15-windows-before/after.txt`、`at26-sockets-*.txt`、`at26-app-pids*.txt`。
- **截图索引（按 AT，样例）**: 每 AT 的判定在 §3 行内逐张引用；目录共 **319 张 PNG** + 日志，命名前缀即 AT 组（`at01-`…`at30-`、`fix` 复跑沿用同前缀）。建议评审优先查看：`at04-hash-diff.txt`、`at06-b`、`at07-f`、`at13-e`、`at17-m`、`at18-b`、`at20-a/b`、`at21-e/f`、`at22-e/f`、`at24-b/d/f`、`at26-e/f/g`、`at28-e/h`、`at29-a/f`、`at30-a`。
- **仓库收尾**: 产品路径 `git status` 干净；`fixtures/` 无残留（AT28 测试写入的文件已删除，`git status --porcelain fixtures/` = 0）；无遗留 `paperstack` 进程（每次 run 的 `pgrep` 行均为“no paperstack process remains”）；系统主题与文字缩放均已恢复（`prefer-dark` / 1.25）。
- **脚本与工具（`tests/desktop/`）**: `acceptance-lib.sh`（隔离数据、启动/终止、截图、像素级模态检测、模态键盘处理、GTK 选择器自动化、`reset_data`）、`run-at-{a,b,c,d,e,fix1..fix8}.sh`（复跑入口；坐标以各复跑脚本内注释与截图为准）、`find-gtk-accept.py`（GTK 接受按钮定位）、`xdo-helper.c` 新增 `clickroot`（绝对坐标点击，C 源已更新并重建）。

## 8. 复验方式

```sh
# 前提：DISPLAY=:1、libxdo、xwininfo/xwd/ffmpeg/xclip、python3(PIL)、pnpm
pnpm tauri build --no-bundle
bash tests/desktop/run-at-a.sh     # AT01–AT04（含目录/编码/只读哈希）
bash tests/desktop/run-at-b.sh     # AT05–AT10
bash tests/desktop/run-at-c.sh     # AT11–AT16
bash tests/desktop/run-at-d.sh     # AT17–AT22
bash tests/desktop/run-at-e.sh     # AT23–AT30
# 逐项证据：artifacts/70-verification/evidence/at/（runs.log 为总日志）
```

关键判定为人工逐张核对（模态像素检测、剪贴板字节、SQLite 行、哈希 diff、xwininfo 标题变化），不以脚本退出码代替核对。

## 9. 追溯

- **T-63 / 计划 §4.4、§5.3（桌面协议）、§5.5（UNVERIFIED 清单）**；**ADR-010**；**requirements-baseline R01–R30 / AT01–AT30**。
- **EA-RUN（wp-21）**：固定条件、W-1/W-2/W-3 处置（W-1 已修复；W-2 未复现；W-3 本地图片允许路径本轮打通）。
- **wp-32/wp-32a**：低层已覆盖的语义（源映射、搜索向量、折叠、隐私竞态）在本报告中以“引用组件层”方式避免重复，桌面层只验可观察行为。
- **本轮新增追溯**：`tests/desktop/acceptance-lib.sh`、`run-at-*.sh`、`find-gtk-accept.py`、`xdo-helper.c#clickroot`、`tests/contracts/vectors/search-parity.json`（删除 resolved 空壳）、`tests/contracts/search-parity.test.ts`（结构断言 2→1，删除 resolved 专用测试）。

## 10. 结论与下一步

AT01–AT30 全部取得可复现判定：**22 PASS / 8 FAIL / 0 整体 UNVERIFIED**。8 个 FAIL 均指向真实集成缺口（R06 恢复与最近记录、R07 不可用态 UI、R14/R15 同页锚点、R19 跨重启位置、R26 远程路径分类、R28 错误态源目录保护、R30 关于页键泄漏），其中 D-34-5/D-34-1/D-34-6/D-34-2/3/4 影响用户可见主路径，建议按 §5 形成修正 wp（新提交 + 重跑对应 AT 与组件/契约测试），再进入评审与集成门禁。本任务未修补产品代码；降级与引用说明均已如实标注。本报告与证据提交后交独立质量审查与 Gate 裁决。
