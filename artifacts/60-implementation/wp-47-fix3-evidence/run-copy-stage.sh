#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (first-screen code-block copy retry stage)
#
# Focused stage for the first-screen code-block copy check. Launches the
# release binary with the 11 MiB corpus, picks 简化阅读, locates the first
# "fixed code block" search hit (the block gets focus), then walks the tab
# order into the always-rendered code action bar and activates the focused
# button. Modes:
#   DO_COPY=0 TAB_COUNT=n  -> tab n times, screenshot focus, stop (probe)
#   DO_COPY=1 TAB_COUNT=n  -> tab n times, screenshot, activate, read clipboard
#
# Usage: DO_COPY=1 TAB_COUNT=1 bash run-copy-stage.sh
set -uo pipefail

EVIDENCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$EVIDENCE/../../.." && pwd)"
export AT_EVIDENCE="$EVIDENCE"
source "$ROOT/tests/desktop/acceptance-lib.sh"
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN
CORPUS="$EVIDENCE/corpus-11MiB.md"
export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache"
DO_COPY="${DO_COPY:-1}"
TAB_COUNT="${TAB_COUNT:-1}"

fix_conditions
group_header "wp-47-fix3 copy stage (DO_COPY=$DO_COPY TAB_COUNT=$TAB_COUNT)"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "c-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/c-stage-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}
choose_simplified || log "WARNING: choice not confirmed"
sleep 15

key ctrl+f
sleep 1
paste_text "fixed code block"
sleep 3
shot "c-stage-search.png"
key Return
sleep 4
shot "c-stage-hit.png"
key Escape
sleep 0.8
for _ in $(seq 1 "$TAB_COUNT"); do
  key Tab
  sleep 0.4
done
shot "c-stage-focus.png"

if [[ "$DO_COPY" == "1" ]]; then
  set_clip "PS-WP47-SENTINEL"
  key Return
  sleep 1.2
  shot "c-stage-after-copy.png"
  get_clip >"$EVIDENCE/c-stage-clipboard.txt" 2>/dev/null || true
  log "copy stage clipboard bytes=$(wc -c < "$EVIDENCE/c-stage-clipboard.txt" 2>/dev/null || echo 0)"
  head -c 200 "$EVIDENCE/c-stage-clipboard.txt" >>"$RUNS" 2>/dev/null || true
  printf '\n' >>"$RUNS"
fi
terminate_app
group_footer
