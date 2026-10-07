# Gate Evidence — wp-08-core (Rust Models, Errors, Paths, Auth) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-08
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STANDARD for C-02 (models/errors), STRICT for C-03 (security core); consolidation of plan wp-08+wp-09 (ruling recorded in GATE-WP-06)
- **Task**: `wp-08-core` (T-03..T-07), role `implementation-engineer`, branch `task/wp-08-core`
- **Source revision**: commit `84f3cdc25353341705f20dc8b3f428b62e4e19d9` (20 paths)
- **Evidence report**: `artifacts/60-implementation/wp-08-core.md`

## Verification

| Check | Result |
|---|---|
| Models: full contracts §3 serde set (68 structs + 21 enums + TaskToken) | PASS |
| Error taxonomy: 32/32 stable codes; messageKey↔locale test | PASS |
| Contract fixtures: 38/38 commands with round-trip tests | PASS |
| Security core: path algorithm order + TOCTOU + symlink/scheme/NUL vectors (24 tests) | PASS |
| Tests: 47 passed / 0 failed; `cargo fmt --check`; `clippy -D warnings` | PASS |
| Scope/commit hygiene; snapshot preserved 3 changed predecessors | PASS |

## Accepted deviations

1. Commit subject trimmed to ≤72 chars per default policy (`feat(core): add rust contract models, error taxonomy and auth core`).
2. Remote `grantId` folds `docId` into the hash input (prevents cross-document grant collisions; data-model formula clarified — to be noted in ADR-005 implementation notes, not a contract break).
3. Added `hex = "0.4"` (transitive already); no `uuid` (deterministic hash ids used).
4. `grant_file` persistent-only per data-model §3.2; session/persistent semantics tested via directory/remote grants.

## Decision

**PASS — integrate `task/wp-08-core` into `feat/v0.1.0`. C-02 and C-03 enter UNVERIFIED (integration pending); local tests green at this revision.**
