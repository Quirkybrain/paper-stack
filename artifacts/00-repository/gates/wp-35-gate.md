# Gate Evidence — wp-35-review-a (Independent Review A: Rust & Security) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-35
- **Status**: VALID — review ACCEPTED as evidence; **overall FAIL (1 blocker + 1 major + 6 minor) routed to fix task**
- **Date**: 2026-10-07
- **Gate**: Independent review gate — STRICT (plan §6.1 review A)
- **Task**: `wp-35-review-a`, role `quality-reviewer`, branch `task/wp-35-review-a` (two guard-metadata blockages archived; Rev 3 closed cleanly)
- **Source revision reviewed**: code at `aac72e1` (verified unchanged); report at commit `64d63580`
- **Deliverable**: `artifacts/60-review/review-a-rust-security.md` (Rev 3)

## Verdicts

7 areas PASS (read-only guarantee, diagnostics/redaction, command surface/capabilities/CSP, storage, watch/events, error taxonomy, tests) — 1 area FAIL (path authorization & resource policy).

## Findings (routed to a single fix task, with A-01..A-08 checklist from report §10.2)

- **A-01 blocker**: restore entry auto-regrants revoked persistent grants (R06 / security-model T6 / data-model §3.2/§6 / INV-AZ-10) — live-reproduced read-only.
- **A-02 major**: directory revoke does not stop `read_directory` scans — live-reproduced read-only.
- **A-03..A-08 minor**: revoke/scope ordering on DB failure; `revoke_remote_session` contract mismatch; read-only degrade/rebuild wiring; fold semantics wording vs contract; credential-URL acceptance before IO; details allowlist robustness.

## Process notes (transparent)

Two guard-metadata blockages on the reviewer cycle were resolved per the documented flow (`finish --failed` + corrected re-pin): (1) deliverable/writes overlap pattern (fix: reviewer handoffs use `writes: []` + exact deliverable commit path); (2) amended-report predecessor bytes require the deliverable in `snapshot_paths`. Both corrections are documented in the report's revision history. These learnings are applied to Review B's handoff directly.

## Decision

**PASS (evidence) — integrate `task/wp-35-review-a` into `feat/v0.1.0`. Dispatch Review B (wp-36), then a batched fix task for A+B findings, then focused re-reviews.**
