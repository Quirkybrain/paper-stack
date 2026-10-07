#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (tail locate via keyboard tab into 下一项)
#
# The frame-corrected pointer click reaches plain buttons (banner close), but
# the synthetic click on the search result row / 下一项 icon did not select in
# this environment. This stage drives the same UI purely from the keyboard:
# focus the search input, Tab (checkbox, prev, next), screenshot, Return.
#
# Usage: bash run-next-tab.sh
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
TABS="${TABS:-3}"
ACT_KEY="${ACT_KEY:-Return}"

fix_conditions
group_header "wp-47-fix3 next-via-tab (query='$TAIL_QUERY' tabs=$TABS)"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "n-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/n-stage-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}
choose_simplified || log "WARNING: choice not confirmed"
sleep 12

client_origin() {
  local id
  id="$(xwininfo -display "$DISPLAY_ID" -root -tree 2>/dev/null |
    awk '/纸栈 PaperStack/ && !/mutter-x11-frames/ {print $1; exit}')"
  xwininfo -display "$DISPLAY_ID" -id "$id" 2>/dev/null |
    awk '/Absolute upper-left X/{x=$NF} /Absolute upper-left Y/{y=$NF} END{print x, y}'
}
click_client() {
  local origin
  origin="$(client_origin)"
  run "$HELPER" clickroot $(( ${origin% *} + $1 )) $(( ${origin#* } + $2 ))
}

key ctrl+f
sleep 1
paste_text "$TAIL_QUERY"
sleep 6
shot "n1-search-ready.png"
click_client 500 100
sleep 0.5
for _ in $(seq 1 "$TABS"); do
  key Tab
  sleep 0.3
done
shot "n2-after-tabs.png"
key "$ACT_KEY"
sleep 3
shot "n3-after-return.png"
key Escape
sleep 1
shot "n4-after-escape.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "next-via-tab WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"

group_footer
