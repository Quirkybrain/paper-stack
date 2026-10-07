# 纸栈 PaperStack · wp-43 打包与许可实现报告（系统验证条件 C2）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP43
- **Artifact Type**: Implementation Evidence Report（`artifacts/70-verification/system-verification.md` §9 G-02/G-03/G-12 与 §10.2 C2 的关闭证据）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-08
- **Owner**: implementation-engineer
- **Task**: `wp-43-package`（任务分支 `task/wp-43-package`；父分支 `feat/v0.1.0`；基线提交 `1e9321ca4e4a644f4b337b2ebbdedd206426d1df`；产出提交主题 `build(package): add deb packaging and legal resources`）
- **Components**: C-18（应用信息/法务文本读取；`src-tauri/src/`）、C-19（Rust 测试面；`src-tauri/tests/`）、打包面（`src-tauri/tauri.conf.json`、`src-tauri/icons/`、`packaging/`、`LICENSE`、`THIRD_PARTY_NOTICES.md`）
- **Scope**: 仅 `src-tauri/src/`、`src-tauri/tests/`、`src-tauri/tauri.conf.json`、`src-tauri/icons/`、`packaging/`、`LICENSE`、`THIRD_PARTY_NOTICES.md`、`artifacts/60-implementation/`、`artifacts/70-verification/`。无新增 npm/cargo 依赖；契约命令面与 IPC 字段未变（38 命令未动）。

## 1. 输入与基线核验

Pinned 输入在 2026-10-08 复核（SHA-256 与 `state/handoffs/wp-43-package.json` 逐字一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/adr/ADR-008-packaging-and-distribution.md` | `5b20116a…5919eef8` | ✓ |
| `artifacts/20-requirements/requirements-baseline.md` | `42784f67…6e35b85d` | ✓ |
| `artifacts/70-verification/system-verification.md` | `bc655b13…3b43b4015` | ✓ |
| `config/project.md` | `6dce9e3f…8c0f3b` | ✓ |

基线修订 `1e9321c` 的 Rust 全套件为 274 passed；本修订新增 5 个用例（见 §6）。未修改任何 pinned 输入；`packaging/`、`LICENSE`、`THIRD_PARTY_NOTICES.md` 为本任务新增。

## 2. 交付物一：LICENSE（未改写 GPLv3 全文）

- 文件：仓库根 `LICENSE`，674 行，sha256 **`3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`**（与源文件逐字节相同，`cmp` 通过）。
- 来源与核验（离线优先）：`/usr/share/common-licenses/GPL-3`（Ubuntu 24.04 `base-files` 13ubuntu10.4 所附；`dpkg -V base-files` 通过，文件未被改动）。文本为 FSF 正典 GPLv3（`GNU GENERAL PUBLIC LICENSE / Version 3, 29 June 2007`，含 “How to Apply These Terms” 全文与结尾 LGPL 提示）；未截断、未追加“or later”（第 639 行的 “either version 3 …” 属 FSF 正典模板的“如何应用”示例段落，非对产品的授权声明）。
- 联网交叉核验：本环境无法访问 `https://www.gnu.org/licenses/gpl-3.0.txt`（TLS/网络被阻断，实测 `curl` 失败），故按任务口径使用 Debian `common-licenses` 正典副本并记录哈希；该文件由 `base-files` 的 md5sums 校验背书。
- ADR-008 §3 / PC-07 / R30：`LICENSE` 作为 bundle resource 随包（见 §4），关于页离线可读（见 §5）。

## 3. 交付物二：THIRD_PARTY_NOTICES.md（依赖许可清单）

- 文件：仓库根 `THIRD_PARTY_NOTICES.md`，sha256 **`894703df263964da468aeebc669641f774e58f701bab9aefa150676563091f78`**。
- 生成方法（可复现）：`packaging/third-party-inventory.py`（无外部依赖、无需联网）：
  - **npm**：`pnpm licenses list --prod --json`（pnpm 10.34.6）→ **263 个包/版本**（MIT 210、ISC 35、Apache-2.0 6、BSD-3-Clause 6、Apache-2.0 OR MIT 1、BSD-2-Clause 1、(MPL-2.0 OR Apache-2.0) 1、EPL-2.0 1、Unlicense 1、khroma 1 项包元数据缺失→按其包内 `license` 文件人工可复核读取为 MIT）。
  - **Rust**：`cargo metadata --locked` 解析图，从 `paperstack` 根包沿**普通依赖边**可达的 crate → **540 个 crate**（全部带 SPDX 许可字段，无 NOASSERTION）。
  - **渲染资源与字体**：KaTeX（MIT，字体随包发行、无单独字体许可文件）、Shiki（MIT；实际装载语法 c/cpp/python/rust/java/javascript/typescript/bash/json/yaml/sql + 主题 github-light；逐件上游 TextMate 许可未随 npm 包提供——明确限制）、Mermaid（MIT，含 d3/elkjs/khroma 等运行期依赖）、SQLite（经 `libsqlite3-sys` bundled 静态编译，公有领域）、界面字体（系统回退，不再分发）。
- 覆盖限制（文档内明示，且非法律审计）：npm 为 production 闭包（含 `@types/*` 类型包），Rust 不含 build/dev/过程宏；解析图为上界（平台/feature 裁剪后未链接者仍可能出现）；许可结论应以真实锁文件为准并需法律审计。
- 引用的锁文件哈希（随文档生成，当前值）：`pnpm-lock.yaml` `d1b796a2…b10ff08`；`src-tauri/Cargo.lock` `7ef9a84f…5e78263`（完整值见 `evidence/package/source-hashes.txt` 与文档正文）。
- GPL-3.0-only 兼容性立场：所有运行期许可均为开源/自由软件许可，未发现已知 GPLv3 不兼容条目；MPL-2.0/EPL-2.0 依赖其二次许可条款，最终结论归法律审计；第三方条目保留原许可与作者（R30）。

## 4. 交付物三：打包配置、图标与文档

### 4.1 `src-tauri/tauri.conf.json`（bundle 元数据）

| 字段 | 值 | 说明 |
|---|---|---|
| `productName` | `paperstack` | ASCII 小写包标识；**显示名“纸栈 PaperStack”独立提供**（窗口标题、桌面项模板、关于页常量），符合 ADR-008 选项 B。修正了 bundler 对 `PaperStack` 做 kebab-case 产生 `Package: paper-stack` 的问题 |
| `bundle.targets` | `["deb"]` | 首发仅 .deb（ADR-008） |
| `publisher` | `Quirkybrain` | 映射 deb `Maintainer:` |
| `category` / `shortDescription` / `longDescription` | `Utility` / 英文短描述 / 英文长描述 | 桌面 `Categories=Utility;`、deb `Description` |
| `license` / `licenseFile` | `GPL-3.0-only` / `../LICENSE` | 版本/许可与 `Cargo.toml`/`package.json`/关于页同源 |
| `homepage` | 省略 | 无真实主页/源码入口（A9），不放伪地址 |
| `icon` | 4 个 PNG | 32/128/256(128@2x)/1024 |
| `resources`（map） | `../LICENSE→LICENSE`、`../THIRD_PARTY_NOTICES.md→THIRD_PARTY_NOTICES.md` | 置于资源目录根，安装后为 `/usr/lib/paperstack/`，应用经 `read_legal_text` 离线读取 |
| `linux.deb.desktopTemplate` | `../packaging/paperstack.desktop.hbs` | 显示名固定“纸栈 PaperStack”，`Exec/StartupWMClass/Icon=paperstack` |
| `linux.deb.depends` | **不配置** | tauri-cli 2.12.1 在 Linux 固定注入 `libwebkit2gtk-4.1-0, libgtk-3-0`（与二进制两条直接共享库链接一致，`readelf -d` 复核）；在配置中重复声明会被 bundler 原样拼接为重复项 |

### 4.2 图标（`packaging/icon.svg` → `src-tauri/icons/*.png`）

选择记录：最小“三页叠纸”标记 + 产品强调色 `#176b5b` 圆角方底；无文字、无渐变，32px 下可辨（打包验证截图与图标文件在案）。由 `packaging/generate-icons.sh` 经 ffmpeg/librsvg 栅格化生成 32×32、128×128、256×256（`128x128@2x.png`）、1024×1024（`icon.png`），替换模板默认图标。

### 4.3 `packaging/README.md`（deliverable）与 `packaging/verify-deb.sh`

- README：构建/前置条件/验证步骤/产物布局/安装与卸载回滚（`sudo dpkg -r paperstack`，用户数据目录说明）/许可与图标维护/诚实边界。
- verify-deb.sh：`dpkg-deb -I/-f/-c`、`dpkg-deb -x` 提取 + 与仓库根字节比对、提取运行冒烟（本地资源提示拦截、`End` 选择“关于”、许可证/第三方查看器截图、WM_DELETE_WINDOW 干净退出、残留进程检查）、证据落盘。两处测试脚本修正（非产品缺陷）：fixture 触发本地资源授权提示需先“保持阻止”；菜单打开时焦点在首个可用项，`Down×5` 在全项可用时会回绕，改用 `End` 直达末项“关于”；另对启动期 X 窗口瞬态竞态加入 wait 重试。

## 5. 离线法务阅读修复（C2 的“许可证查看器找不到文件或资源”）

- `src-tauri/src/services/info.rs`：`InfoService` 增加解析根列表；`resolve_legal_resource(name)` 依序查找 **① Tauri 资源目录**（生产 `/usr/lib/paperstack/`；开发期 tauri-build 亦会将资源复制到可执行文件旁）→ **② 开发仓库根**（`dev_repo_root()`，`CARGO_MANIFEST_DIR/..`，仅 debug 构建注入；release 二进制返回 `None`，绝不读取构建机路径）。`legal_availability()` 与 `read_legal_text()` 走同一解析；全部缺失仍为优雅的 `PS_IO_NOT_FOUND`。
- `src-tauri/src/state.rs`：`AppState::create` 在 debug 构建附加仓库根 fallback；release 行为不变。
- 测试（新增 5 个，全部通过）：
  - `services::info::tests::legal_text_resolution_prefers_the_resource_dir_and_falls_back_to_the_repo_root`（资源目录优先、fallback 生效）；
  - `services::info::tests::missing_legal_resource_is_a_graceful_not_found_error`（双缺失 → `PS_IO_NOT_FOUND`）；
  - `tests/legal_text.rs` 3 项（两端资源解析、双缺失、debug 构建仓库根含 `LICENSE`/`THIRD_PARTY_NOTICES.md`）。
- **A9 确认**：`AppInfo.legal.sourceEntryUrl = null` + `sourceEntryNote = about.sourceUnconfigured` 保持不变（既有契约测试继续通过）；关于页渲染“未配置对应源码入口；公开发行前必须补齐。”，无伪地址（截图 02/03/04 可见）。

## 6. 构建与验证（2026-10-08，精确命令与结果）

| 命令 | 结果 |
|---|---|
| `pnpm tauri build --bundles deb` | **BUILD_EXIT=0**；产物 `src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb`（log：`evidence/package/build.log`） |
| `dpkg-deb -I` / `-f` | `Package: paperstack`、`Version: 0.1.0`、`Architecture: amd64`、`Maintainer: Quirkybrain`、`Depends: libwebkit2gtk-4.1-0, libgtk-3-0`；无 `License:` 字段（tauri-bundler 2.12.1 无该控制字段——见 §8）；`Homepage` 省略 |
| `dpkg-deb -c` | `usr/bin/paperstack`、`usr/lib/paperstack/{LICENSE,THIRD_PARTY_NOTICES.md}`、`usr/share/applications/paperstack.desktop`、hicolor 32/128/256@2/1024 图标 |
| `dpkg-deb -x` 提取比对 | 包内 `LICENSE`/`THIRD_PARTY_NOTICES.md` 与仓库根 **byte-identical**（`cmp`），哈希见 `source-hashes.txt` |
| 提取运行冒烟（DISPLAY=:1，`fixtures/reader-min/reader-min.md`） | 启动 → 拦截本地资源提示 → 关于页 → **许可证查看器渲染 GPLv3 离线全文** → 第三方声明查看器渲染离线清单 → WM_DELETE_WINDOW 干净退出 **exit 0**，无残留进程（截图 01/01b/02/03/04，runs：`verify-runs.log`） |
| `cargo test --offline` | **22 套件，279 passed / 0 failed**（基线 274 + 5 新增；log `cargo-test.log`） |
| `cargo clippy --offline --all-targets -- -D warnings` | PASS（0 warning） |
| `cargo fmt --check` | PASS |

产物与交付：
- `.deb`：11519100 bytes（10.99 MiB），sha256 **`b0f44fdba83b1bfa5bbca80293ee14c8dd1b25e32a602bd74bf098fa754b4968`**；
- 已复制到 `output/paperstack_0.1.0_amd64.deb`（gitignored，哈希相同）供所有者取用。

## 7. 证据清单（`artifacts/70-verification/evidence/package/`）

`build.log`（构建）、`dpkg-deb-I.txt`、`dpkg-deb-c.txt`、`dpkg-deb-x.log`、`extract-files.txt`（提取树/桌面项/字节比对）、`deb.sha256`、`source-hashes.txt`（LICENSE/声明/锁文件哈希）、`cargo-test.log`（279/279）、`verify-runs.log` + `app.log`（冒烟全过程）、截图 `01-launch.png`、`01b-prompt-blocked.png`、`02-about.png`、`03-license-viewer.png`、`04-third-party-viewer.png`、`package-summary.txt`。运行期临时 `data/`、`cache/` 不提交。

## 8. 残余 UNVERIFIED / 边界（诚实陈述）

1. **干净系统 `sudo dpkg -i` 安装/卸载未执行**：需 root 与干净环境（系统验证 G-10）；本环境不满足，维持 UNVERIFIED（安装元数据与提取运行已验证，不等价于系统安装）。
2. **Wayland 未验证**：无 Wayland 会话（G-07/B2），冒烟仅 X11。
3. **deb `License:` 控制字段缺失**：tauri-bundler 2.12.1 不生成该字段（已核对其 2.12.1 源码与 CLI 注入逻辑）；SPDX `GPL-3.0-only` 在 `Cargo.toml`/`package.json`/`tauri.conf.json` 与关于页，全文/声明在包内。若发布流程要求控制字段，需上游 bundler 支持或后期后处理（不在本任务范围，未做）。
4. **第三方清单非法律审计**：Shiki 逐语法上游许可、KaTeX 字体上游许可未随 npm 包提供；MPL-2.0/EPL-2.0 兼容性依赖二次许可条款；结论需结合真实锁文件由法律审计确认（文档内已明示）。
5. **A9 仍为发布阻塞**：`sourceEntryUrl=null` + 原因（所有者输入缺失，未伪造）；NF12/AT30 的“对应源码入口”子项保持 OPEN。
6. **DPKG 构建的 `.deb` 文件名**：Tauri bundler 以 `productName` 命名，本任务将 `productName` 固定为 `paperstack` 后与 ADR-008 期望的 `paperstack_0.1.0_amd64.deb` 一致；桌面显示名不受影响。

## 9. 追溯

| 条款 | 本文承接 |
|---|---|
| ADR-008 §决策 1–4、6–7（包标识/离线资源/元数据一致/依赖按实际链接/交付清单） | §2–§6 |
| R30（关于显示/离线许可与第三方声明/无伪地址）；NF12（发行一致性） | §2–§6、§5（A9 确认） |
| PC-07（许可与归属）；PC-08（首发 .deb、离线、无开发依赖） | §2–§4、§6 |
| DR-06（GPLv3 全文、第三方声明、匹配源码入口[阻塞]、元数据一致） | §2–§4、§8.5 |
| 系统验证 §9 G-02/G-03/G-12、§10.2 C2 | §2–§6 全部关闭；仅“干净安装/系统级”维持 UNVERIFIED（§8.1） |
| A11（LICENSE/声明缺失） | 关闭（§2/§3） |
| 证据 | `artifacts/70-verification/evidence/package/**`（§7） |

## 10. 变更记录

### Rev 1 — 2026-10-08（wp-43-package）

- Producer `agent:implementation-engineer`；基线 `1e9321c`；新增 `LICENSE`（GPLv3 正典副本）、`THIRD_PARTY_NOTICES.md`（可复现生成）、`packaging/`（README/验证脚本/图标源/桌面模板/清单生成器）、deb bundle 配置与图标集；修复 `InfoService` 法务文本解析（资源目录 + debug 仓库根 fallback）并新增 5 个测试。
- 验证：`pnpm tauri build --bundles deb` PASS；`.deb` 元数据/清单/字节比对/提取运行（许可证与第三方查看器离线渲染、干净退出）PASS；Rust 279/279、clippy 0 warning、fmt PASS。
- 引用本报告的最新证据修订以本提交内容为准；上游变更（依赖、锁文件、ADR-008）应按 Change Impact 重跑 `packaging/third-party-inventory.py` 与 `packaging/verify-deb.sh`。
