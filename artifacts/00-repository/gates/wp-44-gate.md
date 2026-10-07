# Gate Evidence — wp-44-it (IT01–IT08 Acceptance) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-44
- **Status**: VALID (evidence accepted; **3 defects routed**)
- **Date**: 2026-10-08
- **Gate**: IT acceptance gate — STRICT (condition C3)
- **Task**: `wp-44-it`, role `test-engineer`, branch `task/wp-44-it`
- **Source revision**: commit `f0242d1`; report `artifacts/70-verification/acceptance-it.md`
- **Evidence**: `evidence/it/` (packaged-binary extraction runs)

## Result

8 PASS / 0 FAIL overall; 5 restrained sub-items UNVERIFIED (clean `dpkg -i`, Wayland, real IME, >10MiB tail-search/copy, 2MiB遮挡 copy bytes).

## Defects routed (blocking for release polish)

- **D-IT-1**: link to non-ASCII filename → `PS_IO_NOT_FOUND` (pipeline percent-encodes destination but `resolveDocumentLink` doesn't decode) — R15.
- **D-IT-2**: rename-over replacement save bounces to “找不到原文件” requiring manual retry (in-place edit fine) — R22.
- **D-IT-3**: 11 MiB simplified-mode parse ran >7 min CPU without completion — R29/large-doc path effectively unusable at the mandated threshold; bounded fix or honest limitation with impact statement required.

## Decision

**ACCEPT EVIDENCE — integrate `task/wp-44-it`. Dispatch `wp-45-fix-it` (D-IT-1..3), then focused IT re-run (wp-46), then docs (C4/C6) and release readiness (C5).**
