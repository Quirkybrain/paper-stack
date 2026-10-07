# Merge Evidence — rm-19a-merge-wp19a: `task/wp-19a-workerfix` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-19a-merge-wp19a.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `511958d9629b249cb2bf30db545a25008f0b04f6` (matches pinned `base_commit`)
- **Source branch**: `task/wp-19a-workerfix`
- **Source tip merged**: `a13fc9e08506bd720e5ff308f30ce3303af5f52e` (matches pinned `source_commit`)
- **Source commits (2)**: `a34ef35` (`fix(document): build parse worker with worker export conditions`, 7 files, +428/−16), `a13fc9e` (`docs(gate): record wp-19a worker fix gate evidence`, 1 file, the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json`, `config/git-policy.default.md`, `state/handoffs/wp-00-start.request.md` sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261006T235108Z-rm-19a-merge-wp19a-713348ce` at `cd1a8aa6f15e205fe766786dcc6c2aea5ed0a5e8` (covers the handoff `snapshot_paths`: `vite.config.ts`, `src/document/`, `artifacts/60-implementation/`, `artifacts/00-repository/`).
- Merge base equals the pre-merge target tip (`511958d`), so the source branch was strictly ahead; the `--no-ff` merge still produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `dc52d6940bfa6eb1c177537f64305f0492a70e8b`
- **Subject**: `fix(document): merge wp-19a worker conditions into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`511958d9629b249cb2bf30db545a25008f0b04f6` + `a13fc9e08506bd720e5ff308f30ce3303af5f52e`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (8 files, +453 / −16)

- **Build config (1)**: `vite.config.ts` (+53/−1; worker `resolve.conditions` fix — DOM-free entries for `decode-named-character-reference` + `hast-util-from-html-isomorphic` on the worker path)
- **Worker (3)**: `src/document/worker/client.ts` (+13/−6; permanent blacklist removed, per-parse fallback + terminate/rebuild), `src/document/worker/protocol.test.ts` (+35/−9; extended protocol coverage), `src/document/worker/smoke.worker-build.mjs` (new, 152; Node no-DOM worker-build smoke)
- **Artifacts (4)**: `artifacts/00-repository/gates/wp-19a-gate.md` (new, 25), `artifacts/60-implementation/wp-19a-workerfix.md` (new, 175), `artifacts/60-implementation/evidence/wp-19a-smoke.png`, `wp-19a-smoke-second-tab.png` (new; real X11 smoke screenshots)
- 5 paths added, 3 modified; no changes outside the declared `writes` scope (`vite.config.ts`, `src/document/`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-19a-gate.md` — present at merged revision; sha256 `15199c6f32cbf6809f674096075910c55b6c238c24770bd5fdcdf8c100150417` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: Component Quality Gate — STANDARD (build-configuration fix within C-11); decision **PASS — integrate `task/wp-19a-workerfix` into `feat/v0.1.0`. Proceed to EA-RUN milestone (wp-21+22+23).**
- **Evaluated revision**: source commit `a34ef35`; the only later source commit is `a13fc9e`, which adds exactly the gate-evidence file — no post-gate code drift.
- Recorded gate results: worker bundles resolve DOM-free entries (second entry newly found) with main bundle unaffected PASS; per-parse fallback + terminate/rebuild per rendering-pipeline §6 PASS; chunk inspection 0 DOM-entry references on parse path with baseline negative control PASS; Node no-DOM round-trip smoke `status=ok blocks=6 segments=8 diagnostics=0` PASS; 218 tests + typecheck/lint/build + real X11 app smoke with screenshots PASS. Honest limit accepted: `usedWorker:true` in-webview not directly observable yet (diagnostics UI lands wp-26); worker proof = chunk + Node smoke.

## Resulting status

- `feat/v0.1.0` at merge commit `dc52d6940bfa6eb1c177537f64305f0492a70e8b`; working tree clean.
- wp-19a worker export-condition fix integrated into the integration branch; C-11 worker path fix in place on the merged revision.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to the **EA-RUN milestone**: prepare the dedicated task branch/worktrees for **wp-21+22+23** (desktop tool), then fixed-condition screenshots and README v0; repository-manager prepares each next specialist handoff on request.
