# Gate Evidence — wp-34a-fixes (Acceptance Defect Fixes) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-34A
- **Status**: VALID (desktop re-verification pending in wp-34b)
- **Date**: 2026-10-07
- **Gate**: Defect-fix verification — STRICT (8 acceptance FAILs → 7 defect groups)
- **Task**: `wp-34a-fixes`, role `implementation-engineer`, branch `task/wp-34a-fixes` (recovered from a server-restart interruption; WIP validated, completed, and verified by a fresh session under the same frozen handoff)
- **Source revision**: commit `1a7263a` (16 files, +1421/−107)
- **Evidence report**: `artifacts/60-implementation/wp-34a-fixes.md`

## Verification

| Defect | Fix + regression test |
|---|---|
| AT06 session restore + recents wiring | `restoreStartupSession` (order/active/pref-off/focus/recents/cleared-category ×7 tests) |
| AT07 unavailable-source UI | removed→sessionUnavailable banner + relink/retry/close (×4) |
| AT14/15 fragment navigation + missing-fragment message | `resolveFragment` + notice + history (×4) |
| AT19 position restore | post-parse one-shot restore + exact/approx labels (×3) |
| AT26 remote URL-with-path | `origin_for_remote_reference` + origin-only policy (×5) |
| AT28 export protection (error-state docs) | `known_sources` union in `collect_protected_sources` (×2) |
| AT30 About raw key | resolved via `t()` (test asserts translated text) |
| Tests | frontend 524 (+16); contracts 44; cargo 261 (+7); all static checks green |
| WIP recovery | 2 half-finished items found and completed (retry-parse scheduling; banner string parameterization — no hardcoded punctuation) |

## Catalog deltas (routed to wp-42 string review)

`nav.fragment.notFound`, `document.unavailable.banner` added beyond the pinned 378-key catalog (documented in i18n test + report §4).

## Residual

Desktop re-run of the 8 AT items → wp-34b; then independent reviews.

## Decision

**PASS — integrate `task/wp-34a-fixes` into `feat/v0.1.0`. Dispatch wp-34b acceptance re-run.**
