#!/usr/bin/env bash
# run-at-rerun-wp34d.sh — wp-34d revision-3 re-run driver on the wp-34c fixed
# release binary (evidence: artifacts/70-verification/evidence/at-rerun2/).
#
# Sections (all use the wp-34b fixed conditions: X11 DISPLAY=:1, light
# GTK_THEME, text-scaling 1.25, isolated XDG_DATA_HOME + XDG_CACHE_HOME):
#   at19       — font-size change -> relaunch -> position restore (silent
#                same-version, exact cross-version, heading/ancestor approx
#                fallback with nav.return.approx, top-fallback control).
#   at26       — remote image URL WITH path: blocked by default (0 sockets),
#                session allow -> controlled fetch (socket watch + cache +
#                rendered image).
#   at28       — error-state source-directory export -> dedicated blocked
#                notice (never an overwrite prompt); existing non-source
#                target -> real overwrite confirmation -> success; fresh
#                non-source target -> success; registered-document source
#                directory -> dedicated blocked notice.
#   regression — AT05 (tabs / MRU close) + AT17 (search incl. zero result).
#
# Usage: bash tests/desktop/run-at-rerun-wp34d.sh [at19|at26|at28|regression|all]
# Default: all (sequential). Re-runs are idempotent over the evidence names.
AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun2}"
export AT_EVIDENCE
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
ensure_helper
fix_conditions

# ---------------------------------------------------------------- AT19 ------
section_at19() {
  AT_GROUP=rerun5
  group_header "AT19 re-run on wp-34c fixed binary (wp-34d)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache"

  reset_data
  A19="$INPUTS/at19-r3"
  mkdir -p "$A19"
  cp "$FIXTURES/reader-min/reader-min.md" "$A19/doc.md"

  launch_app "$A19/doc.md"
  sleep 2
  dismiss_modal "at19-r3-a-prompt" 3
  wheel 640 400 5 4
  sleep 3
  shot "at19-r3-b-block-before-font.png"
  # font size 17 -> 22 (Reading section, first field; text area centre)
  key ctrl+comma
  sleep 1
  click 475 259
  sleep 0.5
  key ctrl+a
  paste_text "22"
  sleep 0.3
  key Return
  sleep 1.5
  shot "at19-r3-c-font22.png"
  key Escape
  sleep 1.2
  shot "at19-r3-d-block-after-font.png"
  sleep 2.5
  terminate_app
  db_dump "AT19r3 after font change exit (expect positions row + settings fontSizePx=22)"

  # Same-version relaunch: position restored, exact same-version is silent.
  launch_app
  sleep 3.5
  dismiss_modal "at19-r3-e-prompt" 3
  shot "at19-r3-e-same-version-restored.png"
  terminate_app
  db_dump "AT19r3 same-version restore exit"

  # Cross-version append kept: unique fingerprint -> exact label.
  printf '\n## 附加小节\n\n新增内容（版本 2）。\n' >>"$A19/doc.md"
  launch_app
  sleep 3.5
  dismiss_modal "at19-r3-f-prompt" 3
  shot "at19-r3-f-cross-version-exact.png"
  terminate_app
  db_dump "AT19r3 cross-version exact exit"

  # Rewrite the anchor block only -> heading/ancestor approximate restore
  # (D-34b-1 case): must scroll into the restored section + approx label.
  python3 - "$A19/doc.md" <<'PY'
import sys
p = sys.argv[1]
text = open(p, encoding='utf-8').read()
assert '块公式：' in text
text = text.replace('块公式：', '块公式（版本 3 改写）：')
open(p, 'w', encoding='utf-8').write(text)
print('v3 anchor rewrite done')
PY
  launch_app
  sleep 3.5
  dismiss_modal "at19-r3-g-prompt" 3
  shot "at19-r3-g-heading-fallback-approx.png"
  terminate_app
  db_dump "AT19r3 heading-fallback approx exit"

  # Top-fallback control (all headings renamed, blockId null).
  reset_data
  A19B="$INPUTS/at19b-r3"
  mkdir -p "$A19B"
  cp "$FIXTURES/reader-min/reader-min.md" "$A19B/doc.md"
  launch_app "$A19B/doc.md"
  sleep 2
  dismiss_modal "at19b-r3-prompt-a" 3
  wheel 640 400 5 4
  sleep 3
  shot "at19-r3-h-topcontrol-before.png"
  terminate_app
  db_dump "AT19r3 top-control seed exit"

  python3 - "$A19B/doc.md" <<'PY'
import sys
p = sys.argv[1]
text = open(p, encoding='utf-8').read()
assert '块公式：' in text
text = text.replace('# PaperStack 阅读样例（wp-19 冒烟）', '# PaperStack 阅读样例（修订版）')
text = text.replace('## 数学公式', '## 数学（修订版）')
text = text.replace('块公式：', '块公式（改写）：')
open(p, 'w', encoding='utf-8').write(text)
print('headings + anchor rewritten -> top fallback')
PY
  launch_app
  sleep 3.5
  dismiss_modal "at19b-r3-prompt-b" 3
  shot "at19-r3-i-top-fallback-approx.png"
  terminate_app
  db_dump "AT19r3 top-fallback approx exit"
}

# ---------------------------------------------------------------- AT26 ------
section_at26() {
  AT_GROUP=rerun6
  group_header "AT26 re-run on wp-34c fixed binary (wp-34d)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at26"

  # app_sockets <outfile>: process-tree TCP socket lines for the app binary.
  app_sockets() {
    local out="$1"
    ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$out.pids"
    : >"$out"
    local pid
    for pid in $(cat "$out.pids"); do
      ss -tanp 2>/dev/null | grep "pid=$pid," >>"$out" || true
    done
    log "$(basename "$out"): $(wc -l <"$out") socket lines (pids: $(tr '\n' ' ' <"$out.pids"))"
  }

  # app_socket_watch <outfile> <seconds>: background sampling so a short-lived
  # controlled fetch connection is captured.
  app_socket_watch() {
    local out="$1" secs="$2" end
    : >"$out"
    end=$(( $(date +%s%3N) + secs * 1000 ))
    while (( $(date +%s%3N) < end )); do
      for pid in $(pgrep -f "$APP_BIN"); do
        ss -tanp 2>/dev/null | grep "pid=$pid," >>"$out" || true
      done
      sleep 0.1
    done
    sort -u "$out" -o "$out"
    log "$(basename "$out"): $(wc -l <"$out") socket samples after sort -u"
  }

  reset_data
  A26="$INPUTS/at26-r3"
  mkdir -p "$A26"
  printf '# Remote with path\n\n![remote png](https://httpbin.org/image/png)\n' >"$A26/remote-path.md"
  timeout 10 curl -sI --noproxy '*' https://httpbin.org/image/png -o /dev/null -w "curl direct httpbin /image/png: %{http_code}\n" >>"$RUNS" 2>&1 || true
  timeout 10 curl -sI https://httpbin.org/image/png -o /dev/null -w "curl proxied httpbin /image/png: %{http_code}\n" >>"$RUNS" 2>&1 || true

  launch_app "$A26/remote-path.md"
  sleep 3.5
  shot "at26-r3-a-blocked-with-path-dialog.png"
  app_sockets "$EVIDENCE/at26-r3-sockets-blocked.txt"
  click 279 487    # 保持阻止
  sleep 1.5
  shot "at26-r3-b-blocked-placeholder.png"
  click 260 260    # 了解连接范围 on the placeholder (re-prompt)
  sleep 1.5
  shot "at26-r3-c-confirm-dialog.png"
  app_socket_watch "$EVIDENCE/at26-r3-sockets-watch.txt" 10 &
  WATCH_PID=$!
  click 449 487    # 本次文档允许加载
  sleep 4
  shot "at26-r3-d-after-allow.png"
  wait "$WATCH_PID" 2>/dev/null || true
  app_sockets "$EVIDENCE/at26-r3-sockets-after.txt"
  sleep 1.5
  shot "at26-r3-e-after-allow-late.png"
  find "$EVIDENCE/cache-at26" -type f 2>/dev/null | tee -a "$RUNS"
  cp "$AT_DATA/com.quirkybrain.paperstack/logs/paperstack.log" "$EVIDENCE/at26-r3-app-log.txt" 2>/dev/null || true
  grep -c command_failed "$EVIDENCE/at26-r3-app-log.txt" 2>/dev/null | sed 's/^/at26-r3 app log command_failed lines: /' | tee -a "$RUNS" || true
  terminate_app
  db_dump "AT26r3 after allow exit (expect cache_meta row if the fetch ran)"
}

# ---------------------------------------------------------------- AT28 ------
section_at28() {
  AT_GROUP=rerun7
  group_header "AT28 re-run on wp-34c fixed binary (wp-34d)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at28"

  A28="$INPUTS/at28-r3"
  mkdir -p "$A28"

  # gtk_accept_button <tag>: root screenshot + accent-button detection; prints
  # the accept-button position when the Save File dialog is visible (empty
  # when the dialog is gone).
  gtk_accept_button() {
    local tag="$1"
    root_shot "${tag}-check.png"
    python3 "$DESKTOP/find-gtk-accept.py" "$EVIDENCE/${tag}-check.png" 600 2>/dev/null || true
  }

  # gtk_type_path_and_accept <tag> <path>: picker open; enter the path via the
  # location entry and accept with bounded Return retries. Closure is verified
  # visually, so no Return is sent after the dialog is gone.
  gtk_type_path_and_accept() {
    local tag="$1" path="$2" i accept
    set_clip "$path"
    key ctrl+l
    sleep 0.8
    key ctrl+v
    sleep 0.8
    for i in 1 2 3 4 5 6; do
      key Return
      sleep 1.0
      accept="$(gtk_accept_button "$tag-$i")"
      if [[ -z "$accept" ]]; then
        log "$tag: GTK save dialog closed after $i Return(s)"
        return 0
      fi
      log "$tag: still open after Return x$i (accept button at $accept)"
    done
    log "WARNING $tag: GTK save dialog did not close after 6 Returns"
    return 1
  }

  # click_app_button <shot> <accent|danger> [min_y]: detect an in-app button by
  # its design-token colour in the client screenshot and click its centre.
  click_app_button() {
    local shot="$1" kind="$2" miny="${3:-0}" center
    center="$(python3 "$DESKTOP/find-app-button.py" "$EVIDENCE/$shot" "$kind" "$miny" 2>/dev/null || true)"
    if [[ -z "$center" ]]; then
      log "WARNING: $kind button not found in $shot"
      return 1
    fi
    log "click_app_button: $kind at $center ($shot)"
    click $center
    return 0
  }

  reset_data
  launch_app "$FIXTURES/encoding/latin1.md"
  sleep 2
  shot "at28-r3-a-error.png"
  click 1130 107   # 诊断
  sleep 1.5
  shot "at28-r3-b-panel.png"
  click 449 511    # 导出诊断 (focus, then activate by keyboard)
  sleep 0.5
  key space
  sleep 1.5
  shot "at28-r3-c-preview.png"

  # Case A: protected source-directory target -> dedicated blocked notice.
  # A dummy typed file keeps the GTK location entry valid; the appended target
  # stays inside the protected source directory.
  printf 'dummy typed path\n' >"$FIXTURES/encoding/probe-out.txt"
  click_app_button "at28-r3-c-preview.png" accent 500 || click 384 637
  sleep 1.5
  gtk_type_path_and_accept "at28-r3-caseA" "$FIXTURES/encoding/probe-out.txt" || true
  sleep 2.5
  shot "at28-r3-d-protected-blocked.png"
  log "AT28 case A exported-target files: $(find "$FIXTURES/encoding" -maxdepth 1 -name 'probe-out.txt.*' | wc -l); listing: $(ls "$FIXTURES/encoding" | grep probe-out | tr '\n' ' ')"

  # Case A2: repeat the same typed non-source path so the second export targets
  # an existing file -> real overwrite confirmation.
  printf 'dummy typed path\n' >"$A28/out-existing.txt"
  ls "$A28" >"$EVIDENCE/at28-r3-a2-before.lst"
  click_app_button "at28-r3-d-protected-blocked.png" accent 500 || click 384 637
  sleep 1.5
  gtk_type_path_and_accept "at28-r3-caseA2a" "$A28/out-existing.txt" || true
  sleep 2.5
  shot "at28-r3-e1-first-nonsource-export.png"
  ls "$A28" >"$EVIDENCE/at28-r3-a2-after.lst"
  comm -13 <(sort "$EVIDENCE/at28-r3-a2-before.lst") <(sort "$EVIDENCE/at28-r3-a2-after.lst") | tee "$EVIDENCE/at28-r3-a2-learned-target.txt"
  log "AT28 A2 learned target: $(tr '\n' ' ' <"$EVIDENCE/at28-r3-a2-learned-target.txt")"
  shot "at28-r3-e0-before-repeat.png"
  click_app_button "at28-r3-e0-before-repeat.png" accent 500 || click 384 637
  sleep 1.5
  gtk_type_path_and_accept "at28-r3-caseA2b" "$A28/out-existing.txt" || true
  sleep 2.5
  shot "at28-r3-e-overwrite-confirm.png"
  wheel 640 500 5 4
  sleep 1
  shot "at28-r3-e2-overwrite-confirm-scrolled.png"
  click_app_button "at28-r3-e2-overwrite-confirm-scrolled.png" danger 0 || log "WARNING: overwrite confirm button not found"
  sleep 2.5
  shot "at28-r3-e3-overwrite-done.png"
  A2EXPORT="$(find "$A28" -maxdepth 1 -type f -name 'out-existing.txt.*' | head -1)"
  if [[ -n "$A2EXPORT" ]]; then cp "$A2EXPORT" "$EVIDENCE/at28-r3-a2-overwritten-export.txt"; fi
  log "AT28 A2 targets after confirm: $(ls -la "$A28" | grep -v '^total' | grep -v '^d' | awk '{print $5, $9}' | tr '\n' ' ')"

  # Case B: fresh non-source target -> success without any prompt.
  rm -f "$A28/out-new.txt" "$A28/out-new.txt."*
  printf 'dummy typed path\n' >"$A28/out-new.txt"
  wheel 640 400 4 4   # scroll the modal back up
  sleep 1
  shot "at28-r3-f0-before-caseB.png"
  click_app_button "at28-r3-f0-before-caseB.png" accent 400 || click 384 637
  sleep 1.5
  gtk_type_path_and_accept "at28-r3-caseB" "$A28/out-new.txt" || true
  sleep 2.5
  shot "at28-r3-f-nonsource-success.png"
  BEXPORT="$(find "$A28" -maxdepth 1 -type f -name 'out-new.txt.*' | head -1)"
  if [[ -n "$BEXPORT" ]]; then cp "$BEXPORT" "$EVIDENCE/at28-r3-caseB-export.txt"; fi
  log "AT28 case B files in $A28:"
  find "$A28" -type f | tee -a "$RUNS"
  key Escape
  sleep 0.8
  terminate_app

  # Case C: registered document + error document; export to the registered
  # document's source directory must be rejected with the dedicated notice.
  reset_data
  launch_app "$FIXTURES/rendering/math.md"
  sleep 1.5
  run_out "$EVIDENCE/at28-r3-second-instance.log" timeout 30 "$APP_BIN" "$FIXTURES/encoding/latin1.md"
  sleep 2.5
  shot "at28-r3-g-two-docs-latin1-active.png"
  click 1130 107   # 诊断 on the active error tab
  sleep 1.5
  click 449 681    # 导出诊断 (panel with two entries; coordinate from wp-34b)
  sleep 0.5
  key space
  sleep 1.5
  shot "at28-r3-g2-preview-registered.png"
  printf 'dummy typed path\n' >"$FIXTURES/rendering/probe-out.txt"
  click_app_button "at28-r3-g2-preview-registered.png" accent 600 || click 384 723
  sleep 1.5
  gtk_type_path_and_accept "at28-r3-caseC" "$FIXTURES/rendering/probe-out.txt" || true
  sleep 2.5
  wheel 640 400 5 4
  sleep 1
  shot "at28-r3-h-registered-blocked.png"
  log "AT28 case C exported-target files: $(find "$FIXTURES/rendering" -maxdepth 1 -name 'probe-out.txt.*' | wc -l); listing: $(ls "$FIXTURES/rendering" | grep probe-out | tr '\n' ' ')"
  key Escape
  sleep 0.8
  terminate_app

  rm -f "$FIXTURES/encoding/probe-out.txt" "$FIXTURES/rendering/probe-out.txt"
  rm -rf "$A28"
  log "AT28 scenario cleanup done; fixture probe files: $(find "$FIXTURES/encoding" "$FIXTURES/rendering" -maxdepth 1 -name 'probe-out*' | wc -l)"
}

# ------------------------------------------------------------ regression ----
section_regression() {
  AT_GROUP=rerun8
  group_header "AT05 + AT17 regression spot-check on wp-34c fixed binary (wp-34d)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-rerun8"
  reset_data

  launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
  sleep 1.5
  shot "at05-r3-a-three-tabs.png"
  key ctrl+Tab
  sleep 1
  shot "at05-r3-b-ctrl-tab-next.png"
  key ctrl+Tab
  sleep 1
  shot "at05-r3-c-ctrl-tab-third.png"
  key ctrl+w
  sleep 1.2
  shot "at05-r3-d-close-third.png"
  click 90 87
  sleep 0.5
  click 280 87
  sleep 0.5
  click 90 87
  sleep 0.5
  shot "at05-r3-e-mru-setup.png"
  key ctrl+w
  sleep 1.2
  shot "at05-r3-f-mru-after-close.png"
  terminate_app

  reset_data
  launch_app "$FIXTURES/search/search-samples.md"
  sleep 2.5
  dismiss_modal "at17-r3-a-prompt" 3
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.3
  paste_text "中文"
  sleep 1.5
  shot "at17-r3-b-zh-hit.png"
  click 500 101
  sleep 0.3
  key ctrl+a
  paste_text "SECRET"
  sleep 1.5
  shot "at17-r3-c-secret-hits.png"
  click 500 101
  sleep 0.3
  key ctrl+a
  paste_text "quux-absent-token"
  sleep 1.5
  shot "at17-r3-d-zero.png"
  key Escape
  sleep 0.5
  terminate_app
}

case "${1:-all}" in
  at19) section_at19 ;;
  at26) section_at26 ;;
  at28) section_at28 ;;
  regression) section_regression ;;
  all)
    section_at19
    section_at26
    section_at28
    section_regression
    ;;
  *)
    echo "usage: $0 [at19|at26|at28|regression|all]" >&2
    exit 2
    ;;
esac

group_footer
