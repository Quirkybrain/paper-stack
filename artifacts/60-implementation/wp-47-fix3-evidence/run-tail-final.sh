#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (tail locate with frame-corrected absolute clicks)
#
# The window-relative xdo click coordinates are offset by the WM frame, which
# is why the mode dialog needed two click attempts. This stage computes the
# client-area origin with xwininfo and clicks the result row / 下一项 button
# through clickroot with exact client coordinates, then records the view.
#
# Usage: bash run-tail-final.sh
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
group_header "wp-47-fix3 tail final (frame-corrected clicks, query='$TAIL_QUERY')"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "f-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/f-stage-choice-try${n}.png" || return 0
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
  log "client origin: $origin; clicking client ($1,$2)"
  # shellcheck disable=SC2086
  run "$HELPER" clickroot $(( ${origin% *} + $1 )) $(( ${origin#* } + $2 ))
}

key ctrl+f
sleep 1
paste_text "$TAIL_QUERY"
sleep 6
shot "f1-search-ready.png"
click_client 710 172
sleep 3
shot "f2-row-click.png"
click_client 1163 100
sleep 3
shot "f3-next-click.png"
click_client 500 100
sleep 0.5
key Return
sleep 3
shot "f4-return-after-input-focus.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "final tail stage WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"

group_footer
