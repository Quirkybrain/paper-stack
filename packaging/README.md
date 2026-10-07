# PaperStack 打包与发行（packaging/）

本目录承载 v0.1.0 首次发行所需的打包配置、脚本与说明（ADR-008：首发 `.deb`，
由 Tauri bundler 生成；AppImage/Flatpak 留待后续）。

| 文件 | 用途 |
|---|---|
| `README.md` | 本文档：构建、验证、安装/回滚、许可与图标维护 |
| `verify-deb.sh` | `.deb` 离线验证驱动：元数据/清单/资源字节比对 + 提取运行冒烟（截图取证） |
| `third-party-inventory.py` | 生成仓库根 `THIRD_PARTY_NOTICES.md`（npm `pnpm licenses list --prod` + Rust `cargo metadata` 运行期闭包） |
| `icon.svg` | 图标源文件（极简“纸栈”三页叠纸图形，产品强调色 `#176b5b`） |
| `generate-icons.sh` | 由 `icon.svg` 经 ffmpeg/librsvg 重新生成 `src-tauri/icons/*.png` |
| `paperstack.desktop.hbs` | `.deb` 的 freedesktop 桌面项模板（显示名固定为“纸栈 PaperStack”，R30/ADR-008） |

## 产物

```sh
pnpm install                 # 锁定依赖（pnpm 10.34.6，见 packageManager）
pnpm tauri build --bundles deb
```

- 构建产物（Tauri bundler 命名，与 ADR-008 一致）：`src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb`
  - `productName` 固定为 ASCII 小写 `paperstack`，使控制字段 `Package: paperstack` 与文件名
    同源；界面显示名“纸栈 PaperStack”由窗口标题、桌面项模板与关于页单独提供（ADR-008 选项 B）。
- `.deb` 载荷（提取运行已实测）：
  - `/usr/bin/paperstack` — 主程序（无开发服务器/Node/Rust/TeX 依赖，R30）；
  - `/usr/lib/paperstack/LICENSE`、`/usr/lib/paperstack/THIRD_PARTY_NOTICES.md` —
    许可证与第三方声明，应用“关于”页离线读取（R30/NF12）；
  - `/usr/share/applications/paperstack.desktop` — 显示名“纸栈 PaperStack”，`Exec=paperstack`；
  - `/usr/share/icons/hicolor/<size>/apps/paperstack.png` — 由 `bundle.icon` 生成的图标集。
- 运行期依赖：Tauri CLI 在 Linux 上自动注入
  `Depends: libwebkit2gtk-4.1-0, libgtk-3-0`（tauri-cli 2.12.1），与二进制的两条直接
  共享库链接（`libwebkit2gtk-4.1.so.0`、`libgtk-3.so.0`）一致；其余库由这两个包传递拉取。
  因此 `tauri.conf.json` 不再重复声明 `linux.deb.depends`（重复会被 bundler 原样拼接）。

## 前置条件（Ubuntu 24.04 LTS x86_64）

- 构建必需（本机实测版本）：`build-essential`、`pkg-config`、
  `libwebkit2gtk-4.1-dev`（传递 `libgtk-3-dev`/`libjavascriptcoregtk-4.1-dev`/
  `libsoup-3.0-dev`/`libglib2.0-dev`）、Node.js 24 + pnpm 10.34.6
  （`corepack`；`packageManager` 已锁定）、Rust 1.96.0（`rust-toolchain.toml` 锁定）。
- 验证/维护工具（仅打包维护者需要）：`dpkg-deb`（Debian 基础工具）、
  `ffmpeg`（需含 `librsvg` SVG 解码器，仅重生成图标时使用）、
  X11 工具链 `xwininfo`、`xwd`、`libxdo-dev`（供 `tests/desktop/xdo-helper` 与
  `verify-deb.sh` 的提取运行冒烟使用）。

## 验证

```sh
bash packaging/verify-deb.sh                       # 默认取最新 .deb；写入 artifacts/70-verification/evidence/package/
# 或
bash packaging/verify-deb.sh path/to/paperstack_0.1.0_amd64.deb /tmp/package-evidence
```

脚本依次执行：`sha256sum`/大小记录 → `dpkg-deb -I/-f/-c` → `dpkg-deb -x` 提取并
字节比对包内 `LICENSE`/`THIRD_PARTY_NOTICES.md` 与仓库根文件 → 在 `DISPLAY=:1`
（可用 `DISPLAY_VERIFY` 覆盖）运行提取出的 `usr/bin/paperstack`
（`fixtures/reader-min/reader-min.md`）→ 打开“关于”页并分别打开
“查看许可证”“第三方声明”离线阅读 → `WM_DELETE_WINDOW` 干净退出 → 截图与
日志留存于证据目录（`verify-runs.log`、`dpkg-deb-I.txt`、`dpkg-deb-c.txt`、
`dpkg-deb-x.log`、`extract-files.txt`、`01-launch.png`…`05-after-close.png`）。

未覆盖（诚实边界）：真正的干净系统 `sudo dpkg -i` 安装/卸载需要 root 与干净环境，
本仓库环境不执行（见 `artifacts/70-verification/system-verification.md` G-10/C2）；
Wayland 会话未验证（G-07/B2）。

## 安装、卸载与回滚

```sh
# 安装（首次或升级）
sudo apt install ./paperstack_0.1.0_amd64.deb     # 会自动解析 Depends

# 卸载（保留用户数据）
sudo dpkg -r paperstack        # 或 sudo apt remove paperstack

# 回滚到上一个已验证版本
sudo apt install --allow-downgrades ./paperstack_<prev>_amd64.deb
```

用户数据位于 `~/.local/share/com.quirkybrain.paperstack/`（含 `logs/` 诊断日志）与
`~/.cache/com.quirkybrain.paperstack/`；卸载软件包不会删除这些目录（如需彻底清理请手动删除）。
`.deb` 不含 postinst/prerm 脚本，卸载不做额外系统修改。

## 许可、声明与图标维护

- `LICENSE`：未改写的 GNU GPL v3 全文（GPL-3.0-only），来源
  `/usr/share/common-licenses/GPL-3`（Debian `base-files`，`dpkg -V base-files` 通过），
  sha256 `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`。
- `THIRD_PARTY_NOTICES.md` 重新生成（依赖或锁文件变化后必须执行）：

  ```sh
  python3 packaging/third-party-inventory.py > THIRD_PARTY_NOTICES.md
  ```

- 图标重新生成（修改 `packaging/icon.svg` 后执行）：

  ```sh
  bash packaging/generate-icons.sh
  ```
