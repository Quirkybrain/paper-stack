#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (tail locate gesture isolation)
#
# One run, four gestures on the single tail match, a screenshot after each:
# result-row click, 下一项 button, Return, Shift+Enter. The counter and view
# after each gesture show which layer drops the request (store selection vs
# reader locate vs windowed mount).
#
# Usage: bash run-tail-gestures.sh
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
group_header "wp-47-fix3 tail gesture isolation (query='$TAIL_QUERY')"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "g-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/g-stage-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}
choose_simplified || log "WARNING: choice not confirmed"
sleep 12

key ctrl+f
sleep 1
paste_text "$TAIL_QUERY"
sleep 5
shot "g1-search-idle.png"
click 710 172
sleep 2
shot "g2-row-click.png"
click 1163 100
sleep 2
shot "g3-next-button.png"
key Return
sleep 2
shot "g4-return.png"
key Shift+Return
sleep 2
shot "g5-shift-return.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "gesture stage WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"

group_footer
