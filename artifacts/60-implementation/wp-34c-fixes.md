# 纸栈 PaperStack · wp-34c 残留缺陷修正实现报告（AT19/26/28：D-34b-1…3）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP34C
- **Artifact Type**: Implementation Evidence Report（wp-34b 复跑残留的 3 项缺陷修正：位置近似恢复消费、远程图片受控取图、诊断导出拒绝分类；含逐项回归测试与全量验证计数）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-34c-fixes`（任务分支 `task/wp-34c-fixes`；父分支 `feat/v0.1.0`；基线提交 `a338980695442ea323af421d7aa4e5984705ee67`；产出提交主题 `fix(reader): resolve residual at19/26/28 defects`）
- **Components**: 阅读器协调层（`ReaderScreen.tsx` 位置恢复消费）、远程资源组件（`ImageBlock.tsx`）、诊断导出（`ExportPreviewDialog.tsx`、`src-tauri/src/services/diagnostics.rs`）。
- **Scope**: `src/`、`src-tauri/src/`、`src-tauri/tests/`、`artifacts/60-implementation/`（本报告）。未修改 pinned 输入（acceptance-at Rev 2、contracts、security-model、models）、`artifacts/70-verification/`、`tests/contracts/`、`fixtures/`、锁文件或框架文件；无新增依赖、无新 i18n 键。
- **Depends On**: `artifacts/70-verification/acceptance-at.md` §R2.4（Rev 2）；`artifacts/30-architecture/contracts.md` §2 行 24/29/30/36/37、§2.1、§3.6、§3.7、§5、§8；`artifacts/30-architecture/security-model.md` §4/§7；`artifacts/35-models/session-and-version-models.md` §2/§6。

## 1. 输入与基线核验（pinned inputs，2026-10-07）

SHA-256 与 handoff `state/handoffs/wp-34c-fixes.json` 逐字一致（只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/70-verification/acceptance-at.md`（Rev 2） | `b0153b77…4a228d` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…3f47f74` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `config/git-policy.json` | `3b8ddffd…941a014` | ✓ |

分支 `task/wp-34c-fixes`，基线 `a338980`；任务快照 `refs/swe/snapshots/20261007T123646Z-wp-34c-fixes-e80808f7`；全部改动均在 handoff `writes` 范围内。

## 2. 缺陷 → 根因 → 修复 → 回归测试

来源：`acceptance-at.md` §R2.4（Rev 2）的 3 条残留（D-34b-1…3）。

| # | 缺陷（AT / ID） | 根因 | 修复（文件：要点） | 回归测试（新增/加严） |
|---|---|---|---|---|
| 1 | **AT19 / D-34b-1**（中高）：近似恢复且 `blockId≠null`（标题/祖先回退）时消费 guard 永不满足——不滚动、无 `nav.return.approx`，静默停在文首 | `ReaderScreen.tsx:515` 仅在 `kind==='exact'` 时 `setRevealBlockId`；`:521-526` 消费 effect 要求 `revealBlockId===restore.blockId`，近似路径 `revealBlockId` 恒为 `null` → dead-wait | `ReaderScreen.tsx`：恢复队列落地时**对任何非空 `blockId`（精确与近似一视同仁）**执行 `setRevealBlockId`，使渐进挂载先包含目标块，消费 effect 再滚动并按 §6.3 标注（近似 → `nav.return.approx`；`blockId=null` 的 top 回退维持原滚动+标注行为） | `ReaderScreen.test.tsx` ×2：跨版本**仅标题路径**回退（指纹已变）滚动到可信标题块 `b1` 并显示 `nav.return.approx`；**祖先回退**（子标题消失）滚动到最近可信祖先标题并显示近似标签。两项在修复前复现失败（超时：无标签、无滚动） |
| 2 | **AT26 / D-34b-2**（高）：用户“本次文档允许加载”后 `check_resource_access` 返回 `allowed` 且 `assetUrl=None`，组件落入 `load-failed`，受控取图 `fetch_remote_image` 从不发起（真实应用 0 网络请求） | `ImageBlock.tsx:105-132`：`allowed` 只在**带 assetUrl** 时渲染；`fetchRemote` 仅存在于 `remote-blocked + hasRemoteGrant` 分支；授权后后端状态变化（`remote-blocked`→`allowed`）未被覆盖 | `ImageBlock.tsx`：`allowed && kind==='remote'` 且无 assetUrl 时调用 `fetchRemote`（`fetch_remote_image` 校验会话授权、写缓存并返回 Rust 生成的 asset URL，contracts §2.1）；失败保持 `load-failed` + 契约 `messageKey`，重试仅随显式点击（`retryNonce`），无自动循环；默认阻止路径与拒绝/撤销路径不变 | `resource-flow.test.tsx` ×2：授权后 decision 变为 `allowed`（无 assetUrl）→ 断言恰好 1 次 `fetch_remote_image` 且渲染返回的 asset URL（修复前以「图片加载失败」结束、fetch 0 次）；授权后取图失败（`PS_REMOTE_FAILED`）→ 局部失败态 + 显式重试才发起第 2 次调用并成功渲染。既有“默认零请求、拒绝保持阻止、撤销卸载”用例不加宽（原 `remote-blocked` mock 路径保留） |
| 3 | **AT28 / D-34b-3**（中）：受保护源目标拒绝被误读为覆盖确认，确认后通用「保存失败」；错误态文档无 tab，前端 `protectedPaths` 为空，无法本地判定 | 前端把所有 `PS_IO_EXPORT_BLOCKED`（`overwrite=false`）一律当作“已存在→覆盖确认”（`ExportPreviewDialog.tsx:100-109`）；Rust 对“受保护源”与“已存在”返回**同一稳定码且无区分信息**（contracts §5 该码本就覆盖两种含义） | Rust（`services/diagnostics.rs`）：`export_blocked(message, reason)` 在错误 `details` 中携带机器可读枚举 `reason`：`protected-source`（安全模型 §7 第 2/3 步）/`target-exists`（第 4 步）/`invalid-target`（绝对路径校验）；`reason` 为固定枚举字符串（无路径/用户文本），并加入 `DETAIL_KEY_ALLOWLIST`（6→7）供诊断折叠展示。前端：仅 `details.reason==='target-exists'` 进覆盖确认；其余（含未知）显示 `diagnostics.export.blocked` 专用说明并保留预览、可重选目标；成功/其余失败按原样诚实报告。稳定错误码表（32 条）不变，无契约语义变更 | `ExportPreviewDialog.test.tsx`：新增受保护源用例（前端 protectedPaths 为空、IPC 返回 `protected-source`）→ 断言显示 `diagnostics.export.blocked`、**不出现**覆盖对话框、无 `alertdialog`、预览保留，重选非源目标后成功导出且恰 2 次调用（修复前误示覆盖确认，测试失败）；既有覆盖用例更新为真实载荷形状（`details.reason='target-exists'`）并保持全部断言，确认后成功；既有 `PS_IO_WRITE_FAILED` 用例保持通用失败文案。Rust `commands_surface.rs`：3 个既有导出门禁测试加严断言 `reason`（`protected-source`×3 处、`target-exists`、`invalid-target`；修复前 `details=None`，3 测试失败复现） |

## 3. 修改文件清单

| 文件 | 变更 |
|---|---|
| `src/features/reader/ReaderScreen.tsx` | 位置恢复：非空 `blockId` 一律 reveal（精确 + 近似），消费 effect 不再 dead-wait |
| `src/features/reader/ReaderScreen.test.tsx` | +2 用例（标题回退、祖先回退：滚动 + 近似标签） |
| `src/features/reader/body/ImageBlock.tsx` | `allowed`+remote+无 assetUrl → `fetchRemote`；注释更新 |
| `src/features/reader/resources/resource-flow.test.tsx` | +2 用例（授权后 allowed 取图成功、取图失败显式重试） |
| `src/features/settings/diagnostics/ExportPreviewDialog.tsx` | 按 `details.reason` 区分覆盖确认 vs 受保护说明 |
| `src/features/settings/diagnostics/ExportPreviewDialog.test.tsx` | 覆盖用例改真实载荷；+1 受保护源用例（含重选目标成功） |
| `src-tauri/src/services/diagnostics.rs` | `export_blocked` 携带 `reason` details；`DETAIL_KEY_ALLOWLIST` +`reason`；净化器测试加严 |
| `src-tauri/tests/commands_surface.rs` | 导出门禁测试加严 `reason` 断言（helper `export_blocked_reason`） |

## 4. 修复前复现记录（回归测试有效性，2026-10-07）

逐项临时还原修复前逻辑后运行新增断言，确认失败，再恢复修复并全量复跑：

| 项 | 复现结果 |
|---|---|
| D-34b-1 | `-t "D-34b-1"` → **2 failed**（`nav.return.approx` 永不出现、`scrollCalls` 无目标块），修复后 2/2 通过 |
| D-34b-2 | `-t "D-34b-2"` → **2 failed**（授权后显示加载失败、`fetch_remote_image` 0 次；失败路径无 `error.resource.remoteFailed`），修复后 2/2 通过 |
| D-34b-3（前端） | `-t "protected-source"` → **1 failed**（受保护拒绝误触发覆盖确认，看不到 `diagnostics.export.blocked`），修复后 1/1 通过 |
| D-34b-3（Rust 细节） | 临时去掉 `with_details` → `commands_surface` 3 个导出门禁测试 **FAILED**（details 缺失），恢复后 20/20 通过 |

## 5. 验证命令与结果（工作目录 = 项目根；最终修订；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit` 无错误 | 0 |
| 2 | `pnpm lint` | `eslint .` 无告警/错误 | 0 |
| 3 | `pnpm test -- --run` | Test Files **69 passed (69)**；Tests **529 passed (529)**（基线 524；+5：ReaderScreen ×2、resource-flow ×2、ExportPreviewDialog ×1） | 0 |
| 4 | `pnpm build` | Vite 构建成功（仅既存 chunk-size 提示，无错误） | 0 |
| 5 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 无格式差异 | 0 |
| 6 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 0 告警 | 0 |
| 7 | `cargo test --manifest-path src-tauri/Cargo.toml` | 21 套件（含 Doc-tests）：**261 passed; 0 failed; 0 ignored**（基线 261；无新增测试函数，3 个既有导出门禁测试加严断言） | 0 |
| 附 | `pnpm vitest run --config tests/contracts/vitest.config.ts` | Test Files **4 passed (4)**；Tests **44 passed (44)**（与 wp-34b 基线一致，未回归） | 0 |
| 附 | 新增 3 文件聚焦复跑 | `pnpm vitest run` 三文件 **68 passed** | 0 |

合计测试 **834**（前端 529 + 契约 44 + Rust 261）。无 `skip`/`only`；`git diff --check` 干净；无新增依赖、无未跟踪文件。

## 6. 假设与风险

- **假设（D-34b-2）**：Rust 对远程引用仅在 `(docId, origin)` 已有会话授权时返回 `allowed`（contracts §2 行 24；`active_origins`），故 `allowed+remote` 即可安全调用 `fetch_remote_image`（后者在 Rust 侧再次校验授权）。前端本地授权标记不再作为取图前置条件，避免“Rust 已授权、前端 store 失联”时出现第二个 dead-end；取图失败/授权失效会诚实地落到失败态或阻止态。
- **假设（D-34b-3）**：`ErrorPayload.details` 是契约内字段（§3.7），承载固定枚举 `reason` 不改变错误码表与 §5 语义；`DETAIL_KEY_ALLOWLIST` 仅影响诊断/日志折叠展示（security-model §7“details 只允许白名单键”），新增键值不含路径/正文。
- **风险（低）**：`reason` 键名与既有 6 键同层，若未来其他命令复用同名键需保持值域约定；当前仅 `export_diagnostics` 写入。
- **风险（低）**：未知/缺失 `reason` 的 `PS_IO_EXPORT_BLOCKED` 现在按“受保护/需重选目标”说明处理（不再误问覆盖）；与 Rust 同版发布，旧载荷仅可能来自测试桩，方向为安全侧。
- **风险（中，待桌面复验）**：AT19 滚动/标签、AT26 真实网络取图、AT28 WebKitGTK 文件选择器与错误态面板均属真实桌面行为敏感路径，组件/集成层证据不替代 release 二进制的桌面复验。

## 7. 剩余 UNVERIFIED（不得读作通过）

| 项 | 状态 |
|---|---|
| AT19/26/28 的 release 桌面复跑（含 D-34b-1 近似滚动、D-34b-2 真实受控取图与 0→? 请求对照、D-34b-3 错误态受保护拒绝 UI 文案） | **UNVERIFIED**——由 `wp-34d`（test-engineer）在 X11 release 二进制上执行并刷新 `acceptance-at.md` 证据；此前三项判定不得读作 PASS |
| AT26 抓包级证据 | UNVERIFIED（沿用 acceptance-at §6：无 tcpdump 权限，以进程树 `ss` 观测替代） |
| AT28“已注册文档下导出保护拒绝”的桌面证据与 case A 服务器日志对照 | UNVERIFIED——wp-34d 复跑 |
| Wayland、干净系统安装、拖放等既有边界 | 沿用 acceptance-at §6，未变化 |
| 独立质量审查与集成/Stage Gate | 未进行——本报告与提交交 `quality-reviewer` 独立审查 |

## 8. 追溯

- **acceptance-at.md Rev 2 §R2.4 D-34b-1/2/3**、§R2.5（判别性对照与证据卫生）；AT19/AT26/AT28；R19/R26/R28/R04。
- **models §6.2/§6.3/§6.4（INV-AR-03/04）**：近似恢复必须落在最近可信标题并显示对应文案，绝不 silent/任选；
- **contracts §2 行 24/29/30（remote 会话授权→受控获取→缓存→asset URL）、§2.1（`fetch_remote_image` 仅授权后、不自动重试；`check_resource_access` 永不 reject）、§3.6（`AccessDecision/RemoteImageResult`）、§3.7（`ErrorPayload.details`）、§5（`PS_IO_EXPORT_BLOCKED` 同码两义）、§8**；
- **security-model §4（远程策略：默认零请求、允许→受控获取→缓存、撤销删缓存）、§7 第 2–5 步（导出校验顺序与区分）**；
- **wp-34a**：D-34-5（带路径 origin 分类）、D-34-7（错误态源目录保护）为本次两项残留的上游修复，复用未改。

## 9. 结论

3 项残留（D-34b-1/2/3）均在声明范围内完成最小修复并有针对性回归（前端 +5 用例、Rust 3 项门禁加严断言），且逐项以“修复前失败 → 修复后通过”的复现记录证明测试有效；全部 DoD 命令（typecheck/lint/test/build、cargo fmt/clippy/test）与契约套件通过（§5）。修复为缺陷性质，不改变 Requirements/架构/契约语义（错误码 32 条不变，无新 i18n 键）。本报告与提交交 `quality-reviewer` 独立审查；AT19/26/28 桌面复验由 `wp-34d` 执行后再进入集成/Stage Gate。
