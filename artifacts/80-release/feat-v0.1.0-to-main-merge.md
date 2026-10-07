# Merge Evidence — rm-final: `feat/v0.1.0` → `main` (PaperStack v0.1.0 repository release)

- **Producer**: agent:repository-manager
- **Status**: VALID
- **Date**: 2026-10-08
- **Handoff**: `state/handoffs/rm-final.json` (repository_action: merge)

## Tips

- **Source branch**: `feat/v0.1.0` — historical integration branch; tip merged `12b202678099ecda754b53105201f559620eccaa` (`docs(release): record release stage gate evaluation`; matches pinned `source_commit`). The branch remains in the repository after this merge as the historical integration branch.
- **Target branch**: `main` — pre-merge tip `ad9c8a1ec0175d60c251b5346072e3982ba1f1f6` (`chore(repo): establish feat/v0.1.0 integration branch`; matches pinned `base_commit`). Pre-merge worktree clean (`git status --porcelain` empty; HEAD on `main`).
- Merge base equals `ad9c8a1…` (the source descends from the pre-merge target tip), so `--no-ff` (configured `merge_strategy`) produced a true two-parent merge commit on a fast-forwardable history; the merge result tree is byte-identical to the source tree `47e99aab5c24e325044402dea1f3842341c05ac9` — a pure union.
- No remote configured (local-only repository; no fetch required). `main_merge_mode` is `review_request_when_remote`; with no remote, this guarded local `main` merge is permitted by policy and was owner-authorized.
- Policy `config/git-policy.json` sha256 `3b8ddffd44949d4fa41318f4122bc40aa50fb8287d9a9a102d83ffeb9241a014` matches the pin: mode `BRANCH_PER_TASK`, `merge_strategy` `no-ff`, `main_merge_mode` `review_request_when_remote`; no company policy (`company_policy_path: null`).
- Input pins verified before merge (sha256): `config/git-policy.json` (`3b8ddffd…`), `config/git-policy.default.md` (`c3493586…`), `state/handoffs/wp-00-start.request.md` (`ad861f2b…`) — all match the handoff.
- Recovery snapshot `refs/swe/snapshots/20261007T211720Z-rm-final-a79daa68` at `8bbd5ab62ea948996c404976f464c60b190099c5` (pre-merge, parent `ad9c8a1…`), covering the declared `snapshot_paths` (`artifacts/00-repository/`) plus the pinned handoff copy: every pre-merge file there (`repo-prep-01.md`) is present and byte-identical in the snapshot (0 absent, 0 differing hashes).
- Pre-merge scope check: all 3873 incoming merged paths fall within the declared `writes` of `rm-final` (verified programmatically before merge: 0 uncovered); no other paths changed.

## Merge

- **Merge commit**: `f498af1d9b4f38e151d359e5f23e10864ff07fcb`
- **Subject**: `docs(release): merge v0.1.0 into main` (allowed conventional type; the first attempt's rejected subject is documented below)
- **Two-parent verification** (`git rev-list --parents -n 1`): `f498af1d9b4f38e151d359e5f23e10864ff07fcb ad9c8a1ec0175d60c251b5346072e3982ba1f1f6 12b202678099ecda754b53105201f559620eccaa` — first parent = pre-merge `main` tip `ad9c8a1…`, second parent = source tip `12b2026…`, in that order.
- **Merge tree**: `47e99aab5c24e325044402dea1f3842341c05ac9` — equals the source tree; `git diff` merge vs source is empty.
- **Conflicts**: **none** — `ort` strategy merged automatically; no unmerged paths (`git ls-files -u` empty); no conflicts to resolve. (`git diff --check` across the union reports only pre-existing trailing-whitespace lines inside verification log/evidence files inherited verbatim from the gated source revision; this merge authored no file content other than this report.)
- **Merged file count**: **3873 files changed, +1,798,021 insertions(+), 0 deletions** (`git show --stat`; `git diff --name-only ad9c8a1 HEAD | wc -l` = 3873; all added — the pre-merge `main` tree contained 2 files).
- Stats tail (`git show --stat --oneline HEAD | tail -3`):

```
 tsconfig.node.json                                 |     13 +
 vite.config.ts                                     |     80 +
 3873 files changed, 1798021 insertions(+)
```

- Commit timestamp `2026-10-08 05:18:25 +0800`.
- Merged content by area (all within declared `writes`): `artifacts/70-verification/` 3251 (AT/IT/perf/package evidence), `src/` 212, `artifacts/00-repository/` 100 (merge evidence, gates), `artifacts/60-implementation/` 88, `src-tauri/` 63, `tests/` 63, `fixtures/` 45, `artifacts/30-architecture/` 16, root files 13 (LICENSE, README, manifests/config), `packaging/` 6, `artifacts/80-release/` 4, `artifacts/60-review/` 3, `docs/paperstack/` 3 (user guide, known limitations, release notes), other artifact Stages 6.

## Gate evidence

- **Gate evidence path**: `artifacts/80-release/stage-gate-release.md` — sha256 `175530f0d6ad9f9a30a20c74c86b3ee25500d48c4ddca986cd9b1dfef45ca656`, matches the pinned `gate_evidence_path_sha256` (verified at source tip `12b2026` before merge and on `main` after merge). Gate decision present: Release Stage Gate PASS — repository release; `feat/v0.1.0` release-ready, merged to `main` via guarded local merge (`rm-final`). No Gate was waived.
- **Integration evidence path**: `artifacts/80-release/release-readiness.md` — sha256 `6ff053a0d5747273ef438ef004b77439616dc9fccfba773f0dd5aa596660d7b3`, matches the pinned `integration_evidence_path_sha256`; verdict READY-FOR-REPOSITORY-RELEASE (public distribution blocked pending A9).
- This record is evidence of integration, not a new Gate approval.

## Superseded first attempt (merge-subject policy rejection)

- A first `rm-final` attempt merged `feat/v0.1.0` with the merge subject `release: merge v0.1.0 into main` (merge commit `eb736fd18db26c5da7029c78d4c632fa131cf6cd`), followed by evidence commit `71a84b4fb25569d65b7bac6eb4400c9cca6abf0f` (`docs(release): record feat v0.1.0 to main merge`).
- The guard (`scripts/swe_guard.py`) rejected it because `release` is not an allowed conventional commit type; the attempt was archived as **FAILED** at `.git/swe/history/20261007T211714Z-rm-final-d14fd547.json` (result_commit `71a84b4f…`), and `main` was deliberately rolled back to `ad9c8a1…` (unpushed local reset; the old attempt persists only in reflog). `feat/v0.1.0` was untouched at `12b2026…`.
- This record supersedes that attempt: the re-pinned merge uses the allowed conventional subject `docs(release): merge v0.1.0 into main`; the merge commit `f498af1d…` carries the same two parents and the same byte-identical union of the source tree.

## Resulting status

- Resulting `main` tip: merge commit `f498af1d9b4f38e151d359e5f23e10864ff07fcb`, followed directly by this evidence commit (exactly one commit after the merge) as the new `main` tip; working tree clean; no remote push performed.
- `feat/v0.1.0` remains at `12b2026…` as the historical integration branch.
- **Release state: repository release complete** (v0.1.0 integrated on `main`). **Public distribution remains BLOCKED pending owner input A9** — the mandatory "matching corresponding source entry" for public distribution is not configured; R30/NF12 forbid issuing without it and forbid a fabricated URL. No distribution URL is recorded in this report. Public claims remain limited to the verified scope (A4 Wayland unverified; A8 performance numbers are local calibration, not certification).
- Snapshot refs intact; no branch was moved after the merge.

## Next action

- Owner input A9 (real corresponding-source entry URL) is required before any public distribution; until then distribution stays blocked and claims stay within the verified scope. No further repository action pending.
