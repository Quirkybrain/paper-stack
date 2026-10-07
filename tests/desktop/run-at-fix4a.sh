#!/usr/bin/env bash
# run-at-fix4a.sh — residual AT11/17/21/22/27/28/29 evidence (wp-34).
AT_GROUP=fix4a
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT11/17/21/22/27/28/29 fix-ups"
ensure_helper
fix_conditions

# ---- AT11: folded 45-line block copy ---------------------------------------
launch_app "$FIXTURES/rendering/code.md"
sleep 1.5
wheel 640 400 5 30
sleep 1
shot "at11-h-fold-view.png"
wheel 640 400 4 6
sleep 1
run "$HELPER" click 640 350
sleep 0.8
shot "at11-i-block-top.png"
click 715 155
sleep 0.8
get_clip >"$EVIDENCE/at11-clipboard-fold2.txt" 2>/dev/null || true
log "AT11 folded-block clipboard: bytes=$(wc -c < "$EVIDENCE/at11-clipboard-fold2.txt") lines=$(wc -l < "$EVIDENCE/at11-clipboard-fold2.txt")"
terminate_app

# ---- AT17: formula-source hit, zero result, folded-code hit -----------------
launch_app "$FIXTURES/search/search-samples.md"
sleep 2.5
dismiss_modal "at17-h-prompt"
key ctrl+f
sleep 1
click 500 101
sleep 0.3
key ctrl+a
paste_text "alpha x"
sleep 1.5
shot "at17-i-formula-hit.png"
click 500 101
sleep 0.3
key ctrl+a
paste_text "quux-absent-token"
sleep 1.5
shot "at17-j-zero.png"
key Escape
sleep 0.5
run_out "$EVIDENCE/second-f4-code.log" timeout 30 "$APP_BIN" "$FIXTURES/rendering/code.md"
sleep 2
click 640 400
sleep 0.3
key ctrl+Tab
sleep 1
shot "at17-k-code-active.png"
key ctrl+f
sleep 1
click 500 101
sleep 0.3
paste_text "line 45"
sleep 1.5
shot "at17-l-folded-hit.png"
terminate_app

# ---- AT21: keep-mode update + later ----------------------------------------
A21="$INPUTS/at21b"
mkdir -p "$A21"
cp "$FIXTURES/update/v1.md" "$A21/doc.md"
launch_app "$A21/doc.md"
sleep 1.5
printf '\n新增段落：v2 已写入。\n' >>"$A21/doc.md"
sleep 3
shot "at21-e-banner.png"
click 1089 113
sleep 2
shot "at21-f-updated.png"
printf '\n再次追加：v3。\n' >>"$A21/doc.md"
sleep 3
shot "at21-g-banner2.png"
click 1213 113
sleep 1
shot "at21-h-later-collapsed.png"
terminate_app

# ---- AT22: rapid consecutive writes -----------------------------------------
A22="$INPUTS/at22b"
mkdir -p "$A22"
cp "$FIXTURES/update/v1.md" "$A22/doc.md"
launch_app "$A22/doc.md"
sleep 1.5
python3 - "$A22/doc.md" <<'PY'
import sys, time
p = sys.argv[1]
base = open(p).read()
open(p, 'w').write(base + '\nRAPID-A 标记段落。\n')
time.sleep(0.15)
open(p, 'w').write(base + '\nRAPID-B 标记段落。\n')
print('rapid writes done')
PY
sleep 3
shot "at22-d-banner.png"
click 1089 113
sleep 1
shot "at22-e-t1.png"
sleep 3
shot "at22-f-t4.png"
terminate_app

# ---- AT27: clear records through the UI -------------------------------------
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
click 508 622   # 清除已有记录
sleep 1.5
shot "at27-d-clear-dialog.png"
key Tab
sleep 0.3
key space
sleep 0.5
shot "at27-e-category-selected.png"
key Tab
key Tab
key Tab
key Tab
key Tab
sleep 0.3
shot "at27-f-focus-confirm.png"
key Return
sleep 2
shot "at27-g-clear-result.png"
key Escape
sleep 0.5
terminate_app
log "== AT27 after UI clear =="
python3 - "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3" <<'PY' | tee -a "$RUNS"
import sqlite3, sys
con=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
for t in ('documents','recents','session_tabs','positions'):
    try: print(t, con.execute(f'select count(*) from {t}').fetchone()[0])
    except Exception as e: print(t, 'ERR', e)
PY

# ---- AT28: diagnostics copy + export flow -----------------------------------
launch_app "$FIXTURES/encoding/latin1.md"
sleep 1.5
click 1130 107
sleep 1
click 301 511   # 复制诊断摘要
sleep 1
get_clip >"$EVIDENCE/at28-clip-summary2.txt" 2>/dev/null || true
log "AT28 summary clipboard: $(cat "$EVIDENCE/at28-clip-summary2.txt" | head -c 120)"
click 449 511   # 导出诊断 -> preview
sleep 1.5
shot "at28-c-preview.png"
terminate_app

# ---- AT29: 52MiB source window settle + memory -------------------------------
T0=$(date +%s%3N)
launch_app "$ROOT/artifacts/70-verification/evidence/generated/corpus-52MiB.md"
T1=$(date +%s%3N)
sleep 14
shot "at29-f-52mib-settled.png"
T2=$(date +%s%3N)
log "AT29 52MiB launch-to-window=$((T1 - T0))ms launch-to-settled-shot=$((T2 - T0))ms"
ps -eo rss,pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print "rss_kb="$1" pid="$2}' >>"$RUNS" || true
terminate_app

group_footer
