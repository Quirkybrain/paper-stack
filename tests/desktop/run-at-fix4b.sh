#!/usr/bin/env bash
# run-at-fix4b.sh — residual AT15/17/26/27/28 evidence (wp-34).
AT_GROUP=fix4b
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT15/17/26/27/28 fix-ups"
ensure_helper
fix_conditions

# ---- AT17: folded 45-line code hit ------------------------------------------
launch_app "$FIXTURES/rendering/code.md"
sleep 1.5
key ctrl+f
sleep 1
click 500 101
sleep 0.3
paste_text "line 45"
sleep 1.5
shot "at17-m-folded-hit.png"
terminate_app

# ---- AT26: remote with path (defect probe) and without path (blocked flow) --
A26="$INPUTS/at26"
mkdir -p "$A26"
printf '# Remote no-path\n\n![remote root](https://httpbin.org)\n' >"$A26/nopath.md"
launch_app "$A26/nopath.md"
sleep 3
shot "at26-e-nopath-blocked.png"
click 490 244   # 了解连接范围 on the blocked placeholder
sleep 1.5
shot "at26-f-remote-prompt.png"
terminate_app
launch_app "$A26/remote.md"
sleep 3
shot "at26-g-path-unsupported.png"
terminate_app

# ---- AT27: clear records (click + Return, then keyboard) ---------------------
reset_data
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
sleep 1
terminate_app
launch_app
sleep 1.5
key ctrl+comma
sleep 1
click 278 303
sleep 1
click 508 622
sleep 0.6
key Return
sleep 1.5
shot "at27-h-clear-dialog.png"
click 500 300   # first category checkbox in the dialog
sleep 0.6
shot "at27-i-selected.png"
click 560 690   # cancel (left) / confirm (right) depending on layout
sleep 0.6
shot "at27-j-after-action.png"
terminate_app
log "== AT27 fix4b counts =="
python3 - "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3" <<'PY' | tee -a "$RUNS"
import sqlite3, sys
con=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
for t in ('documents','recents','session_tabs','positions'):
    try: print(t, con.execute(f'select count(*) from {t}').fetchone()[0])
    except Exception as e: print(t, 'ERR', e)
PY

# ---- AT28: diagnostics copy + export preview ---------------------------------
launch_app "$FIXTURES/encoding/latin1.md"
sleep 1.5
click 1130 107
sleep 1
click 301 511
sleep 0.6
get_clip >"$EVIDENCE/at28-clip-summary3.txt" 2>/dev/null || true
log "AT28 summary3 bytes=$(wc -c < "$EVIDENCE/at28-clip-summary3.txt")"
click 449 511
sleep 0.6
key Return
sleep 1.5
shot "at28-d-preview.png"
terminate_app

# ---- AT15: internal jump + external link observation -------------------------
launch_app "$FIXTURES/rendering/links.md"
sleep 1.5
click 300 573   # Page-internal (#more-links)
sleep 1.5
shot "at15-m-internal-jump.png"
xwininfo -display "$DISPLAY_ID" -root -tree 2>/dev/null | grep -Ei "chrome|firefox" >"$EVIDENCE/at15-windows-before.txt" || true
ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$EVIDENCE/at15-app-pids3.txt"
for pid in $(cat "$EVIDENCE/at15-app-pids3.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at15-sockets-before3.txt"
click 276 684
sleep 4
xwininfo -display "$DISPLAY_ID" -root -tree 2>/dev/null | grep -Ei "chrome|firefox" >"$EVIDENCE/at15-windows-after.txt" || true
for pid in $(cat "$EVIDENCE/at15-app-pids3.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at15-sockets-after3.txt"
shot "at15-n-after-external.png"
log "AT15 external: app_sockets_before=$(wc -l < "$EVIDENCE/at15-sockets-before3.txt") after=$(wc -l < "$EVIDENCE/at15-sockets-after3.txt") window_lines_before=$(wc -l < "$EVIDENCE/at15-windows-before.txt") after=$(wc -l < "$EVIDENCE/at15-windows-after.txt")"
click 387 721   # ftp
sleep 1.5
shot "at15-o-ftp.png"
click 371 758   # javascript:
sleep 1.5
shot "at15-p-javascript.png"
terminate_app

group_footer
