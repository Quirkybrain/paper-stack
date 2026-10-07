# Merge Evidence — rm-19-merge-wp19: `task/wp-19-reader` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-19-merge-wp19.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `98678b2cbc538c27cc116cde77ac58d49afc1bc9` (matches pinned `base_commit`)
- **Source branch**: `task/wp-19-reader`
- **Source tip merged**: `fb0f9a6c77bd7f5c85327709f9673f41591c009f` (matches pinned `source_commit`)
- **Source commits (2)**: `d1a3c2f` (`feat(reader): add engine plugins and reader assembly`), `fb0f9a6` (`docs(gate): record wp-19 reader gate evidence`)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place and is not tracked or merged.
- No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`98678b2c`), so the source branch was strictly ahead; the `--no-ff` merge still produced one merge commit over 2 source commits.
- Recovery snapshot ref `refs/swe/snapshots/20261006T233637Z-rm-19-merge-wp19-d03bf0cb` at `2f4797d602603a8537d694af13eeeac75dcc10bf` (covers the handoff `snapshot_paths`: `src/`, `fixtures/`, `package.json`, `pnpm-lock.yaml`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Merge

- **Merge commit**: `331b4038676afcca43477986eec725461cbe7db1`
- **Subject**: `feat(reader): merge wp-19 reader assembly into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`98678b2cbc538c27cc116cde77ac58d49afc1bc9` + `fb0f9a6c77bd7f5c85327709f9673f41591c009f`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (40 files, +5,751 / −31)

- **Engine plugins (8)**: `src/document/plugins/katex.ts` + `katex.test.ts`, `mermaid.tsx` + `mermaid.test.ts`, `shiki.ts` + `shiki.test.ts` (all new), `register.ts` (modified; engine registration), `sanitize.ts` (modified; D-3 bounded schema delta: `code` className + `math-*` only)
- **Pipeline/worker touch-ups (5)**: `src/document/pipeline.ts`, `src/document/map.tsx`, `src/document/annotate.ts`, `src/document/worker/client.ts` (modified; plugin dispatch, mapping, annotation and worker client adjustments), `src/document/worker/protocol.test.ts` (modified, +35; protocol coverage extended)
- **Reader feature (15)**: `src/features/reader/ReaderScreen.tsx` + `ReaderScreen.test.tsx`, `reader-state.ts` + `reader-state.test.ts`, `use-reader.ts`, `reader.css`, `RootErrorBoundary.tsx`, `body/ContentBlock.tsx`, `body/DocumentView.tsx`, `body/ImageBlock.tsx`, `body/MathErrorBlock.tsx`, `body/MermaidBlock.tsx` + `MermaidBlock.test.tsx`, `tabs/TabBar.tsx`, `toolbar/ReaderToolbar.tsx` (all new; open→read→parse→progressive render, toolbar/tabs, error boundary)
- **App integration (4)**: `src/App.tsx` (modified), `src/main.tsx` (modified), `src/app/events.ts` + `src/app/events.test.ts` (new; T-23 partial event bridge)
- **Fixture (1)**: `fixtures/reader-min/reader-min.md` (new; minimal reader fixture)
- **Dependencies (2)**: `package.json` (+6/−1; engine deps), `pnpm-lock.yaml` (+1,150; lockfile)
- **Artifacts (5)**: `artifacts/00-repository/gates/wp-19-gate.md` (new, 34), `artifacts/60-implementation/wp-19-reader.md` (new, 195), `artifacts/60-implementation/evidence/wp-19-smoke.png`, `wp-19-smoke-blocks.png`, `wp-19-smoke-second-tab.png` (new; real X11 smoke screenshots)
- 29 paths added, 11 modified; no changes outside the declared `writes` scope (`src/`, `fixtures/`, `package.json`, `pnpm-lock.yaml`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-19-gate.md` — present at merged revision; sha256 `83a0f2e6f9cab33e4009db6568116bef454522f2eabf4ba25749c2775974c3dd` matches the pinned `gate_evidence_path_sha256`
- **Gate**: Component Quality Gate — STRICT (C-11 engines, C-12 reader; consolidation wp-19+wp-20 per GATE-WP-06); decision **PASS — integrate `task/wp-19-reader` into `feat/v0.1.0`. C-12 enters UNVERIFIED (integration pending); early-run milestone precursor achieved (first real reader render).**
- **Evaluated revision**: source commit `d1a3c2f` (39 paths); the only later source commit is `fb0f9a6`, which adds exactly the gate-evidence file (and the smoke-evidence report); merged content equals the evaluated revision plus gate/evidence files recorded by that commit — no post-gate code drift.
- Recorded gate results: KaTeX/Shiki/Mermaid engine verification PASS (per-node isolation, caps, D-3 bounded schema delta); reader open/render/tabs/toolbar/error-boundary PASS; T-23 partial event bridge PASS; 217 tests + typecheck/lint/build + `cargo build` PASS; real X11 smoke via `tauri build --debug --no-bundle` with visual confirmation PASS (screenshots at `artifacts/60-implementation/evidence/wp-19-smoke*.png`).
- Carried follow-up (bounded, dispatched as **wp-19a-workerfix**): Vite applies browser export conditions to Web Workers → worker startup crash → spec-compliant in-process fallback with permanent blacklist in use; proper fix is `resolve.conditions` incl. `worker` in `vite.config.ts` + verification the worker path is used. This record is integration evidence, not a Stage Gate approval.

## Resulting status

- `feat/v0.1.0` at merge commit `331b4038676afcca43477986eec725461cbe7db1`; working tree clean.
- wp-19 engine plugins + reader assembly integrated into the integration branch; C-11 engines and C-12 reader move from gate-PASS to integration-pending verification (UNVERIFIED until integration checks on the merged revision).
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed with **wp-19a-workerfix** follow-up (Vite worker `resolve.conditions` fix + worker-path verification) on `feat/v0.1.0` per the wp-19 gate follow-up; repository-manager prepares the dedicated task branch/worktree for the next specialist handoff on request.
