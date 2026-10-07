#!/usr/bin/env bash
# run-at-a.sh — AT01–AT04 acceptance runs (wp-34, T-63).
# AT01 open semantics, AT02 directory reading, AT03 encodings, AT04 read-only.
AT_GROUP=at01-04
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT01-AT04"
ensure_helper
fix_conditions
reset_data

IN="$INPUTS/at01"
mkdir -p "$IN"
cp "$FIXTURES/rendering/mixed-cn-en.md" "$IN/sample.markdown"
cp "$FIXTURES/rendering/mixed-cn-en.md" "$IN/SAMPLE.MD"
cp "$FIXTURES/encoding/utf8-cn-emoji.md" "$IN/sample.tex"
cp "$FIXTURES/encoding/utf8-cn-emoji.md" "$IN/sample.mdx"
mkdir -p "$INPUTS/at02/dir2/sub-empty" "$INPUTS/at02/dir2/plain"
cp "$FIXTURES/rendering/math.md" "$INPUTS/at02/dir2/plain/note.md"
mkdir -p "$INPUTS/at02/noperm"
chmod 000 "$INPUTS/at02/noperm"

# ---------------------------------------------------------------- AT01 -----
launch_app
shot "at01-a-welcome-no-args.png"
terminate_app

launch_app "$FIXTURES/rendering/mixed-cn-en.md"
shot "at01-b-md-cli.png"
run_out "$EVIDENCE/second-a-md.log" timeout 30 "$APP_BIN" "$IN/sample.markdown"
sleep 2
shot "at01-c-markdown-second-instance.png"
run_out "$EVIDENCE/second-a-dup.log" timeout 30 "$APP_BIN" "$FIXTURES/rendering/mixed-cn-en.md"
sleep 2
shot "at01-d-duplicate-reuse.png"
run_out "$EVIDENCE/second-a-upper.log" timeout 30 "$APP_BIN" "$IN/SAMPLE.MD"
sleep 2
shot "at01-e-uppercase-extension.png"
run_out "$EVIDENCE/second-a-invalid.log" timeout 30 "$APP_BIN" "$IN/does-not-exist.md"
sleep 2
shot "at01-f-invalid-path.png"

# file picker: choose a file through the GTK dialog (same open pipeline)
open_picker_file
shot "at01-g-file-picker-open.png"
confirm_picker_path "$FIXTURES/rendering/tables.md"
shot "at01-h-picker-file-opened.png"
# picker cancel changes nothing
open_picker_file
shot "at01-i-picker-cancel-open.png"
key Escape
sleep 1
shot "at01-j-picker-cancelled.png"
terminate_app

launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
sleep 1
shot "at01-k-batch-first-active.png"
click 280 87
sleep 1
shot "at01-l-batch-second-tab.png"
terminate_app

# ---------------------------------------------------------------- AT02 -----
# Launch 1: base tree (states inline) + expand sub/deep + open c.md
launch_app
open_picker_dir
confirm_picker_path "$FIXTURES/tree/root"
key ctrl+b
sleep 1
shot "at02-a-tree-root.png"
click 100 449
sleep 1
shot "at02-b-sub-expanded.png"
click 100 539
sleep 1
shot "at02-c-deep-expanded.png"
click 100 584
sleep 1.5
shot "at02-d-open-c-md.png"
terminate_app

# Launch 2: symlink detail rows
launch_app
open_picker_dir
confirm_picker_path "$FIXTURES/tree/root"
key ctrl+b
sleep 1
click 100 269
sleep 1
shot "at02-e-link-broken-expanded.png"
click 100 404
sleep 1
shot "at02-f-link-outside-expanded.png"
terminate_app

# Launch 3: second directory with an empty subdirectory
launch_app
open_picker_dir
confirm_picker_path "$INPUTS/at02/dir2"
key ctrl+b
sleep 1
shot "at02-g-dir2.png"
click 100 179
sleep 1
shot "at02-h-empty-subdir.png"
terminate_app

# Launch 4: no-permission directory
launch_app
open_picker_dir
confirm_picker_path "$INPUTS/at02/noperm"
key ctrl+b
sleep 1
shot "at02-i-no-permission.png"
terminate_app
chmod 755 "$INPUTS/at02/noperm"

# ---------------------------------------------------------------- AT03 -----
launch_app "$FIXTURES/encoding/bom.md"
sleep 1
shot "at03-a-bom.png"
run_out "$EVIDENCE/second-a-emoji.log" timeout 30 "$APP_BIN" "$FIXTURES/encoding/utf8-cn-emoji.md"
sleep 1.5
shot "at03-b-emoji.png"
run_out "$EVIDENCE/second-a-empty.log" timeout 30 "$APP_BIN" "$FIXTURES/encoding/empty.md"
sleep 1.5
shot "at03-c-empty.png"
run_out "$EVIDENCE/second-a-crlf.log" timeout 30 "$APP_BIN" "$FIXTURES/encoding/crlf.md"
sleep 1.5
shot "at03-d-crlf.png"
run_out "$EVIDENCE/second-a-mdx.log" timeout 30 "$APP_BIN" "$IN/sample.mdx"
sleep 1.5
shot "at03-e-mdx-unsupported.png"
terminate_app

launch_app "$FIXTURES/encoding/latin1.md"
sleep 1
shot "at03-f-latin1-error.png"
terminate_app

launch_app "$FIXTURES/encoding/binary.md"
sleep 1
shot "at03-g-binary-error.png"
terminate_app

# ---------------------------------------------------------------- AT04 -----
RO="$INPUTS/at04"
mkdir -p "$RO"
cp "$FIXTURES/rendering/code.md" "$RO/code.md"
cp "$FIXTURES/rendering/edge-cases.md" "$RO/edge-cases.md"
cp "$FIXTURES/encoding/latin1.md" "$RO/latin1.md"
find "$FIXTURES" -type f -exec sha256sum {} + | sort >"$EVIDENCE/at04-fixtures-before.sha256"
find "$RO" -type f -exec sha256sum {} + | sort >"$EVIDENCE/at04-copy-before.sha256"
find "$FIXTURES" -type f -printf '%P\n' | sort >"$EVIDENCE/at04-fixtures-list-before.txt"
find "$RO" -type f -printf '%P\n' | sort >"$EVIDENCE/at04-copy-list-before.txt"

launch_app "$RO/code.md"
wheel 640 400 5 4
sleep 1
shot "at04-a-scroll.png"
# text selection + copy attempt (keyboard: click into body, shift+arrow, ctrl+c)
click 640 300
sleep 0.3
key shift+Down
sleep 0.3
key ctrl+c
sleep 0.5
get_clip >"$EVIDENCE/at04-clip-after-select.txt" 2>/dev/null || true
key ctrl+f
sleep 0.8
paste_text "fn main"
sleep 0.8
shot "at04-b-search-in-session.png"
key Escape
sleep 0.3
key ctrl+comma
sleep 0.8
shot "at04-c-settings-open.png"
key Escape
sleep 0.3
run_out "$EVIDENCE/second-a04-error.log" timeout 30 "$APP_BIN" "$RO/latin1.md"
sleep 1.5
shot "at04-d-error-flow.png"
run_out "$EVIDENCE/second-a04-edge.log" timeout 30 "$APP_BIN" "$RO/edge-cases.md"
sleep 1.5
shot "at04-e-edge-tab.png"
# edge-cases is the second tab; scroll to the task list and click a checkbox
click 280 87
sleep 0.5
wheel 640 400 5 6
sleep 0.8
shot "at04-f-edge-tasklist.png"
click 255 400
sleep 0.8
shot "at04-g-checkbox-after-click.png"
terminate_app

find "$FIXTURES" -type f -exec sha256sum {} + | sort >"$EVIDENCE/at04-fixtures-after.sha256"
find "$RO" -type f -exec sha256sum {} + | sort >"$EVIDENCE/at04-copy-after.sha256"
find "$FIXTURES" -type f -printf '%P\n' | sort >"$EVIDENCE/at04-fixtures-list-after.txt"
find "$RO" -type f -printf '%P\n' | sort >"$EVIDENCE/at04-copy-list-after.txt"
{
  echo "== fixtures sha256 diff =="
  diff "$EVIDENCE/at04-fixtures-before.sha256" "$EVIDENCE/at04-fixtures-after.sha256" && echo "IDENTICAL"
  echo "== copy sha256 diff =="
  diff "$EVIDENCE/at04-copy-before.sha256" "$EVIDENCE/at04-copy-after.sha256" && echo "IDENTICAL"
  echo "== fixtures file list diff =="
  diff "$EVIDENCE/at04-fixtures-list-before.txt" "$EVIDENCE/at04-fixtures-list-after.txt" && echo "IDENTICAL"
  echo "== copy file list diff =="
  diff "$EVIDENCE/at04-copy-list-before.txt" "$EVIDENCE/at04-copy-list-after.txt" && echo "IDENTICAL"
} >"$EVIDENCE/at04-hash-diff.txt" 2>&1
log "AT04 hash comparison: $(tr '\n' ' ' < "$EVIDENCE/at04-hash-diff.txt") | clip_bytes=$(wc -c < "$EVIDENCE/at04-clip-after-select.txt" 2>/dev/null || echo 0)"

group_footer
