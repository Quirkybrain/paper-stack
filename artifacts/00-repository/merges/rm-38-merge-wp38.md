# Merge Evidence — rm-38-merge-wp38: `task/wp-38-desktop-rerun` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-38-merge-wp38.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `5d977ea40c0d6bea353412f3b83f1cd0ee1e9b56` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-38-desktop-rerun`
- **Source tip merged**: `a8b8a28496800e03deb67d5d0843320020d2de75` (matches pinned `source_commit`)
- **Source commits (2)**: `e56b383` (`test(acceptance): post-fix desktop re-run`), `a8b8a28` (`docs(gate): record wp-38 desktop rerun gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`5d977ea`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T150336Z-rm-38-merge-wp38-6c79879a` at `f55d9eb5d57a5610d96cb7705e9640378148e972`, parent `5d977ea40c0d6bea353412f3b83f1cd0ee1e9b56` (pre-merge target tip); resolves and covers all declared `snapshot_paths` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`). Relative to its parent it adds 883 files, 0 modifications/deletions: the untracked handoff, the ignored on-disk evidence corpus (881 files) and `tests/desktop/xdo-helper`; all pre-merge tracked target files remain byte-identical (snapshot parent tree = pre-merge tip tree).
- Pre-merge collision check: the 106 incoming added paths did not exist on disk (no untracked-overwrite risk); the single modified path `artifacts/70-verification/acceptance-at.md` was unmodified versus the pre-merge tip (`35e71f1c…`), so the merge cleanly updated it Rev 3 → Rev 4.

## Merge

- **Merge commit**: `b0c75c83296eb0cc13c9d5a179518fb1d45f02e1`
- **Subject**: `test(acceptance): merge wp-38 re-run evidence into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git log -1 --pretty='%P'`): `5d977ea40c0d6bea353412f3b83f1cd0ee1e9b56` (pre-merge target tip) + `a8b8a28496800e03deb67d5d0843320020d2de75` (source tip).
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet HEAD a8b8a28` clean; trees both `7e1639e04143c036e9f8615a1baee8322710f446`) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 23:04:53 +0800`.

## Merged paths (107 files, +5171 / −3; 106 added, 1 modified)

- **Acceptance evidence** — `artifacts/70-verification/evidence/at-rerun3/` (104 new files): 92 PNG screenshots (incl. 3 superseded under `superseded/`) covering the 10 re-run items AT02/06/09/12/14/15/16/25/27/30 plus 12 logs/metadata/input fixtures (`runs.log` 4046 lines, `build.log` 199 lines with `build.exit`, `unit-suite-r4.log`, `i18n-guard-r4.log`, `app-binary.sha256`, `app.log`, AT30 placeholder-scan text, 4 input documents).
- **Runner** — `tests/desktop/run-at-rerun-wp38.sh` (674 lines, mode `100755`) for the post-fix acceptance re-runs.
- **Gate record** — `artifacts/00-repository/gates/wp-38-gate.md` (24 lines, new).
- **Acceptance report** — `artifacts/70-verification/acceptance-at.md` (+77 / −3) — Rev 4 with the post-fix re-run results.
- Merge scope is exactly the declared `writes` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`); the full on-disk run corpus beyond the committed subset (caches, extra raw screenshots) was not added by the merge.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-38-gate.md` — present at the merged revision; sha256 `f3ad57221b1621c27bf4e3ec11bf8f15aeee7d761d7188c43a3366f6dbcce8a0` matches the pinned `gate_evidence_path_sha256` (verified pre-merge on the source tip and post-merge at the merge commit). The file was committed on the source branch (`a8b8a28`) and arrived on the target via this merge.
- **Gate**: Acceptance re-verification — STRICT; decision **PASS — integrate `task/wp-38-desktop-rerun` into `feat/v0.1.0`. Proceed to the combined focused re-review (wp-39).** Result: 10 affected items re-run on the fixed binary all PASS; overall 30/30 PASS (20 carried from Rev 3 + 10 refreshed); frontend suite 547 green; i18n guard + DSIH single-entry targeted checks 6/6.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `b0c75c83296eb0cc13c9d5a179518fb1d45f02e1`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-38 post-fix acceptance re-run (Rev 4 report, `at-rerun3/` evidence), its runner script, and its gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **wp-39 combined focused re-review** per the wp-38 gate decision.
