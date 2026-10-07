#!/usr/bin/env bash
# run-at-rerun3b.sh — supplemental wp-34b probe: preserve the server-side log
# for the AT28 error-state protected-export route (D-34b-3). Reproduces the
# Case A flow including the overwrite confirmation and snapshots the app log
# so the two PS_IO_EXPORT_BLOCKED command failures and the zero writes are
# verifiable inside the committed evidence directory.
AT_GROUP=rerun3b
export AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun}"
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT28 error-state export supplemental probe (wp-34b)"
ensure_helper
fix_conditions
reset_data

launch_app "$FIXTURES/encoding/latin1.md"
sleep 2
click 1130 107
sleep 1.5
click 449 511
sleep 0.5
key space
sleep 1.5
click 384 637
sleep 1.5
set_clip "$FIXTURES/encoding/probe-out.txt"
key ctrl+l
sleep 0.8
key ctrl+v
sleep 0.8
key Return
sleep 2.5
shot "at28-r2-caseA-probe-prompt.png"
wheel 640 500 5 3
sleep 1
click 350 623    # 确定 (overwrite confirm)
sleep 2.5
shot "at28-r2-caseA-probe-after-confirm.png"
terminate_app
cp "$AT_DATA/com.quirkybrain.paperstack/logs/paperstack.log" \
  "$EVIDENCE/at28-r2-caseA-server-log.txt"
log "AT28 probe server log copied; command_failed lines: $(grep -c command_failed "$EVIDENCE/at28-r2-caseA-server-log.txt" 2>/dev/null || echo 0)"
log "AT28 probe files: $(find "$FIXTURES/encoding" -maxdepth 1 -name 'probe-out*' | wc -l)"

group_footer
