# Merge Evidence — rm-17-merge-wp17: `task/wp-17-pipeline` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-17-merge-wp17.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `0af74e3cacc27719bb5fc4e6ba56970f9befb857` (matches pinned `base_commit`)
- **Source branch**: `task/wp-17-pipeline`
- **Source tip merged**: `2c8fbed4241f247c35749f29f31ae0bd76b25b56` (matches pinned `source_commit`)
- **Source commits (2)**: `536bfc8` (`feat(document): add markdown pipeline, transforms and react mapping`), `2c8fbed` (`docs(gate): record wp-17 pipeline gate evidence`)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place and is not tracked or merged.
- No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`0af74e3`), so the source branch was strictly ahead; the `--no-ff` merge still produced one merge commit over 2 source commits.
- Recovery snapshot ref `refs/swe/snapshots/20261006T230441Z-rm-17-merge-wp17-314fedda` at `f5cd6992de7c5a35f17b36777a5326e09dc32713` (covers the handoff `snapshot_paths`: `package.json`, `pnpm-lock.yaml`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Merge

- **Merge commit**: `a512d89f5d582d643357c5259b69480998279f62`
- **Subject**: `feat(document): merge wp-17 pipeline into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`0af74e3cacc27719bb5fc4e6ba56970f9befb857` + `2c8fbed4241f247c35749f29f31ae0bd76b25b56`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (31 files, +4,599 / −1)

- **Pipeline core (15)**: `src/document/pipeline.ts` + `pipeline.test.ts`, `sanitize.ts`, `types.ts`, `hash.ts` + `hash.test.ts`, `annotate.ts` + `annotate.test.ts`, `source-map.ts` + `source-map.test.ts`, `engines.ts`, `map.tsx` + `map.test.tsx`, `BlockErrorBoundary.tsx`, `plugins/register.ts` (all new; ordered pipeline with sanitize before engine slots, schema per security-model §5.2, block wrappers with `data-block-id`/`src-start`/`src-end`, error isolation)
- **Transforms (8)**: `src/document/transforms/blocks.ts` + `blocks.test.ts`, `html-text.ts`, `index.ts`, `outline.ts` + `outline.test.ts`, `segments.ts` + `segments.test.ts` (all new; block fingerprints `fp1:`, unique anchors with CJK fallback, search segments + source maps)
- **Worker (4)**: `src/document/worker/client.ts`, `parse.worker.ts`, `protocol.ts` + `protocol.test.ts` (all new; worker protocol, main-thread fallback equivalence, cancellation)
- **Artifacts (2)**: `artifacts/00-repository/gates/wp-17-gate.md` (new, 31), `artifacts/60-implementation/wp-17-pipeline.md` (new, 182)
- Modified paths (2): `package.json` (+13/−1; new deps for pipeline/transforms/mapping), `pnpm-lock.yaml` (+1,009); all remaining 29 paths added.
- No changes outside the declared `writes` scope (`src/document/`, `package.json`, `pnpm-lock.yaml`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-17-gate.md` — present at merged revision; sha256 `46fa192f4ee7c61672443f7a5746f8e8c964bd4f6a937a071c856d60d29f0612` matches the pinned `gate_evidence_path_sha256`
- **Gate**: Component Quality Gate — STRICT (C-11 document pipeline); decision **PASS — integrate `task/wp-17-pipeline` into `feat/v0.1.0`. C-11 enters UNVERIFIED (integration pending)**
- **Evaluated revision**: source commit `536bfc8` (30 paths); the only later source commit is `2c8fbed`, which adds exactly the gate-evidence file. Merged content equals the evaluated revision plus that evidence — no post-gate drift.
- Recorded gate results: pipeline order/sanitize-before-engines verified by tests, schema per security-model §5.2; transform behavior PASS; worker protocol + fallback equivalence + cancellation PASS; rehype-react mapping + block wrappers + `BlockErrorBoundary` isolation PASS; 94 new tests (164 total) plus typecheck/lint/build clean; deps within list and lockfile committed.
- Carried to wp-19 (Change Impact): **D-3 (authorized)** bounded sanitize-schema extension for math/katex and engine code/mermaid allowances per rendering-pipeline §2.8, recorded as a bounded revision in wp-19 evidence. This record is integration evidence, not a Stage Gate approval.

## Resulting status

- `feat/v0.1.0` at merge commit `a512d89f5d582d643357c5259b69480998279f62`; working tree clean.
- wp-17 markdown pipeline, transforms, worker, and react mapping integrated into the integration branch; C-11 moves from gate-PASS to integration-pending verification (UNVERIFIED until integration checks on the merged revision).
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed with **wp-19+20: engines + reader assembly** on `feat/v0.1.0` per the consolidated plan, honoring the D-3 bounded sanitize-schema extension recorded in the wp-17 gate evidence. Repository-manager prepares the dedicated task branch/worktree for the next specialist handoff on request.
