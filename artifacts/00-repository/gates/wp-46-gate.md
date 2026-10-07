# Gate Evidence — wp-46-itrerun (Post-fix IT/AT Re-runs) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-46
- **Status**: VALID — D-IT-1 and D-IT-2 closures verified; D-IT-3 partial (routed to wp-47 → closed in wp-48)
- **Date**: 2026-10-08
- **Gate**: Defect-closure verification — STRICT
- **Task**: `wp-46-itrerun`, role `test-engineer`, branch `task/wp-46-itrerun`
- **Source revision**: commit `472b1c1`; reports Rev 2 (IT) / Rev 6 (AT)

## Result

| Item | Verdict |
|---|---|
| IT02 (D-IT-1 non-ASCII link) | PASS — closed |
| IT03 (D-IT-2 replacement save) | PASS — closed (banner at ~0.8s, no bounce; selection/source-view paths verified) |
| IT07 / AT29 (D-IT-3 large doc) | PARTIAL — parse/index fixed; ~144k-block mount saturates WebKit CPU + tail navigation blocked (routed to wp-47, closed in wp-48) |
| AT15/21/22 re-checks | PASS |

## Process note

This cycle's merge was initially skipped by the orchestrator; corrected by merging it ahead of wp-48 with a documented conflict resolution (history union). Recorded for process accuracy.

## Decision

**PASS (evidence) — integrate `task/wp-46-itrerun` into `feat/v0.1.0`.**
