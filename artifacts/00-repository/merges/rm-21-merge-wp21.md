# Merge Evidence — rm-21-merge-wp21: `task/wp-21-earlyrun` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-21-merge-wp21.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `21227c24a92ac5690101ded1584df069f1629114` (matches pinned `base_commit`)
- **Source branch**: `task/wp-21-earlyrun`
- **Source tip merged**: `400c28a750397f128348e22c7a994b150773b60c` (matches pinned `source_commit`)
- **Source commits (2)**: `c72ef89` (`test(desktop): add ea-run tooling and fixed-condition evidence`, 23 files, +2411), `400c28a` (`docs(gate): record wp-21 early-run gate evidence`, 1 file, the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot ref `refs/swe/snapshots/20261007T001618Z-rm-21-merge-wp21-e3acc6d7` at `ad271a259f1bfb4d8b6f7037a7621ea9d7fc1a8a` (covers the handoff `snapshot_paths`: `artifacts/00-repository/`).
- Merge base equals the pre-merge target tip (`21227c2`), so the source branch was strictly ahead; the `--no-ff` merge still produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `3ef54c2a565873f1e2ce1b4641b78172a44f61b2`
- **Subject**: `test(desktop): merge wp-21 ea-run evidence into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`21227c24a92ac5690101ded1584df069f1629114` + `400c28a750397f128348e22c7a994b150773b60c`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (24 files, +2440 / −0)

- **Desktop tooling (5, +897)**: `tests/desktop/xdo-helper.c` (new, 439; libxdo-based helper for click/key/focus/screenshot), `tests/desktop/run-smoke.sh` (new, +282, mode 100755; fixed-condition EA-RUN smoke runner), `tests/desktop/README.md` (new, 115; desktop test dependency and usage instructions), `tests/desktop/screenshot.sh` (new, 59), `tests/desktop/.gitignore` (new, 2; ignores the compiled `/xdo-helper` binary).
- **EA-RUN verification artifacts (18)**: `artifacts/70-verification/early-run.md` (new, 159; early-run report) and `artifacts/70-verification/evidence/early-run/` — 12 PNG fixed-condition screenshots (main page, focus states, code/mermaid/task states, second document, 1024×640, welcome), `app-binary.sha256`, `app.log`, `second-instance.log`, `runs.log` (167), `build.log` (1187).
- **Gate evidence (1)**: `artifacts/00-repository/gates/wp-21-gate.md` (new, 29).
- 24 paths added, 0 modified; no changes outside the declared `writes` scope (`tests/desktop/`, `artifacts/70-verification/`, `artifacts/00-repository/`).
- The compiled `tests/desktop/xdo-helper` binary is a regenerable build product, intentionally excluded (gitignored by `tests/desktop/.gitignore`); it does not exist in the worktree after the merge and was not committed.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-21-gate.md` — present at merged revision; sha256 `cce80caecf2013500e22235ffd49e216854c07f404ae8c85c4ffa44d54ac629f` matches the pinned `gate_evidence_path_sha256`.
- **Gate**: EA-RUN checkpoint (plan §2.3) — component/task quality gate STANDARD (C-19 tooling) + early-run verification evidence; decision **PASS — integrate `task/wp-21-earlyrun` into `feat/v0.1.0`. EA-RUN milestone evidence accepted; README v0 (technical-writer) is the remaining IP-2 item.**
- **Evaluated revision**: source commit `c72ef89`; the only later source commit is `400c28a`, which adds exactly the gate-evidence file — no post-gate code drift.
- Recorded gate results: libxdo helper compiles and screenshot/runner scripts reproduce the run PASS; fixed conditions recorded (release binary sha256 stable across two builds, window 1280×800, light theme via gsettings+GTK_THEME restored, 1.25 environment scale, effective CSS viewport ≈1024×640) PASS; main reading page 18 PASS / 0 FAIL; branch regression suite 218 passed PASS; honest UNVERIFIED list (Wayland, drag-drop, real IME, 200% scaling, dark theme, asset-protocol allowed image, logical 1024×640 CSS, deeper keyboard sweep) recorded. Findings routed: W-1 skip-link visibility folded into wp-24; W-2 focus-visible under synthetic clicks scheduled at wp-34 (AT24).

## Resulting status

- `feat/v0.1.0` at merge commit `3ef54c2a565873f1e2ce1b4641b78172a44f61b2`, followed by this evidence commit; working tree clean.
- wp-21 desktop tooling, EA-RUN fixed-condition evidence, and the recorded gate evidence are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **wp-23 README v0** via `technical-writer` (remaining IP-2 item per the gate decision); repository-manager prepares the task branch/worktree and handoff on request.
