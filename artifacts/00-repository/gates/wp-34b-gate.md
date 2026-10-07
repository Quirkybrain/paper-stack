# Gate Evidence — wp-34b-atrerun (Acceptance Re-run) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-34B
- **Status**: VALID (3 residual defects routed: D-34b-1..3)
- **Date**: 2026-10-07
- **Gate**: Acceptance re-verification — STRICT
- **Task**: `wp-34b-atrerun`, role `test-engineer`, branch `task/wp-34b-atrerun`
- **Source revision**: commit `d9612f4`; evidence report Rev 2
- **Evidence**: `artifacts/70-verification/acceptance-at.md` (Rev 2), `evidence/at-rerun/` (78 PNGs + logs)

## Result

Rev1 **22 PASS / 8 FAIL** → Rev2 **27 PASS / 3 FAIL / 0 UNVERIFIED**.
Fixed & verified: AT06, AT07, AT14, AT15, AT30 (+regression spot-checks AT05/AT17 clean). New binary sha256 differs from wp-34 build.

## Residual defects (routed to wp-34c)

| ID | AT | Finding | Evidence |
|---|---|---|---|
| D-34b-1 | AT19 | approx + blockId≠null consume guard never satisfied → heading/ancestor fallback does not scroll or annotate (`ReaderScreen.tsx:515/521-526`) | report R2.4 |
| D-34b-2 | AT26 | after authorization, allowed image lacks assetUrl → `load-failed`; `fetch_remote_image` never invoked (strace: no connect; env ruled out via curl) (`ImageBlock.tsx:105-132`) | report R2.4 |
| D-34b-3 | AT28 | `ExportPreviewDialog.tsx:100-109` misreads protected-rejection as overwrite confirmation → generic save failure (protection itself verified working) | report R2.4 |

## Decision

**ACCEPT EVIDENCE — integrate `task/wp-34b-atrerun`. Dispatch `wp-34c-fixes` (implementation-engineer) for D-34b-1..3, then `wp-34d-rerun` (test-engineer) for AT19/26/28 only.**
