# 纸栈 PaperStack · EA-RUN 早期真实运行报告（wp-21：T-36 桌面工具 + T-37 固定条件运行）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-70-VERIFY-EARLYRUN
- **Artifact Type**: Verification Report（真实 X11 运行、固定条件截图与逐项核对；桌面测试工具说明）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-21-earlyrun`（任务分支 `task/wp-21-earlyrun`；父分支 `feat/v0.1.0`；基线提交 `21227c24a92ac5690101ded1584df069f1629114`；产出提交主题 `test(desktop): add ea-run tooling and fixed-condition evidence`）
- **Components**: C-19 测试基础设施（`tests/desktop/`：libxdo 助手、截图脚本、一键冒烟）；EA-RUN 检查点（implementation-plan §2.3 / §5.3，ADR-010）；被验证对象为 M3 阅读器最小装配（wp-19/wp-19a + wp-20）
- **Last Verified**: 2026-10-07
- **Scope**: `tests/desktop/**`、`artifacts/70-verification/**`。未修改 `src/`、`src-tauri/`、`fixtures/`、`vite.config.ts`、锁文件、pinned 输入或框架文件。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-21-earlyrun.json` 一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/30-architecture/adr/ADR-010-desktop-verification.md` | `9d58c3129e4b9d35261561370c5e78bf55d9bf154f3c036dec2d97153170dfb8` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817ac450b230fbd5f52525970fdf9af8755d1310012d3481a60749052e28` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a28be026338af865bb6b9725785cdfcd08ce4ca2fd137bb9d70143919` | ✓ |
| `artifacts/60-implementation/wp-19-reader.md` | `5b59dd7166563d1be0f45235c783b33488f6343eacee814c5642b488f1c31f85` | ✓ |
| `artifacts/60-implementation/wp-19a-workerfix.md` | `2ef0291cb58a5d741f6864efea0b36ddd01a53b726dd3534c4c03edd1ea0c9e1` | ✓ |

基线 `21227c24`；进入时工作树干净，分支 `task/wp-21-earlyrun`（`swe_guard.py status` 显示本任务 ACTIVE）。

## 2. 交付物（T-36 桌面工具）

| 路径 | 内容 |
|---|---|
| `tests/desktop/xdo-helper.c` | 仅测试用的小型 X11 输入助手，直接链接 `-lxdo -lX11`（本机无 `libxdo.pc`，不经 pkg-config）。子命令：`list/find/geometry/focus/wait`、`key <keyseq>`、`resize <w> <h>`、`click <x> <y> [button] [count]`、`close`。注入按键前先激活并**核验 X input focus 属于目标窗口或其子窗口**，核验失败即退出 4 且不发键（防止 XTEST 事件误入其他用户窗口）。 |
| `tests/desktop/screenshot.sh` | `xwininfo -root -tree` 查找窗口（排除 `mutter-x11-frames` 边框）→ `xwd -id` → `ffmpeg` PNG；窗口不可得时回退全根截图（stderr 注明）。`DISPLAY_SCREENSHOT` 可覆盖显示。 |
| `tests/desktop/run-smoke.sh` | 一键复现：构建助手（缺失/过期时）→ `pnpm tauri build --no-bundle`（release，记录耗时与二进制 sha256）→ 记录系统主题并固定浅色 → 启动 release 二进制并等待真实窗口 → 执行检查（焦点走查、滚轮滚动、复选框点击、第二实例、Ctrl+W、1024×640 缩放）→ WM_DELETE_WINDOW 干净关闭 → 全部命令/输出/退出码写入 `runs.log`。 |
| `tests/desktop/README.md` | 使用说明、前置条件、已知限制（X11-only、无 Wayland、文件对话框不自动化、截图≠核对）。 |
| `tests/desktop/.gitignore` | 忽略编译产物 `xdo-helper`（不入库、不入发行包）。 |

助手构建命令（实测通过）：

```sh
cc -O2 tests/desktop/xdo-helper.c -lxdo -lX11 -o tests/desktop/xdo-helper
```

实现说明：`libxdo` 的 `xdo_close_window` 在本机实测不能关闭 GTK/xclock 窗口（XSendEvent 路径），因此 `close` 子命令直接构造 `WM_DELETE_WINDOW` ClientMessage（已用 `xclock` 与真实应用双向验证）。

## 3. 构建信息（证据构建）

| 项 | 值 |
|---|---|
| 构建命令 | `pnpm tauri build --no-bundle`（`beforeBuildCommand = pnpm build`） |
| 结果 | PASS（`build.log`：`Finished release profile in 34.35s`；本证据轮总墙钟 **39s**；本会话首次全量 release 编译 **179s**） |
| 二进制 | `/…/PaperStack/src-tauri/target/release/paperstack` |
| 大小 / mtime | 32,235,576 bytes / 2026-10-07 08:12:41 +0800 |
| SHA-256 | `9adca0345381d558a30611a0e6e52bb2bcff9e4d4f46cf9872bbc4a7fdef3a0d`（本会话两次独立构建字节一致） |
| 工具链 | Node v24.15.0；pnpm 10.34.6；rustc 1.96.0 (ac68faa20) |
| 修订 | `21227c24a92ac5690101ded1584df069f1629114`（`task/wp-21-earlyrun`） |

## 4. 运行环境与固定条件（IXD §18.4 / ADR-010）

| 条件 | 实测 / 处置 |
|---|---|
| 会话 | 仅 X11 `DISPLAY=:1`（Xorg 21.1.11，mutter-x11-frames）；`XTEST` 扩展存在；屏幕 2520×1680。**无 Wayland 会话**。 |
| 窗口 | 应用默认 1280×800（`tauri.conf.json`）；窗口 id `0x4c00003`，几何 x=196 y=226 w=1280 h=800（`runs.log`）。 |
| 主题（**实际系统为深色**） | `gsettings get org.gnome.desktop.interface color-scheme` → `'prefer-dark'`；`gtk-theme` → `'Yaru-dark'`。运行期间按任务要求固定浅色：① `gsettings set … color-scheme prefer-light`（**原始值已记录并在退出时恢复为 prefer-dark**）；② 应用进程以 `GTK_THEME=Adwaita:light` 启动。应用本身 v0.1.0 无系统主题消费路径（`theme:'system'` 尚未接入；仅 `[data-theme]` 覆盖 + `:root` 浅色令牌）。截图 01–12 均为浅色表面（`#FFFFFF`/`#F5F6F8`）。 |
| 文字缩放（环境事实） | `text-scaling-factor = 1.25`，`Xft.dpi=120` → WebKit 页面按 **1.25 设备比例**渲染：**1280×800 X 窗口 ⇒ CSS 视口约 1024×640**。证据：`.ps-reader-notices` 的 8px CSS 内边距渲染为 10 设备像素；正文列 760px CSS = 950 设备像素（居中后外缘 165–1115）。**200% 文字缩放未执行**（见 §7 UNVERIFIED）。 |
| 缩放（页面） | 100%（应用默认，未设置任何页面缩放）；排版默认 17px/1.8/760px，系统字体栈（无内置/远程字体）。 |

## 5. 检查结果（逐项 PASS / FAIL / UNVERIFIED）

证据目录：`artifacts/70-verification/evidence/early-run/`（12 张 PNG + `runs.log`、`build.log`、`app.log`、`second-instance.log`、`app-binary.sha256`）。命令与退出码见 `runs.log`。

| # | 检查项 | 方法（命令/截图） | 实际观察 | 判定 |
|---|---|---|---|---|
| 1 | 主阅读页渲染：标题层级 | 截图 01 | H1「PaperStack 阅读样例（wp-19 冒烟）」→ H2 数学公式 → H2 代码与任务 → H2 图表 → H2 图片 → H2 宽表格 → H2 嵌套小节 → H3 三级标题（05/07/08 组合覆盖）；层级样式 30/23/19px 生效 | **PASS** |
| 2 | 正文宽度 ≤ 760px | 像素测量（01） | 段落文本最宽行 x=196–1068 设备像素；列内缘理论 195–1085（760px CSS×1.25 居中）；文本未越界 | **PASS** |
| 3 | 正文无横向溢出 | 截图 01–12 + 像素扫描 | 页面无横向滚动条（底部行无滚动条色带）；右侧仅纵向细滚动条；代码/表格块级 `overflow-x:auto` 机制存在 | **PASS** |
| 4 | 代码块 | 截图 05 | Rust 代码块：行号栏 + 语法高亮 + 中文注释，10 行完整显示、无裁切 | **PASS** |
| 5 | 表格 | 截图 07/08 | 8 列表格完整、可读；此视口下 max-content 未超过列宽，**局部横向滚动路径未被触发**（见 §7） | **PASS** |
| 6 | 公式 | 截图 01 | 行内 `E=mc²`、`x_{i+1}`；块级积分公式居中；未知宏 `\undefinedmacro{x}` 仅本公式回退（本地化文案 + 可复制源码），其余公式不受影响 | **PASS** |
| 7 | Mermaid | 截图 07（惰性渲染完成后） | flowchart 实际渲染为 SVG：打开文件 → 解析管线 →（成功）正文渲染 → 阅读与搜索 /（失败）源码回退；中文标签、strict 样式 | **PASS** |
| 8 | 图片占位（缺失图片） | 截图 07 | 虚线占位块：「图片位于当前授权目录之外」+「相对路径：images/missing-diagram.png」；无空白/破损图标/弹窗。另注：单文件打开只授权该文件，相对资源路径必然越界，故显示越界文案 | **PASS**（占位）；asset 协议**加载成功路径 UNVERIFIED**（§7） |
| 9 | 任务列表复选框非交互 | 截图 05 vs 06 + 像素比对 | 点击第一个复选框坐标 (255,540) 后：`05-main-code.png` 与 `06-task-checkbox-after-click.png` 差异仅 868 像素且全部位于工具栏「…」按钮区域（焦点环消失）；复选框区域 **0 像素变化**（勾选状态未翻转） | **PASS** |
| 10 | 默认状态：单文档无标签栏 | 截图 01/05–08 | 单文档全程无标签栏；仅第二文档打开后出现（截图 09，`reader-min.md` + `utf8-cn-emoji.md`），关闭后再次隐藏（10） | **PASS** |
| 11 | 默认状态：无侧栏面板 | 截图 01–12 | 无导航/检查面板渲染；工具栏状态与按钮保持可用 | **PASS** |
| 12 | 默认状态：不可用动作为真实禁用 | 截图 02–04 + 源码/测试 | Tab 顺序：跳到正文（skip link）→ 打开 → 更多「…」；后退/前进/导航/查找/Aa 被**键盘焦点跳过**（真实 `disabled` + `disabledReason`，非假按钮；`ReaderToolbar`/组件测试一致） | **PASS** |
| 13 | 文本截断 / 重叠 | 截图 01–12 逐张核对 | 标题、文件名、工具栏按钮、标签文字在两档窗口下无裁切或不可读省略；未发现正文元素重叠。**附加发现 W-1**：未聚焦的 skip link 底部约 15 设备像素在窗口左上角可见（详见 §6） | **PASS**（清单项）/ W-1 记录 |
| 14 | 可见焦点（Tab） | 截图 02/03/04 | Tab 1：skip link 焦点环（accent 4px）清晰可见；Tab 2：打开按钮焦点环；Tab 3：「…」按钮焦点环；焦点环未被遮挡 | **PASS** |
| 15 | 关闭入口可达 | 截图 09/10/12 + `runs.log` | `Ctrl+W` 关闭当前（第二）标签 → 回到 `reader-min.md` 且标签栏隐藏（10）；再次 `Ctrl+W` → UI00 欢迎占位（12，`纸栈 PaperStack` + 说明），窗口不退出、无保存询问 | **PASS** |
| 16 | 1024×640 缩放尝试 | `xdo-helper resize 1024 640` + 截图 11 | X 窗口精确到达 1024×640（`resized … to 1024x640`；geometry 复核）；截图 11 完整（1024×640），内容回流、工具栏与图标齐全、无重叠；随后恢复 1280×800（实测恢复成功）。注：本会话 1.25 比例下该尺寸对应 CSS 视口约 819×512 | **PASS**（按给定口径执行） |
| 17 | 第二文档（单实例 open-requested） | `runs.log` + 截图 09 | CLI 二次启动 `fixtures/encoding/utf8-cn-emoji.md`：第二实例 exit=0 并退出；`pgrep -c` 主进程数 **1**；既有窗口出现第二标签并被激活、emoji/组合字符正常渲染；关闭行为见 #15 | **PASS** |
| 18 | 干净终止 | `xdo-helper close`（WM_DELETE_WINDOW） | 在欢迎状态下单个 WM_DELETE_WINDOW 即退出（无需第二次请求/SIGTERM/SIGKILL；`runs.log` 无 fallback 记录）；`app.log` 全程为空 | **PASS** |

检查总数：**18 项 PASS，0 项 FAIL，0 项在表内 UNVERIFIED**（表外未执行项见 §7）。

## 6. 发现（Findings，不掩盖）

- **W-1（轻微视觉缺陷，属实现而非工具）**：未聚焦时 skip link（`跳到正文`）在窗口左上角露出底部约 15 设备像素（x≈20–136、y=0–14；截图 01、05、10、11、12 可见），与 ui-spec §6.2“仅聚焦时可见”不符。聚焦态正常（截图 02，完整框位于 y≈6–73）。修复属 `src/styles` 范围，本任务（只读验证）不在范围内；建议后续任务将隐藏偏移调整到不小于元素全高并复跑本脚本。
- **W-2（工具/环境限制，如实记录）**：合成指针点击之后，XTEST 注入的 Tab 不再产生可见 `:focus-visible` 焦点环（多次探针与一次完整运行复现；按键本身仍被应用处理——点击后 `Ctrl+W` 正常关闭标签、Enter 有响应）。因此脚本将焦点走查安排在**任何指针输入之前**执行（本轮顺序与 handoff 描述略有调整，属检查时序改进）；真实硬件键盘/鼠标下的焦点行为留给 wp-34（AT 走查）复核，本报告不据此对产品下结论。
- **W-3（已知边界）**：图片占位为“位于当前授权目录之外”（单文件打开仅授权该文件）。`asset:` 协议下**允许加载**的图片路径本次未出现可验证样例，保持 UNVERIFIED（§7），与 wp-19 §6 的声明一致。
- **观察（后续任务输入，非本检查失败）**：切换标签（09→10）后 `reader-min.md` 回到文档顶部，未保持此前滚动位置——位置保存/恢复属 wp-29（T-54）范围，此处仅记录现状。

## 7. 明确 UNVERIFIED 清单（DR-05，不得写成通过）

| 项 | 原因 / 状态 |
|---|---|
| Wayland 会话（NF10/R30/AT30/IT08 的 Wayland 侧） | 本机仅 X11 `:1`；libxdo/XTEST 不适用于 Wayland。 |
| 拖放打开、真实 IME composition、真实（非 XTEST）键盘/鼠标交互 | 本轮工具仅覆盖脚本化输入；合成指针后的焦点环行为见 W-2，交 wp-34 人工/真实输入复核。 |
| 200% 文字缩放 | 未执行（本机缩放组合为 1.25 比例；200% 及深色主题属完整回归矩阵，本轮 EA-RUN 固定条件为浅色 + 默认排版）。 |
| 深色主题视觉走查 | 未执行（任务明确固定浅色；系统本为深色，已记录并恢复）。 |
| `asset:` 协议图片**允许加载**路径 | 无允许样例；仅占位/拒绝路径被观察。 |
| CSS 视口 1024×640 的精确回归窗口（ui-spec 逻辑尺寸） | 本会话 1.25 设备比例下 X 窗口 1024×640 ⇒ CSS 约 819×512；逻辑 1280×800 默认窗口已实际呈现约 1024×640 CSS 视口，但“逻辑 1024×640”组合未单独达成。 |
| 表格/代码块局部横向滚动的实际触发 | 本视口下表格未超宽；机制存在但未被触发。 |
| 键盘走查超出前 3 个 Tab 停靠点、Esc 层级、模态焦点陷阱 | 属 wp-34/后续交互任务（wp-24+ 功能尚未接入）。 |
| Worker `usedWorker:true` 的 UI 可观测 | 无诊断面板（wp-26）；与 wp-19a §5.4 声明一致。 |

## 8. 证据清单（截图与日志）

全部位于 `artifacts/70-verification/evidence/early-run/`（截图为客户端窗口捕获，1280×800；11 号为 1024×640）：

| 文件 | 内容 |
|---|---|
| `01-main-top.png` | 默认状态：单文档、无标签栏、工具栏；H1/段落/行内与块公式/未知宏回退/代码块起始 |
| `02-focus-skip-link.png` | Tab×1：skip link「跳到正文」焦点环 |
| `03-focus-open.png` | Tab×2：「打开」焦点环（键盘跳过后退/前进/导航/查找/Aa 等禁用项） |
| `04-focus-more.png` | Tab×3：「…」焦点环 |
| `05-main-code.png` | 滚动后：Rust 代码块（行号/高亮）+ 任务列表复选框 + 图表起始 |
| `06-task-checkbox-after-click.png` | 点击复选框后状态（与 05 除工具栏焦点环外 0 像素差异） |
| `07-main-mermaid-image.png` | Mermaid SVG 实际渲染 + 图片占位（越界文案 + 相对路径）+ 表格表头 |
| `08-main-bottom.png` | 宽表格全部 8 行、嵌套小节/H3、列表、引用块；无横向溢出 |
| `09-second-document.png` | 第二实例移交：标签栏（≥2）显示、第二文档激活渲染 |
| `10-close-second-tab.png` | 第一次 Ctrl+W：第二标签关闭、回到 `reader-min.md`、标签栏隐藏 |
| `11-window-1024x640.png` | 1024×640 窗口：内容回流、工具栏完整、无重叠 |
| `12-welcome-after-close-all.png` | 第二次 Ctrl+W：欢迎占位状态（无标签、工具栏禁用项保留） |
| `runs.log` | 全部执行命令、输出、退出码、几何/主题记录（本轮 167 行） |
| `build.log` | release 构建输出 |
| `app.log` / `second-instance.log` | 应用 stdout/stderr（均为空 = 无错误输出） |
| `app-binary.sha256` | 证据二进制 SHA-256 |

## 9. 复现方式

```sh
# 前置：DISPLAY=:1 的 X11 会话、libxdo/xdo.h、cc、xwininfo、xwd、ffmpeg、pnpm
bash tests/desktop/run-smoke.sh          # 内部包含编译助手 + release 构建 + 全部检查
# 产物：artifacts/70-verification/evidence/early-run/
```

本报告与证据来自该脚本的**最终一次完整执行**（`runs.log` 时间戳 08:12:01–08:13:06）。开发过程中脚本共执行 4 次（前 3 次用于校对截图构图与检查时序，覆盖同一证据目录）；最终轮为增量构建（依赖已编译，39s），本会话首次全量 release 构建为 179s。**截图存在不等于核对**：§5 的每项判定均基于本轮对图像的逐张查看与像素测量（含 05/06 差异比对、焦点环坐标/颜色检测、列宽测量），未查看的项一律列入 §7。

## 10. 追溯

- **ADR-010**：真实运行（release 二进制）、libxdo 脚本化输入、`xwd→ffmpeg` 截图、固定条件、逐项核对、不可执行项 UNVERIFIED。
- **implementation-plan §2.3 / §5.3 / T-36–T-37**：EA-RUN 检查点内容与证据布局；§5.5 未验证清单中的 Wayland/抓包/干净安装项与本轮无关，200% 缩放记入 §7。
- **ui-spec §3.2/§3.6/§4/§6/§9**：UI01 默认状态（标签栏≥2、初始收起侧栏、禁用原因）、宽内容局部滚动、布局常量（52/36px、760px、17px/1.8）、回归样例检查清单（截断/焦点/关闭入口/横向溢出）。
- **wp-19 §6 / wp-19a §5.4**：沿用其构建/运行流程（`pnpm tauri build --no-bundle` + `DISPLAY=:1`）并把冒烟升级为固定条件、可复跑的核对脚本。

## 11. 结论与下一步

T-36 工具与 T-37 EA-RUN 均已完成：助手可直接编译并注入真实窗口；`run-smoke.sh` 在本机端到端复现（构建→运行→12 项证据截图→干净退出）；§5 的 18 项检查全部 PASS，未执行项在 §7 明确 UNVERIFIED，并记录 W-1–W-3 三项发现供后续任务处置。仓库测试基线同步复核：`pnpm test -- --run` → **29 文件 / 218 测试全部通过**。待独立质量审查与 Gate；建议 wp-23（README v0）随后执行，W-1 交由具备 `src/styles` 写入范围的任务修复并复用本脚本回归。
