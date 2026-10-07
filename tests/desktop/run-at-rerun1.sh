#!/usr/bin/env bash
# run-at-rerun1.sh — wp-34b re-runs: AT06 (session restore / recents /
# preference-off) and AT19 (position restore; exact/approx labels) on the
# fixed release binary. Evidence: artifacts/70-verification/evidence/at-rerun/.
AT_GROUP=rerun1
export AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun}"
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT06 + AT19 re-runs (wp-34b)"
ensure_helper
fix_conditions

# ================================================================ AT06 =====
# Fresh profile; open 2 docs; active = second (tables); quit; relaunch
# WITHOUT args -> session restored (tabs/order/active); recents recorded;
# preference-off disables restore. All record checks via DB snapshots.
reset_data
launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
sleep 1.5
shot "at06-r2-a-two-tabs-math-active.png"
key ctrl+Tab
sleep 1
shot "at06-r2-b-tables-active.png"
sleep 2.5
terminate_app
db_dump "AT06 after first clean exit"
log "AT06 expect: session_tabs=2 (math order0, tables order1, tables active); recents=2 (math, tables)"

# Relaunch without arguments: the stored session must come back.
launch_app
sleep 3.5
shot "at06-r2-c-restored-session.png"
terminate_app
db_dump "AT06 after restore exit"

# Preference-off: toggle 启动时恢复上次阅读 off through the settings UI, then
# relaunch -> welcome page (no restore), recents list still populated.
launch_app
sleep 2
key ctrl+comma
sleep 1
shot "at06-r2-d-settings-reading.png"
# scrolled check: the switch sits below the theme fieldset inside the content
wheel 600 500 5 4
sleep 1
shot "at06-r2-e-settings-scrolled.png"
# switch row (label text) — coordinates from at06-r2-e screenshot:
# checkbox x≈434, label 启动时恢复上次阅读 y≈634
click 540 634
sleep 1.2
shot "at06-r2-f-pref-toggled-off.png"
key Escape
sleep 0.8
terminate_app
db_dump "AT06 settings after preference toggle (expect startup.restoreSession=false)"

launch_app
sleep 3.5
shot "at06-r2-g-pref-off-welcome-recents.png"
terminate_app
db_dump "AT06 after preference-off relaunch (session_tabs unchanged, no restore)"

# ================================================================ AT19 =====
# Position restore across relaunch (font-size change first), then the
# cross-version exact and approximate labels on a writable copy.
reset_data
A19="$INPUTS/at19"
mkdir -p "$A19"
cp "$FIXTURES/reader-min/reader-min.md" "$A19/doc.md"

launch_app "$A19/doc.md"
sleep 2
dismiss_modal "at19-r2-a-prompt" 3
wheel 640 400 5 4
sleep 3
shot "at19-r2-b-block-before-font.png"
# font size 17 -> 22 (Reading section, first field; text area centre)
key ctrl+comma
sleep 1
click 475 259
sleep 0.5
key ctrl+a
paste_text "22"
sleep 0.3
key Return
sleep 1.5
shot "at19-r2-c-font22.png"
key Escape
sleep 1.2
shot "at19-r2-d-block-after-font.png"
sleep 2.5
terminate_app
db_dump "AT19 after font change exit (expect positions row + settings row)"

# Same-version relaunch: position restored, exact same-version is silent.
launch_app
sleep 3.5
dismiss_modal "at19-r2-e-prompt" 3
shot "at19-r2-e-same-version-restored.png"
terminate_app
db_dump "AT19 same-version restored exit"

# Cross-version append kept: unique fingerprint -> exact label.
printf '\n## 附加小节\n\n新增内容（版本 2）。\n' >>"$A19/doc.md"
launch_app
sleep 3.5
dismiss_modal "at19-r2-f-prompt" 3
shot "at19-r2-f-cross-version-exact.png"
terminate_app
db_dump "AT19 cross-version exact exit"

# Change the anchor block itself ("块公式：" paragraph at the recorded range)
# so the fingerprint no longer matches; the unique 数学公式 heading remains
# -> approximate label.
python3 - "$A19/doc.md" <<'PY'
import sys
p = sys.argv[1]
text = open(p, encoding='utf-8').read()
assert '块公式：' in text
text = text.replace('块公式：', '块公式（版本 3 改写）：')
open(p, 'w', encoding='utf-8').write(text)
print('v3 anchor rewrite done')
PY
launch_app
sleep 3.5
dismiss_modal "at19-r2-g-prompt" 3
shot "at19-r2-g-cross-version-approx.png"
terminate_app
db_dump "AT19 cross-version approx exit"

group_footer
