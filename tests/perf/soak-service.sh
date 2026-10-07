#!/usr/bin/env bash
# NF07 500-cycle soak runner (T-62; requirements NF07). Delegates the loop to
# the Rust service-level test (src-tauri/tests/nf07_soak.rs) for count and
# handle/memory fidelity, and keeps the raw samples under the evidence area.
#
# Usage: tests/perf/soak-service.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

EVIDENCE="$ROOT/artifacts/70-verification/evidence/wp-32"
mkdir -p "$EVIDENCE"
export PS_NF07_OUT="$EVIDENCE/nf07-soak-samples.txt"

cargo test --manifest-path src-tauri/Cargo.toml --test nf07_soak -- --nocapture \
  | tee "$EVIDENCE/nf07-soak.log"
echo "NF07 samples: $PS_NF07_OUT"
