# 纸栈 PaperStack · wp-40 Integration Gate evidence（T-66：契约边界验证与跨边界集成）

- **Producer**: agent:integration-engineer
- **Artifact ID**: ART-70-VERIFY-INTEGRATION-WP40
- **Artifact Type**: Integration Verification Report（冻结命令样例 ↔ 前端服务层绑定、TS↔Rust 契约一致性、跨边界流程复跑与回归证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: integration-engineer
- **Task**: `wp-40-integrate`（任务分支 `task/wp-40-integrate`；父分支 `feat/v0.1.0`；基线提交 `f2f2a3d403bc7631871c7caf89dc070b4f643825`；快照 `refs/swe/snapshots/20261007T151635Z-wp-40-integrate-d7b551bc`；产出提交 `test(integration): validate contract boundaries and integration flows`）
- **Contract**: `paperstack-ipc-r1`（Rev 2；`artifacts/30-architecture/contracts.md` SHA-256 `f4b15984…fd644d`）
- **Last Verified**: 2026-10-07
- **Scope**: `tests/contracts/`、`artifacts/70-verification/`。未修改产品代码（`src/`、`src-tauri/`、`fixtures/`、`package.json`、锁文件、`vite.config.ts`、`vitest` 根配置、pinned 输入或框架文件）。桌面检查复用既有只读辅助（`tests/desktop/xdo-helper`、`screenshot.sh`），未修改 `tests/desktop/`。

> 判定纪律：每条 PASS 对应本轮实际执行或逐项标注的复用证据；未执行/不可执行的项在 §8 明确 UNVERIFIED。集成单元在本文通过后仍为 **UNVERIFIED**，直到 orchestrator 的 Integration Gate 作出决定（§7）。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 `state/handoffs/wp-40-integrate.json` 逐字一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/contracts.md` | `f4b15984927bc4d7ed4b0665b3e3234e0e5ef36e63d51dc9fe808fd80efd644d` | ✓ |
| `fixtures/contracts/commands.json` | `f0a28eeb7d06370169e93c563be6b4d1cf5de49eaf5d29e67ca4ea2cde53cad8` | ✓ |
| `artifacts/70-verification/unit-integration-report.md` | `a4c905298494002c9895980ec69bf303e4ec05da89bb9a4b3a0a87481157d261` | ✓ |
| `artifacts/70-verification/acceptance-at.md` | `e096dad444b657c987b8c8d3a2aa2376391f0106e4fc441f1d34cc09e0c9a1db` | ✓ |
| `artifacts/60-implementation/wp-35a-fix-rust.md` | `f54c156bc2b8af1492a5768fedab3f65f07eb4539bf94748b3eea18e5f75b5de` | ✓ |
| `artifacts/60-implementation/wp-36a-fix-frontend.md` | `89c769b59779e92f0da005c89518e73a3c4b76f52cf4f7e5aff581c5dbd3ed23` | ✓ |

`python3 scripts/swe_guard.py begin state/handoffs/wp-40-integrate.json`：任务已 ACTIVE，快照覆盖 `tests/contracts/` 与 `artifacts/70-verification/`；全部输入 SHA-256 校验通过。进入与提交前工作树仅在声明范围内有改动（§5.3）。

## 2. 构成修订与集成组成

| 构成件 | 修订/标识 | 本轮证据 |
|---|---|---|
| 产品修订（前端 + Rust + fixtures + tests） | `f2f2a3d403bc7631871c7caf89dc070b4f643825`（= handoff base commit） | 全部命令均在本修订上执行 |
| 前端套件（`src/**`） | 71 文件 / **547 passed** | §5.1（本修订复跑） |
| Rust 套件（`src-tauri/**`） | 21 targets / **274 passed / 0 failed** | §5.2（本修订复跑） |
| 契约/语义向量（`tests/contracts/**`） | 5 执行文件 / **85 passed** + 1 typecheck 视图（4 tests）→ 报告口径 **6 files / 89 tests** | §3.1、§3.2（本修订复跑） |
| 冻结命令样例 | `fixtures/contracts/commands.json`（38 命令，`paperstack-ipc-r1`） | §3.3（逐命令绑定） |
| 桌面二进制（验收 Rev 4 构建） | SHA-256 `054040bae1d6b041e184cf545a55e70ba150894cb1caeba4cfacbeef89ce1d9e`；32,318,216 B；mtime 2026-10-07 22:34:52 | §4.2；`git diff 5d977ea..f2f2a3d -- src src-tauri` = **0 行**（产品树与验收构建基线字节一致），故可复用该二进制证据 |
| 环境 | Node v24.15.0；pnpm 10.34.6；rustc/cargo 1.96.0；vitest 5.0.3；typescript 6.0.3；X11 `DISPLAY=:1` 2520×1680；12 核 / 15 GiB | 全部运行 |

## 3. 契约验证（TS ↔ Rust）

### 3.1 既有契约套件（本修订复跑）

| 命令 | 结果 | 退出码 |
|---|---|---|
| `pnpm vitest run --config tests/contracts/vitest.config.ts` | **6 files / 89 passed**（5 执行文件 / 85 tests：既有 44 + 新增 41；外加 `integration-boundary.test.ts` 的 typecheck 视图 4 tests）；`Type Errors no errors` | 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml --offline`（契约相关 target 汇总） | `contract_search_parity` **5/5**、`contract_shape` **3/3**、`commands_surface` **20/20**（38 命令面） | 0 |
| `node_modules/.bin/tsc --pretty false --noEmit -p tests/contracts/tsconfig.typecheck.json` | 0 诊断（类型级绑定显式复核） | 0 |
| `pnpm lint` / `pnpm typecheck` | 0 诊断 | 0 |

新增前的基线为本仓既有证据的 4 files / 44 tests（wp-36a §3），本轮未削弱任何断言，新增均在 `tests/contracts/` 内。

### 3.2 新增集成边界检查 `tests/contracts/integration-boundary.test.ts`（41 tests）

设计：把冻结的 `fixtures/contracts/commands.json` 与前端服务层（`src/services/**`）双向绑定，两层同时由套件命令执行：

1. **运行时（38 条逐命令回放 + 3 项结构/自检）**：以 mock 的 Tauri core 替换 IPC 传输，真实执行 `src/services/*` 包装器（含 `invokeCommand` 归一化路径）：
   - 请求样例按服务层模型形状校验（必填字段、字段类型、枚举、嵌套、无未知字段）；
   - 断言包装器恰好派发一次、命令名与参数信封逐字正确（`{req}` / `{docId}` / `{grantId}` / `{url}` / `{path}` / `{kind}` 包装 / 无参 `undefined`）；
   - 断言冻结响应原样穿透（`resolved ≡ fixture.response`）。
2. **类型级（Vitest `typecheck` + `tsconfig.typecheck.json`，checker `tsc`）**：`ResponseModels` 与真实服务函数返回类型逐命令 `Exactly` 相等；`SERVICE_FUNCTIONS` 键集合与 38 命令全等；请求/响应/参数信封表与 `src/services/types.ts` 的必填/可选键集合及类型精确绑定。任何服务类型漂移使冻结样例不再满足时，同一命令失败（已用临时反例验证检测有效，见下）。

结果：

| 检查 | 结果 |
|---|---|
| `pnpm vitest run --config tests/contracts/vitest.config.ts tests/contracts/integration-boundary.test.ts` | **2 files / 45 passed**（执行 41 + typecheck 视图 4）；`Type Errors no errors`；退出码 0 |
| 反例自检（不提交）：故意改坏 `ResponseModels` / 注入类型错误 | 套件按预期失败（`TypeCheckError`，退出码 1），证明类型级检查非空转；恢复后全绿 |
| 运行时形状校验器自检（缺必填、错类型、未知字段、坏枚举） | 4 类变异均被定位报错；合法样例零错误 |

新增文件（均在 `tests/contracts/`）：`integration-boundary.test.ts`、`tsconfig.typecheck.json`；`vitest.config.ts` 增加 `typecheck` 块（启用 + 指向上述 tsconfig + `include` 限定本文件）；`README.md` 同步现状（含修正已过时的“Final_Sigma 分歧”描述——该分歧已由 wp-32a 修复并在双方作为共享一致性用例断言）。

### 3.3 命令样例覆盖事实（38/38）

- 样例命令顺序与 contracts §2 索引顺序逐项一致（`COMMAND_ORDER` 断言）；38 条唯一。
- 每条样例的请求/响应均通过 §3.2 的形状校验；无未知字段、无缺失必填字段。
- 无参命令 10 条的请求为 `null`；单位响应命令 6 条为 `{}`（与 `src-tauri/tests/contract_shape.rs::expect_empty_response` 同口径）。
- 契约标识 = `paperstack-ipc-r1`（与 `AppInfo.ipcContract` 枚举一致）。

## 4. 跨边界集成运行

### 4.1 无头套件（本修订执行）

以下均包含在 §3.1/§5 的套件运行内，按流程归属列出：

| 流程 | 直接证据（命令） | 结果 |
|---|---|---|
| 打开 → 解析 → 渲染 | 契约套件中 `rendering-fixtures.test.ts` 用真实解析管线逐样例解析（9 个 rendering 样例 + 源映射 + 安全样例） | PASS |
| 监测 → 更新 → 锚点提交 | Rust `watch_registry` 20/20、`watch_runtime` 2/2、`files_read` 12/12、`storage_records`（锚点）21/21；前端 547 含 wp-28 更新/提交用例 | PASS |
| 搜索双范围（正文/源码） | 契约 `search-parity.test.ts`（前端 `findSourceHits`）+ Rust `contract_search_parity` 5/5（12 一致性用例 + 1 固定文件 + 1 个已接受的 İ 边界，≥20 查询） | PASS |
| 授权 → 资源 | Rust `security_paths_auth` 26/26、`tree_listing` 11/11、`remote_policy` 26/26、`storage_gating` 8/8；前端隐私/授权用例在 547 内 | PASS |
| 存储/会话往返 | Rust `storage_session` 6/6、`storage_records` 21/21、`storage_fixtures` 2/2；前端会话/设置用例在 547 内；§4.2 DB 证据 | PASS |
| 入口流（CLI/二实例/会话恢复） | Rust `app_open_requests` 7/7、`commands_surface` 20/20；§4.2 二实例证据 | PASS |

### 4.2 桌面冒烟（本修订，新证据；二进制 SHA `054040ba…`）

驱动复用 `tests/desktop/xdo-helper`、`screenshot.sh`（只读）；应用数据隔离于 `/tmp/opencode/wp40/desktop-data`，不改用户数据；X11 `:1`；未重新构建。证据：`artifacts/70-verification/evidence/wp-40/`（`runs.log` 含全部命令/退出码、`app.log`、`session-db-dump.txt`、4 张 PNG）。

| 步骤 | 观察 | 判定 |
|---|---|---|
| CLI 打开 `fixtures/rendering/mixed-cn-en.md` | 窗口 `0x5c00003` 1280×800 出现；截图非空（`wp40-01-render-top.png` 1280×800/87,660 B）；`app.log` **0 行** | PASS（窗口/渲染代理） |
| 滚轮下滚 8 格 | 该样例 617 B、首屏即完整（截图与首屏字节相同属预期，非失败）；无错误日志 | PASS（无滚动变化，如实记录） |
| 二实例移交 `fixtures/rendering/code.md` | 第二进程退出码 0；新增文档可见（`wp40-03` 与首屏截图 SHA 不同）；DB `recents` 出现 code.md 行、`documents` 出现第二行（`d-47bae29b61b13b38`，hash `a3bddb99…`） | PASS |
| `Ctrl+W` 关闭第二标签 | 截图 `wp40-04` 与首屏 SHA 相同（回到 mixed-cn-en 单标签） | PASS（代理） |
| WM_DELETE_WINDOW 干净退出 | 进程退出、`pgrep -x paperstack` 无残留；退出后 DB：`session_tabs` = 1（tab-1 mixed-cn-en）、`session_meta.active_tab_id` 一致、`recents` = 2 行、`documents` = 2 行、`positions` = 0（608 B 文档无滚动） | PASS |

> 说明：桌面冒烟是**代理级**证据（窗口/截图/DB），不替代 §4.3 中复用的逐项验收；两个滚动截图字节相同是因为所选用例短于视口，未被读作“滚动通过”。

### 4.3 复用的桌面验收证据（Rev 4，同一二进制与产品树）

`artifacts/70-verification/acceptance-at.md` Rev 4 在二进制 `054040ba…`（本工作树现存文件 SHA 一致）上复跑：AT02/06/09/12/14/15/16/25/27/30 + 全量套件 547；Rev 3 已覆盖 AT19/26/28；其余 20 项沿用 Rev 1–3。本轮**未重新执行**这些桌面交互（属 wp-38 证据范围），按“产品树 0 行差异 + 二进制哈希一致”复用：

| 流程 | 复用证据 | 判定 |
|---|---|---|
| 打开/编码/渲染/数学/图表 | Rev 4 AT01–AT05、08–13、30（含 B-01/B-02/B-04/B-10 修正复跑） | PASS（复用） |
| 更新/重定位/位置恢复 | Rev 4 AT07、AT19（wp-34c 修复复跑）；AT06 撤销链 | PASS（复用） |
| 搜索 UI（大小写、公式源、折叠块） | Rev 4 AT17 回归项 | PASS（复用） |
| 授权/目录/远程资源 | Rev 4 AT02、AT25、AT26（socket 级 0 请求 + 受控取图）、AT27 | PASS（复用） |
| 入口/单实例/会话 | Rev 4 AT01（多入口）、AT30；wp-30 入口报告 | PASS（复用） |

## 5. 回归结果（本修订，全部实际执行）

### 5.1 前端全量

`pnpm test -- --run` → **Test Files 71 passed (71)；Tests 547 passed (547)**；退出码 0（`/tmp/opencode/wp40/frontend-final.log`，本轮完整运行 19.5 s）。

### 5.2 Rust 全量

`cargo test --manifest-path src-tauri/Cargo.toml --offline` → 21 targets，**274 passed / 0 failed / 0 ignored**；退出码 0。逐 target：lib 61、main 0、app_open_requests 7、commands_surface 20、contract_search_parity 5、contract_shape 3、files_open 13、files_read 12、files_source 18、migration_faults 12、nf07_soak 1、remote_policy 26、security_paths_auth 26、storage_fixtures 2、storage_gating 8、storage_records 21、storage_session 6、tree_listing 11、watch_registry 20、watch_runtime 2（含两个 0-test harness 行）。

### 5.3 契约/集成与静态检查

§3.1 表格（89/89 + Type Errors 0 + lint/typecheck 0）。变更面核对：`git status` 显示改动仅在 `tests/contracts/`（4 个文件：新增 2、修改 2）与 gitignore 的 `artifacts/70-verification/`；无产品代码改动。

## 6. 失败与保留项（不掩盖）

- **本轮无 FAIL**：新增检查与全部套件 0 failed。
- 有意注入的临时反例（不提交）在 `integration-boundary.test.ts` 中按预期失败后被恢复，作为“检查非空转”的证据保留于本文 §3.2。
- 历史发现状态（不在本任务写范围，供 Gate 知悉）：
  - F-32-1（希腊 Final_Sigma 折叠分歧）已由 wp-32a 修复：向量 `greek-final-sigma-per-code-point` 现为双方一致性用例；`tests/contracts/README.md` 中过时的“分歧未决”描述已在本任务同步修正（仅文档）。
  - F-32-2/F-32-3（1MiB 解析与密集命中查询的性能校准）保持既有结论，属性能任务/基准机，不影响本契约与集成判定。
  - ADR-007 已接受的 İ 长度变化折叠边界仍由 `boundaryCases` 双侧固定（非缺陷）。

## 7. 集成判定

- 契约一致性：**PASS** —— TS 与 Rust 双侧执行同一冻结样例/向量；新增服务层边界检查 41 tests + 类型级绑定通过；无未解释的分歧。
- 跨边界流程（§4）：**PASS（含复用项的显式标注）** —— 无头流程 fresh 执行全绿；桌面流程在二进制与产品树完全一致的前提下复用 Rev 4 证据，并由本任务桌面冒烟补充首手证据。
- 回归：**PASS** —— 前端 547、Rust 274、契约 89、lint/typecheck 0。
- **集成单元状态**：本报告范围内通过全部检查，但按框架规则，组合结果仍为 **UNVERIFIED，直到 orchestrator 的 Integration Gate 作出决定**；本文不构成发布/晋升声明，不改变组件既有状态。

## 8. 明确 UNVERIFIED / 残余限制（不得读作通过）

| 项 | 原因 |
|---|---|
| Wayland 会话下的任一流程 | 本机仅 X11 `:1`；沿用 acceptance §6 |
| 抓包级“零网络请求”证据 | 无 sudo/tcpdump；AT26 以进程树 socket 观测替代 |
| NF04–NF06 / NF09 达标结论 | 仅本机校准（12 核/15 GiB，非基准机）；见 wp-32 §9 |
| 干净系统安装、WebDriver/tauri-driver、拖放、IME、200% 缩放、深色主题 | 沿用 acceptance §6；本轮未执行 |
| 桌面交互的**本轮重跑**（授权对话框、远程取图、更新横幅可视化、搜索 UI、替换保存） | 本轮未逐项重跑；以 Rev 4 同二进制证据复用（§4.3）。如 Gate 要求 freshest 证据，需另派桌面复跑任务 |
| >50MiB 源码窗口在真实文件上的 IPC 闭环；10MiB/52MiB 桌面全量 | 沿用 wp-32 §9 / acceptance §6 |
| Vitest typecheck 为实验特性 | 固定 `vitest 5.0.3`；如升级需复核 `typecheck` 行为 |

## 9. 复现

```sh
pnpm vitest run --config tests/contracts/vitest.config.ts        # 契约 + 集成边界（含 typecheck）
pnpm vitest run --config tests/contracts/vitest.config.ts tests/contracts/integration-boundary.test.ts
node_modules/.bin/tsc --pretty false --noEmit -p tests/contracts/tsconfig.typecheck.json
cargo test --manifest-path src-tauri/Cargo.toml --offline --test contract_search_parity --test contract_shape --test commands_surface
cargo test --manifest-path src-tauri/Cargo.toml --offline        # 274
pnpm test -- --run                                              # 547
pnpm lint && pnpm typecheck
# 桌面冒烟（本轮驱动未入库，使用既有只读辅助；证据见 evidence/wp-40/）
```

证据文件：`artifacts/70-verification/evidence/wp-40/`（`runs.log` 含全部命令/退出码、`app.log` 空、`session-db-dump.txt` 隔离 DB 只读转储、4 张 1280×800 PNG）。

## 10. 追溯

- **implementation-plan T-66（Integration Gate）/ §5.1–§5.5**；**contracts `paperstack-ipc-r1` §2/§3/§5/§8**；**ADR-007**；**NF11**。
- 构成证据：wp-32（unit-integration-report，含 F-32-1..4 与校准）、wp-32a（修复）、wp-34 验收 Rev 1–4（`acceptance-at.md`）、wp-35a（Rust 安全修正）、wp-36a（前端/管线修正）。
- 本轮新增：`tests/contracts/integration-boundary.test.ts`、`tests/contracts/tsconfig.typecheck.json`、`tests/contracts/vitest.config.ts`（typecheck 块）、`tests/contracts/README.md`（现状同步）、`artifacts/70-verification/evidence/wp-40/**`。
