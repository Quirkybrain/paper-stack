# 纸栈 PaperStack · wp-34a 验收缺陷修正实现报告（AT06/07/14/15/19/26/28/30）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP34A
- **Artifact Type**: Implementation Evidence Report（wp-34 桌面验收 8 项 FAIL 对应的 7 组缺陷修正；含 WIP 重启续作说明）
- **Status**: VALID
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Owner**: implementation-engineer
- **Task**: `wp-34a-fixes`（任务分支 `task/wp-34a-fixes`；父分支 `feat/v0.1.0`；基线提交 `0d111a76c7ccf553e3faa7d44bec2cc89ab45a1c`；产出提交主题 `fix(acceptance): resolve routed at defects`）
- **Components**: 阅读器协调层（`src/features/reader/use-reader.ts`、`ReaderScreen.tsx`）、存储/会话恢复接线（既有 `src/services/storage.ts` 生产调用点）、资源访问策略（`src-tauri/src/services/resources.rs`、`src-tauri/src/commands/auth.rs`）、文件服务已知源（`src-tauri/src/services/files.rs`）、诊断导出保护（`src-tauri/src/commands/diagnostics.rs`、`src-tauri/src/services/diagnostics.rs`）、关于页 i18n（`AboutSection.tsx`、`src/locales/zh-CN.json`）。
- **Scope**: `src/`、`src-tauri/src/`、`src-tauri/tests/`、`artifacts/60-implementation/`（本报告）。未修改 `artifacts/70-verification/`、`artifacts/40-ux/`、`artifacts/30-architecture/`、`tests/contracts/`（含 pinned 字符串目录）、`package.json`、锁文件或框架文件；无新增依赖。

## 1. 输入与基线核验（pinned inputs，2026-10-07）

SHA-256 与 handoff `state/handoffs/wp-34a-fixes.json` 逐字一致（只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/70-verification/acceptance-at.md` | `61a4dcae…6d9cc91` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817a…49052e28` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…6c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea…93f47f74` | ✓ |
| `config/git-policy.json` | `3b8ddffd…9241a014` | ✓ |

分支 `task/wp-34a-fixes`，基线 `0d111a7`；全部改动均在 handoff `writes` 范围内。任务为服务器中断后的续作：前一会话已写好 15 个文件的未提交工作，本会话复核、补齐两处半成品、执行全部 DoD 验证并提交（见 §5）。

## 2. 缺陷 → 修复 → 回归测试映射

来源：`artifacts/70-verification/acceptance-at.md` §5（D-34-1…D-34-7；AT06/07/14/15/19/26/28/30）。

| # | 缺陷（AT / ID） | 修复（文件：要点） | 回归测试（新增） |
|---|---|---|---|
| 1 | AT30 / D-34-1：关于页原样渲染 `about.sourceUnconfigured` | `AboutSection.tsx`：后端按约定返回 i18n **键**，UI 侧统一 `t(info.legal.sourceEntryNote ?? 'about.sourceUnconfigured')` 解析，原始键不再可能泄漏 | `AboutSection.test.tsx`：补真实后端载荷形状（`sourceEntryNote: 'about.sourceUnconfigured'`），断言渲染译文且**不含**原始键；mock 补齐此前缺失的字段 |
| 2 | AT06 / D-34-2：`loadSession` 无生产调用，重启不恢复 | `use-reader.ts`：新增 `restoreStartupSession`（启动队列排空后执行；仅 `restoreSession=true` 且未被写回抑制）；`load_session` → recents 投影取 canonicalPath → 逐标签串行 `open_documents(entry:"restore")` + `read_document(restore)`；显式启动文件优先（INV-SR-01）；单文件失败只标该标签不可用（INV-SR-02）；不恢复查询/选区/覆盖/临时授权（INV-SR-03/04）；`restore` 不解除写回抑制（INV-SR-05）；恢复后经 `startRead` 重挂 `watch_document`（INV-SR-08） | `ReaderScreen.test.tsx` ×4：恢复顺序与活动标签、偏好关闭时不读会话、显式启动文件不被夺焦、需重试的启动不可用源 |
| 3 | AT06 / D-34-3：`touchRecent` 无生产调用，recents 恒 0 行 | `use-reader.ts`：`recordRecent` 在批量打开的**已接受**项上调用 `touch_recent`；显式打开先 `resumeSuppressedWrites()` 再记录（被清除类别可重新开始记录，models §9.1）；`rememberRecords=false`/写入抑制/失败均静默（NF08） | `ReaderScreen.test.tsx` ×2：显式打开记录 recents（按请求顺序）、清除 recents 类别后的首个显式打开不丢记录；恢复会话不重复记录 |
| 4 | AT07：`sessionUnavailable` 无 UI 消费（无提示/重新定位/重试/关闭） | `use-reader.ts`：watch `removed` → `sessionUnavailable`（保留内容，INV-DS-06）；新增 `relinkTab`（picker → `relink_document` → 同字节恢复身份 / 异字节先说明再按新版本采用，未注册时转为同标签导航）；`retryTab` 重做：未注册文档重走打开校验，已有内容者走稳定复读；`ReaderScreen.tsx`：不可用横幅（找到原文件文案 + 重新定位/重试/关闭） | `ReaderScreen.test.tsx` ×4：内容保留 + 三动作、重新定位恢复身份、**重试成功**回到可读且正文不丢、**重试失败**保留正文与横幅 |
| 5 | AT14/15 / D-34-6：页内 fragment 不跳转、缺失 fragment 静默 return | `ReaderScreen.tsx`：`resolveFragment` 以与大纲同源的 `slugifyHeading` + 唯一锚点（重复标题后缀）解析作者 fragment，脚注保留 `ps-fn(ref)-*`；缺失时显示 `nav.fragment.notFound` 提示且不产生历史（INV-NH-02）；大纲点击经同一解析真实滚动并记录历史 | `ReaderScreen.test.tsx` ×4：大纲点击滚动 + 历史、页内 `#more-links` 跳转 + 恰好 1 条历史、重复标题解析到唯一 id、缺失 fragment 提示且位置不动/无历史 |
| 6 | AT19 / D-34-4：`loadPosition` 无生产调用，跨重启位置不恢复 | `use-reader.ts`：恢复标签在展示版本解析提交后 `load_position` → `restorePosition` §6.2 决策树 → 一次性队列；`ReaderScreen.tsx`：标签活动且 Ready 时消费，精确恢复 reveal+滚动、同版本静默、跨版本诚实标注精确/近似（§6.3），后台标签激活后才消费 | `ReaderScreen.test.tsx` ×3：同版本精确且静默、跨版本标注近似、后台标签激活后恢复且激活前不滚动/不标注 |
| 7 | AT26 / D-34-5：带路径远程图片 URL 被误判“不支持” | `resources.rs`：新增 `origin_for_remote_reference`（仅 https + 主机、拒绝凭据；路径/查询/fragment 不参与策略）；`commands/auth.rs`：`remote_decision` 对 Remote 引用按 origin 决策 → 默认 `remote-blocked`（可进确认流程）/已授权 `allowed`，非 https 与凭据仍 `unsupported` | `auth.rs` 单元测试 ×4（带路径分类、query/fragment 不影响 origin、端口精确匹配含默认端口归一、凭据/非 https 拒绝）；`remote_policy.rs` ×1（提取语义 + 允许匹配 + 拒绝清单） |
| 8 | AT28 / D-34-7：错误态（未注册）文档的源目录不受诊断导出保护 | `files.rs`：`FilesService.known_sources` 记录所有通过目标解析的 `.md/.markdown` 源（含随后解码/格式拒绝者；`open_document`/`relink_document` 两处登记）；`commands/diagnostics.rs`：受保护集合 = 已注册文档 ∪ 已知源；`diagnostics.rs`：`ProtectedSources` 入参去重 | `commands_surface.rs` ×1（已注册文档精确/同目录拒绝 + 错误态源目录拒绝 + 非源目标仍成功）；`files_open.rs` ×1（拒绝文档进入已知源集合） |

## 3. 修改文件清单

### 3.1 Rust（WIP，本会话复核后保留）

| 文件 | 变更 |
|---|---|
| `src-tauri/src/services/resources.rs`（交付物） | `origin_for_remote_reference`（远程引用 origin 提取） |
| `src-tauri/src/commands/auth.rs` | `remote_decision` 接入 `decide_access` Remote 分支；+4 单元测试 |
| `src-tauri/src/services/files.rs` | `known_sources` 集合 + `known_source_paths()`；打开/重定位登记 |
| `src-tauri/src/commands/diagnostics.rs` | `collect_protected_sources` 合并已注册文档与已知源 |
| `src-tauri/src/services/diagnostics.rs` | 受保护源入参去重 |
| `src-tauri/tests/commands_surface.rs`、`files_open.rs`、`remote_policy.rs` | 上述行为的集成回归测试 |

### 3.2 前端（WIP + 本会话补齐）

| 文件 | 变更 |
|---|---|
| `src/features/reader/use-reader.ts`（交付物） | 会话恢复/最近记录/不可用源重定位与重试/位置恢复一次性队列/`restore` 读取语义；**本会话补齐**：`retryTab` 有内容分支不再强制 `reading` 相位（原实现会把标签卡在无解析任务的 `parsing`，正文被加载占位替换——已用失败测试复现后修复） |
| `src/features/reader/ReaderScreen.tsx` | 不可用横幅、fragment 解析与缺失提示、位置恢复消费；**本会话补齐**：横幅文案改用参数化键（见 §4） |
| `src/features/settings/sections/AboutSection.tsx` | 解析后端返回的 i18n 键 |
| `src/locales/zh-CN.json` | +`nav.fragment.notFound`、+`document.unavailable.banner`（目录 delta，见 §4） |
| `src/features/reader/ReaderScreen.test.tsx` | +16 用例（WIP 14 + 本会话 2） |
| `src/features/settings/AboutSection.test.tsx`、`src/app/i18n.keys.test.ts` | 键泄漏断言 / 目录计数与 delta 记录 |

## 4. 字符串目录 delta（范围内可行做法，须交 wp-42 文档评审）

pinned 字符串目录 `artifacts/40-ux/strings-zh-CN.md`（Rev 1）在本任务写范围外，本任务新增 2 个运行期键，并在 `src/app/i18n.keys.test.ts` 注释中记录 delta（基准 378 → 运行期 380）：

1. `nav.fragment.notFound` = “未找到该标题。”——models §5.2 要求缺失 fragment“同页保持位置并说明”，目录无对应行；
2. `document.unavailable.banner` = “{title}。{message}”——目录仅有 `document.unavailable.title`/`message` 两段，UI 需要合成整句。前一版实现用模板字符串 `${t(title)}。${t(message)}` 硬编码 CJK 句号拼接，违反 `docs/internationalization.md`“参数插值而非字符串拼接/严禁硬编码用户可见文本”；改为参数化键后拼接发生在语言包内。

**建议（wp-42）**：把上述两键并入目录 Rev 2，或由目录所有者给出替代键后同步 `zh-CN.json` 与计数。

## 5. WIP 重启与补齐说明（如实）

前一实现会话在完成 15 个文件约 1200 行后遭遇服务器重启，未提交、未出报告；本会话从快照 `refs/swe/snapshots/20261007T111816Z-wp-34a-fixes-0c46e172` 对应的基线续作：

1. 逐文件复核 WIP 与 7 组缺陷/模型/契约/安全模型的对应关系，未发现未被覆盖的路由缺陷；
2. **复现并修复一处半成品缺陷**：不可用源“重试”（有已加载内容）原实现先置 `reading` 相位，`refresh` 读取成功后相位进入 `parsing` 而没有任何解析任务被派发，正文被加载占位替换（`<main/>` 空体）且永不恢复。已先用新测试复现（失败），再最小修复（有内容分支直接走稳定复读、不置 `reading`），并补“重试失败仍保留正文”用例；
3. **修复一处 i18n 违规**：不可用横幅原以硬编码“。”拼接两个译文；改为 `document.unavailable.banner` 参数化键（§4），测试同步；
4. 未改动 handoff（冻结）与任何 pinned 输入。

## 6. 验证命令与结果（工作目录 = 项目根；最终修订；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit` 无错误 | 0 |
| 2 | `pnpm lint` | `eslint .` 无告警/错误 | 0 |
| 3 | `pnpm test -- --run` | Test Files **69 passed (69)**；Tests **524 passed (524)**（基线 508；+16：AT06×5、AT07×4、AT14/15×4、AT19×3） | 0 |
| 4 | `pnpm build` | Vite 构建成功（仅有既存 chunk-size 提示，无错误） | 0 |
| 5 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 无格式差异 | 0 |
| 6 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 无告警 | 0 |
| 7 | `cargo test --manifest-path src-tauri/Cargo.toml` | 21 套件：**261 passed; 0 failed; 0 ignored**（基线 254；+7：auth 单元 ×4、remote_policy ×1、commands_surface ×1、files_open ×1） | 0 |
| 附 | `pnpm vitest run --config tests/contracts/vitest.config.ts` | Test Files **4 passed (4)**；Tests **44 passed (44)**（与 wp-34 基线一致，未回归） | 0 |

合计测试 **829**（前端 524 + 契约 44 + Rust 261）。无 `skip`/`only`/隔离用例；`git diff --check` 干净；无新增依赖、无未跟踪文件。

针对性复现记录：修复前新增的“重试不可用源并保留内容”用例失败（正文被清空、相位卡住）；修复后该文件 50/50 通过。

## 7. 假设与风险

- **假设**：`recents` 投影是契约内 docId→canonicalPath 的可用面（contracts §8 命令 13）；若 recents 被单独清除而会话未清除，恢复会跳过无路径的标签——与“被清除类别不重建”的隐私语义一致（INV-SR-05），不视为缺陷。
- **假设**：`read_document(purpose:"restore")` 与 `open_documents(entry:"restore")` 的 Rust 语义（不解除写回抑制、可命中校验快照缓存）为既有契约行为，本任务未改 Rust 命令面。
- **风险（低）**：`known_sources` 在整个应用会话内保留曾打开文档的源目录保护（即使文档后来被关闭）；比原“仅当前注册文档”更严格，方向符合 R04“不写源目录”，但属行为面扩大，已由 AT28 集成用例覆盖。
- **风险（低）**：远程引用 origin 提取对含 userinfo 的 URL 返回 `unsupported`（与 security-model §4 的 origin 语义一致，地址层还会再做解析与私网拒绝）。
- **风险（中，待桌面复验）**：fragment 跳转、位置恢复、会话恢复、不可用横幅均为真实 WebKitGTK/X11 行为敏感路径，组件层通过不替代桌面证据。

## 8. 剩余 UNVERIFIED（不得读作通过）

| 项 | 状态 |
|---|---|
| AT06/07/14/15/19/26/28/30 的桌面复跑 | **UNVERIFIED**——需 `wp-34b-atrerun`（test-engineer）在 release 二进制上复跑并刷新 `artifacts/70-verification/acceptance-at.md` 证据 |
| AT28“已注册文档下导出拒绝”的桌面证据 | UNVERIFIED——集成用例已覆盖两种保护路径，桌面面板双错误场景仍待 wp-34b |
| 字符串目录 delta 并入 | UNVERIFIED——需 wp-42 文档评审/目录所有者确认（§4） |
| Wayland、抓包级零请求、干净系统安装等既有边界 | 沿用 acceptance-at §6，未变化 |
| 独立质量审查与集成 | 未进行——本报告仅供 `quality-reviewer` 与 Gate 裁决 |

## 9. 追溯

- **T-63 / wp-34 Gate**（`artifacts/00-repository/gates/wp-34-gate.md`：缺陷 1–7，ACCEPT EVIDENCE + 派发 wp-34a/wp-34b）；**acceptance-at.md §5 D-34-1…D-34-7**。
- **R06/R07/R14/R15/R19/R26/R28/R30**（requirements-baseline）；**models §1.2 T2/T3/T7/T8、§5.2、§6.2/§6.3、§9、§10.2/§10.3（INV-SR-01…08、INV-DS-06、INV-NH-02、INV-AR-08）**；**contracts §2.1/§3.1/§3.4/§8**；**security-model §4/§5.2/§7**；**ui-spec §3.3/§3.8**；**ADR-009（i18n）**、`docs/internationalization.md`。
- **wp-30/wp-32/wp-32a**：入口管线、版本/代次提交、位置模型既有语义复用，未新增语义。

## 10. 结论

7 组路由缺陷均在范围内完成修正并有针对性回归（前端 +16、Rust +7）；全部 DoD 命令通过（§6）；WIP 重启的两处半成品已补齐并记录（§5）。产品行为变化属缺陷修复性质，不改变 Requirements/架构/契约语义。本报告与提交交 `quality-reviewer` 独立审查；桌面复验由 `wp-34b-atrerun` 执行后再进入集成/Stage Gate。
