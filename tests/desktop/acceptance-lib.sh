#!/usr/bin/env bash
# acceptance-lib.sh — shared helpers for the wp-34 AT01–AT30 desktop
# acceptance runs (ADR-010; implementation plan §5.3/§5.5; test-engineer,
# task wp-34-desktop-at) and the wp-34b fixed-item re-runs (task
# wp-34b-atrerun; AT06/07/14/15/19/26/28/30 + regression spot-checks).
#
# This library is sourced by tests/desktop/run-at-*.sh group scripts. It
# provides: isolated app data, controlled launch/termination of the release
# binary on the real X11 display, scripted input through tests/desktop/
# xdo-helper, deterministic screenshots and one append-only command log.
#
# The committed run-smoke.sh contract is NOT modified; this library follows
# the same conventions (release build, DISPLAY=:1, light fixed condition,
# WM_DELETE_WINDOW close, screenshots are evidence not verification).
#
# Environment overrides: DISPLAY_AT (default :1), AT_GROUP (label written to
# the log; default derived from the calling script), AT_EVIDENCE (evidence
# directory; default artifacts/70-verification/evidence/at — set to
# .../evidence/at-rerun for the wp-34b re-runs so the wp-34 evidence is
# preserved).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESKTOP="$ROOT/tests/desktop"
HELPER="$DESKTOP/xdo-helper"
EVIDENCE="${AT_EVIDENCE:-$ROOT/artifacts/70-verification/evidence/at}"
INPUTS="$EVIDENCE/inputs"
AT_DATA="$EVIDENCE/data"           # isolated XDG_DATA_HOME for all AT runs
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
FIXTURES="$ROOT/fixtures"
DISPLAY_ID="${DISPLAY_AT:-:1}"
export DISPLAY="$DISPLAY_ID"

RUNS="$EVIDENCE/runs.log"
APP_LOG="$EVIDENCE/app.log"

AT_GROUP="${AT_GROUP:-$(basename "${BASH_SOURCE[1]:-at}")}"

mkdir -p "$EVIDENCE" "$INPUTS" "$AT_DATA"
[[ -f "$RUNS" ]] || : > "$RUNS"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$AT_GROUP" "$*" | tee -a "$RUNS"; }
log_cmd() { printf '\n$ %s\n' "$*" >> "$RUNS"; }

# run <cmd...>: execute, append combined output to the log, record exit code.
run() {
  log_cmd "$@"
  local st=0
  "$@" >>"$RUNS" 2>&1 || st=$?
  printf '[exit=%d] %s\n' "$st" "$*" >> "$RUNS"
  return "$st"
}

# run_out <logfile> <cmd...>: execute with output redirected to a file.
run_out() {
  local out="$1"; shift
  log_cmd "$* >> ${out##*/}"
  local st=0
  "$@" >>"$out" 2>&1 || st=$?
  printf '[exit=%d] %s (output: %s)\n' "$st" "$*" "${out##*/}" >> "$RUNS"
  return "$st"
}

# screenshot <name>: capture the app client window (falls back to root).
shot() {
  run "$DESKTOP/screenshot.sh" "$EVIDENCE/$1" "纸栈 PaperStack"
}

# root_shot <name>: capture the whole X root (for windows that are separate
# X toplevels, e.g. GTK file dialogs, outside the client-surface capture).
root_shot() {
  local tmp out="$EVIDENCE/$1"
  tmp="$(mktemp /tmp/opencode/ps-root-XXXXXX.xwd)"
  log_cmd "xwd -root -> ffmpeg $1"
  xwd -display "$DISPLAY_ID" -root -silent -out "$tmp" 2>>"$RUNS" &&
    ffmpeg -y -loglevel error -i "$tmp" -frames:v 1 -update 1 "$out" >>"$RUNS" 2>&1
  local st=$?
  rm -f "$tmp"
  printf '[exit=%d] root_shot %s\n' "$st" "$1" >>"$RUNS"
  return "$st"
}

key()   { run "$HELPER" key "$1"; }
click() { run "$HELPER" click "$1" "$2" "${3:-1}" "${4:-1}"; }
wheel() { run "$HELPER" click "$1" "$2" "$3" "$4"; }
focus() { run "$HELPER" focus; }

# set_clip <text>: put text on the X11 clipboard (xclip serves it in bg).
set_clip() {
  printf '%s' "$1" | xclip -selection clipboard -i
  sleep 0.3
}

# paste_text <text>: clipboard + Ctrl+V into the focused editable field.
paste_text() {
  set_clip "$1"
  key ctrl+v
  sleep 0.5
}

get_clip() { timeout 5 xclip -selection clipboard -o 2>/dev/null; }

# db_path: the isolated app records database.
db_path() { printf '%s\n' "$AT_DATA/com.quirkybrain.paperstack/paperstack.sqlite3"; }

# db_dump <tag>: read-only records snapshot appended to runs.log (session,
# recents, positions, documents, startup/privacy settings). Run while the app
# is terminated so the read reflects the committed at-rest state.
db_dump() {
  local tag="$1"
  printf '\n== DB dump [%s] %s ==\n' "$tag" "$(db_path)" >>"$RUNS"
  python3 - "$(db_path)" >>"$RUNS" 2>&1 <<'PY'
import sqlite3, sys
db = sys.argv[1]
con = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
def dump(label, query):
    try:
        rows = con.execute(query).fetchall()
    except Exception as exc:  # noqa: BLE001 - diagnostics only
        print(f'-- {label}: ERR {exc}')
        return
    print(f'-- {label}: {len(rows)}')
    for row in rows:
        print('  ', row)
dump('session_tabs', 'select tab_id, doc_id, order_index, is_active from session_tabs order by order_index')
dump('recents', 'select doc_id, last_path, opened_at from recents order by opened_at desc')
dump('positions', 'select doc_id, version_hash, heading_path_json, '
                  'substr(block_fingerprint,1,24), offset_ratio, source_range_json '
                  'from positions')
dump('documents', 'select doc_id, canonical_path, display_name from documents order by doc_id')
dump('settings', 'select key, value_json from settings order by key')
PY
}

# pixel_at <png> <x> <y>: print "r g b" of one pixel (ffmpeg raw crop).
pixel_at() {
  ffmpeg -loglevel error -i "$1" -vf "crop=1:1:$2:$3" -frames:v 1 \
    -f rawvideo -pix_fmt rgb24 - 2>/dev/null | od -An -tu1 | tr -s ' ' | sed 's/^ //'
}

# modal_open <png>: a modal overlay dims the page background (probe: the
# (60,400) page pixel is pure white without an overlay, gray with one).
modal_open() {
  local px r
  px="$(pixel_at "$1" 60 400)"
  r="${px%% *}"
  [[ -n "$r" ]] && (( r < 240 ))
}

# maybe_block_local_prompt: if the aggregate local-resource dialog is up,
# click 保持阻止 (279,548) so later steps are not blocked. Evidence first.
maybe_block_local_prompt() {
  local tag="${1:-prompt}"
  sleep "${PROMPT_WAIT:-2}"
  shot "${tag}.png"
  if modal_open "$EVIDENCE/$tag.png"; then
    log "local-resource prompt detected -> clicking 保持阻止"
    click 279 548
    sleep 0.8
    return 0
  fi
  log "no modal prompt (tag $tag)"
  return 1
}

# dismiss_modal <tag> [tries]: block the aggregate auth dialog (保持阻止) until
# the overlay is gone. The first synthetic Escape is sometimes swallowed while
# the WebView settles (observed), so retry with a pixel-verified loop.
dismiss_modal() {
  local tag="$1" tries="${2:-4}" i=0
  while (( i < tries )); do
    i=$((i + 1))
    shot "${tag}-try${i}.png"
    if ! modal_open "$EVIDENCE/${tag}-try${i}.png"; then
      return 0
    fi
    log "modal present (try $i) -> Escape to block"
    key Escape
    sleep 1
  done
  shot "${tag}-final.png"
  if modal_open "$EVIDENCE/${tag}-final.png"; then
    log "WARNING: modal still present after $tries tries"
    return 1
  fi
  return 0
}

# allow_modal <tag>: click 允许本次读取 (aggregate local dialog, allow once).
allow_modal() {
  local tag="$1" i=0
  while (( i < 4 )); do
    i=$((i + 1))
    shot "${tag}-try${i}.png"
    if ! modal_open "$EVIDENCE/${tag}-try${i}.png"; then
      return 0
    fi
    log "modal present (try $i) -> click 允许本次读取"
    click 427 548
    sleep 1
  done
  return 1
}

# --- GTK file-picker automation ---------------------------------------------
# open_picker_file / open_picker_dir: toolbar 打开 menu (first / second item).
open_picker_file() {
  click 83 26
  sleep 0.7
  key Return
  sleep 1.5
}
open_picker_dir() {
  click 83 26
  sleep 0.7
  key Down
  sleep 0.3
  key Return
  sleep 1.5
}

# confirm_picker_path <path>: the picker is open; type the path via the GTK
# location entry (Ctrl+L) and confirm with Return.
confirm_picker_path() {
  set_clip "$1"
  key ctrl+l
  sleep 0.8
  key ctrl+v
  sleep 1.0
  key Return
  sleep 2
}

# reset_data: fresh isolated XDG_DATA_HOME (app must not be running).
reset_data() {
  terminate_app
  rm -rf "$AT_DATA"
  mkdir -p "$AT_DATA"
  log "isolated app data reset: $AT_DATA"
}

APP_PID=""
ORIG_COLOR_SCHEME=""

ensure_helper() {
  if [[ ! -x "$HELPER" || "$DESKTOP/xdo-helper.c" -nt "$HELPER" ]]; then
    log "building tests/desktop/xdo-helper"
    run cc -O2 "$DESKTOP/xdo-helper.c" -lxdo -lX11 -o "$HELPER"
  fi
}

guard_no_instance() {
  if pgrep -f "$APP_BIN" >/dev/null 2>&1; then
    log "WARNING: pre-existing paperstack process; terminating before launch"
    pkill -TERM -f "$APP_BIN" 2>/dev/null || true
    sleep 1
    pkill -KILL -f "$APP_BIN" 2>/dev/null || true
  fi
}

# launch_app [args...]: fresh isolated-data launch; waits for the real window.
# Extra environment: LAUNCH_ENV="KEY=VAL ..." is exported for this process.
launch_app() {
  guard_no_instance
  : > "$APP_LOG"
  local envs=()
  if [[ -n "${LAUNCH_ENV:-}" ]]; then
    # shellcheck disable=SC2206
    envs=($LAUNCH_ENV)
  fi
  log_cmd "GTK_THEME=Adwaita:light XDG_DATA_HOME=$AT_DATA ${LAUNCH_ENV:-} $APP_BIN $* &"
  env GTK_THEME=Adwaita:light XDG_DATA_HOME="$AT_DATA" "${envs[@]}" "$APP_BIN" "$@" >>"$APP_LOG" 2>&1 &
  APP_PID=$!
  log "app pid=$APP_PID args='$*'"
  run "$HELPER" wait
  sleep "${LAUNCH_SETTLE:-2.5}"
}

terminate_app() {
  [[ -n "$APP_PID" ]] || return 0
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    log "app already exited (pid $APP_PID)"
    APP_PID=""
    return 0
  fi
  log "clean termination: WM_DELETE_WINDOW"
  "$HELPER" close >>"$RUNS" 2>&1 || true
  for _ in $(seq 1 80); do
    kill -0 "$APP_PID" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$APP_PID" 2>/dev/null; then
    log "app alive after first close request; second WM_DELETE_WINDOW"
    "$HELPER" close >>"$RUNS" 2>&1 || true
    for _ in $(seq 1 50); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.1
    done
  fi
  if kill -0 "$APP_PID" 2>/dev/null; then
    log "NON-CLEAN: falling back to SIGTERM"
    kill -TERM "$APP_PID" 2>/dev/null || true
    sleep 1
  fi
  if kill -0 "$APP_PID" 2>/dev/null; then
    log "NON-CLEAN: SIGKILL"
    kill -KILL "$APP_PID" 2>/dev/null || true
  fi
  wait "$APP_PID" 2>/dev/null || true
  APP_PID=""
}

cleanup() {
  set +e
  terminate_app
  pkill -f "xclip -selection clipboard" 2>/dev/null || true
  if [[ -n "$ORIG_COLOR_SCHEME" ]]; then
    gsettings set org.gnome.desktop.interface color-scheme "$ORIG_COLOR_SCHEME" 2>/dev/null || true
    log "restored color-scheme=$ORIG_COLOR_SCHEME"
  fi
  if [[ -n "${ORIG_TEXT_SCALE:-}" ]]; then
    gsettings set org.gnome.desktop.interface text-scaling-factor "$ORIG_TEXT_SCALE" 2>/dev/null || true
    log "restored text-scaling-factor=$ORIG_TEXT_SCALE"
  fi
  if pgrep -f "$APP_BIN" >/dev/null 2>&1; then
    log "WARNING: paperstack process still alive after cleanup"
    pgrep -af "$APP_BIN" >>"$RUNS" 2>&1 || true
  else
    log "pgrep: no paperstack process remains"
  fi
}
trap cleanup EXIT INT TERM

fix_conditions() {
  log "== fixed conditions: light theme =="
  ORIG_COLOR_SCHEME="$(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null | tr -d "'" || true)"
  ORIG_TEXT_SCALE="$(gsettings get org.gnome.desktop.interface text-scaling-factor 2>/dev/null | tr -d "'" || true)"
  log "original color-scheme='$ORIG_COLOR_SCHEME'; text-scaling='$ORIG_TEXT_SCALE'"
  if [[ -n "$ORIG_COLOR_SCHEME" ]]; then
    run gsettings set org.gnome.desktop.interface color-scheme prefer-light || true
  fi
}

group_header() {
  log "======== $AT_GROUP: $* ========"
  log "git HEAD: $(git -C "$ROOT" rev-parse HEAD) branch: $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  log "binary: $APP_BIN sha256=$(sha256sum "$APP_BIN" | cut -d' ' -f1)"
  log "display: $DISPLAY_ID screen: $(xdpyinfo -display "$DISPLAY_ID" 2>/dev/null | awk '/dimensions:/{print $2; exit}')"
}

group_footer() {
  log "======== $AT_GROUP done: app pid state '${APP_PID:-none}' ========"
}
