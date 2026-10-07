# PaperStack fixtures (NF11 fixed samples)

Versioned, small, deterministic inputs for tests and calibrated measurements.
Tests never modify these files (read-only guarantee, security-model §8); the
large corpora for performance calibration are **generated** under the ignored
`artifacts/70-verification/evidence/generated/` area, never committed.

| Directory | Purpose | Contract reference |
|---|---|---|
| `reader-min/` | Minimal mixed CN/EN reader smoke document (wp-19/21). | R08–R13; ui-spec regression samples |
| `encoding/` | Byte-exact open/decode matrix (BOM, CRLF, binary, Latin-1, empty, CJK+emoji). | contracts §2.1 (command 4); R01–R03 |
| `rendering/` | rendering-pipeline §7 fixed classes: mixed CN/EN, math, code, tables, mermaid, images, links, edge cases, source map. | rendering-pipeline §7; NF11 |
| `search/` | Search semantics sample (folded hits, formula source, alt text, case, CJK/emoji/combining, zero result). | ADR-007; R17 |
| `security/` | Malicious raw-HTML / URL / macro / mermaid-overflow samples for the sanitize and failure-isolation checks. | security-model §5; R09/R10/R12 |
| `update/` | Small v1/v2 documents plus ambiguity and moved-heading variants for the update/anchor flows. | wp-28; R19/R21/R22 |
| `contracts/` | Command/model wire-shape samples (round-trip pinned by `src-tauri/tests/contract_shape.rs`). | contracts §2/§3; NF11 |
| `storage/` | Persisted record shape samples (anchor record, no document text). | contracts §3.4; INV-AR-01 |
| `tree/` | Directory-tree state samples (symlinks, outside root, empty dir). | contracts §3.2; R02/R25 |

Conventions: UTF-8; LF line endings except `encoding/crlf.md`; short files;
no timestamps or machine-specific paths; every file's purpose recorded in the
directory README and, for searchable samples, exercised by
`tests/contracts/` and the rendering-pipeline tests.
