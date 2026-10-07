# Gate Evidence — wp-03-architecture (Architecture & Contracts) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model; this record documents that decision. It is not a specialist deliverable and no specialist role owns Gate records.
- **Artifact ID**: GATE-WP-03
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Artifact Validation Gate (architecture/contract set, STRICT project)
- **Task**: `wp-03-architecture`, role `solution-architect`, task branch `task/wp-03-architecture`
- **Source revision (evaluated)**: commit `6355995` (`docs(architecture): define v0.1.0 architecture and contracts`)
- **Evaluated artifacts (15 files, 2,008 lines)**:
  - `artifacts/30-architecture/architecture.md` (348)
  - `artifacts/30-architecture/contracts.md` (490, contract id `paperstack-ipc-r1`: 38 commands, events, shared models, 32-code error taxonomy, R22 commit rule, watch/stabilize rule)
  - `artifacts/30-architecture/data-model.md` (256, SQLite v1 DDL + migrations + anchors/identity + R06/R27 clear rules)
  - `artifacts/30-architecture/security-model.md` (200)
  - `artifacts/30-architecture/rendering-pipeline.md` (197)
  - `artifacts/30-architecture/adr/ADR-001..ADR-010`
  - All with compliant Producer metadata (`agent:solution-architect`).
- **Handoff record**: `wp-03-architecture` finish `RETURNED_FOR_GATE`; 7/7 pinned inputs verified; one scoped commit (15 paths).

## Evaluation (evidence-based)

| Check | Result |
|---|---|
| Producer metadata in every artifact | PASS |
| Uses pinned requirements baseline; cites R/NF/IX IDs; no new product requirements invented | PASS |
| Module structure matches plan §3.4 and config tech constraints; forbidden tech absent | PASS |
| Contracts cover all v0.1.0 flows (open/batch/dir/recents/session/positions/settings/reload/relink/source/search/clipboard/opener/auth/remote/watch/diagnostics/about/single-instance/quit) | PASS |
| Version/generation correctness and watch/stabilize rules stated as normative contract text (R21/R22/AT22) | PASS |
| Data model includes migrations, retention, SRS §6.1 defaults | PASS |
| Security model: exact path-check order, remote policy, sanitize schema, capabilities/CSP | PASS |
| Rendering pipeline: exact plugin order, source mapping, failure isolation, 10/50 MiB degradation | PASS |
| ADRs recorded for material decisions (10) | PASS |
| Environment constraints recorded (X11-only, no WebDriver/no sudo, libxdo note, Wayland UNVERIFIED) | PASS |

## Open items routed (orchestrator-owned)

1. **A9** source-code entry unconfigured → `sourceEntryUrl: null`; release blocker unless owner supplies a real entry (decision deferred to release gate / Clarification Gate as needed).
2. **A4** Wayland acceptance impossible here → rows must be recorded 未验证 (DR-05).
3. **libxdo** link via `-lxdo` directly (headers/libs present) — no user action needed.
4. **>50 MiB boundary**: design chose windowed source reading + streaming search instead of hard refuse; accepted as a compliant reading of R29 §5.7 ("明确限制…拒绝加载不能记作性能通过"), to be validated in testing.
5. Performance/accessibility targets remain unmeasured design goals (A8).

## Decision

**PASS — accept the architecture/contract set (rev 1) as VALID and integrate `task/wp-03-architecture` into `feat/v0.1.0`.**
Contracts are now the frozen interface basis for models, UX spec, planning, implementation and tests.
