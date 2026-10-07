# Merge Evidence — rm-14-merge-wp14: `task/wp-14-commands` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-14-merge-wp14.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `8dc1d41346c345a77bf01bd732073ca9ce8bd456` (matches pinned `base_commit`)
- **Source branch**: `task/wp-14-commands`
- **Source tip merged**: `c9c28523327e684aba4638ebccddadb0d76b38d9` (matches pinned `source_commit`)
- **Source commits**: `a5887c662396124111d3c256ce81592fb7e2c7a6` (`feat(commands): register ipc surface with minimal capabilities and csp`), `c9c2852` (`docs(gate): record wp-14 commands gate evidence`)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place and is not tracked or merged.
- No remote configured (local-only repository); no fetch required.

## Merge

- **Merge commit**: `7d74c3993716c296822ed7e75cee5952c90293ca`
- **Subject**: `feat(commands): merge wp-14 ipc surface into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`8dc1d41` + `c9c28523`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (24 files, +4,332 / −69)

- **Commands module — new (9 files)**: `src-tauri/src/commands/mod.rs` (204; single-source 38-command registration macro, contract order/module mapping), `app.rs` (89), `auth.rs` (218), `diagnostics.rs` (94), `files.rs` (264), `resources.rs` (126), `storage.rs` (256), `tree.rs` (47), `watch.rs` (93)
- **Services (7 files)**: `src-tauri/src/services/diagnostics.rs` (1146, new; rolling 10MiB log, redaction, preview/export validation), `info.rs` (216, new), `auth.rs` (M, +85/−19), `files.rs` (M, +6), `mod.rs` (M, +3/−1), `storage.rs` (M, +45/−41), `watch.rs` (M, +4)
- **Runtime wiring (4 files)**: `src-tauri/src/state.rs` (237, new), `src-tauri/src/lib.rs` (M, +31/−5), `src-tauri/src/error.rs` (M, +19), `src-tauri/capabilities/default.json` (M, +7/−2; minimal capabilities), `src-tauri/tauri.conf.json` (M, +3/−1; production CSP per security-model §6)
- **Rust tests (1 file)**: `src-tauri/tests/commands_surface.rs` (906)
- **Artifacts (2 files)**: `artifacts/60-implementation/wp-14-commands.md` (199 lines, implementation evidence), `artifacts/00-repository/gates/wp-14-gate.md` (34 lines, gate evidence)

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-14-gate.md` — present at merged revision; sha256 `b36a3870222288a15c35cfacfb48204bc08ba72602341ec75c782f30892bc196` matches the pinned `gate_evidence_path_sha256`
- **Gate**: Component Quality Gate — STRICT for C-08 (diagnostics/info) and C-09 (command surface), consolidation wp-14+wp-15 per GATE-WP-06 ruling; includes the **IP-1 (M2 exit)** review; decision PASS (VALID with one scoped follow-up)
- **Evaluated revision**: source commit `a5887c6` (23 paths); the only later source commit is `c9c2852`, which adds exactly the gate-evidence file. Merged code equals the evaluated revision — no post-gate drift.
- Recorded gate results: 38/38 commands registered from a single macro source (drift-proof); 237 tests passed / 0 failed; fmt/clippy/build clean; real runtime smoke on DISPLAY=:1 (window "纸栈 PaperStack" 1280×800, SQLite migrated, redacted log written). C-08/C-09 enter UNVERIFIED (integration pending). This record is integration evidence, not an integration verification or Stage Gate approval.
- **Follow-up carried with the gate**: asset-protocol enablement (`tauri = { features = ["protocol-asset"] }` + `security.assetProtocol` scope, plus dev-CSP HMR smoke) scoped out and dispatched as `wp-14a-assetfix` before M3 image wiring.

## Resulting status

- `feat/v0.1.0` at merge commit `7d74c3993716c296822ed7e75cee5952c90293ca`; working tree clean.
- wp-14 diagnostics/info services and the 38-command IPC surface (T-18..T-20) integrated into the integration branch. M2 foundation milestone reached pending the scoped `wp-14a-assetfix` follow-up and integration/Stage Gate verification.

## Next action

- Run **wp-14a-assetfix** (asset-protocol feature + scope + dev-CSP smoke) as the recorded M2 close-out; after it passes, run integration/regression checks and the M2 Stage Gate for `feat/v0.1.0` before M3. Task selection, grouping, and sequence are orchestrator-consolidated. Repository-manager prepares the next `task/...` branch and worktree on request.
