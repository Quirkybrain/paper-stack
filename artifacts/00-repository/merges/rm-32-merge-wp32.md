# Merge Evidence — rm-32-merge-wp32: `task/wp-32-testexec` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-07
- **Handoff**: `state/handoffs/rm-32-merge-wp32.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `d63f7b7a70106a4b91390092b755ab0826e8aa56` (matches pinned `base_commit`)
- **Source branch**: `task/wp-32-testexec`
- **Source tip merged**: `98ca657b7943b0e16e57600dce060117b0108b96` (matches pinned `source_commit`)
- **Source commits (2)**: `a84230ba70424b60559e5038da50a271c2cc473d` (`test(verification): add fixtures, vectors and full execution evidence`, 83 files, +5522/−2), `98ca657b` (`docs(gate): record wp-32 test execution gate evidence`, 1 file, +33 — the gate file only)
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache was left in place, not tracked and not merged. The leftover compiled helper `tests/perf/.bin/xwait` was removed before dispatch and is absent; the merged `tests/perf/.gitignore` ignores `.bin/` so regenerable compiled helpers cannot be staged.
- No remote configured (local-only repository); no fetch required. Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T100459Z-rm-32-merge-wp32-3a44eb16` at `1213cec0a4dfbb27bdd7241c700bcd7327c47471` covers the handoff `snapshot_paths` plus the frozen handoff (123 files; byte-identical copies of both modified predecessors `fixtures/.gitattributes` and `fixtures/update/README.md`). An earlier snapshot `…7d9cea25` at `0c41df1f8847604e5cc9f90e293ec16bfa635bcc` (124 files) also preserves the predecessor bytes but still contains the pre-cleanup `tests/perf/.bin/xwait`; it is superseded.
- Merge base equals the pre-merge target tip (`d63f7b7a`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.

## Merge

- **Merge commit**: `34f6c6e00b5f766f2f5db2d093f3b5781201d805`
- **Subject**: `test(verification): merge wp-32 fixtures and evidence into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`d63f7b7a70106a4b91390092b755ab0826e8aa56` + `98ca657b7943b0e16e57600dce060117b0108b96`)
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state
- Merge result content equals the source tip (`git diff HEAD^2 HEAD` empty; 0 files) — the merge introduced no content changes beyond the branch history.

## Merged paths (84 files, +5555 / −2; 82 added, 2 modified)

- **Fixtures (20 files; 18 new, 2 updated)**: eight rendering classes (`code`, `edge-cases`, `images`, `links`, `math`, `mermaid`, `mixed-cn-en`, `tables`) + `source-map.md` and READMEs under `fixtures/rendering/`; `fixtures/search/search-samples.md`; `fixtures/security/malicious.md`; `fixtures/update/{heading-moved,no-shared-anchor,repeated-blocks}.md`; `fixtures/README.md`; updated `fixtures/.gitattributes` and `fixtures/update/README.md`.
- **Contract tests and vectors (10 files, new)**: `tests/contracts/` suites `rendering-fixtures.test.ts`, `search-parity.test.ts`, `utf16-utf8.test.ts`, `error-taxonomy.test.ts`; shared vectors under `tests/contracts/vectors/` (search parity, UTF-16/8, error taxonomy); `vitest.config.ts`; README.
- **Perf/harness scripts (12 files, new)**: `tests/perf/` — corpus generator (`generate-corpus.mjs`), NF04 startup / NF05 search / NF06 memory measurement scripts, soak scripts (`soak-desktop.sh`, `soak-service.sh`), `proc_tree.py`, `nf05.measure.ts`, `xwait.c` (source for the gitignored `.bin/xwait` helper), configs, README, `.gitignore`.
- **Rust integration tests (2 files, new)**: `src-tauri/tests/contract_search_parity.rs`, `src-tauri/tests/nf07_soak.rs`.
- **Verification evidence (39 files, new)**: `artifacts/70-verification/unit-integration-report.md` + `artifacts/70-verification/evidence/wp-32/` (perf calibration CSVs/metas and raw JSON, NF07 soak logs, stability matrix logs, full-suite and static-check logs).
- **Gate evidence (1 file, new)**: `artifacts/00-repository/gates/wp-32-gate.md`.
- All 84 merged paths are inside the declared `writes` scope (`fixtures/`, `tests/`, `src-tauri/tests/`, `artifacts/70-verification/`, `artifacts/00-repository/`); scope check returned 0 outside paths. Generated big corpora under `artifacts/70-verification/evidence/generated/` remain intentionally untracked/ignored and are not part of the merge.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-32-gate.md` — present at merged revision; sha256 `cbf3496486f4f7d2e214cafce51f293f7c68246528157eb15843ff6f0e28a16a` matches the pinned `gate_evidence_path_sha256` (verified against the source-tip blob before merge).
- **Gate**: Test-execution quality review — STRICT (C-19 + full suite); decision **PASS — integrate `task/wp-32-testexec` into `feat/v0.1.0`; dispatch `wp-32a-perf` for the four routed findings before independent reviews so reviews cover the fixed revision.**
- **Evaluated revision**: source commit `a84230ba70424b60559e5038da50a271c2cc473d` (83 paths); the only later source commit is `98ca657b`, which adds exactly the gate-evidence file — no post-gate code drift.
- **Verification recorded in gate**: fixtures + shared vectors PASS; full execution root 499 + contracts 43 + cargo 254 = 796 PASS / 0 FAIL, lint/typecheck clean; stability matrix 12/12 per file and combined (1 load-race FAIL root-caused with fix proven); NF07 service soak 500/500 cycles and desktop 30/30 clean exits; perf calibration recorded (n≥30, non-reference machine, failures kept).
- **Routed findings for `wp-32a-perf` (blocking for review stage)**: F-32-2 per-block O(offset) UTF-16→UTF-8 conversion (1 MiB parse p50 ≈ 13.2s; fix in `src/document`); F-32-3 per-hit O(offset) query mapping (dense 1 MiB query p50 ≈ 12.9s; fix in search-core); F-32-1 JS `toLowerCase` Final_Sigma vs Rust per-code-point fold contract divergence (align JS, update parity vectors, document folding rule); F-32-4 `PrivacySection.test.tsx` clear-while-disabled race (test-side await fix; stability matrix re-run N≥10). Calibration anomaly to carry honestly into release docs: idle PSS 283 MiB vs 250 MiB design target (non-reference machine).

## Resulting status

- `feat/v0.1.0` at merge commit `34f6c6e00b5f766f2f5db2d093f3b5781201d805`, followed by this evidence commit; working tree clean; both snapshot refs intact and verified.
- wp-32 fixtures, shared contract vectors, perf/soak harness scripts, Rust integration tests, and the full execution/stability evidence (including the gate file) are integrated into the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Dispatch **wp-32a-perf** to fix F-32-1, F-32-2, F-32-3, F-32-4 and re-run the stability matrix (N≥10) per the gate decision, before independent reviews; carry the idle-PSS calibration anomaly into release documentation.
