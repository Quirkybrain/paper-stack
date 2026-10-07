# ADR-010 桌面验证策略（Desktop Verification Strategy）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `architecture.md` §10/§12、`security-model.md` 无直接条文、测试与发布证据工件（后续）

## Context

DR-02–DR-05 要求：尽早运行真实主阅读页并逐项核对；固定窗口/字体/缩放条件下提供真实运行截图与检查结果；编译通过不得替代交互验收、截图存在不得替代视觉核对、浏览器测试不得替代 Linux 桌面验证；无法执行的检查必须标记“未验证”。`config/project.md` 计划测试路线为 WebdriverIO + tauri-driver/WebKitWebDriver。2026-10-07 本机实测（ART-20-RB §8.1；本次复核一致）：

- 仅 X11 会话（`XDG_SESSION_TYPE=x11`，`DISPLAY=:1`），**无 Wayland 会话**；NF10/R30/IT08 的 Wayland 侧无法执行。
- **无 `WebKitWebDriver`、无 `tauri-driver`、无 `webkit2gtk-driver` 包**；`sudo` 需密码、非交互不可用 → 不能安装驱动。
- 无 `xdotool`；`libxdo-dev` 头文件与 `libxdo.so` 存在，但 **无 `libxdo.pc`**（`pkg-config libxdo` 失败）→ 任何基于 libxdo 的工具需直接链接 `-lxdo` 或本地 .pc 包装。
- `xwd`、`ffmpeg`、`xdpyinfo` 可用；无 ImageMagick/scrot。

## Options

- **A：等待安装 WebDriver 驱动（tauri-driver/WebKitWebDriver）后做标准 E2E**。当前被 sudo 与包缺失阻塞；不能作为本轮唯一路径，且不得把不可执行检查写成通过（DR-05）。
- **B：真实应用 + 脚本化输入 + 截图**。以 libxdo 小型辅助工具（直接 `-lxdo` 链接）注入键盘/鼠标到真实窗口（`DISPLAY=:1`），用 `xwd → ffmpeg` 截 PNG；在固定条件（IXD §18.4：浅/深主题、1280×800 与 1024×640、200% 文字缩放）逐项核对（文本截断、焦点遮挡、层级、关闭入口、正文横向溢出）。
- **C：仅人工点击 + 截图**。截图可提供，但“无法执行检查标记未验证”的任务量大且回归困难；作为 B 的兜底。
- **D：浏览器（jsdom/无头）测试替代桌面**。DR-04 明令禁止；仅用于组件层单测。

## Decision

采用 **B 为主、C 兜底、A 保留为未来环境目标**：

1. **真实运行**：在 `DISPLAY=:1` 运行真实 Tauri 应用（开发构建用于迭代、发布构建用于证据）；不做浏览器模拟替代。
2. **输入自动化**：实现一个仅测试环境使用的小型 helper（仓库 `tests/desktop/`），通过 libxdo 直接链接（`cc ... -lxdo` 或 `build.rs` 探测 `/usr/include/xdo.h` + `libxdo.so`；无 `.pc` 时不经 pkg-config）。helper 不属于正式发行包（计划书 §4.4：测试控制不入包）。
3. **截图证据**：`xwd -display :1 -root`/窗口捕获 → `ffmpeg` 转 PNG；保存“输入样例、环境、操作、实际结果、截图”组合证据（SRS §8.1；DR-03）。
4. **固定条件回归**：按 IXD §18.4 的窗口/主题/缩放组合执行视觉核对；DR-03 的核对项逐条记录，不以“截图文件存在”代替核对。
5. **WebDriver 路线**：保留 `WebdriverIO + tauri-driver/WebKitWebDriver` 作为目标配置；在当前环境标记 **UNVERIFIED/环境阻塞**（不得写成通过）；若后续获得 sudo/软件包授权，再以本 ADR 的修订启用。
6. **Wayland**：所有 Wayland 相关验收（NF10/R30/IT08）标记 **UNVERIFIED**，交 A4 决策项；公开声明不得覆盖未验证环境（SRS §8.4）。
7. **组件/纯函数层**：vitest + Testing Library（jsdom）与 cargo test 独立执行，作为桌面验证的补充而非替代。

## Consequences

- 正面：在受限环境中仍可获得“真实应用 + 固定条件 + 可核对截图”的证据链；helper 可复跑、可脚本化；不虚报通过。
- 代价：IME/焦点等交互的自动化覆盖有限，需要人工核对项清单；libxdo 链接方式需在构建脚本中显式处理（无 `.pc`）。
- 风险：helper 使用 X11 特有 API，Wayland 下不可用（当前也无 Wayland）；若未来切换会话类型，验证策略需重评（本 ADR 修订）。
- 证据管理：测试运行与截图存档位置、命名与固定条件必须写入测试/证据工件，Release Gate 依此判定。

## Constraints

- 测试控制工具不得进入正式发行包（计划书 §4.4）。
- 不可执行检查一律标记“未验证”；不得以编译/截图/浏览器测试替代桌面验证（DR-04、DR-05）。
- 不修改系统安装（无 sudo）；如必须安装，按 A5 升级为授权事项。

## Affected Artifacts

- `architecture.md` §10（测试接缝）、§12（环境约束）。
- 后续：测试计划/证据工件、`tests/desktop/` helper、Release Gate 的未验证清单。
- 相关开放项：A4（Wayland）、A5（libxdo/系统依赖授权）、A10（无远端/CI）。
