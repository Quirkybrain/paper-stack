# 合并证据 03 — `task/wp-03-architecture` → `feat/v0.1.0`（RM-03-MERGE-WP03）

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Artifact ID**: RM-03-MERGE-WP03
- **Artifact Type**: Merge Evidence（小任务进入集成分支的合并与集成证据）
- **Owner**: repository-manager
- **Source**: handoff `state/handoffs/rm-03-merge-wp03.json`（pin/begin 冻结，spec_sha256 `c7fa1eb497b16737de55ca01a5b471c0d64e89312a319e8b84ff202b16016538`）；`config/git-policy.json`（sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014`）；仓库根目录实测 Git 命令输出（见第 2、3 节）
- **Upstream Dependencies**: `task/wp-03-architecture` tip `4b30399b9908cb513ea324ea4495e281e1695130`（source_commit）；`feat/v0.1.0` 合并前 tip `7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b`（base_commit）；来源分支门禁证据 `artifacts/00-repository/gates/wp-03-gate.md`（sha256 `f664ba523adb8f1d15f3d0a7a118bfe57f702f765790ea33792d7175b18dfa83`，与 handoff pin 一致）
- **Downstream Dependencies**: `feat/v0.1.0` 上后续任务（下一任务 `wp-04` 模型基线）；v0.1.0 集成、回归与 Stage Gate
- **Revision**: 本文件作为合并提交 `17ab95c3364217671c1855758c78cb2cdb5d6db6` 的直接后继证据提交被记录；合并后截至 `finish` 恰好一个后继提交
- **Last Verified**: 2026-10-07，仓库根目录实测命令输出
- **Validation**: 由 handoff `rm-03-merge-wp03` 驱动；`python3 scripts/swe_guard.py finish rm-03-merge-wp03` 校验双亲合并提交、来源 tip、合并路径范围、证据提交与工作区干净状态
- **Open Issues**: 无

## 1. 合并范围与策略

| 项 | 值 |
|---|---|
| 动作 | `repository_action: merge`（小任务 → 集成分支） |
| 来源分支 | `task/wp-03-architecture` @ `4b30399b9908cb513ea324ea4495e281e1695130` |
| 目标分支 | `feat/v0.1.0` @ 合并前 tip `7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b` |
| 合并策略 | `no-ff`（`config/git-policy.json` `merge_strategy`） |
| 合并提交 | `17ab95c3364217671c1855758c78cb2cdb5d6db6` — `docs(architecture): merge wp-03 architecture into feat/v0.1.0` |
| 冲突 | 无（`ort` 策略，纯新增合并，`--no-ff`） |

## 2. 合并前状态（实测）

```text
$ git rev-parse HEAD
7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b

$ git rev-parse task/wp-03-architecture
4b30399b9908cb513ea324ea4495e281e1695130

$ git branch --show-current
feat/v0.1.0

$ git status --porcelain
（无输出——工作区与索引干净）
```

两个 tip 与 handoff 固定的 `base_commit` / `source_commit` 完全一致；当前分支为目标分支。来源分支领先两个提交（`6355995` 架构与契约基线、`4b30399` 门禁证据），目标分支无独有提交，`git diff --stat HEAD..task/wp-03-architecture` 显示 16 个文件、2054 行插入、无删除，为纯新增合并。

## 3. 合并执行与结果（实测）

### 3.1 合并命令与输出

```text
$ git merge --no-ff task/wp-03-architecture -m "docs(architecture): merge wp-03 architecture into feat/v0.1.0"
Merge made by the 'ort' strategy.
 artifacts/00-repository/gates/wp-03-gate.md        |  46 ++
 .../adr/ADR-001-stack-and-runtime.md               |  50 +++
 .../adr/ADR-002-single-parse-pipeline.md           |  49 +++
 .../adr/ADR-003-state-management.md                |  51 +++
 .../adr/ADR-004-persistence-sqlite.md              |  52 +++
 .../adr/ADR-005-authorization-and-resources.md     |  51 +++
 .../adr/ADR-006-versioning-and-update-modes.md     |  51 +++
 artifacts/30-architecture/adr/ADR-007-search.md    |  53 +++
 .../adr/ADR-008-packaging-and-distribution.md      |  53 +++
 .../adr/ADR-009-i18n.md                            |  50 +++
 .../adr/ADR-010-desktop-verification.md            |  57 +++
 artifacts/30-architecture/architecture.md          | 348 +++++++++++++++
 artifacts/30-architecture/contracts.md             | 490 +++++++++++++++++++++
 artifacts/30-architecture/data-model.md            | 256 ++++++++++++++
 artifacts/30-architecture/rendering-pipeline.md    | 197 ++++++++++
 artifacts/30-architecture/security-model.md        | 200 ++++++++++
 16 files changed, 2054 insertions(+)
（全部为 create mode，无删除、无修改）
```

退出码 0；无冲突标记，无未合并路径。

### 3.2 合并提交双亲验证

```text
$ git rev-list --parents -n 1 HEAD
17ab95c3364217671c1855758c78cb2cdb5d6db6 7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b 4b30399b9908cb513ea324ea4495e281e1695130
```

合并提交为双亲提交，两个父提交恰为固定的目标 tip 与来源 tip。

### 3.3 合并路径

```text
$ git diff --name-only 7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b HEAD
artifacts/00-repository/gates/wp-03-gate.md
artifacts/30-architecture/adr/ADR-001-stack-and-runtime.md
artifacts/30-architecture/adr/ADR-002-single-parse-pipeline.md
artifacts/30-architecture/adr/ADR-003-state-management.md
artifacts/30-architecture/adr/ADR-004-persistence-sqlite.md
artifacts/30-architecture/adr/ADR-005-authorization-and-resources.md
artifacts/30-architecture/adr/ADR-006-versioning-and-update-modes.md
artifacts/30-architecture/adr/ADR-007-search.md
artifacts/30-architecture/adr/ADR-008-packaging-and-distribution.md
artifacts/30-architecture/adr/ADR-009-i18n.md
artifacts/30-architecture/adr/ADR-010-desktop-verification.md
artifacts/30-architecture/architecture.md
artifacts/30-architecture/contracts.md
artifacts/30-architecture/data-model.md
artifacts/30-architecture/rendering-pipeline.md
artifacts/30-architecture/security-model.md
```

共 16 条路径：1 条门禁证据（`artifacts/00-repository/gates/wp-03-gate.md`）、5 份架构与契约文档（`architecture.md`、`contracts.md`、`data-model.md`、`rendering-pipeline.md`、`security-model.md`）、10 份 ADR（ADR-001 至 ADR-010）。全部路径均在 handoff `writes`（`artifacts/30-architecture/`、`artifacts/00-repository/`）范围内，且均为新增文件。

## 4. 门禁证据与快照

- **门禁证据存在于目标分支**：是。`git cat-file -e HEAD:artifacts/00-repository/gates/wp-03-gate.md` 通过；目标分支上 Git blob 为 `62b61ec6087526d5eea01c53e6fc1133223bf69b`，文件 sha256 `f664ba523adb8f1d15f3d0a7a118bfe57f702f765790ea33792d7175b18dfa83`，与 handoff `gate_evidence_path_sha256` 一致（来源分支上被守卫固定的字节被原样带入）。
- **使用的快照 ref**：`refs/swe/snapshots/20261006T202020Z-rm-03-merge-wp03-603b58e6` → `221a2301e14c45f403b18e3ee77c78fe905eae71`（`snapshot_paths: artifacts/00-repository/` 的合并前字节已捕获，可用于恢复目标分支既有仓库证据文件如 `rm-01`/`rm-02` 合并证据与 `wp-01`/`wp-02` 门禁证据）。

## 5. 结果状态

- 合并提交后、本证据提交前：`git status --porcelain` 无输出（干净）。
- 本证据提交为合并提交之后**唯一**的第一父链后继提交，且仅含本文件（`artifacts/00-repository/merges/rm-03-merge-wp03.md`）。
- `finish` 时实测工作区保持干净，`finish` 结果以守卫输出为准。

## 6. 后续动作（Next Action）

1. `repository-manager` 从 `feat/v0.1.0` 的最新已提交 tip（本证据提交）创建 `task/wp-04`（模型基线，models task）并 pin，交由 `system-modeler` 工作；输入与范围以届时 handoff 为准。
2. 本合并证据只证明小任务集成事实与范围，不构成 Stage Gate 批准；v0.1.0 集成、回归、独立评审与 Stage Gate 仍按最小必要路径执行。
3. 无远端；push/删除分支均未执行，任务分支 `task/wp-03-architecture` 保留至后续受控清理。
