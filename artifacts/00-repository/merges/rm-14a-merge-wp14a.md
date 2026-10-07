# Merge Evidence — rm-14a-merge-wp14a: `task/wp-14a-assetfix` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-14a-merge-wp14a.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `b76541f6f41b5fdbf8831b84985de3e73397055c` (matches pinned `base_commit`)
- **Source branch**: `task/wp-14a-assetfix`
- **Source tip merged**: `fbb6c276dd4c19d230f1e8ef7b12841aa6ea9dde` (matches pinned `source_commit`)
- **Source commits (6)**: `4ba7980` (`fix(security): enable runtime-scoped asset protocol`), `8415cd7` (`build(deps): lock http-range for protocol-asset feature`), `80bcfff` (`fix(auth): apply authorization clear to registry and asset scope`), `d5c0667` (`build(deps): pin tokio features explicitly`), `f7cca0f` (`chore(cargo): declare msrv and disable publishing`), `fbb6c27` (`docs(gate): record wp-14a asset gate evidence`)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place and is not tracked or merged.
- No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`b76541f`), so the source branch was strictly ahead; the `--no-ff` merge still produced one merge commit over 6 source commits.

## Merge

- **Merge commit**: `cd3775ceda3fb7bd56ee24be9e476fea654d6c89`
- **Subject**: `fix(security): merge wp-14a asset protocol into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`b76541f6f41b5fdbf8831b84985de3e73397055c` + `fbb6c276dd4c19d230f1e8ef7b12841aa6ea9dde`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (18 files, +1,142 / −36)

- **Rust security services (4)**: `src-tauri/src/services/asset_scope.rs` (new, 573; runtime scope controller — allow on grant/forbid on revoke with single mapping point), `src-tauri/src/services/auth.rs` (M, +161/−8; authorization-clear now revokes registry + shrinks asset scope, per-item outcomes, remote cache purge), `src-tauri/src/services/mod.rs` (M, +3/−1), `src-tauri/src/services/resources.rs` (M, +17/−1)
- **Rust commands (6)**: `src-tauri/src/commands/auth.rs` (M, +7/−1), `files.rs` (M, +6/−2), `mod.rs` (M, +4/−5), `resources.rs` (M, +36/−12), `storage.rs` (M, +72/−0), `tree.rs` (M, +3/−1)
- **Runtime wiring (2)**: `src-tauri/src/state.rs` (M, +13/−1), `src-tauri/tauri.conf.json` (M, +4/−0; `protocol-asset` feature + `assetProtocol` scope)
- **Rust build (2)**: `src-tauri/Cargo.toml` (M, +12/−4; `protocol-asset` feature, pinned tokio features, MSRV 1.96, `publish = false`), `src-tauri/Cargo.lock` (M, +7/−0)
- **Artifacts (4)**: `artifacts/00-repository/gates/wp-14a-gate.md` (new, 33), `artifacts/60-implementation/wp-14a-assetfix.md` (new, 191; implementation evidence Rev 4), `artifacts/60-implementation/evidence/wp-14a-dev-smoke-app-window.png` (new, 13,172 B), `artifacts/60-implementation/evidence/wp-14a-dev-smoke-window-frame.png` (new, 15,344 B; dev-CSP HMR smoke screenshots)

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-14a-gate.md` — present at merged revision; sha256 `4a0177349a3ba3da8708f20c52187b463ccf7a6d40021e724b6d2bb239f0818e` matches the pinned `gate_evidence_path_sha256`
- **Gate**: Component Quality Gate — STRICT (security wiring; follow-up to GATE-WP-14); decision **PASS — M2 follow-up closed**
- **Evaluated revision**: source commits `4ba7980`..`f7cca0f` (5 commits, cumulative); the only later source commit is `fbb6c27`, which adds exactly the gate-evidence file. Merged code equals the evaluated revision — no post-gate drift.
- Recorded gate results: 248 tests passed / 0 failed; fmt/clippy clean; dev smoke on DISPLAY=:1 (window renders under devCsp, HMR WebSocket reachable). Accepted limitations carried: `asset://` byte-serving UNVERIFIED until wp-16 wiring; asset-scope forbidden patterns append-only per process; conditional remote-cache forbidden-check nuance. Process disclosure: cycles 1–3 blocked by orchestrator handoff scope defects (no product defect), resolved via documented `finish --failed` + re-pin flow. This record is integration evidence, not a Stage Gate approval.

## Resulting status

- `feat/v0.1.0` at merge commit `cd3775ceda3fb7bd56ee24be9e476fea654d6c89`; working tree clean.
- wp-14a asset-protocol enablement, authorization-clear wiring, and dependency hygiene integrated into the integration branch; M2 follow-up closed on `feat/v0.1.0` (M2 Stage Gate verification remains separately orchestrator-owned).
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **M3: wp-16 TS shell** (`task/wp-16-shell`, T-21..T-26) per `artifacts/50-plan/implementation-plan.md` §4.2: TS service facade + `PaperStackError` normalization, global store/session reducer with `TaskToken` rules, event bridge, design tokens/theme, component library with focus management, and i18n runtime. Repository-manager prepares the dedicated task branch/worktree for the specialist handoff on request.
