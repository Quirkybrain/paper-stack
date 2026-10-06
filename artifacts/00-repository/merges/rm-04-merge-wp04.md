# 合并证据 04 — `task/wp-04-models` → `feat/v0.1.0`（RM-04-MERGE-WP04）

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Artifact ID**: RM-04-MERGE-WP04
- **Artifact Type**: Merge Evidence（小任务进入集成分支的合并与集成证据）
- **Owner**: repository-manager
- **Source**: handoff `state/handoffs/rm-04-merge-wp04.json`（pin/begin 冻结，spec_sha256 `4ea787db11f66f36174d287dcde6a87630bf1c3bd5309118b09e02e4d9c570e3`）；`config/git-policy.json`（sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014`）；仓库根目录实测 Git 命令输出（见第 2、3 节）
- **Upstream Dependencies**: `task/wp-04-models` tip `c25b511b17a0e8dd31685a4d099b3b837c7de1fc`（source_commit）；`feat/v0.1.0` 合并前 tip `4d87b5e28d1a921ee7ff15761c1f30ccf6edb26c`（base_commit）；来源分支门禁证据 `artifacts/00-repository/gates/wp-04-gate.md`（sha256 `3383fb3cbc20f5f6dbd68f4307cc6702e452edc8a1460adbba03d76ed4ba4819`，与 handoff pin 一致）；模型产物 `artifacts/35-models/session-and-version-models.md`（Rev 1，`agent:system-modeler`）
- **Downstream Dependencies**: `feat/v0.1.0` 上后续任务（下一任务 `wp-05` UX／UI 规格）；v0.1.0 集成、回归与 Stage Gate
- **Revision**: 本文件作为合并提交 `804bbfd0a82f069ee8c42ac1cc9efb9817f4afa1` 的直接后继证据提交被记录；合并后截至 `finish` 恰好一个第一父链后继提交
- **Last Verified**: 2026-10-07，仓库根目录实测命令输出
- **Validation**: 由 handoff `rm-04-merge-wp04` 驱动；`python3 scripts/swe_guard.py finish rm-04-merge-wp04` 校验双亲合并提交、来源 tip、合并路径范围、证据提交与工作区干净状态
- **Open Issues**: 无

## 1. 合并范围与策略

| 项 | 值 |
|---|---|
| 动作 | `repository_action: merge`（小任务 → 集成分支） |
| 来源分支 | `task/wp-04-models` @ `c25b511b17a0e8dd31685a4d099b3b837c7de1fc` |
| 目标分支 | `feat/v0.1.0` @ 合并前 tip `4d87b5e28d1a921ee7ff15761c1f30ccf6edb26c` |
| 合并策略 | `no-ff`（`config/git-policy.json` `merge_strategy`） |
| 合并提交 | `804bbfd0a82f069ee8c42ac1cc9efb9817f4afa1` — `docs(models): merge wp-04 models into feat/v0.1.0` |
| 冲突 | 无（`ort` 策略，纯新增合并，`--no-ff`） |

## 2. 合并前状态（实测）

```text
$ git rev-parse HEAD
4d87b5e28d1a921ee7ff15761c1f30ccf6edb26c

$ git rev-parse task/wp-04-models
c25b511b17a0e8dd31685a4d099b3b837c7de1fc

$ git branch --show-current
feat/v0.1.0

$ git status --porcelain
（无输出——工作区与索引干净）
```

两个 tip 与 handoff 固定的 `base_commit` / `source_commit` 完全一致；当前分支为目标分支 `feat/v0.1.0`。合并基点 `git merge-base feat/v0.1.0 task/wp-04-models` = `4d87b5e`（即合并前目标 tip）。来源分支领先两个提交（`714ec66` 会话与版本语义模型、`c25b511` 门禁证据），目标分支无独有提交；`git diff --stat feat/v0.1.0...task/wp-04-models` 显示 2 个文件、779 行插入、无删除，为纯新增合并。

## 3. 合并执行与结果（实测）

### 3.1 合并命令与输出

```text
$ git merge --no-ff task/wp-04-models -m "docs(models): merge wp-04 models into feat/v0.1.0"
Merge made by the 'ort' strategy.
 artifacts/00-repository/gates/wp-04-gate.md       |  34 +
 artifacts/35-models/session-and-version-models.md | 745 ++++++++++++++++++++++
 2 files changed, 779 insertions(+)
 create mode 100644 artifacts/00-repository/gates/wp-04-gate.md
 create mode 100644 artifacts/35-models/session-and-version-models.md
```

退出码 0；无冲突标记，无未合并路径。

### 3.2 合并提交双亲验证

```text
$ git rev-list --parents -n 1 HEAD
804bbfd0a82f069ee8c42ac1cc9efb9817f4afa1 4d87b5e28d1a921ee7ff15761c1f30ccf6edb26c c25b511b17a0e8dd31685a4d099b3b837c7de1fc
```

合并提交为双亲提交，两个父提交恰为固定的目标 tip 与来源 tip。提交主题 `docs(models): merge wp-04 models into feat/v0.1.0`，符合默认 Conventional Commit 格式。

### 3.3 合并路径

```text
$ git diff --name-only 4d87b5e28d1a921ee7ff15761c1f30ccf6edb26c HEAD
artifacts/00-repository/gates/wp-04-gate.md
artifacts/35-models/session-and-version-models.md
```

共 2 条路径：1 条门禁证据（`artifacts/00-repository/gates/wp-04-gate.md`）、1 份模型产物（`artifacts/35-models/session-and-version-models.md`，745 行、14 个 mermaid 图）。全部路径均在 handoff `writes`（`artifacts/35-models/`、`artifacts/00-repository/`）范围内，且均为新增文件（`create mode`）。

## 4. 门禁证据与快照

- **门禁证据存在于目标分支**：是。`git cat-file -e HEAD:artifacts/00-repository/gates/wp-04-gate.md` 通过；目标分支上 Git blob 为 `c7438ef6eb7c17a869e37ed9a42bc74c843b6c64`，文件 sha256 `3383fb3cbc20f5f6dbd68f4307cc6702e452edc8a1460adbba03d76ed4ba4819`，与 handoff `gate_evidence_path_sha256` 一致（来源分支上被守卫固定的字节被原样带入）。
- **模型产物字节一致性**：`artifacts/35-models/session-and-version-models.md` 在目标分支与来源分支上的 Git blob 均为 `442aabb2e756c8cd3791bdd62d531072ec226463`（原样带入，无合并改写）。
- **使用的快照 ref**：`refs/swe/snapshots/20261006T202734Z-rm-04-merge-wp04-d33add80` → `880d70726a1862d0af4ca050493e017de06d6c0d`（`snapshot_paths: artifacts/00-repository/` 的合并前字节已捕获，可用于恢复目标分支既有仓库证据文件如 `rm-01`/`rm-02`/`rm-03` 合并证据与 `wp-01`–`wp-03` 门禁证据）。
- **Pinned 输入复核**：`config/git-policy.json`、`config/git-policy.default.md`、`state/handoffs/wp-00-start.request.md` 实测 SHA-256 与 handoff `inputs` 全部一致；门禁证据 sha256 亦一致。

## 5. 结果状态

- 合并提交后、本证据提交前：`git status --porcelain` 无输出（干净）。
- 本证据提交为合并提交之后**唯一**的第一父链后继提交，且仅含本文件（`artifacts/00-repository/merges/rm-04-merge-wp04.md`）。
- `finish` 时实测工作区保持干净，`finish` 结果以守卫输出为准。

## 6. 后续动作（Next Action）

1. `repository-manager` 从 `feat/v0.1.0` 的最新已提交 tip（本证据提交）创建 `task/wp-05`（UX／UI 规格任务；具体 task ID、范围与输入以届时 handoff 为准）并 pin，交由相应专家执行；模型产物 `artifacts/35-models/session-and-version-models.md` 的 INV-* 不变量可作为 UI 规格与后续实现、测试的 oracle 输入。
2. 本合并证据只证明小任务集成事实与范围，不构成 Stage Gate 批准；v0.1.0 集成、回归、独立评审与 Stage Gate 仍按最小必要路径执行。
3. 无远端；push/删除分支均未执行，任务分支 `task/wp-04-models` 保留至后续受控清理。
