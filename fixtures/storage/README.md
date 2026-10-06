# Storage fixtures (wp-11, T-13)

Persisted storage record samples for the SQLite service (`services/storage.rs`).
The samples fix the **serialized record shape** so schema/contract drift is
caught, never user content: anchors only, no document text (data-model §2/§3.3;
SRS §6.2; INV-AR-01).

| File | Shape | Guarded by |
|---|---|---|
| `anchor-record.example.json` | `PositionRecord`: `{ docId, anchor { versionHash, headingPath, blockFingerprint, offsetRatio, sourceRange { startByte, endByte } }, updatedAtMs }` (contracts §3.4; data-model §3.3) | `src-tauri/tests/storage_fixtures.rs` — deserialize into the Rust types, assert the anchor invariants (64-hex `versionHash`, `fp1:` + 16-hex fingerprint, `0..=1` ratio, half-open byte range, CJK heading path) and round-trip JSON semantically; a second test persists it through `save_position`/`load_position` in a tempdir database |

Field names are exactly the serde `camelCase` wire names (`SourceRange` uses
`startByte`/`endByte`); changing them requires a contract revision, and this
fixture must be updated in the same change. Values are synthetic (fictional
docId/path-free heading block), so the file carries no personal data.

Tests never modify these files (read-only guarantee, security-model §8).
