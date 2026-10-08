# 纸栈 PaperStack

纸栈 PaperStack 是 **Linux 优先、本地文件优先的只读技术文档阅读器**：直接打开本地 Markdown 文件阅读，
不修改原文件、不上传正文，渲染全部离线完成。当前版本 **v0.1.0** 已通过仓库级发布门禁；
本轮计划先公开[源码仓库](https://github.com/Quirkybrain/paper-stack)，公开安装包留待后续。
应用中的对应源码入口（A9）尚未配置，见「许可与开源信息」。

- 所属者：Quirkybrain
- 许可证：GPL-3.0-only；仓库提供 `LICENSE` 与 `THIRD_PARTY_NOTICES.md`；wp-50 本地包含当时版本的法律文件
- 验证环境：Ubuntu 24.04 LTS x86_64；桌面验收在 X11 会话完成（**Wayland 未验证**，见
  [`docs/paperstack/known-limitations.md`](docs/paperstack/known-limitations.md)）

## 当前交付状态（v0.1.0）

已实现并经过真实运行与仓库测试验证（证据报告见「测试与验证现状」）：

- **打开与阅读**：本地 Markdown（GFM：标题、列表、引用、表格、任务列表、删除线）、UTF-8（含 BOM）；
  只读渲染，原文零写入（AT04 哈希/目录快照 IDENTICAL）；
- **数学公式**：KaTeX 行内/块级；未知宏等公式错误按块回退显示源码，不影响其余内容；
- **代码与图表**：Shiki 高亮（含行号、复制、换行、折叠）；Mermaid 流程图/时序图/类图在可见时渲染，
  其余图种与渲染错误有可读回退；
- **图片**：本地/远程资源按授权读取；缺失、越界、远程阻止均有说明性占位，不出现破损图标；
- **导航**：欢迎页与最近阅读、文件树、大纲（重复标题带序号）、页内锚点/脚注/跨文件链接
  （含非 ASCII 文件名）、阅读历史（Alt+←/→）；
- **搜索**：正文/源码双范围、区分大小写、命中计数与前后导航、公式源码命中标注、折叠块内命中；
- **源码视图**：只读、行号、与阅读位置互映射；>50 MiB 走只读源码分段窗口；
- **检查与放大**：公式/代码/图表检查、精确复制（字节核对）、图片与图表放大层；
- **更新**：文件监视 + 非模态更新横幅（现在更新/稍后）；保持当前阅读/跟随最新版本两种模式；
  选区或检查层存在时暂停自动更新；更新后精确/近似位置恢复；
- **设置**：字号/行距/正文宽度/主题（跟随系统/浅色/深色）、默认更新行为、语法模式、隐私、关于；
- **隐私**：最近/位置/会话/缓存/授权/日志分类清除（默认不预选、不删原文）、持久授权撤销、
  清除后停止写回直到显式重开；
- **授权对话框**：本地资源范围授权（默认不记住）、远程图片按文档会话允许（默认阻止）；
- **诊断**：可理解原因 + 错误类别/编号、默认折叠技术细节、复制摘要默认脱敏、导出预览与受保护位置拒绝；
- **大文档**：>10 MiB 或复杂度超预算时选择简化阅读/只读源码/取消；>50 MiB 直接进入只读源码窗口；
  简化阅读保留全文文本与基础结构、搜索与复制完整可用（窗口化挂载，详见用户指南）；
- **交付**：`.deb` 打包（元数据、离线许可资源与提取运行已验证）、桌面项、离线许可证与第三方声明查看器。

> **说明**：本分支（`v0.1.0`）为纯净源码发行版，仅包含程序运行、构建、测试与打包必需的代码、资源与文档。
> 完整的 AI 软件工程研发过程记录、50 个质量门禁报告（Gates）、合并证据（Merges）与全量真实验收截图均完整保存在 `main` 分支（见 `v0.1.0-process` 标签）。

验证矩阵摘要（详细测试可在当前源码上直接复跑，见下文命令）：

| 验证项 | 结果 | 说明 / 证据出处 |
|---|---|---|
| 桌面验收 AT01–AT30 | **30 PASS / 0 FAIL** | 30 项真实桌面场景全量通过（完整报告与截图见 `main` 分支） |
| 端到端验收 IT01–IT08 | **8/8 PASS** | 打包提取运行验证全量通过（完整报告见 `main` 分支） |
| 独立复审（A/B） | **18/18 关闭** | 安全核心与前端管线 18 项发现已全部闭环修复 |
| 前端测试 | 73 文件 / **588 通过** | 源码内直接执行 `pnpm test -- --run` |
| Rust 测试 | **282 通过 / 0 失败** | 源码内直接执行 `cargo test --manifest-path src-tauri/Cargo.toml` |
| 契约/语义向量 | 6 文件 / **89 通过** | 源码内直接执行 `pnpm vitest run --config tests/contracts/vitest.config.ts` |

环境受限的未验证项（Wayland、干净系统安装、WebDriver E2E、抓包级零请求、真实 IME 等）与性能校准口径
见 [`docs/paperstack/known-limitations.md`](docs/paperstack/known-limitations.md)；**均不得读作通过**（DR-05）。

## 前置条件

### 运行（最终用户）

- Ubuntu 24.04 LTS x86_64，图形会话（本轮仅在 X11 验证；Wayland 未验证）。
- 运行期依赖（.deb `Depends`）：`libwebkit2gtk-4.1-0`、`libgtk-3-0`；其余库由这两个包传递拉取。
- 资源占用：见已知限制中的性能校准（本机空闲 PSS 校准值高于 250 MiB 设计预算，非认证）。

### 构建与开发（开发者）

- Ubuntu 24.04 LTS x86_64。
- 系统开发库：`build-essential`、`pkg-config`、`libwebkit2gtk-4.1-dev`
  （传递 `libgtk-3-dev`、`libsoup-3.0-dev`、`libjavascriptcoregtk-4.1-dev`）。
- Node.js 24 与 Corepack；pnpm 由 `package.json` 的 `packageManager` 锁定为 `pnpm@10.34.6`。
- Rust 1.96.0（`rust-toolchain.toml` 固定）。
- 桌面验证脚本额外需要：`libxdo-dev`（本机无 `libxdo.pc`，助手直接以 `-lxdo -lX11` 链接）、`cc`、
  `xwininfo`、`xwd`、`ffmpeg`，以及可用的 `DISPLAY`。

## 已验证命令

以下命令均在本仓库本机实际执行过（对应工程阶段证据见 `main` 分支 `artifacts/` 目录）。未执行或不可执行者单独标注。

```sh
# — 工具链与依赖 —
corepack prepare pnpm@10.34.6 --activate   # 与 package.json packageManager 一致（wp-23 §3.1）
pnpm install --frozen-lockfile             # 锁文件校验通过（wp-23 §3.1）

# — 检查与测试 —
pnpm typecheck                             # tsc --noEmit（wp-45 §3.2、wp-47 §4：PASS）
pnpm lint                                  # eslint .（wp-45 §3.2、wp-47 §4：PASS）
pnpm test -- --run                         # 73 文件 / 588 通过（acceptance-it Rev 3 / acceptance-at Rev 7）
pnpm vitest run --config tests/contracts/vitest.config.ts   # 6 文件 / 89 通过（system-verification §7.3）
cargo test --manifest-path src-tauri/Cargo.toml             # 282 通过 / 0 失败（wp-45 §3.2）

# — 构建与运行 —
pnpm build                                 # 前端产物 dist/（wp-47 §4：PASS）
pnpm tauri build --no-bundle               # release 二进制（wp-48 构建日志：40.29s，BUILD_EXIT=0）
./src-tauri/target/release/paperstack fixtures/reader-min/reader-min.md   # 需图形会话

# — .deb 构建与提取运行（已执行） —
pnpm tauri build --bundles deb             # wp-50 最终包重建已通过；产物见下
dpkg-deb -x src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb /tmp/paperstack-deb
/tmp/paperstack-deb/usr/bin/paperstack fixtures/reader-min/reader-min.md

# — 系统安装（本环境未执行，UNVERIFIED） —
sudo dpkg -i src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb
# 或（可自动解析依赖）：sudo apt install ./paperstack_0.1.0_amd64.deb
```

`.deb` 产物路径（Tauri bundler 命名）：

```sh
src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb
```

说明：

- `pnpm tauri build --no-bundle` 的 `beforeBuildCommand` 会自动先执行 `pnpm build`。
- `pnpm tauri build --bundles deb` 已验证（`BUILD_EXIT=0`）：包元数据 `Package: paperstack`、
  `Version: 0.1.0`、`Depends: libwebkit2gtk-4.1-0, libgtk-3-0`；包内 `LICENSE`/`THIRD_PARTY_NOTICES.md`
  在 wp-50 验证时与当时仓库根逐字节一致；提取运行、离线许可查看与干净退出见 `main` 分支验证报告 §1–§6。之后若源码、打包配置或声明改变，须重建并复验。
- **`sudo dpkg -i` / `sudo apt install` 系统安装在当前环境未执行**（无 root/干净环境；维持 UNVERIFIED，
  见 `docs/paperstack/known-limitations.md`）。已执行的是 `dpkg-deb -x` 提取运行路径（IT08 同一路径）。
- 本地 `output/paperstack_0.1.0_amd64.deb` 是 wp-50 从验收修订重建并验证的包，sha256
  `f72e3dbab442e71dd0df9e0d2ebe90e5699b60960af2ab6824164ba8d4788799`；它未纳入 Git。
  本轮只准备公开源码，不发布该包。后续声明或源码变更后，公开安装包须从最终修订重新构建、复验。
- **调试构建**：不要直接运行 `cargo build` 产出的 debug 二进制——按 Tauri 约定它会加载 `devUrl`
  （`http://localhost:1420`），未运行开发服务器时会连接失败。需要可运行的调试构建时使用
  `pnpm tauri build --debug --no-bundle`（wp-23 §3.1 已验证可启动）。`pnpm dev` / `pnpm tauri dev`
  未验证（wp-19a §6），请使用上述已验证构建路径运行应用。
- 桌面验证脚本（EA-RUN 复跑入口）：`bash tests/desktop/run-smoke.sh`（需要 X11 `DISPLAY` 与上述工具链；
  用法与限制见 `tests/desktop/README.md`）。

## 使用要点

详细步骤与逐区说明见 **[`docs/paperstack/user-guide.md`](docs/paperstack/user-guide.md)**；速览：

- **打开**：`Ctrl+O` 打开文件、`Ctrl+Shift+O` 打开目录；欢迎页含最近阅读与内置示例；再次打开同一文件
  激活已有标签；命令行 `paperstack <文件>` 打开，应用已运行时移交既有窗口（单实例）。
- **搜索**：`Ctrl+F`；「正文/源码」范围与「区分大小写」；Enter/Shift+Enter 前后命中；输入法组合期间
  不提交查询；折叠块内命中会先展开再定位。
- **源码视图**：更多菜单 →「查看源码 / 返回阅读」；只读、行号、与阅读位置互映射。
- **检查与复制**：公式/代码/图表的「查看源码/复制/放大」；代码复制为精确字面载荷（字节核对）。
- **更新**：保持当前阅读或跟随最新版本（设置 →「文件与更新」）；「稍后」折叠为「有新版本」标记。
- **设置**：`Ctrl+,`（阅读/文件与更新/语法/隐私/关于）；Aa 浮层快速调整字号、行距、宽度与主题。

## 测试与验证现状

- **前端（vitest）**：73 文件 / **588 通过**（2026-10-08 最终修订复跑；`acceptance-at.md` §R7.3、
  `acceptance-it.md` §R3.1；日志 `artifacts/70-verification/evidence/it-rerun2/unit-suite-wp48.log`）。
- **契约/向量**（`pnpm vitest run --config tests/contracts/vitest.config.ts`）：6 文件 / **89 通过**
  （`artifacts/70-verification/system-verification.md` §7.3；此后 `tests/contracts/` 未变更）。
- **Rust（`cargo test`）**：**282 通过 / 0 失败**（`artifacts/60-implementation/wp-45-fix-it.md` §3.2）。
- **桌面验收 AT01–AT30**：**30 PASS / 0 FAIL**（`artifacts/70-verification/acceptance-at.md`）。
- **端到端验收 IT01–IT08**：**8/8 PASS**（`artifacts/70-verification/acceptance-it.md`）。
- **独立复审**：**18/18 关闭**（`artifacts/60-review/review-rereview.md`）。
- 以上为本机记录日期的实测值，不构成后续修订的持续保证；代码变更后需重跑受影响层。环境受限子项与
  性能校准口径见已知限制（不得读作通过）。

## 已知限制

完整、逐项依据的清单见 **[`docs/paperstack/known-limitations.md`](docs/paperstack/known-limitations.md)**；要点：

- Wayland、干净系统 `sudo dpkg -i`、WebDriver/tauri-driver E2E、抓包级零请求、真实 IME 等为 **UNVERIFIED**；
- 性能数字（含大文档首屏/索引/CPU）为**本机校准，非认证**；全量模式（非简化）对超大文档仍为超线性，
  简化模式以有界窗口挂载缓解；本机空闲 PSS 高于 250 MiB 设计预算；
- 简化阅读为有意降级模式（重型块显示源码；未挂载块不渲染 DOM，但全文仍可搜索）；
- Tauri asset scope 的 forbidden 集在进程内不可逆：撤销后同进程重开同一路径的图片保持阻止直到重启
  （安全优先的超额阻止）；
- 界面当前仅简体中文（zh-CN）；系统主题/深色视觉走查未完成；
- **A9（应用内对应源码入口）未配置**：公开安装包仍受阻；关于页如实显示未配置原因。

## 许可与开源信息

- 许可证：**GPL-3.0-only**。`LICENSE` 为未改写的 GNU GPLv3 全文（674 行，sha256 `3972dc97…`），
  随仓库提供；wp-50 本地包曾包含此全文（安装后位于 `/usr/lib/paperstack/`），关于页可离线查看（IT08）。
- 第三方声明：`THIRD_PARTY_NOTICES.md`（npm production 闭包 263 个包/版本、Rust 运行期闭包 540 个 crate；
  生成器 `packaging/third-party-inventory.py`；**非法律审计**，MPL-2.0/EPL-2.0 等兼容性结论需法律复核）。
- **对应源码入口（A9）：应用内尚未配置**。拟公开的源码仓库地址为
  [Quirkybrain/paper-stack](https://github.com/Quirkybrain/paper-stack)；待可访问且版本匹配的源码修订确定后，
  须将入口写入应用并验证。关于页目前仍显示「未配置对应源码入口；公开发行前必须补齐。」
  （R30/NF12）；在此之前不对外发布安装包。
- 版本元数据（`package.json` / `Cargo.toml` / `tauri.conf.json` / 关于页）一致为 0.1.0；
  `tauri-bundler` 2.12.1 不生成 deb `License:` 控制字段（SPDX 标识与许可全文在元数据/包内资源，
  见已知限制与 `packaging/README.md`）。

## GitHub 源码发布范围

本轮准备公开源码仓库，保留全部既有 Git 提交与分支历史。历史工程报告、日志、截图等
`artifacts/` 证据文件已受 Git 跟踪；`.gitignore` 中的 `/artifacts/` 规则只影响新增未跟踪文件，
不移除这些历史证据。仓库内的本机路径及提交者身份也会随完整历史公开。

源码仓库不包含 `output/` 中的本地 `.deb`。公开安装包将另行发布，需先完成应用内 A9
入口、第三方许可待核项，并在最终源码与声明修订上重新构建、验证安装包。

## 目录结构

```text
src/              React + TypeScript 前端（document 管线、features/reader|search|settings、
                  services、locales、styles）
src-tauri/        Tauri 2 + Rust 后端（commands、services、models；tauri.conf.json、capabilities）
tests/contracts/  契约与语义向量（前端侧独立 vitest 配置）
tests/desktop/    X11 桌面验证工具（libxdo 助手、驱动脚本；不入发行包）
tests/perf/       性能校准脚本（NF04–NF07）
fixtures/         固定样例（rendering、encoding、search、security、update、tree、storage、contracts）
packaging/        .deb 打包配置、图标源、验证脚本与第三方清单生成器
docs/paperstack/  v0.1.0 产品文档（使用指南、已知限制、发布说明）
output/           本地打包产物（.deb；gitignored）
artifacts/        已跟踪的历史工程报告与验证证据（新增未跟踪文件由 .gitignore 忽略）
```

## 文档导航

- 用户指南（v0.1.0）：[`docs/paperstack/user-guide.md`](docs/paperstack/user-guide.md)
- 已知限制与未验证清单：[`docs/paperstack/known-limitations.md`](docs/paperstack/known-limitations.md)
- 发布说明（v0.1.0 草案）：[`docs/paperstack/release-notes-v0.1.0.md`](docs/paperstack/release-notes-v0.1.0.md)
- 打包、安装与回滚：`packaging/README.md`
- 桌面验证工具用法：`tests/desktop/README.md`
- 交付计划：`artifacts/50-plan/implementation-plan.md`
- 验收与验证报告：`artifacts/70-verification/`（`acceptance-at.md`、`acceptance-it.md`、
  `system-verification.md`、`unit-integration-report.md`）
- 实现与修复报告：`artifacts/60-implementation/`（含 `wp-32a-perf.md`、`wp-43-package.md`、
  `wp-45-fix-it.md`、`wp-47-fix3.md`）
