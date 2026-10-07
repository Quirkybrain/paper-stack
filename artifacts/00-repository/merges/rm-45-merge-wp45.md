# Merge Evidence — rm-45-merge-wp45: `task/wp-45-fix-it` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-45-merge-wp45.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `ade12444bc841dd0be63040ad3a8a6b87c2f39b3` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-45-fix-it`
- **Source tip merged**: `a4eab48803a6320fe05c9f9dfa77eada811ed41e` (matches pinned `source_commit`)
- **Source commits (2)**: `f8e4dae` (`fix(reader): resolve it acceptance defects`), `a4eab48` (`docs(gate): record wp-45 it fix gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache and `output/` packaging output exist on disk and were left in place, untracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`ade12444`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T185006Z-rm-45-merge-wp45-a3f0c5af` at `9d2d6f519951119a9e2e9e99e894d0a055d85d59`, parent `ade12444bc841dd0be63040ad3a8a6b87c2f39b3` (pre-merge target tip); resolves and covers the declared `snapshot_paths` (`src/`, `src-tauri/src/`, `src-tauri/tests/`, `artifacts/60-implementation/`, `artifacts/00-repository/`; 382 coverage entries). All 9 changed predecessor files are covered byte-for-byte and recoverable from the snapshot.
- Pre-merge collision check: all 13 incoming paths fall within the declared `writes`; 4 are added paths and 9 are modified paths whose pre-merge bytes are snapshot-covered, so no target file bytes are unrecoverable.

## Merge

- **Merge commit**: `3a141028dabd7c200ed0b4c9e38175ea330c9ddc`
- **Subject**: `fix(reader): merge wp-45 it fixes into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1 HEAD`): `ade12444bc841dd0be63040ad3a8a6b87c2f39b3` (pre-merge target tip) + `a4eab48803a6320fe05c9f9dfa77eada811ed41e` (source tip), in that order.
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet a4eab48… 3a14102` clean) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-08 02:50:32 +0800`.

## Merged paths (13 files changed, +1507 / -28; 4 added, 9 modified)

- **D-IT fix — reader/document (TypeScript)** — `src/document/simplified.ts` (new, 501 lines; linear fast path for >1 MiB UTF-16), `src/document/simplified.test.ts` (new, 275 lines; 13 tests incl. 11 MiB budget), `src/document/annotate.ts` (+55/-8; binary-search/bucketing, O(n²) anchor suffix map removed), `src/document/pipeline.ts` (+9), `src/document/transforms/outline.ts` (+13/-4), `src/features/reader/use-reader.ts` (+68/-2), `src/features/reader/ReaderScreen.tsx` (+28/-2), `src/features/reader/ReaderScreen.test.tsx` (+175/-8) — covers D-IT-1 (per-segment percent-decode in `resolveDocumentLink`) and D-IT-3 (large-doc fast path).
- **D-IT fix — watcher (Rust)** — `src-tauri/src/services/watch.rs` (+59/-3; settled `removed` only when path truly missing, rename-over → `modified`), `src-tauri/tests/watch_registry.rs` (+89/-1), `src-tauri/tests/watch_runtime.rs` (+71) — covers D-IT-2 and its regression tests.
- **Implementation report** — `artifacts/60-implementation/wp-45-fix-it.md` (new, 135 lines).
- **Gate record** — `artifacts/00-repository/gates/wp-45-gate.md` (new, 29 lines; arrives on the target via this merge).
- Merge scope falls within the declared `writes`; no other paths were introduced or modified.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-45-gate.md` — present at the merged revision; sha256 `650904bda5ca44b561de96318d9c32eed1df02214f5f0513f31099f29ad392b2` matches the pinned `gate_evidence_path_sha256` (verified at HEAD after merge; file committed on the source branch `a4eab48`).
- **Gate**: Defect-fix verification — STRICT; decision **PASS — integrate `task/wp-45-fix-it` into `feat/v0.1.0`.** All three routed IT defects have fixes with regression proof: D-IT-1 (non-ASCII link target percent-decode; 5 unit + 1 component test), D-IT-2 (rename-over replacement save bounce; Rust sequence/presence/runtime tests with real copy+rename, frontend tests), D-IT-3 (11 MiB simplified-mode parse >7 min never-completed → 1.67 s parse + 91 ms annotate; 2 MiB ~13 s → 269 ms; simplified 13 tests incl. 11 MiB budget). Suites: frontend 568 (+21), Rust 282 (+8), all static checks clean. Recorded limitations: fast path applies >1 MiB UTF-16 only, full (non-simplified) mode still superlinear (bounded fix recorded), IT-level rerun pending (wp-46).
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `3a141028dabd7c200ed0b4c9e38175ea330c9ddc`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-45 IT defect fixes (D-IT-1..3), their regression tests, the large-document fast path, the implementation report, and the wp-45 gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **`wp-46`** focused IT+AT re-runs on the integrated fixes; then documentation (C4/C6) and release readiness (C5). `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
