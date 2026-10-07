# Contract & semantic vectors (T-61; NF11)

Shared, machine-readable vectors executed from **both** implementations:

| Vector | Front-end runner | Rust runner |
|---|---|---|
| `vectors/search-parity.json` | `search-parity.test.ts` (`findSourceHits`) | `src-tauri/tests/contract_search_parity.rs` (`FilesService::search_source`) |
| `vectors/utf16-utf8.json` | `utf16-utf8.test.ts` | same Rust test (`str::encode_utf16`, char-boundary) |
| `vectors/error-taxonomy.json` | `error-taxonomy.test.ts` (locale catalog 32/32) | same Rust test (`ErrorCode::ALL` field by field) |
| `vectors/utf16-utf8-js-only.json` | `utf16-utf8.test.ts` (invalid/lone-surrogate clamping) | not applicable (valid Rust UTF-8 cannot contain it) |

Expected values are derived from the normative sources — contracts §1.2/§2.1/
§5, ADR-007, rendering-pipeline §2.4c/§3, SRS §5.3 — never from current
implementation output. `fixtures/search/search-samples.md` is the fixed file
corpus for the file-level search case.

## Folding rule (documented)

`caseSensitive=false` folds both sides with Unicode default lowercase
conversion (JS `String.prototype.toLowerCase` / Rust `char::to_lowercase`);
literal substring only, no normalization, no regex, leftmost non-overlapping
matches in document order, UTF-8 byte offsets, 1-based LF line numbers.

Two divergences are pinned per side in `boundaryCases` instead of being hidden:

1. `dotted-capital-i-length-changing-fold` — accepted by ADR-007: U+0130 folds
   to two code units; Rust maps a folded match back to the enclosing original
   character, the front-end clamps the folded index in the original string.
2. `greek-final-sigma-context-fold` — **contract divergence (tracked, defect in
   Rust)**: JS `toLowerCase` applies the Unicode Final_Sigma rule
   (`Σ` at a word end → `ς`), Rust's per-code-point fold does not
   (`Σ` → `σ`), so `search_source` can return fewer/different hits than the
   front-end. contracts §2.1 requires the same `toLowerCase` semantics; the
   fix belongs in `src-tauri/src/services/files.rs` (`fold_segment`/
   `fold_query`) and must be re-verified against this vector. The wp-32 report
   carries the finding.

## Running

```sh
# Front-end side (root suite cannot see tests/contracts; this config is the runner)
pnpm vitest run --config tests/contracts/vitest.config.ts

# Rust side
cargo test --manifest-path src-tauri/Cargo.toml --test contract_search_parity
```

Both suites must pass together; a vector change is a contract change and
requires updating both runners and the affected report in the same change.
