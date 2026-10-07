#!/usr/bin/env bash
# run-at-b.sh — AT05–AT10 acceptance runs (wp-34, T-63).
# AT05 tabs, AT06 recents/restore, AT07 removal/relink, AT08 scope,
# AT09 sanitization, AT10 formulas.
AT_GROUP=at05-10
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT05-AT10"
ensure_helper
fix_conditions

DB_PY="$(mktemp /tmp/opencode/atdb-XXXXXX.py)"
cat >"$DB_PY" <<'PY'
import sqlite3, sys
db=sys.argv[1]
con=sqlite3.connect(f'file:{db}?mode=ro', uri=True)
cur=con.cursor()
for t in ('documents','recents','session_tabs','session_meta','positions'):
    try:
        rows=cur.execute(f'select * from {t}').fetchall()
        print(f'-- {t}: {len(rows)}')
        for r in rows[:8]: print('  ', r)
    except Exception as e:
        print(f'-- {t}: ERR {e}')
PY
inspect_db() { python3 "$DB_PY" "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3" 2>&1 | tee -a "$RUNS"; }

# ---------------------------------------------------------------- AT05 -----
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
sleep 1
shot "at05-a-three-tabs.png"
key ctrl+Tab
sleep 0.8
shot "at05-b-ctrl-tab-next.png"
key ctrl+Tab
sleep 0.8
shot "at05-c-ctrl-tab-third.png"
key ctrl+w
sleep 1
shot "at05-d-close-third.png"
# MRU close: activate tab1, then tab2, then tab1; closing tab1 activates tab2
click 90 87
sleep 0.5
click 280 87
sleep 0.5
click 90 87
sleep 0.5
shot "at05-e-mru-setup.png"
key ctrl+w
sleep 1
shot "at05-f-mru-after-close.png"
terminate_app

# ---------------------------------------------------------------- AT06 -----
reset_data
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
sleep 1
shot "at06-a-two-docs.png"
terminate_app
log "== AT06 stored records after clean exit =="
inspect_db
launch_app
sleep 1
shot "at06-b-restored-after-relaunch.png"
terminate_app

# ---------------------------------------------------------------- AT07 -----
A7="$INPUTS/at07"
mkdir -p "$A7"
cp "$FIXTURES/update/v1.md" "$A7/doc.md"
launch_app "$A7/doc.md"
sleep 1
shot "at07-a-loaded.png"
rm "$A7/doc.md"
sleep 3.5
shot "at07-b-file-removed.png"
ls -la "$A7" | tee -a "$RUNS"
# relink through the system picker: recreate the same bytes elsewhere
cp "$FIXTURES/update/v1.md" "$A7/relocated.md"
click 583 388   # 重新定位 button in the unavailable banner (adjust by screenshot)
sleep 1
shot "at07-c-relink-picker.png"
confirm_picker_path "$A7/relocated.md"
sleep 2
shot "at07-d-after-relink.png"
terminate_app

# ---------------------------------------------------------------- AT08 -----
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1
run_out "$EVIDENCE/second-b-code.log" timeout 30 "$APP_BIN" "$FIXTURES/rendering/code.md"
sleep 1.5
shot "at08-a-technical-mode.png"
key ctrl+comma
sleep 1
click 278 258
sleep 1
shot "at08-b-syntax-settings.png"
click 455 392
sleep 1.5
shot "at08-c-standard-selected.png"
key Escape
sleep 1
shot "at08-d-standard-mode-doc.png"
# restore technical mode for later groups
key ctrl+comma
sleep 1
click 278 258
sleep 1
click 455 344
sleep 1
key Escape
sleep 0.5
terminate_app

# ---------------------------------------------------------------- AT09 -----
launch_app "$FIXTURES/security/malicious.md"
sleep 2
maybe_block_local_prompt "at09-a-local-prompt"
wheel 640 400 5 3
sleep 1
shot "at09-b-top.png"
wheel 640 400 5 6
sleep 1
shot "at09-c-mid.png"
wheel 640 400 5 6
sleep 1
shot "at09-d-macro.png"
wheel 640 400 5 8
sleep 1
shot "at09-e-mermaid-overflow.png"
wheel 640 400 5 10
sleep 1
shot "at09-f-bottom.png"
run "$HELPER" list
terminate_app

# ---------------------------------------------------------------- AT10 -----
launch_app "$FIXTURES/rendering/math.md"
sleep 1
shot "at10-a-formulas.png"
wheel 640 400 5 8
sleep 1
shot "at10-b-wide-formula.png"
key ctrl+comma
sleep 1
click 278 258
sleep 1
click 455 516
sleep 1.5
shot "at10-c-inline-dollar-off.png"
key Escape
sleep 1
shot "at10-d-doc-inline-dollar-off.png"
# restore
key ctrl+comma
sleep 1
click 278 258
sleep 1
click 455 516
sleep 1
key Escape
sleep 0.5
terminate_app

group_footer
