# Gate Evidence — wp-45-fix-it (IT Defect Fixes D-IT-1..3) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-45
- **Status**: VALID (IT-level re-verification in wp-46)
- **Date**: 2026-10-08
- **Gate**: Defect-fix verification — STRICT
- **Task**: `wp-45-fix-it`, role `implementation-engineer`, branch `task/wp-45-fix-it`
- **Source revision**: commit `f8e4dae`
- **Evidence report**: `artifacts/60-implementation/wp-45-fix-it.md`

## Verification

| Defect | Fix | Regression proof |
|---|---|---|
| D-IT-1 R15 | per-segment percent-decode in `resolveDocumentLink` (fragment untouched; malformed kept literal) | 5 unit + 1 component test |
| D-IT-2 R22 | Rust: settled `removed` only when path truly missing (rename-over → `modified`); frontend: `removed` verified by stable read before unavailable | Rust sequence/presence/runtime tests with real copy+rename; frontend tests |
| D-IT-3 R29 | linear fast path `simplified.ts` for >1Mi UTF-16; annotate binary-search/bucketing; O(n²) anchor suffix map | simplified 13 tests incl. 11MiB budget |
| **D-IT-3 numbers** | 11 MiB simplified: >7 min never-completed → **1.67s parse + 91ms annotate**; 2 MiB: ~13s → 269ms | PASS |

Suites: frontend 568 (+21), Rust 282 (+8), all static checks clean.

## Recorded limitations

Fast path >1Mi UTF-16 only; full (non-simplified) mode still superlinear (bounded fix recorded); IT-level rerun pending (wp-46).

## Decision

**PASS — integrate `task/wp-45-fix-it` into `feat/v0.1.0`. Dispatch wp-46 focused IT+AT re-runs.**
