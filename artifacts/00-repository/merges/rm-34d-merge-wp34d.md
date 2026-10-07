# Merge Evidence — rm-34d-merge-wp34d: `task/wp-34d-rerun` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-34d-merge-wp34d.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `f6e560802e8c3964a60594a7cd020afc20f91a56` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-34d-rerun`
- **Source tip merged**: `8e0b4fbeadb0190e975e3e5277dccff480cb0953` (matches pinned `source_commit`)
- **Source commits (2)**: `6f98276` (`test(acceptance): re-run at19/26/28 on fixed revision` — desktop harness, at-rerun2 evidence, acceptance-at Rev 3), `8e0b4fb` (`docs(gate): record wp-34d re-run gate evidence` — gate file only).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required.
- Merge base equals the pre-merge target tip (`f6e5608`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T132659Z-rm-34d-merge-wp34d-2622983a` at `fffe18b7fadde8c700196c9632564d3efce4f139`, parent `f6e560802e8c3964a60594a7cd020afc20f91a56` (pre-merge target tip); captures the declared `snapshot_paths` bytes plus the handoff file — 112 untracked/ignored files under `artifacts/70-verification/` (incl. generated corpora, e.g. `evidence/generated/corpus-52MiB.md`), `tests/desktop/xdo-helper` (binary), and `state/handoffs/rm-34d-merge-wp34d.json`. Ref present and resolves.

## Merge

- **Merge commit**: `388722cdf6f908e11dacef93e46e5d1913c5a9ba`
- **Subject**: `test(acceptance): merge wp-34d re-run evidence into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`f6e560802e8c3964a60594a7cd020afc20f91a56` + `8e0b4fbeadb0190e975e3e5277dccff480cb0953`, `git rev-list --parents -n 1 HEAD`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff --quiet HEAD 8e0b4fb` clean, 0 files) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-07 21:27:13 +0800`.

## Merged paths (88 files, +2944 / −3; 86 added, 2 modified)

- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-34d-gate.md`.
- **Acceptance matrix (1 file, modified)**: `artifacts/70-verification/acceptance-at.md` — Rev 3; AT19/26/28 moved FAIL → PASS, 30/30 PASS overall.
- **Evidence tree (83 files, new)**: `artifacts/70-verification/evidence/at-rerun2/` — AT19/26/28(+19b/05/17) screenshots, socket/cache/app logs and dumps, `build.log`, `runs.log`, `unit-suite-r3.log`, `app-binary.sha256`, `cache-at26/` fetch-cache artifacts. Force-added by convention.
- **Desktop harness (3 files)**: `tests/desktop/README.md` (modified), `tests/desktop/find-app-button.py` (new), `tests/desktop/run-at-rerun-wp34d.sh` (new, executable).
- All 88 merged paths are inside the declared `writes` scope (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`). Generated corpora and workspace-level dumps under `artifacts/70-verification/evidence/generated/` were not committed; their bytes are preserved only in the recovery snapshot.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-34d-gate.md` — present at merged revision; sha256 `e4e9f88e65aa4b415205b98d5ff12d9bec4bfcaa2b8a9274dcb15bfaab7b0fe9` matches the pinned `gate_evidence_path_sha256` (verified after merge; merge result content equals source tip).
- **Gate**: Acceptance re-verification — STRICT; decision **PASS — integrate `task/wp-34d-rerun` into `feat/v0.1.0`. Acceptance evidence refreshed; proceed to independent reviews (wp-35/36).**
- **Evidence recorded in gate**: overall 30/30 PASS / 0 FAIL / 0 UNVERIFIED on the fixed revision (`6f98276`); regression AT05/AT17 PASS, frontend 529 tests; environment-bound sub-items listed per report §6 (Wayland, packet-capture level, clean install, WebDriver E2E); non-blocking observations O-34d-1/O-34d-2.

## Resulting status

- `feat/v0.1.0` at merge commit `388722cdf6f908e11dacef93e46e5d1913c5a9ba`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-34d re-run evidence, acceptance Rev 3, desktop harness, and gate record are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Dispatch **`wp-35`** (review A) and **`wp-36`** (review B) — independent reviews against the resulting `feat/v0.1.0` tip after this evidence commit.
