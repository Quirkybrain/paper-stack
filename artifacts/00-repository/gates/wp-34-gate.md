# Gate Evidence — wp-34-desktop-at (Desktop Acceptance AT01–AT30) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-34
- **Status**: VALID (evidence accepted; **8 defects routed as blocking fixes**)
- **Date**: 2026-10-07
- **Gate**: Acceptance evidence gate — STRICT (T-63)
- **Task**: `wp-34-desktop-at`, role `test-engineer`, branch `task/wp-34-desktop-at`
- **Source revision**: commit `6ea6495`
- **Evidence report**: `artifacts/70-verification/acceptance-at.md`; evidence `artifacts/70-verification/evidence/at/` (319 PNGs, runs.log, hashes, socket/DB snapshots)

## Result summary

**22 PASS / 8 FAIL** (UNVERIFIED sub-items listed per item in the report; not counted as PASS).

## Defects routed (must fix + re-verify before review/integration)

| # | AT | Defect (evidence-backed) | Owner scope |
|---|---|---|---|
| 1 | AT06 | Session restore + recents not wired (`loadSession`/`touchRecent` have no production call sites) | src/ |
| 2 | AT07 | `sessionUnavailable` has no UI consumer (no “找不到原文件”/relink affordance) | src/ |
| 3 | AT14/15 | In-page fragment navigation (body links + outline) does not navigate in the real app; missing-fragment is a silent return (`ReaderScreen.tsx:836`) | src/ |
| 4 | AT19 | Startup position restore not wired (`loadPosition` no production call) | src/ |
| 5 | AT26 | Remote image URL WITH path is misclassified (`decide_access` calls path-forbidding `normalize_origin` on full URLs) → session-allow unreachable for real image URLs | src/ (+owner check) |
| 6 | AT28 | Diagnostics export protection hole: with the main document in an error state, export wrote into a source directory (protected set empty for unregistered docs); registered-doc rejection still needs verification | src/ |
| 7 | AT30 | About shows raw i18n key `about.sourceUnconfigured` (missing/incorrect catalog key) | src/locales or component |

Confirmed fixes from earlier findings: W-1 fixed; W-2 not reproduced (real-input focus ring visible); local-image allow path closed (EA-RUN W-3); panel overlay behavior consistent at 1.25 scale.

## Decision

**ACCEPT EVIDENCE — integrate `task/wp-34-desktop-at` (tooling + evidence + parity-vector cleanup only; no product-code changes). Dispatch `wp-34a-fixes` (implementation-engineer) for defects 1–7, then `wp-34b-atrerun` (test-engineer) to re-run affected AT items and refresh acceptance evidence.**
