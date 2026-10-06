# 纸栈 PaperStack · 项目 Intake 报告（Project Intake Report）

- **Producer**: agent:asset-analyst
- **Artifact ID**: ART-10-INTAKE
- **Artifact Type**: Project Intake Report（资产清单 / 来源权威 / 约束登记 / 差距观察）
- **Status**: VALID
- **Revision**: 1
- **Owner**: asset-analyst
- **Task**: `wp-01-intake`（任务分支 `task/wp-01-intake`；父分支 `feat/v0.1.0`；基线提交 `ad9c8a1ec0175d60c251b5346072e3982ba1f1f6`；产出提交主题 `docs(intake): inventory project assets and constraints`）
- **Last Verified**: 2026-10-07
- **Method**: 仓库根目录只读实测（命令见第 1 节）
- **Scope**: `input/` 全量资产 + 仓库根、`artifacts/`、`state/` 现状只读扫描；未修改任何输入文件
- **Pinned Inputs（SHA-256 取自 `state/handoffs/wp-01-intake.json`，并于 2026-10-07 实测复核一致）**:

| 输入路径 | SHA-256 |
|---|---|
| `input/project/纸栈_PaperStack_项目计划书_V1.0.md` | `a6280863020cd0bd397cf0c1994ed8e466a79bf751eac2afc562d47966570893` |
| `input/requirements/01_纸栈_PaperStack_需求分析与规格说明书_V1.0.md` | `c991164ff36f1f0be69729f413e41c8236c0b933ede4f0af6adc495d6ff14249` |
| `input/design/02_纸栈_PaperStack_交互设计说明书_V1.0.md` | `786096e3f6ec9b826b9c7c793c5e6e07fb62e72a537e4782c2c9801fdeaa9a94` |
| `config/project.md` | `6dce9e3fc47f729f748fb5eb5df4eba1ddd60411243609a5f9eceda1ac8c0f3b` |
| `input/README.md` | `32e05536d49e84b4dfe2fa9fa6b7433b45cad20f6796d58bad95dce781c98f39` |
| `input/standards/README.md` | `154892936707070368ba9a9b701b1b8d16df787ef2e82d8cd6ae703888da02f3` |
| `state/handoffs/wp-00-start.request.md` | `ad861f2bf253dd5827a94c6ab8d30c6f69b6d1f7b8497d2d2a6b09b727cbce7d` |

- **Validation evidence**: 上述 7 项 pinned 输入 SHA-256 于 2026-10-07 实测复核全部一致；跨文档编号机器核验见第 4 节（30/30 一致）；环境观测命令实测输出见第 7 节。
- **Assumptions**: 见第 9 节（A1–A12）。
- **Coverage limits**: 三份 `.docx` 二进制伴生件未解析（原因见 2.1、假设 A1/A2）；仓库中不存在产品代码，无反向工程范围；所有发现日期均为 2026-10-07。

---

## 1. Intake 方法与覆盖（Method）

- **只读操作**：未安装任何软件，未修改 `input/`、`config/`、框架文件；仅产出本报告至 `artifacts/10-intake/`。
- **检查范围**：`input/` 全部 21 个文件与 13 个子目录；仓库根目录清单；`artifacts/`、`state/` 现状；`config/project.md`、`config/git-policy.json`、`config/git-policy.default.md`。
- **深度**：三份 Markdown 规范文档全文通读（581 + 764 + 672 = 2,017 行）；`.docx` 仅做 `file` 类型识别（二进制 OOXML 伴生件），未解包。
- **主要命令**（均于 2026-10-07 在仓库根目录执行）：
  - 资产枚举：`find input -type f | sort`、`find input -type l -ls`（无符号链接）、`wc -l/-c`、`file input/*/*.docx`、`sha256sum`（全部 pinned 输入 + 三个 `.docx`）
  - 编号核验：`grep -nE` 编号抽取、`python3` 比对脚本（R 节 ↔ SRS §8 表格 ↔ IXD 流程映射）
  - 环境观测：`cat /etc/os-release`、`uname -m`、`node --version`、`npm --version`、`corepack --version`、`command -v pnpm`、`rustc --version`、`cargo --version`、`pkg-config --modversion …`、`xdpyinfo -display :1`、`gnome-shell --version`、`command -v xwd ffmpeg convert magick scrot xdotool import`、`sudo -n true`、`git remote -v`、`git ls-files`、`git branch -a`
- **未覆盖**：`.docx` 内部文本未解析；无产品代码可检查；未做网络访问；性能与兼容性数字未经实测（文档自身声明为设计目标）。

---

## 2. 资产清单（Asset Inventory — `input/` 全量）

`input/` 实测共 **21 个文件、13 个子目录**；无符号链接。

### 2.1 文件清单

| 资产 ID | 路径 | 大小 / 行数 | 内容分类（按内容判定） | 解析 | 可用性说明 |
|---|---|---|---|---|---|
| A-01 | `input/project/纸栈_PaperStack_项目计划书_V1.0.md` | 37,760 B / 581 行 | 项目计划书 V1.0（产品定位、用户、运行环境、技术栈、依赖、v0.1.0 功能范围、路线图、依据 [S01]–[S21]） | 已全文解析 | 范围/环境/技术/版本权威来源；自身声明“本文中的版本范围、环境配置与性能数字为设计目标，不是已完成的功能或实测结果”（行 10） |
| A-02 | `input/requirements/01_纸栈_PaperStack_需求分析与规格说明书_V1.0.md` | 48,277 B / 764 行 | 需求分析与规格说明书 **PS-SRS-001**（R01–R30、NF01–NF12、AT01–AT30、IT01–IT08、F01–F07、数据默认值、依据 [B0][I0][S01]–[S06]） | 已全文解析 | 产品行为权威来源；状态“文档状态：供评审的第一版规格，尚未实现或验收”（行 12） |
| A-03 | `input/design/02_纸栈_PaperStack_交互设计说明书_V1.0.md` | 43,629 B / 672 行 | 交互设计说明书 **PS-IXD-001**（IX01–IX15 流程、UI00–UI08 区域、快捷键与焦点 §17、视觉与反馈令牌 §18、依据 [B0][R0][S04]–[S08]） | 已全文解析 | 交互/界面行为权威来源；状态“文档状态：供评审的第一版设计，尚未实现或验收”（行 12） |
| A-04 | `input/project/纸栈_PaperStack_项目计划书_V1.0.docx` | 63,947 B | 同题二进制伴生件（`file`: Microsoft Word 2007+ / OOXML） | **未解析**（见下方说明） | 假定与 A-01 同文；sha256 `1664ddb6deb19ea34049b55489c26643fa92bf2bd859623bf9da1a4e87a9bf5c` 已记录，供后续比对 |
| A-05 | `input/requirements/01_纸栈_PaperStack_需求分析与规格说明书_V1.0.docx` | 64,216 B | 同题二进制伴生件（同上） | **未解析** | 假定与 A-02 同文；sha256 `abbfd31bbc32c4e549badce997e5e78dc0581f68f015c081f7512062ce70f781` |
| A-06 | `input/design/02_纸栈_PaperStack_交互设计说明书_V1.0.docx` | 64,173 B | 同题二进制伴生件（同上） | **未解析** | 假定与 A-03 同文；sha256 `6d3c18ae1242d21f514b13d5ea5e9fd1d044cfee00c65e53d05c9fb71e92dcde` |
| A-07 | `input/README.md` | 3,392 B / 50 行 | 框架“项目资产池”使用说明（资产放置建议与内容识别原则） | 已解析 | 框架工具说明，**非产品需求材料** |
| A-08 | `input/standards/README.md` | 1,822 B / 33 行 | 框架标准目录说明（如何放置团队工程规范） | 已解析 | 目录内**无实际公司标准**（见第 3 节） |
| A-09 | `input/{api,architecture,competitors,data,design,existing,other,project,references,requirements,standards,tests,uml}/.gitkeep`（13 个） | 各 1 B（单个换行符 `0x0A`） | Git 目录占位文件 | 已识别（无需内容解析） | 占位用途；被 `.gitignore` 的 `**/.gitkeep` 排除 |

### 2.2 `.docx` 未解析的原因与假设

- **原因**：(1) 为同名二进制 OOXML 文件（`file` 仅识别为 “Microsoft Word 2007+”），非机器可读纯文本；(2) 同题 `.md` 已按内容完成分类，重复深检与目标相关性不成比例（摄入原则：检查深度与目标/风险成比例）；(3) 避免对同一内容产生两套分类记录。**未解析不代表排除**：三个 `.docx` 均作为原始资产登记并记录 sha256。
- **假设 A1**：三个 `.md` 版本是三份文档的**权威机器可读来源**，`.docx` 为同文伴生件。支持证据：SRS §10.1 [B0] 与 IXD §20.4 [B0] 引用的计划书 SHA-256 等于 A-01 实测值 `a6280863…0893`；`config/project.md` Configuration Notes 将 `*.md` 与 `*.docx` 同列为“原始资料”。
- **确认方法**（登记为假设 A2）：后续需要时用 `unzip -p <docx> word/document.xml`（或 pandoc 转换）与对应 `.md` 文本比对；或由项目所有者书面确认 `.md` 为权威版本。在确认前，`.docx` 不作为规范性引用来源。

### 2.3 目录状态

| 目录 | 状态 |
|---|---|
| `input/project/`、`input/requirements/`、`input/design/` | 各有 1 份规范文档（md + docx 伴生件） |
| `input/standards/` | 仅有框架 `README.md` + `.gitkeep`；**无公司/团队标准** |
| `input/api/`、`architecture/`、`competitors/`、`data/`、`existing/`、`other/`、`references/`、`tests/`、`uml/` | 空目录（仅 `.gitkeep` 占位） |

---

## 3. 来源权威分类（Source Authority）

| 来源 | 权威范围 | 依据 |
|---|---|---|
| A-01《项目计划书 V1.0》 | 产品范围、运行/开发环境、技术选型与依赖、版本路线（v0.1.0→v1.x）、许可与归属 | 被 A-02、A-03 引为 `[B0]`（SRS §10.1、IXD §20.4）；SRS §3.1“工程框架 \| Tauri 2…[B0 §3]”；SRS §3.4“[B0 §1.4]” |
| A-02《需求分析与规格说明书》PS-SRS-001 | 产品可观察行为与验收：R01–R30（§4，全部 v0.1.0 Must）、语义/数据规则（§5–§6）、NF01–NF12（§7）、AT01–AT30 与 IT01–IT08（§8）、F01–F07（§9） | SRS §1.1 文档关系表；§1.3“出现同一产品规则的冲突时，应统一两份文档后再作为验收依据，不由实现自行挑选较宽松条件。” |
| A-03《交互设计说明书》PS-IXD-001 | 入口、反馈、状态、焦点与退出：IX01–IX15、UI00–UI08（§2.1）、快捷键/焦点（§17）、设计令牌（§18） | IXD §1.2“需求书 [R0] 定义范围和验收；本书定义具体动作”；§14“共用 R01–R30、AT01–AT30 的产品编号” |
| `config/project.md` | 框架项目配置（权威）：Target Stage = release、Workflow = STRICT、Execution = GATED_AUTO、技术与约束登记表、Git 策略入口 | 文件本体“用户明确填写的值优先于 Framework 推断”；Configuration Notes §66–68 |
| `input/standards/` | **EMPTY**：无公司/团队标准、无公司 Git 规范 | `find input/standards -type f` 仅见 `README.md` 与 `.gitkeep`；`config/project.md` 行 67“未提供公司 Git 规范”；`config/git-policy.json` `"company_policy_path": null` → 默认规范 `config/git-policy.default.md`（sha256 `c3493586146862d14386fcf75b6212041d299bd9f968bc994edce18e2a122915`）生效 |
| `input/README.md`、`input/standards/README.md` | 框架使用说明，**非产品需求** | 内容为资产池引导与目录说明 |

说明：三份规范文档是**原始输入资产**，其内容为权威业务来源，但其自身声明“尚未实现或验收”（SRS 行 12、行 675“软件尚未实现，本次文档不提供产品测试通过结论。”；IXD 行 12）。它们不等同于框架级已验证工件；需求基线工件仍须建立（见第 8 节）。

---

## 4. 跨文档一致性检查（Consistency Check，2026-10-07）

### 4.1 编号系统存在性（全部实测存在且唯一）

| 编号系统 | 定义位置 | 数量 | 核验结果 |
|---|---|---|---|
| R01–R30 | SRS §4（4.1–4.10，逐节标注“v0.1.0 / Must”） | 30 | 唯一、连续，无缺号/重号 |
| NF01–NF12 | SRS §7 表格 | 12 | 唯一、连续 |
| AT01–AT30 | SRS 各 R 节“验收 ATxx”段 + §8.1/§8.3 追踪表 | 30 | 每节验收编号与 R 编号一一对应（30/30） |
| IT01–IT08 | SRS §8.5 | 8 | 唯一、连续 |
| F01–F07 | SRS §9.1 | 7 | 唯一、连续 |
| IX01–IX15 | IXD §4–§15（含合并小节 IX05／IX06、IX09／IX15、IX12／IX13） | 15 | §20.1 追踪表完整覆盖 15 条流程 |
| UI00–UI08 | IXD §2.1 | 9 | 唯一、连续；UI08 明确“v1.0才加入；首版不放占位入口” |
| 令牌 §18 | IXD §18.1–18.4（色彩、控件间距、动效、回归样例） | — | 存在且无编号冲突 |

### 4.2 交叉引用解析与机器核验

- **SRS §4 ↔ §8 映射**：脚本比对 30/30 个 R 节的“关联交互／区域”与 §8.1/§8.3 表格行内的 IX/UI 引用，**完全一致**。
- **IXD 流程 ↔ 需求**：IXD §4–§15 的“关联：R…/AT…”经人工核对可解析到 SRS 的 R01–R30、AT01–AT30；§20.1 的 15 行覆盖 IX01–IX15。
- **B0/I0/R0 双向解析**：SRS §10.1 `[I0]` →《交互设计说明书》PS-IXD-001；IXD §20.4 `[R0]` →《需求分析与规格说明书》PS-SRS-001；两处 `[B0]` 均指向《项目计划书 V1.0》，且 SHA-256 与 A-01 实测值一致。
- **越界检查**：全库未发现 `R31+`、`NF13+`、`AT31+`、`IT09+`、`F08+`、`IX16+`、`UI09+`、`S22+` 引用（精确边界 grep，2026-10-07）。
- **重复检查**：未发现重复的 R/AT 定义行或重复追踪表行。

### 4.3 观察点（不构成行为矛盾；需下游固化口径）

- **O1（IX01 标注粒度差异，低）**：IXD §4 行 118“关联：R01–R03、R30；AT01–AT03、AT30。”与 §20.1 行 619“| IX01 打开与输入 | R01、R03 | UI00、UI01、UI07 | 取消不改原状态；成功后才激活。 |”在汇总表省略了 R02/R30。属章节关联与汇总表的粒度差异，**未发现两者行为规则冲突**；登记为开放项（第 9 节 A6），供需求基线工件统一口径。
- **O2（IX07 标注粒度差异，低）**：IXD §9 行 273“关联：R12–R13、R24；AT12–AT13、AT24。”与 §20.1 行 625“| IX07 图片与图表 | R12–R13 | UI01、UI05 | 独立滚动、放大与键盘返回。 |”差异为 R24/AT24。IXD §20.2 行 637 已声明“R24为所有区域的键盘与焦点要求，不仅作用于某一条流程。”——汇总表省略可解释；同样登记为 A6。
- **O3（`[S0x]` 为文档局部命名空间）**：三份文档各自的 `[S0x]` 编号**内容不同**，不可跨文档合并引用。示例：`[S03]` 在计划书中为 Tauri Debian 分发资料，在 SRS 中为 KaTeX Security；`[S05]` 在计划书中为 Markdown/remark 规范，在 SRS 中为 WAI-ARIA APG，在 IXD 中为 APG 模态对话框；`[S06]` 在计划书中为 remark-math/KaTeX，在 SRS 中为 GPL-3.0-only，在 IXD 中为 APG 标签页。各自文档内引用均能解析，**无悬空引用**；下游引用时必须写明来源文档（如“SRS [S04]”）。
- **O4（合并小节与追踪表拆分）**：IXD 的合并小节 IX05／IX06、IX09／IX15、IX12／IX13 在 §20.1 中拆为独立行，引用集合按流程拆分后与各小节内容一致（如 §8“R04、R10–R11、R18”拆为 IX05→R04、R18 与 IX06→R10–R11）。

### 4.4 结论

在本次 Intake 范围内，**未发现行为级矛盾、重复定义或无法解析的交叉引用**；O1、O2 为汇总表与章节标注的粒度差异（低影响，登记为开放项），O3 为引用纪律要求，O4 已解释。

---

## 5. 复用评估（Reuse Assessment）

### 5.1 可原样复用（Reuse as-is）

- 三份 Markdown 规范文档（A-01/A-02/A-03）作为规范性权威输入；保持原始文件不改写（`input/` 只读保护）。
- `.docx` 伴生件在 A1 确认前仅作对照资产，不作引用来源。
- `config/project.md` 作为项目配置来源；`input/README.md`、`input/standards/README.md` 作为框架使用说明。
- 仓库基线证据：`artifacts/00-repository/repo-prep-01.md`（Repository Status Report，Producer: repository-manager，Status: VALID，含无远端/合并模式结论）。
- 框架流程资产（Skills、Rules、Agents、swe_guard）按框架规则复用，**不属于产品**。

### 5.2 必须全新建立（不可复用）

产品工程起点为“全新工程”（计划书行 10“产品代码、工程骨架与测试体系均需从零建设”；SRS 行 18“从全新工程建设，无可复用的产品代码、骨架或测试体系”）。对照 release 目标，以下均**不存在**，须建立：

- 框架级工件：需求基线工件、架构与合同（ADR/命令接口/数据模型）、UI 规格工件、模型（状态/流程）、交付计划与任务分解、追溯矩阵。
- 产品代码与工程骨架：`src/`、`src-tauri/`、`package.json`、`pnpm-lock.yaml`、`rust-toolchain.toml`、`Cargo.toml`/`Cargo.lock`、`tauri.conf.json`、Vite/TS 配置等（计划书 §3.4 明确为“需要新建的目标结构，不表示目录与实现已经存在”）。
- 测试体系：Vitest/Testing Library、cargo test、WebdriverIO + tauri-driver/WebKitWebDriver 配置与样例（`fixtures/`）。
- 打包与发布：.deb 构建、版本/图标/desktop 集成、发行元数据。
- 产品文档：根 `README.md`（构建/运行/测试与已知限制）、使用说明。
- 许可证与声明：根 `LICENSE`（GPL-3.0-only 未经改写全文）、`THIRD_PARTY_NOTICES.md`、包元数据（`name/version/author/license`）。
- 发布证据：真实运行截图、测试与验收结果、性能基准数据、对应源码入口。

### 5.3 框架工作流资产 = 工具，不是产品功能

`AGENTS.md`、`CLAUDE.md`、`START_PROJECT.md` 等根文档、`scripts/`、`.claude/`、`.opencode/`、`docs/`、`FRAMEWORK_ARCHITECTURE.md`、`design.md`、`config/git-policy.*`、`tests/test_swe_guard.py`、`tests/test_opencode_adapter.mjs` 均为**工程流程工具**，**不是纸栈产品特性，不属于交付产品**。依据：`state/handoffs/wp-00-start.request.md` 行 9“已有 workflow 不属于已完成的纸栈产品功能。”；`config/project.md` Configuration Notes。

版本控制事实（`git ls-files`，2026-10-07）：全仓库仅 2 个受控路径——`.gitignore` 与 `artifacts/00-repository/repo-prep-01.md`；`/input/`、`/state/`、`/artifacts/`、`/output/` 及框架文件均被 `.gitignore` 排除。`input/` 文档不在 Git 版本控制内，完整性仅由 handoff pin 的 SHA-256 保证，本地无远端备份（详见 A10/A12）。

---

## 6. 规范化项目约束登记表（Project Constraints Register）

| 编号 | 类别 | 约束（原文摘要，标识符保留原形） | 来源 |
|---|---|---|---|
| PC-01 | 必用技术 | Tauri 2、React、TypeScript、Rust、Vite、SQLite；文档处理使用 unified/remark/rehype，公式使用 KaTeX，图表与代码使用 Mermaid/Shiki；rusqlite（bundled）；包管理 pnpm + Cargo | `config/project.md` Technology/Constraints；计划书 §3.1–§3.2、§4.1–§4.3；SRS §3.1 |
| PC-02 | 禁用技术 | 首版不使用 Node.js sidecar、远程数据库或必需 Web 服务；不向文档内容开放任意文件写入、Shell、SQL 或脚本执行权限；不同时引入 markdown-it/react-markdown 另一条主解析路线；不同时加载 KaTeX 与 MathJax | `config/project.md` Forbidden；计划书 §4.1 行 239、§4.7 |
| PC-03 | 安全 | 原文件严格只读；文件及关联资源按授权范围读取，防止路径逃逸；远程图片默认不请求；隔离不可信文档内容，不执行文档脚本；默认无自动遥测和正文上传；诊断默认脱敏（不含正文/私人完整路径） | `config/project.md` Security；计划书 §5.4；SRS R04、R09、R25–R26、R28、NF01–NF03 |
| PC-04 | 性能（设计目标，待实测校准） | 100 KiB 冷启动首屏 P95 ≤ 2.5 秒；1 MiB 暖打开首屏 P95 ≤ 1 秒、全文可搜 ≤ 3 秒、首次查询结果 P95 ≤ 200 毫秒；空闲进程树 PSS ≤ 250 MiB、常规语料峰值 ≤ 500 MiB；交互反馈 ≤ 100 毫秒 | `config/project.md` Performance Requirements；计划书 §5.7；SRS §7 NF04–NF06 |
| PC-05 | 兼容性 | Ubuntu 24.04 LTS x86_64；GNOME Wayland 与 X11 **均需实际验收**；UTF-8 与 UTF-8 BOM；建议逻辑窗口 ≥1024×640；以适用 WCAG 2.2 AA 为可访问性目标（不声明已认证） | `config/project.md` Compatibility；计划书 §2.1、§5.6；SRS §3.1、R24、NF09–NF10；IXD §3.2–§3.3、§17.3 |
| PC-06 | i18n | 首版界面简体中文；界面文案/字符串独立保存，为后续英语界面留出空间；不得硬编码自然语言字符串（框架默认 i18n 规范：单代码库、独立语言包、键值查找） | 计划书 §2.1“界面语言 \| 首版简体中文；字符串独立保存，为后续英语界面留出空间”；`config/project.md`“界面文案独立保存”；框架 `docs/internationalization.md` |
| PC-07 | 许可与归属 | 项目归属与维护者 **Quirkybrain**；产品名称统一“纸栈 PaperStack”；原创代码 **GPL-3.0-only**（GPLv3，不默认追加“或任何后续版本”）；根 `LICENSE` 保存未改写 GPLv3 全文；建立 `THIRD_PARTY_NOTICES.md`；公开分发时提供匹配版本的对应源码入口 | 计划书 §1.4（[S21]）、§1.5；SRS §3.4、R30；`config/project.md` Other Constraints；`config/project.md` 行 68（旧 MIT 已移除，GPL 全文待加入） |
| PC-08 | 分发与离线 | 首发 .deb；已安装后本地阅读可离线，不依赖开发服务器或 TeX Live；语法资源/数学字体随应用分发，不临时访问 CDN；用户无需安装 Node.js、pnpm、Rust 等 | 计划书 §2.1、§4.5、§5.6；SRS R30、NF02；`config/project.md` |
| PC-09 | 版本范围 | 当前唯一必须完整实现的产品版本为 v0.1.0（Markdown 与数学公式阅读版）；编辑、账户、云同步、完整 PDF/LaTeX 编译不在 v0.1.0；后续能力不预置占位按钮 | 计划书 §5、§6；SRS §2.4、§9；`config/project.md` Other Constraints |
| PC-10 | 工程元数据 | `package.json`: `"name": "paperstack"`、`"version": "0.1.0"`、`"private": true`、`"author": "Quirkybrain"`、`"license": "GPL-3.0-only"`；`Cargo.toml` `[package]` 同步 `name = "paperstack"`、`version = "0.1.0"`、`authors = ["Quirkybrain"]`、`license = "GPL-3.0-only"` | 计划书 §1.5 |
| PC-11 | 版本锁定流程 | Node.js 24 LTS（固定具体补丁版本）；Tauri 2 系列；npm 依赖固定于 `pnpm-lock.yaml`，Rust 依赖固定于 `Cargo.lock`，工具链固定于 `rust-toolchain.toml`，pnpm 版本记录在 `package.json` `packageManager` 字段；具体版本在工程初始化时按兼容性验证结果锁定（当前为 `auto`） | 计划书 §4.7；`config/project.md` Technical Preferences/Configuration Notes |
| PC-12 | 数据与隐私 | 阅读记录/位置/缓存/授权/日志分目录管理，分分类清除；查询与选区仅内存；清除记录不得删除原文件；不保存全文快照；额外目录授权默认仅本次会话 | SRS §6、R06、R27；IXD §14；`config/project.md` Security |

注：本章为 Intake 阶段的来源登记（带出处），下游若需要统一执行的约束集，须由对应分析/架构责任生成并继续标注出处；本表不改变任何来源条款。

---

## 7. 环境观测（Environment Observation，2026-10-07，只读实测）

| 项目 | 实测值 | 证据 |
|---|---|---|
| 操作系统 | Ubuntu 24.04.4 LTS, x86_64 | `cat /etc/os-release`、`uname -m` |
| 桌面会话 | `XDG_SESSION_TYPE=x11`；`XDG_CURRENT_DESKTOP=ubuntu:GNOME`；GNOME Shell 46.0；**Wayland 会话未在本环境出现** | 环境变量、`gnome-shell --version` |
| X11 显示 | `DISPLAY=:1` 可用（X.Org 21.1.11，协议 11.0） | `xdpyinfo -display :1` |
| Node.js | v24.15.0 | `node --version` |
| npm | 11.12.1 | `npm --version` |
| pnpm | **未安装**（`command -v pnpm` 无结果）；Corepack 0.34.6 可用 | `command -v pnpm`、`corepack --version` |
| Rust / Cargo | rustc 1.96.0（ac68faa20 2026-05-25）；cargo 1.96.0（30a34c682 2026-05-25） | `rustc --version`、`cargo --version` |
| GTK3 | 3.24.41 | `pkg-config --modversion gtk+-3.0` |
| WebKitGTK 4.1 | 2.52.6（含 javascriptcoregtk-4.1 2.52.6；开发头文件 pkg-config 可用） | `pkg-config --modversion webkit2gtk-4.1` / `javascriptcoregtk-4.1` |
| libsoup-3.0 / librsvg / appindicator | 3.4.4 / 2.58.0 / 0.5.90 | `pkg-config --modversion` |
| OpenSSL | 3.0.13（dev pkg-config 可用） | `pkg-config --modversion openssl` |
| `libxdo` | **未找到**（`pkg-config libxdo` / `xdo` 均无；计划书 §4.5 开发清单含 `libxdo-dev`） | `pkg-config --modversion libxdo` |
| 截图工具 | `xwd`、`ffmpeg`、`xdpyinfo` 可用；无 ImageMagick（`convert`/`magick`/`import`）、无 `scrot`、无 `xdotool` | `command -v xwd ffmpeg convert magick scrot xdotool import` |
| sudo | 需要密码，非交互不可用（`sudo -n true` 退出码 1） | `sudo -n true` |
| Git 远端 | **无远端**（0 个） | `git remote -v` |
| 硬件 | 12 核 CPU；MemTotal ≈ 15.0 GiB（超过计划书 §2.1 的验证基线“4 核、8 GiB、SSD”，本机非指定基准机） | `nproc`、`/proc/meminfo` |

说明：以上为工作环境快照，不等同于目标用户运行环境或发布验收环境；性能/兼容性数字仍未实测（第 9 节 A8）。

---

## 8. 面向 release 目标的差距观察（Gap Observations — 仅事实）

以 `release` 为 Target Stage，对照计划书 §5.6 完成条件与 SRS §8.4 发布完成条件，当前**不存在**以下任何交付物/证据：

1. **需求基线工件（框架级）**：`artifacts/` 下仅有 `00-repository/repo-prep-01.md`，无 requirements 类工件。
2. **架构与合同**：无 ADR、无 Tauri 命令接口合同、无数据模型/存储设计（计划书 §3.3–§3.6 仅为方向）。
3. **UI 规格工件**：A-03 是输入文档，尚未转化为经过验证的框架工件；无设计令牌落到代码的证据。
4. **模型**：无状态机/流程/数据结构模型（`input/uml/` 为空）。
5. **交付计划**：无任务分解、里程碑、集成计划工件。
6. **产品代码与工程骨架**：无 `src/`、`src-tauri/`、`package.json`、`pnpm-lock.yaml`、`rust-toolchain.toml`、`Cargo.toml`、`tauri.conf.json` 等任何文件。
7. **测试体系与证据**：`tests/` 仅有框架自检（`test_swe_guard.py`、`test_opencode_adapter.mjs`）；无产品测试、无 `fixtures/`、无端到端（WebdriverIO/tauri-driver）配置。
8. **打包与发布**：无 .deb、无打包脚本、无发行元数据/desktop 文件/图标。
9. **产品文档**：无根 `README.md`、无使用说明、无已知限制清单。
10. **许可证与声明**：无 `LICENSE` 全文（旧 MIT 已移除）、无 `THIRD_PARTY_NOTICES.md`、无包元数据文件。
11. **发布证据**：无真实运行截图、无测试/验收报告、无性能实测数据（性能数字均为设计目标）。
12. **对应源码入口**：未配置（SRS R30 判定“未配置对应源码入口是发布阻塞项，不放伪地址。”）；无版本号、无发布元数据。
13. **状态恢复**：无 Checkpoint（`state/` 无 checkpoints）；无远端仓库（0 remote）→ 无异地备份。
14. **实现与验收状态**：三方文档一致声明尚未实现/验收（SRS 行 12、行 675；IXD 行 12；计划书行 10）。

---

## 9. 开放问题与假设（Open Items and Assumptions）

| ID | 类型 | 内容与证据 | 影响 | 确认方式 |
|---|---|---|---|---|
| A1 | 假设 | 三个 `.md` 为权威机器可读来源，`.docx` 为同文伴生件；证据：SRS §10.1/IXD §20.4 的 [B0] SHA-256 等于 A-01 实测值 | 若 `.docx` 存在差异（不同修订），引用可能失准 | 转换 `.docx` 与 `.md` 比对，或所有者书面确认（见 A2） |
| A2 | 覆盖限制 | `.docx` 未解析；无法证明其与 `.md` 内容一致 | 规范性引用仅以 `.md` 为准；`.docx` 保持待验证 | `unzip -p … word/document.xml` 或 pandoc 转换比对；sha256 已记录（2.1） |
| A3 | 待定 | 具体依赖版本尚未锁定：Language Version=`auto`；Node 补丁版本、Rust 工具链、pnpm 版本待初始化时按兼容性验证确定 | 构建可复现性；锁文件不存在 | 工程初始化时按计划书 §4.7 锁定并记录 |
| A4 | 环境限制 | 本环境仅观测到 X11（`DISPLAY=:1`），未见 Wayland 会话；而 NF10/R30/IT08 要求 GNOME Wayland 与 X11 **分别实际验收** | Wayland 侧兼容性验收证据缺失，无法支撑 release 声明 | 在 GNOME Wayland 会话执行干净安装与交互验收 |
| A5 | 环境缺口 | `libxdo-dev` 未安装（pkg-config 无 `libxdo`），且 `sudo` 非交互不可用；计划书 §4.5 开发清单包含该包 | 可能阻塞后续 Tauri 构建/WebDriver 测试环境准备 | 构建阶段确认依赖是否需要安装及获取授权 |
| A6 | 开放项（低） | 第 4.3 节 O1/O2：IXD §4 行 118、§9 行 273 的章节“关联”与 §20.1 汇总表存在 R/AT 标注粒度差异（IX01 缺 R02/R30；IX07 缺 R24，§20.2 已声明 R24 为跨流程要求） | 需求基线工件需要选定统一口径；不影响任何行为条款 | 建立需求基线/追溯工件时统一记录 |
| A7 | 引用纪律 | `[S0x]` 为各文档局部命名空间（第 4.3 节 O3）；同名不同义（[S03]/[S05]/[S06]） | 下游错误合并引用风险 | 引用时写明来源文档；下游工件禁用裸 `[S0x]` |
| A8 | 设计目标 | 性能、兼容、可达性数字均为设计目标：“上述性能数字与版本目标为计划值，产品尚未实现或验收”（`config/project.md` 行 65）；“不是已经测得的能力”（计划书 §5.7） | 不可对外宣称达标；release 需要实测证据 | 按 NF04–NF06/NF09 方法在基准机实测并保留失败结果 |
| A9 | 发布阻塞 | 对应源码入口未配置（R30 异常条款“未配置对应源码入口是发布阻塞项，不放伪地址。”） | Release Gate 阻塞项 | 所有者提供真实发布/源码入口，或 Gate 明确记录阻塞 |
| A10 | 仓库限制 | 无 Git 远端；`main_merge_mode = review_request_when_remote` 下，本地受守卫 merge 为当前唯一路径（`artifacts/00-repository/repo-prep-01.md` §4）；不得写成已获平台批准 | 托管 PR/CI/评审保护不可用 | 保持本地守卫合并证据记录；配置远端后自动切换托管路径 |
| A11 | 合规缺口 | 根 `LICENSE` 缺失（`config/project.md` 行 68：“框架模板的旧 MIT `LICENSE` 已移除；产品尚未添加许可证文件，后续须按项目计划加入 GPL-3.0-only 许可证全文。”） | 分发合规未满足；NF12/R30 验收未满足 | 加入未经改写的 GPLv3 全文并核对包元数据 |
| A12 | 完整性 | `input/`、`state/`、`artifacts/` 均被 `.gitignore` 排除；输入文档不在 Git 内（`git ls-files` 仅 2 条路径） | 恢复仅依赖本地文件系统与 handoff SHA-256 pin | 保持 pin 校验；不修改输入；注意无远端备份（A10） |

---

## 10. 结论与建议的最小后续分析

- Intake 范围内资产已全量枚举、按内容分类并登记来源权威（第 2–3 节）；规范化约束登记完成（第 6 节）；环境观测与 release 差距为事实清单（第 7–8 节）。
- 未发现行为级文档矛盾；两项低影响标注粒度差异与一项引用命名空间纪律登记为开放项（A6/A7），不构成 Intake 阻塞。
- 建议的最小后续分析（不在本任务执行）：对本报告进行 Artifact Validation；基于 SRS 建立需求基线工件并处理 A6/A7；对 A1/A2（`.docx` 权威性）与 A9（对应源码入口）按 Clarification Gate 或所有者确认处理。

---

*本报告全部发现日期为 2026-10-07；产出提交位于任务分支 `task/wp-01-intake`，主题 `docs(intake): inventory project assets and constraints`。*
