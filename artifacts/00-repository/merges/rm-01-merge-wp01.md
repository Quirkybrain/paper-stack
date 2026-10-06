# 合并证据 01 — `task/wp-01-intake` → `feat/v0.1.0`（RM-01-MERGE-WP01）

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Artifact ID**: RM-01-MERGE-WP01
- **Artifact Type**: Merge Evidence（小任务进入集成分支的合并与集成证据）
- **Owner**: repository-manager
- **Source**: handoff `state/handoffs/rm-01-merge-wp01.json`（pin/begin 冻结，spec_sha256 `89b008af6280d177bc7aa96e4740806f452a8f0ce075d67324d6ef396c2d7946`）；`config/git-policy.json`（sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014`）；仓库根目录实测 Git 命令输出（见第 2、3 节）
- **Upstream Dependencies**: `task/wp-01-intake` tip `17d5ead268140d9dc20942261f107e7f21b27e62`（source_commit）；`feat/v0.1.0` 合并前 tip `ad9c8a1ec0175d60c251b5346072e3982ba1f1f6`（base_commit）；来源分支门禁证据 `artifacts/00-repository/gates/wp-01-gate.md`（sha256 `11b52f0c1049d90fca9ffcb861ec500dee03cb2c6b5ca6725c9ce40c69cae3fa`，与 handoff pin 一致）
- **Downstream Dependencies**: `feat/v0.1.0` 上后续任务（下一任务 `wp-02` 需求基线）；v0.1.0 集成、回归与 Stage Gate
- **Revision**: 本文件作为合并提交 `b92f327da03da3ea70e6efda32929f5549ffaaf4` 的直接后继证据提交被记录；合并后截至 `finish` 恰好一个后继提交
- **Last Verified**: 2026-10-07，仓库根目录实测命令输出
- **Validation**: 由 handoff `rm-01-merge-wp01` 驱动；`python3 scripts/swe_guard.py finish rm-01-merge-wp01` 校验双亲合并提交、来源 tip、合并路径范围、证据提交与工作区干净状态
- **Open Issues**: 无

## 1. 合并范围与策略

| 项 | 值 |
|---|---|
| 动作 | `repository_action: merge`（小任务 → 集成分支） |
| 来源分支 | `task/wp-01-intake` @ `17d5ead268140d9dc20942261f107e7f21b27e62` |
| 目标分支 | `feat/v0.1.0` @ 合并前 tip `ad9c8a1ec0175d60c251b5346072e3982ba1f1f6` |
| 合并策略 | `no-ff`（`config/git-policy.json` `merge_strategy`） |
| 合并提交 | `b92f327da03da3ea70e6efda32929f5549ffaaf4` — `docs(intake): merge wp-01 intake into feat/v0.1.0` |
| 冲突 | 无（`ort` 策略，纯新增合并） |

## 2. 合并前状态（实测）

```text
$ git rev-parse HEAD
ad9c8a1ec0175d60c251b5346072e3982ba1f1f6

$ git rev-parse task/wp-01-intake
17d5ead268140d9dc20942261f107e7f21b27e62

$ git branch --show-current
feat/v0.1.0

$ git status --porcelain
（无输出——工作区与索引干净）
```

两个 tip 与 handoff 固定的 `base_commit` / `source_commit` 完全一致；当前分支为目标分支。

## 3. 合并执行与结果（实测）

### 3.1 合并命令与输出

```text
$ git merge --no-ff task/wp-01-intake -m "docs(intake): merge wp-01 intake into feat/v0.1.0"
Merge made by the 'ort' strategy.
 artifacts/00-repository/gates/wp-01-gate.md |  41 +++++
 artifacts/10-intake/intake-report.md        | 253 ++++++++++++++++++++++++++++
 2 files changed, 294 insertions(+)
 create mode 100644 artifacts/00-repository/gates/wp-01-gate.md
 create mode 100644 artifacts/10-intake/intake-report.md
```

退出码 0；无冲突标记，无未合并路径。

### 3.2 合并提交双亲验证

```text
$ git rev-list --parents -n 1 HEAD
b92f327da03da3ea70e6efda32929f5549ffaaf4 ad9c8a1ec0175d60c251b5346072e3982ba1f1f6 17d5ead268140d9dc20942261f107e7f21b27e62
```

合并提交为双亲提交，两个父提交恰为固定的目标 tip 与来源 tip。

### 3.3 合并路径

```text
$ git diff --name-only ad9c8a1ec0175d60c251b5346072e3982ba1f1f6 HEAD
artifacts/00-repository/gates/wp-01-gate.md
artifacts/10-intake/intake-report.md
```

两条路径均在 handoff `writes`（`artifacts/00-repository/`、`artifacts/10-intake/`）范围内；门禁证据与 intake 报告均为新增文件。

## 4. 门禁证据与快照

- **门禁证据存在于目标分支**：是。`git cat-file -e HEAD:artifacts/00-repository/gates/wp-01-gate.md` 通过；目标分支上 Git blob 为 `aa0408457e9946ab8d1ef2c1fd8a787cd48a6728`，文件 sha256 `11b52f0c1049d90fca9ffcb861ec500dee03cb2c6b5ca6725c9ce40c69cae3fa`，与 handoff `gate_evidence_path_sha256` 一致（来源分支上被守卫固定的字节被原样带入）。
- **使用的快照 ref**：`refs/swe/snapshots/20261006T200122Z-rm-01-merge-wp01-41058862` → `ca1b7ee90d2e410d58036024a9603d565a08bd8b`（`snapshot_paths: artifacts/00-repository/` 的合并前字节已捕获，可用于恢复目标分支既有仓库证据文件）。

## 5. 结果状态

- 合并提交后、本证据提交前：`git status --porcelain` 无输出（干净）。
- 本证据提交为合并提交之后**唯一**的第一父链后继提交，且仅含本文件（`artifacts/00-repository/merges/rm-01-merge-wp01.md`）。
- `finish` 时实测工作区保持干净，`finish` 结果以守卫输出为准。

## 6. 后续动作（Next Action）

1. `repository-manager` 从 `feat/v0.1.0` 的最新已提交 tip（本证据提交）创建 `task/wp-02` 并 pin，交由需求基线（requirements baseline）工作；输入与范围以届时 handoff 为准。
2. 本合并证据只证明小任务集成事实与范围，不构成 Stage Gate 批准；v0.1.0 集成、回归、独立评审与 Stage Gate 仍按最小必要路径执行。
3. 无远端；push/删除分支均未执行，任务分支 `task/wp-01-intake` 保留至后续受控清理。
