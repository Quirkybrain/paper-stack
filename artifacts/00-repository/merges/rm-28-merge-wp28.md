# Merge Evidence — rm-28-merge-wp28: `task/wp-28-update` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-28-merge-wp28.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `992096beb1fe192717ca1f007a25d5b2d4dda758` (matches pinned `base_commit`)
- **Source branch**: `task/wp-28-update`
- **Source tip merged**: `e02c72c99a856172211d843165af82a53dc13bb8` (matches pinned `source_commit`)
- **Source commits (2)**: `877d95d` (`feat(reader): add update, anchor and large-document flows`, 32 files, +3517/−102), `e02c72c` (`docs(gate): record wp-28 update gate evidence`, 1 file, +30 — the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261007T022044Z-rm-28-merge-wp28-3121b042` at `b5e172d05e100e8b9caca8dda44301791b46af25` covers the handoff `snapshot_paths` (`src/`, `fixtures/`, `artifacts/60-implementation/`, `artifacts/00-repository/`) plus the frozen handoff, 389 covered paths.
- Merge base equals the pre-merge target tip (`992096b`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `0fbb564511230646c965287913aecb1a74d75b77`
- **Subject**: `feat(reader): merge wp-28 update flows into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`992096beb1fe192717ca1f007a25d5b2d4dda758` + `e02c72c99a856172211d843165af82a53dc13bb8`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (33 files, +3547 / −102; 19 added, 14 modified)

- **Update flow (4, new)**: `src/features/reader/update/update-model.ts` + test, `UpdateBanner.tsx` + test (keep/follow/selection/inspect/background/later/merge matrix, paired result).
- **Position/anchors (2, new)**: `src/features/reader/position/position.ts` + test (anchors decision tree, ambiguity, throttle, suppression).
- **Large-document modes (2, new)**: `src/features/reader/largeDoc/LargeDocDialog.tsx` + test (R29/T-51/T-52 modes with honesty strings).
- **Document modes (2, new)**: `src/document/modes/modes.ts` + test.
- **View/resource invalidation (2, new)**: `src/features/reader/view/resource-invalidation.ts` + test (resource/close-during-task/remount parts).
- **Image block (1, new)**: `src/features/reader/body/ImageBlock.test.tsx`.
- **Fixtures (4, new)**: `fixtures/update/README.md`, `replacement-save.md`, `v1.md`, `v2.md` — all small markdown blobs (215–1670 bytes), no built binaries or other regenerable leftovers.
- **Reader integration (13, modified)**: `src/features/reader/ReaderScreen.tsx` + test, `use-reader.ts` (+770), `reader-state.ts` + test, `body/DocumentView.tsx`, `body/ImageBlock.tsx`, `toolbar/ReaderToolbar.tsx`, `ui-context.tsx`, `src/document/pipeline.ts` + test, `src/document/types.ts`, `src/components/Toast.tsx`, `src/features/search/search-integration.test.tsx`.
- **Artifacts (2, new)**: `artifacts/60-implementation/wp-28-update.md` (implementation report), `artifacts/00-repository/gates/wp-28-gate.md` (gate evidence).
- All 33 merged paths are inside the declared `writes` scope (`src/`, `fixtures/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); no path outside (scope check returned 0).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-28-gate.md` — present at merged revision; sha256 `4801376cd406a54733ec88524fcd43894db6844b3bab874d930b1a901f41dbfe` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: Component Quality Gate — STRICT (C-17 large-doc, C-12 update/position flows; consolidation wp-28+wp-29 per GATE-WP-06 ruling); decision **PASS — integrate `task/wp-28-update` into `feat/v0.1.0`. Proceed to wp-30+31 (entry integration + authorization dialogs).**
- **Evaluated revision**: source commit `877d95d`; the only later source commit is `e02c72c`, which adds exactly the gate-evidence file — no post-gate code drift.
- **Findings routed (recorded in gate)**: new rare `PrivacySection.test` flake under full-suite load routed to wp-32 test-execution for a repeat-run stability gate; `largeDoc.hardLimit` catalog-key vs source-window contradiction resolved in favor of R29 behavior, string review at wp-42.

## Resulting status

- `feat/v0.1.0` at merge commit `0fbb564511230646c965287913aecb1a74d75b77`, followed by this evidence commit; working tree clean.
- wp-28 update/anchor/large-document flows and their recorded gate evidence are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to wp-30+31 (entry integration + authorization dialogs) per gate decision; repository-manager prepares the task branch/worktree and handoff on request.
