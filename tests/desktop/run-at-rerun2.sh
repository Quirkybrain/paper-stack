#!/usr/bin/env bash
# run-at-rerun2.sh — wp-34b re-runs: AT07 (unavailable banner / relink /
# retry / close) and AT14/AT15 (outline jump, in-page fragment navigation,
# missing-fragment notice, cross-file navigation) on the fixed release binary.
# Fresh isolated data: each scenario starts from a single-document session
# (no tab bar; banner and link coordinates from the wp-34 evidence runs).
AT_GROUP=rerun2
export AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun}"
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT07 + AT14/AT15 re-runs (wp-34b)"
ensure_helper
fix_conditions

# ================================================================ AT07 =====
# Single-document sessions. Banner buttons (no tab bar): 重新定位 x≈978,
# 重试 x≈1082, 关闭标签 x≈1196, row y≈113.
A7="$INPUTS/at07"
mkdir -p "$A7"

# Session 1: removal banner + retry (still missing, then recover).
reset_data
cp "$FIXTURES/update/v1.md" "$A7/doc.md"
launch_app "$A7/doc.md"
sleep 1.5
shot "at07-r2-a-loaded.png"
rm "$A7/doc.md"
sleep 4
shot "at07-r2-b-unavailable-banner.png"
log "AT07 removed-file dir listing: $(ls -la "$A7" | tr '\n' ' ')"
# retry while the file is still missing: banner and content must stay
click 1082 113
sleep 2.5
shot "at07-r2-c-retry-still-missing.png"
# recreate the same bytes and retry: the unavailable state must clear
cp "$FIXTURES/update/v1.md" "$A7/doc.md"
sleep 0.3
click 1082 113
sleep 3
shot "at07-r2-d-retry-recovered.png"
terminate_app

# Session 2: 重新定位 relinks the same bytes -> identity restored.
cp "$FIXTURES/update/v1.md" "$A7/doc.md"
cp "$FIXTURES/update/v1.md" "$A7/relocated.md"
launch_app "$A7/doc.md"
sleep 1.5
rm "$A7/doc.md"
sleep 4
shot "at07-r2-e-banner-before-relink.png"
click 978 113
sleep 1.2
root_shot "at07-r2-f-relink-picker.png"
confirm_picker_path "$A7/relocated.md"
sleep 3
shot "at07-r2-g-relinked.png"
terminate_app

# Session 3: 关闭标签 closes the unavailable tab (back to welcome).
cp "$FIXTURES/update/v1.md" "$A7/doc.md"
launch_app "$A7/doc.md"
sleep 1.5
rm "$A7/doc.md"
sleep 4
shot "at07-r2-h-banner-before-close.png"
click 1196 113
sleep 1.5
shot "at07-r2-i-tab-closed.png"
terminate_app

# ============================================================ AT14/15 =====
reset_data
launch_app "$FIXTURES/rendering/links.md"
sleep 1.5
shot "at14-r2-a-top.png"
key ctrl+b
sleep 1
shot "at14-r2-b-outline.png"
wheel 640 400 5 10
sleep 1
shot "at14-r2-c-scrolled.png"
click 139 229   # outline: Duplicate 标题 (1)
sleep 1.5
key ctrl+b
sleep 1
shot "at14-r2-d-after-outline-1.png"
key ctrl+b
sleep 1
click 139 278   # outline: Duplicate 标题 (2)
sleep 1.5
key ctrl+b
sleep 1
shot "at14-r2-e-after-outline-2.png"
# cross-file relative link (same tab)
wheel 640 400 4 20
sleep 1.5
shot "at15-r2-a-top.png"
click 300 611   # Relative document
sleep 3
shot "at15-r2-b-cross-file-nav.png"
key alt+Left
sleep 2.5
shot "at15-r2-c-back-to-links.png"
click 1207 108  # close the 已恢复阅读位置 history banner
sleep 1
shot "at15-r2-d-back-banner-closed.png"
# back-to-top re-verification: back navigation restores the previous scroll
# offset, so re-scroll before the link-row clicks (row y≈408..429).
wheel 640 400 4 20
sleep 1.5
shot "at15-r2-d2-top-reverified.png"
# body-link fragment: first duplicate (link x195..455, y408..429)
click 300 418
sleep 1.5
shot "at15-r2-e-fragment-jump.png"
wheel 640 400 4 20
sleep 1.5
# missing fragment: notice must appear, position must not move
click 630 418
sleep 1.5
shot "at15-r2-f-missing-fragment-notice.png"
click 1207 108  # close the notice
sleep 1
wheel 640 400 4 20
sleep 1.5
# page-internal fragment link (#more-links)
click 300 573
sleep 1.5
shot "at15-r2-g-page-internal-jump.png"
terminate_app

group_footer
