# 仓库准备记录 01 — v0.1.0 交付基线（Repository Prep 01）

- **Artifact ID**: REPO-PREP-01
- **Artifact Type**: Repository Status Report（仓库状态与集成基线证据）
- **Producer**: agent:repository-manager
- **Status**: VALID
- **Owner**: repository-manager
- **Source**: `config/git-policy.json`、`config/git-policy.default.md`、`docs/git-collaboration.md`、`state/handoffs/wp-00-start.request.md`；仓库根目录实测 Git 命令输出（见第 2 节）
- **Upstream Dependencies**: `config/git-policy.json` (sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014`)、`config/git-policy.default.md` (sha256 `c3493586146862d14386fcf75b6212041d299bd9f968bc994edce18e2a122915`)、`docs/git-collaboration.md` (sha256 `e1884a3333a55903581521fca6ff2ba5b11f7bd9419b3d49972056203367260c`)
- **Downstream Dependencies**: `feat/v0.1.0` 集成分支及其上所有 `task/<task-id>` 任务交接
- **Revision**: `253ded278795b6709b9ec7fab1a2020046ad29fb`（本文件作为其后继准备提交被记录）
- **Last Verified**: 2026-10-07，仓库根目录实测命令输出
- **Validation**: 本文件由 `rm-00-repo-prep` handoff 驱动产出，经 `python3 scripts/swe_guard.py finish rm-00-repo-prep` 校验提交范围、输入哈希与分支状态
- **Assumptions**: 仓库保持无远端；框架文件继续处于 `.gitignore` 状态；产品工程从零开始，无可复用产品代码
- **Open Issues**: 无托管远端，主机级 PR/CI/评审保护不可用；集成退出改用受守卫的本地 `main` merge（见第 4 节）

## 1. 仓库身份（Repository Identity）

| 项 | 值 |
|---|---|
| 项目 | 纸栈 PaperStack（Linux 优先、本地文件优先的只读技术文档阅读器，当前目标 v0.1.0） |
| 仓库根目录 | `/home/quirkybrain/code/claude-code-swe-framework-tests/claude-code-swe-framwork-test-v1.1/op/PaperStack` |
| 工作流级别 | STRICT（`config/project.md`），Target Stage = release，Execution Mode = GATED_AUTO |
| Git 策略模式 | `BRANCH_PER_TASK`（`config/git-policy.json`） |
| 远端 | 无（`git remote -v` 无输出）；仓库为纯本地仓库 |
| 当前分支 | `main`（不是 detached HEAD） |
| 受管框架文件 | `AGENTS.md`、`CLAUDE.md`、`scripts/`、`.claude/`、`.opencode/`、`config/`、`docs/` 等由 `.gitignore` 排除，本任务未修改 |

## 2. 实测仓库状态（2026-10-07，仓库根目录）

以下为准备提交前的实测输出，原样记录。

### 2.1 `git status --porcelain`

```text
（无输出——工作区与索引干净）
```

### 2.2 `git log --oneline -5`

```text
253ded2 chore: establish clean project baseline
```

### 2.3 `git rev-parse HEAD`（基线提交 SHA）

```text
253ded278795b6709b9ec7fab1a2020046ad29fb
```

### 2.4 `git branch -a`

```text
* main
```

### 2.5 `git worktree list`

```text
/home/quirkybrain/code/claude-code-swe-framework-tests/claude-code-swe-framwork-test-v1.1/op/PaperStack  253ded2 [main]
```

### 2.6 `git remote -v`

```text
（无输出——未配置任何远端）
```

### 2.7 `config/git-policy.json`（sha256 `3b8ddffd…a014`）

```json
{
  "mode": "BRANCH_PER_TASK",
  "company_policy_path": null,
  "main_branch": "main",
  "integration_branch_pattern": "^(feat|feature|fix|bugfix|hotfix|docs|refactor|test|chore|release)/[a-z0-9][a-z0-9._-]*$",
  "task_branch_pattern": "^task/[a-z0-9][a-z0-9._-]*$",
  "merge_strategy": "no-ff",
  "main_merge_mode": "review_request_when_remote"
}
```

## 3. 基线与分支阶梯（Baseline and Branch Ladder）

| 项 | 值 |
|---|---|
| 基线提交 | `253ded278795b6709b9ec7fab1a2020046ad29fb`（`chore: establish clean project baseline`，仅包含 `.gitignore`） |
| 当前分支 | `main` |
| 工作区状态 | clean（`git status --porcelain` 为空） |
| 准备提交 | 本文件作为提交 `chore(repo): establish feat/v0.1.0 integration branch` 的内容；提交后 HEAD 指向该提交 |
| 集成分支 | `feat/v0.1.0`，在准备提交完成后由 `git branch feat/v0.1.0 HEAD` 创建于该提交；不检出，`main` 保持检出 |
| 分支阶梯 | `main` → `feat/v0.1.0` → `task/<task-id>` |
| 合并策略 | `no-ff`（每个任务经 Gate 后以双亲合并提交进入 `feat/v0.1.0`，并附独立集成证据提交） |
| 整合模式 | 小型任务完成后在 `feat/v0.1.0` 上执行集成、回归与 Stage Gate；通过后按第 4 节退出到 `main` |

任务分支命名须匹配 `^task/[a-z0-9][a-z0-9._-]*$`，集成分支命名须匹配 `^(feat|feature|fix|bugfix|hotfix|docs|refactor|test|chore|release)/[a-z0-9][a-z0-9._-]*$`。

## 4. 无远端与 main 合并模式（No Remote and main_merge_mode）

- `main_merge_mode = review_request_when_remote`：配置任意远端后，托管 PR/MR 成为唯一 main 合并路径，本地 main merge handoff 被守卫拒绝。
- 本仓库实测无任何远端（第 2.6 节），因此 `scripts/swe_guard.py` 的 `require_local_main_merge_allowed` 允许受守卫的**本地** `main` 合并：集成退出时可由 `repository-manager` 以 `repository_action: merge`，携带来源分支上已提交的 `integration_evidence_path`（门禁报告 + 集成报告），在 `feat/v0.1.0` 通过集成/回归检查、独立评审与 Stage Gate 后合并到 `main`。
- 本地守卫合并仅证明合并证据与范围，不声称发生过 PR、托管 CI 或平台审批；报告中不得写成已获平台批准。
- 若将来配置远端，该设置立即切换为托管评审路径，任何本地 main merge 尝试都将被守卫拒绝。

## 5. 策略来源（Policy Source）

- 可执行设置：`config/git-policy.json`（sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014`），`mode = BRANCH_PER_TASK`。
- `company_policy_path: null` → 采用默认规范 `config/git-policy.default.md`（sha256 `c3493586146862d14386fcf75b6212041d299bd9f968bc994edce18e2a122915`）；未提供公司 Git 规范（`input/` 下无公司规范文件）。
- 协作流程说明：`docs/git-collaboration.md`（sha256 `e1884a3333a55903581521fca6ff2ba5b11f7bd9419b3d49972056203367260c`）。
- 用户起始请求：`state/handoffs/wp-00-start.request.md`（sha256 `ad861f2bf253dd5827a94c6ab8d30c6f69b6d1f7b8497d2d2a6b09b727cbce7d`），目标 v0.1.0、STRICT。

## 6. 运行模式操作说明（Operational Notes — OpenCode Runtime）

- 本 OpenCode 运行时中**所有任务串行执行于主工作区（main worktree）**；一个 worktree 同时只有一个活动 handoff，不创建或切换额外 worktree，不切换工作分支（除 repository-manager 在停靠点执行的受控集成操作外）。
- 每个任务在 pin 之前由 `repository-manager` 从**当前已提交的集成分支 tip**（`feat/v0.1.0`，或首个任务前为本次准备提交）创建唯一 `task/<task-id>` 分支；handoff 中固定 `task_branch`、`parent_branch` 与精确 `commit_paths`。
- 各专业 Agent 只提交其声明路径的产出；报告型 Agent 只提交报告；`repository-manager` 负责分支创建、同步检查、`--no-ff` 合并、冲突处理与状态证据（本文件即第一份状态证据）。
- handoff 活动期间不做 pull/switch/rebase/merge/push；父分支移动时先结束交接、评估输入漂移、再重新 pin。
- 本地提交不构成远端备份；所有交付物与证据以文件系统持久化为准。

## 7. 后续动作（Next Action）

1. 编排器（Orchestrator）在 `feat/v0.1.0` 上按最小必要路径规划 v0.1.0 任务。
2. 每个任务 pin 前由 `repository-manager` 从 `feat/v0.1.0` tip 创建 `task/<task-id>` 分支并固定输入。
3. 任务通过 Gate 后由 `repository-manager` 以 `--no-ff` 并入 `feat/v0.1.0`，提交集成证据。
4. 集成完成后运行集成/回归检查、独立评审与 Stage Gate；通过后按第 4 节执行受守卫的本地 main 合并（或将来配置远端时改走托管 PR/MR）。
