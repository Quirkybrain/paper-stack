# 纸栈 PaperStack 已知限制与未验证清单（v0.1.0）

> 适用版本：v0.1.0 · 最后核对：2026-10-08
> Producer: agent:technical-writer（初稿 wp-49-docs；发布状态修订 wp-51-publication-docs）
>
> **声明（DR-05）**：本文所有「已验证」表述仅覆盖报告中实际执行并核对的范围；未执行或不可执行的检查一律
> 标注 **UNVERIFIED**，不得读作通过。性能数字为**本机校准（12 核 / 15 GiB，非基准机）**，不构成达标声明。
>
> 依据路径约定：`acceptance-at.md`/`acceptance-it.md`/`system-verification.md`/`unit-integration-report.md`
> 位于 `artifacts/70-verification/`；`wp-*.md` 位于 `artifacts/60-implementation/`；`review-*.md` 位于
> `artifacts/60-review/`；`implementation-plan.md` 位于 `artifacts/50-plan/`；`ui-spec.md` 位于 `artifacts/40-ux/`。

## 1. 环境受限的未验证项（UNVERIFIED，不得读作通过）

| 项 | 状态与原因 | 依据 |
|---|---|---|
| **Wayland 会话**（NF10/R30/AT30/IT08 的 Wayland 侧） | 本机仅 X11 `:1`；XTEST/libxdo 不适用于 Wayland。公开发布声明相应受限 | `system-verification.md` G-07/B2；`acceptance-at.md` §R5.6 |
| **真正干净系统的 `sudo dpkg -i` 安装/卸载** | 无 root/干净环境；以 `dpkg-deb -x` 提取运行 + 包内容核对替代，不等价于系统安装 | `wp-43-package.md` §8.1；`acceptance-it.md` §6 |
| **WebDriver / tauri-driver E2E** | 本机缺少驱动与权限；保留为将来目标，不写入本轮证据 | `implementation-plan.md` §5.5；`system-verification.md` G-10 |
| **抓包级零请求证据**（AT26/NF02） | 无 sudo/tcpdump；以进程树 `ss`（阻止态 0 行 + ESTAB 采样 + 缓存）替代 | `acceptance-at.md` §R5.6；`acceptance-it.md` §6 |
| **真实 IME 中文输入** | 合成输入环境；仅验证粘贴与中文路径/内容显示 | `acceptance-it.md` §6；§R3.4 O-48-1 |
| **拖放打开**（AT01） | 无法在本机产生 XDND 源 | `acceptance-at.md` §R5.6 |
| **复制失败路径**（AT11）、**映射回退文案**（AT18）、**前进分支清除**（AT16）、**面板状态记忆**（AT20）、**2000 条截断/节点级状态**（AT02）、**表格/代码局部横向滚动实际触发**（AT13）、**GIF/WebP**（AT13） | 沿用既有口径：组件/集成层覆盖或本机不可执行 | `acceptance-at.md` §R5.6 |
| **深色主题视觉走查** | 主题令牌与设置已实现并可用，但深色下的真实视觉走查未执行 | `acceptance-at.md` §R5.6；`ui-spec.md` §6.5 |
| **200% 文字缩放的完整任务链** | 阅读/搜索/大纲在 200% 下已抽查通过；完整任务链未验证 | `acceptance-at.md` §R5.6；`acceptance-it.md` §R3.2 |
| **NF04–NF06 P95 与 NF09 达标结论** | 仅本机校准；达标需基准环境复测（见第 2 节） | `unit-integration-report.md` §9；`implementation-plan.md` §5.4 |
| **WCAG 2.2 AA 认证** | 设计目标而非认证；按条目记录，不声明通过 | `implementation-plan.md` §5.5；`ui-spec.md` §6.5 |

## 2. 性能与资源：本机校准（非认证）

以下数值来自本机（12 核 / 15 GiB，非基准机）的校准脚本与真机测量；**绝对值和 P95 达标结论不得引用为认证**。

### 2.1 NF04/NF05 校准（`unit-integration-report.md` §6；wp-32a 修复后）

| 场景 | 修复前 | 修复后（本机） |
|---|---|---|
| 1 MiB 解析/索引就绪 p50 | 13,212 ms（p95 18,465 ms） | **885.6 ms**（p95 938.1 ms） |
| 1 MiB 首次查询（5 命中）p50 | 31.7 ms | **10.61 ms**（p95 15.82 ms） |
| 1 MiB 首次查询（2333 密集命中）p50 | 12,886 ms | **18.03 ms**（p95 20.70 ms） |
| 100 KiB 解析/索引 p50；查询 p50（wp-32 原始校准，修复任务未单独复测该尺寸） | 237.8 ms；0.61 ms | 沿用（同一线性路径覆盖） |
| 冷启动（可见窗口代理）p50/p95（wp-32 原始校准，修复后未单独复测） | — | 121 / 127 ms；冷打开 100 KiB 116 / 129 ms；暖移交 1 MiB 105 / 106 ms |

口径：NF04 为「窗口映射」代理（无首帧标记、无法在无 sudo 下丢弃 OS 页缓存），**首屏内容可见时间与冷
OS 缓存场景保持 UNVERIFIED**；修复后 1 MiB 已进入「≤3 s 全文可搜、≤200 ms 首次查询」设计目标量级
（仅本机）。

### 2.2 NF06 进程树资源（`unit-integration-report.md` §6.3）

| 场景 | PSS 峰值 / 中位 |
|---|---|
| idle（无文档） | **283.4 / 282.6 MiB** |
| 打开 100 KiB | 425.6 / 396.1 MiB |
| 打开 1 MiB | 425.7 / 421.7 MiB |
| 打开 10 MiB（阈值边界，全量解析压力） | 1318.9 / 942.6 MiB |

**本机 idle 已高于 250 MiB 设计预算**、1 MiB 打开高于 500 MiB 峰值预算；属校准发现，影响说明与目标评审
待执行（`system-verification.md` G-08）。

### 2.3 大文档（11 MiB 简化阅读 / 52 MiB 源码窗口；真机口径）

- 内容首屏可见：AT29 观测 +5.18 s（+3.17 s 仍在解析）、IT07 观测 +4.21 s；wp-47 自测 ≤3 s（机器负载
  量级差异，口径一致）；修复前为 **>7 分钟未完成**。
- 全文索引就绪约 10 s（IT07 Rev 2 口径）；尾段搜索与命中导航、首屏代码复制（49 B 字节核对）均可用
  （AT29 Rev 7、IT07 Rev 3）。
- CPU：尾导航引发**有界** ~10–12 s 单核 ~100% 爆发后回落；末 20 样本均值 0.00–0.10%；修复前为 ≥75–360 s
  无界饱和、WM 关闭需 SIGTERM 兜底，修复后 WM 关闭 0.12 s 干净退出（记录观察 O-48-2）。
- 52 MiB 直接进入源码分段模式：启动到窗口 2808 ms；RSS 182,380 KB（AT29 Rev 7）。

### 2.4 全量模式的超线性与简化窗口

- **非简化（full）管线对超大文档仍为超线性**（wp-45 §4.3）：`>10 MiB` 不会进入 full，仅提示简化阅读/
  只读源码；复杂文档拒绝简化后保留的 full 视图仍可能慢。
- **简化阅读使用有界窗口挂载**缓解（wp-47）：初始 120 块、每步 120、硬上限 600；空闲无 tick；未被挂载的块
  不渲染 DOM，但全文进入搜索索引，可经搜索/大纲/页内锚点跳转（IXD §11.2 不静默遗漏）。这是有意的降级模式：
  内联强调/链接/行内代码/公式/图片按源文本显示；代码块保留精确复制/折叠/换行。
- **2 MiB 复杂度提示重现（O-IT-2 / O-46-1，未定根因）**：在已选择简化阅读的 2 MiB 复杂度路径上，大文档
  提示可能再次出现并遮挡视图/指针；已记录并建议分诊，未修复。

## 3. 公开安装包阻塞：对应源码入口（A9）

- **A9「对应源码入口」尚未写入应用**：`AppInfo.legal.sourceEntryUrl = null`，关于页如实显示
  「未配置对应源码入口；公开发行前必须补齐。」（R30/NF12）。源码仓库地址已确定为
  [Quirkybrain/paper-stack](https://github.com/Quirkybrain/paper-stack)，本轮可先公开源码；
  公开安装包仍须先配置可访问且版本匹配的应用内入口并复验。
- 原系统验证将 A9 列为 **公开分发阻塞**（`system-verification.md` G-06 / §10.3 B1）；
  仓库级发布门禁已通过，公开源码与随后发布安装包是两个步骤。
- **本地包状态**：wp-50 已从当时验收修订重建并复验 `output/paperstack_0.1.0_amd64.deb`，
  sha256 `f72e3dbab442e71dd0df9e0d2ebe90e5699b60960af2ab6824164ba8d4788799`
  （`artifacts/80-release/package-verification.md` §1–§6）。本轮不公开该包；后续源码或第三方声明变更后，
  须在最终修订上重新构建并验证。

## 4. 打包与发行边界

- `tauri-bundler` 2.12.1 **不生成 deb `License:` 控制字段**；SPDX 标识（`GPL-3.0-only`）在
  `Cargo.toml`/`package.json`/`tauri.conf.json` 与关于页，许可全文与第三方声明随包提供
  （`wp-43-package.md` §8.3）。
- `THIRD_PARTY_NOTICES.md` 为**依赖清单，非法律审计**：Shiki 逐语法上游许可、KaTeX 字体上游许可未随 npm
  包提供（已在文档内明示）；MPL-2.0/EPL-2.0 等兼容性结论需结合真实锁文件由法律审计确认
  （`wp-43-package.md` §3、§8.4）。
- 界面当前仅**简体中文（zh-CN）**；键名保持语义化以支持后续语言（ADR-009），跨 locale 键一致性在新增
  locale 时需扩展测试。
- v0.1.0 范围外（不提供入口或占位）：编辑、账户、云同步、完整 PDF、LaTeX 编译、目录全文搜索、
  正则/拼音/语义查询、图表导出、批注、打印（`config/project.md`；`ui-spec.md` §1）。

## 5. 资源范围（asset scope）注意事项

- Tauri 的 **forbidden 集在进程内不可逆**：撤销某个路径的授权后，同一进程内再次确认/重新打开同一路径，
  图片仍会保持阻止，直到重启应用。这是安全优先的超额阻止（撤销必须立即停止服务），属架构级已知项
  （`wp-14a-assetfix.md` §7.2；`review-a-rust-security.md` §4）。
- **启动时不回填运行时 asset scope**：持久授权启动后经逐文件访问检查重新允许（图片行为不受影响，
  scope 保守为空）（`review-a-rust-security.md` §4）。
- 远程图片授权仅对**当前文档会话**有效；关闭文档、撤销或退出后失效。

## 6. 记录的执行观察（不改变验收判定）

| ID | 说明 | 依据 |
|---|---|---|
| O-48-1 / O-IT-5 | 合成输入下：搜索输入框聚焦时 Return 不推进命中（计数停 0/1），「下一项」按钮正常推进；键盘运行时合成 Escape 未关闭搜索面板。属自动化合成输入差异的观察，验收面由按钮/键盘链覆盖 | `acceptance-at.md` §R7.4；`acceptance-it.md` §R3.4 |
| O-48-2 / O-48-5 | 大文档尾导航触发**有界** ~10–12 s 单核 ~100% 工作量后回落（旧行为 ≥75–360 s 无界）；期间应用保持响应（WM 关闭 0.12 s）。建议按性能事项跟踪，不构成验收失败 | `acceptance-at.md` §R7.4；`acceptance-it.md` §R3.4 |
| O-48-6 | 内容首屏可见时间本机 3.2–5.2 s（修复前为分钟级未完成；wp-47 报告 ≤3 s），量级一致 | `acceptance-at.md` §R7.4 |
| O-48-7 | 大文档取消路径：文档未打开，但该文件随后出现在欢迎页「最近阅读」（记录行为） | `acceptance-at.md` §R7.4 |
| O-IT-2 / O-46-1 | 2 MiB 复杂度提示在简化阅读后可能重新出现并遮挡视图（未定根因，见 §2.4） | `acceptance-it.md` §R2.4；`wp-45-fix-it.md` §4.6 |
| O-IT-1 | 缺失图片在其目录获授权前置态与「越界」共用占位文案；授权后显示「找不到这张图片」。与 AT13 行为一致，非缺陷 | `acceptance-it.md` §5 |
| O-38-3 / 历史 | 「查看许可证」曾在打包前显示「找不到文件或资源。」；wp-43 已修复并在 IT08 验证许可证/第三方声明**离线全文可读**（该历史观察已关闭） | `wp-43-package.md` §5；`acceptance-it.md` IT08 |

## 7. 结论口径

- 本清单是 v0.1.0 的**完整未验证与已知限制汇总**：凡未列入「已验证」的内容，不得在发布说明、README 或
  对外材料中表述为通过或达标（DR-05；`implementation-plan.md` §5.5）。
- 性能数字一律标注「本机校准，非认证」（RK-09）。
- 状态同步：上游修复或环境变化关闭某项后，应更新本文件并在 `artifacts/60-implementation/wp-49-docs.md`
  的声明→证据表中登记新依据；本文件的判定有效期止于 2026-10-08 的验证修订。
