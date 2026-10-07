#!/usr/bin/env bash
# NF05 calibration wrapper (T-60). Ensures the generated corpora exist, then
# runs the measurement harness (tests/perf/nf05.measure.ts) through its own
# vitest config so the result is reproducible from the committed scripts.
#
# Usage: tests/perf/measure-nf05-search.sh [size]     (default 1MiB)
# Env: PS_PERF_N (default 30), PAPERSTACK corpus override via PS_PERF_CORPUS
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SIZE="${1:-1MiB}"
GENERATED="$ROOT/artifacts/70-verification/evidence/generated"
EVIDENCE="$ROOT/artifacts/70-verification/evidence/wp-32/perf"
CORPUS="$GENERATED/corpus-$SIZE.md"
N="${PS_PERF_N:-30}"
OUT="${PS_PERF_OUT:-$EVIDENCE/nf05-$SIZE-raw.json}"

mkdir -p "$EVIDENCE"
if [[ ! -f "$CORPUS" ]]; then
  node tests/perf/generate-corpus.mjs --sizes "$SIZE"
fi

PS_PERF_CORPUS="$CORPUS" PS_PERF_N="$N" PS_PERF_OUT="$OUT" \
  npx vitest run --config tests/perf/vitest.config.ts
echo "NF05 raw: $OUT"
