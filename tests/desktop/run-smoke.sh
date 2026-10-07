#!/usr/bin/env bash
# run-smoke.sh — one-command EA-RUN reproduction for PaperStack (wp-21 T-36/T-37).
#
# What it does (ADR-010 desktop verification protocol; implementation plan
# §5.3; ui-spec §9 fixed conditions):
#   1. checks prerequisites and builds tests/desktop/xdo-helper if needed;
#   2. builds the app with `pnpm tauri build --no-bundle` (release build used
#      for evidence) and records wall time + binary sha256;
#   3. fixes the run condition to light theme (records the system preference
#      first; prefers gsettings `color-scheme prefer-light`, restores on exit;
#      passes GTK_THEME=Adwaita:light to the app process);
#   4. launches the release binary on $DISPLAY with fixtures/reader-min/reader-min.md
#      and waits for the real window;
#   5. drives the planned checks through xdo-helper (focus, Tab, wheel scroll,
#      second-instance handoff, Ctrl+W, 1024x640 resize) and captures
#      screenshots into artifacts/70-verification/evidence/early-run/;
#   6. terminates the app cleanly with a WM_DELETE_WINDOW request and records
#      the outcome; every executed command and result goes to runs.log.
#
# Screenshots from this script are NOT automatically "checked": the EA-RUN
# report (artifacts/70-verification/early-run.md) records the visual
# observations item by item (DR-03/DR-05).
#
# Prerequisites: X11 session on DISPLAY_SMOKE (default :1), libxdo headers
# (/usr/include/xdo.h) + libxdo.so, cc, xwininfo, xwd, ffmpeg, pnpm with the
# project's @tauri-apps/cli. See tests/desktop/README.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESKTOP="$ROOT/tests/desktop"
HELPER="$DESKTOP/xdo-helper"
EVIDENCE="$ROOT/artifacts/70-verification/evidence/early-run"
FIXTURE="$ROOT/fixtures/reader-min/reader-min.md"
SECOND_FIXTURE="$ROOT/fixtures/encoding/utf8-cn-emoji.md"
APP_BIN="$ROOT/src-tauri/target/release/paperstack"
WINDOW_NAME="纸栈 PaperStack"
DISPLAY_ID="${DISPLAY_SMOKE:-:1}"
export DISPLAY="$DISPLAY_ID"

RUNS="$EVIDENCE/runs.log"
APP_LOG="$EVIDENCE/app.log"
BUILD_LOG="$EVIDENCE/build.log"
SECOND_LOG="$EVIDENCE/second-instance.log"

mkdir -p "$EVIDENCE"
: > "$RUNS"
rm -f "$EVIDENCE"/[0-9][0-9]-*.png

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$RUNS"; }
log_cmd() { printf '\n$ %s\n' "$*" >> "$RUNS"; printf '[%s] + %s\n' "$(date -Is)" "$*"; }

# run <cmd...>: execute, append combined output to runs.log, record exit code.
run() {
  log_cmd "$@"
  local st=0
  "$@" >>"$RUNS" 2>&1 || st=$?
  printf '[exit=%d] %s\n' "$st" "$*" >>"$RUNS"
  return "$st"
}

# run_out <logfile> <cmd...>: execute with output redirected to a separate log.
run_out() {
  local out="$1"
  shift
  log_cmd "$* >> ${out##*/}"
  local st=0
  "$@" >>"$out" 2>&1 || st=$?
  printf '[exit=%d] %s (output: %s)\n' "$st" "$*" "${out##*/}" >>"$RUNS"
  return "$st"
}

# run_capture <cmd...>: execute, print stdout, append it to runs.log.
run_capture() {
  log_cmd "$@"
  local out st=0
  out="$("$@" 2>&1)" || st=$?
  printf '%s\n' "$out" | tee -a "$RUNS"
  printf '[exit=%d] %s\n' "$st" "$*" >>"$RUNS"
  return "$st"
}

screenshot() { # screenshot <name>
  run "$DESKTOP/screenshot.sh" "$EVIDENCE/$1" "$WINDOW_NAME"
}

APP_PID=""
ORIG_COLOR_SCHEME=""

terminate_app() {
  [[ -n "$APP_PID" ]] || return 0
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    return 0
  fi
  log "clean termination: sending WM_DELETE_WINDOW via xdo-helper close"
  "$HELPER" close >>"$RUNS" 2>&1 || true
  for _ in $(seq 1 100); do
    kill -0 "$APP_PID" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$APP_PID" 2>/dev/null; then
    log "app still alive after close request; sending a second WM_DELETE_WINDOW"
    "$HELPER" close >>"$RUNS" 2>&1 || true
    for _ in $(seq 1 50); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.1
    done
  fi
  if kill -0 "$APP_PID" 2>/dev/null; then
    log "app still alive; falling back to SIGTERM (recorded as non-clean exit)"
    kill -TERM "$APP_PID" 2>/dev/null || true
    for _ in $(seq 1 50); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.1
    done
  fi
  if kill -0 "$APP_PID" 2>/dev/null; then
    log "app ignored SIGTERM; sending SIGKILL"
    kill -KILL "$APP_PID" 2>/dev/null || true
  fi
  wait "$APP_PID" 2>/dev/null || true
  APP_PID=""
}

cleanup() {
  set +e
  terminate_app
  if [[ -n "$ORIG_COLOR_SCHEME" ]]; then
    gsettings set org.gnome.desktop.interface color-scheme "$ORIG_COLOR_SCHEME" 2>/dev/null || true
    log "restored org.gnome.desktop.interface color-scheme=$ORIG_COLOR_SCHEME"
  fi
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
log "== PaperStack EA-RUN smoke =="
log "root=$ROOT display=$DISPLAY_ID window='$WINDOW_NAME'"
log "git HEAD: $(git -C "$ROOT" rev-parse HEAD) branch: $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
log "node $(node --version 2>/dev/null || echo n/a); pnpm $(pnpm --version 2>/dev/null || echo n/a); $(rustc --version 2>/dev/null || echo 'rustc n/a')"

for tool in cc xwininfo xwd ffmpeg; do
  command -v "$tool" >/dev/null 2>&1 || {
    log "FATAL: required tool '$tool' not found"
    exit 3
  }
done

log "screen: $(xdpyinfo -display "$DISPLAY_ID" 2>/dev/null | awk '/dimensions:/{print $2; exit}') XTEST: $(xdpyinfo -display "$DISPLAY_ID" 2>/dev/null | grep -c XTEST)"

if [[ ! -x "$HELPER" || "$DESKTOP/xdo-helper.c" -nt "$HELPER" ]]; then
  log "building tests/desktop/xdo-helper (cc -O2 ... -lxdo -lX11)"
  run cc -O2 "$DESKTOP/xdo-helper.c" -lxdo -lX11 -o "$HELPER"
else
  log "xdo-helper up to date; skipping rebuild"
fi

# Guard: a left-over instance would receive the second-instance handoff.
if pgrep -f "$APP_BIN" >/dev/null 2>&1; then
  log "WARNING: pre-existing paperstack release process; terminating it before the run"
  pkill -TERM -f "$APP_BIN" 2>/dev/null || true
  sleep 2
  pkill -KILL -f "$APP_BIN" 2>/dev/null || true
fi

# --- 1. release build (evidence build) -------------------------------------
log "== release build: pnpm tauri build --no-bundle =="
BUILD_START=$(date +%s)
run_out "$BUILD_LOG" pnpm tauri build --no-bundle
BUILD_SECONDS=$(( $(date +%s) - BUILD_START ))
log "release build wall time: ${BUILD_SECONDS}s"
sha256sum "$APP_BIN" >"$EVIDENCE/app-binary.sha256"
run_capture stat -c 'binary size=%s bytes mtime=%y' "$APP_BIN"
cat "$EVIDENCE/app-binary.sha256" | tee -a "$RUNS"

# --- 2. fixed light theme --------------------------------------------------
log "== fixed conditions: light theme =="
log_cmd "gsettings get org.gnome.desktop.interface color-scheme (actual system preference)"
gsettings get org.gnome.desktop.interface color-scheme 2>&1 | tee -a "$RUNS" || true
gsettings get org.gnome.desktop.interface gtk-theme 2>&1 | tee -a "$RUNS" || true
ORIG_COLOR_SCHEME="$(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null | tr -d "'" || true)"
if [[ -n "$ORIG_COLOR_SCHEME" ]]; then
  run gsettings set org.gnome.desktop.interface color-scheme prefer-light ||
    log "WARNING: gsettings prefer-light failed; relying on GTK_THEME override"
  log "forced light via gsettings color-scheme=prefer-light (original '$ORIG_COLOR_SCHEME' restored at exit); app also launched with GTK_THEME=Adwaita:light"
else
  log "gsettings color-scheme unavailable; using GTK_THEME=Adwaita:light only"
fi

# --- 3. launch -------------------------------------------------------------
log "== launch release app with fixture =="
: > "$APP_LOG"
log_cmd "GTK_THEME=Adwaita:light $APP_BIN $FIXTURE & (bg pid log: ${APP_LOG##*/})"
GTK_THEME=Adwaita:light "$APP_BIN" "$FIXTURE" >>"$APP_LOG" 2>&1 &
APP_PID=$!
log "app pid=$APP_PID"

log_cmd "$HELPER wait (up to 60s for class 'paperstack')"
WINDOW_ID="$("$HELPER" wait | tee -a "$RUNS")"
log "window id: $WINDOW_ID"
sleep 3

run "$HELPER" geometry
screenshot "01-main-top.png"

# --- 4. focus visibility + disabled (not fake) toolbar actions -------------
# Run before any pointer input on a fresh window: in this WebKitGTK/X11
# environment synthetic Tab produces visible :focus-visible rings only while
# the page has not received a pointer click yet (observed: after a click the
# injected Tab stops rendering rings). Focus order in the wp-19 minimal
# reader: skip link -> 打开 (enabled) -> 更多 (enabled). Controls whose
# features are not in this build (back, forward, nav panel, find, Aa) are
# real disabled buttons: Tab skips them.
log "== focus check: Tab x3 (skip link -> open -> more) =="
run "$HELPER" focus
run "$HELPER" key Tab
sleep 1
screenshot "02-focus-skip-link.png"
run "$HELPER" key Tab
sleep 1
screenshot "03-focus-open.png"
run "$HELPER" key Tab
sleep 1
screenshot "04-focus-more.png"

# --- 5. lower sections of the fixture --------------------------------------
log "== scroll to code/task-list, then mermaid/image, then bottom =="
run "$HELPER" click 640 500 5 6
sleep 2
screenshot "05-main-code.png"

# Task-list checkboxes are read-only: a click must not toggle them.
log "== task-list checkbox click (must stay non-interactive) =="
run "$HELPER" click 255 540 1 1
sleep 1
screenshot "06-task-checkbox-after-click.png"

run "$HELPER" click 640 500 5 6
sleep 2
screenshot "07-main-mermaid-image.png"
run "$HELPER" click 640 500 5 12
sleep 3
screenshot "08-main-bottom.png"

# --- 6. second document via single instance --------------------------------
log "== second instance handoff (CLI -> open-requested) =="
run_out "$SECOND_LOG" timeout 30 "$APP_BIN" "$SECOND_FIXTURE" ||
  log "WARNING: second instance exit code was non-zero (recorded above); continuing"
sleep 2
run_capture pgrep -c -f "$APP_BIN"
run "$HELPER" geometry
screenshot "09-second-document.png"

# --- 7. Ctrl+W close behavior ----------------------------------------------
log "== close entry: Ctrl+W =="
run "$HELPER" key ctrl+w
sleep 1
screenshot "10-close-second-tab.png"

# --- 8. 1024x640 resize attempt --------------------------------------------
log "== fixed condition: resize to 1024x640 =="
run "$HELPER" resize 1024 640 ||
  log "WARNING: resize to 1024x640 did not reach the exact requested size (actual geometry recorded above)"
sleep 1
run "$HELPER" geometry
screenshot "11-window-1024x640.png"
log "restoring 1280x800"
run "$HELPER" resize 1280 800
run "$HELPER" geometry

# --- 9. close last tab -> welcome placeholder ------------------------------
log "== close last tab: Ctrl+W -> welcome placeholder =="
run "$HELPER" key ctrl+w
sleep 1
screenshot "12-welcome-after-close-all.png"

# --- 10. clean termination --------------------------------------------------
log "== clean termination =="
terminate_app
log "termination complete; app.log tail:"
tail -5 "$APP_LOG" | tee -a "$RUNS" || true

log "== smoke run finished (total $(( $(date +%s) - BUILD_START ))s incl. build) =="
log "evidence: $EVIDENCE"
