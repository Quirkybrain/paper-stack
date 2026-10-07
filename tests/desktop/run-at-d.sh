#!/usr/bin/env bash
# run-at-d.sh — AT17–AT22 acceptance runs (wp-34, T-63).
# AT17 search, AT18 source view, AT19 anchors, AT20 panels, AT21 update,
# AT22 async/version.
AT_GROUP=at17-22
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT17-AT22"
ensure_helper
fix_conditions
reset_data

# ---------------------------------------------------------------- AT17 -----
launch_app "$FIXTURES/search/search-samples.md"
sleep 2.5
dismiss_modal "at17-a-prompt"
key ctrl+f
sleep 1
paste_text "中文"
sleep 1
shot "at17-b-cn-query.png"
key ctrl+a
paste_text "SECRET"
sleep 1
shot "at17-c-secret-insensitive.png"
click 898 101   # 区分大小写 checkbox
sleep 1
shot "at17-d-case-sensitive.png"
key ctrl+a
paste_text "alpha x"
sleep 1
shot "at17-e-formula-source.png"
key ctrl+a
paste_text "quux-absent-token"
sleep 1
shot "at17-f-zero-results.png"
key Escape
sleep 0.5
run_out "$EVIDENCE/second-d-code.log" timeout 30 "$APP_BIN" "$FIXTURES/rendering/code.md"
sleep 2
key ctrl+Tab
sleep 0.5
key ctrl+f
sleep 1
paste_text "line 45"
sleep 1.5
shot "at17-g-folded-code-hit.png"
terminate_app

# ---------------------------------------------------------------- AT18 -----
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1.5
wheel 640 400 5 6
sleep 0.8
shot "at18-a-reading-position.png"
click 1245 26
sleep 0.7
key Return   # 查看源码 (first menu item)
sleep 2
shot "at18-b-source-view.png"
click 1245 26
sleep 0.7
key Return   # 返回阅读
sleep 1.5
shot "at18-c-back-to-reading.png"
terminate_app

# ---------------------------------------------------------------- AT19 -----
launch_app "$FIXTURES/reader-min/reader-min.md"
sleep 2.5
dismiss_modal "at19-a-prompt"
wheel 640 400 5 7
sleep 1
shot "at19-b-block-before-font.png"
key ctrl+comma
sleep 1
click 248 166   # 阅读 category
sleep 0.8
click 530 257   # 正文字号 input
sleep 0.5
key ctrl+a
paste_text "22"
sleep 0.3
key Return
sleep 1.5
key Escape
sleep 1
shot "at19-c-after-font-change.png"
terminate_app
launch_app
sleep 3
shot "at19-d-restart-restore-attempt.png"
terminate_app

# ---------------------------------------------------------------- AT20 -----
launch_app "$FIXTURES/rendering/mixed-cn-en.md"
sleep 1.5
run "$HELPER" resize 1600 900
sleep 1
key ctrl+b
sleep 1.5
shot "at20-a-wide-side-by-side.png"
key ctrl+b
sleep 1
run "$HELPER" resize 1024 640
sleep 1
key ctrl+b
sleep 1.5
shot "at20-b-narrow-overlay.png"
key ctrl+b
sleep 1
run "$HELPER" resize 1280 800
sleep 1
shot "at20-c-restored.png"
terminate_app

# ---------------------------------------------------------------- AT21 -----
A21="$INPUTS/at21"
mkdir -p "$A21"
cp "$FIXTURES/update/v1.md" "$A21/doc.md"
launch_app "$A21/doc.md"
sleep 1.5
shot "at21-a-v1.png"
printf '\n新增段落：v2 已写入。\n' >>"$A21/doc.md"
sleep 3
shot "at21-b-banner.png"
click 1130 150   # 现在更新 (adjust from screenshot)
sleep 2
shot "at21-c-updated.png"
printf '\n再次追加：v3。\n' >>"$A21/doc.md"
sleep 3
shot "at21-d-banner-again.png"
terminate_app

# ---------------------------------------------------------------- AT22 -----
A22="$INPUTS/at22"
mkdir -p "$A22"
cp "$FIXTURES/update/v1.md" "$A22/doc.md"
launch_app "$A22/doc.md"
sleep 1.5
python3 - "$A22/doc.md" <<'PY'
import sys, time
p = sys.argv[1]
base = open(p).read()
open(p, 'w').write(base + '\nRAPID-A 标记段落。\n')
time.sleep(0.15)
open(p, 'w').write(base + '\nRAPID-B 标记段落。\n')
print('rapid writes done')
PY
sleep 3
shot "at22-a-banner.png"
click 1130 150
sleep 1
shot "at22-b-after-update-t1.png"
sleep 3
shot "at22-c-after-update-t4.png"
terminate_app

group_footer
