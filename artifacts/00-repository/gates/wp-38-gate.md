# Gate Evidence — wp-38-desktop-rerun (Post-fix Acceptance Rerun) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-38
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Acceptance re-verification — STRICT
- **Task**: `wp-38-desktop-rerun`, role `test-engineer`, branch `task/wp-38-desktop-rerun`
- **Source revision**: commit `e56b383`; evidence report `artifacts/70-verification/acceptance-at.md` Rev 4
- **Evidence**: `evidence/at-rerun3/` (897 screenshots/logs)

## Result

10 affected items re-run on the fixed binary: **AT02, AT06, AT09, AT12, AT14, AT15, AT16, AT25, AT27, AT30 all PASS** with specifics, including the new no-auto-regrant restore chain (grants 1→0→0), footnote back-ref round trip, D-3-removed math rendering, and DocumentInfoPanel. No regressions. Overall 30/30 PASS (20 carried from Rev 3 + 10 refreshed).

Frontend suite 547 green; i18n guard + DSIH single-entry targeted checks 6/6.

## Observations carried

Directory grants are session-scope by design (clear-based revocation verified); post-revoke retry lands in error view; license viewer still shows “not found” (wp-41/45 item); About menu order recorded.

## Decision

**PASS — integrate `task/wp-38-desktop-rerun` into `feat/v0.1.0`. Proceed to the combined focused re-review (wp-39).**
