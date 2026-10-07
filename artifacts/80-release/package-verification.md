# 纸栈 PaperStack · wp-50 最终发布包验证报告（Final Package Verification）

- **Producer**: agent:release-engineer
- **Artifact ID**: ART-80-RELEASE-PKGVERIFY
- **Artifact Type**: Release Evidence（最终 `.deb` 重建；元数据/载荷/字节比对；提取运行与系统打开冒烟；旧包取代记录）
- **Status**: VALID
- **Revision**: 1
- **Owner**: release-engineer
- **Task**: `wp-50-release`（任务分支 `task/wp-50-release`；父分支 `feat/v0.1.0`；基线提交 `a4e7a1ca65ddaffd13031add02f4f7acbb486a19`；产出提交主题 `docs(release): verify final package and readiness`）
- **Last Verified**: 2026-10-08
- **Scope**: 只读使用产品树与 `packaging/verify-deb.sh`；写入仅 `artifacts/80-release/`、`artifacts/70-verification/` 与 gitignored `output/`、`src-tauri/target/`。**未执行**系统安装/卸载、发布、推送或任何远端动作。

> **证据纪律**：本报告每条结果对应实际执行的命令与检查过的截图/日志/字节；命令一律原样记录（含绝对路径差异）。提取运行使用 `packaging/verify-deb.sh`（wp-43 脚本，未修改）；证据目录 `artifacts/70-verification/evidence/package-final/`。

---

## 1. 结论摘要

1. **最终包已从当前树重建**：`pnpm tauri build --bundles deb` → **BUILD_EXIT=0**；产物 `src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb`（**11,526,468 B**，sha256 **`f72e3dba…88799`**），已复制到 `output/paperstack_0.1.0_amd64.deb`（`cmp` 逐字节一致）。
2. **取代关系（supersession）**：旧 `output/paperstack_0.1.0_amd64.deb` = wp-43 产物（`b0f44fdb…b4968`，11,519,100 B，构建于 `7f5de8a`，**早于 wp-45/wp-47 修复**）已被本次重建**取代**；旧字节未保留（哈希在多份报告中有案），`output/` 与 bundle 目录现均为最终包。
3. **包内二进制即验收修订**：重建的 in-repo release 二进制 sha256 **`26c02d2d…f6a8c3`**（28,104,112 B）**与 AT Rev 7 / IT Rev 3 所验证的 `--no-bundle` 二进制完全一致**；deb 载荷二进制（`1f4e34c5…`）与其仅差 **3 字节**（tauri-bundler 注入 bundle 类型信息），来源可证。
4. **元数据与载荷核对通过**：`dpkg-deb -I/-f` = `Package: paperstack / Version: 0.1.0 / Architecture: amd64 / Maintainer: Quirkybrain / Depends: libwebkit2gtk-4.1-0, libgtk-3-0`；`-c` 载荷含 `usr/bin/paperstack`、`usr/lib/paperstack/{LICENSE,THIRD_PARTY_NOTICES.md}`、桌面项与 4 个图标；包内 `LICENSE`/`THIRD_PARTY_NOTICES.md` 与仓库根 **byte-identical**（`cmp`）。
5. **提取运行冒烟通过**（X11 `DISPLAY=:1`，提取二进制 + `fixtures/reader-min/reader-min.md`）：打开文档 → 拦截本地资源提示 → 关于页（`纸栈 PaperStack / 0.1.0 / Quirkybrain / GNU GPL v3.0 (GPL-3.0-only)` + 离线说明 + **「未配置对应源码入口；公开发行前必须补齐。」**）→ 许可证查看器渲染 **GPLv3 离线全文** → 第三方声明查看器渲染离线清单 → `WM_DELETE_WINDOW` **干净退出 exit 0**、无残留进程（截图 01–05）。
6. **IT08 系统打开（gtk-launch）通过**：以提取树的桌面项经 `gtk-launch paperstack <中文文件名>` 启动，进程命令行为目标文档路径，界面渲染该文档（截图 06/06b），干净关闭、无残留。
7. **维持 UNVERIFIED（未扩大声明）**：干净系统 `sudo dpkg -i`、Wayland、真实 IME、WebDriver/tauri-driver、抓包级证据等（§8）；A9 对应源码入口保持发布阻塞（无伪地址）。

---

## 2. 构建与产物身份

### 2.1 前置状态（`evidence/package-final/preconditions.txt`）

| 项 | 值 |
|---|---|
| 仓库 HEAD / 分支 | `a4e7a1ca65ddaffd13031add02f4f7acbb486a19` / `task/wp-50-release`；工作树干净 |
| 产品树一致性 | `git diff fa424ef..HEAD -- src src-tauri ':!**/tests/**'` = **空**（= AT Rev 7 / IT Rev 3 构建树） |
| 旧包（wp-43） | `output/paperstack_0.1.0_amd64.deb`：sha256 `b0f44fdba83b1bfa5bbca80293ee14c8dd1b25e32a602bd74bf098fa754b4968`，11,519,100 B，mtime 2026-10-08 00:49（构建于 `7f5de8a`，早于 wp-45/47） |
| 重建前 release 二进制 | sha256 `26c02d2d8f4d254abb9aaf332be8e0f8d1857c1f3cf097464bb0050835f6a8c3`（28,104,112 B） |
| 工具链 | pnpm 10.34.6 / node v24.15.0 / cargo 1.96.0；X11 `DISPLAY=:1` |

### 2.2 重建命令与结果（`evidence/package-final/build.log`）

```sh
pnpm tauri build --bundles deb        # 2026-10-08T05:07，仓库根
# → Finished `release` profile [optimized] target(s) in 36.40s
# → Bundling paperstack_0.1.0_amd64.deb
# → BUILD_EXIT=0
```

| 产物 | 路径 | 大小 | sha256 |
|---|---|---|---|
| **最终 .deb**（bundle） | `src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb` | **11,526,468 B** | **`f72e3dbab442e71dd0df9e0d2ebe90e5699b60960af2ab6824164ba8d4788799`** |
| **最终 .deb**（交付副本） | `output/paperstack_0.1.0_amd64.deb` | 11,526,468 B | 同上（`cmp` 一致，`output-copy-check.txt`） |
| in-repo release 二进制 | `src-tauri/target/release/paperstack` | 28,104,112 B | `26c02d2d…f6a8c3`（= 验收二进制） |
| deb 载荷二进制 | `usr/bin/paperstack`（提取） | 28,104,112 B | `1f4e34c53fd7ae53f6e96710c5b93eb1b6bdc297c0eeeda63337d9dbcdd95bd3` |
| ~~旧 wp-43 .deb~~（已被取代） | ~~`output/paperstack_0.1.0_amd64.deb`~~ | ~~11,519,100 B~~ | ~~`b0f44fdb…b4968`~~ |

- **载荷二进制 provenance**（`payload-binary-provenance.txt`）：`cmp -l` 显示与验收二进制仅 **3 字节**不同（tauri-bundler 对二进制做 bundle 类型 patching，日志行 “Patching … with bundle type information: deb”）；除该注入外载荷与 `26c02d2d…` 相同。由此，**最终包内运行代码即桌面验收（AT Rev 7）与 IT 复验（IT Rev 3）所执行的构建**（`--no-bundle` 同树产物；Rust release 构建在本环境可复现为同一哈希）。
- 取代说明：本次重建覆盖了 bundle 目录中的旧文件并替换 `output/` 副本；旧包哈希 `b0f44fdb…` 原样记录于 `wp-43-package.md` §6 与 `acceptance-it.md` §2，可追溯但不可再取回字节。`docs/paperstack/known-limitations.md` §3 中「当前 output 为 wp-43 产物、公开发布前必须重建」的表述由本任务完成并在此闭合。

---

## 3. 元数据核对（`dpkg-deb -I` / `-f`，`evidence/package-final/dpkg-deb-I.txt`）

| 控制字段 | 实测值 | 期望/来源 | 一致 |
|---|---|---|---|
| `Package` | `paperstack` | `tauri.conf.json` `productName` | ✓ |
| `Version` | `0.1.0` | `package.json` / `Cargo.toml` / `tauri.conf.json` 均 `0.1.0` | ✓ |
| `Architecture` | `amd64` | 目标平台 x86_64 | ✓ |
| `Maintainer` | `Quirkybrain` | `tauri.conf.json` `publisher` | ✓ |
| `Depends` | `libwebkit2gtk-4.1-0, libgtk-3-0` | 与二进制两条直接共享库链接一致（wp-43 §4.1） | ✓ |
| `Installed-Size` | `27624` KB | bundler 计算 | — |
| `Priority` | `optional` | bundler 默认 | — |
| `License:`（控制字段） | **不存在** | tauri-bundler 2.12.1 不生成（wp-43 §8.3 已记录） | 已知边界 |

- 版本一致性（实测）：`package.json` `"version": "0.1.0"`、`Cargo.toml` `version = "0.1.0"`、`tauri.conf.json` `"version": "0.1.0"`，与包控制字段及关于页显示（§5）一致；SPDX `GPL-3.0-only` 在 `Cargo.toml`/`package.json`/`tauri.conf.json` 与关于页同源（全文与第三方声明随包提供）。

---

## 4. 载荷清单与法务资源字节比对（`dpkg-deb -c`，`dpkg-deb-c.txt`）

| 载荷项 | 大小 | 说明 |
|---|---|---|
| `usr/bin/paperstack` | 28,104,112 B | 主程序（无开发服务器/Node/Rust/TeX 运行依赖） |
| `usr/lib/paperstack/LICENSE` | 35,149 B | 未改写 GPLv3 全文 |
| `usr/lib/paperstack/THIRD_PARTY_NOTICES.md` | 39,458 B | 依赖清单 |
| `usr/share/applications/paperstack.desktop` | 218 B | 显示名「纸栈 PaperStack」 |
| `usr/share/icons/hicolor/{32x32,128x128,256x256@2,1024x1024}/apps/paperstack.png` | 1,027 / 3,709 / 7,647 / 26,864 B | 图标集 |

- **字节比对**（`extract-files.txt`；`cmp` 通过）：
  - `LICENSE` 包内 = 仓库根 = `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` → **byte-identical**；
  - `THIRD_PARTY_NOTICES.md` 包内 = 仓库根 = `894703df263964da468aeebc669641f774e58f701bab9aefa150676563091f78` → **byte-identical**。
- 桌面项实测（`it08-desktop-entry.txt`）：`Categories=Utility;`、`Exec=paperstack`、`StartupWMClass=paperstack`、`Icon=paperstack`、`Name=纸栈 PaperStack`、`Terminal=false`、`Type=Application`。**注**：本包桌面项 `Exec` 不带 `%U/%F`（实际文件为准；`gtk-launch` 仍将命令行参数传给应用，见 §6）。
- `.deb` 不含 postinst/prerm 维护脚本（载荷清单未见 control 外脚本；`packaging/README.md` §「安装、卸载与回滚」同口径）。

---

## 5. 提取运行冒烟（AT30 可行部分；`verify-runs.log`）

命令（脚本原样，绝对路径）：

```sh
DISPLAY_VERIFY=:1 bash packaging/verify-deb.sh \
  "$PWD/src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb" \
  "$PWD/artifacts/70-verification/evidence/package-final"
# → 全部步骤 exit 0；app exit code: 0；no extracted app process remains
```

| 步骤 | 实测观测 | 证据 |
|---|---|---|
| 启动 + 打开文档 | 提取二进制 + `fixtures/reader-min/reader-min.md`；窗口「纸栈 PaperStack」，标题栏 `reader-min.md`，正文渲染 | `01-launch.png` |
| 本地资源提示拦截 | 聚合提示（fixture 引用了关联资源）→「保持阻止」 | `01b-prompt-blocked.png` |
| 关于页（AT30） | **纸栈 PaperStack / 版本 0.1.0 / 所属者：Quirkybrain / GNU GPL v3.0 (GPL-3.0-only)**；「本软件按 GPLv3 提供、无担保……」；「许可证与第三方声明随应用提供，可离线查看。」；**「获取对应源码」→「未配置对应源码入口；公开发行前必须补齐。」**（`sourceEntryUrl` 未配置的诚实原因，A9 阻塞，无伪地址） | `02-about.png` |
| 许可证查看器（离线） | 渲染 `GNU GENERAL PUBLIC LICENSE / Version 3, 29 June 2007` 全文（不依赖 `/usr` 安装与开发服务；读取包内资源目录） | `03-license-viewer.png` |
| 第三方声明查看器（离线） | 渲染 `THIRD_PARTY_NOTICES.md`（标题/方法/范围可见） | `04-third-party-viewer.png` |
| 干净关闭 | `WM_DELETE_WINDOW` → **app exit code: 0**；`pgrep` 无残留；窗口消失（根截图回退） | `05-after-close.png`、`verify-runs.log` |

- **数据隔离备注**：首次调用曾使用相对证据路径，应用按 XDG 语义将数据落到用户档案目录（`~/.local/share/com.quirkybrain.paperstack`，自 2026-10-07 已存在），导致 gtk-launch 截图出现会话恢复的额外标签页；随后**以绝对路径完整重跑**均通过，最终证据来自隔离运行；首轮截图与日志原样保留在 `superseded/first-invocation/`，说明见 `isolation-note.txt`（冒烟结论不依赖会话状态，已被重跑确认）。

---

## 6. IT08 可行部分：系统打开（`gtk-launch`）与包身份（`it08-gtk-launch-runs.log`）

```sh
dpkg-deb -x "$PWD/src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb" /tmp/opencode/ps-deb-final
env GTK_THEME=Adwaita:light XDG_DATA_HOME="$EV/data-gtk" XDG_CACHE_HOME="$EV/cache-gtk" \
  XDG_DATA_DIRS="$EXTRACT/usr/share:$XDG_DATA_DIRS" PATH="$EXTRACT/usr/bin:$PATH" \
  gtk-launch paperstack "$EV/inputs/it08/系统打开样例.md"
```

| 检查 | 实测结果 | 证据 |
|---|---|---|
| 包身份 | `path=…/paperstack_0.1.0_amd64.deb size=11526468`；sha256 `f72e3dba…`；`Package: paperstack / Version: 0.1.0 / Maintainer: Quirkybrain / Depends: …` | `it08-deb-identity.txt` |
| 载荷哈希（包内提取） | 二进制 `1f4e34c5…`；LICENSE `3972dc97…`；声明 `894703df…` | `it08-payload-hashes.txt` |
| 系统打开 | 经打包桌面项 `gtk-launch paperstack <中文文件名>` 启动成功；进程命令行含目标文档路径（`pgrep -af`）；界面以标签页打开并渲染 `系统打开样例.md`（标题+正文，混合中英文/公式/列表） | `06-gtk-launch-system-open.png`、`06b-gtk-launch-confirmed.png` |
| 关闭 | `WM_DELETE_WINDOW` 后无残留进程 | `it08-gtk-launch-runs.log` |

- 结论：`gtk-launch` 系统打开语义在最终包上达成；窗口标题/标签与目标文档一致（判定使用 gtk-launch 路径，未使用 CLI 回退）。
- 环境受限子项（干净安装/Wayland/IME）维持 UNVERIFIED，见 §8。

---

## 7. 证据清单（`artifacts/70-verification/evidence/package-final/`）

`preconditions.txt`、`build.log`（构建全程）、`artifact-identity.txt`、`deb-final.sha256`、`deb.sha256`、`output-copy-check.txt`、`dpkg-deb-I.txt`、`dpkg-deb-c.txt`、`dpkg-deb-x.log`、`extract-files.txt`、`tree-consistency.txt`、`payload-binary-diff.txt`、`payload-binary-provenance.txt`、`verify-runs.log` + 截图 `01-launch.png`、`01b-prompt-blocked.png`、`02-about.png`、`03-license-viewer.png`、`04-third-party-viewer.png`、`05-after-close.png`、`it08-gtk-launch-runs.log` + `it08-deb-identity.txt`、`it08-desktop-entry.txt`、`it08-payload-hashes.txt`、`extracted-binary.sha256`、`06-gtk-launch-system-open.png`、`06b-gtk-launch-confirmed.png`、`isolation-note.txt`、`superseded/first-invocation/**`（首轮截图与日志原样保留）。运行期 `data/`/`cache/` 目录不属于证据，未提交。

精确命令（复跑）：

```sh
pnpm tauri build --bundles deb
cp src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb output/
DISPLAY_VERIFY=:1 bash packaging/verify-deb.sh "$PWD/src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb" "$PWD/artifacts/70-verification/evidence/package-final"
```

---

## 8. UNVERIFIED 与边界（维持，不得读作通过）

| 项 | 状态/原因 |
|---|---|
| 真正干净系统 `sudo dpkg -i` 安装/卸载 | 无 root/干净环境；以提取运行 + 包内容核对替代（沿用 wp-43 §8.1、acceptance-it §6） |
| Wayland 会话（NF10/R30/AT30/IT08 的 Wayland 侧） | 本机仅 X11 `:1`（B2/A4） |
| 真实 IME 中文输入 | 合成输入环境（acceptance-it §6） |
| WebDriver/tauri-driver、拖放打开、抓包级零请求等 | 沿用既有 UNVERIFIED 清单（`docs/paperstack/known-limitations.md` §1） |
| deb `License:` 控制字段 | tauri-bundler 2.12.1 不支持（wp-43 §8.3）；SPDX 与全文以其他路径提供 |
| 性能达标 | 本报告不新增性能结论；校准数字见 release-readiness §4 |
| A9 对应源码入口 | 未配置=发布阻塞（无伪地址）；`sourceEntryUrl=null` + 原因如实呈现 |

- 第三方清单为依赖清单、非法律审计（wp-43 §8.4），不因本次重建改变。
- 本包重建对应修订 `a4e7a1c`（产品树 = `fa424ef`）；如后续修改 `src/`/`src-tauri/`/打包配置/锁文件，本报告按 Change Impact 失效，须重跑构建与验证。

---

## 9. 追溯

| 条款 | 本文承接 |
|---|---|
| 系统验证 §9 G-02/G-03/G-12、§10.2 C2；`docs/paperstack/known-limitations.md` §3 | §1–§6（最终包重建与复验，取代 wp-43 旧包） |
| AT30（R30）可行部分；IT08（R30/NF12/NF10）可行部分 | §5、§6 |
| ADR-008（包标识/离线资源/元数据一致/依赖按实际链接） | §2–§4 |
| acceptance-at Rev 7（`26c02d2d…` 验收构建）；acceptance-it Rev 3 | §2.2（二进制 provenance） |
| wp-43-package.md（打包机制已验证；旧包过期声明） | §2、§4、§8 |
| 证据 | `artifacts/70-verification/evidence/package-final/**`、gitignored `output/paperstack_0.1.0_amd64.deb` |

### 变更记录

- **Rev 1 — 2026-10-08（wp-50-release）**：从 `a4e7a1c` 重建 `.deb`（`f72e3dba…`，含 wp-45/47 修复；旧 wp-43 包 `b0f44fdb…` 取代）；元数据/载荷/字节比对、提取运行冒烟、gtk-launch 系统打开与 AT30/IT08 可行部分全部通过；未执行安装/发布动作。
