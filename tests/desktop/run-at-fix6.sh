#!/usr/bin/env bash
# run-at-fix6.sh — AT02 empty dir + AT28 protected export target (wp-34).
AT_GROUP=fix6
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT02/AT28 final probes"
ensure_helper
fix_conditions

# ---- AT02: empty subdirectory state ----------------------------------------
launch_app
open_picker_dir
confirm_picker_path "$INPUTS/at02/dir2"
key ctrl+b
sleep 1
click 100 224   # sub-empty (second row)
sleep 1
shot "at02-j-sub-empty.png"
terminate_app

# ---- AT28: export to a protected source target ------------------------------
launch_app "$FIXTURES/encoding/latin1.md"
sleep 1.5
click 1130 107
sleep 1
click 449 511
sleep 0.5
key space
sleep 1.5
click 384 637   # 选择保存位置
sleep 0.5
key space
sleep 1.5
shot "at28-g-save-dialog.png"
set_clip "$FIXTURES/encoding/probe-out.txt"
key ctrl+l
sleep 0.8
key ctrl+v
sleep 0.8
key Return
sleep 2
shot "at28-h-protected-rejection.png"
ls -la "$FIXTURES/encoding/" | tee -a "$RUNS"
terminate_app

group_footer
