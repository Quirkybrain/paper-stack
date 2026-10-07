# Merge Evidence — rm-30-merge-wp30: `task/wp-30-entry` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-30-merge-wp30.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `b9bd0ab497c7630d6870f339623fff66758d5c1a` (matches pinned `base_commit`)
- **Source branch**: `task/wp-30-entry`
- **Source tip merged**: `3ebb2611f7b583aca9dd5f67b3a4f945e40b8bb0` (matches pinned `source_commit`)
- **Source commits (2)**: `fdd1fc4e` (`feat(reader): add entry integration and authorization dialogs`, 16 files, +2181/−80), `3ebb2611` (`docs(gate): record wp-30 entry gate evidence`, 1 file, +28 — the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261007T023638Z-rm-30-merge-wp30-aef2cb4c` at `6edf35f48f4550f754bb8da709c47149a5338f17` covers the handoff `snapshot_paths` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`) plus the frozen handoff, 409 covered paths.
- Merge base equals the pre-merge target tip (`b9bd0ab4`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `1ab02e5f55a05a37e1131fc4f92c9ea52eadac9b`
- **Subject**: `feat(reader): merge wp-30 entry integration into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`b9bd0ab497c7630d6870f339623fff66758d5c1a` + `3ebb2611f7b583aca9dd5f67b3a4f945e40b8bb0`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (17 files, +2209 / −80; 12 added, 5 modified)

- **Entry integration (2, new)**: `src/features/reader/open/entry.ts` + test (four entries dialog/dir/drag-drop/CLI+single-instance; batch order, first-success focus, duplicate reuse, cancel invariance, non-document rejection).
- **Resource authorization (5, new)**: `src/features/reader/resources/resource-auth.ts` + test, `ResourceAuthDialogs.tsx`, `RemoteImageDialog.tsx` + test, `resource-flow.test.tsx` (default zero-request, per-doc-session origin grants, explicit-only retry, redirect-blocked message, revoke unload+purge, doc-leave cancels).
- **Settings auth scope (2, new)**: `src/features/settings/dialogs/AuthScopeDialog.tsx` + test (one aggregate prompt per scope, normalized range+count, default-off persistence, Esc=block, denial no re-prompt).
- **Reader integration (5, modified)**: `src/features/reader/ReaderScreen.tsx` + test, `use-reader.ts` (+169/−80 combined), `body/ImageBlock.tsx`, `reader.css`.
- **Artifacts (2, new)**: `artifacts/60-implementation/wp-30-entry.md` (implementation report), `artifacts/00-repository/gates/wp-30-gate.md` (gate evidence).
- All 17 merged paths are inside the declared `writes` scope (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); no path outside (scope check returned 0).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-30-gate.md` — present at merged revision; sha256 `b614e9d589b0bafda45d6037d9b0f3287ea311df0fb9ef22118fc8de2b573043` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: Component Quality Gate — STRICT (C-12 entry, C-16/C-03 authorization UX; consolidation wp-30+wp-31 per GATE-WP-06 ruling); **IP-3 (M4 exit) assessment**; decision **PASS — integrate `task/wp-30-entry` into `feat/v0.1.0`. M4 complete; proceed to M5.**
- **Evaluated revision**: source commit `fdd1fc4e763a`; the only later source commit is `3ebb2611`, which adds exactly the gate-evidence file — no post-gate code drift.
- **Verification recorded in gate**: 499 frontend tests passed (44 new), typecheck/lint/build, two consecutive full runs; frontend never builds asset URLs (Rust remains sole authorization authority).

## Resulting status

- `feat/v0.1.0` at merge commit `1ab02e5f55a05a37e1131fc4f92c9ea52eadac9b`, followed by this evidence commit; working tree clean.
- wp-30 entry integration and authorization dialogs, together with their recorded gate evidence, are integrated into the integration branch; M4/IP-3 complete.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **M5: wp-32 test execution batch** per gate decision; repository-manager prepares the task branch/worktree and handoff on request.
