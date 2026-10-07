# Gate Evidence — wp-34d-rerun (AT19/26/28 Re-run) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-34D
- **Status**: VALID — **all desktop acceptance items pass on the fixed revision**
- **Date**: 2026-10-07
- **Gate**: Acceptance re-verification — STRICT
- **Task**: `wp-34d-rerun`, role `test-engineer`, branch `task/wp-34d-rerun` (one interrupted turn resumed; completed synchronously)
- **Source revision**: commit `6f98276293d0ac2f605da56a87f4823375f6462c`
- **Evidence**: `artifacts/70-verification/acceptance-at.md` Rev 3; `evidence/at-rerun2/`

## Result

| AT | Rev 2 | Rev 3 | Key evidence |
|---|---|---|---|
| AT19 | FAIL (partial) | **PASS** | approx fallback scrolls + label (`at19-r3-g/i`), exact restore label, DB position rows |
| AT26 | FAIL (partial) | **PASS** | blocked + 0 sockets; allow → controlled fetch ESTAB to host + cache file 8090B + render (`at26-r3-*`) |
| AT28 | FAIL (partial) | **PASS** | dedicated protected rejection 0-write; overwrite confirm; non-source success; registered-doc rejection |

**Overall 30 items: 30 PASS / 0 FAIL / 0 UNVERIFIED** (environment-bound sub-items remain listed per report §6: Wayland, packet-capture level, clean install, WebDriver E2E).

Regression: AT05/AT17 PASS; frontend 529 tests.

## Observations (non-blocking, recorded)

O-34d-1 approx fallback lands on the recorded anchor block (scroll+label present); O-34d-2 GTK dialog extension behavior (test-env).

## Decision

**PASS — integrate `task/wp-34d-rerun` into `feat/v0.1.0`. Acceptance evidence refreshed; proceed to independent reviews (wp-35/36).**
