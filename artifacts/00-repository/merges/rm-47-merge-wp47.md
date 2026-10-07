# Merge Evidence — rm-47-merge-wp47: `task/wp-47-fix3` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-47-merge-wp47.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-47-fix3`
- **Source tip merged**: `a0ff764f90381a15315d9e886f45d1c3ee457139` (matches pinned `source_commit`)
- **Source commits (2)**: `96a5e70` (`fix(reader): window large simplified documents`), `a0ff764` (`docs(gate): record wp-47 simplified mount gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache and `output/` packaging output exist on disk and were left in place, untracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`cb79a827`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T202931Z-rm-47-merge-wp47-38416693` at `cdb630aa42c7df2ceb393cf86b5986e7178eb82e`, parent `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b` (pre-merge target tip); resolves and covers the declared `snapshot_paths` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`, plus `state/handoffs/rm-47-merge-wp47.json`; 514 coverage entries). All 6 modified predecessor files are covered byte-for-byte and recoverable from the snapshot.
- Pre-merge collision check: all 64 incoming paths fall within the declared `writes` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); 58 are added paths and 6 are modified paths whose pre-merge bytes are snapshot-covered, so no target file bytes are unrecoverable.

## Merge

- **Merge commit**: `a86a20f364bddda2981c816ec082bbe57a2e7804`
- **Subject**: `fix(reader): merge wp-47 windowed mount into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1 HEAD`): `cb79a827e3b6dd2736b490d6eb9b0e0a99cba77b` (pre-merge target tip) + `a0ff764f90381a15315d9e886f45d1c3ee457139` (source tip), in that order.
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet a0ff764… a86a20f…` clean) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-08 04:29:50 +0800`.

## Merged paths (64 files changed, +4596 / -29; 58 added, 6 modified)

- **WP-47 fix — reader/document (TypeScript)** — `src/features/reader/body/DocumentView.tsx` (+345/-4; bounded mount window 120→600, reveal-driven, scroll-anchored, no idle loop), `src/features/reader/ReaderScreen.tsx` (+74/-4), `src/document/annotate.ts` (+37/-8; O(1) excerpt resolver, `blockStart` support), `src/document/map.tsx` (+6) — mounts only a bounded block window for large simplified documents instead of all blocks.
- **Tests** — `src/features/reader/body/DocumentView.test.tsx` (new, 277 lines), `src/document/annotate.test.ts` (+26), `src/features/search/SearchBar.test.tsx` (+18).
- **Implementation report** — `artifacts/60-implementation/wp-47-fix3.md` (new, 132 lines).
- **Evidence bundle** — `artifacts/60-implementation/wp-47-fix3-evidence/` (55 files; before/after logs, CPU samples, verification screenshots, run scripts).
- **Gate record** — `artifacts/00-repository/gates/wp-47-gate.md` (new, 23 lines; arrives on the target via this merge).
- Merge scope falls within the declared `writes`; no other paths were introduced or modified.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-47-gate.md` — present at the merged revision; sha256 `e12ec375856180fc12812ec3f8bf4aeb6895dee8ee4af337b191f0a3a625bdac` matches the pinned `gate_evidence_path_sha256` (verified at HEAD after merge; file committed on the source branch `a0ff764`).
- **Gate**: Defect-fix verification — STRICT; decision **PASS — integrate `task/wp-47-fix3` into `feat/v0.1.0`. Dispatch wp-48 focused IT07/AT29 re-verify to close D-IT-3 at acceptance level.** On the real 11 MiB app: content ≤3 s, CPU last-20 s avg **0.00%** (pre-fix 114.7% avg, never idle), tail hit #132,139 navigates, copy 49 B exact, close 0.12 s (pre-fix 14.26 s SIGTERM). Frontend 588 tests (+20); typecheck/lint/build green.
- Gate evidence presence confirmed before `finish`; no Gate was waived. IT07/AT29 acceptance-level re-verification is explicitly deferred to wp-48 per the gate record.

## Resulting status

- `feat/v0.1.0` at merge commit `a86a20f364bddda2981c816ec082bbe57a2e7804`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-47 simplified-mode windowed mount, its regression tests, the implementation report, the evidence bundle, and the wp-47 gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **`wp-48`** focused IT07/AT29 re-verification on the integrated revision to close D-IT-3 at acceptance level. `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
