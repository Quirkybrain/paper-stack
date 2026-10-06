# Gate Evidence — wp-14a-assetfix (Asset Protocol Enablement & Auth-Clear Wiring) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-14A
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STRICT (security wiring; follow-up to GATE-WP-14)
- **Task**: `wp-14a-assetfix`, role `implementation-engineer`, branch `task/wp-14a-assetfix`
- **Source revisions (evaluated, cumulative)**: `4ba7980` (runtime-scoped asset protocol), `8415cd7` (lockfile repair), `80bcfff` (authorization-clear wiring), `d5c0667` (tokio feature pin), `f7cca0f` (MSRV + publish=false); final cycle finish `RETURNED_FOR_GATE` (cycle 4)
- **Evidence report**: `artifacts/60-implementation/wp-14a-assetfix.md` (Rev 4)

## Verification

| Check | Result |
|---|---|
| `tauri` feature `protocol-asset`; `assetProtocol={enable:true, scope:[]}`; production CSP unchanged (strict) | PASS |
| Runtime scope controller: allow on grant (file/dir), forbid on revoke/session-clear; single mapping point; trait-faked unit tests | PASS |
| Authorization clear now revokes registry + shrinks asset scope (`revoke_all_for_clear`, per-item outcomes; remote cache purge) | PASS |
| Dev-mode smoke on DISPLAY=:1: window renders under devCsp, HMR WebSocket reachable; screenshots recorded | PASS |
| tokio features pinned explicitly (`["rt"]`) per actual usage; MSRV 1.96 + `publish = false` declared | PASS |
| Tests: 248 passed / 0 failed; fmt/clippy clean; `asset://` byte-serving marked UNVERIFIED (pending wp-16 wiring) | PASS |

## Process disclosure (orchestrator scope defects)

Cycles 1–3 of this task were each blocked at `finish` by **orchestrator handoff scope defects** (over-declared `commit_paths` entries with no committed change; one required lockfile excluded from scope). No product defect was involved. Each block was resolved per the guard's documented flow (`finish --failed` + corrected re-pin); the lockfile was committed by the orchestrator as a mechanical repair (`8415cd7`). All failed-cycle records are retained under `.git/swe/history/`. Corrective rule adopted for subsequent handoffs: declare only paths that will actually change; include snapshot coverage for every pre-existing path that may change.

## Accepted limitations (carried)

`asset://` byte-serving remains UNVERIFIED until the frontend actually requests asset URLs (wp-16); Tauri 2 asset-scope forbidden patterns are process-lifetime append-only (documented; same-process re-grant needs restart — acceptable for v0.1.0, revisit if UX demands); conditional remote-cache forbidden-check nuance recorded in report.

## Decision

**PASS — integrate `task/wp-14a-assetfix` into `feat/v0.1.0`; M2 follow-up closed; proceed to M3 (TS shell + pipeline + early real run).**
