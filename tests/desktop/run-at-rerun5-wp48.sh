#!/usr/bin/env bash
# run-at-rerun5-wp48.sh — wp-48 AT29 acceptance re-run on the current-tree
# release binary (feat/v0.1.0 @ fa424ef, merges wp-45 fast path and wp-47
# windowed mounting / O(1) excerpt resolver).
#
# Sections: at29 | all
# Usage:   bash tests/desktop/run-at-rerun5-wp48.sh [at29|all]
#
# Scenario (R29 / acceptance-at R5.2 + R5.6, acceptance-it D-IT-3 residual):
# threshold prompt for the 11 MiB corpus -> 取消 path -> threshold prompt ->
# 简化阅读 -> coverage statement (badge + scope banner) -> content timing ->
# tail search hit + 下一项/Return navigation -> code-block copy (exact bytes)
# -> CPU settling -> WM close timing -> 52 MiB source-window mode.
# Screenshots are evidence; verdicts live in
# artifacts/70-verification/acceptance-at.md (Rev 7).
#
# Environment overrides: AT_EVIDENCE (default evidence/at-rerun5),
# DISPLAY_AT (default :1).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AT_EVIDENCE="${AT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/at-rerun5}"
source "$ROOT/tests/desktop/acceptance-lib.sh"
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN

fix_conditions
ensure_helper

CORPUS_SRC="$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md"
CORPUS_11="$INPUTS/at29/doc-11MiB.md"

log "wp-48 AT29 rerun binary: $APP_BIN sha256=$(sha256sum "$APP_BIN" | cut -d' ' -f1) size=$(stat -c%s "$APP_BIN" 2>/dev/null || echo 0)"

ms_now() { date +%s%3N; }
since_ms() { python3 -c "print(round(($(ms_now) - $1)/1000.0, 2))"; }

summarize_cpu() {
  python3 - "$1" "$2" >>"$RUNS" 2>&1 <<'PY'
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
vals = [float(r['total_cpu_percent']) for r in rows]
if not vals:
    print(f'-- {sys.argv[2]} cpu: NO SAMPLES')
    raise SystemExit
tail = vals[-20:]
run = 0
settle = None
for i, v in enumerate(vals):
    if v < 10.0:
        run += 1
        if run >= 20 and settle is None:
            settle = float(rows[i - 19]['elapsed_s'])
    else:
        run = 0
print(f'-- {sys.argv[2]} cpu: samples={len(vals)} peak={max(vals):.1f}% '
      f'last20_avg={sum(tail)/len(tail):.2f}% '
      f'settled20_at={settle if settle is not None else "NEVER"}s')
PY
}

# ------------------------------------------------------------------- AT29 ----
section_at29() {
  AT_GROUP=at29r7
  group_header "AT29 11 MiB simplified re-run (R29, post-wp-47)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at29"

  local D="$INPUTS/at29"
  mkdir -p "$D"
  head -c 11534336 "$CORPUS_SRC" >"$CORPUS_11"
  sha256sum "$CORPUS_11" >>"$RUNS"
  local tail_token="x_{132139}"
  python3 - "$CORPUS_11" "$EVIDENCE/at29-r7-code-payload.txt" <<'PY'
import sys
text = open(sys.argv[1], encoding='utf-8', errors='replace').read()
start = text.index('```rust\n') + len('```rust\n')
end = text.index('\n```', start)
payload = text[start:end]
open(sys.argv[2], 'w', encoding='utf-8').write(payload)
print('AT29 r7 expected code payload bytes:', len(payload.encode('utf-8')))
PY

  # === A. threshold prompt + cancel path ====================================
  reset_data
  launch_app "$CORPUS_11"
  sleep 2.5
  focus
  shot "at29-r7-a-threshold-dialog.png"
  click 253 563   # 取消
  sleep 1.2
  shot "at29-r7-b-cancel-result.png"
  log "AT29 r7 cancel path clicked; app alive=$(kill -0 "$APP_PID" 2>/dev/null && echo yes || echo no)"
  terminate_app

  # === B. simplified reading path ===========================================
  reset_data
  launch_app "$CORPUS_11"
  sleep 2.5
  focus
  shot "at29-r7-c-dialog-again.png"
  local n=0
  while (( n < 5 )); do
    n=$((n + 1))
    key Return
    sleep 0.8
    shot "at29-r7-choice-try${n}.png"
    modal_open "$EVIDENCE/at29-r7-choice-try${n}.png" || break
    click "${AT29_SIMPLIFIED_X:-278}" "${AT29_SIMPLIFIED_Y:-383}"
    sleep 0.8
  done
  local t_choice
  t_choice="$(ms_now)"
  log "AT29 r7 simplified choice made at try=$n"

  python3 "$ROOT/tests/desktop/sample-cpu.py" "$EVIDENCE/at29-r7-cpu.csv" 60 0.5 \
    >"$EVIDENCE/at29-r7-cpu-sampler.out" 2>&1 &
  local sampler_pid=$!

  local spec target
  for spec in 2 3 5; do
    target="$(python3 -c "print($t_choice + $spec * 1000)")"
    while (( $(ms_now) < target )); do sleep 0.1; done
    shot "at29-r7-d-content-t${spec}.png"
    log "AT29 r7 content shot t${spec} at +$(since_ms "$t_choice")s"
  done
  shot "at29-r7-e-coverage-statement.png"

  # === C. code-block copy from the first screen (probe-calibrated; exact bytes)
  local s0
  s0="$(ms_now)"
  click 640 770
  sleep 1
  shot "at29-r7-f-code-hover.png"
  set_clip "AT29-R7-SENTINEL"
  click "${AT29_COPY_X:-850}" "${AT29_COPY_Y:-710}"
  sleep 1.2
  get_clip >"$EVIDENCE/at29-r7-code-clip.txt" 2>/dev/null || true
  if cmp -s "$EVIDENCE/at29-r7-code-clip.txt" "$EVIDENCE/at29-r7-code-payload.txt"; then
    log "AT29 r7 copy EXACT (bytes=$(wc -c < "$EVIDENCE/at29-r7-code-clip.txt")) elapsed=$(since_ms "$s0")s"
  else
    log "AT29 r7 copy MISMATCH (bytes=$(wc -c < "$EVIDENCE/at29-r7-code-clip.txt" 2>/dev/null || echo 0))"
  fi

  # === D. tail search + 下一项 / Return navigation ===========================
  s0="$(ms_now)"
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.4
  key ctrl+a
  sleep 0.2
  paste_text "$tail_token"
  sleep 2.5
  shot "at29-r7-g-tail-search.png"
  key Return
  sleep 2.5
  shot "at29-r7-h-tail-return.png"
  click "${AT29_NEXT_X:-1179}" "${AT29_NEXT_Y:-101}"
  sleep 2
  shot "at29-r7-i-tail-next.png"
  log "AT29 r7 tail search+nav elapsed=$(since_ms "$s0")s"
  click "${AT29_CLOSE_X:-1234}" "${AT29_CLOSE_Y:-101}"
  sleep 0.8

  wait "$sampler_pid" || true
  summarize_cpu "$EVIDENCE/at29-r7-cpu.csv" "AT29 r7"

  local c0 c1
  c0="$(ms_now)"
  terminate_app
  c1="$(ms_now)"
  log "AT29 r7 WM close + exit on 11 MiB instance: $(python3 -c "print(round(($c1 - $c0)/1000.0, 2))")s"
  grep -E "NON-CLEAN|second WM_DELETE" "$RUNS" | tail -3 >>"$EVIDENCE/at29-r7-close-notes.txt" || true

  # === E. 52 MiB hard-limit source-window mode ==============================
  reset_data
  local t0 t1
  t0="$(ms_now)"
  launch_app "$CORPUS_SRC"
  t1="$(ms_now)"
  log "AT29 r7 52MiB launch-to-window ms=$((t1 - t0))"
  sleep 4
  shot "at29-r7-k-52mib-source.png"
  ps -eo rss,args | grep -F "$APP_BIN" | grep -v grep | awk '{print "rss_kb="$1}' >>"$RUNS" || true
  terminate_app
}

case "${1:-all}" in
  at29) section_at29 ;;
  all) section_at29 ;;
  *) echo "usage: $0 [at29|all]" >&2; exit 2 ;;
esac

group_footer
