# Gate Evidence — wp-43-package (Packaging + Legal) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-43
- **Status**: VALID — condition C2 satisfied
- **Date**: 2026-10-08
- **Gate**: Packaging/legal gate — STRICT (plan §6.4 C2; R30/NF12)
- **Task**: `wp-43-package`, role `implementation-engineer`, branch `task/wp-43-package`
- **Source revision**: commit `7f5de8a96a5549629b912fa984e6c43d62b6790e`
- **Evidence report**: `artifacts/60-implementation/wp-43-package.md`

## Verification

| Check | Result |
|---|---|
| LICENSE = unmodified GPLv3 (sha256 `3972dc97…`, from Debian canonical copy, cmp-verified) | PASS |
| THIRD_PARTY_NOTICES (263 npm prod + 540 Rust crates + resources; method/limits/lock hashes) | PASS |
| `.deb` built: `paperstack_0.1.0_amd64.deb` 10.99 MiB sha256 `b0f44fdb…`; copy in `output/` | PASS |
| `dpkg-deb -I/-c`: metadata + payload incl. desktop/icon + bundled LICENSE/notices byte-identical | PASS |
| Extract-run on X11: offline license + notices rendered; clean exit; screenshots recorded | PASS |
| Rust 279 tests (+5); clippy/fmt clean | PASS |

## Recorded limitations

`productName` set ASCII `paperstack` for correct package naming (display name unchanged); no `License:` field emitted by tauri-bundler 2.12.1 (license present in payload/metadata — recorded); clean-system `dpkg -i` needs sudo → UNVERIFIED; A9 remains null+reason.

## Decision

**PASS — integrate `task/wp-43-package` into `feat/v0.1.0`. Proceed to wp-44 IT acceptance (C3).**
