# Gate Evidence — wp-19-reader (Engine Plugins & Reader Assembly) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-19
- **Status**: VALID (one bounded follow-up: Vite worker conditions)
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STRICT (C-11 engines, C-12 reader); consolidation wp-19+wp-20 per GATE-WP-06 ruling
- **Task**: `wp-19-reader` (T-31..T-35 + deferred T-23 bridge), role `implementation-engineer`, branch `task/wp-19-reader`
- **Source revision**: commit `d1a3c2f` (39 paths)
- **Evidence report**: `artifacts/60-implementation/wp-19-reader.md`

## Verification

| Check | Result |
|---|---|
| KaTeX: remark-math + rehype-katex (`trust:false`, `strict:warn`, caps), per-node isolation, macros per-doc, D-3 schema delta (`code` className + `math-*` only) | PASS |
| Shiki: lazy dynamic import, 12-language set, unknown→plain, copy payload LF/tail normalized | PASS |
| Mermaid: strict, htmlLabels false, node/timeout caps, localized errors + source | PASS |
| Reader: open via pending-requests/dialog, read→parse→progressive render, loading timing rules, toolbar/tabs (≥2, MRU close order), Ctrl+W, error boundary | PASS |
| Event bridge (T-23 partial as scoped): watch-changed pending state, open-requested, focus, close-requested, drag-drop record | PASS |
| Tests: 217 passed; typecheck/lint/build; `cargo build` | PASS |
| **Real X11 smoke**: `tauri build --debug --no-bundle`; window viewable; visually confirmed KaTeX inline/display + error fallback, Shiki highlight, second tab via single-instance open-requested, Mermaid render, image placeholder, wide table | PASS (screenshots in report paths) |

## Follow-up (bounded, dispatched as wp-19a-workerfix)

- Vite applies browser export conditions to Web Workers → worker startup crash → spec-compliant in-process fallback with permanent blacklist in use. Proper fix: `resolve.conditions` incl. `worker` in `vite.config.ts` + verification that the worker path is actually used.

## UNVERIFIED carried (honest)

Wayland; asset-protocol allowed-image load path; below-fold fixture content; real interaction (drop/focus/Ctrl+Tab); dark theme/zoom (wp-22).

## Decision

**PASS — integrate `task/wp-19-reader` into `feat/v0.1.0`. C-12 enters UNVERIFIED (integration pending); early-run milestone precursor achieved (first real reader render).**
