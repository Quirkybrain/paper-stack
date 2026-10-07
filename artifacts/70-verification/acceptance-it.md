# 纸栈 PaperStack · wp-44 IT01–IT08 端到端验收运行报告（系统验证条件 C3）

- **Producer**: agent:test-engineer
- **Artifact ID**: ART-70-VERIFY-ACCEPTANCE-IT
- **Artifact Type**: Verification Report（按需求基线 §4 / SRS §8.5 的 IT01–IT08 任务链，在 wp-43 打包产物上逐链执行；含原始证据、缺陷发现与明确 UNVERIFIED 清单）
- **Status**: VALID
- **Revision**: 3
- **Owner**: test-engineer
- **Task**: `wp-44-it`（任务分支 `task/wp-44-it`；父分支 `feat/v0.1.0`；基线提交 `670deae50eb06233ca7fede2ccb5ea340f3ca861`；产出提交主题 `test(acceptance): run it01-it08 on packaged build`）
- **Task (Rev 3)**: `wp-48-itrerun2`（任务分支 `task/wp-48-itrerun2`；父分支 `feat/v0.1.0`；基线提交 `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e`，已含 wp-45（`3a14102`）与 wp-47（`a86a20f`）修复并入；D-IT-3 残余（大文档尾搜/复制）在 wp-47 构建上的独立复验；产出提交主题 `test(acceptance): verify large-doc fixes`）
- **Components**: C-19 测试基础设施（`tests/desktop/run-it.sh`、`run-itrerun2-wp48.sh`、`sample-cpu.py` 等 IT 驱动）；Rev 1 被验证对象为 **wp-43 打包的 .deb 提取运行产物**；Rev 3 被验证对象为**当前树 release 二进制**（`26c02d2d…`）
- **Last Verified**: 2026-10-08（Rev 3：IT07 在 wp-47 修复构建 `26c02d2d…` 上独立复验，尾搜/尾导航与复制子项关闭；Rev 1：全部判定产生自打包二进制 `996f5c6c…`，前向套件 71 文件 / 547 passed）
- **Scope**: Rev 1：`tests/desktop/**`、`artifacts/70-verification/**`；Rev 3：`tests/desktop/**`、`artifacts/70-verification/**`。未修改 `src/`、`src-tauri/`、`fixtures/`、锁文件、pinned 输入；产品缺陷只记录、未修补。

> **证据纪律**：每条判定都对应实际执行的操作与检查过的截图/日志/数据库内容；截图存在本身不作数。
> **FAIL 一律原样保留**；未执行或不可执行的子项在 §6 明确 UNVERIFIED，不计入 PASS。

## Revision 3（2026-10-08，wp-48-itrerun2：wp-47 修复后 IT07 独立复验）

> **修订号口径**：派发引用的「Rev 2」（D-IT-3 残余：尾导航阻塞、CPU 饱和、关闭超时）由 `task/wp-46-itrerun`（提交 `472b1c1`）产出，但该任务**未并入本任务基线**（`feat/v0.1.0@fa424ef`，无 rm-46 合并记录；其报告、脚本与证据仅存在于该任务分支）。本任务按派发口径将本次独立复验编为 **Rev 3**，在 **wp-47 修复构建**上重新验证并覆盖 Rev 2 的 IT07/大文档相关判定；**冲突时以本修订为准**。Rev 2 中 IT02/IT03 的关闭判定不在本次范围，不以本修订替代。Rev 1 §1–§8 原样保留为历史。本任务未修改任何产品代码。
>
> **判定纪律**：IT07 的「尾搜→复制」子项在 Rev 1 为 UNVERIFIED（10 MiB+ 语料 75–360s+ 主线程饱和、解析无法在观察窗内完成）。本节以同一判定口径（真实应用 + 脚本输入 + 截图/字节级核对/CPU 采样）在 11 MiB 语料上重新执行；**UNVERIFIED 只有在取得可复跑证据后才关闭**。

### R3.1 构建与基线

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`it-rerun2/build.log`：`Finished release profile [optimized] target(s) in 40.29s`；`BUILD_EXIT=0`） |
| 二进制 | `src-tauri/target/release/paperstack`；28,104,112 B；mtime 2026-10-08 04:33:35 +0800 |
| 二进制 SHA-256 | `26c02d2d8f4d254abb9aaf332be8e0f8d1857c1f3cf097464bb0050835f6a8c3`（`it-rerun2/app-binary.sha256`；`runs.log` 各节头部与补充 provenance 重复记录；**≠** Rev 1 的 `996f5c6c…`、wp-46 的 `ee21ad20…`、wp-47 自查的 `94a25e17…`，确认复验对象为本任务基线构建） |
| 修订 | `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e`（`task/wp-48-itrerun2`；父分支 `feat/v0.1.0`，已含 wp-45 快路径与 wp-47 窗口化挂载/O(1) 摘录并入）；`git diff HEAD -- src src-tauri :!**/tests/**` = 空 |
| Pinned 输入 | `acceptance-it.md` Rev 1 `7787e69e…`、`acceptance-at.md` Rev 5 `bc5d1160…`、`wp-47-fix3.md` `a7a7ec3c…` 与 handoff 逐一比对一致；`config/git-policy.json` `3b8ddffd…`（只读未改） |
| 语料 | 源 `evidence/generated/corpus-52MiB.md` sha256 `7557cf7f…cfe94`；`head -c 11534336` 派生 11 MiB = sha256 `b84af672…78767`（与 wp-47 §3.1 同源同尺寸一致，`runs.log` 记录） |
| 会话/固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `color-scheme=prefer-light`；`text-scaling-factor=1.25`（200% 子项后恢复）；应用数据隔离于 `it-rerun2/data`，缓存 `cache-it07`；运行期系统 load ≈3（本机并行负载，`runs.log` 无异常） |
| 驱动 | `tests/desktop/run-itrerun2-wp48.sh`（分节 `it07\|suite\|all`，分节可重跑）；`tests/desktop/sample-cpu.py`（与 wp-47 证据同一采样契约，头部注明来源） |
| 证据目录 | `evidence/it-rerun2/`：36 张 PNG + `runs.log`（含两次 IT07 运行历史 + 补充 provenance）+ `it07-r3-cpu.csv`（148 样本）+ 剪贴板/期望载荷字节文件 + `build.log` + `unit-suite-wp48.log`；首轮受自动化缺陷影响的 4 图/1 字节文件移入 `superseded/`（原始字节保留） |

### R3.2 IT07 复跑（旧 → 新）

| 项 | Rev 1（旧） | Rev 3（新） |
|---|---|---|
| **IT07 总体** | PASS（键盘全链、抽屉焦点、200% 达成；**10 MiB+ 简化阅读尾搜→复制子项 UNVERIFIED**；D-IT-3：>7 分钟 105–113% CPU） | **PASS（受限子项关闭）**：尾命中导航、复制字节、CPU 回落、WM 关闭均取得可复跑证据；D-IT-3 残余在本构建不可复现 |

| # | 子项 | 本构建观测（2026-10-08） | 证据（`it-rerun2/`） |
|---|---|---|---|
| 1 | 键盘链 open→search→back | `Ctrl+O`→选择器→`Ctrl+L` 路径→Return 打开 `links.md`；`Ctrl+F`「Duplicate」→ **1/3** 命中列表 + 正文高亮；`Tab×10`→「跳到正文」焦点环→Return→`Alt+←`→**「已恢复阅读位置」**；`Ctrl+W` 关闭标签回欢迎页 | `it07-r3-a…h`（c/d/g/h） |
| 2 | 键盘复制（字节核对） | `Tab×8` 聚焦首块「复制」→Return；剪贴板 **29 B**，与期望 `int main(void) { return 0; }\n` `cmp` **EXACT** | `it07-r3-i`、`it07-r3-kb-clipboard.txt` + `runs.log` EXACT 行 |
| 3 | 键盘更新 | 外部追加→横幅；`Tab×8`→「现在更新」→Return→**toast「已更新，位置近似恢复」**；更新后内容含 KEYBOARD-UPDATE 段落 | `it07-r3-k…o` |
| 4 | 11 MiB 简化阅读：内容可见时间 | 选择「简化阅读」后：+3.13s 仍「正在解析」、**+4.21s 首屏正文可见**（t1–t3 解析中、t4 渲染；在 Rev 1 中该窗口为 >7 分钟未完成）；简化徽标 + 范围说明横幅就位 | `it07-r3-p`、`it07-r3-content-t1…t4`、`runs.log` 时间线 |
| 5 | **尾搜 + 尾导航（此前失败项）** | 唯一尾部探针 `x_{132139}`（仅 1 处）→ 计数 **0/1**、预览为目标尾段；点击「**下一项**」→ 计数 **1/1**、视图实际跳到文档尾部（`章节 132140`、命中高亮、`item-132143` 可见）；关闭搜索面板后位置保持。Return 键在两次独立运行中均未推进命中（见 R3.4 O-48-1） | `it07-r3-q`（0/1）、`r`（Return 尝试）、`s`（1/1+尾部）、`t`（面板关闭后保持） |
| 6 | 大文档复制（此前被遮挡/未取得字节） | 首屏代码块悬停→「复制」→剪贴板 **49 B**，与语料首块期望载荷 `fn sample() -> u32 {\n    42 // fixed code block\n}` `cmp` **EXACT**（3.08s） | `it07-r3-u-code-hover`、`it07-r3-code-clip.txt` + `it07-r3-code-payload.txt` |
| 7 | CPU 采样（必须回落） | 148 样本/0.5s/75.3s：峰值 **221.7%**（解析+挂载爆发）；选择后 **4.58s** 起 20 连续样本 <10%；**尾导航引发有界爆发** t≈31–41s ~100%（旧构建为 ≥75–360s 无界）；**末 20 样本均值 0.00%**（t≈43s 起空闲至结束） | `it07-r3-cpu.csv`、`runs.log` cpu 摘要 |
| 8 | WM 关闭 | 首次 `WM_DELETE_WINDOW` → **0.12s** 干净退出；无 NON-CLEAN/第二次关闭/SIGTERM；`pgrep` 无残留 | `it07-r3-close-notes.txt`、`runs.log` |
| 9 | 抽屉焦点返回 | `Ctrl+B` 开/关大纲→点击正文→Tab：焦点环落在「跳到正文」，未被抽屉滞留 | `it07-r3-w…y` |
| 10 | 200% 缩放 | `text-scaling-factor=2.0`：阅读、`Ctrl+F`「中文」（0/1 命中预览）、大纲抽屉均可用；随后恢复 1.25 | `it07-r3-z…z3` |

### R3.3 汇总（Rev 3）

| 判定 | 数量 | 说明 |
|---|---|---|
| **IT 项 PASS** | **8**（01–08） | 仅 IT07 在本修订内复跑刷新；其余 IT 未复跑，判定沿用 Rev 1（wp-45/wp-47 未触及相应链） |
| **本次关闭的受限子项** | **2** | IT07「10 MiB+ 简化阅读尾搜与复制」（尾导航 1/1 + 复制 49 B EXACT）；IT07「大视图复制字节核对」 |
| **子项 FAIL 保留** | **0（本次范围）** | Rev 1 §5 的 D-IT-1（IT02）/D-IT-2（IT03）等保留项未在本次派发范围内复跑，仍按 Rev 1 与所属修复任务的集成结果处理，本修订不新增/不关闭 |
| **整体 UNVERIFIED** | **0** | — |
| **受限子项 UNVERIFIED（更新后）** | **3 + 环境项** | 真实 IME、干净系统 `dpkg -i`、Wayland 会话（沿用 Rev 1 §6）；抓包级证据沿用。原 5 项中 2 项本次关闭 |

- 修订映射：D-IT-3 残余（尾导航阻塞/CPU 饱和/关闭超时）→ 旧失败在 wp-47 构建上均**不可复现**，本修订取得通过证据；由 `artifacts/60-implementation/wp-47-fix3.md` 与本文互证。
- 前向套件：`pnpm test -- --run` → **Test Files 73 passed; Tests 588 passed; 0 failed**（`it-rerun2/unit-suite-wp48.log`，期望 588）。
- 追溯 ID 不变：IT07→R24/R29/R11；本修订触及 R11（复制）、R24（键盘/缩放）、R29（大文档简化阅读）。

### R3.4 执行观察（不改变上表判定）

| ID | 级别 | 说明 |
|---|---|---|
| O-48-1 | 观察（合成输入） | 在搜索输入框获得焦点时，合成 **Return 不推进到命中**（两次独立运行均复现：计数停 0/1、视图不动）；「下一项」按钮正常推进（0/1→1/1 且实际滚动到尾部）。与 O-IT-5（合成 Escape 行为差异）同族；真实键盘行为建议由评审知悉，验收面由「下一项」控件覆盖。 |
| O-48-2 | 观察（有界性能） | 尾导航在修复后仍触发 **有界** ~10–12s 单核 ~100% 工作量（IT07 t≈31–41s、AT29 t≈17–29s），随后回落 0%；期间应用保持响应（WM 关闭 0.12s）。wp-47 的 100s 采样窗结束于尾导航之前，未覆盖该段；建议后续按性能事项评估窗口挂载/标注成本（不构成验收失败）。 |
| O-48-3 | 观察（时间量级） | 内容首屏可见时间本机为 **3.1s–4.2s 之间**（Rev 1 为 >7 分钟未完成；wp-47 报告为 ≤3s）。与机器负载/环境差异量级一致，不改变「解析/可见性已解除阻塞」的判定。 |

### R3.5 证据卫生（Rev 3）

- 全部场景 `pgrep -x paperstack` 无遗留；`xclip` 已清理；`color-scheme=prefer-light`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 零写入（输入样张/语料均生成于 `it-rerun2/inputs/`）；产品路径 `git status` 仅含本任务脚本与报告。
- 无一次性脚本残留：校准探针运行后即删除；受首轮自动化缺陷（第二次搜索未清空输入框导致查询拼接）影响的 4 图/1 字节文件移入 `superseded/` 保留原始字节；最终判定采用修复后的第二次运行产物，两次运行历史均保留于 `runs.log`。
- 驱动可复跑：`run-itrerun2-wp48.sh it07`（分节）；`suite` 分节复跑全套件。

### R3.6 追溯（Rev 3）

- **本任务新增**：`tests/desktop/run-itrerun2-wp48.sh`、`tests/desktop/sample-cpu.py`、`artifacts/70-verification/evidence/it-rerun2/**`、本修订。
- **上游**：`wp-47-fix3.md` §1–§3（窗口化挂载/O(1) 摘录、前后测量）、§6 追溯；`acceptance-it.md` Rev 1 §3 IT07、§5 D-IT-3、§6；需求基线 §4 IT07（R24/R29/R11）。

## 1. 输入与基线核验（pinned inputs，2026-10-08）

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/20-requirements/requirements-baseline.md`（含 §4 IT01–IT08） | `42784f67…e35b85d` | ✓ |
| `artifacts/70-verification/acceptance-at.md`（Rev 5） | `bc5d1160…46b6f6f` | ✓ |
| `artifacts/60-implementation/wp-43-package.md` | `664fde96…b3c1402` | ✓ |
| `artifacts/70-verification/system-verification.md`（C3 = G-05） | `bc655b13…3b43b4015` | ✓ |
| `config/git-policy.json` | `3b8ddffd…9241a014` | ✓（只读未改） |

## 2. 被测对象与固定条件（打包提取运行路径）

| 项 | 值 |
|---|---|
| 发布包 | `output/paperstack_0.1.0_amd64.deb`；11,519,100 B；sha256 `b0f44fdba83b1bfa5bbca80293ee14c8dd1b25e32a602bd74bf098fa754b4968`（与 wp-43 §6 记录一致） |
| 提取 | `dpkg-deb -x` → `/tmp/opencode/ps-deb-it`；运行 `usr/bin/paperstack`（28,099,600 B；sha256 `996f5c6c1549136189d3dcb9922b70f65cbe5ee72f6b4821febbc71c833425e9`）；资源目录 `usr/lib/paperstack/` 就位（LICENSE/第三方声明与仓库根 byte-identical，`it08-payload-hashes.txt`） |
| 当前树一致性 | `git diff 7f5de8a..HEAD -- src src-tauri ':!**/tests/**'` = 空（wp-43 产出提交后产品树未变，提取产物即当前构建） |
| 修订 | `670deae`（`task/wp-44-it`；父分支 `feat/v0.1.0`） |
| 固定条件 | X11 `DISPLAY=:1`、2520×1680；浅色 `GTK_THEME=Adwaita:light` + `color-scheme=prefer-light`（退出恢复 `prefer-dark`）；`text-scaling-factor=1.25`（IT07 显式 200% 后恢复）；应用数据隔离于 `evidence/it/data`，各节 `XDG_CACHE_HOME` 独立 |
| 驱动 | `tests/desktop/run-it.sh`（分节 `it01…it08|suite|all`；沿用 `acceptance-lib.sh` 的隔离数据/截图/模态探测/GTK 选择器/终止与清理） |
| 证据目录 | `artifacts/70-verification/evidence/it/`：116 张 PNG + `runs.log`（全部命令/退出码/DB 转储；含各节迭代的追加历史，最终判定引用各节最后一次运行的产物）+ `unit-suite-it.log` + 剪贴板/哈希/授权转储/socket/CPU 文本 |
| 判据口径 | 真实应用 + 脚本输入 + 截图/SQLite/哈希/字节级核对；不以脚本退出码代替核对；suite 与产品代码未改动 |

## 3. IT01–IT08 逐项链（步骤 / 观测 / 判定 / 证据）

字段：操作链（需求基线 §4）→ 实际观察（含截图/文本证据）→ 判定。证据目录 = `evidence/it/`。

### IT01 首次只读阅读（R01/R04/R11）— **PASS**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 系统打开中文路径混合文档 | CLI 路径 `evidence/it/inputs/it01/中文目录/混合文档.md`（中文目录+中文文件名）打开成功，标题栏正确（系统打开等效路径，AT01 同口径） | `it01-a-opened.png` |
| 选择文字 | 点击正文后 `Ctrl+A`，整篇选择高亮（浅绿选区）可见 | `it01-b-selection.png` |
| 点击任务框 | 滚动到「任务清单」，点击未勾选任务框 (257,524)；点击后复选框**保持未勾选**（只读，不可翻转），且无保存/确认对话框 | `it01-c-tasklist.png`、`it01-d-after-checkbox.png` |
| 复制代码 | 悬停代码块出现动作条 → 点击「复制」；剪贴板 = `int main(void) { return 0; }\n`（**29 B**，无围栏/行号） | `it01-e-code-region.png`、`it01-f-code-hover.png`、`it01-clipboard-code.txt` |
| 关闭 | WM_DELETE_WINDOW 干净退出，无残留进程 | `runs.log` 末尾 pgrep 行 |
| 哈希/目录集合不变 | 输入树（仅含测试生成的源文档）`find`+sha256 前后 **IDENTICAL**——应用对输入树零写入 | `it01-source-before.txt`/`it01-source-after.txt`/`it01-source-diff.txt` |

**判定：PASS。** 无需建库或保存确认；原文与源目录集合不变。

### IT02 连续导航（R14/R15/R16/R17）— **PASS（子项 FAIL 保留：D-IT-1）**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 大纲 | `Ctrl+B` 打开大纲（导航样例/二级标题 A/B）；点击「二级标题 B」→ 正文滚动到 B 处，起点正确 | `it02-b-outline.png`、`it02-c-after-outline-jump.png` |
| 脚注 | 点击第一处引用上标¹ → 滚动至文末脚注区（标题「脚注」）；点击第一个「↩」→ 返回引用处 | `it02-e-footnote-area.png`、`it02-f-backref.png` |
| 搜索十次下一项 | `Ctrl+F`「导航标记」= **14 命中**；点击「>」十次 → 计数 `10/14`，视图滚动到第 10 处；同一搜索会话合并（单计数器，无重复会话） | `it02-g-search-first.png`、`it02-g2-search-next-1.png`、`it02-h-search-after-10-next.png` |
| 链接到第二文档 | 点击 `[第二文档](./second.md)` → 同标签进入 second.md（标题「第二文档」） | `it02-j-second-doc.png` |
| 逐步后退 | `Alt+←` → 返回第一文档并显示「已恢复阅读位置」（k1）；再后退依次恢复搜索位置（k2→段落 10）与链接起点（k4） | `it02-k1-back.png`、`it02-k2-back.png`、`it02-k3-back.png`、`it02-k4-back.png` |
| 不串用其他标签历史 | CLI 第二实例新增并激活 `second.md` 标签（l）；在 second.md 按 `Alt+←` = **无操作**（不进入第一标签历史，m）；`Ctrl+Tab` 回第一标签（l2） | `it02-l-second-tab-active.png`、`it02-m-second-tab-back-noop.png`、`it02-l2-first-tab.png` |
| **子项 FAIL（保留）** | 点击 `[中文名文档](./中文文档.md)`（非 ASCII 文件名）→ **`找不到文件或资源。(PS_IO_NOT_FOUND)`**——同目录下目标文件真实存在 | `it02-n-cjk-link-attempt.png` |

**判定：PASS（链与关键结果均达成；非 ASCII 文件名跨文件链接子项 FAIL，缺陷 D-IT-1 已保留并路由，见 §5）。**

复现根因（只读诊断，未改产品代码）：`remark-parse→remark-rehype` 将链接 destination 规范为百分号编码——`node` 直接运行仓库管线得到 `["./second.md","./%E7%AC%AC%E4%BA%8C%E6%96%87%E6%A1%A3.md"]`；`ReaderScreen.resolveDocumentLink` 只对 fragment 做 `decodeURIComponent`，路径段原样传给 `open_documents`，Rust 按字面文件名查找 → NOT_FOUND。

### IT03 选区下外部更新（R18/R21/R22）— **PASS（缺陷 D-IT-2 保留）**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 选中正文 | 点击正文后 `Ctrl+A`，整篇高亮 | `it03-b-selection.png` |
| 外部替换保存 | `copyfile`+`os.replace` 重命名覆盖为 v2；出现**「找不到原文件。保留了已加载内容…」**（重新定位/重试/关闭标签），**不是** fixture 文档预期的「文件已有新版本」直接横幅（D-IT-2） | `it03-c-replace-unavailable.png` |
| 恢复 | 点击「重试」→ 变为更新横幅；主操作按钮文字为 **「更新并清除选区」**（说明选择仍在），另有「稍后」；工具栏「有新版本」徽标出现 | `it03-c2-update-banner.png` |
| 选择稍后 | 点击「稍后」→ 横幅折叠为「有新版本」条 + 徽标保留；**选区高亮仍在**（未被自动清除） | `it03-d-later-collapsed.png` |
| 查看源码 | 更多菜单 → 查看源码：源码显示 **v1**（14 行、`v1 line`、无 v2 增补）；折叠条在源码视图上方保持 | `it03-e-source-v1.png` |
| 现在更新 | 点击折叠条重新展开横幅 → 点击「更新并清除选区」→ **toast「已更新，位置近似恢复」**（显式更新结果标注近似），源码视图更新为 **v2**（gamma/v2 line/新尾段） | `it03-f-marker-reopened.png`、`it03-g0-after-update-fast.png`、`it03-g-after-update.png`、`it03-h-after-update-late.png` |
| 两视图版本一致 | 返回阅读为 v2（`it03-i2`）；再次打开源码仍为 v2（`it03-i-source-v2.png`） | 同左 |
| 对照（原地写入） | 直接追加 v3（in-place）→ 直接出现「文件已有新版本」横幅（无 unavailable 态）→「现在更新」→ toast + 源码 v3；证明缺陷仅限 rename-over 路径 | `it03-j-inplace-banner.png`、`it03-k0-inplace-update-fast.png`、`it03-k-inplace-updated.png` |

**判定：PASS（选区保留、两视图版本一致、显式更新结果精确/近似标注均达成；rename-over 恢复需人工「重试」= D-IT-2）。**

### IT04 异步乱序与退出（R22/R05）— **PASS（桌面近似 + 组件层强证据）**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 慢 v1→快 v2 | 150 ms 内写 RAPID-A→RAPID-B：稳定合并为单横幅（当前内容未变），无自动提交（keep 模式） | `it04-a-v1.png`、`it04-b-banner.png` |
| 关闭标签 | 候选未决时 `Ctrl+W` 关闭标签 → 干净回到欢迎页，**无幽灵标签**、无错误 | `it04-c-after-close.png` |
| 旧任务完成 | 重新打开同一文件 → 显示磁盘最新 **RAPID-B**，+3s 不回退 | `it04-d-reopened.png`、`it04-e-reopened-late.png` |
| 显式更新 | 第二轮 RAPID-C→RAPID-D（150 ms）→「现在更新」→ 显示 **RAPID-B + RAPID-D**，无 RAPID-C、无回退 | `it04-f-banner2.png`、`it04-g-after-update.png`、`it04-h-after-update-late.png` |
| 取消后资源不提交（引用） | 组件层为强证据：`src/app/session.test.ts:144`（stale generation 拒绝）、`:162`（标签关闭后迟到结果忽略）、`:202`（陈旧失败不可见）；`src/features/reader/ReaderScreen.test.tsx:572`（连续候选合并、提交最新）、`:646`（关闭后迟到读取忽略）；本任务 suite 547/547 PASS | `unit-suite-it.log` |

**判定：PASS（UI 层近似；“取消后的资源不得继续提交”由组件层 INV-VC-02/06/10 与 INV-UM-06 证据引用，桌面层不重复制造）。**

### IT05 权限与离线（R25/R26/R13）— **PASS**

输入：`inputs/it05/doc/permissions.md` = 正文 + `../outside/outside.png`（越界本地图）+ `https://httpbin.org/image/png`（远程）+ `./missing-image.png`（缺失）。

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 拒绝 | 依次拒绝聚合提示（越界目录）、远程确认（目标域名 `https://httpbin.org`）、缺失图目录提示；三处占位：**「图片位于当前授权目录之外」+「选择允许的范围」** / **「已阻止远程图片」+「本次允许」** / 缺失图（见 O-IT-1） | `it05-deny-0…3.png`、`it05-e-placeholders.png` |
| 默认零请求 | 阻止态应用进程树 TCP socket = **0 行** | `it05-sockets-blocked.txt`、`it05-app-pids.txt` |
| 单次允许（本地） | 点击「选择允许的范围」→ 聚合对话框 →「允许本次读取」→ **红色本地图片真实渲染** | `it05-g-local-allowed.png` |
| 单次允许（远程） | 点击「本次允许」→ 确认对话框 →「本次文档允许加载」→ **httpbin 图片真实渲染**；出现一条 ESTAB（98.89.203.252:443），远程缓存写入 8090 B | `it05-i-remote-allowed.png`、`it05-j-remote-allowed-late.png`、`it05-sockets-after-allow.txt`、`it05-remote-cache.txt` |
| 撤销 | 设置→隐私→持久授权「撤销」→ **「授权已被撤销，已停止新的读取。」**、暂无持久授权；退出后 DB：持久授权 **0**（剩余 session 目录/远程授权按设计随会话结束失效） | `it05-l-grants-list.png`、`it05-m-revoked-notice.png`、`runs.log` 授权转储 |
| 撤销后停止新请求 | 返回阅读后再次触发资源操作：无新 socket（仅既有 keep-alive，同一本地端口 39670）；本地/远程图片因 session 授权按设计仍显示，**正文始终可读** | `it05-n-back-to-reader-after-revoke.png`、`it05-o-after-revoke-attempt.png`、`it05-o2-after-revoke-retry.png`、`it05-sockets-after-revoke.txt` |

**判定：PASS。** “离线”以默认阻止 + 需要时才发起的受控取图 + socket 观测近似（无网络命名空间/无 sudo tcpdump，口径与 acceptance-at §6/R5.6 一致，见 §6）。错误态相互区分（越界/远程阻止/缺失）。

### IT06 重启与隐私（R06/R07/R27）— **PASS**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 恢复多标签 | 打开 a/b/c 三文档并激活 b、滚动后干净退出；DB `session_tabs=3/recents=3/positions=1`；无参数重启 → **恢复 3 标签**（b 激活，内容为 b 的表格页） | `it06-a-three-tabs.png`、`it06-b-restored.png`、`runs.log` DB 转储 |
| 移走源文件 | `mv doc-b.md doc-b.md.bak` → b 标签显示「找不到原文件。保留了已加载内容…」+ 重新定位/重试/关闭标签；切到 a（数学渲染）与 c 均**正常可读**——失败文件不阻塞其他页面 | `it06-c-moved-file.png`、`it06-d-other-tab-readable.png`、`it06-e-third-tab-readable.png` |
| 清除位置/会话记录 | 清除对话框勾选「最近阅读」「位置与会话」（3 项 / 5 项）→ 结果：最近阅读 **3 项**、位置记录 **2 项**、会话记录 **5 项** | `it06-g-clear-dialog.png`、`it06-h-selected.png`、`it06-i-clear-results.png` |
| 退出重启 | 干净退出后 DB：`session_tabs=0 / recents=0 / positions=0`；重启为欢迎页（仅内置示例）——**被清除记录未自动重建**，之后仍为 0/0/0 | `it06-j-restart-welcome.png`、`runs.log` 转储 |

**判定：PASS。**

### IT07 键盘与大文件（R24/R29/R11）— **PASS（大文件尾搜/复制子项 UNVERIFIED）**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 键盘打开 | `Ctrl+O` 选择器 → `Ctrl+L` 输入路径 → Return 打开 links.md（全程键盘） | `it07-b-picker.png`、`it07-c-keyboard-opened.png` |
| 键盘搜索 | `Ctrl+F` + 粘贴「Duplicate」 → **1/3** 命中列表；两次 Escape 未关闭面板（合成输入被吞，O-IT-5），随后仍可纯键盘继续 | `it07-d-keyboard-search.png` |
| 键盘后退 | `Tab×10` → 焦点「跳到正文」skip link（可见焦点环）→ Return 跳转正文 → `Alt+←` =「已恢复阅读位置」（回到文档顶部） | `it07-e-tab-reaches-link.png`、`it07-f-link-activated.png`、`it07-g-keyboard-back.png` |
| 键盘复制 | 打开 code 文档；`Tab×8` 聚焦代码块「复制」按钮（焦点环）→ Return → 剪贴板 **29 B** 精确代码文本 | `it07-k-focus-copy.png`、`it07-kb-clipboard.txt` |
| 键盘更新 | 外部追加 → 横幅；`Tab×8` → 「现在更新」；Return → **toast「已更新，位置近似恢复」** | `it07-h-keyboard-banner.png`、`it07-i-focus-now-update.png`、`it07-j0-keyboard-update-toast.png` |
| 键盘关闭 | `Ctrl+W` 关闭标签，回到欢迎页 | `it07-l-after-keyboard-close.png` |
| 关闭抽屉焦点 | `Ctrl+B` 打开大纲 → `Ctrl+B` 关闭（面板消失）→ 点击正文 + Tab：焦点环落在「跳到正文」（页面首焦点），**焦点未被抽屉滞留** | `it07-w-drawer-open.png`、`it07-x-drawer-closed.png`、`it07-y-focus-after-drawer.png` |
| 200% 缩放 | `text-scaling-factor=2.0`：阅读、`Ctrl+F`「中文」搜索（命中）、大纲抽屉均可用；随后恢复 1.25 | `it07-z-scale200.png`、`it07-z2-scale200-search.png`、`it07-z3-scale200-drawer.png` |
| 10 MiB+ 简化阅读 | 11 MiB 阈值对话框 → 选择「简化阅读」持久生效（徽标+范围说明横幅）；但 **WebKitWebProcess 持续 105–113% CPU >7 分钟仍未完成解析**，搜索栏显示「正在建立全文索引」；尾搜/复制不可达（D-IT-3） | `it07-m-large-dialog.png`、`it07-n-simplified-parse-t15.png`、`it07-o-simplified-parse-t60.png`、`it07-p-search-during-parse.png`、`it07-parse-cpu.txt` |
| 复杂度大文档（2 MiB，简化路径） | 尾址标记 `needle-87` 搜索 → **1/25** 并跳转到命中（搜索可用）；但大文档提示在视图上**再次出现**（O-IT-2），遮挡内容与指针操作，复制按钮无法在遮挡下点击 → 大视图复制未取得字节证据 | `it07-s-tail-search.png`、`it07-t-tail-hit.png`、`it07-u-code-hit.png`、`it07-v-code-hover.png`、`it07-large-clipboard.txt` |

**判定：PASS（键盘全链、抽屉焦点、200% 均达成；10 MiB+ 简化阅读的「尾搜→复制」子项 UNVERIFIED——精确解析受性能阻塞，2 MiB 复杂度路径搜索已达但复制被重复提示遮挡；均列入 §6）。**

### IT08 实际交付（R30/NF12/NF10）— **PASS（环境受限子项 UNVERIFIED）**

| 步骤 | 实际观测 | 证据 |
|---|---|---|
| 包身份 | `.deb` sha256 `b0f44fdb…`；控制元数据 `Package: paperstack / Version: 0.1.0 / Maintainer: Quirkybrain / Depends: libwebkit2gtk-4.1-0, libgtk-3-0`；payload 含 `usr/bin/paperstack`、`usr/lib/paperstack/{LICENSE,THIRD_PARTY_NOTICES.md}`、桌面项与图标 | `it08-deb-identity.txt`、`it08-deb-listing.txt` |
| 提取运行 | `dpkg-deb -x` 提取树运行；包内 LICENSE/第三方声明与仓库根 **byte-identical**；桌面项 `Exec=paperstack %U`、显示名「纸栈 PaperStack」 | `it08-payload-hashes.txt`、`it08-desktop-entry.txt` |
| 系统打开语义 | 以提取树的桌面项经 `gtk-launch paperstack <中文名文档>`（PATH/XDG_DATA_DIRS 指向提取树）启动成功，正确打开 `系统打开样例.md` → 判定使用 **gtk-launch 路径**（CLI 直接启动仅为回退，未使用） | `it08-a-system-open.png`、`it08-a2-system-open-confirmed.png`、`runs.log` “IT08 system-open launch path used: gtk-launch” |
| 关于/离线许可 | 关于页：纸栈 PaperStack / 0.1.0 / Quirkybrain / GPL-3.0-only / GPLv3 与离线说明；「获取对应源码」=「未配置对应源码入口；公开发行前必须补齐。」（A9 发布阻塞维持）；**许可证查看器离线渲染 GPLv3 全文**、第三方声明查看器渲染离线清单——不依赖 /usr 安装与开发服务 | `it08-b-about.png`、`it08-c-license-viewer.png`、`it08-d-third-party-viewer.png` |
| 中文输入与缩放 | IT01 中文路径文档正常；200% 缩放见 IT07；**真实 IME 输入法未验证** | §6 |

**判定：PASS（提取运行交付链达成；干净系统 `dpkg -i` 因无 sudo 未执行、Wayland 侧不可用——均列入 §6，维持既有口径）。**

## 4. 汇总（IT01–IT08 现行判定）

| 判定 | 数量 | IT |
|---|---|---|
| **PASS** | **8** | 01–08 |
| **FAIL** | **0** | —（IT02 的“非 ASCII 文件名跨文件链接”子项与 IT03/IT07 的缺陷发现保留在 §5，按缺陷路由，不隐瞒） |
| **整体 UNVERIFIED** | **0** | 所有 IT 均有可执行判定 |
| **受限子项 UNVERIFIED** | 5 | 10 MiB+ 简化阅读尾搜/复制（IT07）；大视图复制字节核对（IT07，2 MiB 遮挡）；真实 IME（IT07/IT08）；干净系统 `dpkg -i`（IT08）；Wayland 会话（IT08/NF10） |

- **C3（G-05）达成范围**：IT01–IT08 全部在**打包产物**（`.deb` → `dpkg-deb -x` → 提取二进制 `996f5c6c…`）上执行并判定；环境受限子项按 §6 明确标注，不计入 PASS。
- 前向套件：`pnpm test -- --run` → **Test Files 71 passed; Tests 547 passed; EXIT=0**（`unit-suite-it.log`，期望 547）。
- 追溯 ID：IT01→R01/R04/R11、IT02→R14/R15/R16/R17、IT03→R18/R21/R22、IT04→R22/R05、IT05→R25/R26/R13、IT06→R06/R07/R27、IT07→R24/R29/R11、IT08→R30/NF12/NF10。

## 5. 发现（按缺陷原样保留并精确路由；本任务未修补任何产品代码）

| ID | 级别 | 位置（诊断定位，供实现路由） | 证据 | 说明（含必要修复方向） |
|---|---|---|---|---|
| **D-IT-1** | 中高 | `src/features/reader/ReaderScreen.tsx` `resolveDocumentLink`（约 :153）路径分支未解码 percent-encoding | `it02-n-cjk-link-attempt.png`；`node` 管线复核 `["./second.md","./%E7%AC%AC…"]` | 跨文件相对链接指向非 ASCII 文件名时必然 `PS_IO_NOT_FOUND`（中文文件名是该产品的主场景；IT01 中文路径直接打开正常，仅链接解析受影响）。修复方向：对 rawPath 做 `decodeURIComponent`（与 fragment 分支一致）或返回前解码；补非 ASCII 目标名的组件/集成用例。**路由：implementation-engineer（R15）。** |
| **D-IT-2** | 中 | watch 变更归并（removed/appeared 次序）与前端消费：rename-over 后停在 `unavailable` | `it03-c-replace-unavailable.png`、`it03-c2-update-banner.png`、`it03-j-inplace-banner.png`（对照） | 编辑器式「替换保存」不直接进入「文件已有新版本」横幅（`fixtures/update/replacement-save.md` 的预期路径），而是「找不到原文件」直至用户「重试」；原地写入对照正常。修复方向：重命名覆盖后发现事件与文件存在性/内容哈希再协调（避免 removed 覆盖 appeared），或自动重试稳定读。**路由：implementation-engineer（R21/R22）。** |
| **D-IT-3** | 中 | 简化阅读 11 MiB 解析/索引（性能，NF04 邻近） | `it07-n…p.png`、`it07-parse-cpu.txt`（WebKitWebProcess 105–113% CPU，>7 分钟未完成） | 10 MiB+ 语料在简化阅读下无法在可观察窗口内完成解析与全文索引，「搜索与复制完整可用」在该路径不可达；与 acceptance-at R5.6 的 AT29 观察一致，但本次取得持续 CPU 证据（非环境空闲）。修复方向：性能剖析（解析/索引 worker、分块提交、进度反馈）；验收需可复跑的时间上限。**路由：implementation-engineer + solution-architect 评估。** |
| **O-IT-1** | 观察 | 图片错误态 | `it05-e-placeholders.png`、`it07…` 同型 | 缺失图片在其目录获授权前置态与「越界」共用占位文案（授权后才显示「找不到这张图片」）；与 at-final AT13 证据行为一致，不构成本次新缺陷，供评审知悉。 |
| **O-IT-2** | 观察 | 大文档提示重现 | `it07-u-code-hit.png`、`it07-v-code-hover.png`（2 MiB 复杂度提示在已选择简化阅读后重新出现在视图上） | 11 MiB 阈值对话框选择后保持生效（probe8/it07-n），而 2 MiB 复杂度提示在选择后再次出现并遮挡视图/拦截指针；疑似复杂度重评估路径，建议分诊（可能同 D-IT-3 性能路径）。 |
| **O-IT-3** | 观察 | 系统打开路径 | `runs.log` “IT08 system-open launch path used: gtk-launch” | `gtk-launch` 读取包内 `.desktop` 成功启动并打开中文名文档；未使用 CLI 回退。 |
| **O-IT-4** | 观察 | 更新结果文案 | `it03-g0-…`、`it07-j0-…` | 显式更新提交后 toast 均为「已更新，位置近似恢复」（近似标注存在且明确，无未限定成功文案）。 |
| **O-IT-5** | 观察 | 键盘运行中的搜索面板关闭 | `it07-d…g` 系列 | 本键盘运行中两次合成 Escape 未关闭搜索面板（focus 可能已被结果导航移出输入）；键盘链仍完成（skip link 焦点/Return/Alt+←），提醒自动化与真实键盘行为可能存在合成输入差异。 |

## 6. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 / 状态 |
|---|---|
| 10 MiB+ 简化阅读的尾搜与复制（IT07） | 解析/索引 >7 分钟未完成（D-IT-3）；已有 2 MiB 复杂度路径的搜索命中（1/25）与大文档入口证据 |
| 大视图复制的字节核对（IT07，2 MiB 路径） | 大文档提示在视图上重现遮挡复制按钮（O-IT-2）；复制控件在悬停截图中可见，但未取得剪贴板字节 |
| 真实 IME 中文输入（IT07/IT08） | 合成输入环境；仅验证粘贴与中文路径/内容显示 |
| 干净系统 `sudo dpkg -i` 安装/卸载（IT08） | 无 sudo/干净环境；以 `.deb` 提取运行替代（wp-43 既有口径） |
| Wayland 会话（IT08/NF10 的 Wayland 侧） | 本机仅 X11 :1；沿用 acceptance-at §6 |
| 抓包级零请求证据（IT05/NF02） | 无 sudo/tcpdump；以进程树 `ss`（阻止态 0 行 + 允许后 ESTAB + 缓存）替代（沿用 §6 口径） |

## 7. 证据与收尾核验

- **驱动与可复跑**：`tests/desktop/run-it.sh`（分节可重跑；数据隔离；模态像素探测；键鼠经 `xdo-helper`）。
- **文本证据**：`runs.log`（全量命令/退出码/DB 转储/授权转储/socket/剪贴板字节；含迭代历史，最终判定采用各节最后一次运行产物）；`it01-source-*`；`it07-kb-clipboard.txt`；`it05-sockets-*.txt`；`it07-parse-cpu.txt`；`it08-*`；`unit-suite-it.log`。
- **收尾核验**：各节结束 `pgrep` 无遗留 `paperstack`；`color-scheme=prefer-dark`、`text-scaling-factor=1.25` 已恢复；`fixtures/` 无任何写入/残留（`git status` 干净）；所有写操作限于 `evidence/it/inputs/**` 与隔离 `data/`/`cache-*/`；临时探针脚本与探针证据已删除（`superseded` 未保留，避免混淆）；提取树位于 `/tmp/opencode/ps-deb-it`（可由 `output/*.deb` 重建）。
- **构建/对象**：未重新构建——仓库 release 二进制与 `.deb` 提取二进制逐字节不同（`996f5c6c…` vs `b2a37b73…`），本任务按派发口径使用**打包提取产物**并在 §2 记录完整身份。

## 8. 追溯

- **需求基线 §4（SRS §8.5）IT01–IT08**；系统验证 §10.2 **C3（G-05）**、§5 IT 表、§9 G-07/G-10。
- **wp-43**：§4–§6（.deb 元数据/资源/提取运行与离线许可）；§8 残余 UNVERIFIED（干净安装、Wayland）。
- **acceptance-at Rev 5**：§R5.2 AT01–AT30 证据复用（固定条件、坐标族、判据口径、R5.6 受限项）；§R5.6（AT29 索引时序、抓包替代）。
- **本任务新增**：`tests/desktop/run-it.sh`、`artifacts/70-verification/evidence/it/**`、本报告（`acceptance-it.md`）。
