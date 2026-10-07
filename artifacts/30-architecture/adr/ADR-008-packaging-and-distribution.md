# ADR-008 打包与分发（Packaging and Distribution）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `architecture.md` §11/§13、`security-model.md` §6、`contracts.md` §3.7（命令 33/34）

## Context

R30：独立安装包支持 Wayland/X11，含离线渲染资源；无需开发服务器与 TeX 环境；关于页显示“纸栈 PaperStack”、实际版本、Quirkybrain、GPL-3.0-only；许可证与第三方声明离线可查；**未配置对应源码入口是发布阻塞项，不放伪地址**。NF12：包版本、归属、许可、第三方声明与对应源码信息一致，未配置则阻止发行。计划书 §1.5/§4.7：`package.json`/`Cargo.toml` 元数据（name `paperstack`、version `0.1.0`、author Quirkybrain、license GPL-3.0-only）；锁文件与工具链固定；首发 .deb。当前仓库 `LICENSE` 缺失、`THIRD_PARTY_NOTICES.md` 缺失（A11），且无 Git 远端、无 CI（A10）。

## Options

- **A：.deb 由 Tauri bundler 生成**（固定首发）；AppImage/Flatpak/发行版仓库留待后续（计划书 §5.5 范围外）。
- **B：产品名/包名使用中文“纸栈 PaperStack”作为包标识**。Debian 包名需 ASCII；界面显示名与包标识分离更稳妥。
- **C：许可与第三方声明以外部网页提供**。违反“离线可查”（R30、NF02）；否决。
- **D：对应源码入口在 about 中写占位 URL**。R30 明令禁止；必须为 `null` + 原因提示，发布前补齐（A9）。
- **E：第三方声明由人工维护 vs 自动生成**。v0.1.0 依赖集小且锁定，人工清单 + 版本核对可满足；自动工具留待后续（但需与锁文件核对）。

## Decision

采用 A/B（分离）/C（内嵌）/D（阻塞式空值）/E（人工清单）：

1. `tauri build --bundles deb`；`bundle.identifier = "com.quirkybrain.paperstack"`；二进制与包名 `paperstack`；显示名“纸栈 PaperStack”用于窗口/桌面项/关于页；`.deb` 产物 `paperstack_0.1.0_amd64.deb`。
2. 离线资源随包：KaTeX 字体、Shiki 语法/主题、Mermaid、界面字体回退；不得运行时访问 CDN（R30、NF02）；由 Vite 打包与 Tauri resources 保证。
3. `LICENSE`（未改写 GPLv3 全文）与 `THIRD_PARTY_NOTICES.md` 作为 bundle resources 随包；关于页经 `read_legal_text`（命令 34）离线读取；第三方条目保留原许可与作者，不统一改归 Quirkybrain（R30）。
4. 元数据一致性：`package.json`/`Cargo.toml`/`tauri.conf.json`/关于页/`get_app_info` 同源（版本 0.1.0、Quirkybrain、GPL-3.0-only、ipcContract `paperstack-ipc-r1`）；发布检查核对包内文件与版本。
5. 对应源码入口：`AppInfo.legal.sourceEntryUrl = null` 并附 `sourceEntryNote`；在真实入口配置前，NF12/AT30 相关项标记未满足并阻塞公开发布（A9）。不得虚构仓库或下载地址。
6. 不设置默认文件关联变更（R30 异常条款）；不启用托盘（计划书 §4.5）；`.deb` 依赖由实际链接结果决定（WebKitGTK/GTK 等），不把开发头文件列为用户运行依赖。
7. 建议的发布产物清单：可构建源码（含锁文件）、`.deb`、测试与验收证据、已知限制、使用说明、`LICENSE`、`THIRD_PARTY_NOTICES.md`、匹配源码入口（DR-06）。

## Consequences

- 正面：离线安装即读；许可信息可离线核验；打包路径单一、可重复。
- 约束与风险：A9（源码入口）与 A11（许可文件缺失）在发布前必须关闭，否则 Release Gate 只能记录阻塞；无远端/CI，构建与验证需本地执行并留证（A10）。
- 版本升级时 `.deb` 名称、关于页、锁文件、第三方声明必须同步核对（NF12）。
- 未来若增加仓库/CI，仅影响发布流程，不影响本 ADR 的应用内契约。

## Constraints

- 首版不包含打印导出、自动更新、插件市场等（计划书 §5.5；DR-07）。
- 安装包不得依赖开发服务器、Node、pnpm、Rust、TeX Live（R30）。
- 公开声明仅覆盖实际验证过的系统与格式（SRS §8.4）。

## Affected Artifacts

- `architecture.md` §11（构建与打包）、§13-1（A9 open item）。
- `contracts.md` 命令 33/34（AppInfo/合法文本）。
- 下游：release 任务、THIRD_PARTY_NOTICES 清单、发布检查表、`README.md`。
