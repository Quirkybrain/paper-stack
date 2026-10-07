# Gate Evidence — wp-36a-fix-frontend (Review B Findings B-01..B-10) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-36A
- **Status**: VALID (doc-sync items routed to architect note task; desktop re-checks in re-review)
- **Date**: 2026-10-07
- **Gate**: Review-correction gate — STRICT
- **Task**: `wp-36a-fix-frontend`, role `implementation-engineer`, branch `task/wp-36a-fix-frontend`
- **Source revision**: commit `04ef5a115df6056cc977836f76f16b94e415f157`
- **Evidence report**: `artifacts/60-implementation/wp-36a-fix-frontend.md`

## Verification (per checklist)

| Finding | Fix | Test |
|---|---|---|
| B-01 major | single trusted-HTML entry `SanitizedNode` (Mermaid + formula preview routed; preview inherits frozen KaTeX caps) | `single-trusted-html-entry` scan + caps spy |
| B-02 major | footnote ref anchors survive sanitize; round-trip verified | pipeline fragment-resolution + ReaderScreen back-ref tests |
| B-04 major | `DocumentInfoPanel` + toolbar button (7 orphan keys consumed) | new panel tests + reader integration |
| B-03/B-05/B-09 | catalog-driven footnote label; 更新行为 menu entry; guard scans all src | per-checklist tests |
| B-06/B-07/B-08/B-10 | relink post-await recheck; focus re-check covers open tabs; inertParser node count; D-3 delta removed (strict §5.2 suffices) | per-checklist tests |
| Suites | frontend 547 (+18); contracts 44; Rust 274 | PASS |

## Routed (architect note task)

security-model §5.2 `a id` row sync; contract fold-wording (A-06); degrade-UX statement (A-05). Catalog deltas now +3 (`document.footnoteLabel`, `document.info.disabled`, `document.info.issues.none`) → 381 keys, recorded for wp-42 reconciliation.

## Decision

**PASS — integrate `task/wp-36a-fix-frontend` into `feat/v0.1.0`. Dispatch the architect note task, then desktop re-runs + combined focused re-review.**
