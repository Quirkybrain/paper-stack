#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (breadcrumb diagnostic run; hard-kill after pin)
#
# Launches the instrumented release binary, drives the tail activation, waits
# 5 s and hard-kills the app so app.log (WebKit console breadcrumbs) can be
# read without the graceful-close path. Diagnostic only; not final evidence.
#
# Usage: bash run-breadcrumb.sh
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
group_header "wp-47-fix3 breadcrumb diagnostic"
reset_data
launch_app "$CORPUS"
sleep 2

choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "w-stage-choice-try${n}.png"
    modal_open "$EVIDENCE/w-stage-choice-try${n}.png" || return 0
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
sleep 6
shot "w1-search.png"
key Tab
key Tab
key Tab
sleep 0.5
shot "w2-focused.png"
key space
sleep 5
shot "w3-pinned.png"

# Hard kill: the graceful path is known to hang while the main thread is busy.
pkill -KILL -f "$APP_BIN" 2>/dev/null || true
sleep 1
pkill -KILL -f WebKitWebProcess 2>/dev/null || true
APP_PID=""
group_footer
