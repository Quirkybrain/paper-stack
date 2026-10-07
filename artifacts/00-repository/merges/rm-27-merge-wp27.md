# Merge Evidence — rm-27-merge-wp27: `task/wp-27-settings` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-27-merge-wp27.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `adceeb57e235e170091c09b11e3c364c08505c34` (matches pinned `base_commit`)
- **Source branch**: `task/wp-27-settings`
- **Source tip merged**: `c46d300b08c95f1642ce4a4a331a8bea55752946` (matches pinned `source_commit`)
- **Source commits (2)**: `382959c` (`feat(settings): add settings, privacy, about and diagnostics ui`, 39 files, +4859/−208), `c46d300` (`docs(gate): record wp-27 settings gate evidence`, 1 file, +31 — the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261007T013411Z-rm-27-merge-wp27-e884ae93` at `f1eb6202546dbf3624e6ddce417b82fa634c28f1` covers the handoff `snapshot_paths` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`) plus the frozen handoff, 353 covered paths; it preserves the original bytes of all 5 changed predecessors.
- Merge base equals the pre-merge target tip (`adceeb57`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `3979eb026522cb44b0ac9a5c7f587da2cf8f2bed`
- **Subject**: `feat(settings): merge wp-27 settings into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`adceeb57e235e170091c09b11e3c364c08505c34` + `c46d300b08c95f1642ce4a4a331a8bea55752946`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (40 files, +4890 / −208; 35 added, 5 modified)

- **Settings core (18, new)**: `src/features/settings/` — `settings-context.tsx` + test (persistence, apply/revert, retry), `settings-model.ts`, `controls.tsx`, `SettingsDialog.tsx` + test (five categories, Ctrl+, modal focus), `TypographyPopover.tsx` + test (Aa bounds/last-valid/preview-without-jump), `settings.css`, `syntax-rerender.test.tsx`, `current-document.ts`.
- **Settings sections & shims (12, new)**: `sections/ReadingSection.tsx`, `sections/SyntaxSection.tsx`, `sections/AboutSection.tsx`, `sections/PrivacySection.tsx`, `sections/FileUpdateSection.tsx`, plus accepted declared-path shims `AboutSection.tsx`/`AboutSection.test.tsx` and `PrivacySection.tsx`/`PrivacySection.test.tsx` (canonical paths per ui-spec §2.3).
- **Privacy (3, new)**: `privacy-model.ts` (per-category counts, explicit selection, partial-failure honesty, suppression mirror of models §9), `dialogs/ClearDataDialog.tsx`, `about/LegalTextViewer.tsx` (About/Legal: version/owner/GPL, honest LICENSE-not-bundled state, `sourceEntryUrl` null + reason).
- **Diagnostics (6, new)**: `diagnostics/diagnostics-model.ts` + test (readable-reason-first, redaction), `diagnostics-context.tsx`, `diagnostics/DiagnosticsPanel.tsx` + test (redacted copy default), `diagnostics/ExportPreviewDialog.tsx` + test (export preview + protected-target rejection).
- **Write suppression (3, new)**: `src/app/write-suppression.ts` + test, `src/features/reader/write-suppression.test.tsx`.
- **Reader integration (5, modified)**: `src/features/reader/ReaderScreen.tsx`, `src/features/reader/toolbar/ReaderToolbar.tsx`, `src/features/reader/use-reader.ts`, `src/components/Button.tsx`, `src/test/setup.ts`.
- **Artifacts (2, new)**: `artifacts/60-implementation/wp-27-settings.md` (implementation report), `artifacts/00-repository/gates/wp-27-gate.md` (gate evidence).
- All 40 merged paths are inside the declared `writes` scope (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); no path outside.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-27-gate.md` — present at merged revision; sha256 `9f251d8225b8c3c78a91b1a66b27be53ca72f1159df6e155a3abcbe377d23d72` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: Component Quality Gate — STANDARD (C-16 settings/privacy/about/diagnostics); decision **PASS — integrate `task/wp-27-settings` into `feat/v0.1.0`. Proceed to wp-28+29 (large-doc modes + update/anchor/version flows).**
- **Evaluated revision**: source commit `382959c`; the only later source commit is `c46d300`, which adds exactly the gate-evidence file — no post-gate code drift.
- **Findings routed (recorded in gate)**: D-27-11 flaky `search-integration.test.tsx` (reproduced at pre-merge base, not introduced here) must be stabilized under test-execution task wp-32; declared-path shims accepted; inline-dollar/update-mode overrides are session states consumed by wp-29.

## Resulting status

- `feat/v0.1.0` at merge commit `3979eb026522cb44b0ac9a5c7f587da2cf8f2bed`, followed by this evidence commit; working tree clean.
- wp-27 settings/privacy/about/diagnostics UI, write suppression, and their recorded gate evidence are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to wp-28+29 (large-doc modes + update/anchor/version flows) per gate decision; repository-manager prepares the task branch/worktree and handoff on request.
