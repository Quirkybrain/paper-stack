# 纸栈 PaperStack · v0.1.0 交付计划（Implementation Plan）

- **Producer**: agent:delivery-planner
- **Artifact ID**: ART-50-PLAN
- **Artifact Type**: Delivery Plan（里程碑／组件图／任务图／测试与评审计划／风险／最小必要路径／追溯）
- **Status**: VALID
- **Revision**: 1
- **Owner**: delivery-planner
- **Task**: `wp-06-plan`（任务分支 `task/wp-06-plan`；父分支 `feat/v0.1.0`；基线提交 `9a17cba96d3c5c7fe06de8240d9e8bb6e4e103ab`；产出提交主题 `docs(plan): define v0.1.0 delivery plan`）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 v0.1.0（Markdown 与数学公式只读阅读版；UI00–UI07）。不实现代码；不新增需求；F01–F07／UI08 不进入本计划（DR-07）。
- **Contract Baseline**: `paperstack-ipc-r1`（38 命令、2 事件、32 稳定错误码、提交规则 §6、监测规则 §7）——本计划不修改任何 IPC 接口。
- **Depends On（pinned，SHA-256 见 `state/handoffs/wp-06-plan.json`）**: `artifacts/20-requirements/requirements-baseline.md`（ART-20-RB Rev 1）；`artifacts/30-architecture/{architecture,contracts,data-model,security-model,rendering-pipeline}.md`（Rev 1）；`artifacts/35-models/session-and-version-models.md`（Rev 1）；`artifacts/40-ux/{ui-spec,strings-zh-CN}.md`（Rev 1）；`state/handoffs/wp-00-start.request.md`。
- **Additional consulted sources（已合并的落盘工件，非本任务 pin）**: `artifacts/30-architecture/adr/ADR-001..010`；`artifacts/00-repository/repo-prep-01.md`；现有 gate/merge 证据。
- **Downstream**: 实现、测试、评审、集成、系统验证、打包与发布任务；每个任务 handoff 的输入引用本计划 §3–§4 的组件／任务行。
- **Validation evidence**: pinned 输入 SHA-256 于 2026-10-07 复核一致；环境事实按本机实测复核（§1.2）；R01–R30／NF01–NF12 在 §9 全部落到组件与任务；未修改 `input/`、`config/`、上游 Artifact 或源码。

---

## 1. 执行环境与约束（对本计划规范性）

### 1.1 串行执行模型（运行时硬约束）

1. **单工作树串行**：本运行时全部任务在项目主工作树串行执行；同一工作区**同时只允许一个活动 handoff**（OpenCode 插件在派发前校验，`swe_guard.py` 以 `workspace == 项目根`、`base_branch == task_branch`、父分支 tip、输入哈希、提交范围共同把关）。本计划识别的并行组（§2.4）仅供将来具备多 worktree 能力的运行时使用；**当前执行顺序一律串行**。
2. **每个工作包（wp）的标准流转**：
   1) `repository-manager` 从当前 `feat/v0.1.0` tip 创建唯一 `task/<id>` 分支（当前运行时即主工作树检出该分支）；
   2) Orchestrator `pin` 冻结 handoff（`task_branch`、`parent_branch`、`parent_commit`、精确 `commit_paths`、输入 SHA-256）→ 需要时 `snapshot` → `begin`；
   3) 专家在任务分支内完成实现／测试／报告，**只暂存 handoff 声明路径**，检查 `git diff --cached` 与 `git diff --cached --check`，以约定式提交提交，`finish`；
   4) Orchestrator 在任务分支提交门禁记录 `artifacts/00-repository/gates/wp-NN-gate.md`（Producer: `orchestrator:main-session | Deviation: Gate 记录由 Orchestrator 所有`）；
   5) `repository-manager` 执行 merge handoff：`source_branch=task/...` → `target_branch=feat/v0.1.0`，`--no-ff` 合并后在目标分支单独提交合并证据 `artifacts/00-repository/merges/rm-NN-merge-wpNN.md`，`finish`。
3. **活动 handoff 内禁止**：切换／创建分支、pull、rebase、merge、push、修改冻结输入；需要新输入时先结束交接、同步父分支、重新 pin。
4. **修正与复审**：任何评审意见引发的修改都产生**新提交**并重跑受影响检查；修正既有交付物（如 README 扩充、文档更新）或派发 `quality-reviewer` 前，必须先用 `swe_guard.py snapshot` 覆盖被改文件／评审目标（review_targets 必须已提交且被快照字节覆盖）。
5. **无远端、无 CI**：不可使用托管 PR/MR 或平台 CI 证据（A10）。全部检查在本地执行并在 §1.3 证据布局中留证；不得写成“已获平台批准”。最终 `feat/v0.1.0` → `main` 使用受守卫的本地 merge handoff（`main_merge_mode: review_request_when_remote`，无远端时允许本地）。
6. **每个 wp 一个独立交接、一个写入 Agent**；失败用 `finish --failed` 记录后再按根因重派，不覆盖失败证据。重复失败必须按 Failure Escalation 做根因分析、必要时回退到责任阶段，不得连续局部补丁。

### 1.2 本机实测环境能力（2026-10-07 复核）

| 项 | 实测 | 对计划的约束 |
|---|---|---|
| Node／pnpm | Node v24.15.0；Corepack 0.34.6；**pnpm 未安装** | wp-07 经 `corepack prepare pnpm@<锁定版本> --activate` 固定并写入 `packageManager`（A3 在工程初始化关闭） |
| Rust | rustc/cargo 1.96.0；rustfmt、clippy 可用 | `rust-toolchain.toml` 锁 1.96.0；`Cargo.lock` 入库 |
| GUI 依赖 | GTK3 3.24.41、WebKitGTK 4.1 2.52.6、libsoup3 3.4.4、开发头齐备 | 本机可构建并真实运行 Tauri 应用 |
| Tauri CLI | 未安装（无 `cargo-tauri`） | 使用固定版本 `@tauri-apps/cli`（pnpm devDependency）执行 `pnpm tauri dev/build` |
| 网络 | 可经代理（`http://127.0.0.1:7890`）取依赖；cargo registry 有缓存 | 依赖拉取按锁文件固定；构建可复跑；离线要求仅针对**发行应用**，不针对构建机 |
| WebDriver | **无** `WebKitWebDriver`／`webkit2gtk-driver`／`tauri-driver`；`sudo` 非交互不可用 | WebDriver 路线 **UNVERIFIED**；桌面验证走 ADR-010：真实 X11 运行 + 截图 + 可选 libxdo 助手 |
| 桌面会话 | 仅 X11（`DISPLAY=:1`）；**无 Wayland 会话** | Wayland 侧验收（NF10/R30/AT30/IT08 部分）**UNVERIFIED**（A4） |
| 截图/自动化工具 | `xwd`、`ffmpeg`、`xdpyinfo`、`xwininfo`、`xdotool`×、`wmctrl`×、`scrot`× | 截图用 `xwininfo` 取窗口 id → `xwd` → `ffmpeg` 转 PNG；无现成输入工具，使用 libxdo C 助手 |
| libxdo | `libxdo.so` 与 `/usr/include/xdo.h` 存在；**无 libxdo.pc**；`cc`/`gcc` 可用 | 助手直接链接 `-lxdo`（不经 pkg-config）；仅测试用，不入发行包 |
| 其他 | `dpkg-deb`、`strip`、`ss`、`tcpdump` 存在；**tcpdump 抓包被拒**；`unshare -rn` 被拒 | 无法做网络命名空间断网或抓包级证据；AT26/NF02 用进程 socket 观测 + 代码路径测试替代，抓包级标记 UNVERIFIED |
| 硬件 | 12 核／约 15 GiB | 非计划书 §2.1 基准机（4 核/8 GiB/SSD）；性能数字仅作**校准测量**（A8） |

### 1.3 证据与产物布局（计划级约定；Orchestrator 可调整）

- 每任务门禁记录：`artifacts/00-repository/gates/wp-NN-gate.md`（Orchestrator 所有；含改动路径、命令、结果、DoD 清单、未验证项）。
- 每合并记录：`artifacts/00-repository/merges/rm-NN-merge-wpNN.md`（repository-manager；模板见现有 rm-01..05）。
- 独立评审报告：`artifacts/60-review/…`；测试／系统验证：`artifacts/70-verification/…`（含 `evidence/` 下的截图与运行日志）；发布与验收：`artifacts/80-release/…`。
- 产品代码与资产：`src/`、`src-tauri/`、`tests/`、`fixtures/`、`docs/`、`README.md`、`LICENSE`、`THIRD_PARTY_NOTICES.md`（仓库常规跟踪；`artifacts/` 需 `git add -f`）。
- 所有“未验证”结论必须原文标注 **UNVERIFIED**，不得写成通过（DR-05）。

### 1.4 不进入本计划范围

编辑／保存；F01 目录全文搜索、F02–F03 TeX、F04 完整 PDF、F05–F07 批注/比较/源码联读；UI08 与任何“建设中”占位入口；WebDriver E2E 实施；AppImage／Flatpak／发行版仓库；托管 CI。以上能力不预置入口、不纳入完成率（SRS §9.1；DR-07）。

---

## 2. 里程碑、波次与集成点

### 2.1 里程碑总览

| 里程碑 | 内容 | 覆盖组件 | 退出条件（集成点） |
|---|---|---|---|
| **M1 上游（已完成）** | 清单、需求、架构/契约、模型、UI 规格、本计划；`wp-00..06`，`rm-01..05` 已合并；`rm-06` 待执行 | 上游工件（M1 Artifacts） | rm-06 合并本计划；契约 `paperstack-ipc-r1` 冻结 |
| **M2 基础** | 骨架与工具链；Rust 领域层（模型/错误/路径/授权/文件/存储/监测/远程/诊断）；38 命令与能力配置 | C-01..C-09 | IP-1：Rust workspace `cargo test` 全绿；应用可启动；38 命令注册与契约形状测试通过 |
| **M3 管线与真实主阅读页** | TS 基础层；文档管线；阅读器最小装配；**尽早真实运行**并固定条件截图；README v0 | C-10..C-12、C-19、C-20 | IP-2＝**EA-RUN 检查点**：`DISPLAY=:1` 真实打开样例并截图（DR-02/03 首轮），README 构建/运行/测试命令经验证 |
| **M4 交互特性** | 欢迎/最近、导航、搜索/历史、源码/检查/放大、设置/隐私/关于/诊断、大文档、更新与锚点流程、入口与授权流程 | C-12..C-17 | IP-3：全部 UI 特性接真实命令；组件测试通过；固定条件走查记录 |
| **M5 测试、评审与集成** | 全量固定样例与测量脚本；单元/组件/契约/集成执行；AT01–AT30；独立评审 A/B；集成；系统验证；IT01–IT08 | C-19 及全部组件 | IP-4：Integration Gate ＋ System Verification 就绪；AT/IT 证据齐备（含 UNVERIFIED 清单） |
| **M6 文档与发布** | .deb 与离线资产；LICENSE/第三方声明；README 完整版；产品文档；发布就绪；最终验收与 Stage Gate | C-18、C-20、C-21 | IP-5：发布候选可构建、可离线运行、可核验许可；Stage Gate 证据提交；`PAUSED_AT_STAGE=release` |

### 2.2 波次与工作包序（串行）

```text
M1: rm-06 ──▶ M2: rm-07 … rm-15 ──▶ M3: rm-16 … rm-23（含 EA-RUN）
──▶ M4: rm-24 … rm-31 ──▶ M5: rm-32 … rm-39 ──▶ M6: rm-40 … rm-45
──▶ rm-final: feat/v0.1.0 ─▶ main ──▶ Stage Gate + Checkpoint
```

- 每个 `wp-NN` 完成后先以 `rm-NN-merge-wpNN` 合并回 `feat/v0.1.0`，再开启下一个 wp（父分支 tip 前进一次）。
- 评审发现的问题产生**修正工作包**（`wp-fix-NN`，按相同流转）；修正后必须重跑受影响测试与评审，旧证据作废。

### 2.3 早期运行检查点（EA-RUN，显式）

- **位置**：wp-22（T-37），在 M3 内、在交互特性全面铺开之前。
- **内容**：`DISPLAY=:1` 启动真实应用 → 经对话框/CLI 打开固定样例 → 主阅读页按 IXD §3/§4 尺寸与默认状态逐项核对 → `xwininfo`＋`xwd`＋`ffmpeg` 截图（1280×800、浅色主题、固定字体/缩放）→ 证据落 `artifacts/70-verification/early-run.md` 与 `artifacts/70-verification/evidence/early-run/`。
- **判定**：核对清单逐项记录（文本截断、默认布局、宽度溢出、焦点可见、关闭入口），不以“截图存在”代替核对；无法执行项标 UNVERIFIED。随后 wp-23 产出经验证的 README v0，EA-RUN 检查点才关闭。

### 2.4 并行组识别（仅供将来多 worktree 运行时；当前串行）

| 组 | 成员 | 前提 |
|---|---|---|
| P-1 | 就绪序：{wp-09, wp-11} → {wp-10, wp-13} → {wp-12, wp-14} | wp-08 冻结契约 fixture；路径不相交；共享只读契约 |
| P-2 | wp-16、wp-17 | wp-15 完成；`src/app|services|components|styles` 与 `src/document` 不相交 |
| P-3 | wp-24、wp-25、wp-26、wp-27、wp-28（wp-29–31 依赖其产物，后续就绪） | wp-20/21 完成；feature 目录不相交；对 `components/` 的公共修改须串行 |
| P-4 | wp-35、wp-36 | 各自快照评审目标；只读，不改代码 |
| P-5 | wp-42、wp-43 | 文档路径不相交（README vs `docs/`） |

并行硬性条件（将来启用时）：独立 worktree、每 worktree 单活动交接、写范围无重叠、读写范围不冲突（guard `conflict` 判定）、契约冻结、集成所有权明确。

---

## 3. 组件图（C-01–C-21）

### 3.1 组件清单（职责／路径／契约消费／依赖／覆盖）

| C | 组件 | 职责（关键） | 拥有路径 | 消费契约／上游章节 | 依赖 | R/NF/AT |
|---|---|---|---|---|---|---|
| C-01 | 工程骨架与工具链（含 i18n 骨架） | pnpm/Corepack 固定；Vite/Tauri/TS/Rust 工程与锁文件；lint/format；`t()` 骨架与 zh-CN 资源种子 | `package.json`、`pnpm-lock.yaml`、`tsconfig*.json`、`vite.config.ts`、`index.html`、`src/main.tsx`、`src/app/i18n*`、`src/locales/zh-CN.json`、`rust-toolchain.toml`、`src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json,capabilities/,src/main.rs}` | ADR-001/009；计划书 §4.7；PC-10/11；strings-zh-CN.md | — | NF11；DR-01 |
| C-02 | Rust 模型与错误分类 | contracts §3.1–3.7 全量 serde 类型；`AppError→ErrorPayload` 与 32 稳定码 | `src-tauri/src/models/**`、`src-tauri/src/error.rs`、`fixtures/contracts/**` | contracts §3/§5；错误码表 | C-01 | R28 部分；NF11 |
| C-03 | Rust 路径与授权服务 | `authorize_local_read` 固定顺序算法；授权注册表（file/directory/remote）；asset scope 授予；启动复核；撤销 | `src-tauri/src/services/{paths,auth}.rs` | security-model §2–§4；data-model §3.2；ADR-005；contracts 24–27 | C-02 | R25、R07、R15；NF03；AT25 |
| C-04 | Rust 文件与目录服务 | 打开校验/解码（UTF-8/BOM/二进制）；读取/稳定读取/哈希/relink；源码窗口与 `search_source`；目录列举与状态 | `src-tauri/src/services/{files,tree}.rs` | contracts §2.1（4–10、38）、§7.4；R01–R03/R07/R18/R29 | C-02、C-03 | R01–R03、R07、R17–R18、R29；NF01/NF11；AT01–03、07、17–18、29 |
| C-05 | Rust 存储服务 | SQLite schema v1／迁移；settings/recents/positions/session/authorizations/cache repos；写入门禁；分类清除；LRU | `src-tauri/src/services/{storage,session}.rs` | data-model 全部；ADR-004；contracts 13–23、26–27 | C-02 | R06、R19、R23、R27；NF08；AT06、19、23、27 |
| C-06 | Rust 监测、事件与单实例 | notify 注册／防抖合并／替换保存检测／资源失效；单实例移交与启动参数队列；事件发射；聚焦复核协调 | `src-tauri/src/services/{watch,app}.rs` | contracts §4/§7；ADR-006；R22/R21 | C-04、C-05 | R01、R21–R22；NF07；AT21–22 |
| C-07 | Rust 远程资源服务 | 远程策略（HTTPS-only、私网阻断、≤3 跳、大小/超时帽）；会话授权；缓存与撤销清理 | `src-tauri/src/services/resources.rs` | security-model §4；contracts 28–30；R26 | C-02、C-03 | R26；NF02/NF03；AT26 |
| C-08 | Rust 诊断与应用信息服务 | 结构化日志/脱敏/预览/导出校验；`get_app_info`/`read_legal_text`；`open_external_url`/`reveal_in_folder` | `src-tauri/src/services/{diagnostics,info}.rs` | security-model §7；contracts 31–34、36–37；R28/R30/R15 | C-02、C-05 | R15、R28、R30 部分；NF01/NF02；AT28、30 |
| C-09 | Rust 命令表面与能力/CSP | 38 命令薄层注册与映射；capabilities 最小集；生产 CSP 与插件白名单 | `src-tauri/src/commands/**`、`src-tauri/src/state.rs`、`src-tauri/capabilities/**`、`tauri.conf.json`（CSP） | contracts §2/§9；security-model §6；ADR-001 | C-03..C-08 | 全部 R（表面）；NF03/NF11 |
| C-10 | TS 外壳、服务层、i18n 与令牌（含通用组件） | `invoke`/事件唯一入口与错误归一化；全局 store＋每标签会话 reducer＋提交规则单点；事件桥；设计令牌；通用组件与焦点管理；`t()` 运行时 | `src/app/**`、`src/services/**`、`src/styles/**`、`src/components/**`、`src/locales/zh-CN.json` | contracts §5/§6/§8；ADR-003/009；ui-spec §2.1/§5/§6；strings 全表 | C-01、C-09 | R22、R23、R24、R28 部分；NF09；跨切 |
| C-11 | 文档管线 | ①–⑫ 单管线：解析/GFM/数学/变换/消毒/引擎注入/React 映射/块包装；大纲、块指纹、搜索分段、源映射；Worker 与回退 | `src/document/**` | rendering-pipeline 全部；ADR-002/007；security-model §5；R08–R14、R17–R19、R29 | C-01、C-02（类型） | R08–R14、R17–R19、R29；NF11；AT08–14、17–19、29 |
| C-12 | 阅读器（主体） | 标签生命周期与激活策略；阅读视图与渐进挂载；块组件（公式/代码/图表/图片）；更新横幅与提交；位置保存/恢复；视图切换；文档信息 | `src/features/reader/**`（除 welcome/nav/source/inspect/zoom） | R05、R14–R16、R18–R22；ui-spec §3.2/UI01；models §1/§2/§4/§6/§7 | C-10、C-11 | R05、R07、R10–R16（UI）、R18–R22；AT05、07、10–16、18–22 |
| C-13 | 欢迎/最近与导航 | UI00 欢迎/最近（≤6 首屏、不可用、移除、示例）；文件树与大纲；面板互斥与响应式 | `src/features/reader/{welcome,nav}/**` | ui-spec §3.1/§3.3；R01–R03、R06、R02、R14、R20 | C-10、C-11、C-12 | R01–R03、R06、R02、R14、R20；AT01–03、06、14、20 |
| C-14 | 搜索与导航历史 | 搜索条与会话（IME 门控、去抖、范围/大小写、三态、循环）；正文/源码搜索执行与高亮定位；每标签历史栈与合并 | `src/features/search/**`、`src/features/reader/history/**` | R16–R17；ADR-007；ui-spec §3.4；NF05 | C-10、C-11 | R16–R17；NF05；AT16–17 |
| C-15 | 源码视图与检查/放大 | UI04 只读源码（行号、窗口、映射返回）；公式/代码/图表检查抽屉与复制反馈；放大覆盖层 | `src/features/reader/{source,inspect,zoom}/**` | R04、R08、R10–R13、R17–R19、R29；ui-spec §3.5/§3.6 | C-10、C-11、C-12 | R04、R10–R13、R18–R19、R29；AT04、10–13、18–19、29 |
| C-16 | 设置、隐私、关于与诊断界面 | Aa 浮层与五分类设置；隐私/清除/授权列表；关于/许可离线查看；诊断面板与导出预览 | `src/features/settings/**` | R06、R08、R10、R20、R23、R25、R27、R28、R30；ui-spec §3.7/§3.8 | C-10、C-12、C-15 | R23、R25、R27、R28、R30；AT23、25、27、28、30 |
| C-17 | 大文档与简化/源码窗口模式 | >10MiB 提示与简化阅读；>50MiB 仅源码窗口；覆盖范围说明；阈值统一 | `src/document/modes/**`、`src/features/reader/largeDoc/**` | R29；rendering-pipeline §5；ui-spec §3.8；IX15 | C-11、C-12、C-15 | R29；NF06；AT29 |
| C-18 | 打包与发行资产（含许可文件） | .deb 构建、图标、.desktop、离线资源随包、元数据一致性；LICENSE/THIRD_PARTY_NOTICES 随包；A9 处置 | `src-tauri/tauri.conf.json`（bundle）、`src-tauri/icons/**`、`packaging/**`、`LICENSE`、`THIRD_PARTY_NOTICES.md` | ADR-008；R30；NF12；DR-06 | C-20、C-21 配合 | R30；NF02/NF12；AT30、IT08 |
| C-19 | 测试基础设施与固定样例 | vitest/cargo 配置；固定样例集（渲染管线 §7 八类 + 大文档）；契约与语义向量；桌面 helper（libxdo）与截图工具；性能/可访问性脚本 | `tests/**`、`fixtures/**` | NF11；ADR-010；rendering-pipeline §7 | C-01 起 | NF04–NF09、NF11；DR-03–05 |
| C-20 | README（代码交付文档） | 项目根 README：构建/运行/测试已验证命令、已知限制；M6 完整版 | `README.md` | DR-01/DR-06；框架规则 | C-01、M3 后 | DR-01/DR-06 |
| C-21 | 产品与发布文档 | 使用说明、已知限制、开源信息、发布说明 | `docs/**` | DR-06；R30；ADR-008 | C-18 | DR-06；NF12 |

### 3.2 组件门禁与 DoD

通用：Rust 组件 = `cargo build --workspace` ＋ `cargo test` ＋ `cargo clippy -- -D warnings` ＋ `cargo fmt --check`；TS 组件 = `pnpm typecheck` ＋ `pnpm lint` ＋ `pnpm test -- --run` ＋ `pnpm build`；桌面相关组件追加真实运行证据。

| C | DoD（附加） | 门禁级别 | 规模 | 主要风险 |
|---|---|---|---|---|
| C-01 | corepack 固定 pnpm；两锁文件；`pnpm build` 空壳通过；`cargo check` 通过 | STANDARD | M | 版本兼容与代理取包失败；Tauri CLI 版本漂移 |
| C-02 | 全类型 round-trip fixture；32 错误码完整性测试 | STANDARD | S | serde 字段名/可选性偏差 |
| C-03 | tempfile 用例：根内 `../` 合法、根外/符号链接逃逸拒绝、TOCTOU 重检、scheme 处理 | STRICT | M | 安全核心；组件边界与注册表一致性 |
| C-04 | 编码/BOM/空文件/二进制样例；稳定读取（S1/N）；>50MiB 窗口；目录状态与截断 | STRICT | L | 稳定读取竞态；大文件内存；目录截断语义 |
| C-05 | 迁移故障注入（空/v1/损坏/只读/磁盘满/中断）；门禁与清除映射逐类断言 | STRICT | L | STRICT 表与 JSON 字段；抑制状态机 |
| C-06 | 防抖合并（W1）与资源失效集成测试；单实例移交 | STRICT | L | notify 平台差异；事件泄漏/幽灵任务 |
| C-07 | 私网/环回/重定向逐跳/大小超时用例（测试用本地 TLS 或注入 transport） | STRICT | M | TLS/证书测试环境；策略绕过 |
| C-08 | 脱敏向量；导出目标受保护位置拒绝；日志无正文 | STRICT | M | 路径脱敏遗漏；导出边界 |
| C-09 | 38 命令逐个形状测试；capabilities 与 CSP 与 security-model §6 逐项核对 | STRICT | L | 接线漂移；权限“先全开再收” |
| C-10 | 提交规则单点测试（乱序/失效）；i18n 回退与键完整性；错误归一化 | STANDARD | L | reducer 重计算；令牌规则实现偏差 |
| C-11 | 八类固定样例全绿；消毒 schema 精确断言；管线顺序与源映射切片断言 | STRICT | L | 复杂度最高；引擎升级改变语义（NF11） |
| C-12 | 标签/更新/位置组件测试；真实运行走查；提交不回退用例 | STRICT | L | 提交规则与 UI 状态耦合；选区/焦点细节 |
| C-13 | 组件测试 + 目录状态样例；键盘树导航 | STANDARD | M | 树焦点模型；懒加载失败态 |
| C-14 | 折叠/公式源/alt/大小写/CJK/emoji 样例；会话历史合并；旧批次隔离 | STRICT | M | 折叠内容命中与索引边界 |
| C-15 | 复制载荷（LF 归一/尾换行）；映射返回失败文案；放大层焦点 | STANDARD | M | 复制与显示不一致；窗口模式边界 |
| C-16 | 设置 applied/persisted 分离；清除逐类结果；关于离线；导出预览 | STANDARD | L | 清除后自动重建；保存失败提示 |
| C-17 | 10MiB/50MiB 生成语料；简化模式搜索/复制完整性断言 | STRICT | M | 阈值与复杂度判定；“部分称全文” |
| C-18 | `tauri build --bundles deb` 产出；`dpkg-deb -I/-c` 元数据核对；提取运行冒烟；离线检查 | STRICT | M | 离线资产遗漏；包依赖与许可一致性 |
| C-19 | 全部测试层可复跑；桌面 helper 构建成功并注入真实窗口；截图流程产出 PNG | STANDARD | M | libxdo 链接；固定条件复现 |
| C-20 | 命令经验证（含实际执行输出）；限制如实 | STANDARD | S | 命令漂移未复跑 |
| C-21 | 文档与当前代码/包元数据核对；无未实现能力描述 | STANDARD | M | 夸大支持范围 |

---

## 4. 任务图（T-01–T-74）与工作包

约定：每个 T 行给出目标、关键输出路径、输入/依赖与测试要点；每个 wp 表给出分支、提交范围与门禁。**提交范围均另含 `artifacts/00-repository/gates/wp-NN-gate.md`（Orchestrator 门禁记录）与合并记录（rm 任务）**；测试命令基线见 §3.2。

### 4.1 M2 基础（wp-07 – wp-15）

| T | 目标与关键输出 | 输入/依赖 | 测试要点 | wp |
|---|---|---|---|---|
| T-01 | 工程初始化：corepack 固定 pnpm、`package.json` scripts、Vite/TS、Tauri 工程与锁文件、lint/format 配置 | ADR-001；计划书 §4.7；A3 | `pnpm install --frozen-lockfile`；`pnpm build`；`cargo check`；lint 空跑 | wp-07 |
| T-02 | i18n 骨架：由 strings-zh-CN.md 生成 `src/locales/zh-CN.json`；`t()` 与键完整性测试脚本 | strings-zh-CN.md；ADR-009 | 键存在性/重复键/`{param}` 语法测试 | wp-07 |
| T-03 | Rust serde 模型：contracts §3.1–3.7 全部结构（rename_all=camelCase、Option 省略） | contracts §3 | 字段序列化快照测试 | wp-08 |
| T-04 | 错误分类：`AppError`（thiserror）→ `ErrorPayload`；32 稳定码与 messageKey 映射 | contracts §5；strings §14 | 码表完整性（32/32）；retryable/sourceRange 规则 | wp-08 |
| T-05 | 契约 fixtures：每命令请求/响应样例 JSON（`fixtures/contracts/`）与 Rust 侧 round-trip 测试 | contracts §2–§3 | fixture round-trip；可选字段省略规则 | wp-08 |
| T-06 | `authorize_local_read` 固定顺序实现（含百分号解码、canonicalize、组件级匹配、TOCTOU 重检一次） | security-model §2；R25 | 根内 `../`、根外、符号链接逃逸、NUL、scheme、大小写 | wp-09 |
| T-07 | 授权注册表：grant/revoke/list、启动复核（session 清除、persistent 复核）、asset scope 授予与撤回 | data-model §3.2；contracts 24–27 | 重复授权幂等；撤销后新读取失败；scope 移除 | wp-09 |
| T-08 | 打开校验与解码：扩展名（忽略大小写）、存在/可读/普通文件、BOM 剥离、二进制/非 UTF-8 拒绝、空文件成功 | contracts §2.1 (4)；R01–R03 | 编码样例表；拒绝原因正确 | wp-10 |
| T-09 | `read_document`（initial/restore/refresh/relink）＋校验快照缓存＋稳定读取（S1=150ms、N=5）＋SHA-256/VersionInfo | contracts §2.1 (5–6)、§7.4；R22 | 写者脚本制造 v1/v2；不稳定→PS_IO_CHANGED；relink 两分支 | wp-10 |
| T-10 | `get_source_info`/`read_source_window`/`search_source`（行索引、分段、流式字面搜索、complete=false） | contracts §3.1 (7、8、38)；R18/R29 | 行边界；扫描前后版本校验；超预算不完整 | wp-10 |
| T-11 | `open_directory`/`read_directory`：懒展开、symlink 状态、2000 截断、越界/无权限/缺失状态 | contracts §3.2 (9–10)；R02/R25 | 目录 fixture 树；状态枚举逐项 | wp-10 |
| T-12 | SQLite：连接参数、schema v1 DDL、`PRAGMA user_version` 迁移框架（单事务、失败降级） | data-model §2/§4；ADR-004 | 迁移幂等；失败回滚；损坏不静默清空 | wp-11 |
| T-13 | repos 与门禁：settings/recents(≤100)/positions/session/sidebar/authorizations/cache_meta；`write_allowed`；分类清除；缓存 LRU 256MiB | data-model §3–§7；contracts 13–23、26–27 | 门禁矩阵；清除逐类结果；抑制恢复规则 | wp-11 |
| T-14 | 存储故障注入测试：空库/v1 库/损坏/只读/磁盘满模拟/迁移中断 | NF08；data-model §4 | 全故障矩阵；降级可读 | wp-11 |
| T-15 | notify 监测：注册（文件+父目录+资源集合）、W1 防抖合并、替换保存检测、`kind=resource` 失效；事件载荷无正文 | contracts §7；ADR-006 | 合并窗口计数；unwatch 后无事件 | wp-12 |
| T-16 | 单实例与启动参数：队列、`open-requested` 移交、`take_pending_open_requests` 排空；聚焦复核协调 | contracts §2.1(35)、§4、§7.5 | 第二实例路径进入打开流程；排空语义 | wp-12 |
| T-17 | 远程策略与缓存：HTTPS-only、DNS 全地址私网/环回/ULA 阻断、≤3 跳逐跳校验、20MiB/5s/15s 帽、无重试、无 Cookie/Referer；缓存写入与撤销清理 | security-model §4；R26 | 策略纯函数向量表；重定向阻断；缓存 LRU | wp-13 |
| T-18 | 诊断：结构化日志滚动（10MiB）、脱敏（无正文/私人路径/令牌）、`preview/export` 校验（受保护源位置、覆盖确认、原子写） | security-model §7；contracts 36–37 | 脱敏向量；导出拒绝矩阵；失败保留预览 | wp-14 |
| T-19 | 应用信息：`get_app_info`（版本/归属/GPL/sourceEntryUrl=null+原因）、`read_legal_text`、`open_external_url`（http/https）、`reveal_in_folder` | contracts §3.7 (31–34)；R30/R15 | 元数据一致性；协议白名单；授权检查 | wp-14 |
| T-20 | 命令表面：38 命令注册、参数校验、错误映射；capabilities 最小集与 CSP；插件白名单（dialog/clipboard/opener/single-instance，其余不注册） | contracts §2/§9；security-model §6 | 38/38 形状测试；能力逐项核对；生产/开发 CSP 区分 | wp-15 |

| wp（分支） | 任务 | 提交范围 | 门禁/DoD |
|---|---|---|---|
| wp-07（`task/wp-07-skeleton`） | T-01, T-02 | `package.json`、`pnpm-lock.yaml`、`tsconfig*.json`、`vite.config.ts`、`index.html`、`src/main.tsx`、`src/app/i18n*`、`src/locales/zh-CN.json`、`rust-toolchain.toml`、`src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json,capabilities/,build.rs,src/main.rs,src/lib.rs}`、`*eslint*`、`*prettier*` | STANDARD；锁文件与空壳构建 |
| wp-08（`task/wp-08-model`） | T-03..T-05 | `src-tauri/src/models/**`、`src-tauri/src/error.rs`、`fixtures/contracts/**`、`src-tauri/tests/contract_shape.rs` | STANDARD；码表 32/32 |
| wp-09（`task/wp-09-auth`） | T-06, T-07 | `src-tauri/src/services/{mod.rs,paths.rs,auth.rs}`、`src-tauri/tests/security_paths_auth.rs`、`fixtures/security/**` | STRICT；安全用例全绿 |
| wp-10（`task/wp-10-files`） | T-08..T-11 | `src-tauri/src/services/{files.rs,tree.rs}`、`src-tauri/tests/files_*.rs`、`src-tauri/tests/tree_*.rs`、`fixtures/encoding/**` | STRICT；编码/稳定/窗口/目录矩阵 |
| wp-11（`task/wp-11-storage`） | T-12..T-14 | `src-tauri/src/services/{storage.rs,session.rs}`、`src-tauri/tests/storage_*.rs`、`src-tauri/tests/migration_*.rs` | STRICT；故障注入矩阵 |
| wp-12（`task/wp-12-watch`） | T-15, T-16 | `src-tauri/src/services/{watch.rs,app.rs}`、`src-tauri/tests/watch_*.rs` | STRICT；合并/单实例用例 |
| wp-13（`task/wp-13-remote`） | T-17 | `src-tauri/src/services/resources.rs`、`src-tauri/tests/remote_policy.rs` | STRICT；私网/重定向向量 |
| wp-14（`task/wp-14-diag`） | T-18, T-19 | `src-tauri/src/services/{diagnostics.rs,info.rs}`、`src-tauri/tests/diagnostics_*.rs` | STRICT；脱敏/导出矩阵 |
| wp-15（`task/wp-15-commands`） | T-20 | `src-tauri/src/commands/**`、`src-tauri/src/state.rs`、`src-tauri/capabilities/**`、`src-tauri/tauri.conf.json`、`src-tauri/tests/commands_surface.rs` | STRICT；38/38 与能力核对 |

**IP-1（M2 末）**：`cargo test` 全绿；应用启动出现主窗口；38 命令注册；`capabilities`/CSP 与 security-model §6 一致。

### 4.2 M3 管线与真实主阅读页（wp-16 – wp-23）

| T | 目标与关键输出 | 输入/依赖 | 测试要点 | wp |
|---|---|---|---|---|
| T-21 | TS services：§8 全签名封装（files/tree/search/watch/storage/settings/auth/remote/opener/diagnostics/app）＋`PaperStackError` 归一化＋clipboard 插件封装 | contracts §5/§8 | mock invoke 错误归一化；类型与 fixtures 对齐 | wp-16 |
| T-22 | 全局 store＋每标签会话 reducer；`TaskToken` 提交规则（contracts §6）单点实现；`DocumentModel` 模块级 Map（LRU ≤2） | ADR-003；contracts §6 | 乱序提交拒绝（INV-VC-01/02/04）；generation 单调 | wp-16 |
| T-23 | 事件桥：watch-changed/open-requested/focus/close-requested/drag-drop；退出前会话保存 | contracts §4；R06/R22 | 订阅/卸载生命周期；关闭保存失败提示 | wp-16 |
| T-24 | 设计令牌与主题：ui-spec §5 变量、`data-theme`、`prefers-reduced-motion`、宽内容局部滚动基础 | ui-spec §5 | 令牌快照；主题切换不重读文件 | wp-16 |
| T-25 | 通用组件库与焦点管理（Modal 焦点陷阱、Drawer、Popover、Menu、Banner、Toast、Toolbar、EmptyState、StatusBadge、Placeholder、SkipLink） | ui-spec §2.1/§6 | 组件测试：焦点返回、Esc、aria | wp-16 |
| T-26 | i18n 运行时：`t()` 插值、回退链、开发警告；与 zh-CN.json 键完整性测试 | ADR-009 | 回退/缺失键/参数测试 | wp-16 |
| T-27 | 管线核心 ①–⑦：remark-parse/gfm/math/rehype(allowDangerousHtml)/raw/sanitize（§5.2 schema 精确）＋checkbox disabled 补丁 | rendering-pipeline §1/§2；security-model §5.2 | 消毒断言：脚本/on*/style/iframe 剥离；顺序规则 | wp-17 |
| T-28 | 变换 a/b/c：大纲与唯一锚点、块注册表与 `fp1:` 指纹、搜索分段与源映射；UTF-16↔UTF-8 助手（CJK/emoji/组合字符） | rendering-pipeline §2.4/§3 | 锚点唯一性；指纹稳定性；切片断言 | wp-18 |
| T-29 | Worker 边界：`parse.worker.ts`、任务协议、结构化克隆产物、主线程回退（PS_WORKER_FAILED） | rendering-pipeline §6；ADR-002 | 取消/废弃；回退同构 | wp-18 |
| T-30 | rehype-react 映射与块包装：`data-block-id/src-start/src-end/seg-id`；渐进挂载分片 | rendering-pipeline §2.11–§2.12 | 每块映射断言；未挂载块定位先挂载 | wp-18 |
| T-31 | KaTeX 插件：逐节点隔离、`trust:false`/`strict:"warn"`/maxSize/maxExpand、宏按文档、错误占位+诊断 | rendering-pipeline §2.8；R10 | 未知宏/宽公式/金额歧义样例 | wp-19 |
| T-32 | Shiki 插件：动态 import、语言集合、未知语言降级、行号不参与复制 | rendering-pipeline §2.9；R11 | 12 语言样例；复制载荷（LF/尾换行） | wp-19 |
| T-33 | Mermaid：占位节点与源码携带、可见渲染（strict/htmlLabels:false）、节点/超时帽、错误局部化 | rendering-pipeline §2.10；R12 | 三类图；语法错误；超限 | wp-19 |
| T-34 | 阅读器最小装配：`ReaderScreen`/`DocumentView`/`ContentBlock`/`ReaderToolbar`/根错误边界/加载占位 | ui-spec §3.2；C-11 产物 | 组件冒烟；块错误不白屏 | wp-20 |
| T-35 | 标签基础：TabBar（≥2 显示）、复用与激活、Ctrl+W、MRU→右邻→左邻 | models §7；R05 | 关闭/激活顺序用例 | wp-20 |
| T-36 | 桌面工具与最小样例：`tests/desktop`（libxdo 助手 `-lxdo` 直链）＋截图脚本（xwininfo→xwd→ffmpeg）＋样例集（中文混合、公式、代码、表格、缺失图片） | ADR-010；DR-03 | helper 可构建；对真实窗口注入；PNG 产出 | wp-21 |
| T-37 | EA-RUN 真实运行：`DISPLAY=:1` 打开固定样例、固定条件（1280×800、浅色、固定字体/缩放）截图与逐项核对记录 | T-34..T-36；DR-02/03 | 检查清单（截断/布局/溢出/焦点/关闭入口） | wp-22 |
| T-38 | README v0：构建/运行/测试已验证命令、已知限制初版 | T-01、T-37 证据 | 技术写作者按实际执行核对命令 | wp-23 |

| wp（分支） | 任务 | 提交范围 | 门禁/DoD |
|---|---|---|---|
| wp-16（`task/wp-16-shell`） | T-21..T-26 | `src/app/**`、`src/services/**`、`src/styles/**`、`src/components/**`、`src/locales/zh-CN.json`、相关 `*.test.ts(x)` | STANDARD；typecheck/lint/test/build |
| wp-17（`task/wp-17-pipeline`） | T-27 | `src/document/{pipeline,sanitize,schema}*`、`src/document/**/*.test.ts` | STRICT；消毒与顺序断言 |
| wp-18（`task/wp-18-transforms`） | T-28..T-30 | `src/document/{transforms/**,worker/**,map.tsx,source-map.ts}`、相关测试 | STRICT；锚点/分段/映射 |
| wp-19（`task/wp-19-plugins`） | T-31..T-33 | `src/document/plugins/**`、相关测试 | STRICT；引擎隔离样例 |
| wp-20（`task/wp-20-reader`） | T-34, T-35 | `src/features/reader/{ReaderScreen.tsx,body/**,toolbar/ReaderToolbar.tsx,tabs/**,update/**,info/**}`、相关测试 | STRICT；组件测试＋冒烟 |
| wp-21（`task/wp-21-desktoptool`） | T-36 | `tests/desktop/**`、`fixtures/reader-min/**` | STANDARD；helper 构建与注入成功 |
| wp-22（`task/wp-22-earlyrun`） | T-37 | `artifacts/70-verification/early-run.md`、`artifacts/70-verification/evidence/early-run/**` | STANDARD；真实运行＋截图＋核对清单 |
| wp-23（`task/wp-23-readme`） | T-38 | `README.md` | STANDARD；命令实际复跑 |

**IP-2（EA-RUN 检查点）**：wp-22 证据齐备且 wp-23 README 命令复跑通过后写入 Checkpoint，才继续 M4。

### 4.3 M4 交互特性（wp-24 – wp-31）

| T | 目标与关键输出 | 输入/依赖 | 测试要点 | wp |
|---|---|---|---|---|
| T-39 | WelcomePage/RecentList：标题/按钮/说明、≤6 首屏、不可用标记与 relink 入口、移除、内置示例 | ui-spec §3.1；R01–03/R06 | 取消不变；存储不可用降级 | wp-24 |
| T-40 | FileTree：`role=tree`、懒展开、焦点/选择分离、过滤“显示其他文件”、失败重试 | ui-spec §3.3；R02 | 键盘树导航；状态枚举 | wp-24 |
| T-41 | OutlineTree＋NavPanel：滚动高亮、重复标题、面板互斥、宽度记忆、响应式（≥1180/840–1179/<840） | ui-spec §3.3；R14/R20 | 导航不抢焦点；换目录状态独立 | wp-24 |
| T-42 | SearchBar＋useSearchSession：IME 门控、150ms 去抖、范围/大小写、计数、Enter 语义（EDGE-05）、三态 | ui-spec §3.4；R17；NF05 | composition 不提交；旧批次不闪回 | wp-25 |
| T-43 | 搜索执行与定位：正文分段/源码原文、`<mark>`、折叠先展开、公式源“公式源码匹配”、跨块顺序 | ADR-007；R17 | 折叠命中、alt 命中、零结果 | wp-25 |
| T-44 | 导航历史：每标签栈、来源记录、搜索会话合并、后退清 forward、Alt+左/右、返回定位文案 | models §5；R16 | INV-NH-01..08 用例 | wp-25 |
| T-45 | SourceView：只读 `<pre>`、行号、进入映射、返回映射失败文案、窗口模式（>50MiB） | ui-spec §3.5；R18/R29 | 不读盘新版本；映射失败回退 | wp-26 |
| T-46 | 检查抽屉：公式（源码/来源章节/诊断）、代码操作（复制/换行/展开 N 行/查看源码）、图表与图片工具、复制确认语义 | ui-spec §3.6；R10–13 | 复制失败提示；关闭回触发点 | wp-26 |
| T-47 | ZoomOverlay：层级、常驻控件、滚轮/方向键/按钮、Esc 回触发点 | ui-spec §3.6；VC-15 | 焦点返回；正文滚轮不控制图表 | wp-26 |
| T-48 | TypographyPopover＋SettingsDialog（阅读/文件与更新/语法/隐私/关于）：即改即预览、applied/persisted 分离、恢复显示默认 | ui-spec §3.7；R23 | 越界保留旧值；保存失败提示 | wp-27 |
| T-49 | PrivacySection＋ClearDataDialog＋持久授权列表：数量/空间、确认、逐类结果、抑制、撤销 | ui-spec §3.8；R25/R27 | 清除后不自动重建；取消无变化 | wp-27 |
| T-50 | AboutSection＋LegalTextViewer＋DiagnosticsPanel＋ExportPreviewDialog：离线许可、sourceEntryUrl=null+原因、脱敏预览与目标选择 | ui-spec §3.7/§3.8；R28/R30 | 关于不预加载远程；导出校验 | wp-27 |
| T-51 | 大文档选择与简化模式：>10MiB/复杂度提示、简化阅读子集（全文文本/搜索/复制/源码）、标注与索引范围 | rendering-pipeline §5；R29 | 简化模式搜索/复制完整性 | wp-28 |
| T-52 | >50MiB 源码窗口全流程：分段读取、范围说明、`search_source` 完整性、取消 | R29；IX15 | complete=false 不加冕“完整” | wp-28 |
| T-53 | UpdateBanner＋跟随模式：stable 观测、横幅/稍后折叠、前台无选区无检查层才提交、后台暂存 | models §4；R21 | INV-UM-01..08 用例 | wp-29 |
| T-54 | 锚点保存/恢复：AnchorRecord、同版本精确、唯一指纹精确、否则近似、布局稳定校正≤1 次、节流 | models §6；R19 | INV-AR-01..08 | wp-29 |
| T-55 | 版本提交全流程：乱序丢弃、资源 `?v=` 重挂、关闭标签失效、relink 说明后采用 | models §2/§3；R07/R22 | INV-VC-01..11；AT22 构造 | wp-29 |
| T-56 | 四入口集成：dialog/drop/CLI/system＋单实例移交＋批量顺序/首成功焦点＋非文档拒绝 | contracts §2.1(4,35)；R01 | 入口等价性；取消不变 | wp-30 |
| T-57 | 本地授权对话框＋越界资源聚合流程：范围/数量、记住默认不选、安全默认、拒绝后不追问 | ui-spec §3.8；R25 | INV-AZ-01..11 相关 | wp-31 |
| T-58 | 远程授权对话框＋受控获取＋撤销：域名列表、会话级、重定向阻止文案、撤销卸载与缓存清理 | security-model §4；R26 | 默认阻止；撤销效果 | wp-31 |

| wp（分支） | 任务 | 提交范围 | 门禁/DoD |
|---|---|---|---|
| wp-24（`task/wp-24-welcome-nav`） | T-39..T-41 | `src/features/reader/{welcome/**,nav/**}`、相关测试 | STANDARD；组件测试 |
| wp-25（`task/wp-25-search`） | T-42..T-44 | `src/features/search/**`、`src/features/reader/history/**`、相关测试 | STRICT；搜索样例集 |
| wp-26（`task/wp-26-source-inspect`） | T-45..T-47 | `src/features/reader/{source/**,inspect/**,zoom/**}`、相关测试 | STANDARD；交互冒烟 |
| wp-27（`task/wp-27-settings`） | T-48..T-50 | `src/features/settings/**`、相关测试 | STANDARD；设置/清除/导出用例 |
| wp-28（`task/wp-28-largedoc`） | T-51, T-52 | `src/document/modes/**`、`src/features/reader/largeDoc/**`、相关测试 | STRICT；10/50MiB 语料 |
| wp-29（`task/wp-29-update-anchor`） | T-53..T-55 | `src/features/reader/{update/**,position/**,view/**}`、相关测试 | STRICT；INV 用例与乱序构造 |
| wp-30（`task/wp-30-entry`） | T-56 | `src/app/entry/**`、`src/features/reader/open/**`、相关测试 | STRICT；入口矩阵 |
| wp-31（`task/wp-31-grants`） | T-57, T-58 | `src/features/settings/dialogs/**`、`src/features/reader/resources/**`、相关测试 | STRICT；授权生命周期用例 |

**IP-3（M4 末）**：所有 UI 特性接真实命令；固定条件走查（浅/深、1280×800、1024×640）记录；无占位按钮。

### 4.4 M5 测试、评审与集成（wp-32 – wp-39）

| T | 目标与关键输出 | 输入/依赖 | 测试要点 | wp |
|---|---|---|---|---|
| T-59 | 样例全量：rendering-pipeline §7 八类 + 恶意样本（脚本/事件/路径/宏/图表）+ 10/50MiB 生成脚本 | rendering-pipeline §7；NF11 | 样例固定并版本化 | wp-32 |
| T-60 | 性能/资源脚本：NF04–06（冷启动/暖打开/可搜、首结果、PSS/峰值；≥30 次并报告失败） | NF04–06；A8 | 输出原始数据与统计 | wp-32 |
| T-61 | 契约语义向量：前端字面搜索↔`search_source` 一致（toLowerCase、无归一）；UTF-16/8 转换忠实性 | ADR-007；NF11 | 双实现共向量、结果一致 | wp-32 |
| T-62 | 全量测试执行：单元/组件/契约/集成；NF07（500 次循环）；NF08 故障注入；生成报告 | T-59..T-61；各组件 | 报告 `artifacts/70-verification/unit-integration-report.md` | wp-33 |
| T-63 | 桌面系统运行与 AT01–AT30：X11 真实运行、截图、逐项记录；Wayland/抓包等未执行项标 UNVERIFIED | 全部 UI；ADR-010 | 报告 `artifacts/70-verification/acceptance-at.md`＋evidence | wp-34 |
| T-64 | 独立评审 A：Rust 服务与安全核心（算法证据、无写路径、capabilities/CSP、错误码、存储门禁） | C-02..C-09 修订 | `artifacts/60-review/review-a-rust-security.md` | wp-35 |
| T-65 | 独立评审 B：前端与管线（顺序/消毒/DSIH 禁令、i18n 硬编码、提交规则、a11y、无占位） | C-10..C-17 修订 | `artifacts/60-review/review-b-frontend-pipeline.md` | wp-36 |
| T-66 | 集成：契约验证（TS↔Rust fixtures）、跨边界集成测试、回归；记录组成修订 | IP-3 通过组件 | `artifacts/70-verification/integration-report.md` | wp-37 |
| T-67 | 系统验证：双向追溯、证据新鲜度、AT/IT 覆盖、Stage 就绪与缺口 | T-62..T-66 | `artifacts/70-verification/system-verification.md` | wp-38 |
| T-68 | IT01–IT08 端到端验收运行（X11；X11 覆盖的场景） | 发布前构建 | `artifacts/70-verification/acceptance-it.md` | wp-39 |

| wp（分支） | 任务 | 提交范围 | 门禁/DoD |
|---|---|---|---|
| wp-32（`task/wp-32-fixtures`） | T-59..T-61 | `fixtures/**`、`tests/perf/**`、`tests/contracts/**` | STANDARD；脚本可复跑 |
| wp-33（`task/wp-33-testexec`） | T-62 | `artifacts/70-verification/unit-integration-report.md` | STRICT；失败保留、不掩盖 |
| wp-34（`task/wp-34-desktop-at`） | T-63 | `artifacts/70-verification/acceptance-at.md`、`artifacts/70-verification/evidence/at/**` | STRICT；逐项证据+UNVERIFIED 清单 |
| wp-35（`task/wp-35-review-a`） | T-64 | `artifacts/60-review/review-a-rust-security.md` | 独立评审（只读；快照 review_targets） |
| wp-36（`task/wp-36-review-b`） | T-65 | `artifacts/60-review/review-b-frontend-pipeline.md` | 独立评审（只读；快照 review_targets） |
| wp-37（`task/wp-37-integrate`） | T-66 | `artifacts/70-verification/integration-report.md` | Integration Gate 证据 |
| wp-38（`task/wp-38-sysver`） | T-67 | `artifacts/70-verification/system-verification.md` | System Verification 报告 |
| wp-39（`task/wp-39-it`） | T-68 | `artifacts/70-verification/acceptance-it.md`、`artifacts/70-verification/evidence/it/**` | STRICT；任务链证据 |

**IP-4（M5 末）**：Integration Gate 通过＋系统验证报告就绪；评审发现问题已关闭或形成修正 wp 并闭环。

### 4.5 M6 文档与发布（wp-40 – wp-45）

| T | 目标与关键输出 | 输入/依赖 | 测试要点 | wp |
|---|---|---|---|---|
| T-69 | 打包：`tauri.conf.json` bundle/identifier/版本、图标、.desktop、离线资源随包；构建 `.deb`；`dpkg-deb -I/-c` 核对；提取运行冒烟 | ADR-008；R30 | 元数据一致；无 CDN 引用；离线可运行 | wp-40 |
| T-70 | 许可与 A9：未改写 GPLv3 全文、THIRD_PARTY_NOTICES（与锁文件核对）、关于页离线读取验证；`sourceEntryUrl=null`+原因；A9 未配置时记录发布阻塞 | R30/NF12；A9 | 包内文件存在；`read_legal_text` 可用 | wp-41 |
| T-71 | README 完整版：构建/安装/运行/测试/离线使用/已知限制/许可证位置 | T-69..T-70 | 命令复跑；与包元数据一致 | wp-42 |
| T-72 | 产品文档：使用说明（UI00–UI07 任务流）、已知限制、开源信息、发布说明草案 | T-69..T-71 | 无未实现能力描述；来源可核 | wp-43 |
| T-73 | 发布就绪评审＋部署/回滚计划（本地 .deb 安装/卸载/回滚；无远端时的发布路径） | M5 证据；T-69..T-72 | `artifacts/80-release/release-readiness.md` | wp-44 |
| T-74 | 最终验收与 Stage Gate 证据：AT30/IT08 可行部分、离线、许可、包一致性、未验证清单、A4/A9 状态 | T-73；全部证据 | `artifacts/80-release/stage-gate-release.md` | wp-45 |

| wp（分支） | 任务 | 提交范围 | 门禁/DoD |
|---|---|---|---|
| wp-40（`task/wp-40-package`） | T-69 | `src-tauri/tauri.conf.json`、`src-tauri/icons/**`、`packaging/**` | STRICT；.deb 产出与核对 |
| wp-41（`task/wp-41-legal`） | T-70 | `LICENSE`、`THIRD_PARTY_NOTICES.md` | STRICT；许可/元数据一致 |
| wp-42（`task/wp-42-readme`） | T-71 | `README.md`（需 snapshot 覆盖前版） | STANDARD；命令复跑 |
| wp-43（`task/wp-43-docs`） | T-72 | `docs/**` | STANDARD；来源核对 |
| wp-44（`task/wp-44-release`） | T-73 | `artifacts/80-release/release-readiness.md`、`artifacts/80-release/deployment-rollback-plan.md` | 发布就绪评审 |
| wp-45（`task/wp-45-finalaccept`） | T-74 | `artifacts/80-release/stage-gate-release.md`、`artifacts/80-release/evidence/**` | Stage Gate 证据（结论由 Orchestrator 作出） |

### 4.6 合并任务与收尾

| 节点 | 内容 | 交付物 |
|---|---|---|
| `rm-07`…`rm-45` | 每个 wp 一个 merge handoff（`--no-ff`），证据为上表路径 | `artifacts/00-repository/merges/rm-NN-merge-wpNN.md` |
| `rm-final` | Stage Gate PASS 后 `feat/v0.1.0` → `main` 本地受守卫合并且提交集成证据 | `artifacts/80-release/feat-v0.1.0-to-main-merge.md` |
| Stage Gate + Checkpoint | Orchestrator 裁决、写入 Checkpoint、`PAUSED_AT_STAGE=release` | 状态记录（state/） |

---

## 5. 测试与验证计划

### 5.1 分层

| 层 | 手段 | 覆盖（R/NF/门禁） |
|---|---|---|
| L1 纯函数单元 | vitest（`src/document/**`、helpers）；cargo test（paths/auth/files/storage/watch/remote/diagnostics） | R08–R14、R17–R19、R22、R25–R29；NF03/11 |
| L2 组件 | vitest＋Testing Library＋jsdom（焦点、状态文案、历史、搜索会话、设置） | R05、R16–R24 交互面；NF09（辅助） |
| L3 契约/形状 | `fixtures/contracts/**` 双向断言：Rust serde ↔ TS 类型；38 命令；32 错误码；messageKey ↔ zh-CN.json 键 | NF11；门禁核心 |
| L4 集成 | cargo 集成（tempfile/notify/SQLite 故障）；前端跨模块流；集成工程师用例 | R06、R07、R19、R21–R22、R27；NF07/08 |
| L5 桌面（X11） | 真实应用＋固定条件＋截图＋核对清单；libxdo 助手 | DR-02..05；AT 层 |
| L6 系统验收 | AT01–AT30、IT01–IT08；发布构建；逐项证据 | SRS §8；DR-04/05 |
| L7 性能/资源校准 | NF04–NF06 脚本（≥30 次、报告失败） | NF04–06；输出为**校准测量** |

### 5.2 CI 缺失下的执行与留证

- 全部检查在本地串行执行；每条命令、版本、环境（X11、代理、构建类型）与结果写入对应 wp 门禁记录；失败原样保留。
- 复跑纪律：任何代码修改使受影响证据失效；修正提交必须重跑受影响层（L1–L4 至少，桌面/验收按影响面）。
- 测试与实现同源原则：`src/document/**` 不依赖 Tauri/DOM，保证 vitest 与运行时代码同源（ADR-002）。

### 5.3 桌面验证协议（ADR-010）

1. **构建**：迭代用 dev 构建；**证据用 release 构建**（`pnpm tauri build` 或 development 二进制的 release 变体），记录二进制路径与哈希。
2. **运行**：`DISPLAY=:1` 启动真实应用；不做浏览器模拟（DR-04）。
3. **输入**：`tests/desktop/` libxdo 助手（`cc … -lxdo -lX11`；无 `.pc` 不经 pkg-config）；通用输入失败时人工操作并记录“人工执行”。
4. **截图**：`xwininfo -root -tree` 取窗口 id → `xwd -display :1 -id <id> -out …` → `ffmpeg -i … png`；全屏（`-root`）作为补充。
5. **固定条件**（IXD §18.4）：浅/深主题 × 1280×800/1024×640 × 200% 文字缩放；200% 实现优先用系统文本缩放（`gsettings`，用户级），不可用时用应用内字号＋记录手段；无法达成的组合标 UNVERIFIED。
6. **核对清单**：文本截断、焦点遮挡、层级与 Esc 顺序、关闭入口可达、正文无横向溢出、块级局部滚动——逐项记录实际观察，不以截图存在代替。
7. **验收记录字段**：输入样例、环境、操作、实际结果、截图路径、判定（PASS/FAIL/UNVERIFIED）。

### 5.4 性能与可达性校准

- NF04–NF06：发布构建、固定样例、字体/WebView/缓存条件；每组 ≥30 次并报告失败；同时记录系统缓存与依赖版本。结果标注“本机校准（12 核/15 GiB，非基准机）”，**不得**据此宣称达标。
- NF09：键盘走查、焦点检查、200% 缩放与窄宽回流检查、令牌对比度脚本计算；目标为“适用 WCAG 2.2 AA”，**不声明认证**。
- 阈值参数（W1/S1/N、去抖、折叠 40/20 行、焦点复核节流 300ms、校正延迟 200ms、恢复串行）固定并复跑前不作为回归依据（models §11；NF11）。

### 5.5 明确 UNVERIFIED 清单（必须如实标注）

| 项 | 原因 | 处置 |
|---|---|---|
| Wayland 侧 NF10/R30/AT30/IT08 | 本机仅 X11（A4） | 保持 UNVERIFIED；公开发布声明受限；另行会话补验后方可关闭 |
| WebDriver／tauri-driver E2E | 驱动缺失且无 sudo | 保留为将来目标；不写入本轮证据 |
| 抓包级零请求证据（AT26/NF02 的“抓包”口径） | tcpdump 无权限、netns 不可用 | 用进程 socket 观测（`ss`）＋策略/代码路径测试替代；抓包级标 UNVERIFIED |
| 真正干净系统安装（AT30/IT08） | 无 sudo 不能 `dpkg -i` | 以 `dpkg-deb -x` 提取运行＋包内容核对替代；干净安装标 UNVERIFIED/部分 |
| NF04–NF06 P95、NF09 达标 | 未实测/非基准机 | 仅发布校准数据；达标结论待基准环境复测 |
| WCAG 2.2 AA 认证 | 目标非认证 | 按条目记录，不声明通过 |
| `>50MiB` 只读源码窗口的产品边界 | models OI/架构 §13-4 曾列为待确认 | 本计划按“分段源码窗口＋流式搜索”执行；如产品改判为硬上限，变更影响后重计划 |

---

## 6. 评审与集成计划

### 6.1 独立评审（quality-reviewer，作者不得自评）

- **评审 A（wp-35）**：C-02–C-09。重点：路径算法与授权注册表证据、撤销/启动复核、无源写路径、导出受保护位置、远程策略、capabilities/CSP 最小性、错误分类完整性、存储门禁与迁移失败。
- **评审 B（wp-36）**：C-10–C-17。重点：管线顺序与消毒 schema 精确性、`dangerouslySetInnerHTML` 禁令唯一入口、引擎输出受信边界、提交规则单点、i18n 硬编码扫描与键完整性、a11y 基本项、无 v1 占位入口（DR-07）。
- 安全专项并入 A/B 清单（授权/远程/渲染消毒/能力边界/CSP）；发现一律形成**修正 wp**（新提交＋重跑受影响测试与复审），评审者不改代码。
- 派发前对 `review_targets` 做快照（已提交修订）；报告为持久交付物（非空、提交）。

### 6.2 集成（integration-engineer，wp-37）

- 前提：参与组件为当前修订的 `STABLE`（组件质量门禁通过）。
- 内容：按依赖顺序增量集成；契约验证（TS↔Rust fixtures）、跨边界集成测试（打开→解析→渲染；监测→更新→锚点；搜索；授权→资源；存储；入口流）、相关回归。
- 产出：`artifacts/70-verification/integration-report.md`（组成修订、命令与结果、失败与回退建议）；集成结果在 Integration Gate 前保持 `UNVERIFIED`。

### 6.3 系统验证（system-verifier，wp-38）

- 双向追溯：R↔设计/契约↔代码↔测试↔AT/IT 证据；陈旧/失效证据标记；缺口清单带 ID 与路径；评估验收就绪但**不代表用户验收**；建议 PASS/FAIL/BLOCKED/USER_DECISION_REQUIRED（裁决归 Orchestrator）。
- 产出：`artifacts/70-verification/system-verification.md`。

### 6.4 最终验收运行（wp-39、wp-45）

- wp-39：IT01–IT08 在发布前构建上按任务链执行（X11 可覆盖部分）。
- wp-45：发布候选（.deb 提取运行）上执行 AT30/IT08 可行部分、离线与许可核对、包一致性；汇总未验证项与 A4/A9 状态，形成 Stage Gate 证据。

### 6.5 修订与重跑规则

代码/文档修改 → 受影响测试与评审证据作废并重跑；修正用新提交；合并仅在门禁证据对当前 source tip 有效时进行；过期证据不得合并（guard 以字节固定证据）。

---

## 7. 风险登记

| ID | 风险 | 概率/影响 | 缓解 | 触发条件 |
|---|---|---|---|---|
| RK-01 | 无 WebDriver/Wayland 导致交互与兼容验证受限 | 高/中 | ADR-010 协议；UNVERIFIED 标注；人工核对清单；将来环境补验 | 依赖自动化 IME/跨会话的检查无法复现 |
| RK-02 | 范围大（39 wp）与可用投入不匹配 | 高/高 | 波次排序、EA-RUN 前置、每 wp 小而可审；必要时仅经所有者决策调整声明范围 | M3/M4 连续两个 wp 门禁延迟或失败 |
| RK-03 | 折叠/未挂载内容与公式源的搜索正确性 | 中/高 | 单源分段＋固定向量（T-61）＋评审 B；折叠先展开再定位 | AT17 样例失败或计数不一致 |
| RK-04 | 跨版本锚点误称“精确”（重复段落/多候选） | 中/中 | INV-AR 用例＋唯一指纹规则；重复标题/删除场景样例 | AT19 近似/精确判定偏差 |
| RK-05 | 消毒边界缺口（schema/引擎注入） | 中/高 | 精确 schema 断言＋恶意样例＋安全评审；KaTeX/Shiki/Mermaid 固定配置 | 任一逃逸样例或 DSIH 越界 |
| RK-06 | 打包离线资产遗漏（字体/语法/图表/CDN 引用） | 中/高 | 构建期外链扫描＋离线运行测试＋CSP 审计 | 断网启动出现资源失败 |
| RK-07 | GPL 合规与 A9 对应源码入口缺失 | 中/高（发布阻塞） | 提前加入 LICENSE/第三方声明（wp-41）；`sourceEntryUrl=null`+原因；向所有者升级 | 发布门禁时 A9 仍未配置 |
| RK-08 | Rust↔TS 契约漂移 | 中/中 | fixtures 双向断言＋集成契约验证；契约变更走 r2 流程（本计划外） | 集成测试形状失败 |
| RK-09 | 性能/可达性数字被误读为已达标 | 中/低 | 一律“校准测量”标注；非基准机说明；不用于宣传 | 任何把校准值写成合规结论的表述 |
| RK-10 | 依赖取包/网络波动（代理）影响构建 | 低/中 | 锁文件＋cargo 缓存；失败重试并留证；避免无锁升级 | `pnpm install --frozen-lockfile` 或 cargo fetch 失败 |
| RK-11 | libxdo 链接方式（无 `.pc`）导致桌面工具构建失败 | 低/低 | 直接 `-lxdo -lX11`；失败则回退人工操作＋记录 | helper 构建失败 |

---

## 8. 最小必要路径（当前状态 → `release`）

### 8.1 节点序列与就绪状态（自上而下执行）

| 节点 | 前置 | 状态（当前） | 说明 |
|---|---|---|---|
| rm-06（合并 wp-06 本计划） | wp-06 finish | **READY（下一步）** | 合并后 `feat/v0.1.0` 前进一次，M1 完成 |
| wp-07 → rm-07 | rm-06 | BLOCKED | 骨架与 i18n 骨架 |
| wp-08 → rm-08 | rm-07 | BLOCKED | 模型/错误/契约 fixtures |
| wp-09 → rm-09 | rm-08 | BLOCKED | 路径与授权（P-1 就绪集） |
| wp-11 → rm-11 | rm-08 | BLOCKED | 存储（P-1 就绪集；仅依赖 C-02） |
| wp-10 → rm-10 | rm-09 | BLOCKED | 文件/目录服务（依赖路径授权） |
| wp-13 → rm-13 | rm-09 | BLOCKED | 远程资源（依赖授权） |
| wp-14 → rm-14 | rm-11 | BLOCKED | 诊断/应用信息（依赖存储） |
| wp-12 → rm-12 | rm-10、rm-11 | BLOCKED | 监测/单实例（依赖文件与存储） |
| wp-15 → rm-15 | rm-10、rm-11、rm-12、rm-13、rm-14 | BLOCKED | 38 命令＋能力/CSP；IP-1 |
| wp-16、wp-17 → rm | rm-15 | BLOCKED | TS 基础层与管线核心（P-2 组） |
| wp-18、wp-19 → rm | rm-17 | BLOCKED | 变换/映射/Worker；引擎插件 |
| wp-20 → rm-20 | rm-16、rm-18、rm-19 | BLOCKED | 阅读器最小装配 |
| wp-21 → rm-21 | rm-20 | BLOCKED | 桌面工具与最小样例 |
| wp-22 → rm-22 | rm-21 | BLOCKED | **EA-RUN：真实主阅读页＋截图** |
| wp-23 → rm-23 | rm-22 | BLOCKED | README v0；**CP-EARLY-RUN** |
| wp-24 … wp-31（P-3 组，串行）→ 各自 rm | rm-23 | BLOCKED | M4 交互特性；IP-3 |
| wp-32 → rm-32 | rm-31 | BLOCKED | 样例全量/测量脚本/契约向量 |
| wp-33、wp-34 → rm | rm-32 | BLOCKED | 全量测试执行；桌面 AT01–AT30 |
| wp-35、wp-36（P-4 组）→ rm | rm-34 | BLOCKED | 独立评审 A/B（依赖已提交修订＋快照） |
| wp-37 → rm-37 | rm-35、rm-36 及修正闭环 | BLOCKED | 集成与回归；Integration Gate |
| wp-38 → rm-38 | rm-37 | BLOCKED | 系统验证 |
| wp-39 → rm-39 | rm-38 | BLOCKED | IT01–IT08；**CP-M5** |
| wp-40、wp-41 → rm | rm-39 | BLOCKED | 打包与许可 |
| wp-42、wp-43（P-5 组）→ rm | rm-41 | BLOCKED | README 完整版与产品文档 |
| wp-44 → rm-44 | rm-42、rm-43 | BLOCKED | 发布就绪与部署/回滚计划 |
| wp-45 → rm-45 | rm-44 | BLOCKED | 最终验收与 Stage Gate 证据 |
| rm-final（feat → main） | Stage Gate PASS | BLOCKED | 受守卫本地合并＋集成证据 |
| Stage Gate + Checkpoint | rm-final | BLOCKED（受 A9/A4 约束） | `PAUSED_AT_STAGE=release` |

### 8.2 检查点（必须持久化）

- **CP-00（现在）**：本计划合并后，记录 M1 完成、契约冻结、M2 就绪。
- **CP-01（IP-1 后）**：Rust 基础全绿、38 命令注册、能力配置核对完成。
- **CP-EARLY-RUN（IP-2）**：真实主阅读页运行＋固定条件截图＋README v0 命令验证；记录未验证项。
- **CP-02（IP-3 后）**：UI 特性完成、固定条件走查记录。
- **CP-03（IP-4 后）**：测试/评审/集成/系统验证证据状态、缺口与修正闭环。
- **CP-04（Stage Gate）**：发布候选、未验证清单、A4/A9 状态、`PAUSED_AT_STAGE=release`。
- 失败/范围变化时：记录失败证据与根因，仅重算受影响子图（Change Impact），不重做无关节点。

### 8.3 停止条件

1. `release` 目标 Stage Gate PASS → 写 Checkpoint、`PAUSED_AT_STAGE`、报告交付物与残余风险并**停止**（不进入维护/后续版本）。
2. 需要用户裁决（A9 源码入口、A4 Wayland、或材料级范围/成本取舍）→ 澄清门停止并提问。
3. 必需输入/权限/工具不可用（如依赖取包失败、无 sudo 场景扩展）→ 记录阻塞并停止受影响路径。
4. 质量/集成门禁失败且安全范围内恢复手段耗尽 → 停止并升级，不做无限循环修补。
5. 继续将超出用户请求范围 → 停止。

---

## 9. 追溯汇总

### 9.1 R01–R30 → 组件/任务/AT

| R | 主承接组件 | 主任务（wp） | AT | 备注 |
|---|---|---|---|---|
| R01 | C-04、C-06、C-09、C-10、C-12 | T-08/T-09（w10）、T-16（w12）、T-56（w30） | AT01 | 四入口等价；首成功焦点 |
| R02 | C-04、C-13 | T-11（w10）、T-40/T-41（w24） | AT02 | 目录状态与懒展开 |
| R03 | C-04 | T-08（w10） | AT03 | BOM/空文件/其他编码 |
| R04 | C-04、C-09、C-15、C-18 | T-08（w10）、T-45（w26）、T-70（w41） | AT04 | 无写路径＋哈希证据；导出校验 |
| R05 | C-12 | T-35（w20） | AT05 | 复用/MRU/关闭 |
| R06 | C-05、C-09、C-13 | T-13（w11）、T-16（w12）、T-39（w24） | AT06 | 最近≤100；恢复不重建 |
| R07 | C-04、C-06、C-12 | T-09（w10）、T-15（w12）、T-55（w29） | AT07 | relink 两分支；保留内容 |
| R08 | C-11 | T-27（w17） | AT08 | technical/standard 组合 |
| R09 | C-11（＋评审） | T-27（w17）、T-65（w36） | AT09 | 消毒 schema；DSIH 禁令 |
| R10 | C-11、C-15 | T-31（w19）、T-46（w26） | AT10 | 宏隔离；金额歧义开关 |
| R11 | C-11、C-12、C-15 | T-32（w19）、T-34（w20）、T-46（w26） | AT11 | 复制载荷 LF/尾换行 |
| R12 | C-11、C-12 | T-33（w19） | AT12 | strict；局部错误 |
| R13 | C-12、C-03、C-07 | T-46（w26）、T-57/T-58（w31） | AT13 | 图片状态分列 |
| R14 | C-11、C-13 | T-28（w18）、T-41（w24） | AT14 | 唯一锚点；不抢焦点 |
| R15 | C-11、C-03、C-04、C-08 | T-30（w18）、T-19（w14）、T-56（w30） | AT15 | 链接路由与授权 |
| R16 | C-14 | T-44（w25） | AT16 | 每标签历史；搜索会话合并 |
| R17 | C-14、C-11、C-04 | T-42/T-43（w25）、T-28（w18）、T-10（w10） | AT17 | 折叠/公式源/大小写 |
| R18 | C-15、C-04、C-12 | T-45（w26）、T-10（w10） | AT18 | 同展示版本；映射回退 |
| R19 | C-11、C-12、C-05 | T-28（w18）、T-54（w29） | AT19 | 精确/近似判定 |
| R20 | C-12、C-13、C-05 | T-41（w24）、T-13（w11） | AT20 | 面板互斥与状态记忆 |
| R21 | C-12、C-06 | T-53（w29）、T-15（w12） | AT21 | keep/follow 条件 |
| R22 | C-06、C-12、C-10 | T-15/T-16（w12）、T-22（w16）、T-55（w29） | AT22 | 乱序/资源失效/关闭失效 |
| R23 | C-16、C-10、C-05 | T-48（w27）、T-24（w16） | AT23 | applied/persisted 分离 |
| R24 | C-10–C-17（横切） | T-25（w16）及各 UI 任务；T-63（w34） | AT24 | 键盘/焦点/200% |
| R25 | C-03、C-16、C-13 | T-06/T-07（w09）、T-57（w31） | AT25 | 聚合确认；持久需勾选 |
| R26 | C-07、C-16、C-12 | T-17（w13）、T-58（w31） | AT26 | 默认零请求；撤销清理 |
| R27 | C-05、C-08、C-16 | T-13（w11）、T-18（w14）、T-49（w27） | AT27 | 分类清除与抑制 |
| R28 | C-08、C-16、C-10 | T-18（w14）、T-50（w27） | AT28 | 脱敏/预览/导出 |
| R29 | C-04、C-11、C-17 | T-10（w10）、T-51/T-52（w28） | AT29 | 阈值/覆盖说明 |
| R30 | C-18、C-08、C-16、C-21 | T-19（w14）、T-69/T-70（w40/41）、T-74（w45） | AT30 | A9 阻塞发布声明 |

**未覆盖声明**：R01–R30 在计划层面**全部有承接组件与任务**；无缺口。环境受限项见 §5.5（Wayland、抓包、干净安装、性能/可达性达标）。

### 9.2 NF01–NF12

| NF | 承接（组件/任务） | 验证 | 性质/限制 |
|---|---|---|---|
| NF01 | C-04/C-05/C-08；T-08、T-18、T-70 | AT04/IT01 哈希与目录快照；导出拒绝 | 零容忍；atime 不作为证据 |
| NF02 | C-07/C-18；T-17、T-69 | 离线运行＋socket 观测＋代码路径测试 | 零容忍；抓包级 UNVERIFIED |
| NF03 | C-03/C-07/C-11；T-06、T-17、T-27、T-64/65 | 恶意样例与越权请求失败 | 零容忍 |
| NF04 | C-19/C-12；T-60 | 校准脚本（≥30 次） | 待实测；非基准机 |
| NF05 | C-14/C-19；T-42、T-60 | 查询计时与旧批次隔离 | 待实测 |
| NF06 | C-17/C-19；T-60 | PSS/峰值分组报告 | 待实测 |
| NF07 | C-06/C-12/C-04；T-62 | 500 次循环＋取消即时反馈 | 行为验收 |
| NF08 | C-05；T-12..T-14、T-62 | 故障注入矩阵 | 故障注入验收 |
| NF09 | C-10..C-17；T-25、T-63 | 键盘/焦点/缩放/回流按条目 | 目标非认证 |
| NF10 | C-18/C-19；T-63、T-74 | X11 实测；Wayland UNVERIFIED | 平台实测（受限） |
| NF11 | C-19；T-59..T-61、T-14 | 样例／锁文件／契约向量 | 过程证据 |
| NF12 | C-18/C-20/C-21；T-69、T-70、T-73、T-74 | 包元数据与许可核对；A9 门禁 | 发布门禁（A9/A11 相关） |

### 9.3 IT01–IT08

| IT | 主任务（wp） | 环境依赖/限制 |
|---|---|---|
| IT01 首次只读阅读 | T-68（w39）＋AT04 证据 | X11 可执行；中文路径样例 |
| IT02 连续导航 | T-68（w39）＋T-43/T-44 用例 | X11 可执行 |
| IT03 选区下外部更新 | T-68（w39）＋T-53/T-55 构造 | 需脚本化外部写入（写者脚本文本） |
| IT04 异步乱序与退出 | T-62（w33，组件层强制乱序）＋T-68 | 桌面层近似；组件层为主证据 |
| IT05 权限与离线 | T-68（w39）＋T-63 | 抓包级 UNVERIFIED；socket 观测替代 |
| IT06 重启与隐私 | T-68（w39） | X11 可执行 |
| IT07 键盘与大文件 | T-68（w39）＋T-63 | 200% 缩放手段见 §5.3；失败组合标 UNVERIFIED |
| IT08 实际交付 | T-74（w45） | 干净安装不可用（无 sudo）→ 提取运行替代；Wayland 侧 UNVERIFIED |

---

## 10. 变更记录

### Rev 1 — 2026-10-07

- Producer `agent:delivery-planner`；任务 `wp-06-plan`（分支 `task/wp-06-plan`；父分支 `feat/v0.1.0`）。
- 方法：对 10 项 pinned 输入逐一消费（需求基线、架构 5 件、模型、UI 规格、字符串目录、启动请求）＋已合并的 10 份 ADR 与仓库证据；环境事实实测复核（Node/Rust/GTK/WebKitGTK、WebDriver 缺失、X11、工具可用性、网络与权限限制）；输出组件图 21 件、任务 74 项、工作包 39 个（wp-07..45）＋39 个合并任务＋最终 main 合并；建立 R/NF/AT/IT 追溯与 UNVERIFIED 清单。
- 规范决议：串行执行模型与 wp 流转固化为本计划 §1；`wp-NN`/`rm-NN` 编号为建议（Orchestrator 可重排）；证据目录布局（§1.3）为本计划假设，低风险可调整。
- 未决：A9（发布阻塞）、A4（Wayland）、证据目录命名确认、契约 OI-02/‑05 组合场景（见 §开放项）。

## 开放项（交 Stage Orchestrator）

1. **A9 对应源码入口（发布阻塞）**：在 §8 CP-04/Stage Gate 之前，需所有者提供真实可访问入口；未提供则按 R30/NF12 记录发布阻塞（不放伪地址），Release 目标不能宣告达成。建议在 M5 开始前向所有者澄清，避免末期返工。
2. **A4 Wayland 验收环境**：需要时安排会话补验；否则 NF10/R30/AT30/IT08 的 Wayland 侧保持 UNVERIFIED，公开发布声明相应受限（本轮计划已按此执行）。
3. **证据目录命名（artifacts/60-review、70-verification、80-release）**：本计划假设；如 Orchestrator 已有目录约定，请以其一为准并同步 §1.3（低风险，不阻塞执行）。
4. **契约开放项对实现的影响**：models §开放项 OI-02（接受候选与预派发任务）、OI-05（源不可用后候选提交）需在 wp-29 实现前给出裁决口径；本计划按契约严格解释执行；若改判需 `paperstack-ipc-r2`＋Change Impact（超出本计划范围）。
5. **`>50MiB` 产品边界**（架构 §13-4）：本计划按“分段源码窗口＋流式搜索”执行；若产品改判为硬上限，需变更影响后重计划。
6. **Tauri CLI 安装方式**：默认经 `@tauri-apps/cli`（pnpm 固定版本）；若网络受限改为 `cargo install tauri-cli`（版本固定）——工程选择，无需用户裁决，但需在执行中记录。
