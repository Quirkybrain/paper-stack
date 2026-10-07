#!/usr/bin/env bash
# run-at-fix5.sh — modal-button keyboard activation (AT27/AT28) + AT15 internal
# fragment jump (wp-34).
AT_GROUP=fix5
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT27/28/15 final fix-ups"
ensure_helper
fix_conditions

# ---- AT27 clear via Space-activated modal button -----------------------------
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
sleep 0.5
key space
sleep 1.5
shot "at27-k-after-space.png"
if modal_open "$EVIDENCE/at27-k-after-space.png"; then
  key Tab
  sleep 0.3
  key space
  sleep 0.5
  shot "at27-l-category.png"
  key Tab; key Tab; key Tab; key Tab; key Tab
  sleep 0.3
  key space
  sleep 2
  shot "at27-m-result.png"
fi
terminate_app
log "== AT27 fix5 counts =="
python3 - "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3" <<'PY' | tee -a "$RUNS"
import sqlite3, sys
con=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
for t in ('documents','recents','session_tabs','positions'):
    try: print(t, con.execute(f'select count(*) from {t}').fetchone()[0])
    except Exception as e: print(t, 'ERR', e)
PY

# ---- AT28 export preview + protected target ----------------------------------
launch_app "$FIXTURES/encoding/latin1.md"
sleep 1.5
click 1130 107
sleep 1
click 449 511
sleep 0.5
key space
sleep 1.5
shot "at28-e-preview2.png"
if modal_open "$EVIDENCE/at28-e-preview2.png"; then
  # preview modal: click 选择保存位置 then activate by keyboard
  click 700 640
  sleep 0.5
  shot "at28-f-preview-buttons.png"
fi
terminate_app

# ---- AT15 internal fragment jump (mixed-cn-en) -------------------------------
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1.5
shot "at15-q-before-internal.png"
click 300 201   # 页内链接 -> #数学小节
sleep 1.5
shot "at15-r-after-internal.png"
terminate_app

group_footer
