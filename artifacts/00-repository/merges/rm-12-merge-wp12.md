# Merge Evidence — rm-12-merge-wp12: `task/wp-12-watch` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-12-merge-wp12.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `543f78d1d5539a7aaefc494449e45858e4d1e2b8` (matches pinned `base_commit`)
- **Source branch**: `task/wp-12-watch`
- **Source tip merged**: `b87e598a708bfd0d941000085b6af58565cf4b31` (matches pinned `source_commit`)
- **Source commits**: `a0df54ed44713df8d8e7766c03088090fbfb8958` (`feat(watch): add watch, single-instance and remote resource services`), `b87e598` (`docs(gate): record wp-12 watch gate evidence`)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place and is not tracked or merged.
- No remote configured (local-only repository); no fetch required.

## Merge

- **Merge commit**: `b066dd7b1778d0feeb79b8d9f043a86712a07379`
- **Subject**: `feat(watch): merge wp-12 watch services into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`543f78d1` + `b87e598a`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state

## Merged paths (10 files, +3,411 / −2 lines)

- **Rust services (4)**: `src-tauri/src/services/watch.rs` (763; `WatchService` W1 quiet-window merge state machine, replacement-save detection, resource invalidation, unwatch cleanup, §7.5 focus-recheck helpers; `WatchRuntime` notify wiring; content-free payloads), `src-tauri/src/services/resources.rs` (835; HTTPS-only remote policy, resolved-address block matrix, ≤3-hop revalidation, size/time caps, no-retry, per-session cache with revoke/purge), `src-tauri/src/services/app.rs` (132; startup argv parsing, single-instance queue, `take_pending_open_requests` drain semantics), `src-tauri/src/services/mod.rs` (M, +8/−2)
- **Rust tests (4)**: `src-tauri/tests/watch_registry.rs` (629), `watch_runtime.rs` (66; real-notify smoke), `app_open_requests.rs` (116), `remote_policy.rs` (725)
- **Artifacts (2)**: `artifacts/60-implementation/wp-12-watch.md` (111 lines, implementation evidence), `artifacts/00-repository/gates/wp-12-gate.md` (28 lines, gate evidence)

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-12-gate.md` — present at merged revision; sha256 `8055de4e36393c7f55be5be37478f553fe689f4eb68ba7b02791d57210b8579e` matches the pinned `gate_evidence_path_sha256`
- **Gate**: Component Quality Gate — STRICT for C-06 (watch/events/single-instance) and C-07 (remote resources); decision PASS (VALID)
- **Evaluated revision**: source commit `a0df54e`; the only later source commit is `b87e598`, which adds exactly the gate-evidence file. Merged code equals the evaluated revision — no post-gate drift.
- Recorded gate results: 213 tests passed / 0 failed (52 new); fmt/clippy clean; real-notify wiring 10× stable; no new crates, no command surface. C-06/C-07 enter UNVERIFIED (integration pending). This record is integration evidence, not an integration verification or Stage Gate approval.

## Resulting status

- `feat/v0.1.0` at merge commit `b066dd7b1778d0feeb79b8d9f043a86712a07379`; working tree clean.
- wp-12 watch/single-instance/remote services (T-15..T-17) integrated into the integration branch.

## Next action

- Proceed to **wp-14+wp-15** (T-18/T-19 diagnostics & info, command surface) per the consolidated plan; task selection, grouping, and sequence are orchestrator-consolidated. Repository-manager prepares the next `task/...` branch and worktree on request.
