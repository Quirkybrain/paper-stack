#!/usr/bin/env bash
# NF04 startup/open calibration (T-60; requirements NF04; plan §5.4).
#
# Measures, on this machine only (12-core/15GiB, non-reference):
#   cold-start        fresh release process, no document -> viewable window
#   cold-open <file>  fresh release process with a document -> viewable window
#   warm-handoff <f>  running instance + second-instance CLI handoff -> CLI exit
#
# "Viewable window" is the observable first-screen proxy available without
# instrumentation; the app exposes no paint marker, and OS page caches cannot
# be dropped without sudo (recorded, not hidden). Results are CALIBRATION data,
# never a compliance claim. Each group reports n and failures honestly.
#
# Usage: tests/perf/measure-nf04-startup.sh <mode> [file] [n]
# Env: PAPERSTACK_BIN (default src-tauri/target/release/paperstack)
#      DISPLAY, NF04_TIMEOUT_MS (default 30000)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-}"
FILE="${2:-}"
N="${3:-${NF04_N:-30}}"
BIN="${PAPERSTACK_BIN:-$ROOT/src-tauri/target/release/paperstack}"
TIMEOUT_MS="${NF04_TIMEOUT_MS:-30000}"
EVIDENCE="$ROOT/artifacts/70-verification/evidence/wp-32/perf"
mkdir -p "$EVIDENCE" "$ROOT/tests/perf/.bin"

if [[ -z "$MODE" || ! -x "$BIN" ]]; then
  echo "usage: $0 <cold-start|cold-open <file>|warm-handoff <file>> [n]" >&2
  echo "missing or non-executable release binary: $BIN" >&2
  exit 2
fi

# --- helpers -----------------------------------------------------------------
build_xwait() {
  local xwait="$ROOT/tests/perf/.bin/xwait"
  if [[ ! -x "$xwait" || "$ROOT/tests/perf/xwait.c" -nt "$xwait" ]]; then
    cc -O2 "$ROOT/tests/perf/xwait.c" -lxdo -lX11 -o "$xwait" || return 1
  fi
  echo "$xwait"
}

xdo_helper() {
  if [[ -x "$ROOT/tests/desktop/xdo-helper" ]]; then
    echo "$ROOT/tests/desktop/xdo-helper"
  elif [[ -x "$ROOT/tests/perf/.bin/xdo-helper" ]]; then
    echo "$ROOT/tests/perf/.bin/xdo-helper"
  elif cc -O2 "$ROOT/tests/desktop/xdo-helper.c" -lxdo -lX11 -o "$ROOT/tests/perf/.bin/xdo-helper" 2>/dev/null; then
    echo "$ROOT/tests/perf/.bin/xdo-helper"
  else
    echo ""
  fi
}

wait_for_exit() { # pid timeout_ms
  local pid="$1" timeout="$2" waited=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 0.05
    waited=$((waited + 50))
    [[ $waited -ge $timeout ]] && return 1
  done
  return 0
}

close_app() { # pid
  local pid="$1" helper
  helper="$(xdo_helper)"
  if [[ -n "$helper" ]]; then
    "$helper" close paperstack >/dev/null 2>&1 || true
  fi
  if ! wait_for_exit "$pid" 8000; then
    kill -TERM "$pid" 2>/dev/null || true
    wait_for_exit "$pid" 4000 || kill -KILL "$pid" 2>/dev/null || true
    return 1
  fi
  return 0
}

ensure_no_app() {
  local helper
  helper="$(xdo_helper)"
  if [[ -n "$helper" ]] && "$helper" find paperstack >/dev/null 2>&1; then
    echo "an app window already exists; close it before measuring" >&2
    return 1
  fi
  return 0
}

stats() { # csv: second column value, last column status
  local file="$1"
  local values
  values="$(awk -F, 'NR > 1 && $NF == "ok" { print $2 }' "$file" | sort -n)"
  local n
  n="$(printf '%s\n' "$values" | grep -c . || true)"
  if [[ "$n" -eq 0 ]]; then
    echo "n=0"
    return
  fi
  printf '%s\n' "$values" | awk -v n="$n" '
    { v[NR] = $1; sum += $1 }
    END {
      printf "n=%d min=%s p50=%s p95=%s max=%s mean=%.1f\n",
        n, v[1], v[int((n - 1) * 0.5) + 1], v[int((n - 1) * 0.95) + 1], v[n], sum / n
    }'
}

write_metadata() {
  local file="$1"
  {
    echo "date=$(date -Is)"
    echo "host_kernel=$(uname -r)"
    echo "cores=$(nproc)"
    echo "memory=$(LC_ALL=C free -m | awk '/^Mem:/ {print $2 "MiB"}')"
    echo "display=${DISPLAY:-unset}"
    echo "binary=$BIN"
    echo "binary_sha256=$(sha256sum "$BIN" | awk '{print $1}')"
    echo "binary_mtime=$(stat -c %y "$BIN")"
    echo "mode=$MODE"
    echo "timeout_ms=$TIMEOUT_MS"
    echo "note=viewable-window proxy; OS page cache NOT dropped (no sudo); calibration only"
  } > "$file"
}

# --- modes -------------------------------------------------------------------
run_cold() { # label extra_arg
  local label="$1" extra="$2"
  local csv="$EVIDENCE/nf04-$label.csv"
  local xwait helper failures=0
  xwait="$(build_xwait)" || { echo "cannot build xwait" >&2; exit 2; }
  helper="$(xdo_helper)"
  [[ -n "$helper" ]] || echo "warning: xdo-helper unavailable; falling back to SIGTERM" >&2
  ensure_no_app || exit 2

  echo "iteration,total_ms,xwait_ms,status" > "$csv"
  local i t0 t1 total xwait_ms status pid out
  for ((i = 1; i <= N; i++)); do
    t0="$(date +%s%N)"
    if [[ -n "$extra" ]]; then
      "$BIN" "$extra" >/dev/null 2>&1 &
    else
      "$BIN" >/dev/null 2>&1 &
    fi
    pid=$!
    out="$("$xwait" paperstack "$TIMEOUT_MS")"
    status="ok"
    if [[ -z "$out" ]]; then status="fail-window"; failures=$((failures + 1)); fi
    t1="$(date +%s%N)"
    total_ms=$(( (t1 - t0) / 1000000 ))
    xwait_ms="$(printf '%s' "$out" | awk '{print $1}')"
    [[ -n "$xwait_ms" ]] || xwait_ms=""
    echo "$i,$total_ms,$xwait_ms,$status" >> "$csv"
    if ! close_app "$pid"; then
      echo "warning: iteration $i required SIGTERM/SIGKILL" >&2
    fi
    sleep 0.3
  done
  write_metadata "$EVIDENCE/nf04-$label.meta"
  echo "NF04 mode=$label results: $(stats "$csv") failures=$failures raw=$csv"
  [[ "$failures" -eq 0 ]]
}

run_warm_handoff() {
  local file="$1"
  [[ -f "$file" ]] || { echo "handoff file not found: $file" >&2; exit 2; }
  local csv="$EVIDENCE/nf04-warm-handoff.csv"
  local xwait failures=0
  xwait="$(build_xwait)" || { echo "cannot build xwait" >&2; exit 2; }
  ensure_no_app || exit 2

  "$BIN" "$file" >/dev/null 2>&1 &
  local main_pid=$!
  "$xwait" paperstack "$TIMEOUT_MS" >/dev/null || { echo "main instance did not appear" >&2; exit 2; }
  sleep 1

  echo "iteration,handoff_ms,status" > "$csv"
  local i t0 t1 status second_pid
  for ((i = 1; i <= N; i++)); do
    t0="$(date +%s%N)"
    "$BIN" "$file" >/dev/null 2>&1 &
    second_pid=$!
    status="ok"
    if ! wait_for_exit "$second_pid" 15000; then
      status="fail-handoff"
      failures=$((failures + 1))
      kill -TERM "$second_pid" 2>/dev/null || true
    fi
    t1="$(date +%s%N)"
    echo "$i,$(( (t1 - t0) / 1000000 )),$status" >> "$csv"
  done
  close_app "$main_pid" || true
  write_metadata "$EVIDENCE/nf04-warm-handoff.meta"
  echo "NF04 mode=warm-handoff (second-instance CLI exit proxy) results: $(stats "$csv") failures=$failures raw=$csv"
  [[ "$failures" -eq 0 ]]
}

case "$MODE" in
  cold-start) run_cold cold-start "" ;;
  cold-open)
    [[ -f "$FILE" ]] || { echo "cold-open needs an existing file" >&2; exit 2; }
    run_cold "cold-open-$(basename "$FILE")" "$FILE" ;;
  warm-handoff) run_warm_handoff "$FILE" ;;
  *) echo "unknown mode $MODE" >&2; exit 2 ;;
esac
