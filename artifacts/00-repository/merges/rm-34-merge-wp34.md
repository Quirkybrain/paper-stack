# Merge Evidence — rm-34-merge-wp34: `task/wp-34-desktop-at` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-34-merge-wp34.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `613b4658c63e112c40b6ce171771e6b31732c75f` (matches pinned `base_commit`)
- **Source branch**: `task/wp-34-desktop-at`
- **Source tip merged**: `88907d33af5d7dba9928f79f4ea9eb043e244163` (matches pinned `source_commit`)
- **Source commits (2)**: `6ea6495` (`test(acceptance): run desktop at scenarios and fix parity vector shell` — AT01–AT30 evidence run at accepted revision `6ea6495`, desktop tooling extensions, parity-vector cleanup), `88907d3` (`docs(gate): record wp-34 acceptance gate evidence` — the gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`613b4658`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T111720Z-rm-34-merge-wp34-4a3f2b6d` at `7c09c5b13705c71b7275c5aa6e22835b71e3f994` covers the handoff `snapshot_paths` at the pre-merge tip (`tests/desktop/` 6, `tests/contracts/` 10, `artifacts/70-verification/` 145, `artifacts/00-repository/` 55; 599 files present); ref present and resolves.

## Merge

- **Merge commit**: `bc4b1db97d95c4ac2a3868b82e15ba0ad0886cf5`
- **Subject**: `test(acceptance): merge wp-34 desktop at evidence into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`613b4658c63e112c40b6ce171771e6b31732c75f` + `88907d33af5d7dba9928f79f4ea9eb043e244163`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff bc4b1db9 88907d33` empty, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 19:17:28 +0800`.

## Merged paths (397 files, +8003 / −31; 394 added, 3 modified)

- **Desktop acceptance tooling (17 files)**: `tests/desktop/acceptance-lib.sh`, `tests/desktop/find-gtk-accept.py`, `tests/desktop/run-at-a.sh` … `run-at-e.sh`, `run-at-fix1.sh` … `run-at-fix8.sh` (new); `tests/desktop/xdo-helper.c` (modified — tooling extension).
- **Parity-vector cleanup (2 files, modified)**: `tests/contracts/search-parity.test.ts`, `tests/contracts/vectors/search-parity.json` — resolved divergence shell removed (per wp-34 gate).
- **Verification evidence (377 files)**: `artifacts/70-verification/acceptance-at.md` (report; **22 PASS / 8 FAIL**) and `artifacts/70-verification/evidence/at/` (319 PNGs, 32 txt, 18 log, 7 sha256, `app-binary.sha256`, `app.log`, `build.log`, `runs.log`, socket/DB snapshots).
- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-34-gate.md`.
- All 397 merged paths are inside the declared `writes` scope (`tests/desktop/`, `tests/contracts/`, `artifacts/70-verification/`, `artifacts/00-repository/`); scope check returned 0 outside paths.
- Large acceptance evidence tree (`≈319 PNGs + logs`) is force-added artifact evidence by convention; **no generated big corpora** under `artifacts/70-verification/evidence/generated/` were merged (0 such paths).
- **Note — evidence-only acceptance branch**: `task/wp-34-desktop-at` contains tooling, evidence, and parity-vector cleanup only; **no product-code changes**. The gate routed **8 failed AT items (AT06, AT07, AT14/15, AT19, AT26, AT28, AT30; gate table rows 1–7)** as blocking defects to `wp-34a-fixes` (implementation-engineer), followed by `wp-34b-atrerun` (test-engineer) for re-run of affected AT items.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-34-gate.md` — present at merged revision; sha256 `cd8c94f0e9443b0a40baa506d0be1799153fc518ec8724249ba0c44380d04a72` matches the pinned `gate_evidence_path_sha256` (verified against the source-tip blob before merge; merge result content equals source tip).
- **Gate**: Acceptance evidence gate — STRICT (T-63); decision **ACCEPT EVIDENCE — integrate `task/wp-34-desktop-at`; dispatch `wp-34a-fixes` for defects 1–7, then `wp-34b-atrerun` to re-run affected AT items and refresh acceptance evidence.**
- **Evidence recorded in gate**: 22 PASS / 8 FAIL (UNVERIFIED sub-items listed per item in the report, not counted as PASS); confirmed fixes W-1, W-2 not reproduced, local-image allow path closed (EA-RUN W-3), panel overlay behavior consistent at 1.25 scale.

## Resulting status

- `feat/v0.1.0` at merge commit `bc4b1db97d95c4ac2a3868b82e15ba0ad0886cf5`, followed by this evidence commit; working tree clean; snapshot ref intact.
- The wp-34 desktop acceptance tooling, evidence tree, parity-vector cleanup, and the wp-34 gate file are integrated into the integration branch. Not pushed; `main` not touched.
- This record is evidence of integration, not a Stage Gate approval. The 8 routed defects remain open and block review/integration of the affected components until fixed and re-verified.

## Next action

- Dispatch **`wp-34a-fixes`** (implementation-engineer) for the routed defects (AT06, AT07, AT14/15, AT19, AT26, AT28, AT30), then **`wp-34b-atrerun`** (test-engineer) to re-run the affected AT items and refresh acceptance evidence.
