#!/usr/bin/env bash
# run-at-e.sh — AT23–AT30 acceptance runs (wp-34, T-63).
# AT23 typography, AT24 keyboard/a11y, AT25 local auth, AT26 remote,
# AT27 privacy clear, AT28 diagnostics, AT29 large docs, AT30 about/legal.
AT_GROUP=at23-30
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT23-AT30"
ensure_helper
fix_conditions
reset_data

# ---------------------------------------------------------------- AT23 -----
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1.5
shot "at23-a-default-type.png"
key ctrl+comma
sleep 1
click 248 166
sleep 0.8
click 530 257
sleep 0.5
key ctrl+a
paste_text "22"
sleep 0.3
key Return
sleep 0.5
click 530 390   # 行距 input
sleep 0.5
key ctrl+a
paste_text "2.0"
sleep 0.3
key Return
sleep 1.5
shot "at23-b-changed.png"
# invalid value attempt: 99
click 530 257
sleep 0.5
key ctrl+a
paste_text "99"
sleep 0.3
key Return
sleep 1
shot "at23-c-invalid-value.png"
key Escape
sleep 1
shot "at23-d-applied.png"
terminate_app
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 2
key ctrl+comma
sleep 1
shot "at23-e-settings-persisted.png"
key Escape
sleep 0.5
terminate_app

# ---------------------------------------------------------------- AT24 -----
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1.5
shot "at24-a-initial-skip-hidden.png"
key Tab
sleep 0.8
shot "at24-b-focus-skip-link.png"
key Return
sleep 0.8
shot "at24-c-after-skip-jump.png"
# W-2 re-test: pointer click first, then Tab focus ring
click 640 400
sleep 0.5
key Tab
sleep 0.8
shot "at24-d-focus-after-pointer.png"
key ctrl+f
sleep 0.8
paste_text "中文"
sleep 1
shot "at24-e-keyboard-find.png"
key Escape
sleep 0.5
terminate_app

# 200% text scaling attempt
gsettings set org.gnome.desktop.interface text-scaling-factor 2.0
log "text-scaling-factor set to 2.0"
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 2.5
shot "at24-f-scale200.png"
key ctrl+b
sleep 1
shot "at24-g-scale200-panel.png"
key ctrl+f
sleep 0.8
paste_text "中文"
sleep 1.5
shot "at24-h-scale200-search.png"
terminate_app
gsettings set org.gnome.desktop.interface text-scaling-factor 1.25
log "text-scaling-factor restored to 1.25"

# ---------------------------------------------------------------- AT25 -----
launch_app "$FIXTURES/reader-min/reader-min.md"
sleep 3
shot "at25-a-aggregate-prompt.png"
key Escape
sleep 1
key Escape
sleep 1
shot "at25-b-denied-placeholder.png"
terminate_app

# ---------------------------------------------------------------- AT26 -----
launch_app "$FIXTURES/rendering/images.md"
sleep 3
dismiss_modal "at26-a-local-prompt"
sleep 1
shot "at26-b-remote-prompt.png"
# zero-request evidence: app tree sockets with the document blocked
ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$EVIDENCE/at26-app-pids.txt"
for pid in $(cat "$EVIDENCE/at26-app-pids.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at26-sockets-blocked.txt"
log "AT26 blocked-state sockets: $(wc -l < "$EVIDENCE/at26-sockets-blocked.txt") lines"
terminate_app

# allowed remote fetch against a reachable public host
timeout 10 curl -sI https://httpbin.org/image/png -o /dev/null -w "curl httpbin: %{http_code}\n" >>"$RUNS" 2>&1 || true
A26="$INPUTS/at26"
mkdir -p "$A26"
printf '# Remote image\n\n![remote png](https://httpbin.org/image/png)\n' >"$A26/remote.md"
launch_app "$A26/remote.md"
sleep 3
shot "at26-c-remote-prompt.png"
click 427 623   # 本次文档允许加载 (adjust from screenshot)
sleep 3
shot "at26-d-after-allow.png"
ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$EVIDENCE/at26-app-pids2.txt"
for pid in $(cat "$EVIDENCE/at26-app-pids2.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at26-sockets-after.txt"
terminate_app

# ---------------------------------------------------------------- AT27 -----
# seed records: open two docs in a clean data dir, then clear via UI
reset_data
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
sleep 1
terminate_app
log "== AT27 records before clear =="
python3 - "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3" <<'PY' | tee -a "$RUNS"
import sqlite3, sys
con=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
for t in ('documents','recents','session_tabs','positions'):
    try: print(t, con.execute(f'select count(*) from {t}').fetchone()[0])
    except Exception as e: print(t, 'ERR', e)
PY
find "$FIXTURES" -type f -exec sha256sum {} + | sort >"$EVIDENCE/at27-fixtures-before.sha256"
launch_app
sleep 1.5
key ctrl+comma
sleep 1
click 278 303   # 隐私
sleep 1
shot "at27-a-privacy.png"
click 530 700   # 清除已有记录 (adjust)
sleep 1.5
shot "at27-b-clear-dialog.png"
key Return
sleep 1.5
shot "at27-c-clear-done.png"
key Escape
sleep 0.5
terminate_app
log "== AT27 records after clear =="
python3 - "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3" <<'PY' | tee -a "$RUNS"
import sqlite3, sys
con=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
for t in ('documents','recents','session_tabs','positions'):
    try: print(t, con.execute(f'select count(*) from {t}').fetchone()[0])
    except Exception as e: print(t, 'ERR', e)
PY
find "$FIXTURES" -type f -exec sha256sum {} + | sort >"$EVIDENCE/at27-fixtures-after.sha256"
diff "$EVIDENCE/at27-fixtures-before.sha256" "$EVIDENCE/at27-fixtures-after.sha256" >"$EVIDENCE/at27-source-diff.txt" 2>&1 && log "AT27 source fixtures IDENTICAL" || log "AT27 source fixtures CHANGED"

# ---------------------------------------------------------------- AT28 -----
launch_app "$FIXTURES/encoding/latin1.md"
sleep 1.5
shot "at28-a-error.png"
click 1130 107   # 诊断
sleep 1.5
shot "at28-b-diagnostics-panel.png"
click 640 700   # 复制诊断摘要 (adjust)
sleep 1
get_clip >"$EVIDENCE/at28-clip-summary.txt" 2>/dev/null || true
log "AT28 summary clipboard bytes=$(wc -c < "$EVIDENCE/at28-clip-summary.txt" 2>/dev/null || echo 0)"
terminate_app

# ---------------------------------------------------------------- AT29 -----
mkdir -p "$INPUTS/at29"
head -c 11534336 artifacts/70-verification/evidence/generated/corpus-52MiB.md >"$INPUTS/at29/doc-11MiB.md" 2>/dev/null || true
ls -la "$INPUTS/at29" >>"$RUNS"
launch_app "$INPUTS/at29/doc-11MiB.md"
shot "at29-a-11mib-dialog.png"
sleep 1
shot "at29-b-11mib-dialog-again.png"
key Return   # safe default = 简化阅读
sleep 3
shot "at29-c-simplified.png"
key ctrl+f
sleep 1
paste_text "needle"
sleep 2
shot "at29-d-simplified-search.png"
terminate_app
# 52 MiB hard limit / source window
T0=$(date +%s%3N)
launch_app "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md"
T1=$(date +%s%3N)
log "AT29 52MiB launch-to-window ms=$((T1 - T0))"
sleep 4
shot "at29-e-52mib-source.png"
T2=$(date +%s%3N)
log "AT29 52MiB launch-to-screenshot ms=$((T2 - T0))"
ps -eo rss,args | grep -F "$APP_BIN" | grep -v grep | awk '{print "rss_kb="$1}' >>"$RUNS" || true
terminate_app

# ---------------------------------------------------------------- AT30 -----
launch_app
sleep 1
click 1245 26
sleep 0.7
key Down
key Down
key Down
key Return
sleep 1.5
shot "at30-a-about.png"
click 499 579
sleep 1
shot "at30-b-license-viewer.png"
key Escape
sleep 0.5
terminate_app

group_footer
