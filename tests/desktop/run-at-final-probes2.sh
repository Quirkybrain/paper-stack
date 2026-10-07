#!/usr/bin/env bash
# run-at-final-probes2.sh — wp-42 at-final focused probes (round 2).
#
# Purpose: re-obtain sub-item evidence whose classic-run observation was
# disturbed by accumulated session restore (the product now restores sessions
# correctly, so the wp-34 group scripts' tab math no longer holds) or by
# desktop interference. Every section resets the isolated data dir first, so
# each scenario runs from a single-document fresh session on the recorded
# binary (same AT_EVIDENCE=at-final fixed conditions as run-at-final.sh).
#
# Sections:
#   at01  — file picker: open → keyboard confirm (tables.md) → cancel path
#   at04  — edge-cases read-only: task checkbox click must not change the doc
#   at05  — fresh 3-tab lifecycle + MRU close
#   at08  — standard Markdown mode: strikethrough/dollar as literal source
#   at11b — second (C++) code block copy byte check
#   at17  — search chain: 中文 / SECRET case toggle / folded-code "line 45"
#   at29  — 11 MiB simplified mode: search usable
#
# Usage: bash tests/desktop/run-at-final-probes2.sh [at01|at04|at05|at08|at11b|at17|at29|all]
set -uo pipefail
AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-final}"
export AT_EVIDENCE
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
ensure_helper
fix_conditions

# ---------------------------------------------------------------- AT01 ------
section_at01() {
  AT_GROUP=at01fp
  group_header "AT01 file-picker open/confirm/cancel (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at01fp"

  reset_data
  launch_app
  sleep 2
  focus
  open_picker_file
  sleep 1
  root_shot "at01-fp-a-picker-open-root.png"
  shot "at01-fp-a2-picker-open.png"
  confirm_picker_path "$FIXTURES/rendering/tables.md"
  sleep 2.5
  shot "at01-fp-b-picker-file-opened.png"
  # cancel path: open again, Escape keeps the tab state unchanged
  focus
  open_picker_file
  sleep 1
  shot "at01-fp-c-picker2-open.png"
  key Escape
  sleep 1
  shot "at01-fp-d-picker2-cancelled.png"
  terminate_app
}

# ---------------------------------------------------------------- AT04 ------
section_at04() {
  AT_GROUP=at04fp
  group_header "AT04 task checkbox click on edge-cases (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at04fp"

  reset_data
  cp "$FIXTURES/rendering/edge-cases.md" "$INPUTS/at04-fp-edge.md"
  sha256sum "$INPUTS/at04-fp-edge.md" >"$EVIDENCE/at04-fp-source-before.sha256"
  launch_app "$INPUTS/at04-fp-edge.md"
  sleep 4
  shot "at04-fp-a-loaded.png"
  wheel 640 400 5 3
  sleep 1.5
  shot "at04-fp-b-tasklist.png"
  # checkbox column: click the unchecked item's checkbox (measured from the shot)
  click "${AT04_CB_X:-213}" "${AT04_CB_Y:-576}"
  sleep 1
  shot "at04-fp-c-after-checkbox-click.png"
  terminate_app
  sha256sum "$INPUTS/at04-fp-edge.md" >"$EVIDENCE/at04-fp-source-after.sha256"
  diff "$EVIDENCE/at04-fp-source-before.sha256" "$EVIDENCE/at04-fp-source-after.sha256" \
    >"$EVIDENCE/at04-fp-source-diff.txt" 2>&1 && log "AT04 fp source IDENTICAL" || log "AT04 fp source CHANGED"
}

# ---------------------------------------------------------------- AT05 ------
section_at05() {
  AT_GROUP=at05fp
  group_header "AT05 3-tab lifecycle + MRU (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at05fp"

  reset_data
  launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
  sleep 3.5
  focus
  shot "at05-fp-a-three-tabs.png"
  key ctrl+Tab
  sleep 0.8
  shot "at05-fp-b-ctrl-tab-next.png"
  key ctrl+Tab
  sleep 0.8
  shot "at05-fp-c-ctrl-tab-third.png"
  key ctrl+w
  sleep 1
  shot "at05-fp-d-close-third.png"
  # MRU discriminator with the remaining tabs math(≈72) and code(≈250):
  # activate math, then code, then math again; closing math must activate
  # code (MRU) — a plain right-neighbour fallback has no right tab here, so
  # the decisive 3-tab MRU check is re-run after reopening tables instead.
  click 72 87
  sleep 0.5
  click 250 87
  sleep 0.5
  click 72 87
  sleep 0.5
  shot "at05-fp-e-mru-setup.png"
  key ctrl+w
  sleep 1
  shot "at05-fp-f-mru-after-close.png"
  # decisive: reopen a third tab (tables), focus math, focus tables, focus
  # math, close math -> MRU activates tables; right-neighbour would pick code.
  run "$HELPER" focus
  run_out "$EVIDENCE/at05-fp-reopen.log" timeout 30 "$APP_BIN" "$FIXTURES/rendering/tables.md"
  sleep 2
  click 72 87
  sleep 0.5
  click 362 87
  sleep 0.5
  click 72 87
  sleep 0.5
  shot "at05-fp-g-mru3-setup.png"
  key ctrl+w
  sleep 1
  shot "at05-fp-h-mru3-after-close.png"
  terminate_app
}

# ---------------------------------------------------------------- AT08 ------
section_at08() {
  AT_GROUP=at08fp
  group_header "AT08 standard mode literals (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at08fp"

  reset_data
  launch_app "$FIXTURES/rendering/mixed-cn-en.md"
  sleep 3.5
  shot "at08-fp-a-technical.png"
  focus
  key ctrl+comma
  sleep 1
  click 278 258
  sleep 1
  click 455 392   # 标准 Markdown
  sleep 1.5
  shot "at08-fp-b-standard-selected.png"
  key Escape
  sleep 1.5
  shot "at08-fp-c-standard-doc.png"
  # restore technical mode
  focus
  key ctrl+comma
  sleep 1
  click 278 258
  sleep 1
  click 455 344   # 技术文档
  sleep 1
  key Escape
  sleep 0.5
  terminate_app
}

# ---------------------------------------------------------------- AT11 ------
section_at11b() {
  AT_GROUP=at11bfp
  group_header "AT11 second-block copy byte check (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at11bfp"

  reset_data
  launch_app "$FIXTURES/rendering/code.md"
  sleep 4
  focus
  run "$HELPER" click 640 350
  sleep 0.8
  shot "at11-fp2-a-hover.png"
  set_clip "PROBE2-SENTINEL"
  click 866 278
  sleep 0.8
  get_clip >"$EVIDENCE/at11-fp2-clip-c.txt" 2>/dev/null || true
  log "AT11 fp2 first-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-fp2-clip-c.txt")"
  od -c "$EVIDENCE/at11-fp2-clip-c.txt" >>"$RUNS"
  run "$HELPER" click 640 397
  sleep 0.8
  shot "at11-fp2-b-second-hover.png"
  set_clip "PROBE2-SENTINEL"
  click 866 397
  sleep 0.8
  get_clip >"$EVIDENCE/at11-fp2-clip-cpp.txt" 2>/dev/null || true
  log "AT11 fp2 second-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-fp2-clip-cpp.txt")"
  od -c "$EVIDENCE/at11-fp2-clip-cpp.txt" >>"$RUNS"
  terminate_app
}

# ---------------------------------------------------------------- AT17 ------
section_at17() {
  AT_GROUP=at17fp
  group_header "AT17 search chain (fresh sessions)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at17fp"

  reset_data
  launch_app "$FIXTURES/search/search-samples.md"
  sleep 3
  dismiss_modal "at17-fp-a-prompt" 3
  focus
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.3
  paste_text "中文"
  sleep 1.5
  shot "at17-fp-b-zh.png"
  click 500 101
  sleep 0.3
  key ctrl+a
  paste_text "SECRET"
  sleep 1.5
  shot "at17-fp-c-secret.png"
  click 898 101   # 区分大小写
  sleep 1.5
  shot "at17-fp-d-secret-case.png"
  key Escape
  sleep 0.5
  terminate_app

  # folded-code search in a fresh single-document session
  reset_data
  launch_app "$FIXTURES/rendering/code.md"
  sleep 3.5
  focus
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.3
  paste_text "line 45"
  sleep 2
  shot "at17-fp-e-folded-hit.png"
  terminate_app
}

# ---------------------------------------------------------------- AT29 ------
section_at29() {
  AT_GROUP=at29fp
  group_header "AT29 11MiB simplified search (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at29fp"

  reset_data
  mkdir -p "$INPUTS/at29"
  head -c 11534336 "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md" >"$INPUTS/at29/doc-11MiB.md"
  launch_app "$INPUTS/at29/doc-11MiB.md"
  sleep 2
  focus
  key Return   # default = 简化阅读
  sleep 6
  shot "at29-fp-a-simplified.png"
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.3
  paste_text "needle"
  sleep 8
  shot "at29-fp-b-search.png"
  terminate_app
}

# ---------------------------------------------------------------- AT05b ----
# Clean decisive MRU check: with exactly 3 fresh tabs, focus math -> tables ->
# math and close math; MRU activates tables, a right-neighbour fallback would
# activate code (tables is to the right of math and code is between them).
section_at05b() {
  AT_GROUP=at05bfp
  group_header "AT05 decisive MRU (fresh 3 tabs)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at05bfp"

  reset_data
  launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
  sleep 3.5
  focus
  shot "at05-fp2-a-three-tabs.png"
  click 64 87
  sleep 0.6
  click 320 87
  sleep 0.6
  click 64 87
  sleep 0.6
  shot "at05-fp2-b-mru-setup-math-active.png"
  key ctrl+w
  sleep 1.2
  shot "at05-fp2-c-mru-after-close.png"
  terminate_app
}

# ---------------------------------------------------------------- AT11c ----
# Folded 45-line block copy: byte evidence into fresh files (the earlier
# folded-copy capture lost its raw file to the interference re-run; counts
# remain in runs.log at 00:09:46).
section_at11c() {
  AT_GROUP=at11cfp
  group_header "AT11 folded-block copy (fresh session)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at11cfp"

  reset_data
  launch_app "$FIXTURES/rendering/code.md"
  sleep 4
  focus
  wheel 640 400 5 30
  sleep 1
  shot "at11-fp3-a-fold-end.png"
  wheel 640 400 4 6
  sleep 1
  shot "at11-fp3-b-fold-top.png"
  run "$HELPER" click 640 350
  sleep 0.8
  shot "at11-fp3-c-fold-hover.png"
  set_clip "PROBE3-SENTINEL"
  click 715 155
  sleep 0.8
  get_clip >"$EVIDENCE/at11-fp3-clip-fold.txt" 2>/dev/null || true
  log "AT11 fp3 folded-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-fp3-clip-fold.txt") lines=$(wc -l < "$EVIDENCE/at11-fp3-clip-fold.txt")"
  od -c "$EVIDENCE/at11-fp3-clip-fold.txt" | head -4 >>"$RUNS"
  terminate_app
}

case "${1:-all}" in
  at01) section_at01 ;;
  at04) section_at04 ;;
  at05) section_at05 ;;
  at05b) section_at05b ;;
  at08) section_at08 ;;
  at11b) section_at11b ;;
  at11c) section_at11c ;;
  at17) section_at17 ;;
  at29) section_at29 ;;
  all) section_at01; section_at04; section_at05; section_at08; section_at11b; section_at17; section_at29 ;;
  *) echo "usage: $0 [at01|at04|at05|at05b|at08|at11b|at11c|at17|at29|all]" >&2; exit 2 ;;
esac

group_footer
