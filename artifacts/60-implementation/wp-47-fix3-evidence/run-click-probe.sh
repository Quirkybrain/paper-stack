#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (pointer/click delivery probe)
#
# Control experiment for the tail-locate automation: click the mode-banner
# 关闭 button (a plain React onClick) with the frame-corrected root click and
# check whether the banner disappears. Then search the tail token and click
# the result row / 下一项. Distinguishes click-delivery failure from an
# app-side locate issue.
#
# Usage: bash run-click-probe.sh
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

fix_conditions
group_header "wp-47-fix3 click probe (query='$TAIL_QUERY')"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "p-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/p-stage-choice-try${n}.png" || return 0
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
  log "clicking client ($1,$2) via root"
  run "$HELPER" clickroot $(( ${origin% *} + $1 )) $(( ${origin#* } + $2 ))
}

shot "p1-before-banner-click.png"
click_client 1208 245
sleep 1.5
shot "p2-after-banner-click.png"

key ctrl+f
sleep 1
paste_text "$TAIL_QUERY"
sleep 6
shot "p3-search.png"
click_client 710 172
sleep 2
shot "p4-row-click.png"
click_client 1163 100
sleep 2
shot "p5-next-click.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "click probe WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"

group_footer
