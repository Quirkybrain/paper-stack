# Gate Evidence — wp-35a-fix-rust (Review A Findings A-01..A-08) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-35A
- **Status**: VALID (A-06 wording + A-05 UX note routed to a bounded architect note task; desktop re-checks in re-review)
- **Date**: 2026-10-07
- **Gate**: Review-correction gate — STRICT
- **Task**: `wp-35a-fix-rust`, role `implementation-engineer`, branch `task/wp-35a-fix-rust`
- **Source revision**: commit `34ce447b3733c7e7b6eae0ee395ac6024d9bdb8a`
- **Evidence report**: `artifacts/60-implementation/wp-35a-fix-rust.md`

## Verification (per checklist)

| Finding | Fix | Test |
|---|---|---|
| A-01 blocker | restore never auto-regrants (`authorize_open_entry`; grant guarded by `entry != Restore`) | `security_paths_auth::restore_does_not_regrant_revoked_authorization` +3 |
| A-02 major | auth gate moved into `TreeService::read_directory_checked` | `tree_listing::read_directory_after_directory_revoke_is_denied` (+clear variant) |
| A-03 | revoke persists delete before memory change (no half-revoked state) | `revoke_delete_failure_keeps_the_grant_and_retry_completes` |
| A-04 | command 29 counts failures, never rejects vs contract | `remote_policy::revoke_session_counts_failed_removals_without_failing` |
| A-05 | read-only degrade ladder wired in AppState + recorded | `storage_open_degrade_ladder_*` |
| A-07 | credential URLs rejected pre-IO (incl. redirects) | `remote_policy::credential_urls_are_rejected_before_any_io` |
| A-08 | details allowlist enforced at single exit | `error::tests::payload_drops_non_allowlisted_details` |
| A-06 | routed: contract `toLowerCase` wording correction → architect note (behavior already aligned; no code delta) | parity 5/5 + 44/44 |
| Suites | Rust 274 (+13); frontend 529; fmt/clippy clean | PASS |

## Notes

One in-cycle self-correction (A-02 gate placement) was folded into the same private, pre-review commit — allowed (not a reviewed/shared commit). Routed items: contract wording (A-06) and degrade-UX note (A-05) will be handled by a bounded solution-architect note task before the Stage Gate.

## Decision

**PASS — integrate `task/wp-35a-fix-rust` into `feat/v0.1.0`. Proceed to `wp-36a-fix-frontend` (B-01..B-10).**
