# ADR-001 技术栈与运行时（Stack and Runtime）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect（依计划书 §3 与 `config/project.md` 的固定技术决策）
- **Affected Artifacts**: `architecture.md` §1/§4/§11、`contracts.md` §9、`security-model.md` §6

## Context

计划书 §3 与 `config/project.md` 已将 v0.1.0 技术路线固定为：Tauri 2、React + TypeScript、Rust、Vite、SQLite（rusqlite bundled）；文档处理 unified/remark/rehype，公式 KaTeX，图表/代码 Mermaid/Shiki；CSS Modules + CSS 变量；pnpm + Cargo；Ubuntu 24.04 x86_64，GNOME Wayland/X11 均需验收；首发 .deb；离线可读（R30、NF02、PC-01/08）。Intake 确认产品代码从零建设（ART-10-INTAKE §5.2），无既有架构可复用。本 ADR 记录该固定选型的上下文与后果，不重开技术选型。

## Options

- **A（固定）**：Tauri 2 + WebKitGTK WebView + Rust 本地服务 + SQLite。依赖小、系统 WebView、本地能力经命令白名单暴露。
- **B（计划书已排除）**：Electron/Chromium、Node sidecar、必需 Web 服务器、远程数据库（PC-02）。
- **C（计划书已排除）**：纯网页应用——无法满足本地文件入口、系统剪贴板/浏览器、.deb 交付与离线要求（R01、R30）。

## Decision

1. 采用 Option A；模块化单体，单仓库单应用（计划书 §3.3、§3.4）。
2. 运行时拓扑（`architecture.md` §4）：单主窗口；Tauri 主线程 + 异步运行时；notify 监测线程；一个解析 Web Worker；SQLite 单连接（WAL）；reqwest 仅用于受控远程图片。
3. 数据层 rusqlite `bundled`（不要求用户安装 SQLite），schema 由 `data-model.md` 管理（ADR-004）。
4. Tauri 插件白名单：dialog（仅 Rust）、clipboard-manager（仅写文本）、opener（仅 Rust）、single-instance（仅 Rust）；**不注册** fs/shell/http/自动更新等通用能力（PC-02、NF03）。
5. 生产 CSP 采用 `security-model.md` §6 的字符串；`style-src 'unsafe-inline'` 为受控取舍——KaTeX/Shiki/Mermaid 以消毒后受信输出注入内联 style，文档样式在消毒阶段剥离，脚本由 `script-src 'self'` 阻断；替代方案（哈希/nonce 动态样式）在 v0.1.0 复杂度不成比例。
6. `devCsp` 仅额外放行 Vite HMR；生产构建不含。
7. 版本锁定：Node 24 LTS（锁补丁）、pnpm 记入 `packageManager`、Rust 工具链入 `rust-toolchain.toml`、两锁文件入库（PC-11；A3 在工程初始化时关闭）。

## Consequences

- 正面：安装包小、无捆绑浏览器、局部能力面可控、离线自然成立；Rust 单点承载文件/网络/存储便于安全审查。
- 代价：WebKitGTK 行为差异须在目标 WebView 实测（ADR-010）；rusqlite bundled 增加构建时间与二进制体积；CSP 的 `unsafe-inline` 需要质量审查持续确认“无用户可控样式/脚本通道”。
- 运行前提：用户无需 Node/pnpm/Rust/开发服务器/TeX Live（R30）；开发机需 WebKitGTK 开发库（计划书 §4.5）。
- 未来版本（F01–F07）通过格式适配器与命令扩展进入，不需要更换运行时；v0.1.0 不预置占位入口（DR-07）。

## Constraints

- 不得引入第二解析路线（markdown-it/react-markdown）或第二公式引擎（MathJax）（计划书 §4.1）。
- 不得向文档内容开放任意文件写入、Shell、SQL 或脚本执行（PC-02；R09）。
- 性能/内存预算为待实测工程目标，不得以未测数据宣称达标（NF04–NF06；A8）。

## Affected Artifacts

- `architecture.md`：系统上下文、运行拓扑、构建打包、环境约束。
- `contracts.md`：插件与能力边界（§9）。
- `security-model.md`：CSP 与 capabilities（§6）。
- 下游：实现任务（工程初始化、tauri.conf.json、capabilities）、ADR-008（发行）。
