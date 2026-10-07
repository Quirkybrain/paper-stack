#!/usr/bin/env bash
# run-itrerun.sh — wp-46 IT re-run driver: D-IT-1 / D-IT-2 / D-IT-3
# re-checks on the CURRENT-TREE release binary (wp-45 fixes merged).
#
# The wp-44 IT run verified the wp-43 packaged .deb; the wp-45 implementation
# (commit f8e4dae, merged 3a14102) changed the reader link resolver, the watch
# removed-hint handling and the simplified-reading fast path. This driver
# therefore runs the affected IT chains on the development-tree release binary
# (src-tauri/target/release/paperstack) rebuilt from the current revision, and
# records the binary identity in runs.log/app-binary.txt:
#   it02 — cross-file navigation incl. the non-ASCII link repro (D-IT-1/R15)
#   it03 — selection under external update incl. the replacement-save repro
#          and the in-place control (D-IT-2/R21/R22)
#   it07 — 11 MiB simplified reading: parse/index timing, tail search and
#          code-block copy (D-IT-3/R29)
#   suite — frontend suite on this revision (expect 568)
#
# Fixed conditions follow the wp-44 run: X11 DISPLAY=:1 (2520×1680),
# light GTK_THEME=Adwaita:light, text-scaling 1.25, isolated XDG_DATA_HOME
# and per-section XDG_CACHE_HOME. Screenshots are evidence, not verification:
# every verdict in artifacts/70-verification/acceptance-it.md cites inspected
# screenshots, clipboard bytes, logs or timings.
#
# Sections: it02 it03 it07 suite all
# Usage: bash tests/desktop/run-itrerun.sh [it02|it03|it07|suite|all]
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IT_EVIDENCE="${IT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/it-rerun}"
export AT_EVIDENCE="$IT_EVIDENCE"
source "$ROOT/tests/desktop/acceptance-lib.sh"

# Development-tree release binary (acceptance-lib default); the wp-44 run's
# .deb extraction override is deliberately NOT used here.
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN

fix_conditions
ensure_helper

BIN_SHA="$(sha256sum "$APP_BIN" 2>/dev/null | cut -d' ' -f1 || echo missing)"
log "IT-rerun binary: $APP_BIN sha256=$BIN_SHA size=$(stat -c%s "$APP_BIN" 2>/dev/null || echo 0)"

# ---- shared helpers ---------------------------------------------------------

# select_all_and_copy <outfile>: focus the document body, Ctrl+A, Ctrl+C and
# capture the clipboard text (byte-level check of the rendered reading text).
select_all_and_copy() {
  local out="$1"
  click 640 400
  sleep 0.4
  key ctrl+a
  sleep 0.7
  set_clip "PS-IT-RERUN-SENTINEL"
  key ctrl+c
  sleep 0.8
  get_clip >"$out" 2>/dev/null || true
  log "clipboard capture ${out##*/}: bytes=$(wc -c < "$out" 2>/dev/null || echo 0)"
}

# ms_now
ms_now() { date +%s%3N; }

# webkit_cpu_jiffies: total utime+stime jiffies of current WebKitWebProcess
# instances (empty -> 0).
webkit_cpu_jiffies() {
  local pid j total=0
  for pid in $(pgrep -f WebKitWebProcess 2>/dev/null); do
    j="$(awk '{print $14+$15}' "/proc/$pid/stat" 2>/dev/null || true)"
    [[ -n "$j" ]] && total=$((total + j))
  done
  printf '%s\n' "$total"
}

# watch_webkit_cpu <outfile> <max_ms>: sample instantaneous CPU of the WebKit
# process tree every ~0.4s. A "busy" sample is >=50% (parse/index), then the
# watch ends after 4 consecutive samples <10% (work settled). Prints elapsed
# ms of the settling point. Samples: elapsed_ms=… cpu_pct=…
watch_webkit_cpu() {
  local out="$1" max_ms="$2" hz start prev now prev_ms el dt dj cpu saw_busy=0 idle=0
  local cur
  hz="$(getconf CLK_TCK 2>/dev/null || echo 100)"
  start="$(ms_now)"
  prev="$(webkit_cpu_jiffies)"
  prev_ms="$start"
  : >"$out"
  while :; do
    sleep 0.4
    now="$(ms_now)"
    el=$((now - start))
    cur="$(webkit_cpu_jiffies)"
    dj=$((cur - prev))
    dt=$((now - prev_ms))
    prev="$cur"; prev_ms="$now"
    cpu="$(awk -v dj="$dj" -v dt="$dt" -v hz="$hz" 'BEGIN{printf "%.1f", (dj/hz)/(dt/1000.0)*100}')"
    printf 'elapsed_ms=%d cpu_pct=%s\n' "$el" "$cpu" >>"$out"
    if awk -v c="$cpu" 'BEGIN{exit !(c >= 50)}'; then saw_busy=1; idle=0; fi
    if (( saw_busy )) && awk -v c="$cpu" 'BEGIN{exit !(c < 10)}'; then
      idle=$((idle + 1))
    else
      idle=0
    fi
    if (( saw_busy && idle >= 4 )); then
      printf 'settled_ms=%d\n' "$el" >>"$out"
      log "IT07 WebKit CPU settled at ${el}ms after work start"
      return 0
    fi
    if (( el >= max_ms )); then
      printf 'timeout_ms=%d\n' "$el" >>"$out"
      log "IT07 WebKit CPU watch timeout at ${el}ms"
      return 1
    fi
  done
}

# ------------------------------------------------------------------- IT02 ----
write_it02_docs() {
  local D="$1"
  mkdir -p "$D"
  {
    printf '# 导航样例\n\n'
    printf '## 二级标题 A\n\n'
    printf '这是第一处脚注引用[^note-one]，同时包含用于后退历史的正文。\n\n'
    printf '这里有一个跨文件链接：[第二文档](./second.md) 以及 [中文名文档](./中文文档.md)。\n\n'
    printf '## 二级标题 B\n\n'
    local i
    for i in $(seq 1 14); do
      printf '第 %02d 段导航标记：搜索会话合并验证文本。\n\n' "$i"
    done
    printf '段落尾部还有一处脚注引用[^note-one]。\n\n'
    printf '[^note-one]: 脚注正文，用于 IT02 的脚注导航链。\n'
  } >"$D/导航样例.md"
  {
    printf '# 第二文档\n\n'
    printf '这是第二份文档，由跨文件链接打开，用于后退链验证。\n\n'
    printf '## 第二节\n\n可以逐步后退回到第一份文档。\n'
  } >"$D/second.md"
  {
    printf '# 中文名文档\n\n'
    printf '这份文档的文件名含中文，用于验证跨文件相对链接对非 ASCII 文件名的解析。\n'
  } >"$D/中文文档.md"
}

section_it02() {
  AT_GROUP=it02r2
  group_header "IT02 cross-file navigation re-run on current-tree binary (D-IT-1)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it02"

  local D="$INPUTS/it02"
  write_it02_docs "$D"

  reset_data
  launch_app "$D/导航样例.md"
  sleep 3
  focus
  shot "it02-r2-a-opened.png"

  # 1) ASCII cross-file link (regression on the changed resolver code path)
  click "${IT02_ASCII_LINK_X:-463}" "${IT02_ASCII_LINK_Y:-276}"
  sleep 2
  shot "it02-r2-b-second-doc.png"
  select_all_and_copy "$EVIDENCE/it02-r2-second-doc-clip.txt"

  key alt+Left
  sleep 1.5
  shot "it02-r2-c-back.png"

  # 2) D-IT-1 repro: the non-ASCII cross-file link must now open the document.
  # The restored-position banner keeps the page scrolled; attempt 1 uses the
  # measured restored-state coordinate (same family as the wp-44 run), attempt
  # 2 resets to the top and uses the fresh-view coordinate.
  local attempt cjk_ok=0
  for attempt in 1 2; do
    if (( attempt == 2 )); then
      click 1208 105   # 关闭 the 已恢复阅读位置 banner
      sleep 0.8
      click 640 400
      sleep 0.3
      key ctrl+Home
      sleep 1
      click "${IT02_CJK_LINK_X:-607}" "${IT02_CJK_LINK_Y2:-276}"
    else
      click "${IT02_CJK_LINK_X:-607}" "${IT02_CJK_LINK_Y:-257}"
    fi
    sleep 2.2
    shot "it02-r2-d-cjk-doc-try${attempt}.png"
    select_all_and_copy "$EVIDENCE/it02-r2-cjk-doc-clip-try${attempt}.txt"
    if grep -q "这份文档的文件名含中文" "$EVIDENCE/it02-r2-cjk-doc-clip-try${attempt}.txt"; then
      cjk_ok=1
      break
    fi
  done
  log "IT02 rerun CJK non-ASCII link opened: $( (( cjk_ok == 1 )) && echo yes || echo NO ) (try=$attempt)"
  key alt+Left
  sleep 1.5
  shot "it02-r2-e-back-after-cjk.png"
  terminate_app
}

# ------------------------------------------------------------------- IT03 ----
section_it03() {
  AT_GROUP=it03r2
  group_header "IT03 external update re-run incl. replacement-save (D-IT-2)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it03"

  local D="$INPUTS/it03"
  mkdir -p "$D"
  cp "$FIXTURES/update/v1.md" "$D/doc.md"

  reset_data
  launch_app "$D/doc.md"
  sleep 3
  focus
  shot "it03-r2-a-v1.png"

  # 1) select text
  click 400 300
  sleep 0.5
  key ctrl+a
  sleep 1
  shot "it03-r2-b-selection.png"

  # 2) external replace-save (rename over the source file, as editors do).
  # The wp-45 fix must turn this into the normal update path: banner directly,
  # no 找不到原文件/unavailable bounce. Rapid early shots catch any transient.
  python3 - "$D/doc.md" "$FIXTURES/update/v2.md" <<'PY'
import os, shutil, sys
target, v2 = sys.argv[1], sys.argv[2]
tmp = target + '.external-new'
shutil.copyfile(v2, tmp)
os.replace(tmp, target)
print('replace-save done')
PY
  sleep 0.8
  shot "it03-r2-c-replace-t1.png"
  sleep 2.7
  shot "it03-r2-d-replace-banner.png"

  # 3) 稍后 -> collapsed marker (selection must still be present)
  click "${IT03_LATER_X:-1210}" "${IT03_LATER_Y:-107}"
  sleep 1.2
  shot "it03-r2-e-later-collapsed.png"

  # 4) source view: displayed version must still be v1
  open_source_view
  shot "it03-r2-f-source-v1.png"
  select_all_and_copy "$EVIDENCE/it03-r2-source-v1-clip.txt"

  # 5) reopen the update action from the collapsed marker and commit;
  # the source view must then show v2
  click "${IT03_MARKER_X:-640}" "${IT03_MARKER_Y:-94}"
  sleep 1
  shot "it03-r2-g-marker-reopened.png"
  click "${IT03_UPDATE_X:-1103}" "${IT03_UPDATE_Y:-107}"
  sleep 0.6
  shot "it03-r2-h-update-fast.png"
  sleep 2
  shot "it03-r2-i-update-settled.png"
  sleep 3
  shot "it03-r2-j-update-late.png"
  select_all_and_copy "$EVIDENCE/it03-r2-source-v2-clip.txt"

  # 6) back to reading: v2 in both views
  back_to_reading
  shot "it03-r2-k-back-to-reading-v2.png"
  select_all_and_copy "$EVIDENCE/it03-r2-reading-v2-clip.txt"

  # 7) control: an in-place write still follows the normal update path
  printf '\n控制段落：原地追加写入 v3。\n' >>"$D/doc.md"
  sleep 3
  shot "it03-r2-l-inplace-banner.png"
  click "${IT03_UPDATE_X:-1103}" "${IT03_UPDATE_Y:-107}"
  sleep 0.6
  shot "it03-r2-m-inplace-fast.png"
  sleep 2
  shot "it03-r2-n-inplace-updated.png"
  select_all_and_copy "$EVIDENCE/it03-r2-reading-v3-clip.txt"
  terminate_app

  python3 - "$D/doc.md" <<'PY' | tee -a "$RUNS"
import sys
print('IT03 rerun final source tail:')
print(open(sys.argv[1]).read()[-200:])
PY
}

# ------------------------------------------------------------------- IT07 ----
section_it07() {
  AT_GROUP=it07r2
  group_header "IT07 11MiB simplified reading re-run (D-IT-3)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it07"

  local D="$INPUTS/it07"
  mkdir -p "$D"
  head -c 11534336 "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md" \
    >"$D/corpus-11MiB.md"
  sha256sum "$D/corpus-11MiB.md" >>"$RUNS"

  # tail probes: the last paragraph number starts inside the final
  # (truncated) line; it is unique and only indexed if the whole document
  # reached the search index.
  local tail_token
  tail_token="$(grep -o '段落 [0-9]*' "$D/corpus-11MiB.md" | tail -1)"
  log "IT07 rerun tail probe token: '$tail_token'"
  # exact expected copy payload of the corpus code blocks (first occurrence):
  # micromark code-value semantics exclude the line ending that terminated the
  # last content line, which is what the fast path and CodeBlock copy use.
  python3 - "$D/corpus-11MiB.md" "$EVIDENCE/it07-r2-code-payload.txt" <<'PY'
import sys
text = open(sys.argv[1], encoding='utf-8', errors='replace').read()
start = text.index('```rust\n') + len('```rust\n')
end = text.index('\n```', start)
payload = text[start:end]
open(sys.argv[2], 'w', encoding='utf-8').write(payload)
print('expected code payload bytes:', len(payload.encode('utf-8')))
PY

  reset_data
  local t_choice
  launch_app "$D/corpus-11MiB.md"
  sleep 2.5
  focus
  shot "it07-r2-a-large-dialog.png"

  # choose 简化阅读 (Return picks the focused default; click fallback if the
  # synthetic key is swallowed by the modal)
  local n=0
  t_choice="$(ms_now)"
  while (( n < 5 )); do
    n=$((n + 1))
    key Return
    sleep 0.8
    shot "it07-r2-choice-try${n}.png"
    modal_open "$EVIDENCE/it07-r2-choice-try${n}.png" || break
    click "${IT07_SIMPLIFIED_X:-278}" "${IT07_SIMPLIFIED_Y:-383}"
    sleep 0.8
  done
  log "IT07 rerun simplified choice made at try=$n (choice_ms=$t_choice)"

  # CPU watch runs in the background while fixed-offset screenshots document
  # the fast-path display; capped so the section stays bounded (probes showed
  # the process does not settle within 6 minutes).
  watch_webkit_cpu "$EVIDENCE/it07-r2-parse-cpu.txt" 75000 &
  local watch_pid=$!
  sleep 1; shot "it07-r2-b-parse-t1.png"
  sleep 1; shot "it07-r2-c-parse-t2.png"
  sleep 1; shot "it07-r2-d-parse-t3.png"
  sleep 2; shot "it07-r2-e-parse-t5.png"
  sleep 3; shot "it07-r2-f-parse-t8.png"
  shot "it07-r2-g-simplified-view.png"

  # code-block copy first, while the UI still processes input: the first
  # corpus code block is visible at the bottom of the first screen. Probe
  # calibration: block spans y≈690-800 on the first screen, action-bar top
  # row y≈690-730, copy control at (850,710); the copied payload must match
  # the source bytes byte-for-byte (trailing line ending excluded by the
  # micromark code-value semantics both paths use).
  set_clip "IT07-R2-LARGE-SENTINEL"
  click 640 770
  sleep 1
  shot "it07-r2-j-code-hover.png"
  click "${IT07_COPY_X:-850}" "${IT07_COPY_Y:-710}"
  sleep 1
  get_clip >"$EVIDENCE/it07-r2-code-clip.txt" 2>/dev/null || true
  log "IT07 rerun code clipboard bytes=$(wc -c < "$EVIDENCE/it07-r2-code-clip.txt" 2>/dev/null || echo 0)"
  cmp "$EVIDENCE/it07-r2-code-clip.txt" "$EVIDENCE/it07-r2-code-payload.txt" \
    && log "IT07 rerun code payload EXACT match" \
    || log "IT07 rerun code payload MISMATCH (see cmp in runs.log)"

  # tail search: the fast path indexes the whole text, so the final paragraph
  # marker must be found; the query is issued while the first screens are
  # still being mounted (probes: the search index is ready within ~10s of the
  # choice, when synthetic input is still processed intermittently).
  local search_start search_el
  search_start="$(ms_now)"
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.4
  paste_text "$tail_token"
  sleep 2
  shot "it07-r2-k-tail-search.png"
  # navigate to the (single) hit: the next-hit control is attempted first,
  # then Return (the wp-44 run used Return on this panel)
  click "${IT07_NEXT_X:-1179}" "${IT07_NEXT_Y:-101}"
  sleep 2
  shot "it07-r2-l-tail-next.png"
  key Return
  sleep 2
  shot "it07-r2-m-tail-return.png"
  search_el=$(( $(ms_now) - search_start ))
  log "IT07 rerun tail search+hit-attempts elapsed_ms=$search_el"
  key Escape
  sleep 0.5

  wait "$watch_pid" || true
  local settled_ms
  settled_ms="$(awk -F= '/^settled_ms=/{print $2}' "$EVIDENCE/it07-r2-parse-cpu.txt" | tail -1)"
  log "IT07 rerun CPU watch settled_ms=${settled_ms:-none} (choice_ms=${t_choice})"
  terminate_app
}

# ------------------------------------------------------------------- suite ---
section_suite() {
  AT_GROUP=suite
  group_header "frontend suite on the wp-46 revision (expect 568)"
  run_out "$EVIDENCE/unit-suite-itrerun.log" pnpm test -- --run
  grep -E "Test Files|Tests " "$EVIDENCE/unit-suite-itrerun.log" | tail -4 | tee -a "$RUNS"
}

case "${1:-all}" in
  it02) section_it02 ;;
  it03) section_it03 ;;
  it07) section_it07 ;;
  suite) section_suite ;;
  all) section_it02; section_it03; section_it07; section_suite ;;
  *) echo "usage: $0 [it02|it03|it07|suite|all]" >&2; exit 2 ;;
esac

group_footer
