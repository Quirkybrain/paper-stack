#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (pre-fix baseline reproduction for the evidence report)
#
# Reproduces the D-IT-3 residual on the wp-43 packaged pre-fix binary
# (/tmp/opencode/ps-deb-it, sha256 996f5c6c…) with the same 11 MiB corpus and
# the same simplified-choice drive as run-verify.sh. Records a 150 s CPU curve
# and the WM-close outcome. All outputs live under this evidence dir /before/.
#
# Usage: bash run-before.sh
set -uo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BEFORE="$BASE/before"
mkdir -p "$BEFORE"
export AT_EVIDENCE="$BEFORE"
ROOT="$(cd "$BASE/../../.." && pwd)"
source "$ROOT/tests/desktop/acceptance-lib.sh"
APP_BIN="${PRE_FIX_BIN:-/tmp/opencode/ps-deb-it/usr/bin/paperstack}"
export APP_BIN
CORPUS="$BASE/corpus-11MiB.md"
export LAUNCH_ENV="XDG_CACHE_HOME=$BEFORE/cache"

fix_conditions
group_header "wp-47-fix3 pre-fix baseline (D-IT-3)"
log "pre-fix binary sha256=$(sha256sum "$APP_BIN" | cut -d' ' -f1)"
log "corpus sha256=$(sha256sum "$CORPUS" | cut -d' ' -f1)"

reset_data
sleep 0.5
launch_app "$CORPUS"
sleep 2
shot "b01-large-dialog.png"

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "b02-choice-try${n}.png"
    modal_open "$BEFORE/b02-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}
choose_simplified || log "WARNING: choice not confirmed"
CHOICE_TS="$(date +%s.%N)"

python3 "$BASE/sample-cpu.py" "$BEFORE/cpu-before.csv" 150 0.5 \
  >"$BEFORE/cpu-sampler.out" 2>&1 &
SAMPLER_PID=$!

for spec in 5 15 30 60 90 120 150; do
  target="$(python3 -c "print($CHOICE_TS + $spec)")"
  now="$(date +%s.%N)"
  sleep_for="$(python3 -c "print(max(0.0, $target - $now))")"
  sleep "$sleep_for"
  shot "b03-content-t${spec}.png"
  log "shot b03-content-t${spec}.png at +$(python3 -c "print(round($(date +%s.%N)-$CHOICE_TS,1))")s"
done
wait "$SAMPLER_PID" || true

python3 - "$BEFORE/cpu-before.csv" >>"$RUNS" 2>&1 <<'PY'
import csv, sys
with open(sys.argv[1], newline='') as handle:
    rows = list(csv.DictReader(handle))
vals = [float(row['total_cpu_percent']) for row in rows]
idle = [v for v in vals if v < 20]
print(f'-- cpu summary: samples={len(rows)} max={max(vals):.1f}% avg={sum(vals)/len(vals):.1f}% samples<20%={len(idle)}')
PY

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "pre-fix WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"
grep -E "NON-CLEAN|second WM_DELETE|clean termination" "$RUNS" | tail -4 >>"$BEFORE/close-notes.txt" || true

group_footer
