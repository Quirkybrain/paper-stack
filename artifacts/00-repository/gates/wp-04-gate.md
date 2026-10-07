# Gate Evidence — wp-04-models (Session & Version Models) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model; this record documents that decision. It is not a specialist deliverable and no specialist role owns Gate records.
- **Artifact ID**: GATE-WP-04
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Artifact Validation Gate (behavioral models, STRICT project)
- **Task**: `wp-04-models`, role `system-modeler`, task branch `task/wp-04-models`
- **Source revision (evaluated)**: commit `714ec66`
- **Evaluated artifact**: `artifacts/35-models/session-and-version-models.md` (745 lines, 14 mermaid diagrams, 87 numbered invariants INV-DS/VC/WS/UM/NH/AR/TL/AZ/WB/SR; Producer `agent:system-modeler` — compliant)
- **Handoff record**: `wp-04-models` finish `RETURNED_FOR_GATE`; 6/6 pinned inputs verified; scoped commit.

## Evaluation

| Check | Result |
|---|---|
| Producer metadata; no invented interfaces (uses `paperstack-ipc-r1`) | PASS |
| 10 required models present with diagrams + decision tables + R/AT/IX references | PASS |
| Testable invariants suitable as test oracles | PASS (87) |
| Parameters cite SRS §6.1/contracts; open numbers marked 待验证参数 | PASS |
| Inconsistencies surfaced as open items instead of silent divergence | PASS (OI-01..OI-07) |

## Accepted interpretations (for downstream tasks)

- OI-01: "LoadFailed" added as a session state (initial read failure before any version) — consistent with IX01 error handling; implementation adopts it.
- OI-02: on accepting a pending candidate, in-flight pending parse results are invalidated and re-dispatched (strict correctness reading; no optimization needed for v0.1.0).
- OI-03: focus re-check covers active + open tabs; background tabs only stage candidates.
- OI-04: suppression is per-category administrative scope with explicit reopen re-enabling per-document records (to be implemented as: clearing category suspends writes for that category; explicit reopen re-establishes document records).
- OI-05: a stable candidate may be committed even if source later becomes unavailable (commit does not require a new read).
- OI-07: P-01..P-04 remain unverified parameters — not regression bases.

## Decision

**PASS — accept `artifacts/35-models/session-and-version-models.md` rev 1 as VALID and integrate `task/wp-04-models` into `feat/v0.1.0`.**
