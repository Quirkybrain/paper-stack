# Merge Evidence — rm-44-merge-wp44: `task/wp-44-it` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-44-merge-wp44.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `670deae50eb06233ca7fede2ccb5ea340f3ca861` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-44-it`
- **Source tip merged**: `a2b1119c64adecffcacd5a0bce3353a9cd75c9dd` (matches pinned `source_commit`)
- **Source commits (2)**: `f0242d1` (`test(acceptance): run it01-it08 on packaged build`), `a2b1119` (`docs(gate): record wp-44 it acceptance gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache and `output/` packaging output exist on disk and were left in place, untracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`670deae5`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T180854Z-rm-44-merge-wp44-77adced4` at `f6e5487a99f5a7139798c8248626b9a77c5d3136`, parent `670deae50eb06233ca7fede2ccb5ea340f3ca861` (pre-merge target tip); resolves and covers the declared `snapshot_paths` (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`; 4354 coverage entries).
- Pre-merge collision check: all 166 incoming paths fall within the declared `writes`; all were added paths (0 deletions), so no target file bytes required byte-coverage.

## Merge

- **Merge commit**: `a621a44b6a1ac5c96b470e3ce112428630794e06`
- **Subject**: `test(acceptance): merge wp-44 it acceptance into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1 HEAD`): `670deae50eb06233ca7fede2ccb5ea340f3ca861` (pre-merge target tip) + `a2b1119c64adecffcacd5a0bce3353a9cd75c9dd` (source tip), in that order.
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet a2b1119… HEAD` clean) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-08 02:09:11 +0800`.

## Merged paths (166 files changed, +477970 / -0; all added, none modified or deleted)

- **IT acceptance evidence** — 163 files under `artifacts/70-verification/evidence/it/`: `runs.log` (7069 lines), `it01`–`it08` screenshots and logs (~130 PNGs, clipboard/source/diff text captures, socket/cache/package listings), input fixtures (`inputs/it01/`–`inputs/it08/`, including CJK-named documents, `it07/corpus-11MiB.md` and `it07/corpus-2MiB.md`), `unit-suite-it.log`, and the packaged-run app data (`data/`, `cache-it05/`) captured during acceptance.
- **Acceptance report** — `artifacts/70-verification/acceptance-it.md` (204 lines, new).
- **IT runner** — `tests/desktop/run-it.sh` (975 lines, new; mode 100755).
- **Gate record** — `artifacts/00-repository/gates/wp-44-gate.md` (24 lines, new; arrives on the target via this merge).
- Merge scope falls within the declared `writes`; no other paths were introduced or modified.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-44-gate.md` — present at the merged revision; sha256 `84ba613feeb1c350680cb3e2c278fa38324912507e6644f3443100a6ac4526f6` matches the pinned `gate_evidence_path_sha256` (verified at HEAD after merge; file committed on the source branch `a2b1119`).
- **Gate**: IT acceptance gate — STRICT (condition C3); decision **ACCEPT EVIDENCE — integrate `task/wp-44-it`. Dispatch `wp-45-fix-it` (D-IT-1..3), then focused IT re-run (wp-46), then docs (C4/C6) and release readiness (C5).** Result: 8/8 IT PASS on the packaged build; 5 restrained sub-items UNVERIFIED (clean `dpkg -i`, Wayland, real IME, >10MiB tail-search/copy, 2MiB遮挡 copy bytes). Defects routed: D-IT-1 (non-ASCII link target → `PS_IO_NOT_FOUND`), D-IT-2 (rename-over replacement save bounce), D-IT-3 (11MiB simplified-mode parse >7 min, no completion).
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `a621a44b6a1ac5c96b470e3ce112428630794e06`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-44 IT acceptance runner, acceptance report, evidence corpus, and gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **`wp-45-fix-it`** for the routed defects **D-IT-1, D-IT-2, D-IT-3**, then focused IT re-run (`wp-46`), then docs (C4/C6) and release readiness (C5). `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
