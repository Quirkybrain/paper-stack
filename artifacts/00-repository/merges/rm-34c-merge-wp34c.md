# Merge Evidence — rm-34c-merge-wp34c: `task/wp-34c-fixes` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-34c-merge-wp34c.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `a338980695442ea323af421d7aa4e5984705ee67` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-34c-fixes`
- **Source tip merged**: `08b119a98c37a2ad9ee5409760ce115e0358ef61` (matches pinned `source_commit`; `git rev-parse task/wp-34c-fixes`)
- **Source commits (2)**: `2e1b61d` (`fix(reader): resolve residual at19/26/28 defects` — product/test fixes for D-34b-1..3), `08b119a` (`docs(gate): record wp-34c fixes gate evidence` — gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`a338980`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T124517Z-rm-34c-merge-wp34c-116b06c6` at `a087f0cd1f42c613c6e10642f67491ba7d9b60b7`, parent `a338980695442ea323af421d7aa4e5984705ee67` (pre-merge target tip) plus the handoff file; all declared `snapshot_paths` bytes are recoverable at the parent revision; ref present and resolves.

## Merge

- **Merge commit**: `dba385a2db75befaf11bb407833fa53217b6a359`
- **Subject**: `fix(reader): merge wp-34c fixes into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`a338980695442ea323af421d7aa4e5984705ee67` + `08b119a98c37a2ad9ee5409760ce115e0358ef61`, `git rev-list --parents -n 1 HEAD`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff dba385a2 08b119a9` empty, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 20:45:26 +0800`.

## Merged paths (10 files, +431 / −14; 2 added, 8 modified)

- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-34c-gate.md`.
- **Fix report (1 file, new)**: `artifacts/60-implementation/wp-34c-fixes.md`.
- **Rust fix + contract test (2 files)**: `src-tauri/src/services/diagnostics.rs` (Rust `export_blocked(reason)` discriminator: `protected-source`/`target-exists`/`invalid-target`; details.reason + detail-key allowlist 6→7, 32-code taxonomy unchanged), `src-tauri/tests/commands_surface.rs`.
- **Frontend reader fix + tests (4 files)**: `src/features/reader/ReaderScreen.tsx` (+ `.test.tsx`), `src/features/reader/body/ImageBlock.tsx`, `src/features/reader/resources/resource-flow.test.tsx` (AT19 approx+blockId reveal guard; AT26 controlled remote-image fetch without `assetUrl`).
- **Settings dialog fix + tests (2 files)**: `src/features/settings/diagnostics/ExportPreviewDialog.tsx` (+ `.test.tsx`) (AT28 overwrite confirmation only on `target-exists`; unknown reason fail-safe as blocked).
- All 10 merged paths are inside the declared `writes` scope (`src/`, `src-tauri/src/`, `src-tauri/tests/`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-34c-gate.md` — present at merged revision; sha256 `dcf9f81c341102b7c4a1095b148eb8126397df09ec9adfa746eb996e842f37b0` matches the pinned `gate_evidence_path_sha256` (verified after merge; merge result content equals source tip).
- **Gate**: Defect-fix verification — STRICT; decision **PASS — integrate `task/wp-34c-fixes` into `feat/v0.1.0`. Dispatch wp-34d re-run (AT19/26/28 only).**
- **Evidence recorded in gate**: D-34b-1 (AT19 reveal any non-null blockId → scroll + `nav.return.approx`; ×2 tests failed pre-fix), D-34b-2 (AT26 allowed remote without `assetUrl` → session-granted fetch/cache/asset URL, failure localized + click-only retry; ×2 tests failed pre-fix), D-34b-3 (AT28 discriminator, dialog + Rust tests failed pre-fix); suites frontend 529 (+5), contracts 44, cargo 261, static checks clean — PASS.

## Resulting status

- `feat/v0.1.0` at merge commit `dba385a2db75befaf11bb407833fa53217b6a359`, followed by this evidence commit; working tree clean; snapshot ref intact.
- The wp-34c residual AT19/26/28 fixes, fix report, and gate evidence are integrated into the integration branch. Not pushed; `main` not touched.
- This record is evidence of integration, not a Stage Gate approval. Desktop re-verification (wp-34d) and independent review remain outstanding.

## Next action

- Dispatch **`wp-34d-rerun`** (test-engineer) to re-run **AT19/26/28 only** against this integration tip, followed by independent review.
