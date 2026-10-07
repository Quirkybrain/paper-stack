# 纸栈 PaperStack

纸栈 PaperStack 是 **Linux 优先、本地文件优先的只读技术文档阅读器**：直接打开本地
Markdown 文件阅读，不修改原文件、不上传正文。当前版本 **v0.1.0（开发中）**，聚焦
Markdown 与数学公式阅读。

- 所属者：Quirkybrain
- 许可证：GPL-3.0-only（源码元数据已声明）；**`LICENSE` 全文与
  `THIRD_PARTY_NOTICES.md` 尚未加入仓库**，将在发布准备阶段加入。
- 验证环境：Ubuntu 24.04 LTS x86_64，仅 X11 会话完成真实验证（Wayland 未验证）。

## 当前交付状态（v0.1.0 开发中）

已可用（以真实 X11 运行与仓库测试为准，证据见下文）：

- 打开本地 Markdown（GFM：标题、列表、引用、表格、任务列表）并只读渲染；
- KaTeX 行内/块级数学公式；未知宏等公式错误按块回退并显示源码，不影响其余内容；
- Shiki 代码高亮（含行号）；Mermaid 图表在可见时渲染；
- 多文档标签（≥2 个文档时显示）、`Ctrl+W` 关闭当前文档；
- 单实例：再次执行 `paperstack <文件>` 会将文件移交到既有窗口打开；
- 图片缺失/越界时显示说明性占位块（含相对路径），不出现破损图标（允许加载
  路径未验证，见下）；
- 关闭全部文档后显示欢迎占位。

尚未完成（v0.1.0 范围内，后续工作包）：

- 欢迎/最近文档页、侧栏（文件树/大纲）、搜索、源码视图、检查抽屉与放大、
  设置/隐私/关于/诊断面板、更新提交、锚点恢复、大文档模式；
- 未实现的动作在工具栏中以**真实禁用**状态呈现（不提供假按钮或占位入口）；
- `.deb` 安装包、`LICENSE` 全文与第三方许可声明（发布准备阶段）。

## 前置条件

- Ubuntu 24.04 LTS x86_64（本轮验证仅覆盖 X11 会话；Wayland 未验证）。
- Node.js 24（本机 v24.15.0）与 Corepack（本机 0.34.6）；pnpm 版本由
  `package.json` 的 `packageManager`（`pnpm@10.34.6`）锁定。
- Rust 1.96.0（由 `rust-toolchain.toml` 固定；本机 rustc/cargo 1.96.0）。
- 系统开发库（Ubuntu 包名）：`libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、
  `libsoup-3.0-dev`、`libjavascriptcoregtk-4.1-dev`、`build-essential`。
- 桌面验证脚本额外需要：`libxdo-dev`（本机无 `libxdo.pc`，助手直接以
  `-lxdo -lX11` 链接）、`cc`、`xwininfo`、`xwd`、`ffmpeg`，以及可用的 `DISPLAY`。

## 构建、测试与运行（本机已验证命令）

以下命令均于 **2026-10-07** 在本机逐条实际执行（分支 `task/wp-23-readme`，基线提交
`a711967`），逐条命令、输出与退出码见 `artifacts/60-implementation/wp-23-readme.md`。

```sh
corepack prepare pnpm@10.34.6 --activate   # 版本与 package.json packageManager 一致
pnpm install --frozen-lockfile
pnpm typecheck                             # tsc --noEmit，0 错误
pnpm lint                                  # eslint .，0 错误 / 0 警告
pnpm test -- --run                         # 29 个测试文件 / 218 个测试全部通过（本轮复跑）
cargo test --manifest-path src-tauri/Cargo.toml   # 248 passed / 0 failed（本轮复跑）
pnpm build                                 # 前端产物 dist/
pnpm tauri build --no-bundle               # release 二进制（见下）
```

release 二进制路径：

```sh
./src-tauri/target/release/paperstack
```

以文件参数启动（本机已验证）：

```sh
./src-tauri/target/release/paperstack "$(pwd)/fixtures/reader-min/reader-min.md"
```

- 需要图形会话（本轮验证于 X11 `DISPLAY=:1`）；无文件参数启动时显示欢迎占位。
- 单实例行为：在应用已运行时再次执行上述命令，新进程退出（exit 0），文件在既有
  窗口中以新标签打开；实测应用主进程数保持 1。

说明：

- `pnpm tauri build --no-bundle` 的 `beforeBuildCommand` 会自动先执行 `pnpm build`。
  本轮 release 构建墙钟约 42 s（增量），二进制 32,235,576 字节，SHA-256 与
  `artifacts/70-verification/evidence/early-run/app-binary.sha256` 记录的 EA-RUN
  证据二进制一致。
- **调试构建**：不要直接运行 `cargo build` 产出的 debug 二进制——按 Tauri 约定它会
  加载 `devUrl`（`http://localhost:1420`），未运行开发服务器时会连接失败。需要可
  运行的调试构建时使用 `pnpm tauri build --debug --no-bundle`（产物
  `src-tauri/target/debug/paperstack`；本轮已验证可启动并渲染）。
- 开发模式 `pnpm dev` / `pnpm tauri dev` 本轮未复跑（wp-19a 报告 §6 记录其 Worker
  依赖预打包路径尚未验证）；请使用上述已验证构建路径运行应用。

### 桌面验证脚本（EA-RUN 复跑入口）

```sh
bash tests/desktop/run-smoke.sh
```

需要 X11 `DISPLAY`（默认 `:1`）以及 `libxdo`/`xdo.h`、`cc`、`xwininfo`、`xwd`、
`ffmpeg`。脚本执行 release 构建、固定浅色条件、启动真实应用、驱动检查并截图，
产物写入 `artifacts/70-verification/evidence/early-run/`；用法与限制见
`tests/desktop/README.md`。本轮已复跑通过（65 s，含构建；为避免覆盖 wp-21 已提交
证据，复跑使用证据目录重定向副本，详见 `artifacts/60-implementation/wp-23-readme.md` §2）。

## 测试与验证现状

- 前端（vitest）：**29 个测试文件 / 218 个测试通过**——2026-10-07 本轮复跑值；
  最后已知基线（EA-RUN 报告）同值。
- Rust（`cargo test`）：**248 passed / 0 failed**——2026-10-07 本轮复跑值
  （19 个测试 harness）；最后已知基线（wp-14a 报告）同值。
- EA-RUN 真实运行（wp-21，X11）：**18 项 PASS / 0 FAIL**；报告
  `artifacts/70-verification/early-run.md`，证据
  `artifacts/70-verification/evidence/early-run/`（12 张截图与 `runs.log` 等）。
- 以上数字为记录日期的实测值，不构成后续修订的持续保证；代码变更后需重跑。

### 明确未验证（UNVERIFIED，不得视为通过）

- Wayland 会话（本机仅 X11 `:1`；libxdo/XTEST 不适用于 Wayland）；
- 拖放打开、真实 IME 组合输入、真实（非 XTEST）键盘/鼠标交互；
- 200% 文字缩放；深色主题视觉走查；
- `asset:` 协议图片**允许加载**路径（尚无允许样例，仅观察到占位/拒绝路径）；
- 逻辑 1024×640 视口的精确回归组合（本机 1.25 设备比例下 X 窗口 1024×640 对应
  约 819×512 CSS 视口）；
- 表格/代码块局部横向滚动的实际触发；键盘走查超出前 3 个 Tab 停靠点、Esc 层级、
  模态焦点陷阱；
- Worker `usedWorker:true` 的 UI 可观测（诊断面板未实现）；
- WebDriver / tauri-driver E2E（本机缺驱动与权限，未执行）；
- 性能指标（冷启动、暖打开、查询、内存）：仅为计划目标值，尚未实测，未声明达标；
- WCAG 2.2 AA：为设计目标而非认证，未完成正式走查。

（前 7 项口径与 EA-RUN 报告 §7 一致；WebDriver、性能与可达性口径见
`artifacts/50-plan/implementation-plan.md` §5.4–§5.5。）

## 已知限制

- 完整清单与逐项依据见 `artifacts/70-verification/early-run.md`（§6 发现、§7 未验证）；
  桌面工具自身限制另见 `tests/desktop/README.md`。
- 图片资源：单文件打开仅授权该文件本身，相对资源路径显示为越界占位；允许加载的
  成功路径尚无验证样例。
- EA-RUN W-1（轻微视觉缺陷）：未聚焦时 skip link（「跳到正文」）在窗口左上角
  露出约 15 设备像素。
- 应用当前固定浅色令牌；系统深浅主题消费尚未接入（深色走查未执行）。
- v0.1.0 不包含编辑、账户、云同步、完整 PDF 与 LaTeX 编译（项目计划约束）。

## 目录结构

```text
src/          React + TypeScript 前端（document 解析/渲染管线、features/reader 阅读器、
              services、components、locales、styles）
src-tauri/    Tauri 2 + Rust 后端（commands、services、models；tauri.conf.json）
tests/        tests/desktop：X11 桌面验证工具（libxdo 助手、截图、run-smoke.sh；不入发行包）
fixtures/     固定样例（reader-min、encoding、contracts、tree、storage）
artifacts/    项目工程记录（需求、架构、计划、实现报告、验证证据）
```

## 文档导航

- v0.1.0 交付计划：`artifacts/50-plan/implementation-plan.md`
- EA-RUN 早期真实运行报告与 UNVERIFIED 清单：`artifacts/70-verification/early-run.md`
- 实现报告（阅读器/管线/Worker 等）：`artifacts/60-implementation/`
- 架构与 IPC 契约：`artifacts/30-architecture/architecture.md`、`contracts.md`
- 桌面验证工具用法：`tests/desktop/README.md`
