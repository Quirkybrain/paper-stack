# Stage Gate — Release (v0.1.0) — Evaluation and Decision

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model; this is the terminal Stage Gate record and no specialist role owns it.
- **Artifact ID**: GATE-STAGE-RELEASE
- **Status**: VALID
- **Date**: 2026-10-08
- **Target Stage**: `release` (config/project.md)
- **Evaluated revision**: `feat/v0.1.0` @ `8c8f46d` (all wp/rm integrated; contract `paperstack-ipc-r1`; final package rebuilt at `a4e7a1c`)

## Stage Gate criteria (framework + SRS §8.4)

| Criterion | Result |
|---|---|
| Required Artifacts exist, valid, traceable (requirements→design→contracts→code→tests→acceptance) | PASS (sysver report; R01–R30 fully traced; Producer audit 132/132) |
| All applicable component quality gates passed; integration gate passed | PASS (wp gates + GATE-WP-40 Integration Gate) |
| Acceptance evidence on the final product tree | PASS — AT 30/30 (Rev 7 refresh + focused re-verifications; restrained sub-items documented), IT 8/8 (Rev 3), contracts 89, frontend 588, Rust 282 |
| Independent reviews closed | PASS — reviews A/B FAIL findings fixed; combined re-review 18/18 VERIFIED (PASS-WITH-NOTES) |
| Release package built and verified | PASS — `.deb` rebuilt from verified tree (sha256 `f72e3dba…`); metadata/payload/extract-run/system-open/offline-license verified |
| Documentation complete (DR-06) | PASS — README, user guide, known limitations, release notes; claims limited per DR-05 |
| Open-source information (PC-07/NF12) | **CONDITIONAL — distribution blocker A9**: GPLv3 LICENSE + THIRD_PARTY_NOTICES complete; the mandatory “matching corresponding source entry” for public distribution is NOT configured; R30/NF12 forbid issuing without it and forbid a fabricated URL. Owner input required. |
| Public claim scope | X11/GNOME verified on this machine; Wayland unverified (A4); performance numbers are local calibration, not certification (A8) |
| Zero-issue conditions (source protection, permissions, security, version mislabeling, core-task crashes) | PASS within verified scope (extensive evidence; UNVERIFIED list retained) |

## Decision

**PASS — Release Stage Gate for the repository release: `feat/v0.1.0` is release-ready and is merged to `main` (guarded local merge, `rm-final`).**
**Public distribution remains BLOCKED pending owner input A9 (real source entry); claims limited to the verified scope (A4/A8).** This is the honest terminal state; no fabricated data was used.

## Residual items (carried to Checkpoint)

1. **A9 owner input** — real corresponding-source entry for public distribution (unblocks with a one-line metadata update; release can then be published).
2. **A4 environment** — Wayland acceptance not executable here; rows remain UNVERIFIED; public claims limited accordingly.
3. **A8 calibration** — NF04–NF06 numbers are local measurements (12c/15GiB, non-reference); certification requires the reference-class machine.
4. Recorded limitations — see `docs/paperstack/known-limitations.md` (asset-scope append-only, O-48-1, full-mode superlinearity on very large docs, idle PSS above design target on this machine, etc.).
