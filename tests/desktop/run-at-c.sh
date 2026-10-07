#!/usr/bin/env bash
# run-at-c.sh — AT11–AT16 acceptance runs (wp-34, T-63).
# AT11 code copy, AT12 mermaid, AT13 images/tables, AT14 outline,
# AT15 links, AT16 history.
AT_GROUP=at11-16
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT11-AT16"
ensure_helper
fix_conditions
reset_data

# ---------------------------------------------------------------- AT11 -----
launch_app "$FIXTURES/rendering/code.md"
sleep 1.5
run "$HELPER" click 640 350
sleep 0.8
shot "at11-c-first-block-hover.png"
click 866 278
sleep 0.8
get_clip >"$EVIDENCE/at11-clipboard-c.txt" 2>/dev/null || true
log "AT11 first C block clipboard: bytes=$(wc -c < "$EVIDENCE/at11-clipboard-c.txt")"
od -c "$EVIDENCE/at11-clipboard-c.txt" >>"$RUNS"
# 45-line fold block at the bottom: hover then copy while folded
wheel 640 400 5 26
sleep 1
run "$HELPER" click 640 500
sleep 0.8
shot "at11-d-fold-block-hover.png"
terminate_app

# ---------------------------------------------------------------- AT12 -----
launch_app "$FIXTURES/rendering/mermaid.md"
sleep 2.5
shot "at12-a-flowchart.png"
wheel 640 400 5 5
sleep 1
shot "at12-b-sequence.png"
wheel 640 400 5 5
sleep 1
shot "at12-c-class.png"
wheel 640 400 5 5
sleep 1
shot "at12-d-error-pie.png"
terminate_app

# ---------------------------------------------------------------- AT13 -----
launch_app "$FIXTURES/rendering/images.md"
sleep 3
dismiss_modal "at13-a-images-prompt"
wheel 640 400 5 2
sleep 1
shot "at13-b-images-placeholders.png"
terminate_app

# local image inside an opened directory scope: single-file open + 本次允许
I13="$INPUTS/at13"
mkdir -p "$I13"
python3 - "$I13/pic.png" <<'PY'
import struct, zlib, sys
w = h = 16
raw = b''.join(b'\x00' + b'\xd0\x30\x30' * w for _ in range(h))
def chunk(t, d):
    c = struct.pack('>I', len(d)) + t + d
    return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
png = (b'\x89PNG\r\n\x1a\n'
       + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
       + chunk(b'IDAT', zlib.compress(raw))
       + chunk(b'IEND', b''))
open(sys.argv[1], 'wb').write(png)
print('png bytes', len(png))
PY
printf '# Local image\n\n![local red block](pic.png)\n' >"$I13/doc.md"
launch_app "$I13/doc.md"
sleep 3
shot "at13-c-local-image-prompt.png"
allow_modal "at13-d-allow"
sleep 2
shot "at13-e-local-image-after-allow.png"
terminate_app

# wide table horizontal scroll attempt
launch_app "$FIXTURES/rendering/tables.md"
sleep 1.5
wheel 640 500 5 4
sleep 0.8
shot "at13-f-wide-table.png"
run "$HELPER" click 640 600 6 6
sleep 1
shot "at13-g-table-hscroll.png"
terminate_app

# ---------------------------------------------------------------- AT14 -----
launch_app "$FIXTURES/rendering/links.md"
sleep 1.5
key ctrl+b
sleep 1
shot "at14-a-outline.png"
click 110 268   # second 'Duplicate 标题' entry (positions from screenshot)
sleep 1.5
shot "at14-b-jump-second-duplicate.png"
terminate_app

# ---------------------------------------------------------------- AT15/16 --
launch_app "$FIXTURES/rendering/links.md"
sleep 1.5
shot "at15-a-links-top.png"
# app sockets before external click
ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$EVIDENCE/at15-app-pids.txt"
for pid in $(cat "$EVIDENCE/at15-app-pids.txt"); do ss -tanp 2>/dev/null | grep "pid=$pid," || true; done >"$EVIDENCE/at15-sockets-before.txt"
click 400 370   # jump-to-first-duplicate link
sleep 1.5
shot "at15-b-internal-jump.png"
click 400 414   # missing fragment link
sleep 1
shot "at15-c-missing-fragment.png"
key alt+Left
sleep 1
shot "at15-d-after-back.png"
click 407 482   # relative document link
sleep 2
shot "at15-e-relative-nav.png"
key alt+Left
sleep 1.5
shot "at16-a-back-to-links.png"
key alt+Right
sleep 1.5
shot "at16-b-forward-again.png"
terminate_app

group_footer
