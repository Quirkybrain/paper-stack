# Merge Evidence — rm-46-merge-wp46: `task/wp-46-itrerun` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-46-merge-wp46.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-46-itrerun`
- **Source tip merged**: `aa8eaf9ec1353d57108748a7454d4502748c2392` (matches pinned `source_commit`)
- **Source commits (2)**: `472b1c1` (`test(acceptance): verify it fixes and refresh evidence`), `aa8eaf9` (`docs(gate): record wp-46 it rerun gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache and `output/` packaging output exist on disk and were left in place, untracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b` (`docs(repo): record rm-45 merge evidence`) is an ancestor of the target tip; the source branched before the wp-47 work, and the target had advanced by 4 commits (`96a5e70` wp-47 fix, `a0ff764` wp-47 gate, `a86a20f` rm-47 merge, `fa424ef` rm-47 evidence). Source and target changes are path-disjoint, so the `--no-ff` merge was clean and produced one merge commit over the 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T204929Z-rm-46-merge-wp46-45ab23e7` at `be70c65fd2caba801d73a12c3683f46ce222f9d4`, parent `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e` (pre-merge target tip); resolves and covers the declared `snapshot_paths` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`, plus `state/handoffs/rm-46-merge-wp46.json`; 4849 coverage entries). Both modified predecessor files (`acceptance-it.md`, `acceptance-at.md`) are covered byte-for-byte and recoverable from the snapshot.
- Pre-merge collision check: all 115 incoming paths fall within the declared `writes` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`); 113 are added paths and 2 are modified paths whose pre-merge bytes are snapshot-covered, so no target file bytes are unrecoverable. A `git merge-tree` dry-run reported no conflicts and its computed tree `403c0b0d9125cd9064a12a2ee9062b733ecb9319` equals the actual merge tree.

## Merge

- **Merge commit**: `b8b6342b6aacebe28a23f689b97e721c01a31165`
- **Subject**: `test(acceptance): merge wp-46 it reruns into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1 HEAD`): `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e` (pre-merge target tip) + `aa8eaf9ec1353d57108748a7454d4502748c2392` (source tip), in that order.
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Actual merge tree `403c0b0d9125cd9064a12a2ee9062b733ecb9319` equals the `git merge-tree` dry-run tree — the ort merge was deterministic and introduced no manual resolution.
- Merge commit timestamp: `2026-10-08 04:51:08 +0800`.

## Merged paths (115 files changed, +795415 / -6; 113 added, 2 modified)

- **Acceptance/IT verification reports (updated)** — `artifacts/70-verification/acceptance-it.md` (Rev 2: D-IT-1/D-IT-2 closure re-runs) and `artifacts/70-verification/acceptance-at.md` (Rev 6: AT15/21/22/29 re-checks). These are the only two modified predecessors; their pre-merge bytes are snapshot-covered.
- **WP-46 re-run scripts** — `tests/desktop/run-itrerun.sh` (new, 420 lines), `tests/desktop/run-at-rerun-wp46.sh` (new, 309 lines, executable).
- **Evidence bundle** — `artifacts/70-verification/evidence/it-rerun/` (59 files: screenshots, clips, app logs, inputs incl. the 11 MiB IT07 corpus) and `artifacts/70-verification/evidence/at-rerun4/` (51 files: screenshots, clips, inputs incl. the 52 MiB source) — 110 new evidence files.
- **Gate record** — `artifacts/00-repository/gates/wp-46-gate.md` (new, 26 lines; arrives on the target via this merge).
- Merge scope falls within the declared `writes`; no other paths were introduced or modified.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-46-gate.md` — present at the merged revision; sha256 `a0745ec31b93bac90fe3861f69b74592381b375a8be9035814242238789c2537` matches the pinned `gate_evidence_path_sha256` (verified at HEAD after merge; file committed on the source branch `aa8eaf9`).
- **Gate**: Defect-closure verification — STRICT; decision **PASS — integrate `task/wp-46-itrerun` into `feat/v0.1.0`.** IT02 (D-IT-1 non-ASCII link) and IT03 (D-IT-2 replacement save) **closed**; IT07/AT29 (D-IT-3 large document) partial at this revision — parse/index fixed, mount/tail-navigation routed to wp-47 (closed in wp-48); AT15/21/22 re-checks PASS.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `b8b6342b6aacebe28a23f689b97e721c01a31165`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-46 post-fix IT/AT re-run scripts, the refreshed acceptance reports, both evidence trees, and the wp-46 gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **`rm-48`** merge (`task/wp-48-itrerun2` → `feat/v0.1.0`) with the documented history-union resolution, per the orchestrator plan. `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
