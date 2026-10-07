#!/usr/bin/env bash
# run-it.sh — wp-44 integration acceptance driver: IT01–IT08 end-to-end
# scenario chains (requirements-baseline §8.5 / SRS §8.5; system-verification
# §10.2 condition C3).
#
# Unlike the AT01–AT30 single-feature acceptance runs, each section below
# drives one whole task chain and checks the chain's key result. The verified
# object is the wp-43 packaged build: the extracted .deb binary
# (dpkg-deb -x output/paperstack_0.1.0_amd64.deb) is used so that the tested
# artifact is the actual release package payload, not the development tree
# binary. The extraction lives under /tmp/opencode/ps-deb-it and is
# recreated on demand from the deb (sha256 recorded in runs.log).
#
# Fixed conditions follow the at-final batch: X11 DISPLAY=:1 (2520×1680),
# light GTK_THEME=Adwaita:light, text-scaling 1.25 (except the explicit
# 200% sub-step in IT07), isolated XDG_DATA_HOME/XDG_CACHE_HOME per section.
# Screenshots are evidence, not verification: every verdict in
# artifacts/70-verification/acceptance-it.md cites inspected screenshots,
# logs, hashes or database rows.
#
# Sections: it01 it02 it03 it04 it05 it06 it07 it08 suite all
# Usage: bash tests/desktop/run-it.sh [it01|...|suite|all]
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IT_EVIDENCE="${IT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/it}"
export AT_EVIDENCE="$IT_EVIDENCE"
source "$ROOT/tests/desktop/acceptance-lib.sh"

# --- packaged-build override -------------------------------------------------
DEB="${IT_DEB:-$ROOT/output/paperstack_0.1.0_amd64.deb}"
EXTRACT="${IT_EXTRACT:-/tmp/opencode/ps-deb-it}"

ensure_extract() {
  if [[ ! -x "$EXTRACT/usr/bin/paperstack" ]]; then
    log "extracting deb $DEB -> $EXTRACT"
    rm -rf "$EXTRACT"
    mkdir -p "$EXTRACT"
    dpkg-deb -x "$DEB" "$EXTRACT" || { log "FATAL: dpkg-deb -x failed"; exit 3; }
  fi
  APP_BIN="$EXTRACT/usr/bin/paperstack"
}

ensure_extract
APP_BIN="$EXTRACT/usr/bin/paperstack"
export APP_BIN
# light fixed condition (+ capture original theme/scale for cleanup restore)
fix_conditions
# acceptance-lib captured APP_BIN at source time; re-derive dependent paths.
# (launch_app/guard_no_instance read $APP_BIN at call time, so the override
# above is enough.)

DEB_SHA="$(sha256sum "$DEB" 2>/dev/null | cut -d' ' -f1 || echo missing)"
BIN_SHA="$(sha256sum "$APP_BIN" 2>/dev/null | cut -d' ' -f1 || echo missing)"

# dump_grants <tag>: read-only authorizations snapshot appended to runs.log.
dump_grants() {
  local tag="$1"
  printf '\n== authorizations dump [%s] %s ==\n' "$tag" "$(db_path)" >>"$RUNS"
  python3 - "$(db_path)" >>"$RUNS" 2>&1 <<'PY'
import sqlite3, sys
con = sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
try:
    rows = con.execute(
        'select grant_id, kind, canonical_path, scope, origins_json from authorizations order by granted_at'
    ).fetchall()
except Exception as exc:
    print(f'-- authorizations: ERR {exc}')
    raise SystemExit
print(f'-- authorizations: {len(rows)}')
for row in rows:
    print('  ', row)
PY
}

# snapshot_tree <dir> <outfile>: sorted file list with hashes (source-set
# stability evidence for IT01/IT06).
snapshot_tree() {
  local dir="$1" out="$2"
  ( cd "$dir" && find . -type f | LC_ALL=C sort | while read -r f; do
      printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"
    done ) >"$out"
}

# ss_app <outfile>: TCP sockets owned by the app process tree (zero-request /
# stop-new-request evidence; packet capture is not available without root).
ss_app() {
  local out="$1"
  : >"$out"
  local pid
  for pid in $(pgrep -f "$APP_BIN" || true); do
    ss -tanp 2>/dev/null | grep "pid=$pid," >>"$out" || true
  done
}

# app_pids_file <outfile>
app_pids_file() {
  local out="$1"
  ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$out"
}

# open_settings_privacy: Ctrl+, then the 隐私 section.
open_settings_privacy() {
  key ctrl+comma
  sleep 1
  click 278 303
  sleep 1.2
}

# source_view / back_to_reading: more menu 查看源码 / 返回阅读 (first item).
open_source_view() {
  click 1245 26
  sleep 0.8
  key Return
  sleep 2
}
back_to_reading() {
  click 1245 26
  sleep 0.8
  key Return
  sleep 1.5
}

# ------------------------------------------------------------------- IT01 ----
section_it01() {
  AT_GROUP=it01
  group_header "IT01 first read-only reading chain (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it01"

  local D="$INPUTS/it01/中文目录"
  mkdir -p "$D"
  {
    cat "$FIXTURES/rendering/mixed-cn-en.md"
    printf '\n## 任务清单\n\n- [ ] 未完成的任务项\n- [x] 已完成的任务项\n'
    printf '\n## 代码示例\n\n```c\nint main(void) { return 0; }\n```\n'
  } >"$D/混合文档.md"
  snapshot_tree "$INPUTS/it01" "$EVIDENCE/it01-source-before.txt"

  reset_data
  launch_app "$D/混合文档.md"
  sleep 3.5
  focus
  shot "it01-a-opened.png"

  # 1) select text (keyboard select-all after a content click)
  click 640 300
  sleep 0.5
  key ctrl+a
  sleep 1
  shot "it01-b-selection.png"

  # 2) click a task checkbox (read-only must not flip / must not write)
  wheel 640 400 5 6
  sleep 1
  shot "it01-c-tasklist.png"
  click "${IT01_CB_X:-257}" "${IT01_CB_Y:-524}"
  sleep 1
  shot "it01-d-after-checkbox.png"

  # 3) copy the code block (hover the block, then its 复制 action)
  wheel 640 400 5 10
  sleep 1
  shot "it01-e-code-region.png"
  click 640 "${IT01_CODE_HOVER_Y:-690}"
  sleep 0.8
  shot "it01-f-code-hover.png"
  set_clip "IT01-SENTINEL"
  click "${IT01_COPY_X:-860}" "${IT01_COPY_Y:-666}"
  sleep 0.8
  get_clip >"$EVIDENCE/it01-clipboard-code.txt" 2>/dev/null || true
  log "IT01 code clipboard bytes=$(wc -c < "$EVIDENCE/it01-clipboard-code.txt" 2>/dev/null || echo 0)"
  od -c "$EVIDENCE/it01-clipboard-code.txt" >>"$RUNS" 2>/dev/null || true

  # 4) close
  terminate_app

  snapshot_tree "$INPUTS/it01" "$EVIDENCE/it01-source-after.txt"
  diff "$EVIDENCE/it01-source-before.txt" "$EVIDENCE/it01-source-after.txt" \
    >"$EVIDENCE/it01-source-diff.txt" 2>&1 \
    && log "IT01 source tree IDENTICAL (files+hashes)" \
    || log "IT01 source tree CHANGED - see it01-source-diff.txt"
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
  AT_GROUP=it02
  group_header "IT02 continuous navigation chain (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it02"

  local D="$INPUTS/it02"
  write_it02_docs "$D"

  reset_data
  launch_app "$D/导航样例.md"
  sleep 3
  focus
  shot "it02-a-opened.png"

  # 1) outline -> jump
  key ctrl+b
  sleep 1
  shot "it02-b-outline.png"
  click "${IT02_OUTLINE_X:-139}" "${IT02_OUTLINE_Y:-278}"
  sleep 1.5
  key ctrl+b
  sleep 1
  shot "it02-c-after-outline-jump.png"

  # 2) footnote reference -> footnote area -> back-ref
  wheel 640 400 4 20
  sleep 1.5
  shot "it02-d-top.png"
  click "${IT02_REF_X:-390}" "${IT02_REF_Y:-214}"
  sleep 1.5
  shot "it02-e-footnote-area.png"
  click "${IT02_BACK_X:-614}" "${IT02_BACK_Y:-727}"
  sleep 1.5
  shot "it02-f-backref.png"

  # 3) search session: ten "next" presses (next-hit control)
  key ctrl+f
  sleep 1
  click 500 101
  sleep 0.3
  paste_text "导航标记"
  sleep 1.5
  shot "it02-g-search-first.png"
  local i
  for i in $(seq 1 10); do
    click "${IT02_NEXT_X:-1179}" "${IT02_NEXT_Y:-101}"
    sleep 0.35
    (( i == 1 )) && shot "it02-g2-search-next-1.png"
  done
  shot "it02-h-search-after-10-next.png"
  click "${IT02_SEARCH_CLOSE_X:-1230}" "${IT02_SEARCH_CLOSE_Y:-101}"
  sleep 1

  # 4) cross-file link -> second document (ASCII target; chain step)
  wheel 640 400 4 30
  sleep 1.5
  shot "it02-i-before-link.png"
  click "${IT02_LINK_X:-465}" "${IT02_LINK_Y:-275}"
  sleep 2
  shot "it02-j-second-doc.png"

  # 4b) non-ASCII link target: keep the observed failure as defect evidence
  key alt+Left
  sleep 1.5
  shot "it02-k1-back.png"
  click "${IT02_CJK_LINK_X:-592}" "${IT02_CJK_LINK_Y:-255}"
  sleep 2
  shot "it02-n-cjk-link-attempt.png"

  # 5) step back repeatedly (each navigation origin must be restored)
  local k
  for k in 2 3 4; do
    key alt+Left
    sleep 1.5
    shot "it02-k${k}-back.png"
  done

  # 6) per-tab isolation: a second tab is opened via CLI and is the active
  # tab; Alt+Left there must not consume the first tab's navigation history.
  run_out "$EVIDENCE/it02-second-tab.log" timeout 30 "$APP_BIN" "$D/second.md"
  sleep 2.5
  shot "it02-l-second-tab-active.png"
  key alt+Left
  sleep 1.5
  shot "it02-m-second-tab-back-noop.png"
  key ctrl+Tab
  sleep 1
  shot "it02-l2-first-tab.png"
  terminate_app
}

# ------------------------------------------------------------------- IT03 ----
section_it03() {
  AT_GROUP=it03
  group_header "IT03 selection under external update (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it03"

  local D="$INPUTS/it03"
  mkdir -p "$D"
  cp "$FIXTURES/update/v1.md" "$D/doc.md"

  reset_data
  launch_app "$D/doc.md"
  sleep 3
  focus
  shot "it03-a-v1.png"

  # 1) select text
  click 400 300
  sleep 0.5
  key ctrl+a
  sleep 1
  shot "it03-b-selection.png"

  # 2) external replace-save (rename over the source file, as editors do)
  python3 - "$D/doc.md" "$FIXTURES/update/v2.md" <<'PY'
import os, shutil, sys
target, v2 = sys.argv[1], sys.argv[2]
tmp = target + '.external-new'
shutil.copyfile(v2, tmp)
os.replace(tmp, target)
print('replace-save done')
PY
  sleep 3.5
  shot "it03-c-replace-unavailable.png"

  # 2b) recovery from the unavailable banner: 重试 re-reads the replacement
  click "${IT03_RETRY_X:-1082}" "${IT03_RETRY_Y:-106}"
  sleep 2.5
  shot "it03-c2-update-banner.png"

  # 3) 稍后 -> collapsed marker (selection must still be present)
  click "${IT03_LATER_X:-1213}" "${IT03_LATER_Y:-106}"
  sleep 1.2
  shot "it03-d-later-collapsed.png"

  # 4) source view; version must still be v1 there
  open_source_view
  shot "it03-e-source-v1.png"

  # 5) reopen the update action from the collapsed marker and commit
  click "${IT03_MARKER_X:-640}" "${IT03_MARKER_Y:-95}"
  sleep 1
  shot "it03-f-marker-reopened.png"
  click "${IT03_UPDATE_X:-1075}" "${IT03_UPDATE_Y:-106}"
  sleep 0.6
  shot "it03-g0-after-update-fast.png"
  sleep 2
  shot "it03-g-after-update.png"
  sleep 3
  shot "it03-h-after-update-late.png"

  # 6) source view after update: v2 in both views
  open_source_view
  shot "it03-i-source-v2.png"
  click "${IT03_BACK_READING_X:-1204}" "${IT03_BACK_READING_Y:-146}"
  sleep 1.5
  shot "it03-i2-back-to-reading-v2.png"

  # 7) control: an in-place write follows the normal update path (update banner
  # directly, no unavailable state) — isolates the rename-over defect
  printf '\n控制段落：原地追加写入 v3。\n' >>"$D/doc.md"
  sleep 3
  shot "it03-j-inplace-banner.png"
  click "${IT03_UPDATE_X:-1075}" "${IT03_UPDATE_Y:-106}"
  sleep 0.6
  shot "it03-k0-inplace-update-fast.png"
  sleep 2
  shot "it03-k-inplace-updated.png"
  terminate_app

  python3 - "$D/doc.md" <<'PY' | tee -a "$RUNS"
import sys
print('IT03 final source tail:')
print(open(sys.argv[1]).read()[-200:])
PY
}

# ------------------------------------------------------------------- IT04 ----
section_it04() {
  AT_GROUP=it04
  group_header "IT04 async ordering / close-tab approximation (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it04"

  local D="$INPUTS/it04"
  mkdir -p "$D"
  cp "$FIXTURES/update/v1.md" "$D/doc.md"

  reset_data
  launch_app "$D/doc.md"
  sleep 2.5
  shot "it04-a-v1.png"
  focus

  # choreography: slow (v1+RAPID-A) then fast (v1+RAPID-B) write 150 ms apart
  python3 - "$D/doc.md" <<'PY'
import sys, time
p = sys.argv[1]
base = open(p).read()
open(p, 'w').write(base + '\nRAPID-A 标记段落。\n')
time.sleep(0.15)
open(p, 'w').write(base + '\nRAPID-B 标记段落。\n')
print('rapid writes done')
PY
  sleep 3
  shot "it04-b-banner.png"

  # close the tab while the update task is still pending: no ghost tab may
  # remain, and the window must fall back to a clean single-tab/welcome state.
  key ctrl+w
  sleep 2
  shot "it04-c-after-close.png"

  # reopen the file: latest committed content must be RAPID-B, no rollback
  run_out "$EVIDENCE/it04-reopen.log" timeout 30 "$APP_BIN" "$D/doc.md"
  sleep 3
  shot "it04-d-reopened.png"
  sleep 3
  shot "it04-e-reopened-late.png"

  # explicit update path with the rapid pair (banner -> now)
  python3 - "$D/doc.md" <<'PY'
import sys, time
p = sys.argv[1]
base = open(p).read()
open(p, 'w').write(base + '\nRAPID-C 标记段落。\n')
time.sleep(0.15)
open(p, 'w').write(base + '\nRAPID-D 标记段落。\n')
print('rapid writes 2 done')
PY
  sleep 3
  shot "it04-f-banner2.png"
  click "${IT04_UPDATE_X:-1105}" "${IT04_UPDATE_Y:-107}"
  sleep 2.5
  shot "it04-g-after-update.png"
  sleep 3
  shot "it04-h-after-update-late.png"
  terminate_app
  python3 - "$D/doc.md" <<'PY' | tee -a "$RUNS"
import sys
print('IT04 final source tail:')
print(open(sys.argv[1]).read()[-160:])
PY
}

# ------------------------------------------------------------------- IT05 ----
section_it05() {
  AT_GROUP=it05
  group_header "IT05 permissions/offline chain (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it05"

  local D="$INPUTS/it05/doc"
  local OUT="$INPUTS/it05/outside"
  mkdir -p "$D" "$OUT"
  ffmpeg -y -loglevel error -f lavfi -i color=c=red:s=16x16 -frames:v 1 "$OUT/outside.png"
  {
    printf '# 权限与离线样例\n\n'
    printf '正文段落始终可读：这一行用于验证资源失败时正文不受影响。\n\n'
    printf '![越界本地图片](../outside/outside.png)\n\n'
    printf '![远程图片](https://httpbin.org/image/png)\n\n'
    printf '![缺失图片](./missing-image.png)\n\n'
    printf '结尾正文段落仍然可读。\n'
  } >"$D/permissions.md"

  # helper: block every dialog that appears (aggregate 保持阻止 at 280,565 and
  # remote 保持阻止 at 279,489) until none remains
  deny_all_dialogs() {
    local n=0
    while (( n < 5 )); do
      shot "it05-deny-${n}.png"
      modal_open "$EVIDENCE/it05-deny-${n}.png" || return 0
      click "${IT05_REMOTE_BLOCK_X:-279}" "${IT05_REMOTE_BLOCK_Y:-489}"
      sleep 0.6
      click "${IT05_BLOCK1_X:-280}" "${IT05_BLOCK1_Y:-565}"
      sleep 1.2
      n=$((n + 1))
    done
    return 0
  }

  # helper: allow every aggregate dialog that appears once (允许本次读取 at
  # 427,565); the remote confirm dialog is handled explicitly below
  allow_aggregate_dialogs() {
    local n=0
    while (( n < 4 )); do
      shot "it05-allow-${n}.png"
      modal_open "$EVIDENCE/it05-allow-${n}.png" || return 0
      click "${IT05_LOCAL_ALLOW_X:-427}" "${IT05_LOCAL_ALLOW_Y:-565}"
      sleep 1.2
      n=$((n + 1))
    done
    return 0
  }

  reset_data
  launch_app "$D/permissions.md"
  sleep 3.5
  shot "it05-a-initial.png"

  # 1) deny the local out-of-root prompt and every follow-up dialog
  deny_all_dialogs
  shot "it05-e-placeholders.png"

  # default zero requests (blocked remote + denied local)
  app_pids_file "$EVIDENCE/it05-app-pids.txt"
  ss_app "$EVIDENCE/it05-sockets-blocked.txt"
  log "IT05 blocked-state sockets: $(wc -l < "$EVIDENCE/it05-sockets-blocked.txt") lines"

  # 2) allow the local out-of-root resource once, then the missing-image
  # directory so its specific "not found" state becomes visible
  click "${IT05_LOCAL_SCOPE_X:-301}" "${IT05_LOCAL_SCOPE_Y:-329}"
  sleep 1.5
  allow_aggregate_dialogs
  sleep 1
  shot "it05-g-local-allowed.png"

  # 3) allow the remote image once for this document session (after the local
  # image rendered, the remote placeholder sits higher: button y≈399)
  click "${IT05_REMOTE_ALLOW_BTN_X:-270}" "${IT05_REMOTE_ALLOW_BTN_Y:-399}"
  sleep 1.5
  shot "it05-h-remote-confirm.png"
  if modal_open "$EVIDENCE/it05-h-remote-confirm.png"; then
    click "${IT05_REMOTE_ALLOW_X:-449}" "${IT05_REMOTE_ALLOW_Y:-489}"
    sleep 4
  fi
  sleep 3
  shot "it05-i-remote-allowed.png"
  sleep 3
  shot "it05-j-remote-allowed-late.png"
  ss_app "$EVIDENCE/it05-sockets-after-allow.txt"
  log "IT05 after-allow sockets: $(wc -l < "$EVIDENCE/it05-sockets-after-allow.txt") lines"
  find "$EVIDENCE/cache-it05" -path '*remote*' -type f -exec ls -la {} \; 2>/dev/null \
    >"$EVIDENCE/it05-remote-cache.txt" || true

  # 4) revoke: settings -> privacy -> revoke the persistent file grant
  dump_grants "IT05 before revoke"
  open_settings_privacy
  sleep 0.5
  shot "it05-k-privacy-usage.png"
  wheel 600 500 5 10
  sleep 1
  shot "it05-l-grants-list.png"
  # revoke the first row (the document's file grant; measured row position)
  click "${IT05_REVOKE1_X:-1035}" "${IT05_REVOKE1_Y:-596}"
  sleep 1.2
  shot "it05-m-revoked-notice.png"
  click "${IT05_REVOKE1B_X:-1035}" "${IT05_REVOKE1B_Y:-434}"
  sleep 1
  shot "it05-m2-revoked-check.png"
  # close the settings panel (synthetic Escape can be swallowed; verify with
  # the overlay pixel probe and retry)
  local t=0
  while (( t < 4 )); do
    t=$((t + 1))
    shot "it05-n-close-settings-try${t}.png"
    if ! modal_open "$EVIDENCE/it05-n-close-settings-try${t}.png"; then break; fi
    key Escape
    sleep 1.2
  done
  click "${IT05_SETTINGS_CLOSE_X:-1035}" "${IT05_SETTINGS_CLOSE_Y:-111}"
  sleep 1.2
  shot "it05-n-back-to-reader-after-revoke.png"

  # 5) after revocation new reads must stop (same session, tab still open):
  # retry the local out-of-root placeholder and (if the tab went unavailable)
  # the banner 重试; no new sockets may appear.
  click "${IT05_LOCAL_SCOPE_X:-301}" "${IT05_LOCAL_SCOPE_Y:-329}"
  sleep 1
  shot "it05-o-after-revoke-attempt.png"
  click "${IT05_RETRY_X:-1082}" "${IT05_RETRY_Y:-113}"
  sleep 2
  shot "it05-o2-after-revoke-retry.png"
  ss_app "$EVIDENCE/it05-sockets-after-revoke.txt"
  log "IT05 after-revoke sockets: $(wc -l < "$EVIDENCE/it05-sockets-after-revoke.txt") lines"
  terminate_app
  dump_grants "IT05 after revoke exit"
}

# ------------------------------------------------------------------- IT06 ----
section_it06() {
  AT_GROUP=it06
  group_header "IT06 restart/privacy chain (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it06"

  local D="$INPUTS/it06"
  mkdir -p "$D"
  cp "$FIXTURES/rendering/math.md" "$D/doc-a.md"
  cp "$FIXTURES/rendering/tables.md" "$D/doc-b.md"
  cp "$FIXTURES/rendering/code.md" "$D/doc-c.md"

  reset_data
  # seed a multi-tab session: open three docs, activate the second, scroll it
  # (so a position record exists), exit
  launch_app "$D/doc-a.md" "$D/doc-b.md" "$D/doc-c.md"
  sleep 3
  click 200 87
  sleep 1
  wheel 640 400 5 5
  sleep 1.5
  shot "it06-a-three-tabs.png"
  terminate_app
  db_dump "IT06 seed (expect session_tabs=3, positions=1)"

  # restart -> restored multi-tabs
  launch_app
  sleep 3.5
  shot "it06-b-restored.png"
  db_dump "IT06 after restart (expect session_tabs=3)"

  # move one source file away
  mv "$D/doc-b.md" "$D/doc-b.md.bak"
  sleep 3
  shot "it06-c-moved-file.png"

  # switch to first tab: other pages must stay readable
  click 100 87
  sleep 1
  shot "it06-d-other-tab-readable.png"
  click 230 87
  sleep 1
  shot "it06-e-third-tab-readable.png"

  # clear positions/session records via settings -> privacy
  open_settings_privacy
  sleep 0.5
  shot "it06-f-privacy.png"
  click "${IT06_CLEAR_BTN_X:-511}" "${IT06_CLEAR_BTN_Y:-622}"
  sleep 1.5
  shot "it06-g-clear-dialog.png"
  click 233 "${IT06_RECENTS_CB_Y:-291}"
  sleep 0.4
  click 233 "${IT06_POS_CB_Y:-411}"
  sleep 0.5
  shot "it06-h-selected.png"
  click "${IT06_CONFIRM_X:-386}" "${IT06_CONFIRM_Y:-662}"
  sleep 3
  shot "it06-i-clear-results.png"
  click "${IT06_CLOSE_X:-257}" "${IT06_CLOSE_Y:-663}"
  sleep 1
  key Escape
  sleep 1
  terminate_app
  db_dump "IT06 after clear+exit (expect session/positions cleared)"
  dump_grants "IT06 after clear"

  # restart: cleared session must not be rebuilt
  launch_app
  sleep 3
  shot "it06-j-restart-welcome.png"
  terminate_app
  db_dump "IT06 after final restart (no auto re-creation)"
}

# ------------------------------------------------------------------- IT07 ----
section_it07() {
  AT_GROUP=it07
  group_header "IT07 keyboard + large-file chain (packaged binary)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it07"

  # -- A. keyboard-only pass: open -> search -> back -> update -> copy -> close
  reset_data
  launch_app
  sleep 2
  shot "it07-a-welcome.png"
  focus
  # open via keyboard: Ctrl+O picker -> Ctrl+L path -> Return
  key ctrl+o
  sleep 1.5
  root_shot "it07-b-picker.png"
  confirm_picker_path "$FIXTURES/rendering/links.md"
  sleep 3
  shot "it07-c-keyboard-opened.png"
  # search
  key ctrl+f
  sleep 0.8
  paste_text "Duplicate"
  sleep 1.2
  key Return
  sleep 0.8
  shot "it07-d-keyboard-search.png"
  key Escape
  sleep 0.5
  key Escape
  sleep 0.5
  # back: activate the first body link by keyboard (Tab x10) then Alt+Left
  local i
  for i in $(seq 1 10); do key Tab; sleep 0.3; done
  shot "it07-e-tab-reaches-link.png"
  key Return
  sleep 1.2
  shot "it07-f-link-activated.png"
  key alt+Left
  sleep 1.2
  shot "it07-g-keyboard-back.png"
  terminate_app

  # keyboard copy (fresh launch, no banner in the tab order: Tab x8 = 复制)
  reset_data
  local D="$INPUTS/it07kb"
  mkdir -p "$D"
  cp "$FIXTURES/rendering/code.md" "$D/keyboard-code.md"
  launch_app "$D/keyboard-code.md"
  sleep 3
  for i in $(seq 1 8); do key Tab; sleep 0.3; done
  shot "it07-k-focus-copy.png"
  set_clip "IT07-KB-SENTINEL"
  key Return
  sleep 0.8
  get_clip >"$EVIDENCE/it07-kb-clipboard.txt" 2>/dev/null || true
  log "IT07 keyboard clipboard bytes=$(wc -c < "$EVIDENCE/it07-kb-clipboard.txt" 2>/dev/null || echo 0)"
  key ctrl+w
  sleep 1.2
  shot "it07-l-after-keyboard-close.png"
  terminate_app

  # keyboard update (fresh launch; Tab x8 = 现在更新)
  reset_data
  launch_app "$D/keyboard-code.md"
  sleep 3
  printf '\n键盘更新段落 KEYBOARD-UPDATE。\n' >>"$D/keyboard-code.md"
  sleep 3
  shot "it07-h-keyboard-banner.png"
  for i in $(seq 1 8); do key Tab; sleep 0.3; done
  shot "it07-i-focus-now-update.png"
  key Return
  sleep 0.7
  shot "it07-j0-keyboard-update-toast.png"
  sleep 1.5
  shot "it07-j-keyboard-updated.png"
  key Next
  key Next
  sleep 1
  shot "it07-j2-keyboard-updated-tail.png"
  key ctrl+w
  sleep 1.2
  terminate_app

  # choose 简化阅读 in the large-doc dialog (click until the overlay is gone;
  # synthetic keys alone were not reliable on this dialog)
  choose_simplified() {
    local n=0
    while (( n < 6 )); do
      n=$((n + 1))
      shot "it07-choice-try${n}.png"
      modal_open "$EVIDENCE/it07-choice-try${n}.png" || return 0
      # the button sits at y≈383 (11 MiB dialog) or y≈408 (2 MiB dialog)
      click "${IT07_SIMPLIFIED_X:-278}" "${IT07_SIMPLIFIED_Y:-383}"
      sleep 0.6
      click "${IT07_SIMPLIFIED_X:-278}" "${IT07_SIMPLIFIED_Y2:-408}"
      sleep 1.2
    done
    return 1
  }

  # -- B. large-document path: 11 MiB threshold corpus (bounded observation) ---
  reset_data
  mkdir -p "$INPUTS/it07"
  head -c 11534336 "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md" \
    >"$INPUTS/it07/corpus-11MiB.md"
  launch_app "$INPUTS/it07/corpus-11MiB.md"
  sleep 3
  shot "it07-m-large-dialog.png"
  choose_simplified
  sleep 14
  shot "it07-n-simplified-parse-t15.png"
  sleep 45
  shot "it07-o-simplified-parse-t60.png"
  ps -eo pid,%cpu,etime,args | grep -E 'WebKitWebProcess' | grep -v grep \
    >"$EVIDENCE/it07-parse-cpu.txt" || true
  key ctrl+f
  sleep 1
  paste_text "needle"
  sleep 8
  shot "it07-p-search-during-parse.png"
  terminate_app
  log "IT07 11MiB parse observation: see it07-parse-cpu.txt"

  # -- C. complexity-large-doc simplified search/copy (2 MiB corpus) ----------
  reset_data
  head -c 2097152 "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md" \
    >"$INPUTS/it07/corpus-2MiB.md"
  local tail_token
  tail_token="$(grep -o 'needle-[0-9]*' "$INPUTS/it07/corpus-2MiB.md" | tail -1)"
  log "IT07 2MiB tail-ish token: $tail_token"
  launch_app "$INPUTS/it07/corpus-2MiB.md"
  sleep 3
  shot "it07-q-large-dialog-2m.png"
  choose_simplified
  sleep 7
  shot "it07-r-simplified-2m.png"
  key ctrl+f
  sleep 1
  paste_text "$tail_token"
  sleep 6
  shot "it07-s-tail-search.png"
  key Return
  sleep 4
  shot "it07-t-tail-hit.png"
  key Escape
  sleep 0.8
  # search a code-block marker, jump, and copy from the block action bar
  key ctrl+f
  sleep 1
  paste_text "fixed code block"
  sleep 9
  shot "it07-s2-code-search.png"
  key Return
  sleep 4
  shot "it07-u-code-hit.png"
  key Escape
  sleep 0.8
  click 640 "${IT07_CODE_HOVER_Y:-430}"
  sleep 0.8
  shot "it07-v-code-hover.png"
  set_clip "IT07-LARGE-SENTINEL"
  click "${IT07_COPY_X:-1080}" "${IT07_COPY_Y:-404}"
  sleep 0.8
  get_clip >"$EVIDENCE/it07-large-clipboard.txt" 2>/dev/null || true
  log "IT07 large-view clipboard bytes=$(wc -c < "$EVIDENCE/it07-large-clipboard.txt" 2>/dev/null || echo 0)"
  terminate_app

  # -- D. drawer focus return ------------------------------------------------
  reset_data
  launch_app "$FIXTURES/rendering/tables.md"
  sleep 2.5
  key ctrl+b
  sleep 1
  shot "it07-w-drawer-open.png"
  key ctrl+b
  sleep 1
  shot "it07-x-drawer-closed.png"
  click 640 300
  sleep 0.3
  key Tab
  sleep 0.5
  shot "it07-y-focus-after-drawer.png"
  terminate_app

  # -- E. 200% scaling attempt ------------------------------------------------
  gsettings set org.gnome.desktop.interface text-scaling-factor 2.0
  log "text-scaling-factor set to 2.0"
  launch_app "$FIXTURES/rendering/mixed-cn-en.md"
  sleep 3
  shot "it07-z-scale200.png"
  key ctrl+f
  sleep 0.8
  paste_text "中文"
  sleep 1.2
  shot "it07-z2-scale200-search.png"
  key Escape
  sleep 0.5
  key ctrl+b
  sleep 1
  shot "it07-z3-scale200-drawer.png"
  terminate_app
  gsettings set org.gnome.desktop.interface text-scaling-factor 1.25
  log "text-scaling-factor restored to 1.25"
}

# ------------------------------------------------------------------- IT08 ----
section_it08() {
  AT_GROUP=it08
  group_header "IT08 delivered-package chain (extract-run .deb)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-it08"

  run_out "$EVIDENCE/it08-deb-identity.txt" sh -c \
    "stat -c 'path=%n size=%s mtime=%y' '$DEB'; sha256sum '$DEB'; dpkg-deb -f '$DEB' Package Version Maintainer Architecture Depends"
  run_out "$EVIDENCE/it08-deb-listing.txt" dpkg-deb -c "$DEB"
  run_out "$EVIDENCE/it08-desktop-entry.txt" cat "$EXTRACT/usr/share/applications/paperstack.desktop"
  sha256sum "$EXTRACT/usr/bin/paperstack" "$EXTRACT/usr/lib/paperstack/LICENSE" \
    "$EXTRACT/usr/lib/paperstack/THIRD_PARTY_NOTICES.md" >"$EVIDENCE/it08-payload-hashes.txt"
  cmp "$EXTRACT/usr/lib/paperstack/LICENSE" "$ROOT/LICENSE" && echo "LICENSE byte-identical" >>"$RUNS" || true
  cmp "$EXTRACT/usr/lib/paperstack/THIRD_PARTY_NOTICES.md" "$ROOT/THIRD_PARTY_NOTICES.md" \
    && echo "THIRD_PARTY_NOTICES byte-identical" >>"$RUNS" || true

  local D="$INPUTS/it08"
  mkdir -p "$D"
  cp "$FIXTURES/rendering/mixed-cn-en.md" "$D/系统打开样例.md"

  # system-open semantics: launch through the packaged desktop entry with the
  # extraction tree on PATH/XDG_DATA_DIRS (gtk-launch reads the .desktop file).
  reset_data
  local used="gtk-launch"
  env GTK_THEME=Adwaita:light XDG_DATA_HOME="$AT_DATA" \
    XDG_DATA_DIRS="$EXTRACT/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}" \
    PATH="$EXTRACT/usr/bin:$PATH" \
    gtk-launch paperstack "$D/系统打开样例.md" \
    >>"$APP_LOG" 2>&1 &
  local launch_pid=$!
  sleep 1
  run "$HELPER" wait
  if ! pgrep -f "$APP_BIN" >/dev/null 2>&1; then
    used="direct-fallback"
    log "gtk-launch path did not start the app; falling back to direct exec"
    launch_app "$D/系统打开样例.md"
  fi
  sleep 4
  shot "it08-a-system-open.png"
  sleep 3
  shot "it08-a2-system-open-confirmed.png"
  terminate_app
  pkill -f "$APP_BIN" 2>/dev/null || true
  sleep 1
  log "IT08 system-open launch path used: $used"

  # about page + offline legal viewers on the extracted payload
  reset_data
  launch_app
  sleep 2
  click 1245 26
  sleep 0.8
  key End
  sleep 0.3
  key Return
  sleep 1.5
  shot "it08-b-about.png"
  click 499 579
  sleep 1.5
  shot "it08-c-license-viewer.png"
  key Escape
  sleep 0.8
  click 649 579
  sleep 1.5
  shot "it08-d-third-party-viewer.png"
  key Escape
  sleep 0.8
  key Escape
  sleep 1
  terminate_app
}

# ------------------------------------------------------------------- suite ---
section_suite() {
  AT_GROUP=suite
  group_header "frontend suite on the wp-44 revision (expect 547)"
  run_out "$EVIDENCE/unit-suite-it.log" pnpm test -- --run
  grep -E "Test Files|Tests " "$EVIDENCE/unit-suite-it.log" | tail -4 | tee -a "$RUNS"
}

case "${1:-all}" in
  it01) section_it01 ;;
  it02) section_it02 ;;
  it03) section_it03 ;;
  it04) section_it04 ;;
  it05) section_it05 ;;
  it06) section_it06 ;;
  it07) section_it07 ;;
  it08) section_it08 ;;
  suite) section_suite ;;
  all)
    section_it08
    section_it01
    section_it02
    section_it03
    section_it04
    section_it05
    section_it06
    section_it07
    section_suite
    ;;
  *) echo "usage: $0 [it01|it02|it03|it04|it05|it06|it07|it08|suite|all]" >&2; exit 2 ;;
esac

group_footer
