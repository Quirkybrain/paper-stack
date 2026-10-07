#!/usr/bin/env bash
# run-at-fix8.sh — AT09 sanitization walk with the prompt reliably blocked.
AT_GROUP=fix8
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT09 sanitization walk"
ensure_helper
fix_conditions
reset_data

launch_app "$FIXTURES/security/malicious.md"
sleep 3
dismiss_modal "at09-s-prompt"
wheel 640 400 5 4
sleep 1
shot "at09-t-scripts.png"
wheel 640 400 5 5
sleep 1
shot "at09-u-links.png"
wheel 640 400 5 5
sleep 1
shot "at09-v-macro.png"
wheel 640 400 5 8
sleep 1
shot "at09-w-mermaid.png"
wheel 640 400 5 12
sleep 1
shot "at09-x-bottom.png"
terminate_app
group_footer
