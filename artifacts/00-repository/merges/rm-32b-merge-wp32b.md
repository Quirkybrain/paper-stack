# Merge Evidence — rm-32b-merge-wp32b: `task/wp-32b-parityclean` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-32b-merge-wp32b.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `87d89956be872703a4838879694f1402af9c76bb` (matches pinned `base_commit`)
- **Source branch**: `task/wp-32b-parityclean`
- **Source tip merged**: `4a2f427cd12a7c2510a1c2d7c82e3dcc273aa045` (matches pinned `source_commit`)
- **Source commits (2)**: `06534f07054f80874b9c7e017da2d5668582bef5` (`test(contracts): clean resolved search parity divergence shell` — parity-test cleanup + rustfmt normalization of the two wp-32 Rust test files), `4a2f427cd1` (`docs(gate): record wp-32b parity cleanup gate evidence` — the gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`87d89956`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T102903Z-rm-32b-merge-wp32b-57bfd6fd` at `0ce6a96049427e4e530343fb3a8a9cd81a99a0fa` covers the handoff `snapshot_paths` (`src-tauri/tests/`, `artifacts/60-implementation/`, `artifacts/00-repository/`; 96 files present); ref present and resolves.

## Merge

- **Merge commit**: `cffd373f976f012da0cbcbd92b4ac33dfb267087`
- **Subject**: `test(contracts): merge wp-32b cleanup into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`87d89956be872703a4838879694f1402af9c76bb` + `4a2f427cd12a7c2510a1c2d7c82e3dcc273aa045`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff cffd373f 4a2f427c` empty, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 18:29:15 +0800`.

## Merged paths (4 files, +102 / −22; 1 added, 3 modified)

- **Parity test cleanup (1 file)**: `src-tauri/tests/contract_search_parity.rs` — obsolete divergence-kind expectations and resolved divergence shell (`queries: []`) removed; Greek parity asserted via the normal `cases` path; error-taxonomy/UTF-16 checks intact (no weakened assertions).
- **Formatting-only fix (1 file)**: `src-tauri/tests/nf07_soak.rs` — rustfmt normalization of the unformatted wp-32 Rust test file (recorded deviation in the wp-32b gate file).
- **Implementation evidence (1 file)**: `artifacts/60-implementation/wp-32a-perf.md` (Rev 2, +12 lines; wp-32b cleanup recorded).
- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-32b-gate.md`.
- All 4 merged paths are inside the declared `writes` scope (`src-tauri/tests/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); scope check returned 0 outside paths.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-32b-gate.md` — present at merged revision; sha256 `438a0af5445721fde7054df4e0e1ce1277290a54b7e747489d6c1b5d8beaa2b9` matches the pinned `gate_evidence_path_sha256` (verified against the source-tip blob before merge; merge result content equals source tip).
- **Gate**: Cleanup verification — STANDARD (test hygiene); decision **PASS — integrate `task/wp-32b-parityclean` into `feat/v0.1.0`; proceed to independent reviews on the integration branch.**
- **Evidence recorded in gate**: divergence shell removed, Greek parity asserted via normal `cases` path, error-taxonomy/UTF-16 checks intact, no weakened assertions; unformatted wp-32 Rust test files found and rustfmt-normalized (deviation recorded in report + commit body); `cargo fmt/clippy/test` PASS (254 tests passed).

## Resulting status

- `feat/v0.1.0` at merge commit `cffd373f976f012da0cbcbd92b4ac33dfb267087`, followed by this evidence commit; working tree clean; snapshot ref intact.
- The wp-32b parity-test cleanup, formatting fix, implementation report update, and the wp-32b gate file are integrated into the integration branch. Not pushed; `main` not touched.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to the **wp-34 desktop acceptance** work package (AT01–AT30) on `feat/v0.1.0`.
