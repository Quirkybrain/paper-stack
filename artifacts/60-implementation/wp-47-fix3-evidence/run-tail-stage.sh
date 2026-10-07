#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (tail-hit navigation stage)
#
# Launches the release binary with the 11 MiB corpus, picks 简化阅读, waits for
# the mount to settle, searches a unique near-EOF string and locates the hit.
# The screenshot must show the document tail (章节 132140 / 段落 132142) with
# the highlighted match, proving the windowed mount jumped to the target block
# instead of staying at the first screen. Also records WM-close timing again.
#
# Usage: bash run-tail-stage.sh
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
group_header "wp-47-fix3 tail-hit stage (query='$TAIL_QUERY')"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "t-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/t-stage-choice-try${n}.png" || return 0
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
sleep 3
shot "t-stage-search.png"
key Return
sleep 4
shot "t-stage-tail-hit.png"
key Escape
sleep 0.8
shot "t-stage-tail-after-escape.png"

CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
log "tail stage WM close + exit took $(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")s"
grep -E "NON-CLEAN|second WM_DELETE|clean termination" "$RUNS" | tail -3 >>"$EVIDENCE/t-stage-close-notes.txt" || true

group_footer
