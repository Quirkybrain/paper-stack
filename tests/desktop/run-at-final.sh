#!/usr/bin/env bash
# run-at-final.sh — wp-42 (G-01 / condition C1) consolidated refresh driver:
# re-runs ALL AT01–AT30 desktop scenarios against ONE current-tree release
# binary and writes the whole batch into a single evidence directory
# (artifacts/70-verification/evidence/at-final/).
#
# Design: the classic scenarios are the proven wp-34 group scripts
# (run-at-a..e.sh, AT01–AT30); the wp-34b/34d/38 re-run scripts then drive the
# corrected chains for the items whose implementation changed after their first
# execution (AT02/06/09/12/14/15/16/25/27/30 by wp-38; AT19/26/28 by wp-34d;
# AT07 by rerun2). All sub-scripts share AT_EVIDENCE=at-final, the same
# isolated XDG_DATA_HOME and the same fixed conditions, so every screenshot in
# this directory was produced from the recorded binary in one batch.
#
# Usage: bash tests/desktop/run-at-final.sh [all|core|rerun2|wp34d|wp38]
#   all (default) — the full batch below, in order
#   core          — run-at-a..e.sh only
#   rerun2        — AT07 recovery chain (also covers AT14/15 supplementary)
#   wp34d         — at19 + at26 + at28 (wp-34d sections)
#   wp38          — at02 at06 at06-revoke at09 at12 at14 at15 at16 at25 at27 at30
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AT_EVIDENCE="${AT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/at-final}"
BIN="$ROOT/src-tauri/target/release/paperstack"
WRAP_LOG="$AT_EVIDENCE/wrapper.log"

mkdir -p "$AT_EVIDENCE"

bin_hash() { sha256sum "$BIN" 2>/dev/null | cut -d' ' -f1; }

{
  echo "===== wp-42 at-final wrapper start $(date -Is) ====="
  echo "HEAD $(git -C "$ROOT" rev-parse HEAD) branch $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  echo "binary $BIN"
  echo "binary sha256 $(bin_hash) size=$(stat -c%s "$BIN" 2>/dev/null)"
  echo "display ${DISPLAY_AT:-:1} evidence $AT_EVIDENCE"
} | tee -a "$WRAP_LOG"

run_step() {
  local label="$1"; shift
  echo "===== START $label $(date -Is) =====" | tee -a "$WRAP_LOG"
  ( cd "$ROOT" && bash "$@" )
  local st=$?
  echo "===== END $label exit=$st $(date -Is) binary_sha256=$(bin_hash) =====" | tee -a "$WRAP_LOG"
  return 0
}

run_core() {
  run_step core-a tests/desktop/run-at-a.sh
  run_step core-b tests/desktop/run-at-b.sh
  run_step core-c tests/desktop/run-at-c.sh
  run_step core-d tests/desktop/run-at-d.sh
  run_step core-e tests/desktop/run-at-e.sh
}
run_rerun2() {
  run_step rerun2-at07 tests/desktop/run-at-rerun2.sh
}
run_wp34d() {
  run_step wp34d-at19 tests/desktop/run-at-rerun-wp34d.sh at19
  run_step wp34d-at26 tests/desktop/run-at-rerun-wp34d.sh at26
  run_step wp34d-at28 tests/desktop/run-at-rerun-wp34d.sh at28
}
run_wp38() {
  local s
  for s in at02 at06 at06-revoke at09 at12 at14 at15 at16 at25 at27 at30; do
    run_step "wp38-$s" tests/desktop/run-at-rerun-wp38.sh "$s"
  done
}

case "${1:-all}" in
  all)   run_core; run_rerun2; run_wp34d; run_wp38 ;;
  core)  run_core ;;
  rerun2) run_rerun2 ;;
  wp34d) run_wp34d ;;
  wp38)  run_wp38 ;;
  *) echo "usage: $0 [all|core|rerun2|wp34d|wp38]" >&2; exit 2 ;;
esac

{
  echo "===== wrapper done $(date -Is) binary_sha256=$(bin_hash) ====="
  if pgrep -x paperstack >/dev/null 2>&1; then
    echo "WARNING: paperstack process still running:"
    pgrep -ax paperstack
  else
    echo "pgrep -x paperstack: no process remains"
  fi
} | tee -a "$WRAP_LOG"
