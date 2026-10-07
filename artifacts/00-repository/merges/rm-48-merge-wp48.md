# Merge Evidence — rm-48-merge-wp48: `task/wp-48-itrerun2` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-48-merge-wp48.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `46b8acd8aa99c0b706eccfdc49fb490b3fd4ef22` (`docs(repo): record rm-46 merge evidence`; matches pinned `base_commit`; verified clean pre-merge)
- **Source branch**: `task/wp-48-itrerun2`
- **Source tip merged**: `251f73de5e72d4b24478d860b7eaa83e5fb456df` (matches pinned `source_commit`)
- **Source commits (2)**: `0383a8a` (`test(acceptance): verify large-doc fixes`), `251f73d` (`docs(gate): record wp-48 large-doc verification gate evidence`).
- Merge base `fa424efdc132b7c86ff12be7557c2b2db5e2ea2e` (`docs(repo): record rm-47 merge evidence`); the source branched before the wp-46 re-run work and the target had advanced by 4 commits (`b8b6342` wp-46 merge, `aa8eaf9`/`472b1c1` wp-46 work, `46b8acd` rm-46 evidence). Both sides had updated the same two acceptance-report histories from the same base, so the merge conflicted exactly there (see Conflict resolution).
- Pre-merge tree clean (`git status --porcelain` empty); ignored `src-tauri/target/` and `output/` left in place, untracked and not merged. No remote configured (local-only repository); no fetch required. Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`).
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff; the task was begun by dispatch and re-verified with `assert-active` at the pinned base before the merge (input hashes, branch state, no staged changes, snapshot coverage).
- Recovery snapshot `refs/swe/snapshots/20261007T205219Z-rm-48-merge-wp48-a9f1981b` at `462c2607e25767bf032119f50f455a6369c67527`, covering the declared `snapshot_paths` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`), so both modified predecessor files (`acceptance-at.md`, `acceptance-it.md`) and every other pre-merge target byte are recoverable.
- Pre-merge collision check: all 79 incoming paths fall within the declared `writes` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`). `git merge-tree --write-tree --name-only` dry-run predicted conflicts on exactly `artifacts/70-verification/acceptance-at.md` and `artifacts/70-verification/acceptance-it.md`; the actual merge conflicted on exactly those two files and nothing else.

## Merge

- **Merge commit**: `cc6b5b514f74d11ec16a962ac4463c66b485f81b`
- **Subject**: `test(acceptance): merge wp-48 large-doc verification into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1`): `46b8acd8aa99c0b706eccfdc49fb490b3fd4ef22` (pre-merge target tip) + `251f73de5e72d4b24478d860b7eaa83e5fb456df` (source tip), in that order, matching the pinned `[target, source]` parent set.
- **Merge tree**: `984460f220898facd85ad7a3ea93738738bc9610`; commit timestamp `2026-10-08 04:55:53 +0800`.

## Conflict resolution (history union — orchestrator decision)

- **Conflict paths**: `artifacts/70-verification/acceptance-at.md`, `artifacts/70-verification/acceptance-it.md`. Both sides had independently inserted their new revision section at the top of the same history chain and refreshed the same header fields from the same base, so the conflicts were localized to the header block and the chain insertion point; the remaining 77 merged paths were clean.
- **Resolution (mandated history union, applied exactly)**:
  1. `task/wp-48-itrerun2`'s version taken as the base for each file (`git show task/wp-48-itrerun2:<path> > <path>`).
  2. From `task/wp-46-itrerun`, the **Revision 6** section (AT) was inserted between Rev 7 and Rev 5, and the **Revision 2** section (IT) between Rev 3 and the Rev 1 body — verbatim, at the chronologically coherent position in the newest-first chain. Full history is now present: AT Rev 1–7 with Rev 7 current; IT Rev 1–3 with Rev 3 current. The wp-46 `Task (Rev 6)` / `Task (Rev 2)` header index lines were carried over for header completeness (no other header fields rewritten).
  3. A short **Rev-merge note** blockquote was added at the top of each chain: both re-run lineages are recorded, wp-46's Rev 6/Rev 2 were performed on tree `cb79a82` (pre wp-47 display-layer change), wp-48's Rev 7/Rev 3 refreshed AT29/IT07 on the final tree (wp-47 fix integrated), and the latest available verdicts remain as recorded — no verdict content was altered.
- **Union verification (no content loss)**:
  - vs `task/wp-48-itrerun2`: AT `+54/−0`, IT `+57/−0` (pure insertions of note + inserted section + header index line; multiset check confirms zero source lines missing from the result).
  - vs `task/wp-46-itrerun`: the only wp-46 lines not carried into the result are the four superseded header metadata lines per file (`Revision: 6/2`, `Components`, `Last Verified`, `Scope`) — by design, since wp-48's later revision fields were taken as the base; all Revision 6 / Revision 2 section content is present.
  - Section bodies byte-compared: AT Rev 7 and Rev 6, IT Rev 3 and Rev 2 all **verbatim matches**; no conflict markers remain; `git diff --check` clean. In-section "修订号口径" notes were preserved verbatim as historical wp-48-baseline statements; the top Rev-merge note supplies the post-merge union context.
- **Union adjustment size**: +111 lines total vs the pre-resolution source content (+54 AT, +57 IT), 0 deletions.

## Merged paths (79 files changed, +2700 / −8 vs pre-merge target; 77 added, 2 modified)

- **Acceptance/IT verification reports (modified, union-resolved)** — `artifacts/70-verification/acceptance-at.md` (731 lines; Rev 1–7) and `artifacts/70-verification/acceptance-it.md` (334 lines; Rev 1–3). These are the only two modified predecessors; their pre-merge bytes are snapshot-covered.
- **WP-48 re-run scripts (new)** — `tests/desktop/run-at-rerun5-wp48.sh` (194 lines), `tests/desktop/run-itrerun2-wp48.sh` (343 lines), `tests/desktop/sample-cpu.py` (103 lines).
- **Evidence bundle (new)** — `artifacts/70-verification/evidence/at-rerun5/` (20 files: 13 PNGs, `runs.log`, `at29-r7-cpu.csv` + sampler output, close notes, clipboard/payload byte files, app log) and `artifacts/70-verification/evidence/it-rerun2/` (53 files: 36 PNGs incl. `superseded/`, `runs.log`, `it07-r3-cpu.csv`, clipboard/payload byte files, `build.log`, `unit-suite-wp48.log`).
- **Gate record (new)** — `artifacts/00-repository/gates/wp-48-gate.md`.
- Merge scope falls within the declared `writes`; no other paths were introduced or modified.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-48-gate.md` — present at the merged revision (committed on the source branch `251f73d`); sha256 `f2833c44264441fa1a2dda6936b02514461a00fa4c3824386e85fbe4e822191c` matches the pinned `gate_evidence_path_sha256` (verified at the merge commit).
- **Gate**: Defect-closure verification — STRICT; decision **PASS — integrate `task/wp-48-itrerun2` into `feat/v0.1.0` (merge with documented history-union conflict resolution vs wp-46's earlier revision sections).** IT07 and AT29 sub-items closed on binary `26c02d2d…`; regression suite 588 passed; observation O-48-1 (synthetic Return) recorded as non-blocking.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `cc6b5b514f74d11ec16a962ac4463c66b485f81b`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-48 large-document verification revision sections, re-run scripts, both evidence trees, and the wp-48 gate record are now integrated on the integration branch, with the full unioned revision history preserved.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **wp-49 documentation** (project-root README / documentation stage) per the orchestrator plan. `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
