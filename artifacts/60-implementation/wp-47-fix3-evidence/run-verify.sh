#!/usr/bin/env bash
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (D-IT-3 windowed mounting real-app verification)
# - **Artifact**: verification driver for artifacts/60-implementation/wp-47-fix3.md
#
# Drives the release binary on X11 :1 with the 11 MiB corpus through the
# simplified-reading path and records: launch/dialog, content timeline
# screenshots, WebKitWebProcess CPU samples (before/after mount), tail-token
# search navigation (next / locate), first-screen code-block copy (keyboard
# into the code action bar), and WM-close timing.
#
# Fixed conditions mirror the acceptance runs (light theme, isolated data and
# cache under this evidence dir, DISPLAY=:1). Screenshots and runs.log are
# evidence; verdicts stay in the report.
#
# Usage: bash run-verify.sh
set -uo pipefail

EVIDENCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$EVIDENCE/../../.." && pwd)"
export AT_EVIDENCE="$EVIDENCE"
source "$ROOT/tests/desktop/acceptance-lib.sh"

APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN
CORPUS="$EVIDENCE/corpus-11MiB.md"
# Unique ASCII token near EOF (block 132139 of 145360) so the locate must jump
# the window to the document tail; needle-* tokens repeat through the corpus.
TAIL_TOKEN="${TAIL_TOKEN:-x_{132139}}"
export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache"

fix_conditions
group_header "wp-47-fix3 windowed-mount real-app verification"
log "corpus sha256=$(sha256sum "$CORPUS" | cut -d' ' -f1) size=$(stat -c %s "$CORPUS") tail_token=$TAIL_TOKEN"

reset_data
sleep 0.5
LAUNCH_T0="$(date +%s.%N)"
launch_app "$CORPUS"
sleep 2
shot "v01-large-dialog.png"
log "window appeared; launch->dialog shot at +$(python3 -c "print(round($(date +%s.%N)-$LAUNCH_T0,1))")s"

# Choose 简化阅读 (same click-retry pattern as run-it.sh IT07: synthetic keys
# were unreliable on this dialog).
choose_simplified() {
  local n=0
  while (( n < 6 )); do
    n=$((n + 1))
    shot "v02-choice-try${n}.png"
    modal_open "$EVIDENCE/v02-choice-try${n}.png" || return 0
    click 278 383
    sleep 0.6
    click 278 408
    sleep 1.2
  done
  return 1
}

if choose_simplified; then
  log "simplified-reading choice confirmed (overlay gone)"
else
  log "WARNING: simplified-reading choice not confirmed"
fi
CHOICE_TS="$(date +%s.%N)"

# CPU sampler runs through the whole observation window.
python3 "$EVIDENCE/sample-cpu.py" "$EVIDENCE/cpu-after-choice.csv" 100 0.5 \
  >"$EVIDENCE/cpu-sampler.out" 2>&1 &
SAMPLER_PID=$!

for spec in 1 2 3 5 8 12 20 30 45 60 75 90; do
  target="$(python3 -c "print($CHOICE_TS + $spec)")"
  now="$(date +%s.%N)"
  sleep_for="$(python3 -c "print(max(0.0, $target - $now))")"
  sleep "$sleep_for"
  shot "v03-content-t${spec}.png"
  log "shot v03-content-t${spec}.png at +$(python3 -c "print(round($(date +%s.%N)-$CHOICE_TS,1))")s"
done
wait "$SAMPLER_PID" || true

# Idle summary from the last 20 samples (last 10 s of the window).
python3 - "$EVIDENCE/cpu-after-choice.csv" >>"$RUNS" 2>&1 <<'PY'
import csv, sys
with open(sys.argv[1], newline='') as handle:
    rows = list(csv.DictReader(handle))
tail = rows[-20:]
vals = [float(row['total_cpu_percent']) for row in tail]
print(f'-- cpu summary: samples={len(rows)} last{len(vals)}s avg={sum(vals)/len(vals):.1f}% max={max(vals):.1f}%')
PY

# --- Copy of a first-window code block --------------------------------------
# The search hit (block ~15) is inside the initial window; after locating it
# the reader focuses the block, so Tab reaches the always-rendered 复制 button
# (verified path; synthetic hover coordinates are frame-sensitive).
key ctrl+f
sleep 1
paste_text "fixed code block"
sleep 3
key Return
sleep 4
shot "v05-code-hit.png"
key Escape
sleep 0.8
key Tab
sleep 0.4
shot "v06-code-focus.png"
set_clip "PS-WP47-SENTINEL"
key Return
sleep 1.2
shot "v07-code-copied.png"
get_clip >"$EVIDENCE/v07-clipboard.txt" 2>/dev/null || true
log "copy attempt clipboard bytes=$(wc -c < "$EVIDENCE/v07-clipboard.txt" 2>/dev/null || echo 0)"

# --- Tail-token search navigation (下一项 / locate) --------------------------
key ctrl+f
sleep 1
paste_text "$TAIL_TOKEN"
sleep 6
shot "v08-search-tail.png"
key Return
sleep 6
shot "v09-tail-hit.png"
key Escape
sleep 0.8
shot "v10-tail-after-escape.png"

# --- Clean WM close timing --------------------------------------------------
CLOSE_T0="$(date +%s.%N)"
terminate_app
CLOSE_T1="$(date +%s.%N)"
CLOSE_S="$(python3 -c "print(round($CLOSE_T1-$CLOSE_T0,2))")"
log "WM close + exit took ${CLOSE_S}s"
grep -E "NON-CLEAN|second WM_DELETE" "$RUNS" | tail -3 >>"$EVIDENCE/close-notes.txt" || true

group_footer
