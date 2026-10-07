#!/usr/bin/env bash
# run-at-fix1.sh — targeted re-runs for AT05 (MRU), AT07, AT08, AT09 (wp-34).
AT_GROUP=fix1
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT05/07/08/09 fix-ups"
ensure_helper
fix_conditions
reset_data

# ---- AT05 MRU decisive: 3 tabs; activate #3 then #1; close #1 -------------
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
sleep 1
click 475 87   # tab 3 tables
sleep 0.5
click 90 87    # tab 1 math
sleep 0.5
shot "at05-g-mru3-setup.png"
key ctrl+w
sleep 1
shot "at05-h-mru3-after-close.png"   # MRU: tables.md active; right-neighbor: code.md
terminate_app

# ---- AT07 clean removal evidence ------------------------------------------
A7="$INPUTS/at07fix"
mkdir -p "$A7"
cp "$FIXTURES/update/v1.md" "$A7/doc.md"
launch_app "$A7/doc.md"
sleep 1.5
shot "at07-e-before-removal.png"
rm "$A7/doc.md"
sleep 4
shot "at07-f-removed-state.png"
log "AT07 removed-file dir listing: $(ls -la "$A7" | tr '\n' ' ')"
# click where a relink affordance would be (banner area under toolbar)
click 640 140
sleep 1
shot "at07-g-after-content-click.png"
terminate_app

# ---- AT08 mode switch on a math/GFM document -------------------------------
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1.5
shot "at08-e-technical-render.png"
key ctrl+comma
sleep 1
click 278 258
sleep 0.8
click 455 392
sleep 1.5
key Escape
sleep 1
shot "at08-f-standard-render.png"
key ctrl+comma
sleep 1
click 278 258
sleep 0.8
click 455 344
sleep 1.5
key Escape
sleep 1
shot "at08-g-technical-restored.png"
terminate_app

# ---- AT09 sanitized document with prompt blocked first ----------------------
launch_app "$FIXTURES/security/malicious.md"
sleep 3.5
shot "at09-g-prompt-wait.png"
if modal_open "$EVIDENCE/at09-g-prompt-wait.png"; then
  click 279 548
  sleep 1
fi
shot "at09-h-after-block.png"
wheel 640 400 5 5
sleep 1
shot "at09-i-scripts-links.png"
wheel 640 400 5 6
sleep 1
shot "at09-j-macro-bomb.png"
wheel 640 400 5 8
sleep 1
shot "at09-k-mermaid-overflow.png"
wheel 640 400 5 12
sleep 1
shot "at09-l-bottom.png"
terminate_app

group_footer
