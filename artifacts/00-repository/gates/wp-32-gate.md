# Gate Evidence — wp-32-testexec (Fixtures, Vectors, Execution, Perf Calibration) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-32
- **Status**: VALID (with 4 routed findings; fixes required before review)
- **Date**: 2026-10-07
- **Gate**: Test-execution quality review — STRICT (C-19 + full-suite)
- **Task**: `wp-32-testexec` (T-59..T-62), role `test-engineer`, branch `task/wp-32-testexec`
- **Source revision**: commit `a84230ba70424b60559e5038da50a271c2cc473d` (83 paths)
- **Evidence report**: `artifacts/70-verification/unit-integration-report.md`

## Verification

| Check | Result |
|---|---|
| Fixture set: 8 rendering classes + malicious samples + search/update extensions (consumed by real-pipeline contract tests) | PASS |
| Shared vectors both sides: search parity, UTF-16/8, error-code↔locale 32/32 | PASS |
| Full execution: root 499 + contracts 43 + cargo 254 = **796 PASS / 0 FAIL**; lint/typecheck clean | PASS |
| Stability matrix: 12/12 per file; combined; 5× full suite (1 load-race FAIL, root-caused + fix proven) | CONDITIONAL (fix routed) |
| NF07: service-level 500/500 cycles 4.07s, fd constant, RSS bounded; desktop 30/30 clean exits | PASS |
| Perf calibration recorded (n≥30; non-reference machine; failures kept) | PASS as calibration |

## Findings (routed to wp-32a-perf; blocking for review stage)

- **F-32-2 (defect)**: per-block O(offset) UTF-16→UTF-8 conversion → 1 MiB parse p50 ≈ 13.2s (design target warm-open ≤1s). Fix in `src/document` (precompute/binary-search offset mapping). Re-measure with committed perf scripts.
- **F-32-3 (defect)**: per-hit O(offset) query mapping → dense 1 MiB query p50 ≈ 12.9s (NF05 target ≤200ms). Fix in search-core.
- **F-32-1 (contract divergence)**: JS `toLowerCase` Final_Sigma vs Rust per-code-point fold → align JS to per-code-point fold; update parity vectors to assert equality; document folding rule.
- **F-32-4 (test race)**: `PrivacySection.test.tsx` clicks clear while disabled under load — fix by awaiting enabled state (test-side, proven); stability matrix must re-run clean (N≥10).
- **Calibration anomalies to carry honestly**: idle PSS 283 MiB vs 250 MiB design target (non-reference machine; WebKit baseline dominates) — record in release docs, not silently adjusted.

## Decision

**PASS — integrate `task/wp-32-testexec` into `feat/v0.1.0`; dispatch `wp-32a-perf` for the four routed findings before independent reviews so reviews cover the fixed revision.**
