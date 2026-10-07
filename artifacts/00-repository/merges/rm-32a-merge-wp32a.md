# Merge Evidence — rm-32a-merge-wp32a: `task/wp-32a-perf` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-32a-merge-wp32a.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `0e84c262db1bdcc74c063e280cb8811fc415cc62` (matches pinned `base_commit`)
- **Source branch**: `task/wp-32a-perf`
- **Source tip merged**: `e86b6a10293d6efc7aefb0ba3d497d5677b9ce43` (matches pinned `source_commit`)
- **Source commits (2)**: `836046adc84ac9595932bc03314d493d2942017c` (`perf(document): optimize offset mapping and align search folding` — 11 files, +550/−57: 10 source/test files plus the implementation report), `e86b6a1` (`docs(gate): record wp-32a perf fix gate evidence` — 1 file, the gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`0e84c262`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T102436Z-rm-32a-merge-wp32a-cf463dea` at `54f16291fd4c9e2d79806da43fc5291fd319f3be` covers the handoff `snapshot_paths` (`src/`, `tests/contracts/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); ref present and resolves.

## Merge

- **Merge commit**: `0fd3622725743f68657f175dea76c89f29ec70b2`
- **Subject**: `perf(document): merge wp-32a fixes into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`0e84c262db1bdcc74c063e280cb8811fc415cc62` + `e86b6a10293d6efc7aefb0ba3d497d5677b9ce43`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff 0fd36227 e86b6a10` empty, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 18:24:52 +0800`.

## Merged paths (12 files, +578 / −57; 2 added, 10 modified)

- **Document offset mapping (F-32-2/F-32-1, 4 files)**: `src/document/source-map.ts` (+132, new shared single-pass offset index), `src/document/source-map.test.ts` (+60, new), `src/document/pipeline.ts` (shared index wired in), `src/document/transforms/blocks.ts`.
- **Search folding/mapping (F-32-3/F-32-1, 4 files)**: `src/features/search/search-core.ts` (indexed query mapping + per-code-point `foldLower` alignment), `src/features/search/search-core.test.ts`, `src/features/search/SearchBar.tsx`, plus the fixed race in `src/features/settings/PrivacySection.test.tsx` (F-32-4).
- **Contract tests and vectors (2 files)**: `tests/contracts/search-parity.test.ts`, `tests/contracts/vectors/search-parity.json` (updated for the aligned fold rule).
- **Implementation evidence (1 file, new)**: `artifacts/60-implementation/wp-32a-perf.md` (before/after performance + fold-fuzz evidence).
- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-32a-gate.md`.
- All 12 merged paths are inside the declared `writes` scope (`src/`, `tests/contracts/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); scope check returned 0 outside paths.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-32a-gate.md` — present at merged revision; sha256 `b9a3975789df7c2f8a013b53e5a39612554b1fedef845bbc647aa9e55b838a12` matches the pinned `gate_evidence_path_sha256` (verified against the source-tip blob before merge; merge result content equals source tip).
- **Gate**: Defect-fix verification — STRICT (performance + contract parity); decision **PASS — integrate `task/wp-32a-perf` into `feat/v0.1.0`; dispatch the tiny `wp-32b` cleanup before independent reviews.**
- **Evidence recorded in gate**: F-32-2 parse p50 13,136 → 885.6 ms; F-32-3 dense query p50 10,946 → 18.03 ms; F-32-1 exhaustive 1.11M-code-point + 200k-context fuzz 0 divergence; F-32-4 stability matrix 48/48 and full suite ×5 = 508/508; regression 807 tests (frontend 508 + contracts 45 + cargo 254), typecheck/lint/build clean.

## Resulting status

- `feat/v0.1.0` at merge commit `0fd3622725743f68657f175dea76c89f29ec70b2`, followed by this evidence commit; working tree clean; snapshot ref intact.
- The four wp-32a defect fixes (F-32-1..4), their implementation report, contract-test updates, and the wp-32a gate file are integrated into the integration branch. Not yet pushed; `main` not touched.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Dispatch **wp-32b** (parity-test cleanup, pre-review): remove the obsolete divergence-kind expectations and resolved divergence shell (`queries: []`) from `src-tauri/tests/contract_search_parity.rs` and assert the shared Greek case on both sides; then proceed to independent reviews on `feat/v0.1.0`.
