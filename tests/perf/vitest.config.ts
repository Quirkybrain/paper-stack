import { defineConfig } from 'vitest/config'

/**
 * Calibration measurement runner for tests/perf (T-60).
 *
 * The `*.measure.ts` files are measurement harnesses, not pass/fail gates:
 * they run on a generated corpus, write raw samples, and assert only sanity
 * (a result was produced). Run via the wrapper so the corpus and output paths
 * are set up:
 *
 *   tests/perf/measure-nf05-search.sh
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/perf/**/*.measure.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
})
