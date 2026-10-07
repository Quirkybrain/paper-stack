# Merge Evidence — rm-43-merge-wp43: `task/wp-43-package` → `feat/v0.1.0`

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-43-merge-wp43.json` (repository_action: merge)

## Tips

- **Target branch**: `feat/v0.1.0`
- **Target tip before merge**: `1e9321ca4e4a644f4b337b2ebbdedd206426d1df` (matches pinned `base_commit`; `git rev-parse HEAD` pre-merge)
- **Source branch**: `task/wp-43-package`
- **Source tip merged**: `31f9a63a8cf0fb22e858fb6e47ad911dd74c2724` (matches pinned `source_commit`)
- **Source commits (2)**: `7f5de8a` (`build(package): add deb packaging and legal resources`), `31f9a63` (`docs(gate): record wp-43 package gate evidence`).
- Pre-merge tree clean (`git status --porcelain` empty); the ignored `src-tauri/target/` Rust build cache exists on disk and was left in place, not tracked and not merged. No remote configured (local-only repository); no fetch required. Merge base equals the pre-merge target tip (`1e9321ca`), so the source branch was strictly ahead; the `--no-ff` merge produced one merge commit over 2 source commits.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy configured (`company_policy_path: null`). Target is `feat/v0.1.0` (not `main`), so local integration merge applies.
- Input pins verified before merge: `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) sha256 all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T165108Z-rm-43-merge-wp43-7981b2e1` at `980df4e64420ae6d0d865db3814992cf4aff7a4b`, parent `1e9321ca4e4a644f4b337b2ebbdedd206426d1df` (pre-merge target tip); resolves and covers the declared `snapshot_paths` (`src-tauri/src/`, `src-tauri/tests/`, `src-tauri/tauri.conf.json`, `src-tauri/icons/`, `artifacts/60-implementation/`, `artifacts/70-verification/`, `artifacts/00-repository/`; 3972 coverage entries). All 7 modified predecessors are byte-covered: `src-tauri/icons/128x128.png`, `src-tauri/icons/128x128@2x.png`, `src-tauri/icons/32x32.png`, `src-tauri/icons/icon.png`, `src-tauri/src/services/info.rs`, `src-tauri/src/state.rs`, `src-tauri/tauri.conf.json`.
- Pre-merge collision check: all 34 incoming paths fall within the declared `writes`; the 27 added paths did not exist on the target and the 7 modified paths matched their snapshot original bytes; no unrelated files touched.

## Merge

- **Merge commit**: `2d14cc6de411687a30984b17ef913b311f309df4`
- **Subject**: `build(package): merge wp-43 packaging into feat/v0.1.0`
- **Strategy**: `--no-ff` (configured `merge_strategy`); two parents verified (`git rev-list --parents -1 HEAD`): `1e9321ca4e4a644f4b337b2ebbdedd206426d1df` (pre-merge target tip) + `31f9a63a8cf0fb22e858fb6e47ad911dd74c2724` (source tip), in that order.
- **Conflicts**: none; clean tree before and after the merge, no unresolved index state.
- Merge result content equals the source tip (`git diff --quiet 31f9a63… HEAD` clean) — the merge introduced no content changes beyond the branch history.
- Merge commit timestamp: `2026-10-08 00:52:08 +0800`.

## Merged paths (34 files changed, +3544 / -10; 27 added, 7 modified)

- **Legal texts** — `LICENSE` (674 lines, new; unmodified GPLv3) and `THIRD_PARTY_NOTICES.md` (863 lines, new; 263 npm prod + 540 Rust crates + resources).
- **Packaging tooling** — `packaging/` (6 new files): `README.md`, `icon.svg`, `paperstack.desktop.hbs`, `generate-icons.sh`, `third-party-inventory.py`, `verify-deb.sh` (last three mode 100755).
- **Application changes** — `src-tauri/tauri.conf.json` (+27/-1), `src-tauri/src/state.rs` (+9/-1), `src-tauri/src/services/info.rs` (+101/-8), `src-tauri/tests/legal_text.rs` (85 lines, new); `src-tauri/icons/` 4 PNGs regenerated (128x128, 128x128@2x, 32x32, icon).
- **Reports and evidence** — `artifacts/60-implementation/wp-43-package.md` (129 lines, new) and 16 new files under `artifacts/70-verification/evidence/package/` (build/cargo-test/verify-runs logs, dpkg-deb metadata and payload listings, `.deb` sha256, source hashes, 5 X11 screenshots).
- **Gate record** — `artifacts/00-repository/gates/wp-43-gate.md` (29 lines, new).
- The built `.deb` itself lives only in ignored `output/` (`paperstack_0.1.0_amd64.deb`, 11,519,100 bytes) and ignored `src-tauri/target/`; it is NOT part of the merge. Merge scope falls within the declared `writes`; no other paths were introduced or modified.

## Gate evidence

- **Path**: `artifacts/00-repository/gates/wp-43-gate.md` — present at the merged revision; sha256 `70f04cb998adc2edf42461e37c77b32189b63844bd39ca323a9c36edaab4fdcc` matches the pinned `gate_evidence_path_sha256` (verified on the source tip pre-merge; the file arrives on the target via this merge). The file was committed on the source branch (`31f9a63`).
- **Gate**: Packaging/legal gate — STRICT (plan §6.4 C2; R30/NF12); decision **PASS — integrate `task/wp-43-package` into `feat/v0.1.0`. Proceed to wp-44 IT acceptance (C3).** Result: GPLv3 LICENSE byte-verified, third-party notices complete, `.deb` built and inspected (`dpkg-deb -I/-c`), extract-run offline license/notices reading on X11, Rust 279 tests (+5) and clippy/fmt clean. Recorded limitations (ASCII `productName`, missing `License:` field, sudo-requiring clean-system `dpkg -i` UNVERIFIED) are documented in the gate and implementation report.
- Gate evidence presence confirmed before `finish`; no Gate was waived.

## Resulting status

- `feat/v0.1.0` at merge commit `2d14cc6de411687a30984b17ef913b311f309df4`, followed by this evidence commit; working tree clean; snapshot ref intact; not pushed; `main` not touched.
- The wp-43 packaging tooling, GPLv3 license, third-party notices, offline legal-reading views, implementation report, evidence corpus, and gate record are now integrated on the integration branch.
- This record is evidence of integration, not a Stage Gate approval.

## Next action

- Proceed to **wp-44 IT acceptance** (condition C3) per the wp-43 gate decision. `main_merge_mode` is `review_request_when_remote`; with no remote configured, promotion to `main` remains owner-controlled.
