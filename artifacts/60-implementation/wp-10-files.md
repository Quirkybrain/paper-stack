# 纸栈 PaperStack · wp-10 文档与目录读取服务实现报告（T-08 – T-11）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP10
- **Artifact Type**: Implementation Evidence Report（`services/files.rs`、`services/tree.rs` 的构建、测试与验证证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-10-files`（任务分支 `task/wp-10-files`；父分支 `feat/v0.1.0`；基线提交 `1c14c6f8e4cfe0211f3cac158559519be9349f83`）
- **Component**: C-04（Rust 文件与目录服务）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 T-08..T-11：打开校验/解码、`read_document`（initial/restore/refresh/relink）＋校验快照缓存＋§7.4 稳定读取、`get_source_info`/`read_source_window`/`search_source`、`open_directory`/`read_directory`。**不新增 Tauri 命令表面**（wp-15）、不含 SQLite/监测/远程/诊断服务。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核（`swe_guard.py begin` 冻结，本任务只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/30-architecture/security-model.md` | `a0e892ea53bc9ed1706f327e2dfc7e47a5f7fd9393634cd288a7dd9693f47f74` | ✓ |
| `artifacts/30-architecture/data-model.md` | `0e263230d6212cfe0d2092572f8c0e96f1b8cb33a2563f6eb526e3ba7b8369d1` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |

基线提交 `1c14c6f` 与 handoff 一致；进入时工作树干净；`SWE snapshot` ref `refs/swe/snapshots/20261006T211232Z-wp-10-files-3b970c59`（commit `d4b4bd0`）覆盖 `src-tauri/src/` 修改前字节。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `src-tauri/src/services/files.rs` | 打开校验（扩展名忽略大小写→存在/可读/普通文件→编码探测）、BOM 剥离、二进制/非 UTF-8 拒绝、空文件成功；`docId` 与 `VersionInfo`（sha256/size/mtime）；≤2 校验快照缓存；§7.4 稳定读取（S1=150ms、N=5，可注入 `StabilityTimer`）；relink 两分支；`get_source_info`/`read_source_window`/`search_source`（懒行索引、流式字面搜索、大小写折叠、`complete=false` 预算语义、扫描前后版本校验）；只读 API |
| `src-tauri/src/services/tree.rs` | `open_directory`（幂等 rootId、scope 升级、可读性探测）、`read_directory`（单层懒展开、名称排序、2000 截断、symlink kind/state、越界/无权限/缺失状态）、非递归 |
| `src-tauri/src/services/mod.rs` | 声明 `pub mod files;`、`pub mod tree;`（未改 Tauri 命令表面） |
| `src-tauri/tests/files_open.rs` | 编码/拒绝矩阵（12 测试） |
| `src-tauri/tests/files_read.rs` | 读取语义、稳定读取（含写者线程）、relink、快照缓存（12 测试） |
| `src-tauri/tests/files_source.rs` | 行边界/窗口/流式搜索/版本校验（18 测试） |
| `src-tauri/tests/tree_listing.rs` | 目录状态矩阵（9 测试） |
| `fixtures/encoding/{utf8-cn-emoji,crlf,bom,empty,binary,latin1}.md` + README | 字节精确编码样例（binary/latin1 为故意非法测试数据） |
| `fixtures/tree/**` + README | root/sub/deep、empty/.gitkeep、link-inside、link-inside-file.md、link-outside、link-broken、outside/secret.md |
| `artifacts/60-implementation/wp-10-files.md` | 本报告 |

依赖未变：仅使用既有 `std`、`sha2`、serde 模型与 `hex`（既有直接依赖）；未新增 crate，未使用 tokio（服务为同步阻塞核心，wp-15 负责 `spawn_blocking`）。

## 3. 任务→测试映射（T-08..T-11）

| T | 测试（文件::测试名） |
|---|---|
| T-08 打开校验/解码 | `files_open`：utf8-CJK/emoji、扩展名大小写、不存在、目录误当文件、binary/Latin-1、BOM 剥离（原文不改）、空文件、CRLF 保留、路径大小写、无权限、去重、无写入 |
| T-09 read_document/稳定/relink | `files_read`：initial 命中缓存、refresh 新版本、missing→`PS_IO_NOT_FOUND`、一次性写者重试稳定、持续改写→`PS_IO_CHANGED`、`PS_LIMIT_SIZE`（source-only）、缓存逐出重载、relink 同字节/异字节/校验错误/跨文档冲突、未知 docId；`files::tests` 的 `stable_reading` 确定性协议测试 |
| T-10 源码访问/搜索 | `files_source`：行边界（LF/CRLF/中文/emoji）、越界钳制、非法请求、同版本不读新盘、>50MiB 流式窗口、逐出后内容变化→`PS_IO_CHANGED`、字面/大小写/İ 折叠映射、maxResults/字节预算→`complete=false`、空查询、跨块命中、扫描前后版本校验、source-only 版本刷新、无写入 |
| T-11 目录 | `tree_listing`：root 幂等/scope、单层节点状态全枚举、symlink-inside 展开/symlink-outside 拒绝/根外目录拒绝、missing/非目录、空目录、2000 截断（2005 项）、无权限（chmod，root 环境跳过）、socket→`other` kind |

## 4. DoD 执行证据（全部在本修订上复跑；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS（`fmt: PASS`，无 diff） |
| 2 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS，0 warning（`Finished dev profile ... 2.59s`） |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：见下表，108 passed / 0 failed |

| 测试目标 | 结果 |
|---|---|
| lib（含 files 9、tree 1、既有 20） | 30 passed; 0 failed |
| `contract_shape`（既有） | 3 passed; 0 failed |
| `files_open` | 12 passed; 0 failed |
| `files_read` | 12 passed; 0 failed |
| `files_source` | 18 passed; 0 failed |
| `security_paths_auth`（既有） | 24 passed; 0 failed |
| `tree_listing` | 9 passed; 0 failed |
| main / doc-tests | 0 passed; 0 failed |

补充：线程竞态用例（一次性写者、持续改写）连续 8 次复跑全绿（每次 ~0.16s）；只读保证用源字节/目录项前后比较断言（security-model §8、AT04 口径）。

## 5. 实现决策与契约张力（明确记录）

1. **>50MiB 打开的流式哈希（与 contracts §2.1 字面“仅 64KiB 探测与 stat”的差异）**：`DocIdentity.contentHash`（§3.1）为必填 64 位 hex，且 `relink_document` 需“与最后已知 contentHash 比较”。若不在开放时建立哈希，身份模型与 relink 比较无法成立。实现保留“前 64KiB 探测 + stat”的校验语义、不做全量解码、不缓存大文件文本，仅额外做一次流式 SHA-256 读（无内存增长）。已在模块头与本报告记录；未改契约文本。
2. **校验快照缓存上限 ≤2**：contracts 未冻结 Rust 侧保留数；取 2 与前端 `DocumentModel`（architecture §6、计划 T-22）一致，可通过 `FilesConfig` 调整（默认 `SNAPSHOT_CACHE_CAPACITY = 2`）。逐出后 `initial`/窗口按“磁盘哈希 == 注册哈希才可重载，否则 `PS_IO_CHANGED`”处理——不悄悄替换展示版本。
3. **稳定读取**：S1=150ms、N=5 为契约初值，实现为可注入 `StabilityTimer`（生产 `SystemTimer`），协议核 `stable_reading` 为纯函数；测试用短窗口 + 写者线程，另有零时间确定性测试。仅 `refresh` 与 relink 后读取执行。
4. **源码窗口语义**：行边界切片；当窗口不含末行时排除行终止符（CRLF 连 `\r` 一起排除），含末行时保留原样字节（尾部换行形成最后空行，见 `line_count` 约定）；`startLine` 越界钳制到最后一行并置 `eof=true`；非法请求（`startLine<1`、`maxLines<1|>2000`）返回 `PS_INTERNAL`（命令层 wp-15 可更早校验）。
5. **`search_source` 预算与错误码**：`SourceSearchResult` 无 error 字段，故预算/上限触发时返回 `Ok(结果)` 且 `complete=false`（不虚报完整），`PS_LIMIT_SEARCH` 由命令层作为提示关联；默认扫描预算 256MiB（可校准初值，`FilesConfig` 注入小值可测）。大小写折叠用 Unicode 默认 lowercase + 逐折叠字节回映原始字节区间（İ 等扩展映射有专门测试）；匹配为最左非重叠，跨块一致。
6. **>50MiB 源码读取的版本语义**：大文件无内存快照可保护，`get_source_info`/窗口/搜索反映当前磁盘版本（懒行索引 + 流式哈希，stat 快路径），并在每次窗口/扫描前后做版本校验；≤50MiB 保持“源码视图不读盘新版本”。
7. **`relink_document` 目标已是其它 docId 的路径** → `PS_INTERNAL`（服务不变量；命令层应去重后再调用）。>50MiB 目标 → `PS_LIMIT_SIZE`（`RelinkResult` 必含快照文本，结构上无法满足）。
8. **目录状态枚举**：`out-of-root` 通过 `read_directory` 的 `PS_AUTH_OUTSIDE_ROOT` 拒绝、symlink 目标通过 `symlink-outside` 表达；单层列举在 canonical 根校验下不会产生 out-of-root 子节点（该 enum 值本服务不产出）。`read_directory` 返回的 `dirPath` 为 canonical 路径；展开 symlink-inside 列出目标目录子项。
9. **符号链接**：列举子项仅 `symlink_metadata`/`read_link`/canonicalize 目标判定位，不递归跟随；`hasChildren` 仅对目录/指向目录的 symlink-inside 做一次 `readdir` 探测。

## 6. 限制与风险

- 大文件懒行索引为 `Vec<u64>`（每行 8 字节）；极端换行密集的 >50MiB 文件内存开销可观（架构 §7 的“懒构建、版本变化即失效”设计；未来可校准/分块化）。
- 单窗口最多 2000 行但无字节帽，病态超长行可能产生较大一次性读取；受契约行数上限约束。
- 搜索预算默认值非契约冻结数值，属可校准初值（NF06），已在代码与报告中标注。
- mtime 粒度导致的同尺寸同时间内容替换仅在流式哈希校验中可检出（已有专门测试覆盖该路径）。

## 7. 提交

任务分支 `task/wp-10-files` 上单一提交：`feat(files): add document and directory read services`。提交前 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 全绿；`git diff --cached --check` 干净；仅提交声明范围（`src-tauri/src/`、`src-tauri/tests/`、`fixtures/`、`artifacts/60-implementation/`）。
