#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (CPU pin bisect: no activation)
#
# Same as run-block-probe.sh but stops after focusing 下一项 and waits 40 s
# without activating. Determines whether the CPU pin is caused by the key
# activation or by an earlier step (search open / paste / tab focus).
#
# Usage: bash run-pin-bisect.sh
set -uo pipefail

EVIDENCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$EVIDENCE/../../.." && pwd)"
export AT_EVIDENCE="$EVIDENCE"
source "$ROOT/tests/desktop/acceptance-lib.sh"
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN
CORPUS="$EVIDENCE/corpus-11MiB.md"
export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache"
TAIL_QUERY="${TAIL_QUERY:-x_{132139}}"
DO_TABS="${DO_TABS:-1}"

fix_conditions
group_header "wp-47-fix3 pin bisect (tabs=$DO_TABS no activate)"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "q-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/q-stage-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}
choose_simplified || log "WARNING: choice not confirmed"
sleep 12

python3 "$EVIDENCE/sample-cpu.py" "$EVIDENCE/q-stage-cpu.csv" 70 0.5 \
  >"$EVIDENCE/q-stage-cpu.out" 2>&1 &
SAMPLER_PID=$!

key ctrl+f
sleep 1
paste_text "$TAIL_QUERY"
sleep 6
shot "q1-search-ready.png"
if [[ "$DO_TABS" == "1" ]]; then
  key Tab
  key Tab
  key Tab
  sleep 0.5
  shot "q2-tabs.png"
fi
sleep 40
shot "q3-after-40s.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "pin bisect WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"
wait "$SAMPLER_PID" || true

python3 - "$EVIDENCE/q-stage-cpu.csv" >>"$RUNS" 2>&1 <<'PY'
import csv, sys
with open(sys.argv[1], newline='') as handle:
    rows = list(csv.DictReader(handle))
vals = [float(row['total_cpu_percent']) for row in rows]
print(f'-- pin bisect cpu: samples={len(rows)} max={max(vals):.1f}% avg={sum(vals)/len(vals):.1f}%')
for row in rows[::6]:
    print(f"   t={float(row['elapsed_s']):6.1f}s cpu={row['total_cpu_percent']:>6}%")
PY

group_footer
