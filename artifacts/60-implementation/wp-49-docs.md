# 纸栈 PaperStack · wp-49-docs 发布文档交付报告（README / 用户指南 / 已知限制 / 发布说明）

- **Producer**: agent:technical-writer
- **Artifact ID**: ART-60-IMPL-WP-49-DOCS
- **Artifact Type**: Implementation Evidence Report（系统验证条件 C4/C6 的发布文档交付；含声明→证据映射、链接与一致性检查记录）
- **Status**: VALID
- **Revision**: 1
- **Owner**: technical-writer
- **Task**: `wp-49-docs`（任务分支 `task/wp-49-docs`；父分支 `feat/v0.1.0`；基线提交 `83e66a26d95c0ed516d86569efac7ff61695692d`）
- **Last Verified**: 2026-10-08
- **Scope**: `README.md`、`docs/paperstack/`、`artifacts/60-implementation/`。**未修改** `src/`、`src-tauri/`、`tests/`、`fixtures/`、锁文件、`config/`、pinned 输入或框架文件；未执行发布/部署动作。

> 文档纪律：四条交付物中的每条可核事实均映射到现行报告（见 §3）；性能数字一律标注「本机校准，非认证」；
> 未验证项集中收录于 `docs/paperstack/known-limitations.md` 并链自其余文档（DR-05）。

## 1. 输入与基线核验（pinned inputs）

7 项 pinned 输入于 2026-10-08 实测 SHA-256，与 `state/handoffs/wp-49-docs.json` 逐一一致（只读未改）：

| 输入 | SHA-256（实测 = pin） | 一致 |
|---|---|---|
| `artifacts/70-verification/acceptance-at.md`（Rev 7） | `7f6260da…c200566e` | ✓ |
| `artifacts/70-verification/acceptance-it.md`（Rev 3） | `ea7e6cd3…879b6710` | ✓ |
| `artifacts/70-verification/system-verification.md` | `bc655b13…b43b4015` | ✓ |
| `artifacts/70-verification/unit-integration-report.md` | `a4c90529…1157d261` | ✓ |
| `artifacts/60-implementation/wp-43-package.md` | `664fde96…1b3c1402` | ✓ |
| `artifacts/60-implementation/wp-47-fix3.md` | `a7a7ec3c…be728e1b` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…6a8b02967f` | ✓ |

补充基线核对（本任务实际执行）：

| 检查 | 命令/方法 | 结果 |
|---|---|---|
| 交付修订与验收构建的产品树一致性 | `git diff fa424ef..HEAD -- src src-tauri ':!**/tests/**'` | **空**（文档修订的产品树 = AT Rev 7 / IT Rev 3 复验构建 `26c02d2d…` 的树） |
| 契约套件未被后续任务改动 | `git diff b41a0d3..HEAD --quiet -- tests/contracts/` | 相同（89 通过结论对现行树有效） |
| Rust 源未被 282 复跑后改动 | `git diff f8e4dae..HEAD --quiet -- src-tauri ':!**/tests/**'` | 相同（wp-45 §3.2 的 282 结论对现行树有效） |
| 前端源未被 588 复跑后改动 | `git diff fa424ef..HEAD --quiet -- src` | 相同（588 结论对现行树有效） |
| 法务资源哈希 | `sha256sum LICENSE THIRD_PARTY_NOTICES.md` | `3972dc97…b36986`、`894703df…091f78`，与 wp-43 §2/§3 一致 |

## 2. 交付物

| 路径 | 行数 | 内容 |
|---|---|---|
| `README.md` | 204 | 完整版发布 README：标识/定位、当前交付状态与验证矩阵摘要、前置条件、已验证命令（含 .deb 与提取运行；系统安装明确标注未执行）、使用要点、测试与验证现状（588/282/89）、已知限制入口、许可与开源信息（A9 阻塞）、目录结构、文档导航 |
| `docs/paperstack/user-guide.md` | 283 | 面向使用者的任务型指南：UI00–UI07（打开/标签/导航/搜索/源码/检查与复制/更新/设置/隐私/授权/诊断/大文档）、ui-spec §17.1 键盘映射、可访问性说明、已知限制指针 |
| `docs/paperstack/known-limitations.md` | 129 | 汇总未验证清单（Wayland、干净安装、WebDriver、抓包级证据、真实 IME 等）、性能校准（数字 + 非认证 + 全量超线性/简化窗口/本机 PSS 超预算）、A9 发布阻塞、asset scope 不可逆、打包边界与记录观察（O-48-* 等）、DR-05 口径 |
| `docs/paperstack/release-notes-v0.1.0.md` | 89 | 发布说明草案：亮点、关键修复（IT 缺陷 + 性能 + 大文档 + 评审修正 + 打包）、验证摘要、已知问题指针、许可/归属、发行状态（A9 阻塞 + 最终修订需重建 .deb） |
| `artifacts/60-implementation/wp-49-docs.md` | 本报告 | 声明→证据映射与检查记录 |

## 3. 声明 → 证据映射

> 路径缩写：`acceptance-at.md`=`artifacts/70-verification/acceptance-at.md`；`acceptance-it.md`=`artifacts/70-verification/acceptance-it.md`；`system-verification.md`=`artifacts/70-verification/system-verification.md`；`unit-report`=`artifacts/70-verification/unit-integration-report.md`；`wp-*`=`artifacts/60-implementation/wp-*.md`；`plan`=`artifacts/50-plan/implementation-plan.md`；`ui-spec`=`artifacts/40-ux/ui-spec.md`。

| # | 文档声明（位置） | 证据 | 本次核对 |
|---|---|---|---|
| 1 | v0.1.0 能力清单：打开/公式/代码/图表/图片/导航/搜索/源码/检查/更新/设置/隐私/授权/诊断/大文档/交付（README「当前交付状态」） | `acceptance-at.md` §R5.2（AT01–AT30 全量矩阵）；`acceptance-it.md` §3（IT01–IT08 任务链）；行为口径 `ui-spec` §3 | 逐条对照 AT/IT 观测项 |
| 2 | AT 30/30 PASS（README 矩阵、release notes） | `acceptance-at.md` §R7.3：30 PASS / 0 FAIL；Rev 5 全量同树 + Rev 7 在含 wp-45/wp-47 修复的构建（`26c02d2d…`）上复验 AT29；其余 29 项未复跑、按报告口径沿用 Rev 5 | 引原文判定表及 §R7.3 口径说明 |
| 3 | IT 8/8 PASS（README 矩阵、release notes） | `acceptance-it.md` §R3.3 / Rev 1 §4：8/8；受限子项清单 §R3.3/§6 | 引原文判定表 |
| 4 | 复审 18/18 关闭（README、release notes） | `artifacts/60-review/review-rereview.md` §3/§6：A 8/8 + B 10/10 VERIFIED | 引原文计数 |
| 5 | 前端 73 文件 / 588 通过 | `acceptance-at.md` §R7.3、`acceptance-it.md` §R3.1；日志 `artifacts/70-verification/evidence/it-rerun2/unit-suite-wp48.log` | 引报告数值；产品树一致性见 §1 |
| 6 | Rust 282 通过 / 0 失败 | `wp-45-fix-it.md` §3.2 | 引报告数值；Rust 源未变（§1） |
| 7 | 契约 6 文件 / 89 通过 | `system-verification.md` §7.3 | 引报告数值；`tests/contracts/` 未变（§1） |
| 8 | 工具链命令（corepack/pnpm install） | `wp-23-readme.md` §3.1（#1、#2 逐条执行记录） | 引报告；命令与 `package.json` `packageManager` 一致（现行） |
| 9 | typecheck/lint/build/前端测试命令 | `wp-45-fix-it.md` §3.2、`wp-47-fix3.md` §4（PASS）；588 见 #5 | 引报告 |
| 10 | `pnpm tauri build --no-bundle` release 构建 | `wp-48-itrerun2` 构建（`acceptance-at.md` §R7.1：40.29s，BUILD_EXIT=0） | 引报告 |
| 11 | `pnpm tauri build --bundles deb` 与产物路径 | `wp-43-package.md` §6（BUILD_EXIT=0；`src-tauri/target/release/bundle/deb/paperstack_0.1.0_amd64.deb`）；`packaging/README.md` | 引报告；产物目录现存 |
| 12 | 提取运行替代路径（`dpkg-deb -x` + 运行） | `wp-43-package.md` §6（提取比对 + 冒烟）；`acceptance-it.md` §2/IT08（提取树运行与离线许可） | 引报告 |
| 13 | `sudo dpkg -i` 未执行（UNVERIFIED） | `wp-43-package.md` §8.1；`packaging/README.md`「未覆盖」；`system-verification.md` G-10 | 引报告 |
| 14 | 调试构建注意事项（devUrl、`--debug --no-bundle`、dev 未验证） | `wp-23-readme.md` §3.1（#9/#15）、`wp-19a-workerfix.md` §6 | 引报告原文 |
| 15 | 桌面脚本 `run-smoke.sh` | `wp-23-readme.md` §3.2（#14，exit 0）；`tests/desktop/README.md` | 引报告；脚本现存 |
| 16 | 性能数字（1 MiB 解析 885.6ms/查询 18.03ms、PSS 283.4MiB、大文档时间线/CPU、全量超线性、简化窗口） | `unit-report` §6/§9；`wp-32a-perf.md` §3/§8；`wp-47-fix3.md` §3/§5；`wp-45-fix-it.md` §4.3；`acceptance-at.md` §R7.2/§R7.4、`acceptance-it.md` §R3.2/§R3.4 | 逐项对照原文并标注「本机校准，非认证」 |
| 17 | asset scope 进程内不可逆/启动不回填 | `wp-14a-assetfix.md` §7.2；`review-a-rust-security.md` §4 | 引报告原文 |
| 18 | A9 源码入口未配置 = 发布阻塞，无伪地址 | `system-verification.md` G-06/§10.3 B1；`wp-43-package.md` §5/§8.5；R30/NF12 | 引报告；关于页文案 `about.sourceUnconfigured` 与 strings 一致 |
| 19 | LICENSE/第三方声明内容与哈希 | `wp-43-package.md` §2/§3；本任务实测哈希一致（§1） | 实测复核 |
| 20 | deb 无 `License:` 控制字段 | `wp-43-package.md` §8.3 | 引报告 |
| 21 | 当前 `output/` .deb 早于 wp-45/wp-47 修复、需在最终修订重建 | wp-43 基线后 `src/` 由 wp-45/wp-47 修改（`git log` 可证）；`acceptance-it.md` Rev 3 对 wp-43 产物的过期声明；产品树一致性见 §1 | 交叉核对 |
| 22 | 用户指南 UI00–UI07 行为与界面文案 | `ui-spec` §3.1–§3.8；`src/locales/zh-CN.json`（文案逐条对照）；AT/IT 对应项（AT01–30、IT01–08） | 抽查文案与行为项 |
| 23 | 键盘映射表（指南 §13） | `ui-spec` §6.1（IXD §17.1 原表） | 逐行对照 |
| 24 | 可访问性说明（焦点顺序、模态/非模态、目标非认证） | `ui-spec` §6.2–§6.5、§7 EDGE-01…13；`plan` §5.4/§5.5 | 逐条对照 |
| 25 | 未验证清单（Wayland/干净安装/WebDriver/抓包/IME/拖放/深色/200% 全链等） | `acceptance-at.md` §R5.6；`acceptance-it.md` §6/§R3.3；`system-verification.md` G-07/G-10；`plan` §5.5 | 合并去重，不扩大范围 |
| 26 | 记录观察（O-48-1/2/5/6/7、O-IT-1/2、O-46-1；许可证查看器历史已关闭） | `acceptance-at.md` §R7.4；`acceptance-it.md` §R3.4/§5/§R2.4；`wp-45-fix-it.md` §4.6；`wp-43-package.md` §5 | 逐项对照原文 |
| 27 | 关键修复（D-IT-1/2/3、F-32-1/2/3、评审 18 项、打包/离线许可） | `wp-45-fix-it.md` §1；`wp-47-fix3.md` §1–§3；`wp-32a-perf.md` §2–§3；`review-rereview.md` §3；`wp-43-package.md` §4–§6 | 逐项对照原文 |
| 28 | v0.1.0 范围外（编辑/账户/云同步/PDF/LaTeX 等） | `config/project.md`「Other Constraints」；`ui-spec` §1（UI08 排除） | 引配置与规格 |

## 4. 一致性与卫生检查（本任务执行）

| 检查 | 方法 | 结果 |
|---|---|---|
| Markdown 相对链接有效性 | Python 脚本解析四份文档 `[text](target)` 并解析相对路径 | 12 条链接全部存在；**0 失效** |
| 引用路径存在性 | 对 README/文档引用的报告、脚本、fixture、产物逐项 `test -e` | 19 项全部存在（`acceptance-*`、`system-verification`、`unit-integration`、`wp-*`、`review-*`、`plan`、`ui-spec`、`packaging/README.md`、`tests/desktop/README.md`、`run-smoke.sh`、`reader-min.md`、`output/*.deb`、588 日志等） |
| 占位/失信文案扫描 | `grep -i "TODO\|TBD\|coming soon\|敬请期待\|即将推出\|建设中\|under construction"` | 0 命中 |
| 数字一致性 | README/docs/release notes 与报告交叉比读 588/282/89、30/30、8/8、18/18、哈希前缀 | 一致 |
| 不虚构输出 | 所有命令与数字均为报告转录；无不带出处的运行输出 | 检查通过（性能条目均带「本机校准，非认证」） |
| 未验证范围 | 每条文档均链至 `known-limitations.md`；未验证项未被写成通过 | 检查通过 |

## 5. 边界与未覆盖（诚实声明）

1. 本任务为**文档交付**：不构成验收、评审或发布批准；Release Stage Gate 裁决归 Orchestrator。
2. 文档未声明任何性能达标（RK-09）；未验证项（Wayland、干净安装、WebDriver、抓包级零请求、真实 IME 等）
   保持 UNVERIFIED，详见 `docs/paperstack/known-limitations.md`。
3. 文档中「最终修订」的表述依据 §1 的产品树一致性检查（`git diff fa424ef..HEAD` 产品路径为空）；若后续
   再修改 `src/`/`src-tauri/`，相关声明按 Change Impact 失效并需更新。
4. 当前 `output/` 的 `.deb` 与文档声明一致地标注为 wp-43 产物（早于 wp-45/wp-47 修复），**不声称**其包含
   最终修复；重建属发布阶段动作（A9 阻塞解除时一并处理）。

## 6. 追溯

| 条款 | 本文承接 |
|---|---|
| 系统验证条件 **C4**（README 完整版/过期表述清理）、**C6**（发布文档携带限制、排除未验证项） | §2–§4 |
| DR-05（未验证标注）、DR-06（已知限制/使用说明/完整开源信息） | §3、`docs/paperstack/known-limitations.md` |
| R30/NF12（离线许可、对应源码入口、无伪地址）；A9/G-06 | §3 #18 |
| `acceptance-at.md` Rev 7、`acceptance-it.md` Rev 3、`system-verification.md`、`wp-32a-perf.md`、`wp-43-package.md`、`wp-45-fix-it.md`、`wp-47-fix3.md`、`review-rereview.md`、`plan` §5.5 | §1、§3 |
| 需求基线（R01–R30）、`ui-spec` §3/§6 | §3 #22–#24 |

## 7. 变更记录

### Rev 1 — 2026-10-08（wp-49-docs）

- 新增 `README.md` 完整版（重写 wp-23 v0 的过期状态：原「尚未完成」能力均已交付并有 AT/IT 证据），新增
  `docs/paperstack/user-guide.md`、`known-limitations.md`、`release-notes-v0.1.0.md` 与本报告。
- 全部声明经 §4 检查；无产品代码、测试、配置或 pinned 输入改动。
