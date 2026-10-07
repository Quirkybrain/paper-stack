# Gate Evidence — wp-48-itrerun2 (Large-Doc Fix Verification IT07/AT29) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-48
- **Status**: VALID — D-IT-3 closed at acceptance level
- **Date**: 2026-10-08
- **Gate**: Defect-closure verification — STRICT
- **Task**: `wp-48-itrerun2`, role `test-engineer`, branch `task/wp-48-itrerun2`
- **Source revision**: commit `0383a8a`; reports Rev 3 (IT) / Rev 7 (AT)

## Result

| Item | Verdict (11 MiB corpus, binary `26c02d2d…`) |
|---|---|
| IT07 | PASS, all sub-items closed — content visible ~4.2s; tail hit «下一项» advances (1/1, view jumps to tail); copy 49 B EXACT; CPU settles (last-20 samples 0.00%); WM close 0.12s clean |
| AT29 | PASS, all sub-items closed — threshold/cancel paths; simplified badge+coverage; tail search/copy; 52 MiB source-window banner OK; CPU settles (settled ~35s); close 0.12s |
| Regression | frontend 588 |

Noted observation O-48-1: synthetic Return presses don't advance search (click works) — recorded, non-blocking.

## Decision

**PASS — integrate `task/wp-48-itrerun2` into `feat/v0.1.0` (merge with documented history-union conflict resolution vs wp-46's earlier revision sections).**
