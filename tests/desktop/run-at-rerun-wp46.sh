#!/usr/bin/env bash
# run-at-rerun-wp46.sh — wp-46 AT spot-checks on the CURRENT-TREE release binary
# (wp-45 fixes merged): AT15 (links incl. non-ASCII cross-file targets),
# AT21/AT22 (external update incl. replacement-save), AT29 (10 MiB+ simplified
# reading). Evidence: artifacts/70-verification/evidence/at-rerun4/.
#
# These sections re-drive the affected AT scenario steps only; unaffected AT
# items keep their Rev 5 verdicts (see acceptance-at.md). Fixed conditions are
# the at-final batch: X11 DISPLAY=:1 (2520×1680), light GTK_THEME, text-scaling
# 1.25, isolated XDG_DATA_HOME and per-section XDG_CACHE_HOME.
#
# Sections: at15 at21 at22 at29 all
# Usage: bash tests/desktop/run-at-rerun-wp46.sh [at15|at21|at22|at29|all]
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AT_EVIDENCE="${AT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/at-rerun4}"
source "$ROOT/tests/desktop/acceptance-lib.sh"

# Development-tree release binary rebuilt from the wp-45 merge revision.
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
export APP_BIN
fix_conditions
ensure_helper

BIN_SHA="$(sha256sum "$APP_BIN" 2>/dev/null | cut -d' ' -f1 || echo missing)"
log "AT-rerun4 binary: $APP_BIN sha256=$BIN_SHA size=$(stat -c%s "$APP_BIN" 2>/dev/null || echo 0)"

select_all_and_copy() {
  local out="$1"
  click 640 400
  sleep 0.4
  key ctrl+a
  sleep 0.7
  set_clip "PS-AT-RERUN4-SENTINEL"
  key ctrl+c
  sleep 0.8
  get_clip >"$out" 2>/dev/null || true
  log "clipboard capture ${out##*/}: bytes=$(wc -c < "$out" 2>/dev/null || echo 0)"
}

# ------------------------------------------------------------------- AT15 ----
section_at15() {
  AT_GROUP=at15r5
  group_header "AT15 links re-run: fragments + non-ASCII cross-file targets"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at15"

  # -- links.md fragment behavior (unchanged path, spot regression) ----------
  reset_data
  launch_app "$FIXTURES/rendering/links.md"
  sleep 1.5
  wheel 640 400 4 20
  sleep 1.5
  shot "at15-r5-a-top.png"
  click 300 418
  sleep 1.5
  shot "at15-r5-b-fragment-jump.png"
  wheel 640 400 4 20
  sleep 1.5
  click 630 418
  sleep 1.5
  shot "at15-r5-c-missing-fragment-notice.png"
  click 1207 108
  sleep 1
  wheel 640 400 4 20
  sleep 1.5
  click 300 573
  sleep 1.5
  shot "at15-r5-d-page-internal-jump.png"
  terminate_app

  # -- non-ASCII cross-file targets (D-IT-1 / R15) ---------------------------
  local A15="$INPUTS/at15-r5"
  mkdir -p "$A15"
  {
    printf '# 链接样例\n\n'
    printf '[中文名文档](./中文文档.md)\n\n'
    printf '[带 空格 文档](./带%%20空格%%20文档.md)\n'
  } >"$A15/doc.md"
  {
    printf '# 中文名文档\n\n'
    printf '这份中文文档由非 ASCII 跨文件链接打开，内容用于字节级核对。\n'
  } >"$A15/中文文档.md"
  {
    printf '# 带 空格 文档\n\n'
    printf '这份带空格的文档由百分号编码链接打开，内容用于字节级核对。\n'
  } >"$A15/带 空格 文档.md"

  reset_data
  launch_app "$A15/doc.md"
  sleep 2.5
  focus
  shot "at15-r5-e-doc-top.png"
  # non-ASCII target (fresh view: link 1 at y≈176)
  local attempt ok=0
  for attempt in 1 2; do
    click "${AT15_CJK_X:-250}" "${AT15_CJK_Y:-176}"
    sleep 2.2
    shot "at15-r5-f-cjk-opened-try${attempt}.png"
    select_all_and_copy "$EVIDENCE/at15-r5-cjk-clip-try${attempt}.txt"
    if grep -q "这份中文文档" "$EVIDENCE/at15-r5-cjk-clip-try${attempt}.txt"; then
      ok=1
      break
    fi
  done
  log "AT15 rerun CJK link opened: $( (( ok == 1 )) && echo yes || echo NO ) (try=$attempt)"
  terminate_app

  # percent-encoded space target: relaunch for the deterministic fresh layout
  # (link 2 at y≈232); the restored-position banner would shift coordinates
  launch_app "$A15/doc.md"
  sleep 2.5
  focus
  shot "at15-r5-g-relaunch-top.png"
  ok=0
  for attempt in 1 2; do
    click "${AT15_SPACE_X:-255}" "${AT15_SPACE_Y:-232}"
    sleep 2.2
    shot "at15-r5-h-space-opened-try${attempt}.png"
    select_all_and_copy "$EVIDENCE/at15-r5-space-clip-try${attempt}.txt"
    if grep -q "这份带空格的文档" "$EVIDENCE/at15-r5-space-clip-try${attempt}.txt"; then
      ok=1
      break
    fi
  done
  log "AT15 rerun space-name link opened: $( (( ok == 1 )) && echo yes || echo NO ) (try=$attempt)"
  terminate_app
}

# ------------------------------------------------------------------- AT21 ----
section_at21() {
  AT_GROUP=at21r5
  group_header "AT21 update re-run incl. replacement-save (R21/R22)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at21"

  local A21="$INPUTS/at21-r5"
  mkdir -p "$A21"
  cp "$FIXTURES/update/v1.md" "$A21/doc.md"

  reset_data
  launch_app "$A21/doc.md"
  sleep 1.5
  shot "at21-r5-a-v1.png"
  printf '\n新增段落：v2 已写入。\n' >>"$A21/doc.md"
  sleep 3
  shot "at21-r5-b-banner-append.png"
  click "${AT21_UPDATE_X:-1103}" "${AT21_UPDATE_Y:-107}"
  sleep 2
  shot "at21-r5-c-updated-v2.png"

  # replacement-save v3: copy + rename over (editor-style save). The wp-45 fix
  # must show the normal update banner directly — no 找不到原文件 state.
  python3 - "$A21/doc.md" <<'PY'
import os, shutil, sys
target = sys.argv[1]
base = open(target, encoding='utf-8').read()
tmp = target + '.external-new'
open(tmp, 'w', encoding='utf-8').write(base + '\n替换保存段落 R5-REPLACE。\n')
os.replace(tmp, target)
print('replacement-save done')
PY
  sleep 0.8
  shot "at21-r5-d-replace-fast.png"
  sleep 2.7
  shot "at21-r5-e-replace-banner.png"
  click "${AT21_LATER_X:-1210}" "${AT21_LATER_Y:-107}"
  sleep 1.2
  shot "at21-r5-f-later-collapsed.png"
  click "${AT21_MARKER_X:-640}" "${AT21_MARKER_Y:-94}"
  sleep 1
  shot "at21-r5-g-marker-reopened.png"
  click "${AT21_UPDATE_X:-1103}" "${AT21_UPDATE_Y:-107}"
  sleep 2
  shot "at21-r5-h-updated-v3.png"
  select_all_and_copy "$EVIDENCE/at21-r5-reading-v3-clip.txt"
  terminate_app
}

# ------------------------------------------------------------------- AT22 ----
section_at22() {
  AT_GROUP=at22r5
  group_header "AT22 async version re-run incl. replacement-save (R22)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at22"

  local A22="$INPUTS/at22-r5"
  mkdir -p "$A22"
  cp "$FIXTURES/update/v1.md" "$A22/doc.md"

  reset_data
  launch_app "$A22/doc.md"
  sleep 1.5
  # rapid in-place pair: 150 ms A then B must merge into one candidate
  python3 - "$A22/doc.md" <<'PY'
import sys, time
p = sys.argv[1]
base = open(p, encoding='utf-8').read()
open(p, 'w', encoding='utf-8').write(base + '\nRAPID-A 标记段落。\n')
time.sleep(0.15)
open(p, 'w', encoding='utf-8').write(base + '\nRAPID-B 标记段落。\n')
print('rapid writes done')
PY
  sleep 3
  shot "at22-r5-a-rapid-banner.png"
  click "${AT22_UPDATE_X:-1103}" "${AT22_UPDATE_Y:-107}"
  sleep 1
  shot "at22-r5-b-after-update-t1.png"
  sleep 3
  shot "at22-r5-c-after-update-t4.png"

  # rapid replacement-save pair: two rename-overs 150 ms apart; the removed
  # hint must not break the candidate merge or cause a rollback.
  python3 - "$A22/doc.md" <<'PY'
import os, sys, time
p = sys.argv[1]
base = open(p, encoding='utf-8').read()
tmp = p + '.external-c'
open(tmp, 'w', encoding='utf-8').write(base + '\nRAPID-C 标记段落。\n')
os.replace(tmp, p)
time.sleep(0.15)
tmp = p + '.external-d'
open(tmp, 'w', encoding='utf-8').write(base + '\nRAPID-D 标记段落。\n')
os.replace(tmp, p)
print('rapid replacement saves done')
PY
  sleep 3
  shot "at22-r5-d-replace-banner.png"
  click "${AT22_UPDATE_X:-1103}" "${AT22_UPDATE_Y:-107}"
  sleep 1
  shot "at22-r5-e-after-update-t1.png"
  sleep 3
  shot "at22-r5-f-after-update-t4.png"
  select_all_and_copy "$EVIDENCE/at22-r5-reading-clip.txt"
  terminate_app
}

# ------------------------------------------------------------------- AT29 ----
section_at29() {
  AT_GROUP=at29r5
  group_header "AT29 11MiB simplified re-run (R29)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at29"

  local D="$INPUTS/at29"
  mkdir -p "$D"
  head -c 11534336 "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md" \
    >"$D/doc-11MiB.md"
  sha256sum "$D/doc-11MiB.md" >>"$RUNS"
  local tail_token
  tail_token="$(grep -o '段落 [0-9]*' "$D/doc-11MiB.md" | tail -1)"
  log "AT29 rerun tail probe token: '$tail_token'"

  reset_data
  launch_app "$D/doc-11MiB.md"
  sleep 2.5
  focus
  shot "at29-r5-a-dialog.png"
  local n=0
  while (( n < 5 )); do
    n=$((n + 1))
    key Return
    sleep 0.8
    shot "at29-r5-choice-try${n}.png"
    modal_open "$EVIDENCE/at29-r5-choice-try${n}.png" || break
    click "${AT29_SIMPLIFIED_X:-278}" "${AT29_SIMPLIFIED_Y:-383}"
    sleep 0.8
  done
  log "AT29 rerun simplified choice made at try=$n"
  sleep 4.5
  shot "at29-r5-b-simplified.png"

  # search final-count check for the unique tail paragraph (R5.6 item)
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.4
  paste_text "$tail_token"
  sleep 2
  shot "at29-r5-c-tail-search.png"
  click "${AT29_NEXT_X:-1179}" "${AT29_NEXT_Y:-101}"
  sleep 2
  shot "at29-r5-d-tail-next.png"
  key Return
  sleep 2
  shot "at29-r5-e-tail-return.png"
  key Escape
  sleep 0.5
  terminate_app

  # 52 MiB hard limit: source-window mode without full rendering
  local T0 T1
  T0="$(date +%s%3N)"
  launch_app "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md"
  T1="$(date +%s%3N)"
  log "AT29 rerun 52MiB launch-to-window ms=$((T1 - T0))"
  sleep 4
  shot "at29-r5-f-52mib-source.png"
  ps -eo rss,args | grep -F "$APP_BIN" | grep -v grep | awk '{print "rss_kb="$1}' >>"$RUNS" || true
  terminate_app
}

case "${1:-all}" in
  at15) section_at15 ;;
  at21) section_at21 ;;
  at22) section_at22 ;;
  at29) section_at29 ;;
  all) section_at15; section_at21; section_at22; section_at29 ;;
  *) echo "usage: $0 [at15|at21|at22|at29|all]" >&2; exit 2 ;;
esac

group_footer
