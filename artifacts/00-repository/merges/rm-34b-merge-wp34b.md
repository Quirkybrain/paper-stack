# Merge Evidence — rm-34b-merge-wp34b: `task/wp-34b-atrerun` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-34b-merge-wp34b.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `33dd600fdf12c3a90b80e4589b856e9e348b8bd6` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-34b-atrerun`
- **Source tip merged**: `ce67b5bd8f048535fc29ea4a94d68767f27b3342` (matches pinned `source_commit`; `git rev-parse task/wp-34b-atrerun`)
- **Source commits (2)**: `d9612f4` (`test(acceptance): re-run fixed at scenarios` — acceptance re-run scripts, refreshed report and evidence tree), `ce67b5b` (`docs(gate): record wp-34b re-run gate evidence` — gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`33dd600f`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T123536Z-rm-34b-merge-wp34b-7e020554` at `1d3e73f77be8b44c673d7e64865009005ed4ded7` covers the handoff `snapshot_paths` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`, plus `state/handoffs/rm-34b-merge-wp34b.json`) at the pre-merge tip `33dd600f` (parent of the snapshot commit; 102 files changed vs base); ref present and resolves.

## Merge

- **Merge commit**: `35fc5152126997f050c9f4807736dd3ff077dcda`
- **Subject**: `test(acceptance): merge wp-34b re-run evidence into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`33dd600fdf12c3a90b80e4589b856e9e348b8bd6` + `ce67b5bd8f048535fc29ea4a94d68767f27b3342`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff 35fc5152 ce67b5bd` empty, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 20:36:00 +0800`.

## Merged paths (97 files, +2124 / −6; 95 added, 2 modified)

- **Acceptance re-run scripts (7 files in `tests/desktop/`)**: `run-at-rerun1.sh`, `run-at-rerun1b.sh`, `run-at-rerun2.sh`, `run-at-rerun3.sh`, `run-at-rerun3b.sh`, `run-at-rerun4.sh` (new, executable) and `acceptance-lib.sh` (modified) — drivers for the fixed AT scenarios (AT05/06/07/14/15/17/19/26/28/30).
- **Acceptance report (1 file, modified)**: `artifacts/70-verification/acceptance-at.md` — refreshed Rev 2 report (27 PASS / 3 FAIL / 0 UNVERIFIED) with residual defect routing.
- **Re-run evidence tree (88 files in `artifacts/70-verification/evidence/at-rerun/`)**: 78 screenshots (PNG) plus 10 logs/manifests — `app-binary.sha256`, `app.log`, `build.log`, `runs.log`, `second-rerun3-latin1.log`, `at26-r2-sockets-{blocked,after}.txt` (+`.pids`), `at28-r2-caseA-server-log.txt`. Force-added artifact evidence by project convention; generated corpora were not committed outside this scope.
- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-34b-gate.md`.
- All 97 merged paths are inside the declared `writes` scope (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-34b-gate.md` — present at merged revision; sha256 `d28170aa13dbfd307a6faa676675de19e9e92593f6956b916d4c303aa123bb93` matches the pinned `gate_evidence_path_sha256` (verified against the source-tip blob before merge; merge result content equals source tip).
- **Gate**: Acceptance re-verification — STRICT (wp-34b re-run); decision **ACCEPT EVIDENCE — integrate `task/wp-34b-atrerun`. Dispatch `wp-34c-fixes` (implementation-engineer) for D-34b-1..3, then `wp-34d-rerun` (test-engineer) for AT19/26/28 only.**
- **Evidence recorded in gate**: Rev1 22 PASS / 8 FAIL → Rev2 27 PASS / 3 FAIL / 0 UNVERIFIED; fixed & verified AT06, AT07, AT14, AT15, AT30 (+regression spot-checks AT05/AT17 clean); 3 residual defects routed — D-34b-1 (AT19 approx+blockId consume guard), D-34b-2 (AT26 allowed image `assetUrl`/`fetch_remote_image` not invoked), D-34b-3 (AT28 protected-rejection misread as overwrite confirmation).

## Resulting status

- `feat/v0.1.0` at merge commit `35fc5152126997f050c9f4807736dd3ff077dcda`, followed by this evidence commit; working tree clean; snapshot ref intact.
- The wp-34b acceptance re-run scripts, refreshed Rev 2 report, evidence tree, and gate file are integrated into the integration branch. Not pushed; `main` not touched.
- This record is evidence of integration, not a Stage Gate approval. Residual defects D-34b-1..3 remain open and routed; independent review remains outstanding.

## Next action

- Dispatch **`wp-34c-fixes`** (implementation-engineer) for the routed residuals **D-34b-1..3** (AT19, AT26, AT28) on a fresh `task/` branch from this integration tip; then `wp-34d-rerun` (test-engineer) for AT19/26/28 only, followed by independent review.
