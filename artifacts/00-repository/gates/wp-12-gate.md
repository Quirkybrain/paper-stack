# Gate Evidence — wp-12-watch (Watch, Single-Instance, Remote Resources) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-12
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STRICT (C-06 watch/app, C-07 remote resources); consolidation wp-12+wp-13 per GATE-WP-06 ruling
- **Task**: `wp-12-watch` (T-15..T-17), role `implementation-engineer`, branch `task/wp-12-watch`
- **Source revision**: commit `a0df54ed44713df8d8e7766c03088090fbfb8958` (9 paths)
- **Evidence report**: `artifacts/60-implementation/wp-12-watch.md`

## Verification

| Check | Result |
|---|---|
| Watch registry: doc+parent+resource set, W1 merge, replacement-save, unwatch silence, content-free payloads | PASS |
| Focus-recheck pure helpers (contract §7.5) | PASS |
| Single-instance queue + `take_pending_open_requests` drain semantics | PASS |
| Remote policy: HTTPS-only, resolved-address block matrix, ≤3-hop revalidation, caps, no-retry, session allow/revoke | PASS |
| Tests: 213 passed / 0 failed (52 new); fmt/clippy clean; real-notify wiring 10× stable | PASS |

## Accepted deviations

Commit subject shortened for the 72-char policy; tokio `rt` features relied on transitively-active feature set (flagged to pin explicitly at dependency freeze); merge precedence and cache-before-DNS interpretations recorded in report §5.

## Decision

**PASS — integrate `task/wp-12-watch` into `feat/v0.1.0`. C-06/C-07 enter UNVERIFIED (integration pending).**
