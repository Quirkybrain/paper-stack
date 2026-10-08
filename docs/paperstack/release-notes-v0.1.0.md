# 纸栈 PaperStack v0.1.0 发布说明（草案）

> 状态：**草案 / 源码仓库准备公开，安装包暂缓** · 日期：2026-10-08 · 版本：0.1.0
> 公开安装包仍受 **A9「对应源码入口」** 阻塞（见「发行状态」）；本文所有验证结论均以引用报告为准。
> 未验证项与性能口径见 [`known-limitations.md`](known-limitations.md)；不得读作通过（DR-05）。

## 概述

纸栈 PaperStack v0.1.0 是 **Linux 优先、本地文件优先的只读 Markdown 与数学公式阅读器**：直接打开本地
文件阅读，不修改原文件、不上传正文，全部渲染离线完成。本轮先准备公开源码，`.deb` 安装包随后
另行发布；界面为简体中文。

## 亮点：本版可用能力

- **Markdown 阅读**：GFM（标题、列表、引用、表格、任务列表、删除线），UTF-8（含 BOM）；严格只读，
  原文零写入。
- **数学公式**：KaTeX 行内/块级渲染；未知宏等错误按块回退显示源码，不影响其余内容。
- **代码与图表**：Shiki 代码高亮（行号、复制、换行、折叠）；Mermaid 流程图/时序图/类图可见时渲染，
  其余图种与错误有可读回退。
- **资源与隐私**：本地/远程图片默认阻止、按授权读取（含会话级远程允许）；缺失/越界/阻止占位可操作；
  隐私分类清除与持久授权撤销。
- **导航与检索**：欢迎页/最近阅读、文件树、大纲、锚点/脚注/跨文件链接历史；正文/源码双范围搜索
  （区分大小写、命中计数、公式源码命中）；只读源码视图与位置互映射。
- **更新与位置**：文件监视更新横幅（现在更新/稍后）、保持/跟随模式、选区暂停；阅读位置精确/近似恢复。
- **大文档**：>10 MiB 或复杂度超预算时选择简化阅读/只读源码/取消；>50 MiB 走只读源码分段窗口；
  简化阅读保留全文文本与基础结构、搜索与复制完整可用。
- **交付与合规**：`.deb` 打包（桌面项、图标、运行期依赖元数据）、包内离线 GPLv3 全文与第三方声明、
  关于页与诊断工具。

## 关键修复与改进

本版在验收与评审后完成的主要修复（均已回归并复验）：

1. **非 ASCII 文件名跨文档链接**（D-IT-1）：中文等非 ASCII 相对链接此前报 `PS_IO_NOT_FOUND`；现按路径段
   解码后正确打开（`wp-45-fix-it.md` §1.1；IT02/AT15 复验）。
2. **编辑器式「替换保存」的更新流程**（D-IT-2）：外部 `copyfile + os.replace` 后不再停「找不到原文件」，
   直接进入正常更新横幅；Rust 观测层以文件系统存在性校正事件、前端按稳定读验证（`wp-45-fix-it.md` §1.2；
   IT03/AT21/AT22 复验）。
3. **11 MiB 大文档简化阅读卡死**（D-IT-3）：解析/索引超线性（wp-45 线性快路径）与窗口化挂载/O(1) 摘录
   （wp-47）两层修复；内容首屏可见从「>7 分钟未完成」降到本机 3–5 s 量级，尾搜/复制/关闭全部可用
   （`wp-45-fix-it.md` §1.3、`wp-47-fix3.md` §1–§3；AT29/IT07 复验）。
4. **解析与查询性能**（F-32-2/F-32-3）：单遍源映射索引与命中映射表；1 MiB 解析/索引 p50
   13,212 ms → **885.6 ms**、密集命中首次查询 p50 12,886 ms → **18.03 ms**（本机校准，非认证；
   `wp-32a-perf.md` §3）。
5. **搜索折叠语义对齐**（F-32-1）：前后端统一逐码点小写折叠并共享契约向量（`wp-32a-perf.md` §2.3–§4）。
6. **评审修正**：安全与前端两轮独立评审的 18 项发现全部关闭——授权撤销/恢复语义、导出保护、消毒单点、
   脚注回引、文档信息面板、i18n 守卫等（`review-rereview.md`）。
7. **打包与离线许可**：wp-50 从验收修订重建 `.deb`，元数据/资源/提取运行与系统打开已复验；
   许可证查看器与第三方声明查看器离线可读（`artifacts/80-release/package-verification.md` §1–§6）。

## 验证摘要

| 验证项 | 结果 | 证据 |
|---|---|---|
| 桌面验收 AT01–AT30 | **30 PASS / 0 FAIL**（Rev 5 全量同树刷新；Rev 7 在含 wp-45/wp-47 修复的构建上复验 AT29，其余 29 项沿用 Rev 5 判定） | `artifacts/70-verification/acceptance-at.md` |
| 端到端验收 IT01–IT08 | **8/8 PASS**（打包提取运行；IT02/IT03/IT07 子项在修复后复验关闭） | `artifacts/70-verification/acceptance-it.md` |
| 独立复审 A/B | **18/18 关闭**（A 8/8、B 10/10；PASS-WITH-NOTES，残余见已知限制） | `artifacts/60-review/review-rereview.md` |
| 前端测试 | 73 文件 / **588 通过 / 0 失败** | `acceptance-at.md` §R7.3（日志 `evidence/it-rerun2/unit-suite-wp48.log`） |
| Rust 测试 | **282 通过 / 0 失败** | `artifacts/60-implementation/wp-45-fix-it.md` §3.2 |
| 契约/语义向量 | 6 文件 / **89 通过** | `artifacts/70-verification/system-verification.md` §7.3 |

限定说明：验证在 Ubuntu 24.04 LTS x86_64、X11 会话完成；Wayland、干净系统安装、WebDriver E2E、
抓包级零请求、真实 IME 等保持 **UNVERIFIED**；性能数字为本机校准、非认证。

## 已知问题

- 完整清单见 [`known-limitations.md`](known-limitations.md)：环境受限未验证项、性能校准口径（含全量模式
  对超大文档的超线性与简化窗口缓解、本机 idle PSS 高于设计预算）、asset scope 进程内不可逆、打包边界与
  记录观察（O-48-1 等）。
- 未关闭的观察：2 MiB 复杂度提示在简化阅读后可能重新出现（O-IT-2，未定根因）；大文档尾导航有界
  ~10–12 s CPU 爆发（按性能事项跟踪）。

## 许可与归属

- 许可证：**GPL-3.0-only**；`LICENSE` 为未改写的 GNU GPLv3 全文（sha256 `3972dc97…`），随仓库与安装包
  （`/usr/lib/paperstack/`）提供。
- 第三方声明：`THIRD_PARTY_NOTICES.md`（npm production 闭包 263 个包/版本、Rust 运行期闭包 540 个
  crate；生成器 `packaging/third-party-inventory.py`；非法律审计）。
- 版权与所属者：Quirkybrain；版本元数据在 `package.json`、`Cargo.toml`、`tauri.conf.json` 与关于页一致。

## 发行状态

- **源码先行**：拟公开仓库为 [Quirkybrain/paper-stack](https://github.com/Quirkybrain/paper-stack)；
  本轮保留完整 Git 历史与工程证据，不随源码发布 `.deb`。
- **公开安装包暂缓（A9）**：应用内对应源码入口仍未配置；关于页如实显示
  「未配置对应源码入口；公开发行前必须补齐。」（R30/NF12）。公开安装包前须写入
  可访问且版本匹配的源码入口并验证，同时完成第三方许可待核项。
- **本地包验证记录**：wp-50 已从当时验收修订重建并复验本地
  `output/paperstack_0.1.0_amd64.deb`（sha256
  `f72e3dbab442e71dd0df9e0d2ebe90e5699b60960af2ab6824164ba8d4788799`；
  `artifacts/80-release/package-verification.md`）。此包不作为本轮公开分发物；后续源码或
  第三方声明变化后，须在最终修订重建并按 `packaging/verify-deb.sh` 复验。
- 支持环境：Ubuntu 24.04 LTS x86_64（X11 已验证；Wayland UNVERIFIED）；运行期依赖
  `libwebkit2gtk-4.1-0`、`libgtk-3-0`。
- 安装/卸载/回滚步骤见仓库 `packaging/README.md`；安装命令在当前验证环境未执行（UNVERIFIED）。
