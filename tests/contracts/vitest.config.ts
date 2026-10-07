import { defineConfig } from 'vitest/config'

/**
 * Contract/semantic vector suite (T-61; NF11).
 *
 * The root vite config includes only files under `src`, and the wp-32 write
 * scope is `tests/contracts/**` + `tests/perf/**`, so this suite runs through
 * its own config instead of being silently absent from `pnpm test`:
 *
 *   pnpm vitest run --config tests/contracts/vitest.config.ts
 *
 * It executes the shared vectors that the Rust side
 * (`src-tauri/tests/contract_search_parity.rs`) reads from the same JSON, plus
 * the fixed rendering/security fixtures through the real parse pipeline, and
 * the T-66 integration boundary check that binds
 * `fixtures/contracts/commands.json` to `src/services/**` (runtime replay plus
 * a type-level pass through the `typecheck` block below).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/contracts/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Type-level half of the integration boundary check: Vitest runs `tsc`
    // with tests/contracts/tsconfig.typecheck.json (which includes these test
    // files), so a service/type drift fails the same command that executes
    // the runtime checks.
    typecheck: {
      enabled: true,
      tsconfig: './tests/contracts/tsconfig.typecheck.json',
      include: ['tests/contracts/integration-boundary.test.ts'],
    },
  },
})
