#!/usr/bin/env bash
# run-at-fix7.sh — AT28 protected rejection with a registered open document.
AT_GROUP=fix7
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT28 protected target (registered doc)"
ensure_helper
fix_conditions
reset_data

launch_app "$FIXTURES/rendering/math.md"
sleep 1.5
run_out "$EVIDENCE/second-f7-latin1.log" timeout 30 "$APP_BIN" "$FIXTURES/encoding/latin1.md"
sleep 1.5
click 1130 107
sleep 1
click 449 511
sleep 0.5
key space
sleep 1.5
click 384 637
sleep 0.5
key space
sleep 1.5
set_clip "$FIXTURES/rendering/probe-out.txt"
key ctrl+l
sleep 0.8
key ctrl+v
sleep 0.8
key Return
sleep 2
shot "at28-i-protected-blocked.png"
ls "$FIXTURES/rendering/" | grep -c probe-out || true
terminate_app

group_footer
