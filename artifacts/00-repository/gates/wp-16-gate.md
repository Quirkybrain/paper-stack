# Gate Evidence — wp-16-shell (Frontend Foundation) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-16
- **Status**: VALID (event bridge deferred to reader task — recorded)
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STANDARD (C-10 TS shell; plan §3.2)
- **Task**: `wp-16-shell` (T-21..T-26), role `implementation-engineer`, branch `task/wp-16-shell`
- **Source revision**: commit `58642c4981fb09cf9af5242f28223a798a235c69` (51 paths)
- **Evidence report**: `artifacts/60-implementation/wp-16-shell.md`

## Verification

| Check | Result |
|---|---|
| Services mirror contracts §8 signatures; single invoke entry; `PaperStackError` normalization | PASS |
| Session reducer implements contract §6 commit rule; DocumentModel LRU≤2; ordering tests | PASS |
| i18n runtime (interpolation/fallback/dev warnings); 378-key parity green; no-hardcoded-strings scan test | PASS |
| Tokens exactly per ui-spec §5 (light/dark); base styles/focus/reduced-motion | PASS |
| Common components per ui-spec §2.1 with focus/aria rules; modal trap/Esc/return tests | PASS |
| DoD: typecheck/lint/`pnpm test` (70)/`pnpm build` | PASS |
| No new npm deps; catalog untouched | PASS |

## Accepted deviations

`resources.ts` exports `remote` namespace (contract grouping); clipboard via plugin IPC through single invoke entry; `PaperStackError` colocated in `invoke.ts`; pending-candidate replacement doesn't bump generation (models §2.2(a) reading, tested).

## Deferred (recorded)

**Event bridge T-23** (watch-changed/open-requested/focus/close-requested/drag-drop wiring + quit-time session save): only subscription primitives built. Folded into the next feature task (reader assembly wp-19+20) where `watch-changed` consumption is first needed; entry events folded into wp-30. DoD for those tasks must include the bridge wiring and tests.

## Decision

**PASS — integrate `task/wp-16-shell` into `feat/v0.1.0`. C-10 enters UNVERIFIED (integration pending).**
