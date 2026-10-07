# Gate Evidence — wp-21-earlyrun (Desktop Tooling & EA-RUN) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-21
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: EA-RUN checkpoint (plan §2.3) — component/task quality gate STANDARD (C-19 tooling) + early-run verification evidence
- **Task**: `wp-21-earlyrun` (T-36, T-37), role `implementation-engineer`, branch `task/wp-21-earlyrun`
- **Source revision**: commit `c72ef89128cd`
- **Evidence report**: `artifacts/70-verification/early-run.md`; evidence dir `artifacts/70-verification/evidence/early-run/`

## Verification

| Check | Result |
|---|---|
| libxdo helper compiles (`-lxdo -lX11` direct); screenshot + runner scripts reproduce the run | PASS |
| Fixed conditions recorded: release build (binary sha256 stable across two builds), window 1280×800, light theme via gsettings+GTK_THEME (restored), default typography, 1.25 environment scale recorded (effective CSS viewport ≈1024×640) | PASS |
| Main reading page checks (layout, overflow, code/table/formula/mermaid/image placeholder/task list, default states, focus visibility, close entry, second document via single-instance, close-all → welcome) | **18 PASS / 0 FAIL** |
| Regression suite re-run on branch: 218 passed | PASS |
| Honest UNVERIFIED list (Wayland, drag-drop, real IME, 200% scaling, dark theme, asset-protocol allowed image, logical 1024×640 CSS, deeper keyboard sweep) | PASS (recorded) |

## Findings routed

- **W-1** (skip link ~15px visible when unfocused): fix folded into the next UI task (wp-24 scope gains `src/styles/`), with retest evidence required.
- **W-2** (focus-visible under synthetic clicks): recorded; real-input focus re-verification scheduled at wp-34 (AT24).

## Decision

**PASS — integrate `task/wp-21-earlyrun` into `feat/v0.1.0`. EA-RUN milestone evidence accepted; README v0 (technical-writer) is the remaining IP-2 item.**
