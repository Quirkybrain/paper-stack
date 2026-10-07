# Merge Evidence — rm-42-merge-wp42: `task/wp-42-atrefresh` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-42-merge-wp42.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `49f48baf336116a9ecc99545f6e02e11702c75b0` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-42-atrefresh`
- **Source tip merged**: `44d4b11f9a534d861928e01558ac5c123765152a` (matches pinned `source_commit`)
- **Source commits (2)**: `0753a9c` (`test(acceptance): refresh full at matrix on current tree`), `44d4b11` (`docs(gate): record wp-42 acceptance refresh gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache exists on disk and was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`49f48baf`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T162340Z-rm-42-merge-wp42-e3d9497d` at `91e2f62c85e34166d87179ba213bc3630eb17f1e`, parent `49f48baf336116a9ecc99545f6e02e11702c75b0` (pre-merge target tip); resolves and covers the declared `snapshot_paths` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`; 1714 coverage entries). Relative to its parent it adds 883 files: 881 untracked evidence files under `artifacts/70-verification/evidence/`, 1 untracked test script under `tests/desktop/`, plus the untracked handoff `state/handoffs/rm-42-merge-wp42.json`. The snapshot holds a byte-identical copy of the one modified predecessor, `artifacts/70-verification/acceptance-at.md` (sha256 `e096dad4…`, matching its pre-merge bytes).
- Pre-merge collision check: target tree clean and none of the 2135 incoming paths existed on it; no overwrite risk, no unrelated files touched.

## Merge

- **Merge commit**: `5696e77b99ed0c1e2110859ac22da0a215589027`
- **Subject**: `test(acceptance): merge wp-42 final at refresh into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1 HEAD`): `49f48baf336116a9ecc99545f6e02e11702c75b0` (pre-merge target tip) + `44d4b11f9a534d861928e01558ac5c123765152a` (source tip), in that order.
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet 44d4b11… 5696e77…` clean; trees both `e78bee86f4c3cdbe7efa23108ad1b64749e5a46a`) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-08 00:24:42 +0800`.

## Merged paths (2135 files changed, +403658 / -3; 2134 added, 1 modified)

- **Evidence tree** — `artifacts/70-verification/evidence/at-final/` (2130 new files): full acceptance-refresh evidence corpus (runtime caches, AT input fixtures, run/second-run logs, unit-suite logs, superseded artifacts), force-added by convention.
- **Test harness** — `tests/desktop/run-at-final.sh`, `tests/desktop/run-at-final-probes.sh`, `tests/desktop/run-at-final-probes2.sh` (3 new executable scripts, mode 100755): acceptance driver and probe harness for the final AT matrix.
- **Acceptance report (modified)** — `artifacts/70-verification/acceptance-at.md` (+101/-3): Rev 5 full acceptance refresh, all 30 AT items re-executed on one current binary.
- **Gate record** — `artifacts/00-repository/gates/wp-42-gate.md` (19 lines, new): wp-42 acceptance-refresh gate evidence.
- Merge scope falls within the declared `writes` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`); no other paths were introduced or modified. Generated corpora outside the declared evidence tree were not committed by this merge beyond what the task branch already tracked.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-42-gate.md` — present at the merged revision; sha256 `4c1f0d31ddf1f98f2cd672c4d78fa86af01350a7d41495a775a0266199c3dcf6` matches the pinned `gate_evidence_path_sha256` (verified on the source tip pre-merge; the file arrives on the target via this merge). The file was committed on the source branch (`44d4b11`).
- **Gate**: Acceptance freshness gate — STRICT; decision **PASS — integrate `task/wp-42-atrefresh` into `feat/v0.1.0`. Proceed to wp-43 packaging + legal (C2).** Result: 30 PASS / 0 FAIL / 0 overall UNVERIFIED on one current binary (Rev 5, tree `49f48ba`); condition C1 (sysver G-01) satisfied. First run under external load recorded 3 timeouts (kept verbatim); controlled retry 547/547 green, both logs committed.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `5696e77b99ed0c1e2110859ac22da0a215589027`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-42 acceptance refresh report, probe harness, evidence corpus, and gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **wp-43 packaging + legal** (condition C2 — release packaging and license/legal items) per the wp-41/wp-42 gate decisions. `main_merge_mode` is `review_request_when_remote`; with no remote configured, the Stage Gate and any main promotion remain owner-controlled.
