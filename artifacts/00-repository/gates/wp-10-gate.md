# Gate Evidence — wp-10-files (Document & Directory Read Services) → feat/v0.1.0

- **Producer**: orchestrator:main-session | Deviation: Gate evidence is authored by the Stage Orchestrator because Gate decisions are exclusively orchestrator-owned under the framework Gate model. Not a specialist deliverable.
- **Artifact ID**: GATE-WP-10
- **Status**: VALID
- **Date**: 2026-10-07
- **Gate**: Component Quality Gate — STRICT (C-04 file service)
- **Task**: `wp-10-files` (T-08..T-11), role `implementation-engineer`, branch `task/wp-10-files`
- **Source revision**: commit `79bc3d2` (26 files)
- **Evidence report**: `artifacts/60-implementation/wp-10-files.md`

## Verification

| Check | Result |
|---|---|
| Open/decode matrix (extensions, BOM, CRLF, empty, binary, Latin-1) | PASS |
| Stable read (§7.4 S1/N; unstable → `PS_IO_CHANGED`; injectable timer) | PASS |
| read_document initial/restore/refresh/relink (both relink branches) | PASS |
| Source info/window/search (line index, windowed, `complete=false`, version-checked scan) | PASS |
| Tree: lazy, symlink states, 2000 truncation, distinct error states | PASS |
| Tests: 108 passed / 0 failed; fmt/clippy clean; read-only guarantee (no write paths) | PASS |
| New deps: none; no commands added; scope hygiene + snapshot predecessors preserved | PASS |

## Accepted deviations

`>50MiB` adds one streaming SHA-256 pass (required by contract's `contentHash`); snapshot cache cap ≤2 mirrors frontend LRU; `search_source` budget 256MiB calibratable; window/relink edge semantics recorded in report §5; no commands/no new crates.

## Decision

**PASS — integrate `task/wp-10-files` into `feat/v0.1.0`. C-04 enters UNVERIFIED (integration pending); local tests green at this revision.**
