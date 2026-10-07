# Performance & resource calibration scripts (T-60; NF04–NF06)

**These are calibration measurements on the current machine (12 cores / 15 GiB,
non-reference) and are never written as compliance.** Plan §5.4: report raw
samples with n, failures and cache/dependency conditions; NF04–NF06 P95 and
budget conclusions belong to a reference environment.

## Layout

| File | Purpose |
|---|---|
| `generate-corpus.mjs` | Deterministic 100KiB/1MiB/10MiB/52MiB mixed CN/EN corpora → `artifacts/70-verification/evidence/generated/` (**git-ignored; never commit generated files**) |
| `measure-nf04-startup.sh` | Cold start / cold open / warm handoff wall-clock to a viewable window |
| `measure-nf05-search.sh` + `nf05.measure.ts` | Parse/index-ready and first-query samples on a generated corpus (own vitest config) |
| `measure-nf06-memory.sh` + `proc_tree.py` | Process-tree PSS/RSS sampling and `ss` socket snapshot |
| `soak-service.sh` | 500-cycle service-level NF07 soak (delegates to `src-tauri/tests/nf07_soak.rs`) |
| `soak-desktop.sh` | Shorter desktop open/close loop (process-level sanity leg) |
| `xwait.c` | 2 ms X11 window-appearance timer (libxdo; test tooling only) |
| `vitest.config.ts` | Runner config for `*.measure.ts` (kept out of the root suite) |

## Prerequisites

- Release binary: `pnpm tauri build --no-bundle`
  (default `src-tauri/target/release/paperstack`, override with `PAPERSTACK_BIN`).
- X11 session for NF04/NF06/soak-desktop (`DISPLAY`, e.g. `:1`) plus
  `cc`, `libxdo`, `xwininfo`; `tests/desktop/xdo-helper` or it is compiled on
  demand into `tests/perf/.bin/`.
- `python3`, `ss` (iproute2) for process-tree accounting; no sudo, no tcpdump
  (plan §5.5: packet capture stays UNVERIFIED and socket observation is used
  instead).

## Commands

```sh
node tests/perf/generate-corpus.mjs                  # all sizes (or --sizes 1MiB)
tests/perf/measure-nf04-startup.sh cold-start "" 30
tests/perf/measure-nf04-startup.sh cold-open artifacts/70-verification/evidence/generated/corpus-100KiB.md 30
tests/perf/measure-nf04-startup.sh warm-handoff artifacts/70-verification/evidence/generated/corpus-1MiB.md 30
PS_PERF_QUERY=needle-4 tests/perf/measure-nf05-search.sh 100KiB
PS_PERF_QUERY=needle-3 PS_PERF_N=30 tests/perf/measure-nf05-search.sh 1MiB
tests/perf/measure-nf06-memory.sh matrix
tests/perf/soak-service.sh
tests/perf/soak-desktop.sh 30
```

Raw CSV/JSON/samples land in `artifacts/70-verification/evidence/wp-32/perf/`
(NF07 samples under `evidence/wp-32/`).

## Measurement definitions & honest limits

- **NF04 cold start / cold open**: from process spawn to a *viewable window* of
  class `paperstack` (`xwait`, 2 ms poll). The app exposes no paint marker, so
  this is a first-screen **proxy**; the OS page cache cannot be dropped without
  sudo and is recorded as warm in the metadata. Warm handoff measures the
  second-instance CLI process lifetime (single-instance transfer), not a
  repaint; a visual warm-open assertion remains UNVERIFIED (wp-34).
- **NF04 full-text-searchable / NF05**: parse + segments ready is the index
  metric; the first query runs the real `findSourceHits`/`findBodyHits` on the
  ready data. Both run the same `src/document` pipeline as the app worker, but
  under vitest (development transform), so absolute numbers are an upper bound
  guideline; the size-scaling behavior is algorithmic.
- **NF06**: PSS/RSS summed over the app process tree from
  `/proc/<pid>/smaps_rollup` (RSS fallback `/proc/self/statm`), sampled every
  200 ms; `ss -tanp` sockets of the tree are recorded as the no-sudo network
  observation. Peak includes startup; report pure/mixed/stress separately.
- **Failure reporting**: each script records `fail-*`/`NO_WINDOW` rows instead
  of hiding them and prints an n/failures summary. Skips are never counted as
  PASS.
