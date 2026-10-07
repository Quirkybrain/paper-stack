# Gate Evidence — wp-32a-perf (Offset Mapping, Fold Alignment, Test Race Fixes) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-32A
- **Status**: VALID (one small cleanup routed: src-tauri parity test shell)
- **Date**: 2026-10-07
- **Gate**: Defect-fix verification — STRICT (performance + contract parity)
- **Task**: `wp-32a-perf` (fixes F-32-1..4), role `implementation-engineer`, branch `task/wp-32a-perf`
- **Source revision**: commit `836046adc84ac9595932bc03314d493d2942017c`
- **Evidence report**: `artifacts/60-implementation/wp-32a-perf.md`

## Verification (before → after, committed scripts, non-reference machine)

| Finding | Result |
|---|---|
| F-32-2 parse scaling | 1 MiB parse p50 **13,136 → 885.6 ms** (~14.8×; shared single-pass offset index) |
| F-32-3 query mapping | dense query p50 **10,946 → 18.03 ms** (~607×; 2333 hits); standard 30.8→10.6 ms |
| F-32-1 fold divergence | aligned per-code-point `foldLower`; exhaustive 1.11M-code-point + 200k-context fuzz 0 divergence; shared vector asserted both sides |
| F-32-4 test race | race fixed without weakening assertions; stability matrix 48/48; full suite ×5 = 508/508 |
| Regression | 807 tests pass (frontend 508 + contracts 45 + cargo 254); typecheck/lint/build clean |

## Routed cleanup (wp-32b, pre-review)

`src-tauri/tests/contract_search_parity.rs` carries a resolved divergence shell (`queries: []`) — remove the obsolete divergence-kind expectations and the shell; assert the shared Greek case on both sides (cargo already green).

## Decision

**PASS — integrate `task/wp-32a-perf` into `feat/v0.1.0`; dispatch the tiny `wp-32b` cleanup before independent reviews.**
