# 纸栈 PaperStack · wp-50 发布就绪报告（Release Readiness）

- **Producer**: agent:release-engineer
- **Artifact ID**: ART-80-RELEASE-READINESS
- **Artifact Type**: Release Readiness Assessment（系统验证条件 C1–C6 关闭状态、阻塞、性能校准摘要、组成与 Stage Gate 建议）
- **Status**: VALID
- **Revision**: 1
- **Owner**: release-engineer
- **Task**: `wp-50-release`（任务分支 `task/wp-50-release`；父分支 `feat/v0.1.0`；基线提交 `a4e7a1ca65ddaffd13031add02f4f7acbb486a19`）
- **Last Verified**: 2026-10-08
- **Scope**: 发布就绪评估与证据汇总；本报告**不构成** Stage Gate 裁决（归 Orchestrator）、不构成公开发行批准、不构成用户验收。未执行安装/发布动作。

> **判定纪律**：所有「关闭」均有报告/证据路径；凡未执行或环境受限项一律维持 **UNVERIFIED**（§6），不得读作通过。性能数字一律为**本机校准（12 核 / 15 GiB，非基准机），非认证**。

---

## 1. 结论与建议

> **READY-FOR-REPOSITORY-RELEASE；public distribution BLOCKED pending A9（对应源码入口）**

- **仓库级发布就绪**：系统验证条件 **C1–C6 全部关闭或按口径落档（C5）**；最终 `.deb` 已在最终修订上重建并验证（`f72e3dba…`，载荷二进制 = 验收二进制 + 3 字节 bundler 标记）；AT 30/30、IT 8/8、复审 18/18、Integration Gate PASS、发布文档齐备。建议 Orchestrator 在 Stage Gate 授予 **GO（仓库级发布）**。
- **公开发行（对外分发/上架/宣告）不可进行**：**B1/A9** 对应源码入口未配置——`sourceEntryUrl=null`、关于页如实显示「未配置对应源码入口；公开发行前必须补齐。」；所有者提供真实 URL 前**不放伪地址、不做公开发行宣告**。届时若修改产品（`info.rs`/配置），须按 Change Impact 重建并重验本报告 §5 的产物。
- **公开声明附加限制（B2/A4 + 环境项）**：仅可声明 X11 实测范围内的结论；Wayland、干净系统安装、真实 IME、抓包级证据、性能达标认证等未验证项不得写入公开材料（§6）。
- **性能**：仅提供本机校准原始数值（§4）；NF06 idle 超 250 MiB 设计预算的**影响说明已落档于本报告**，达标目标评审仍归所有者/基准机（维持 UNVERIFIED）。

## 2. 系统验证条件 C1–C6 状态

依据 `artifacts/70-verification/system-verification.md` §10.2（G-01…G-08 映射）：

| 条件 | 内容（系统验证 §10.2） | 关闭证据 | 状态 |
|---|---|---|---|
| **C1** | G-01：AT 结转证据时效——在发布候选构建上同树复跑 | `wp-42` 全量同树刷新（AT Rev 5：30/30 于单一二进制 `054040ba…`）；`wp-46`/`wp-48` 影响面复跑（Rev 6；Rev 7 在含 wp-45/47 的 `26c02d2d…` 构建上复验 AT29，R5.6 计数项关闭） | **已关闭**（AT Rev 7；29 项沿用 Rev 5 判定 + AT29 独立复验） |
| **C2** | G-02/G-03/G-12：GPLv3 全文、第三方声明、`.deb`、离线许可查看器、包一致性 | `wp-43`（LICENSE/声明/打包/离线法务修复）；**本任务**在最终修订 `a4e7a1c` 重建 `.deb` 并复验：元数据/载荷/字节比对/提取运行/AT30 可行部分/IT08 系统打开 | **已关闭**（含最终包重建；旧 wp-43 包已取代） |
| **C3** | G-05：IT01–IT08 端到端 | `wp-44`（Rev 1，打包提取运行 8/8）；`wp-46`/`wp-48`（Rev 2/3：D-IT-1/2/3 修复后复验，Rev 3 在 `26c02d2d…` 上关闭 IT07 受限子项） | **已关闭**（IT Rev 3；8/8） |
| **C4** | G-04/G-09：README 完整版、过期表述清理、字符串目录对账 | `wp-49`：`README.md` 204 行完整版、`docs/paperstack/{user-guide,known-limitations,release-notes-v0.1.0}.md`；声明→证据映射 28 项；链接/引用/占位数检查通过 | **已关闭** |
| **C5** | G-08：NF04–NF06/NF09 校准与影响说明 | **本报告 §4**（原始校准数字 + 「本机校准、非认证」口径 + NF06 idle 超预算影响说明）；基准机复测与 NF 达标结论仍为环境受限（UNVERIFIED） | **已落档**（说明已记录；达标认证维持 UNVERIFIED） |
| **C6** | 发布文档携带 G-07/G-10 限制、排除未验证项 | `wp-49`：`known-limitations.md`（129 行，未验证清单/校准/打包边界/A9）；README、用户指南、发布说明均链至该清单；本任务报告同口径 | **已关闭** |

## 3. 阻塞（BLOCKED）

| ID | 内容 | 状态与处置 |
|---|---|---|
| **B1（A9）** | **对应源码入口未配置**（`AppInfo.legal.sourceEntryUrl = null`；关于页如实显示未配置原因）——系统验证 §10.3 明示：**公开发布不能宣告** | **BLOCKED（owner）**：需所有者提供真实可访问的对应源码 URL；未提供前不伪造地址。解除后产品变更须按 Change Impact 重建/重验最终包与文档（R30/NF12/DR-06） |
| **B2（A4）** | **Wayland 会话不可用**（NF10/R30/AT30/IT08 的 Wayland 侧） | **BLOCKED（环境）**：本机仅 X11 `:1`；公开声明相应受限（不得声明 Wayland 支持已验证） |

## 4. 性能校准摘要（原始数值；本机校准、非认证）

来源：`unit-integration-report.md` §6/§9、`wp-32a-perf.md` §3/§8、`wp-45-fix-it.md` §4.3、`wp-47-fix3.md` §3/§5、`acceptance-at.md` §R7.2/R7.4、`acceptance-it.md` §R3.2/R3.4。

| 项 | 数值（本机） | 备注 |
|---|---|---|
| 1 MiB 解析/索引就绪 | p50 **885.6 ms**（p95 938.1）；修复前 13,212 ms | NF05 路径；修复后进入 ≤3 s 量级（仅本机） |
| 1 MiB 首次查询（5 命中 / 2333 密集命中） | p50 **10.61 ms**（p95 15.82）/ **18.03 ms**（p95 20.70）；修复前 31.7 / 12,886 ms | 同上 |
| 100 KiB 解析 / 查询 | p50 237.8 ms / 0.61 ms（wp-32 原始校准，未单独复测） | 同线性路径 |
| 冷启动（窗口映射代理） / 冷打开 100 KiB / 暖移交 1 MiB | p50/p95 **121/127 ms**；**116/129 ms**；**105/106 ms** | NF04 为代理口径；首屏可见与冷 OS 缓存 UNVERIFIED |
| 进程树 PSS 峰值/中位（NF06） | idle **283.4/282.6 MiB**；100 KiB 425.6/396.1；1 MiB 425.7/421.7；10 MiB 1318.9/942.6 MiB | **idle 超 250 MiB 设计预算**（影响说明见下）；1 MiB 超 500 MiB 峰值预算 |
| 大文档内容首屏可见 | IT07 **+4.21 s**、AT29 **+5.18 s**（wp-47 自测 ≤3 s，机器负载差异）；修复前 >7 分钟未完成 | 11 MiB 简化阅读 |
| 大文档全文索引 | 约 **10 s**（IT07 Rev 2 口径） | 尾搜/尾匹配/复制在 Rev 3 关闭 |
| 大文档尾导航 CPU | 有界 **~10–12 s** 单核 ~100% 后回落；末 20 样本均值 0.00–0.10%；WM 关闭 **0.12 s** | 修复前 ≥75–360 s 无界 + SIGTERM 兜底 |
| 52 MiB 源码分段模式 | 启动到窗口 **2808 ms**；RSS **182,380 KB**；横幅上限提示 | AT29 Rev 7 |

- **NF06 影响说明（C5 落档内容）**：idle PSS 283.4 MiB 高于 250 MiB 设计预算约 13%；该值为 Electron 系 WebKitGTK 基线+应用常驻开销的实测校准，功能与稳定性不受影响（NF07 soak 500/500、崩溃为零）；对外仅按「校准数据」表述，**目标评审/基准机复测归所有者**。
- NF04–NF06/NF09 的**达标结论**一律不得引用；无基准机复测前维持 UNVERIFIED（`known-limitations.md` §1–§2）。

## 5. 组成（Composition）与证据

| 项 | 值 | 来源 |
|---|---|---|
| 最终修订（tip） | `a4e7a1ca65ddaffd13031add02f4f7acbb486a19`（`task/wp-50-release`；父 `feat/v0.1.0`） | `git rev-parse HEAD` |
| 产品树等价 | = `fa424ef`（AT Rev 7 / IT Rev 3 构建树）；Rust 源 = `f8e4dae`（282 结论）；`tests/contracts/` = `b41a0d3`（89 结论）；打包资源 = `7f5de8a`（wp-43） | `evidence/package-final/tree-consistency.txt` |
| 契约 | **`paperstack-ipc-r1`**（contracts.md **Rev 2**，ART-30-IPC） | `artifacts/30-architecture/contracts.md` |
| 前端套件 | **73 文件 / 588 passed / 0 failed** | acceptance-at §R7.3、acceptance-it §R3.3（同构建日志 `it-rerun2/unit-suite-wp48.log`） |
| Rust 套件 | **282 passed / 0 failed** | wp-45 §3.2（Rust 源此后未变） |
| 契约套件 | **6 文件 / 89 passed**（Type Errors 0） | system-verification §7.3（`tests/contracts/` 此后未变） |
| 最终 `.deb` | `output/paperstack_0.1.0_amd64.deb`；**11,526,468 B**；sha256 **`f72e3dba…d4788799`**（旧 wp-43 包 `b0f44fdb…` 已取代） | `package-verification.md`；`evidence/package-final/` |
| 包内二进制 | 载荷 `1f4e34c5…`= in-repo `26c02d2d…`（AT Rev 7 / IT Rev 3 验收二进制）+ 3 字节 bundler 标记 | `evidence/package-final/payload-binary-provenance.txt` |
| 其余门 | Integration Gate **PASS**（wp-40）；复审 **18/18** VERIFIED（A 8/8+B 10/10）；系统验证 PASS-WITH-CONDITIONS（wp-41） | `gates/wp-40-gate.md`、`review-rereview.md`、`system-verification.md` |
| 本次证据 | `artifacts/70-verification/evidence/package-final/**`；三份 release 报告 | 本任务 |

## 6. 声明范围（Claim-scope statement）与 Go/No-Go

**可以声明（有证据）**：v0.1.0 仅 GPL-3.0-only、离线本地只读阅读器；X11 下 AT 30/30 的验收行为（含撤销/零写入/更新链/大文档简化路径修复后行为）；IT 8/8 任务链；最终 `.deb` 的元数据/载荷/字节比对/提取运行/GTK 系统打开；复审修正 18 项关闭；性能按「本机校准」原始数字描述。

**不得声明（UNVERIFIED，`known-limitations.md` §1）**：Wayland 支持/已验证；干净系统 `sudo dpkg -i` 安装/卸载已验证；WebDriver/tauri-driver；抓包级零请求；真实 IME；拖放打开；深色主题视觉走查；200% 完整任务链；NF04–NF06/NF09 达标或认证；WCAG 认证；对应源码入口可用（A9）。

| Gate 对象 | 标准 | 结果 |
|---|---|---|
| **仓库级发布（本仓库交付/后续开发基线）** | 最终包验证通过；C1–C6 关闭/落档；文档齐备；无未修复 FAIL/高风险开放项（残余观察 O-48-*、O-IT-* 已记录） | **GO（建议）** |
| **公开发行（对外分发/宣告）** | A9 提供真实源码入口 + 按 Change Impact 重建重验；Wayland/安装等声明受限或补验 | **NO-GO（当前）** |

> Stage Gate 裁决归 Orchestrator；本报告提供条件关闭、阻塞与组成证据，建议按上表授予仓库级 GO、保留公开发行 NO-GO。

## 7. 追溯

| 条款 | 本文承接 |
|---|---|
| system-verification §10.2 C1–C6、§10.3 B1/B2、§9 G-01…G-12 | §2、§3、§6 |
| acceptance-at Rev 7、acceptance-it Rev 3、unit-integration-report、wp-32a/wp-43/wp-44/wp-45/wp-46/wp-47/wp-48/wp-49、review-rereview、plan T-73/T-74 | §2、§4、§5 |
| `package-verification.md`、`deployment-rollback-plan.md`（本任务） | §5 |
| `docs/paperstack/known-limitations.md`、`release-notes-v0.1.0.md` | §4、§6 |
| 证据 | `artifacts/70-verification/evidence/package-final/**` |

### 变更记录

- **Rev 1 — 2026-10-08（wp-50-release）**：汇总 C1–C6 关闭状态与 B1/B2 阻塞；记录 C5 校准/影响说明（本机校准、非认证）；组成（tip `a4e7a1c`、契约 `paperstack-ipc-r1`、588/282/89、最终包 `f72e3dba…`）；建议 READY-FOR-REPOSITORY-RELEASE、public distribution BLOCKED pending A9。
