# Merge Evidence — rm-25-merge-wp25: `task/wp-25-search` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-25-merge-wp25.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `6d0f9455bcf81daf4dc7adfe3ed02b533bc52854` (matches pinned `base_commit`)
- **Source branch**: `task/wp-25-search`
- **Source tip merged**: `413621d1789202a43e247aa7e39c3b43f89012af` (matches pinned `source_commit`)
- **Source commits (2)**: `8451dcb` (`feat(search): add in-page search and navigation history`, 19 files, +3574/−99), `413621d` (`docs(gate): record wp-25 search gate evidence`, 1 file, +28 — the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261007T010852Z-rm-25-merge-wp25-df41f3e5` at `f10980c35035737fcf272c0aae91a78b13577b74` covers the handoff `snapshot_paths` (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`) plus the frozen handoff, 200 covered paths; it preserves the original bytes of all 7 changed predecessors.
- Merge base equals the pre-merge target tip (`6d0f945`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `a0ca72d98b08cad2ca36af7812581ffb372679c3`
- **Subject**: `feat(search): merge wp-25 search into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`6d0f9455bcf81daf4dc7adfe3ed02b533bc52854` + `413621d1789202a43e247aa7e39c3b43f89012af`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (20 files, +3602 / −99; 13 added, 7 modified)

- **Search (8, new)**: `src/features/search/` — `search-core.ts` + test (literal substring hits across body segments/source, case folding), `use-search-session.ts` + test (per-tab session, IME gating, 150ms debounce, three states, stale-batch isolation), `SearchBar.tsx` + test (UI03), `search-integration.test.tsx`, `search.css`.
- **Navigation history (3, new)**: `src/features/reader/history/` — `history.ts` + test (per-tab back/forward stacks, 5 nav-point kinds, session merge, forward clearing, cap 100), `use-reader-history.ts`.
- **Reader integration (7, modified)**: `src/features/reader/ReaderScreen.tsx`, `body/DocumentView.tsx`, `inspect/CodeBlock.tsx`, `reader-state.ts`, `toolbar/ReaderToolbar.tsx`, `use-reader.ts`, and `src/document/map.tsx` (Ctrl+F, Alt+←/→, toolbar back/forward/find, `<mark>` highlight, cross-file in-tab navigation).
- **Artifacts (2, new)**: `artifacts/60-implementation/wp-25-search.md` (implementation report), `artifacts/00-repository/gates/wp-25-gate.md` (gate evidence).
- All 20 merged paths are inside the declared `writes` scope (`src/`, `artifacts/60-implementation/`, `artifacts/00-repository/`); no path outside.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-25-gate.md` — present at merged revision; sha256 `8f51dddd25c8828de6d1beeeeb16f8ae38b767699f4372304636bd30fd4122b2` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: Component Quality Gate — STRICT (C-14 search/history); decision **PASS — integrate `task/wp-25-search` into `feat/v0.1.0`. Proceed to wp-27 settings/privacy/about/diagnostics.**
- **Evaluated revision**: source commit `8451dcb`; the only later source commit is `413621d`, which adds exactly the gate-evidence file — no post-gate code drift.
- **Deferred (recorded in gate)**: missing-fragment explanation string has no frozen catalog key (position kept; routed to wp-27/wp-42 string review), approx-restore UI wp-29, `search_source` end-to-end wp-28, history cap 100 (P-01).

## Resulting status

- `feat/v0.1.0` at merge commit `a0ca72d98b08cad2ca36af7812581ffb372679c3`, followed by this evidence commit; working tree clean.
- wp-25 in-page search and per-tab navigation history and their recorded gate evidence are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to wp-27 settings/privacy/about/diagnostics (per gate decision); repository-manager prepares the task branch/worktree and handoff on request.
