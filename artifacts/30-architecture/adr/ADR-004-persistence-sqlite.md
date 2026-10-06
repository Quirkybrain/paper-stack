# ADR-004 持久化：SQLite Schema 与迁移（Persistence via rusqlite bundled）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `data-model.md`（全部）、`contracts.md` §2（命令 13–23）、`architecture.md` §4/§6

## Context

计划书 §3.6 要求 SQLite 保存设置、最近阅读、文档身份、标签会话、导航位置与授权，且“不默认将所有正文永久复制进数据库”；R06/R19/R27 规定记录内容与分类清除；NF08 要求正常退出保存已确认状态、异常退出最多恢复最后成功提交状态、迁移失败不静默清空。`config/project.md` 固定 rusqlite（bundled）。数据量小而片段多（设置、位置、会话），并发极低（单进程单窗口）。

## Options

- **A：JSON/TOML 文件分片持久化**。无事务、无一致性、分类清除与上限管理需要自建；与 SQLite 固定决策冲突；否决。
- **B：单连接 + `Mutex`，命令经 `spawn_blocking` 执行**。简单、事务集中、无额外线程/通道；写延迟对 v0.1.0 无感。
- **C：专用存储线程 + mpsc 通道**。隔离性更好，但引入请求/应答协议与启动编排成本；v0.1.0 收益不足。
- **D：r2d2 连接池**。并发写更少冲突，但单窗口低并发下过度设计。
- **E：bundled vs system SQLite**。bundled 固定（不要求用户安装；计划书 §4.3）。

## Decision

采用 B + E，并以 `data-model.md` 为 schema 权威：

1. 运行参数：`foreign_keys=ON`、`journal_mode=WAL`、`synchronous=NORMAL`、`busy_timeout=3000`；表使用 `STRICT`。
2. 库文件 `<appDataDir>/paperstack.sqlite3`；schema v1 内含 `settings/documents/recents/positions/session_tabs/session_meta/sidebar_state/authorizations/cache_meta`；修订号用 `PRAGMA user_version`（本版 = 1）。
3. 迁移**前向唯一**：v0→v1 于单一事务创建全部对象；失败回滚并进入内存降级，文件原样保留；提供显式“重建本地数据库”（重命名损坏文件后新建），不得自动清空（NF08）。
4. 写入门禁与分类清除由 `services/storage` 统一执行（data-model §6）：`rememberRecords` + 会话抑制标志决定最近/位置/会话是否可写；清除后本会话停止写回直至显式恢复（R27）。
5. 无正文策略：库中不存全文/原句/选区；位置仅锚点（data-model §3.3）；缓存索引只指向可重建文件。
6. 所有读写经 `spawn_blocking`，避免阻塞 Tauri 异步运行时；写操作使用显式事务；`SaveResult{saved,error?}` 不以异常代替结果。

## Consequences

- 正面：单一事务边界、分类清除与上限（最近 100、缓存 256MiB LRU）易实现；损坏/迁移失败可诊断且不丢数据；bundled 免安装依赖。
- 代价：单连接串行写入——对单窗口场景可忽略；WAL 产生 `-wal/-shm` 同目录文件（属应用数据目录，不触碰源）；bundled 增加构建时间/包体积。
- 风险：`STRICT` 与 JSON 字段（`heading_path_json` 等）需要实现侧持续序列化守护；迁移测试必须覆盖空库、v1 库、损坏、只读、磁盘满、中断（NF08）。
- 未来版本新增表/列时继续前向迁移；不得反向降级 schema。

## Constraints

- 不在源目录创建任何文件；数据库/缓存/日志仅位于应用目录（R04、计划书 §5.4）。
- LRU 与清除不得删除用户原文件；清除不自动重新授予授权（R25、R27）。
- 依赖版本在工程初始化锁定并入库锁文件（PC-11）。

## Affected Artifacts

- `data-model.md`（DDL、记录格式、迁移、清除规则为规范）。
- `contracts.md` 存储/设置/授权命令组（13–23、26、27）。
- 下游：Rust `services/{storage,session}`、迁移与故障注入测试、隐私设置界面。
