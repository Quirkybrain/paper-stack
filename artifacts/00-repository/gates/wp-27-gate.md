# Gate Evidence — wp-27-settings (Settings, Privacy, About, Diagnostics) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-27
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STANDARD (C-16 settings/privacy/about/diagnostics)
- **Task**: `wp-27-settings` (T-48..T-50), role `implementation-engineer`, branch `task/wp-27-settings`
- **Source revision**: commit `382959cf39d73079ec842aa1a502881418d4b528`
- **Evidence report**: `artifacts/60-implementation/wp-27-settings.md`

## Verification

| Check | Result |
|---|---|
| Aa popover bounds/last-valid/preview-without-jump; applied vs persisted with failure+retry messaging | PASS |
| Settings five categories; syntax re-render of current version (no disk reload); Ctrl+,; modal focus contract | PASS |
| Privacy: per-category counts, explicit selection, partial-failure honesty, suppression mirror of models §9, revoke list | PASS |
| About/Legal: version/owner/GPL, honest LICENSE-not-bundled state, `sourceEntryUrl` null + reason, no fabricated URLs | PASS |
| Diagnostics: readable-reason-first, redacted copy default, export preview + protected-target rejection | PASS |
| Tests: 383 passed (39 new); typecheck/lint/build | PASS |

## Findings routed

- **D-27-11 flaky test**: `search-integration.test.tsx` intermittently misses the searchbox (reproduced at base commit `addeeb5` — pre-existing, not introduced here; final run 383/383). Must be stabilized under the test-execution task (wp-32) — flaky tests are not acceptable release evidence. If root cause is unclear, run `debug-specialist` before patching.
- Declared-path shims (`PrivacySection.tsx`/`AboutSection.tsx` re-exports) accepted; canonical paths follow ui-spec §2.3.
- Inline-dollar/update-mode overrides are session states consumed by wp-29.

## Decision

**PASS — integrate `task/wp-27-settings` into `feat/v0.1.0`. Proceed to wp-28+29 (large-doc modes + update/anchor/version flows).**
