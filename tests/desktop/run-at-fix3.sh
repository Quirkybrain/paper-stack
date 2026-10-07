#!/usr/bin/env bash
# run-at-fix3.sh — AT11 fold copy, AT12 zoom, AT14 outline jump, AT15/16 links
# and history with measured coordinates (wp-34).
AT_GROUP=fix3
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT11/12/14/15/16 fix-ups"
ensure_helper
fix_conditions
reset_data

# ---- AT11: folded 45-line block copy ---------------------------------------
launch_app "$FIXTURES/rendering/code.md"
sleep 1.5
wheel 640 400 5 30
sleep 1
shot "at11-e-fold-end.png"
wheel 640 400 4 6
sleep 1
shot "at11-f-block-top.png"
run "$HELPER" click 640 350
sleep 0.8
shot "at11-g-block-hover.png"
click 866 300
sleep 0.8
get_clip >"$EVIDENCE/at11-clipboard-fold.txt" 2>/dev/null || true
log "AT11 folded-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-clipboard-fold.txt") lines=$(wc -l < "$EVIDENCE/at11-clipboard-fold.txt")"
terminate_app

# ---- AT12: zoom overlay -----------------------------------------------------
launch_app "$FIXTURES/rendering/mermaid.md"
sleep 2.5
click 375 251   # 放大 on the supported flowchart
sleep 1.5
shot "at12-e-zoom-overlay.png"
key Escape
sleep 1
shot "at12-f-zoom-closed.png"
terminate_app

# ---- AT14: outline jump to second duplicate ---------------------------------
launch_app "$FIXTURES/rendering/links.md"
sleep 1.5
key ctrl+b
sleep 1
wheel 640 400 5 10
sleep 1
shot "at14-c-scrolled-bottom.png"
click 139 229   # outline: Duplicate 标题 (1)
sleep 1.5
shot "at14-d-jump-first.png"
click 139 278   # outline: Duplicate 标题 (2)
sleep 1.5
shot "at14-e-jump-second.png"
terminate_app

# ---- AT15: link behaviors ----------------------------------------------------
launch_app "$FIXTURES/rendering/links.md"
sleep 1.5
shot "at15-f-top.png"
click 300 417   # jump to first duplicate
sleep 1.5
shot "at15-g-internal-jump.png"
click 601 417   # missing fragment
sleep 1
shot "at15-h-missing-fragment.png"
click 336 610   # relative document link -> navigate in same tab
sleep 2.5
shot "at15-i-relative-nav.png"
key alt+Left
sleep 2
shot "at16-c-back-links.png"
key alt+Right
sleep 2
shot "at16-d-forward-mixed.png"
key alt+Left
sleep 2
# new navigation clears the forward branch
click 300 573   # page-internal link (new history entry)
sleep 1.5
shot "at16-e-new-nav.png"
# external link: browser must open, app itself must not fetch
ps -eo pid,comm | grep -Ei 'firefox|chrome' >"$EVIDENCE/at15-browsers-before.txt" || true
ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$EVIDENCE/at15-app-pids2.txt"
for pid in $(cat "$EVIDENCE/at15-app-pids2.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at15-sockets-before-ext.txt"
click 276 684   # external link
sleep 3
ps -eo pid,comm | grep -Ei 'firefox|chrome' >"$EVIDENCE/at15-browsers-after.txt" || true
for pid in $(cat "$EVIDENCE/at15-app-pids2.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at15-sockets-after-ext.txt"
shot "at15-j-after-external.png"
# clean up any browser we launched
pkill -TERM -f firefox 2>/dev/null || true
pkill -TERM -f "google-chrome" 2>/dev/null || true
sleep 1
# ftp and javascript links must not spawn external apps or navigate
ps -eo pid,comm | grep -Ei 'firefox|chrome' >"$EVIDENCE/at15-browsers-before2.txt" || true
click 387 721   # ftp
sleep 1.5
shot "at15-k-ftp.png"
click 371 758   # javascript:
sleep 1.5
shot "at15-l-javascript.png"
ps -eo pid,comm | grep -Ei 'firefox|chrome' >"$EVIDENCE/at15-browsers-after2.txt" || true
terminate_app

group_footer
