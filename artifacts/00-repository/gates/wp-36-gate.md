# Gate Evidence — wp-36-review-b (Independent Review B: Frontend & Pipeline) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-36
- **Status**: VALID — review ACCEPTED as evidence; **overall FAIL (3 major + 7 minor) routed to fixes**
- **Date**: 2026-10-07
- **Gate**: Independent review gate — STRICT (plan §6.1 review B)
- **Task**: `wp-36-review-b`, role `quality-reviewer`, branch `task/wp-36-review-b` (clean single-cycle finish with corrected handoff pattern)
- **Source revision reviewed**: `00259fe` code tree; report at commit `f0a11c9`
- **Deliverable**: `artifacts/60-review/review-b-frontend-pipeline.md`

## Verdicts

PASS: search & folding, a11y basics, scope discipline (DR-07). CONSIDER/CONCERN: commit-rule (one token-less relink adopt path), i18n (guard scope/orphans), tests quality. FAIL: pipeline & sanitize (B-01 second `dangerouslySetInnerHTML` site), anchors/update (B-02 footnote back-refs dead).

## Findings (routed to fix tasks: Rust batch + frontend batch, per §9 checklists)

- **Majors**: B-01 `FormulaPanel.tsx:52` DSIH + skipped KaTeX caps; B-02 footnote back-refs stripped (schema/consumer mismatch, R16); B-04 UI01 document-info missing (7 orphan keys).
- **Minors**: B-03 hardcoded "Footnotes" label; B-05 missing 更新行为 menu entry; B-06 token-less relink adopt needs post-await recheck; B-07 focus re-check only active tab; B-08 Mermaid node count via live-DOM innerHTML; B-09 i18n guard scan scope; B-10 D-3 sanitize delta proven unnecessary (strict §5.2 renders math) — simplify per checklist.

## Decision

**PASS (evidence) — integrate `task/wp-36-review-b` into `feat/v0.1.0`. Dispatch `wp-35a-fix-rust` (A-01..A-08) and `wp-36a-fix-frontend` (B-01..B-10), then a combined focused re-review against both checklists.**
