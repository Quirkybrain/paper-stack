# 纸栈 PaperStack · v0.1.0 部署与回滚计划（Deployment & Rollback Plan）

- **Producer**: agent:release-engineer
- **Artifact ID**: ART-80-RELEASE-DEPLOY
- **Artifact Type**: Release Plan（本地 `.deb` 安装/核验/卸载/回滚步骤与边界；无远端分发）
- **Status**: VALID
- **Revision**: 1
- **Owner**: release-engineer
- **Task**: `wp-50-release`（任务分支 `task/wp-50-release`；父分支 `feat/v0.1.0`；基线提交 `a4e7a1ca65ddaffd13031add02f4f7acbb486a19`）
- **Last Verified**: 2026-10-08
- **Scope**: 计划文档。**本任务未执行**安装/卸载/系统级动作（无 sudo、无远端）；包级验证见 `artifacts/80-release/package-verification.md`、`artifacts/70-verification/evidence/package-final/**`。

> **执行边界**：以下 `sudo` 命令为**待所有者执行**的文档化步骤，非本任务运行记录。执行前请核对 §1 的哈希并确认授权。公开发行仍受 A9（对应源码入口）阻塞，本计划不构成公开发行批准。

---

## 1. 分发路径（本仓库，本地 only）

- **分发物**：`output/paperstack_0.1.0_amd64.deb`（gitignored；内容与构建产物逐字节一致）。
- **身份**（执行前核对）：

```sh
sha256sum output/paperstack_0.1.0_amd64.deb
# 期望 f72e3dbab442e71dd0df9e0d2ebe90e5699b60960af2ab6824164ba8d4788799
# 大小 11526468 bytes；Version 0.1.0；构建修订 a4e7a1c（产品树 = 验收构建 fa424ef）
```

- **无远端发布通道**：本仓库不推送、不发布、无 APT 仓库/签名源；包通过文件（U 盘/本地拷贝/内部文件服务由所有者决定）传递。任何公开发行/上架须先解除 **A9**（对应源码入口未配置，见 `release-readiness.md` §3）并另行评审。
- 包级验证状态：最终包已通过元数据/载荷/字节比对/提取运行/`gtk-launch` 系统打开（`package-verification.md`）；**干净系统安装（sudo）未执行**（环境受限，维持 UNVERIFIED）。

## 2. 前置条件（目标机）

| 项 | 要求 | 说明 |
|---|---|---|
| 系统 | Ubuntu 24.04 LTS x86_64 级别的 Debian 系桌面 | `Architecture: amd64` |
| 运行库依赖 | `libwebkit2gtk-4.1-0`、`libgtk-3-0` | 包控制字段 `Depends`；`apt install ./…deb` 可自动解析，`dpkg -i` 需依赖已在位（否则 `apt install -f` 补装） |
| 权限 | 安装/卸载需要 `sudo`（root） | 本仓库内未验证 |
| 桌面会话 | X11 已验证；Wayland 未验证（B2） | 公开声明须排除 Wayland 侧 |
| 磁盘 | ≥ 约 30 MB（Installed-Size 27,624 KB）+ 用户数据空间 | — |

## 3. 安装（文档化，未在本任务执行）

```sh
# 1) 校验分发物
sha256sum output/paperstack_0.1.0_amd64.deb   # = f72e3dba…d4788799

# 2) 安装（二选一；推荐 apt 以解析依赖）
sudo apt install ./output/paperstack_0.1.0_amd64.deb          # 推荐
# 或
sudo dpkg -i ./output/paperstack_0.1.0_amd64.deb && sudo apt install -f
```

- 包为无维护脚本的纯载荷包（无 postinst/prerm）；安装只写入对应 `/usr` 路径（§7）。
- 同版本重装（本重建包与旧 wp-43 包同为 `0.1.0`）：`dpkg -i` 可直接重装；`apt` 路径若提示“已是最新版本”，使用 `sudo apt install --reinstall ./output/paperstack_0.1.0_amd64.deb` 或 `sudo dpkg -i …`。
- 旧包（`b0f44fdb…`，早于 wp-45/47 修复）**不要安装**；如已安装，用本包重装覆盖。

## 4. 安装后核验（Post-install checks）

| # | 检查 | 命令/操作 | 期望 |
|---|---|---|---|
| 1 | 注册状态 | `dpkg -l paperstack` | `ii  paperstack  0.1.0  amd64` |
| 2 | 文件落位 | `dpkg -L paperstack` | `usr/bin/paperstack`、`usr/lib/paperstack/{LICENSE,THIRD_PARTY_NOTICES.md}`、桌面项、`hicolor` 图标（与 `package-verification.md` §4 一致） |
| 3 | 桌面项 | 应用菜单出现「纸栈 PaperStack」；`cat /usr/share/applications/paperstack.desktop` | `Name=纸栈 PaperStack`、`Exec=paperstack` |
| 4 | 启动 | 从菜单/或 `paperstack <文件.md>` | 窗口打开，中文界面；打开一份含公式/代码的 Markdown 正常渲染 |
| 5 | 关于页（AT30） | 更多菜单 → 关于 | `纸栈 PaperStack / 0.1.0 / Quirkybrain / GNU GPL v3.0 (GPL-3.0-only)`；「获取对应源码」显示「未配置对应源码入口；公开发行前必须补齐。」（A9 未解除前为预期文案） |
| 6 | 离线法务 | 关于页 →「查看许可证」「第三方声明」 | GPLv3 全文与离线清单可读（读取 `/usr/lib/paperstack/`，不联网） |
| 7 | 只读语义 | 打开任一文档，尝试选择/复制 | 可读可选可复制；**不写入源文件**（详见 §7） |
| 8 | 数据目录 | `ls ~/.local/share/com.quirkybrain.paperstack/` | 运行后生成/使用（`paperstack.sqlite3`、`storage/`、`WebKitCache/`、`logs/`） |
| 9 | 卸载前基线 | 记录 `dpkg -s paperstack` 与上述结果 | 供回滚对照 |

- 若核验失败：按 §6 卸载，保留失败证据（截图/日志），并按缺陷路由处理；不得将失败读作通过。

## 5. 升级 / 降级注记

- **升级**：以新版本 `.deb` 重复 §3 的 `apt install`/`dpkg -i`；数据位于用户目录（§6），包替换不触碰。
- **同版本重建重装**：见 §3 注（`--reinstall` 或 `dpkg -i`）。
- **降级**：`sudo apt install --allow-downgrades ./paperstack_<prev>_amd64.deb`；当前**无更早公开版本**可回退（wp-43 旧包不应使用），因此 v0.1.0 阶段实际回滚 = 卸载（§6）。
- **数据兼容性**：用户数据为 SQLite（`paperstack.sqlite3`，表 `settings/documents/recents/positions/session_tabs/session_meta/sidebar_state/authorizations/cache_meta`）。v0.1.0 为唯一修订；降级后旧版本对未来版本写入的数据**不做兼容承诺**（本版无降级目标）。持久化仅为阅读辅助记录，不含用户内容副本；如回滚后状态异常，可按 §6 清理数据目录重建。

## 6. 卸载与回滚

```sh
# 卸载（保留用户数据）
sudo dpkg -r paperstack          # 或 sudo apt remove paperstack

# 彻底清除（含包配置；仍不会删除用户目录）
sudo dpkg -P paperstack          # 或 sudo apt purge paperstack
```

- **残留数据目录（卸载不删除，需所有者决定是否清理）**：
  - `~/.local/share/com.quirkybrain.paperstack/`（本机实测存在：`paperstack.sqlite3`（+ `-wal`/`-shm`）、`storage/`、`WebKitCache/`、`CacheStorage/`、`logs/`、`mediakeys/`、`hsts-storage.sqlite`）；
  - `~/.cache/com.quirkybrain.paperstack/`（`packaging/README.md` 所列缓存位置；本机运行未出现，清理时一并检查）；
  - 彻底清理（可选、不可逆）：`rm -rf ~/.local/share/com.quirkybrain.paperstack ~/.cache/com.quirkybrain.paperstack`。
- **不会残留**：包文件仅位于 `/usr/bin/paperstack`、`/usr/lib/paperstack/`、`/usr/share/applications/paperstack.desktop`、`/usr/share/icons/hicolor/*/apps/paperstack.png`；`dpkg -r` 全部移除。无系统服务、无 udev/内核改动、无 postinst/prerm 副作用。
- **回滚触发**：安装后核验失败、依赖冲突、应用无法启动、离线法务不可读、崩溃/零写入被破坏等 → 卸载并按缺陷流程处理；旧包字节不再可取得（wp-43 包已被取代），如需历史版本须从源码重建对应修订。
- **回滚证据**：保留 `dpkg -r` 输出与失败现场（截图/日志），记录到缺陷报告；本计划不在执行环境中制造回滚演练。

## 7. 对源文件无影响（No source-file impact）

- **用户文档**：应用为只读阅读器；打开/选择/复制/搜索/导航均不写入源文件。证据：AT04 哈希/目录集合四段 `IDENTICAL`、IT01 输入树前后 IDENTICAL、导出/诊断保护测试（`commands_surface.rs`、AT28）。安装/卸载不触碰任何用户文档路径。
- **本仓库源码**：安装动作只写入目标机 `/usr` 与用户数据目录，不修改仓库工作树（`output/*.deb` 为 gitignored 分发副本）；卸载同理。
- **网络**：默认零请求（NF02 口径：阻止态进程树 0 socket；远程图片需显式单次允许）。
- **已知非对称**：卸载/清理用户数据目录会丢失最近阅读、会话恢复、阅读位置与授权记录（阅读辅助数据，非文档内容）——属预期行为。

## 8. 追溯

| 条款 | 本文承接 |
|---|---|
| 计划 T-73（发布就绪＋部署/回滚）；T-74 的部署边界 | 全文 |
| ADR-008（首发 .deb、离线、无开发依赖） | §1–§4 |
| 系统验证 §10.2 C2/C6、G-10；acceptance-it §6（干净安装 UNVERIFIED） | §1 注、§2、§4 |
| R30/NF12（离线许可/元数据/无伪地址）；NF01/AT04（只读零写入） | §4、§7 |
| `packaging/README.md`（构建/验证/安装/回滚/数据目录） | §2–§6 |
| `package-verification.md`（最终包验证证据） | §1、§4 |

### 变更记录

- **Rev 1 — 2026-10-08（wp-50-release）**：基于最终包 `f72e3dba…` 制定本地分发安装/核验/卸载/回滚步骤；命名残留数据目录；记录“未执行安装”边界与 A9 公开发行阻塞。执行状态：文档化计划，未经 sudo 演练（UNVERIFIED，环境受限）。
