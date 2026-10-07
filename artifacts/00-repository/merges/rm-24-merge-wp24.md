# Merge Evidence — rm-24-merge-wp24: `task/wp-24-nav` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-24-merge-wp24.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `f40ee4742689f127ffff218e2ab5b0da458dab4a` (matches pinned `base_commit`)
- **Source branch**: `task/wp-24-nav`
- **Source tip merged**: `7bf699d1324a6d86b05158b3fc3e2f400306b11c` (matches pinned `source_commit`)
- **Source commits (2)**: `824f9f5` (`feat(reader): add welcome, navigation, source and inspect views`, 45 files, +5557/−135), `7bf699d` (`docs(gate): record wp-24 nav gate evidence`, 1 file, +31 — the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261007T004852Z-rm-24-merge-wp24-59423608` at `19aae9a02f1dc1d047ac938bbaea20a130e3b6ba` covers the handoff `snapshot_paths` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`) plus the frozen handoff, 164 covered paths; it preserves the original bytes of all 11 changed predecessors.
- Merge base equals the pre-merge target tip (`f40ee474`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `c71485b6753868d67e8f94044916cbe5c4130b51`
- **Subject**: `feat(reader): merge wp-24 navigation views into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`f40ee4742689f127ffff218e2ab5b0da458dab4a` + `7bf699d1324a6d86b05158b3fc3e2f400306b11c`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (46 files, +5588 / −135; 35 added, 11 modified)

- **Welcome (4, new)**: `src/features/reader/welcome/` — `WelcomePage.tsx` + test, `RecentList.tsx`, `format.ts`.
- **Navigation (12, new)**: `src/features/reader/nav/` — `NavPanel.tsx` + test, `FileTree.tsx` + test, `OutlineTree.tsx` + test, `outline-model.ts`, `tree-model.ts` + test, `nav-memory.ts` + test, `use-outline-tracking.ts`.
- **Source view (4, new)**: `src/features/reader/source/` — `SourceView.tsx` + test, `mapping.ts` + test.
- **Inspect drawers (9, new)**: `src/features/reader/inspect/` — `InspectDrawer.tsx`, `CodeBlock.tsx` + test, `FormulaPanel.tsx` + test, `MathBlock.tsx`, `block-context.ts`, `copy-feedback.ts`, `types.ts`.
- **Zoom overlay (2, new)**: `src/features/reader/zoom/ZoomOverlay.tsx` + test.
- **Reader integration (12; 1 new, 11 modified)**: modified `ReaderScreen.tsx` + test, `use-reader.ts`, `reader-state.ts`, `toolbar/ReaderToolbar.tsx`, `body/DocumentView.tsx`, `body/ImageBlock.tsx`, `body/MermaidBlock.tsx`, `reader.css`, plus `src/App.test.tsx` and `src/styles/base.css` (W-1 skip-link fix) and new `src/styles/base-css.test.ts`; new `src/features/reader/ui-context.tsx`.
- **Artifacts (2, new)**: `artifacts/60-implementation/wp-24-nav.md` (implementation report), `artifacts/00-repository/gates/wp-24-gate.md` (gate evidence).
- All 46 merged paths are inside the declared `writes` scope (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); no path outside.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-24-gate.md` — present at merged revision; sha256 `93be27f244f70fc4ff9765a00a72492e9387c3134f3357e199c2fbcb5394073d` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: Component Quality Gate — STANDARD (C-13 nav/welcome, C-15 source/inspect; consolidation wp-24+wp-26 per GATE-WP-06 ruling); decision **PASS — integrate `task/wp-24-nav` into `feat/v0.1.0`. Proceed to wp-25 search/history.**
- **Evaluated revision**: source commit `824f9f5`; the only later source commit is `7bf699d`, which adds exactly the gate-evidence file — no post-gate code drift.
- **Deferred (recorded in gate)**: recents persistence wp-27, outline history stack wp-25, inspect `sourceChanged` wp-29, >50MiB segmented paging wp-28, W-3 asset allowed-path UNVERIFIED, W-1 real-window retest wp-34.

## Resulting status

- `feat/v0.1.0` at merge commit `c71485b6753868d67e8f94044916cbe5c4130b51`, followed by this evidence commit; working tree clean.
- wp-24 welcome/navigation/source/inspect/zoom views and their recorded gate evidence are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to wp-25 search/history (per gate decision); repository-manager prepares the task branch/worktree and handoff on request.
