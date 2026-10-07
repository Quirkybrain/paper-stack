# Merge Evidence — rm-37-merge-wp37: `task/wp-37-note` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-37-merge-wp37.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `12ffa9ce14a1dd9a8ab0e2ddc890f816e84bb2f1` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-37-note`
- **Source tip merged**: `6de5807f9fdd853d6269c1faee8ace5d3a1f88cc` (matches pinned `source_commit`)
- **Source commits (2)**: `d936968` (`docs(architecture): sync fold wording and sanitize schema notes`), `6de5807` (`docs(gate): record wp-37 note gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`12ffa9ce`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T143207Z-rm-37-merge-wp37-b801c274` at `c0d967f44e6d223730f0933b61d78297e16ac715`, parent `12ffa9ce14a1dd9a8ab0e2ddc890f816e84bb2f1` (pre-merge target tip); captures the pre-merge target tree across all declared `snapshot_paths` (`artifacts/30-architecture/`, `artifacts/00-repository/` — byte-identical to the pre-merge tip, `git diff --quiet` clean) plus the untracked handoff `state/handoffs/rm-37-merge-wp37.json`. Ref present and resolves.

## Merge

- **Merge commit**: `15f79183ed94e25b8f6f96568540ce886fa6c4e7`
- **Subject**: `docs(architecture): merge wp-37 notes into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git log -1 --pretty='%P'`): `12ffa9ce14a1dd9a8ab0e2ddc890f816e84bb2f1` (pre-merge target tip) + `6de5807f9fdd853d6269c1faee8ace5d3a1f88cc` (source tip).
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet HEAD 6de5807` clean; trees both `03b84b7227e1926b6481887d91eee63ed63a062a`) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 22:32:18 +0800`.

## Merged paths (4 files, +137 / −5; 2 added, 2 modified)

- **Artifacts (4 files, all under the declared `writes` scope)**:
  - `artifacts/00-repository/gates/wp-37-gate.md` (new gate record, 24 lines) — Change-impact documentation gate, decision PASS.
  - `artifacts/30-architecture/CHANGE-IMPACT-note-1.md` (new Change Impact note, 105 lines) — documentation-only impact; code NONE; downstream evidence not invalidated.
  - `artifacts/30-architecture/contracts.md` (+3 / −2) — Rev 2 fold-wording sync (per-code-point `foldLower`, A-06).
  - `artifacts/30-architecture/security-model.md` (+5 / −3) — Rev 2 §5.2 sync (`a id` anchor pattern, D-3 delta removal).
- Merge scope is documentation-only; `artifacts/30-architecture/` and `artifacts/00-repository/` only, exactly as declared in the handoff.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-37-gate.md` — present at the merged revision; sha256 `4bc2f0f8aaa283a4101a345507cb6d1e2c2db01b0c1ee92f1f4ef861072a7ce4` matches the pinned `gate_evidence_path_sha256` (verified pre-merge and post-merge; merge result content equals source tip). The file was committed on the source branch (`6de5807`) and arrived on the target via this merge.
- **Gate**: Change-impact documentation gate — STANDARD; decision **PASS — integrate `task/wp-37-note` into `feat/v0.1.0`**. Verification: fold rule `foldLower`, §5.2 sanitize schema notes, doc-only Change Impact, A-05 statement, fresh parity (Rust 5/5; frontend contracts 44/44) all PASS.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `15f79183ed94e25b8f6f96568540ce886fa6c4e7`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- `wp-37-note` documentation sync (contracts Rev 2 fold wording, security-model Rev 2, Change Impact note) and its gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **wp-38 desktop re-runs** (desktop verification after the wp-36a review fixes and wp-37 doc sync), then the combined focused re-review (wp-39) per the wp-37 gate decision.
