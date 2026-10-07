# Merge Evidence — rm-50-merge-wp50: `task/wp-50-release` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-50-merge-wp50.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `a4e7a1ca65ddaffd13031add02f4f7acbb486a19` (`docs(repo): record rm-49 merge evidence`; matches pinned `base_commit`). Pre-merge worktree clean (`git status --porcelain` empty); ignored `src-tauri/target/` and `output/` left in place.
- **Source branch**: `task/wp-50-release`
- **Source tip merged**: `73fad86020d79c286e451ca73a966c330a62b992` (matches pinned `source_commit`).
- **Source commits (2)**: `0ad9abd` (`docs(release): verify final package and readiness`), `73fad86` (`docs(gate): record wp-50 release readiness gate evidence`).
- Merge base `a4e7a1ca…` equals the pre-merge target tip: the target had not advanced since the source branched, so the source is a descendant of the target and `--no-ff` (configured `merge_strategy`) produced a true merge commit on a fast-forwardable history. The merge result tree is byte-identical to the source tree (`b970f94c…`) — a pure union.
- No remote configured (local-only repository; no fetch required). Target is the integration branch `feat/v0.1.0`, not `main`, so a local integration merge applies.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy (`company_policy_path: null`).
- Input pins verified before merge (sha256): `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) — all match the handoff; guard status showed `rm-50-merge-wp50` as the active task at the pinned base with a clean tree.
- Recovery snapshot `refs/swe/snapshots/20261007T211230Z-rm-50-merge-wp50-22abc047` at `439dccefdabf43cf4a71732b8242fa7929a72308`, parent `a4e7a1ca…` (pre-merge target tip). It covers the declared `snapshot_paths` (`artifacts/70-verification/`, `artifacts/00-repository/`): every one of the 3310 pre-merge target files in those paths is present and byte-identical in the snapshot (0 absent, 0 differing hashes); the snapshot additionally captures 5002 files in scope (superset, including untracked/ignored worktree content) that do not affect merge state.
- Pre-merge scope check: all 44 incoming merged paths fall within the declared `writes` (`artifacts/80-release/`, `artifacts/70-verification/`, `artifacts/00-repository/`); no other paths changed.

## Merge

- **Merge commit**: `e1b84598457d86eb8777640fc0a2bdb6cefc597a`
- **Subject**: `docs(release): merge wp-50 readiness into feat/v0.1.0`
- **Strategy**: `--no-ff`; two parents verified (`git rev-list --parents -1`): `a4e7a1ca65ddaffd13031add02f4f7acbb486a19` (pre-merge target tip) + `73fad86020d79c286e451ca73a966c330a62b992` (source tip), in that order.
- **Merge tree**: `b970f94cf5c3c80f04169643d1ad851c8000d9a3` — equals the source tree; `git diff` merge vs source is empty.
- **Conflicts**: **none** — `ort` strategy merged automatically; no conflict markers; `git diff --check` clean from pre-merge target to merge commit.
- Commit timestamp `2026-10-08 05:12:51 +0800`.

## Merged paths (44 files changed, +1174 / −0 vs pre-merge target; 44 added)

| Path | Status | Δ | Content |
|---|---|---|---|
| `artifacts/00-repository/gates/wp-50-gate.md` | added | +23 | wp-50 release-readiness gate evidence |
| `artifacts/80-release/release-readiness.md` | added | +105 | Release readiness assessment (READY-FOR-REPOSITORY-RELEASE; public distribution blocked pending A9) |
| `artifacts/80-release/package-verification.md` | added | +187 | Final `.deb` rebuild + verification report |
| `artifacts/80-release/deployment-rollback-plan.md` | added | +118 | Deployment/rollback plan (install not executed) |
| `artifacts/70-verification/evidence/package-final/` (40 files) | added | +741 | Final package evidence: 8 launch/UI screenshots, build/verify logs, dpkg metadata/payload dumps, hashes, artifact identity, tree consistency, IT08 gtk-launch system-open, superseded first-invocation set (10), `inputs/it08/系统打开样例.md` |

All 44 paths are within the declared `writes`; no other path was introduced or modified by this merge.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-50-gate.md` — present at the merged revision (committed on the source branch at `73fad86`); sha256 `fe32efb2dbb441bbfe0bb0ca25df7712dfd2ae8c31916e4a2953c746ba3fc6f9` matches the pinned `gate_evidence_path_sha256` (verified before and at the merge commit).
- **Gate**: Release-readiness gate — STRICT; decision **PASS — integrate `task/wp-50-release` into `feat/v0.1.0`; proceed to the release Stage Gate evaluation, then `rm-final` guarded local merge to `main`.** Blockers B1 (A9) / B2 (A4) explicitly carried; public distribution BLOCKED pending A9.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `e1b84598…`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` untouched.
- The final package verification evidence, release-readiness assessment, deployment/rollback plan, wp-50 gate record, and release reports are now integrated on the integration branch; the merge is a pure union of the source tree.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to the **orchestrator release Stage Gate** (STRICT) over the integrated release artifacts, then `rm-final` per the wp-50 gate decision. `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
