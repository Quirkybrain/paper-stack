#!/usr/bin/env bash
# run-at-fix2.sh — AT05 MRU redo, AT11 code-copy discovery, AT09 redo (wp-34).
AT_GROUP=fix2
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT05/11/09 fix-ups"
ensure_helper
fix_conditions

# ---- AT05 MRU (tab widths ~145px each) ------------------------------------
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/code.md" "$FIXTURES/rendering/tables.md"
sleep 1
shot "at05-i-tab-widths.png"
click 362 87   # tables (third tab)
sleep 0.6
click 72 87    # math (first tab)
sleep 0.6
key ctrl+w
sleep 1
shot "at05-j-mru-after-close.png"   # MRU: tables.md; right-neighbour fallback: code.md
terminate_app

# ---- AT11 code copy: hover/actions, button click, clipboard ----------------
launch_app "$FIXTURES/rendering/code.md"
sleep 1.5
# place the pointer over the first code block to reveal its action bar
run "$HELPER" click 640 350
sleep 0.8
shot "at11-a-action-bar.png"
click 866 397   # 复制 button (first block action row)
sleep 0.8
get_clip >"$EVIDENCE/at11-clipboard-first.txt" 2>/dev/null || true
log "AT11 first-block clipboard bytes: $(wc -c < "$EVIDENCE/at11-clipboard-first.txt")"
od -c "$EVIDENCE/at11-clipboard-first.txt" | head -3 >>"$RUNS"
# fold: scroll to the 45-line block and copy it folded
wheel 640 400 5 24
sleep 1
shot "at11-b-folded-block.png"
terminate_app

# ---- AT09 sanitized doc with prompt handled ---------------------------------
launch_app "$FIXTURES/security/malicious.md"
sleep 6
shot "at09-m-prompt-check.png"
if modal_open "$EVIDENCE/at09-m-prompt-check.png"; then
  click 279 548
  sleep 1.5
  shot "at09-n-after-block.png"
fi
wheel 640 400 5 5
sleep 1
shot "at09-o-scripts-links.png"
wheel 640 400 5 7
sleep 1
shot "at09-p-macro-bomb.png"
wheel 640 400 5 9
sleep 1
shot "at09-q-mermaid-overflow.png"
wheel 640 400 5 12
sleep 1
shot "at09-r-bottom.png"
terminate_app

group_footer
