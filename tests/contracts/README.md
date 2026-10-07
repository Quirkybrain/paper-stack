# Contract & semantic vectors (T-61; NF11) + integration boundary (T-66)

Shared, machine-readable vectors executed from **both** implementations:

| Vector | Front-end runner | Rust runner |
|---|---|---|
| `vectors/search-parity.json` | `search-parity.test.ts` (`findSourceHits`) | `src-tauri/tests/contract_search_parity.rs` (`FilesService::search_source`) |
| `vectors/utf16-utf8.json` | `utf16-utf8.test.ts` | same Rust test (`str::encode_utf16`, char-boundary) |
| `vectors/error-taxonomy.json` | `error-taxonomy.test.ts` (locale catalog 32/32) | same Rust test (`ErrorCode::ALL` field by field) |
| `vectors/utf16-utf8-js-only.json` | `utf16-utf8.test.ts` (invalid/lone-surrogate clamping) | not applicable (valid Rust UTF-8 cannot contain it) |
| `fixtures/contracts/commands.json` | `integration-boundary.test.ts` (service-layer replay) | `src-tauri/tests/contract_shape.rs` (typed round-trip) |

Expected values are derived from the normative sources — contracts §1.2/§2.1/
§5, ADR-007, rendering-pipeline §2.4c/§3, SRS §5.3 — never from current
implementation output. `fixtures/search/search-samples.md` is the fixed file
corpus for the file-level search case.

## Folding rule (documented)

`caseSensitive=false` folds both sides per Unicode code point with Unicode
default lowercase conversion (front-end `foldLower` in
`src/features/search/search-core.ts`, Rust `char::to_lowercase`), literal
substring only, no normalization, no regex, leftmost non-overlapping matches in
document order, UTF-8 byte offsets, 1-based LF line numbers. The front-end must
**not** use whole-string `String.prototype.toLowerCase` (context-sensitive
`Final_Sigma` would diverge from Rust); the former `greek-final-sigma-context-fold`
divergence was fixed in wp-32a by aligning both sides and is now asserted as
the shared parity case `greek-final-sigma-per-code-point` by both runners.

One accepted per-side divergence remains pinned in `boundaryCases`:

1. `dotted-capital-i-length-changing-fold` — accepted by ADR-007: U+0130 folds
   to two code units; Rust maps a folded match back to the enclosing original
   character, the front-end clamps the folded index in the original string.

## Integration boundary check (T-66)

`integration-boundary.test.ts` binds the frozen `fixtures/contracts/commands.json`
samples to the front-end service layer (`src/services/**`):

- **runtime**: every command sample is validated against a shape spec derived
  from the service-layer models (required fields, field types, no unknown
  fields) and replayed through the real service wrapper with only the Tauri
  core mocked; the wrapper must dispatch exactly the fixture command with the
  contract argument envelope and pass the fixture response through unmodified;
- **type level**: the command order, request/response models and shape specs
  are bound to the actual `src/services/*` function signatures, enforced by the
  suite's Vitest typecheck step (`typecheck` block in `vitest.config.ts` +
  `tsconfig.typecheck.json`, checker `tsc`).

The fixtures are frozen contract input; the test never modifies them. A vector
change is a contract change and requires updating both runners (and the
typed fixture round-trip in Rust) in the same change.

## Running

```sh
# Front-end side (root suite cannot see tests/contracts; this config is the runner).
# Includes the runtime suites, the rendering/security fixtures through the real
# parse pipeline, and the type-level half of the integration boundary check.
pnpm vitest run --config tests/contracts/vitest.config.ts

# Rust side
cargo test --manifest-path src-tauri/Cargo.toml --test contract_search_parity
cargo test --manifest-path src-tauri/Cargo.toml --test contract_shape
cargo test --manifest-path src-tauri/Cargo.toml --test commands_surface
```

Both suites must pass together. Observed on 2026-10-07 (wp-40, revision
`f2f2a3d`): 6 files / 89 tests passed (5 executed test files / 85 tests, plus
the typecheck view of `integration-boundary.test.ts`; `Type Errors no errors`).
