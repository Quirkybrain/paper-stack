# Gate Evidence — wp-47-fix3 (Simplified-Mode Windowed Mount) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-47
- **Status**: VALID (IT07/AT29 acceptance re-verification in wp-48)
- **Date**: 2026-10-08
- **Gate**: Defect-fix verification — STRICT
- **Task**: `wp-47-fix3`, role `implementation-engineer`, branch `task/wp-47-fix3`
- **Source revision**: commit `96a5e70710d43e676300eda0e1f09c203b5531eb`
- **Evidence report**: `artifacts/60-implementation/wp-47-fix3.md`

## Verification

| Item | Result |
|---|---|
| Root cause | idle-tick pump mounting all 145,360 blocks + O(document) excerpt resolver per block (6.6×10⁹ steps in one render) |
| Fix | bounded window (120→600), reveal-driven, scroll-anchored, no idle loop; O(1) excerpt resolver; `blockStart` support |
| Real app (11 MiB) | content ≤3s; CPU last-20s avg **0.00%** (pre-fix: 114.7% avg, never idle); tail hit #132,139 navigates; copy 49 B exact; **close 0.12s** (pre-fix 14.26s SIGTERM) |
| Tests | frontend 588 (+20); typecheck/lint/build green |

## Decision

**PASS — integrate `task/wp-47-fix3` into `feat/v0.1.0`. Dispatch wp-48 focused IT07/AT29 re-verify to close D-IT-3 at acceptance level.**
