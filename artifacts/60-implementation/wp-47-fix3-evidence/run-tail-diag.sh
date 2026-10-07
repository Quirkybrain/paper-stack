#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (tail «下一项» diagnostic + close observation)
#
# Variant of run-tail-stage.sh: waits longer for the query to settle, uses the
# search bar's 下一项 (next) button instead of Return, samples WebKit CPU from
# before the query through the WM close, and records the close outcome.
#
# Usage: bash run-tail-diag.sh
set -uo pipefail

EVIDENCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$EVIDENCE/../../.." && pwd)"
export AT_EVIDENCE="$EVIDENCE"
source "$ROOT/tests/desktop/acceptance-lib.sh"
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN
CORPUS="$EVIDENCE/corpus-11MiB.md"
export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache"
TAIL_QUERY="${TAIL_QUERY:-段落 132142}"

fix_conditions
group_header "wp-47-fix3 tail diagnostic (next button, query='$TAIL_QUERY')"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "d-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/d-stage-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}
choose_simplified || log "WARNING: choice not confirmed"
sleep 12

python3 "$EVIDENCE/sample-cpu.py" "$EVIDENCE/d-stage-cpu.csv" 75 0.5 \
  >"$EVIDENCE/d-stage-cpu.out" 2>&1 &
SAMPLER_PID=$!

key ctrl+f
sleep 1
paste_text "$TAIL_QUERY"
sleep 6
shot "d-stage-search-ready.png"
# 下一项 button in the search bar (screenshot-derived coordinates).
click 1163 100
sleep 3
shot "d-stage-tail-hit.png"
key Escape
sleep 1
shot "d-stage-tail-escape.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "diag stage WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"
grep -E "NON-CLEAN|second WM_DELETE|clean termination" "$RUNS" | tail -3 >>"$EVIDENCE/d-stage-close-notes.txt" || true
wait "$SAMPLER_PID" || true

python3 - "$EVIDENCE/d-stage-cpu.csv" >>"$RUNS" 2>&1 <<'PY'
import csv, sys
with open(sys.argv[1], newline='') as handle:
    rows = list(csv.DictReader(handle))
vals = [float(row['total_cpu_percent']) for row in rows]
print(f'-- diag cpu summary: samples={len(rows)} max={max(vals):.1f}% avg={sum(vals)/len(vals):.1f}%')
PY

group_footer
