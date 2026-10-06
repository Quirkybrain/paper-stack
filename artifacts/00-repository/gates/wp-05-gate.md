# Gate Evidence — wp-05-ux (UI Spec & String Catalog) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model; this record documents that decision. It is not a specialist deliverable and no specialist role owns Gate records.
- **Artifact ID**: GATE-WP-05
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Artifact Validation Gate (UX spec, STRICT project)
- **Task**: `wp-05-ux`, role `experience-designer`, task branch `task/wp-05-ux`
- **Source revision (evaluated)**: commit `02e4e53358a1ec9e7befb37a6b69bf7f09b9de52`
- **Evaluated artifacts**:
  - `artifacts/40-ux/ui-spec.md` (394 lines; Producer `agent:experience-designer`)
  - `artifacts/40-ux/strings-zh-CN.md` (498 lines, 378 catalog rows, all 32 contract error codes mapped)
- **Handoff record**: `wp-05-ux` finish `RETURNED_FOR_GATE`; 6/6 pinned inputs verified; scoped commit.

## Evaluation

| Check | Result |
|---|---|
| IXD authoritative: UI00–UI07 specified, UI08 excluded, no placeholder buttons | PASS |
| Defaults/layout constants match IXD §3.2 exactly; tokens match §18.1 | PASS |
| Keyboard map/focus contract/a11y from IXD §17 included | PASS |
| Unfrozen visual details recorded as 18 explicit choices (VC-01..VC-18) with rationale | PASS |
| String catalog keyed semantically; error-code mapping; no-hardcode policy stated | PASS |
| Regression sample spec per IXD §18.4 | PASS |
| Traceability UI ↔ IX ↔ R/AT | PASS |
| EDGE-05 (Enter/Shift+Enter wording §7.1 vs §17.1) reconciled as: Enter = first-result when none selected else next; Shift+Enter = last-result when none else previous — annotation difference, not behavior conflict | ACCEPTED |

## Notes for downstream

- `strings-zh-CN.md` wording marked `spec` is subject to copy review at implementation; the catalog is the single source for `locales/zh-CN.json`.
- Implementation must not introduce any UI text not in the catalog; reviewer will audit hardcoded strings (i18n rule).

## Decision

**PASS — accept both artifacts rev 1 as VALID and integrate `task/wp-05-ux` into `feat/v0.1.0`.**
