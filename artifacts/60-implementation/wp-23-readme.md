# 纸栈 PaperStack · wp-23 README v0 验证报告（逐命令复跑与差异核对）

- **Producer**: agent:technical-writer
- **Artifact ID**: ART-60-IMPL-WP23
- **Artifact Type**: Implementation Evidence Report（README v0 交付物 + 每条“已验证命令”的本轮逐条复跑记录）
- **Status**: VALID
- **Revision**: 1
- **Owner**: technical-writer
- **Task**: `wp-23-readme`（任务分支 `task/wp-23-readme`；父分支 `feat/v0.1.0`；基线提交 `a71196735f50855cf65e87ac0e885df94e89ae10`；产出提交主题 `docs(readme): add verified build and usage readme`）
- **Components**: C-20 README（代码交付文档）；消费 T-38（implementation-plan §4.2）与 EA-RUN 检查点（§2.3/§5.3）
- **Last Verified**: 2026-10-07
- **Scope**: `README.md`、`artifacts/60-implementation/**`。未修改 `src/`、`src-tauri/` 源码与配置、`tests/`、`fixtures/`、框架文件、pinned 输入或 `artifacts/70-verification/` 已提交证据。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-23-readme.json` 一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/70-verification/early-run.md` | `76622428d0b201402b288bf7ec28321cd3f83f7003f45be2642fd8e1e902c134` | ✓ |
| `artifacts/60-implementation/wp-19-reader.md` | `5b59dd7166563d1be0f45235c783b33488f6343eacee814c5642b488f1c31f85` | ✓ |
| `artifacts/60-implementation/wp-19a-workerfix.md` | `2ef0291cb58a5d741f6864efea0b36ddd01a53b726dd3534c4c03edd1ea0c9e1` | ✓ |
| `config/project.md` | `6dce9e3fc47f729f748fb5eb5df4eba1ddd60411243609a5f9eceda1ac8c0f3b` | ✓ |

基线 `a711967`；进入与退出时工作树干净（`git status --porcelain` 仅显示本任务新增 `README.md`）；分支 `task/wp-23-readme`；`swe_guard.py status` 显示本任务 ACTIVE；`begin` 已对 `artifacts/60-implementation/` 建立快照。

本轮原始日志（临时保留，不随提交入库）：`/tmp/opencode/wp23/logs/01…09-*.log`、smoke 重定向证据 `/tmp/opencode/wp23/ea-run-evidence/`、截图 `/tmp/opencode/wp23/shots/`。报告表格中的关键输出已从这些日志转录。

## 2. 交付物与复跑方法

| 路径 | 内容 |
|---|---|
| `README.md` | 项目根代码交付 README（中文）：标识/许可、当前交付状态、前置条件、已验证命令、测试与验证现状（含 UNVERIFIED）、已知限制、目录结构、文档导航。 |
| `artifacts/60-implementation/wp-23-readme.md` | 本报告：逐命令复跑记录、差异与偏差、与既有证据的一致性。 |

**复跑方法说明（D-23-1）**：README 中的 `bash tests/desktop/run-smoke.sh` 按 `tests/desktop/README.md` 与 EA-RUN §9 的口径写入 `artifacts/70-verification/evidence/early-run/`。该目录为 wp-21 已提交证据、且不在本任务写范围（`README.md`、`artifacts/60-implementation/`）。为复跑而不覆盖已提交证据，本轮将脚本复制到 `/tmp/opencode/wp23/run-smoke-redirected.sh` 并仅改两行（`ROOT` 固定为本仓库、`EVIDENCE` 重定向到 `/tmp/opencode/wp23/ea-run-evidence`），其余内容逐字节相同：

```diff
29c29
< ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
---
> ROOT="/home/quirkybrain/code/claude-code-swe-framework-tests/claude-code-swe-framwork-test-v1.1/op/PaperStack"
32c32
< EVIDENCE="$ROOT/artifacts/70-verification/evidence/early-run"
---
> EVIDENCE="/tmp/opencode/wp23/ea-run-evidence"
```

被复跑的脚本逻辑（前置检查、helper 构建判断、release 构建、固定浅色条件、真实窗口交互、第二实例、缩放、干净关闭、日志记录）与本分支 `tests/desktop/run-smoke.sh` 完全一致；差量仅 `ROOT` 的等价固定（副本位于 `/tmp` 时无法由相对路径计算，取值仍为本仓库绝对路径）与证据输出位置。README 仍按仓库内规范命令与规范证据路径书写，并在文内指向本节。

## 3. 逐命令验证日志（工作目录 = 项目根；2026-10-07 08:19–08:23 +0800）

### 3.1 构建与测试命令

| # | README 命令 | 本轮执行 | 观察结果（摘要） | 退出码 | 与 README 一致 |
|---|---|---|---|---|---|
| 1 | `corepack prepare pnpm@10.34.6 --activate` | 同左 | `Preparing pnpm@10.34.6 for immediate activation...`；版本与 `package.json` `packageManager` 一致 | 0 | ✓ |
| 2 | `pnpm install --frozen-lockfile` | 同左 | `Lockfile is up to date, resolution step is skipped` / `Already up to date` / `Done in 550ms using pnpm v10.34.6`；锁文件未变（工作树保持干净） | 0 | ✓ |
| 3 | `pnpm typecheck` | 同左 | `tsc --noEmit`，无诊断输出 | 0 | ✓ |
| 4 | `pnpm lint` | 同左 | `eslint .`，无诊断输出 | 0 | ✓ |
| 5 | `pnpm test -- --run` | 同左 | `Test Files 29 passed (29)`；`Tests 218 passed (218)`；Duration 5.50s（08:19:09 起） | 0 | ✓（README 写 218） |
| 6 | `cargo test --manifest-path src-tauri/Cargo.toml` | 同左 | `test` profile 编译 15.98s；19 个 test harness 合计 **248 passed / 0 failed**（lib 51；集成含 19/23/24/21/20/18/12/12/11/9/8/7/6/3/2/2 等；main/doc-tests 0） | 0 | ✓（README 写 248） |
| 7 | `pnpm build` | 同左 | `tsc && vite build`，`✓ built in 1.68s`；主 chunk `index-AGznMw4w.js` 1,181.07 kB / gzip 361.16 kB；`parse.worker-Cl_Oe0ZH.js` 2,490.34 kB；仅有 >500 kB chunk 提示（非错误） | 0 | ✓ |
| 8 | `pnpm tauri build --no-bundle` | 同左 | `beforeBuildCommand = pnpm build` 自动执行；release 编译 `Finished release profile in 36.45s`；墙钟 41.85s；`Built application at: …/src-tauri/target/release/paperstack`；32,235,576 字节；mtime 2026-10-07 08:20:28 +0800 | 0 | ✓ |
| 9 | `pnpm tauri build --debug --no-bundle`（README“调试构建”注） | 同左 | `Finished dev profile [unoptimized + debuginfo] in 7.98s`；产物 `src-tauri/target/debug/paperstack`（373,742,408 字节） | 0 | ✓ |

二进制 SHA-256（release，本轮两次构建一致）：`9adca0345381d558a30611a0e6e52bb2bcff9e4d4f46cf9872bbc4a7fdef3a0d`。

### 3.2 运行与桌面命令

| # | README 命令/声明 | 本轮执行 | 观察结果（摘要） | 退出码/判定 | 与 README 一致 |
|---|---|---|---|---|---|
| 10 | `cc -O2 tests/desktop/xdo-helper.c -lxdo -lX11 -o tests/desktop/xdo-helper`（`tests/desktop/README.md` 记录的助手构建命令；`run-smoke.sh` 会自动按需重建，本轮为手动启动验证而单独执行） | 同左 | 助手编译成功（`xdo-helper` 为 gitignore 测试产物） | 0 | ✓ |
| 11 | `./src-tauri/target/release/paperstack "$(pwd)/fixtures/reader-min/reader-min.md"` | 同左（`DISPLAY=:1`） | `xdo-helper wait` 返回窗口 `0x2200003`；geometry `x=196 y=226 w=1280 h=800 viewable=1`；截图确认主阅读页渲染（H1/公式/坏宏回退/代码块）；应用 stdout/stderr 为空 | wait 0；应用正常 | ✓ |
| 12 | 单实例：再次启动移交既有窗口 | 同左（第二参数 `fixtures/encoding/utf8-cn-emoji.md`） | 第二实例 **exit=0** 并退出；进程计数（非自匹配口径）**1**；截图确认标签栏 `reader-min.md` + `utf8-cn-emoji.md`，第二文档激活渲染 | 0 | ✓（与 EA-RUN #17 一致） |
| 13 | 干净关闭（`WM_DELETE_WINDOW`） | `xdo-helper close` | `WM_DELETE_WINDOW sent to 0x2200003`；进程退出，无信号兜底 | 0 | ✓ |
| 14 | `bash tests/desktop/run-smoke.sh`（EA-RUN 复跑入口） | 重定向副本（见 §2） | **exit=0，总 65s（含 41s release 构建）**；全部 helper 命令 exit=0；窗口 `0x4c00003`；pgrep 主进程计数 1；`resize 1024 640` 精确到达并恢复 1280×800；`WM_DELETE_WINDOW` 一次即干净退出（无 SIGTERM/SIGKILL/第二次请求）；`app.log`、`second-instance.log` 均 0 字节；`color-scheme` 由 `prefer-dark` 固定为 `prefer-light` 后恢复为 `prefer-dark`；日志头部记录 `HEAD a711967 branch task/wp-23-readme`、`node v24.15.0; pnpm 10.34.6; rustc 1.96.0` | 0 | ✓（方法偏差见 §2，无产品差异） |
| 15 | 调试二进制可启动（README“调试构建”注） | `DISPLAY=:1 ./src-tauri/target/debug/paperstack "$(pwd)/fixtures/reader-min/reader-min.md"` | 窗口出现并渲染与 release 相同样例；应用日志为空；`WM_DELETE_WINDOW` 干净退出 | wait 0；正常 | ✓ |
| 16 | 无文件参数启动显示欢迎占位（README“运行”节） | `DISPLAY=:1 ./src-tauri/target/release/paperstack`（无参数） | 窗口 `0x2200003`；截图确认欢迎占位（`纸栈 PaperStack` + 「直接读取本地文件，不移动、不修改原文」，工具类按钮保持真实禁用）；应用日志为空；干净退出 | wait 0；正常 | ✓ |

## 4. 环境事实与跨证据一致性

| 项 | 本轮实测 |
|---|---|
| 工具链 | Node v24.15.0；Corepack 0.34.6；pnpm 10.34.6；rustc/cargo 1.96.0 (ac68faa20) |
| 会话 | X11 `DISPLAY=:1`，2520×1680（无 Wayland 会话） |
| 系统库（dpkg/ldd） | `libwebkit2gtk-4.1-dev` 2.52.6、`libgtk-3-dev` 3.24.41、`libsoup-3.0-dev` 3.4.4、`libjavascriptcoregtk-4.1-dev` 2.52.6、`build-essential`；桌面脚本另需 `libxdo-dev`/`libxdo3`（无 `.pc`） |
| release 二进制 SHA-256 | `9adca034…f3a0d`；与 `artifacts/70-verification/evidence/early-run/app-binary.sha256`（wp-21 证据）**逐字节一致** |
| 前端主 chunk | `index-AGznMw4w.js` 1,181.07 kB——与 wp-19a §5.1 记录一致 |
| vitest | 218/218（29 文件），与 EA-RUN §11 记录一致 |
| cargo test | 248/248，与 wp-14a §5 最后已知值一致；本轮为独立复跑 |
| 仓库状态 | 全部复跑前后 `git status` 干净；smoke 运行未触碰 `artifacts/70-verification/`（证据目录已重定向） |

## 5. 差异、偏差与发现（不掩盖）

- **D-23-1（复跑方法）**：smoke 复跑使用证据目录重定向副本（§2）。这是写范围约束下的方法偏差，非产品差异；被执行的脚本内容除两行路径外与仓库版本完全相同。
- **D-23-2（测量方法教训）**：首次以 `pgrep -c -f '<二进制绝对路径>'` 在复合 shell 命令中测量时返回 3——测量 shell 自身命令行包含该模式导致自匹配；改用不自匹配的测量后为 1，与 EA-RUN #17 一致。README 的单实例声明基于修正后的测量。无产品差异。
- **README/命令漂移检查**：无漂移。README 所有命令均对应 `package.json` scripts 或既有验证口径；`pnpm test -- --run` 的内部形式为 `vitest -- --run`（以运行模式退出），与 wp-19/EA-RUN 的既有命令一致，未改动。
- **W-1 复现一致**：本轮截图（smoke 01/05、manual-01）同样可见未聚焦 skip link 在左上角露出约 15 设备像素，与 EA-RUN §6 W-1 记录一致；README 据此保留该已知限制。
- **LICENSE 现状核对**：仓库当前无 `LICENSE`、`THIRD_PARTY_NOTICES.md` 文件（`ls` 确认）。README 明确写“尚未加入仓库，将在发布准备阶段加入”，未声称文件存在；与 `config/project.md` 记录一致。
- **调试构建注的验证**：wp-19 §6 D-19-9（`cargo build` 的 debug 二进制加载 `devUrl`）本轮未重复触发失败场景（避免无谓运行），但 README 采用的“使用 `pnpm tauri build --debug --no-bundle`”路径已由 #9/#15 本轮新鲜验证；未验证的 `pnpm dev`/`pnpm tauri dev` 已在 README 明确标注未复跑。
- 未发现 README 需要修正的失实命令或输出。

## 6. README 中 UNVERIFIED 清单的口径核对

README“明确未验证”清单与来源逐一对应（不得被读作通过）：

| README 条目 | 来源口径 |
|---|---|
| Wayland 会话；拖放/真实 IME/真实输入；200% 文字缩放；深色主题走查；`asset:` 允许加载路径；逻辑 1024×640 精确组合；局部横向滚动触发；键盘走查范围受限；`usedWorker:true` 可观测 | EA-RUN §7 逐项（原文口径） |
| WebDriver / tauri-driver E2E | implementation-plan §5.5（驱动缺失、无 sudo） |
| 性能指标未实测达标 | implementation-plan §5.4/§5.5（非基准机、仅校准；不声明达标） |
| WCAG 2.2 AA 目标非认证 | implementation-plan §5.4（目标非认证） |

## 7. 追溯

- **implementation-plan T-38（§4.2）**：README v0 = 构建/运行/测试已验证命令 + 已知限制初版；wp-23 提交范围 `README.md`；门禁 STANDARD“命令实际复跑”。
- **implementation-plan §2.3 / §2.1 IP-2**：README 命令复跑通过是 EA-RUN 检查点关闭条件之一；本报告即该证据。
- **框架规则（AGENTS.md）**：首次可运行代码交付须有项目根 README（已验证构建/运行/测试命令与当前限制）；本任务由 `technical-writer` 执行、`Producer: agent:technical-writer`。
- **config/project.md**：项目标识、GPL-3.0-only、v0.1.0 范围边界（不包含编辑/账户/云同步/完整 PDF/LaTeX 编译）、LICENSE 未加入的现状。
- **wp-19 §6 D-19-9 / wp-19a §5–§6**：debug-vs-release 行为、运行命令、Worker 预打包路径未验证声明。
- **EA-RUN §5/§7/§9/§11**：18 PASS/0 FAIL、UNVERIFIED 清单、复跑入口与证据布局、218 测试基线。

## 8. 结论与下一步

README v0 已按计划 T-38 交付：项目标识与许可现状、当前交付状态（不含未完成能力承诺）、前置条件、逐条本机复跑过的构建/测试/运行/桌面复跑命令、测试与验证现状（含记录日期与 UNVERIFIED 清单）、已知限制与文档导航齐备。全部 16 项复跑记录通过（含 `pnpm test -- --run` 218 通过复跑、`pnpm build`、release/debug 构建、真实启动、无参启动欢迎占位、单实例、smoke 复跑 exit=0），未发现命令漂移；方法偏差 D-23-1/D-23-2 已如实记录。待独立质量审查与 Gate；EA-RUN 检查点（IP-2）在 wp-23 门禁通过并合并后即可关闭。
