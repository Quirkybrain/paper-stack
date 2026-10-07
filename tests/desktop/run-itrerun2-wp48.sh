#!/usr/bin/env bash
# run-itrerun2-wp48.sh — wp-48 IT07 acceptance re-run on the current-tree
# release binary (feat/v0.1.0 @ fa424ef, merges wp-45 fast path and wp-47
# windowed mounting / O(1) excerpt resolver).
#
# Sections: it07 | suite | all
# Usage:   bash tests/desktop/run-itrerun2-wp48.sh [it07|suite|all]
#
# Scope and evidence rules (same discipline as tests/desktop/run-it.sh and
# run-itrerun.sh): real release app on X11 :1, scripted input via xdo-helper,
# isolated XDG_DATA_HOME + per-section XDG_CACHE_HOME, screenshots are
# evidence not verification. This driver re-runs IT07 (R24/R29/R11) after the
# D-IT-3 residual: keyboard chain, 10-11 MiB simplified-reading sub-items
# (content timing, tail-hit navigation, exact-byte copy, CPU settling, WM
# close), drawer focus return and 200% scaling. Verdicts live in
# artifacts/70-verification/acceptance-it.md (Rev 3).
#
# AT29 lives in the sibling driver run-at-rerun5-wp48.sh (at-rerun5 evidence).
#
# Environment overrides: AT_EVIDENCE (default evidence/it-rerun2),
# DISPLAY_AT (default :1), IT07_* click fallbacks.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AT_EVIDENCE="${AT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/it-rerun2}"
source "$ROOT/tests/desktop/acceptance-lib.sh"
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN

fix_conditions
ensure_helper

CORPUS_SRC="$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md"
CAPTURE="$INPUTS/it07"
CORPUS_11="$CAPTURE/corpus-11MiB.md"

log "wp-48 IT rerun binary: $APP_BIN sha256=$(sha256sum "$APP_BIN" | cut -d' ' -f1) size=$(stat -c%s "$APP_BIN" 2>/dev/null || echo 0)"

ms_now() { date +%s%3N; }
# since_ms <start_ms>: seconds with 2 decimals since <start_ms>
since_ms() { python3 -c "print(round(($(ms_now) - $1)/1000.0, 2))"; }

# summarize_cpu <csv> <label>: peak / settle (20 consecutive <10% samples) /
# last-20-sample average, appended to runs.log.
summarize_cpu() {
  python3 - "$1" "$2" >>"$RUNS" 2>&1 <<'PY'
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
vals = [float(r['total_cpu_percent']) for r in rows]
if not vals:
    print(f'-- {sys.argv[2]} cpu: NO SAMPLES')
    raise SystemExit
tail = vals[-20:]
peak = max(vals)
run = 0
settle = None
for i, v in enumerate(vals):
    if v < 10.0:
        run += 1
        if run >= 20 and settle is None:
            settle = float(rows[i - 19]['elapsed_s'])
    else:
        run = 0
first = float(rows[0]['elapsed_s']); last = float(rows[-1]['elapsed_s'])
print(f'-- {sys.argv[2]} cpu: samples={len(vals)} window={first:.1f}-{last:.1f}s '
      f'peak={peak:.1f}% last20_avg={sum(tail)/len(tail):.2f}% '
      f'settled20_at={settle if settle is not None else "NEVER"}s')
PY
}

# ------------------------------------------------------------------- IT07 ----
section_it07() {
  AT_GROUP=it07r3
  group_header "IT07 keyboard + large-file chain re-run (wp-47 fix, current binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it07"

  # === A. keyboard-only chain: open -> search -> back =======================
  reset_data
  launch_app
  sleep 2
  shot "it07-r3-a-welcome.png"
  focus
  key ctrl+o
  sleep 1.5
  root_shot "it07-r3-b-picker.png"
  confirm_picker_path "$FIXTURES/rendering/links.md"
  sleep 3
  shot "it07-r3-c-keyboard-opened.png"
  key ctrl+f
  sleep 0.8
  paste_text "Duplicate"
  sleep 1.2
  key Return
  sleep 0.8
  shot "it07-r3-d-keyboard-search.png"
  key Escape
  sleep 0.5
  key Escape
  sleep 0.5
  local i
  for i in $(seq 1 10); do key Tab; sleep 0.3; done
  shot "it07-r3-e-tab-reaches-link.png"
  key Return
  sleep 1.2
  shot "it07-r3-f-link-activated.png"
  key alt+Left
  sleep 1.2
  shot "it07-r3-g-keyboard-back.png"
  key ctrl+w
  sleep 1.2
  shot "it07-r3-h-after-keyboard-close.png"
  terminate_app

  # === B. keyboard copy (exact bytes) =======================================
  reset_data
  local D="$CAPTURE/it07kb"
  mkdir -p "$D"
  cp "$FIXTURES/rendering/code.md" "$D/keyboard-code.md"
  printf 'int main(void) { return 0; }\n' >"$EVIDENCE/it07-r3-kb-expected.txt"
  launch_app "$D/keyboard-code.md"
  sleep 3
  for i in $(seq 1 8); do key Tab; sleep 0.3; done
  shot "it07-r3-i-focus-copy.png"
  set_clip "IT07-R3-KB-SENTINEL"
  key Return
  sleep 0.8
  get_clip >"$EVIDENCE/it07-r3-kb-clipboard.txt" 2>/dev/null || true
  if cmp -s "$EVIDENCE/it07-r3-kb-clipboard.txt" "$EVIDENCE/it07-r3-kb-expected.txt"; then
    log "IT07 r3 keyboard copy EXACT (bytes=$(wc -c < "$EVIDENCE/it07-r3-kb-clipboard.txt"))"
  else
    log "IT07 r3 keyboard copy MISMATCH (bytes=$(wc -c < "$EVIDENCE/it07-r3-kb-clipboard.txt" 2>/dev/null || echo 0))"
  fi
  key ctrl+w
  sleep 1.2
  shot "it07-r3-j-after-copy-close.png"
  terminate_app

  # === C. keyboard update ===================================================
  reset_data
  launch_app "$D/keyboard-code.md"
  sleep 3
  printf '\n键盘更新段落 KEYBOARD-UPDATE。\n' >>"$D/keyboard-code.md"
  sleep 3
  shot "it07-r3-k-keyboard-banner.png"
  for i in $(seq 1 8); do key Tab; sleep 0.3; done
  shot "it07-r3-l-focus-now-update.png"
  key Return
  sleep 0.7
  shot "it07-r3-m-update-toast.png"
  sleep 1.5
  shot "it07-r3-n-updated.png"
  key Next
  key Next
  sleep 1
  shot "it07-r3-o-updated-tail.png"
  key ctrl+w
  sleep 1.2
  terminate_app

  # === D. 11 MiB simplified reading: timing / tail nav / copy / CPU / close ==
  reset_data
  mkdir -p "$CAPTURE"
  head -c 11534336 "$CORPUS_SRC" >"$CORPUS_11"
  sha256sum "$CORPUS_11" >>"$RUNS"
  local tail_token="x_{132139}"
  # exact expected copy payload of the first corpus code block (micromark
  # code-value semantics exclude the terminating line ending)
  python3 - "$CORPUS_11" "$EVIDENCE/it07-r3-code-payload.txt" <<'PY'
import sys
text = open(sys.argv[1], encoding='utf-8', errors='replace').read()
start = text.index('```rust\n') + len('```rust\n')
end = text.index('\n```', start)
payload = text[start:end]
open(sys.argv[2], 'w', encoding='utf-8').write(payload)
print('IT07 r3 expected code payload bytes:', len(payload.encode('utf-8')))
PY

  launch_app "$CORPUS_11"
  sleep 2.5
  focus
  shot "it07-r3-p-large-dialog.png"

  # choose 简化阅读: Return picks the focused default; click fallback if the
  # synthetic key is swallowed by the modal
  local n=0
  while (( n < 5 )); do
    n=$((n + 1))
    key Return
    sleep 0.8
    shot "it07-r3-choice-try${n}.png"
    modal_open "$EVIDENCE/it07-r3-choice-try${n}.png" || break
    click "${IT07_SIMPLIFIED_X:-278}" "${IT07_SIMPLIFIED_Y:-383}"
    sleep 0.8
  done
  local t_choice
  t_choice="$(ms_now)"
  log "IT07 r3 simplified choice made at try=$n (choice_ms=$t_choice)"

  # CPU sampler covers parse + mount + interactions + idle settling.
  python3 "$ROOT/tests/desktop/sample-cpu.py" "$EVIDENCE/it07-r3-cpu.csv" 75 0.5 \
    >"$EVIDENCE/it07-r3-cpu-sampler.out" 2>&1 &
  local sampler_pid=$!

  # content-visibility timeline
  local spec target
  for spec in 1 2 3 4 6 10 15 20; do
    target="$(python3 -c "print($t_choice + $spec * 1000)")"
    while (( $(ms_now) < target )); do sleep 0.1; done
    shot "it07-r3-content-t${spec}.png"
    log "IT07 r3 content shot t${spec} at +$(since_ms "$t_choice")s"
  done

  # code-block copy from the first screen of the large simplified document
  # (probe-calibrated: hover the first code block, then click 复制)
  local s0
  s0="$(ms_now)"
  click 640 770
  sleep 1
  shot "it07-r3-u-code-hover.png"
  set_clip "IT07-R3-LARGE-SENTINEL"
  click "${IT07_COPY_X:-850}" "${IT07_COPY_Y:-710}"
  sleep 1.2
  get_clip >"$EVIDENCE/it07-r3-code-clip.txt" 2>/dev/null || true
  if cmp -s "$EVIDENCE/it07-r3-code-clip.txt" "$EVIDENCE/it07-r3-code-payload.txt"; then
    log "IT07 r3 large-doc copy EXACT (bytes=$(wc -c < "$EVIDENCE/it07-r3-code-clip.txt")) elapsed=$(since_ms "$s0")s"
  else
    log "IT07 r3 large-doc copy MISMATCH via click (bytes=$(wc -c < "$EVIDENCE/it07-r3-code-clip.txt" 2>/dev/null || echo 0)); keyboard fallback"
    key ctrl+f
    sleep 1
    click 500 101
    sleep 0.4
    key ctrl+a
    sleep 0.2
    paste_text "fixed code block"
    sleep 3
    key Return
    sleep 2
    click "${IT07_NEXT_X:-1179}" "${IT07_NEXT_Y:-101}"
    sleep 2
    shot "it07-r3-u2-code-hit.png"
    click "${IT07_CLOSE_X:-1234}" "${IT07_CLOSE_Y:-101}"
    sleep 0.8
    key Tab
    sleep 0.5
    shot "it07-r3-v2-code-focus.png"
    set_clip "IT07-R3-LARGE-SENTINEL2"
    key Return
    sleep 1.2
    get_clip >"$EVIDENCE/it07-r3-code-clip2.txt" 2>/dev/null || true
    if cmp -s "$EVIDENCE/it07-r3-code-clip2.txt" "$EVIDENCE/it07-r3-code-payload.txt"; then
      log "IT07 r3 large-doc copy EXACT via keyboard fallback (bytes=$(wc -c < "$EVIDENCE/it07-r3-code-clip2.txt"))"
    else
      log "IT07 r3 large-doc copy STILL MISMATCH (bytes=$(wc -c < "$EVIDENCE/it07-r3-code-clip2.txt" 2>/dev/null || echo 0))"
    fi
  fi

  # tail search: unique token near EOF (previously blocked by CPU saturation)
  s0="$(ms_now)"
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.4
  key ctrl+a
  sleep 0.2
  paste_text "$tail_token"
  sleep 2.5
  shot "it07-r3-q-tail-search.png"
  key Return
  sleep 2.5
  shot "it07-r3-r-tail-return.png"
  click "${IT07_NEXT_X:-1179}" "${IT07_NEXT_Y:-101}"
  sleep 2
  shot "it07-r3-s-tail-next.png"
  log "IT07 r3 tail search+next elapsed=$(since_ms "$s0")s"
  click "${IT07_CLOSE_X:-1234}" "${IT07_CLOSE_Y:-101}"
  sleep 0.8
  shot "it07-r3-t-tail-panel-closed.png"

  wait "$sampler_pid" || true
  summarize_cpu "$EVIDENCE/it07-r3-cpu.csv" "IT07 r3"

  # WM close timing on the 11 MiB instance
  local c0 c1
  c0="$(ms_now)"
  terminate_app
  c1="$(ms_now)"
  log "IT07 r3 WM close + exit: $(python3 -c "print(round(($c1 - $c0)/1000.0, 2))")s"
  grep -E "NON-CLEAN|second WM_DELETE" "$RUNS" | tail -3 >>"$EVIDENCE/it07-r3-close-notes.txt" || true

  # === E. drawer focus return ===============================================
  reset_data
  launch_app "$FIXTURES/rendering/tables.md"
  sleep 2.5
  key ctrl+b
  sleep 1
  shot "it07-r3-w-drawer-open.png"
  key ctrl+b
  sleep 1
  shot "it07-r3-x-drawer-closed.png"
  click 640 300
  sleep 0.3
  key Tab
  sleep 0.5
  shot "it07-r3-y-focus-after-drawer.png"
  terminate_app

  # === F. 200% scaling ======================================================
  gsettings set org.gnome.desktop.interface text-scaling-factor 2.0
  log "text-scaling-factor set to 2.0"
  launch_app "$FIXTURES/rendering/mixed-cn-en.md"
  sleep 3
  shot "it07-r3-z-scale200.png"
  key ctrl+f
  sleep 0.8
  paste_text "中文"
  sleep 1.2
  shot "it07-r3-z2-scale200-search.png"
  key Escape
  sleep 0.5
  key ctrl+b
  sleep 1
  shot "it07-r3-z3-scale200-drawer.png"
  terminate_app
  gsettings set org.gnome.desktop.interface text-scaling-factor 1.25
  log "text-scaling-factor restored to 1.25"
}

# ------------------------------------------------------------------- suite ---
section_suite() {
  AT_GROUP=suite
  group_header "frontend suite on the wp-48 revision (expect 588)"
  run_out "$EVIDENCE/unit-suite-wp48.log" pnpm test -- --run
  grep -E "Test Files|Tests " "$EVIDENCE/unit-suite-wp48.log" | tail -4 | tee -a "$RUNS"
}

case "${1:-all}" in
  it07) section_it07 ;;
  suite) section_suite ;;
  all) section_it07; section_suite ;;
  *) echo "usage: $0 [it07|suite|all]" >&2; exit 2 ;;
esac

group_footer
