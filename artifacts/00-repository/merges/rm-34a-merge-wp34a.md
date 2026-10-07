# Merge Evidence — rm-34a-merge-wp34a: `task/wp-34a-fixes` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-34a-merge-wp34a.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `0d111a76c7ccf553e3faa7d44bec2cc89ab45a1c` (matches pinned `base_commit`)
- **Source branch**: `task/wp-34a-fixes`
- **Source tip merged**: `57b0b704384ed8ad49e57c31c3a6d7852ff176b3` (matches pinned `source_commit`)
- **Source commits (2)**: `1a7263a` (`fix(acceptance): resolve routed at defects` — implementation + regression tests for the 7 routed defect groups), `57b0b70` (`docs(gate): record wp-34a fixes gate evidence` — gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`0d111a76`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T114936Z-rm-34a-merge-wp34a-4e8ecdab` at `cc97ee3510b623b7b6de2bb55b2c1cf6aa10de75` covers the handoff `snapshot_paths` at the pre-merge tip (`src/` 205, `src-tauri/src/` 34, `src-tauri/tests/` 18, `artifacts/60-implementation/` 25, `artifacts/00-repository/` 57; 905 files present); ref present and resolves.

## Merge

- **Merge commit**: `adf805b2931714c9fc25d770dcc83c02087f51b5`
- **Subject**: `fix(acceptance): merge wp-34a fixes into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`0d111a76c7ccf553e3faa7d44bec2cc89ab45a1c` + `57b0b704384ed8ad49e57c31c3a6d7852ff176b3`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD 57b0b704` empty, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 19:49:58 +0800`.

## Merged paths (17 files, +1457 / −107; 2 added, 15 modified)

- **Frontend product code (4 files, modified)**: `src/features/reader/ReaderScreen.tsx`, `src/features/reader/use-reader.ts`, `src/features/settings/sections/AboutSection.tsx`, `src/locales/zh-CN.json` — defect fixes AT06/AT07/AT14/15/AT19/AT30.
- **Rust product code (5 files, modified)**: `src-tauri/src/commands/auth.rs`, `src-tauri/src/commands/diagnostics.rs`, `src-tauri/src/services/diagnostics.rs`, `src-tauri/src/services/files.rs`, `src-tauri/src/services/resources.rs` — AT26 origin-only remote policy, AT28 export protection, diagnostics/files support.
- **Regression tests (6 files, modified)**: `src/features/reader/ReaderScreen.test.tsx` (+488), `src/app/i18n.keys.test.ts`, `src/features/settings/AboutSection.test.tsx`; `src-tauri/tests/commands_surface.rs`, `src-tauri/tests/files_open.rs`, `src-tauri/tests/remote_policy.rs`.
- **Implementation evidence (1 file, new)**: `artifacts/60-implementation/wp-34a-fixes.md` (fix report).
- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-34a-gate.md`.
- All 17 merged paths are inside the declared `writes` scope (`src/`, `src-tauri/src/`, `src-tauri/tests/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); scope check returned 0 outside paths.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-34a-gate.md` — present at merged revision; sha256 `254f4e7d41f0ac6cc6b97dadea687f8b984ae5129231c93159971aa3ab337a51` matches the pinned `gate_evidence_path_sha256` (verified against the source-tip blob before merge; merge result content equals source tip).
- **Gate**: Defect-fix verification — STRICT (8 acceptance FAILs → 7 defect groups); decision **PASS — integrate `task/wp-34a-fixes` into `feat/v0.1.0`. Dispatch wp-34b acceptance re-run.**
- **Evidence recorded in gate**: all 7 defect groups fixed with regression tests (AT06 session restore, AT07 unavailable-source UI, AT14/15 fragment navigation, AT19 position restore, AT26 remote URL-with-path, AT28 export protection, AT30 About raw key); frontend 524 (+16), contracts 44, cargo 261 (+7); all static checks green; 2 interrupted-WIP items completed under the same frozen handoff; 2 i18n catalog deltas routed to wp-42 string review.

## Resulting status

- `feat/v0.1.0` at merge commit `adf805b2931714c9fc25d770dcc83c02087f51b5`, followed by this evidence commit; working tree clean; snapshot ref intact.
- The wp-34a defect fixes, regression tests, implementation report, and gate file are integrated into the integration branch. Not pushed; `main` not touched.
- This record is evidence of integration, not a Stage Gate approval. Desktop re-verification of the affected AT items and independent reviews remain outstanding.

## Next action

- Dispatch **`wp-34b`** (test-engineer) for the desktop acceptance re-run of the affected AT items (AT06, AT07, AT14/15, AT19, AT26, AT28, AT30) and refresh acceptance evidence; then independent reviews.
