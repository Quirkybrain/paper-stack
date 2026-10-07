#!/usr/bin/env bash
# NF07 shorter desktop-level open/close loop (T-62, optional leg).
#
# The 500-cycle requirement is covered with full count fidelity by the
# service-level soak (tests/perf/soak-service.sh). This script adds a real
# process-level sanity loop: launch the release app with a document, wait for
# the window, close it via WM_DELETE_WINDOW, and require a clean exit each
# cycle. "Refresh" is not automated at desktop level (it needs a real file
# change + watch event + visual confirmation); that leg stays service-level.
#
# Usage: tests/perf/soak-desktop.sh [cycles] [file]
# Env: PAPERSTACK_BIN, DISPLAY
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CYCLES="${1:-30}"
FILE="${2:-$ROOT/fixtures/rendering/mixed-cn-en.md}"
BIN="${PAPERSTACK_BIN:-$ROOT/src-tauri/target/release/paperstack}"
EVIDENCE="$ROOT/artifacts/70-verification/evidence/wp-32"
mkdir -p "$EVIDENCE" "$ROOT/tests/perf/.bin"

[[ -x "$BIN" && -f "$FILE" ]] || { echo "missing binary or document" >&2; exit 2; }

if [[ ! -x "$ROOT/tests/perf/.bin/xwait" || "$ROOT/tests/perf/xwait.c" -nt "$ROOT/tests/perf/.bin/xwait" ]]; then
  cc -O2 "$ROOT/tests/perf/xwait.c" -lxdo -lX11 -o "$ROOT/tests/perf/.bin/xwait"
fi
XWAIT="$ROOT/tests/perf/.bin/xwait"

HELPER="$ROOT/tests/desktop/xdo-helper"
if [[ ! -x "$HELPER" ]]; then
  cc -O2 "$ROOT/tests/desktop/xdo-helper.c" -lxdo -lX11 -o "$ROOT/tests/perf/.bin/xdo-helper"
  HELPER="$ROOT/tests/perf/.bin/xdo-helper"
fi

CSV="$EVIDENCE/nf07-desktop-loop.csv"
echo "cycle,launch_ms,close_ms,exit_status" > "$CSV"
failures=0
pid=""
cleanup() { [[ -n "$pid" ]] && kill -TERM "$pid" 2>/dev/null || true; }
trap cleanup EXIT

for ((cycle = 1; cycle <= CYCLES; cycle++)); do
  t0="$(date +%s%N)"
  "$BIN" "$FILE" >/dev/null 2>&1 &
  pid=$!
  if ! "$XWAIT" paperstack 30000 >/dev/null; then
    echo "$cycle,,,no-window" >> "$CSV"
    failures=$((failures + 1))
    kill -TERM "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    pid=""
    continue
  fi
  t1="$(date +%s%N)"
  launch_ms=$(( (t1 - t0) / 1000000 ))

  t2="$(date +%s%N)"
  "$HELPER" close paperstack >/dev/null 2>&1 || true
  waited=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 0.05
    waited=$((waited + 50))
    if [[ $waited -ge 8000 ]]; then
      kill -TERM "$pid" 2>/dev/null || true
      sleep 0.5
      kill -KILL "$pid" 2>/dev/null || true
      break
    fi
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "$cycle,$launch_ms,,unclean" >> "$CSV"
    failures=$((failures + 1))
  else
    wait "$pid" 2>/dev/null
    exit_code=$?
    t3="$(date +%s%N)"
    close_ms=$(( (t3 - t2) / 1000000 ))
    echo "$cycle,$launch_ms,$close_ms,exit_$exit_code" >> "$CSV"
    if [[ $exit_code -ne 0 ]]; then failures=$((failures + 1)); fi
  fi
  pid=""
  sleep 0.2
done

echo "NF07 desktop loop: cycles=$CYCLES failures=$failures raw=$CSV"
[[ "$failures" -eq 0 ]]
