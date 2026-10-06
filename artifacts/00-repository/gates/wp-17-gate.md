# Gate Evidence — wp-17-pipeline (Markdown Pipeline, Transforms, React Mapping) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-17
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STRICT (C-11 document pipeline); consolidation wp-17+wp-18 per GATE-WP-06 ruling
- **Task**: `wp-17-pipeline` (T-27..T-30), role `implementation-engineer`, branch `task/wp-17-pipeline`
- **Source revision**: commit `536bfc854e1fed6e123ea133ecb826c46ac666dd` (30 paths)
- **Evidence report**: `artifacts/60-implementation/wp-17-pipeline.md`

## Verification

| Check | Result |
|---|---|
| Pipeline order per rendering-pipeline §1–§2; sanitize before engine slots (test-proven); exact schema per security-model §5.2 | PASS |
| Transforms: outline unique anchors (CJK fallback), block fingerprints (`fp1:`), search segments + source maps, UTF-16/8 helpers | PASS |
| Worker protocol + main-thread fallback equivalence + cancellation | PASS |
| rehype-react mapping with block wrappers (`data-block-id`/`src-start`/`src-end`); BlockErrorBoundary isolation | PASS |
| Tests: 94 new (164 total) passed; typecheck/lint/build clean | PASS |
| Deps added within list (no engines yet); lockfile committed; scope hygiene | PASS |

## Decisions carried to wp-19 (Change Impact)

- **D-3 (authorized)**: wp-19 may extend the sanitize schema with the MINIMAL math/katex allowances required by rendering-pipeline §2.8 (and the engine-specific code/mermaid allowances), recorded as a bounded schema revision in its evidence — changing no other rule of security-model §5.2.
- CJK heading id hash fallback and footnote clobber prefix are implementation details consistent with the spec; recorded in report.
- Engine registration interface documented in report §7 for wp-19.

## Decision

**PASS — integrate `task/wp-17-pipeline` into `feat/v0.1.0`. C-11 enters UNVERIFIED (integration pending).**
