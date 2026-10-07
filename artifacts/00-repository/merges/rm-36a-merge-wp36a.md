# Merge Evidence — rm-36a-merge-wp36a: `task/wp-36a-fix-frontend` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-36a-merge-wp36a.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `a4de1b25a194797bafabada2b425282dc654171d` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-36a-fix-frontend`
- **Source tip merged**: `8c7fa06dd863b0e4ca72b91d8a6c1da32068e2e1` (matches pinned `source_commit`)
- **Source commits (2)**: `04ef5a1` (`fix(reader): resolve review b findings`), `8c7fa06` (`docs(gate): record wp-36a frontend fix gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`a4de1b2`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T142512Z-rm-36a-merge-wp36a-40bc6d6a` at `ab8fd37f95ba7da93892abb2a2c6fb8bc14b92aa`, parent `a4de1b25a194797bafabada2b425282dc654171d` (pre-merge target tip); captures the pre-merge target tree across all declared `snapshot_paths` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/` — byte-identical to the pre-merge tip, `git diff --quiet` clean; 304 files under those roots) plus the untracked handoff `state/handoffs/rm-36a-merge-wp36a.json`. Ref present and resolves.

## Merge

- **Merge commit**: `21982046dfa051210c433760c72f7c8ad9196f9d`
- **Subject**: `fix(reader): merge wp-36a review b fixes into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -n 1`): `a4de1b25a194797bafabada2b425282dc654171d` (pre-merge target tip) + `8c7fa06dd863b0e4ca72b91d8a6c1da32068e2e1` (source tip).
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet HEAD 8c7fa06` clean, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 22:25:30 +0800`.

## Merged paths (25 files, +970 / −94; 6 added, 19 modified)

- **Artifacts (2 files)**: `artifacts/00-repository/gates/wp-36a-gate.md` (new gate record, 29 lines) and `artifacts/60-implementation/wp-36a-fix-frontend.md` (new implementation report, 105 lines).
- **`src/` product/UI/i18n (14 files)**: single trusted-HTML entry `SanitizedNode.tsx` (new) with `pipeline.ts`/`sanitize.ts`/`types.ts` rewiring; KaTeX/Mermaid plugin caps (`katex.ts`, `mermaid.tsx`); reader UI (`ReaderScreen.tsx`, `MermaidBlock.tsx`, `ReaderToolbar.tsx`, `use-reader.ts`, `reader.css`) and new `DocumentInfoPanel.tsx`; `FormulaPanel.tsx`; `locales/zh-CN.json` (+3 keys).
- **`src/` tests (9 files)**: new `DocumentInfoPanel.test.tsx` and `single-trusted-html-entry.test.ts` guard scan plus updates to `i18n.keys.test.ts`, `pipeline.test.ts`, `katex.test.ts`, `mermaid.test.ts`, `ReaderScreen.test.tsx`, `FormulaPanel.test.tsx`, `no-hardcoded-strings.test.ts` — the Review B B-01..B-10 checklist coverage.
- All 25 merged paths are inside the declared `writes` scope (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`).

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-36a-gate.md` — present at the merged revision; sha256 `da5711f5c254b00dbae29464e2d67bdf23b167c411f2ee82424ffb625a34c561` matches the pinned `gate_evidence_path_sha256` (verified post-merge; merge result content equals source tip). The file was committed on the source branch (`8c7fa06`) and arrived on the target via this merge.
- **Gate**: Review-correction gate — STRICT; decision **PASS — integrate `task/wp-36a-fix-frontend` into `feat/v0.1.0`**. Verification per checklist B-01..B-10 with suites frontend 547 (+18), contracts 44, Rust 274 PASS; doc-sync items routed to the architect note task; catalog deltas now +3 keys (381 total) recorded for wp-42 reconciliation.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `21982046dfa051210c433760c72f7c8ad9196f9d`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- Review B fix revision (B-01..B-10) and its gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Dispatch the architect note task **`wp-37-note`** (security-model §5.2 `a id` row sync; contract fold-wording A-06; degrade-UX statement A-05; catalog delta recording for wp-42).
- Then desktop re-runs plus the combined focused re-review per the gate decision.
