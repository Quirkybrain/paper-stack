#!/usr/bin/env bash
# run-at-rerun4.sh — wp-34b regression spot-check on previously PASSing
# scenarios: AT05 (tabs / MRU close) and AT17 (search incl. zero result).
AT_GROUP=rerun4
export AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun}"
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT05 + AT17 regression spot-check (wp-34b)"
ensure_helper
fix_conditions
reset_data

# ================================================================ AT05 =====
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
sleep 1.5
shot "at05-r2-a-three-tabs.png"
key ctrl+Tab
sleep 1
shot "at05-r2-b-ctrl-tab-next.png"
key ctrl+Tab
sleep 1
shot "at05-r2-c-ctrl-tab-third.png"
key ctrl+w
sleep 1.2
shot "at05-r2-d-close-third.png"
click 90 87
sleep 0.5
click 280 87
sleep 0.5
click 90 87
sleep 0.5
shot "at05-r2-e-mru-setup.png"
key ctrl+w
sleep 1.2
shot "at05-r2-f-mru-after-close.png"
terminate_app

# ================================================================ AT17 =====
reset_data
launch_app "$FIXTURES/search/search-samples.md"
sleep 2.5
dismiss_modal "at17-r2-a-prompt" 3
key ctrl+f
sleep 1
click 500 101
sleep 0.3
paste_text "中文"
sleep 1.5
shot "at17-r2-b-zh-hit.png"
click 500 101
sleep 0.3
key ctrl+a
paste_text "SECRET"
sleep 1.5
shot "at17-r2-c-secret-hits.png"
click 500 101
sleep 0.3
key ctrl+a
paste_text "quux-absent-token"
sleep 1.5
shot "at17-r2-d-zero.png"
key Escape
sleep 0.5
terminate_app

group_footer
