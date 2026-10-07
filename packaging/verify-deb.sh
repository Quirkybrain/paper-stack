#!/usr/bin/env bash
# verify-deb.sh — offline verification of the PaperStack .deb (wp-43 C2).
#
# Checks, in order (ADR-008; R30/NF12; system-verification condition C2):
#   1. artifact identity: path, size, sha256;
#   2. `dpkg-deb -I` control metadata and `dpkg-deb -c` payload listing
#      (binary, .desktop entry, hicolor icons, bundled LICENSE /
#      THIRD_PARTY_NOTICES.md under /usr/lib/paperstack/);
#   3. package extraction (`dpkg-deb -x`) and byte comparison of the bundled
#      legal files against the repository root copies;
#   4. extract-run smoke on the real X11 display: the extracted binary opens
#      fixtures/reader-min/reader-min.md, the About page opens the license and
#      third-party viewers and both render the bundled text offline, then the
#      app is closed cleanly (WM_DELETE_WINDOW);
#   5. evidence (logs + screenshots) is written to the evidence directory.
#
# Usage:
#   bash packaging/verify-deb.sh [path/to/paperstack_0.1.0_amd64.deb] [evidence-dir]
#
# Defaults: newest .deb under src-tauri/target/release/bundle/deb/ and
# artifacts/70-verification/evidence/package/. Requires the test helper
# tests/desktop/xdo-helper (built on demand), ffmpeg, xwd, xwininfo and an X11
# session on DISPLAY_VERIFY (default :1). No network access is required or
# performed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEB="${1:-}"
EVIDENCE="${2:-$ROOT/artifacts/70-verification/evidence/package}"
DISPLAY_ID="${DISPLAY_VERIFY:-:1}"
FIXTURE="$ROOT/fixtures/reader-min/reader-min.md"
HELPER="$ROOT/tests/desktop/xdo-helper"
WINDOW_NAME="纸栈 PaperStack"
export DISPLAY="$DISPLAY_ID"

if [[ -z "$DEB" ]]; then
  DEB="$(ls -t "$ROOT"/src-tauri/target/release/bundle/deb/*.deb 2>/dev/null | head -1 || true)"
fi
[[ -f "$DEB" ]] || { echo "verify-deb.sh: no .deb found (build it first: pnpm tauri build --bundles deb)" >&2; exit 2; }
[[ -f "$FIXTURE" ]] || { echo "verify-deb.sh: fixture missing: $FIXTURE" >&2; exit 2; }

mkdir -p "$EVIDENCE"
RUNS="$EVIDENCE/verify-runs.log"
: > "$RUNS"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$RUNS"; }
run() {
  printf '\n$ %s\n' "$*" >>"$RUNS"
  local st=0
  "$@" >>"$RUNS" 2>&1 || st=$?
  printf '[exit=%d] %s\n' "$st" "$*" >>"$RUNS"
  return "$st"
}
run_out() { # run_out <logfile> <cmd...>
  local out="$1"; shift
  printf '\n$ %s >> %s\n' "$*" "$(basename "$out")" >>"$RUNS"
  local st=0
  "$@" >>"$out" 2>&1 || st=$?
  printf '[exit=%d] %s (output: %s)\n' "$st" "$*" "$(basename "$out")" >>"$RUNS"
  return "$st"
}

# pixel_at <png> <x> <y>: print "r g b" of one pixel (ffmpeg raw crop), used to
# detect the aggregate local-resource prompt (dimmed page background).
pixel_at() {
  ffmpeg -loglevel error -i "$1" -vf "crop=1:1:$2:$3" -frames:v 1 \
    -f rawvideo -pix_fmt rgb24 - 2>/dev/null | od -An -tu1 | tr -s ' ' | sed 's/^ //'
}

for tool in xwininfo xwd ffmpeg dpkg-deb sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || { log "FATAL: required tool '$tool' not found"; exit 3; }
done
if [[ ! -x "$HELPER" || "$ROOT/tests/desktop/xdo-helper.c" -nt "$HELPER" ]]; then
  log "building tests/desktop/xdo-helper"
  run cc -O2 "$ROOT/tests/desktop/xdo-helper.c" -lxdo -lX11 -o "$HELPER"
fi
shot() { run "$ROOT/tests/desktop/screenshot.sh" "$EVIDENCE/$1" "$WINDOW_NAME"; }

EXTRACT="$(mktemp -d /tmp/opencode/paperstack-deb-XXXXXX)"
APP_PID=""
cleanup() {
  set +e
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    log "cleanup: WM_DELETE_WINDOW"
    "$HELPER" close >>"$RUNS" 2>&1 || true
    sleep 2
    kill -0 "$APP_PID" 2>/dev/null && { log "cleanup: SIGTERM"; kill -TERM "$APP_PID" 2>/dev/null; sleep 1; }
    kill -0 "$APP_PID" 2>/dev/null && { log "cleanup: SIGKILL"; kill -KILL "$APP_PID" 2>/dev/null; }
    wait "$APP_PID" 2>/dev/null || true
  fi
  [[ "${KEEP_EXTRACT:-0}" == "1" ]] || rm -rf "$EXTRACT"
}
trap cleanup EXIT INT TERM

log "== PaperStack .deb verification (wp-43 C2) =="
log "deb=$DEB"
log "git HEAD: $(git -C "$ROOT" rev-parse HEAD) branch: $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
log "display=$DISPLAY_ID window='$WINDOW_NAME'"

# --- 1. artifact identity ---------------------------------------------------
run_capture() { # run_capture <cmd...>
  printf '\n$ %s\n' "$*" >>"$RUNS"
  local out st=0
  out="$("$@" 2>&1)" || st=$?
  printf '%s\n' "$out" | tee -a "$RUNS"
  printf '[exit=%d] %s\n' "$st" "$*" >>"$RUNS"
  return "$st"
}
run_capture stat -c 'deb path=%n size=%s bytes mtime=%y' "$DEB"
sha256sum "$DEB" | tee "$EVIDENCE/deb.sha256" | tee -a "$RUNS"

# --- 2. package metadata and payload ---------------------------------------
run_out "$EVIDENCE/dpkg-deb-I.txt" dpkg-deb -I "$DEB"
run_capture dpkg-deb -f "$DEB" Package Version Maintainer Architecture Depends Description
run_out "$EVIDENCE/dpkg-deb-c.txt" dpkg-deb -c "$DEB"
grep -q "usr/bin/paperstack" "$EVIDENCE/dpkg-deb-c.txt" || { log "FATAL: binary missing from payload"; exit 4; }
grep -q "usr/share/applications/paperstack.desktop" "$EVIDENCE/dpkg-deb-c.txt" || { log "FATAL: .desktop entry missing"; exit 4; }
grep -q "usr/lib/paperstack/LICENSE" "$EVIDENCE/dpkg-deb-c.txt" || { log "FATAL: bundled LICENSE missing"; exit 4; }
grep -q "usr/lib/paperstack/THIRD_PARTY_NOTICES.md" "$EVIDENCE/dpkg-deb-c.txt" || { log "FATAL: bundled THIRD_PARTY_NOTICES.md missing"; exit 4; }

# --- 3. extraction + legal-file byte comparison ----------------------------
run_out "$EVIDENCE/dpkg-deb-x.log" dpkg-deb -x "$DEB" "$EXTRACT"
APP_BIN="$EXTRACT/usr/bin/paperstack"
[[ -x "$APP_BIN" ]] || { log "FATAL: extracted binary not executable"; exit 4; }
{
  echo "== extracted tree under usr/ =="
  find "$EXTRACT/usr" -maxdepth 4 | sort
  echo "== extracted legal files vs repository root =="
  sha256sum "$EXTRACT/usr/lib/paperstack/LICENSE" "$ROOT/LICENSE"
  cmp "$EXTRACT/usr/lib/paperstack/LICENSE" "$ROOT/LICENSE" && echo "LICENSE: byte-identical"
  sha256sum "$EXTRACT/usr/lib/paperstack/THIRD_PARTY_NOTICES.md" "$ROOT/THIRD_PARTY_NOTICES.md"
  cmp "$EXTRACT/usr/lib/paperstack/THIRD_PARTY_NOTICES.md" "$ROOT/THIRD_PARTY_NOTICES.md" && echo "THIRD_PARTY_NOTICES.md: byte-identical"
  echo "== desktop entry =="
  cat "$EXTRACT/usr/share/applications/paperstack.desktop"
} | tee "$EVIDENCE/extract-files.txt" | tee -a "$RUNS"

# --- 4. extract-run smoke ---------------------------------------------------
SMOKE_DATA="$EVIDENCE/data"
mkdir -p "$SMOKE_DATA"
log "== extract-run smoke: $APP_BIN $FIXTURE =="
env GTK_THEME=Adwaita:light XDG_DATA_HOME="$SMOKE_DATA" XDG_CACHE_HOME="$EVIDENCE/cache" \
  "$APP_BIN" "$FIXTURE" >>"$EVIDENCE/app.log" 2>&1 &
APP_PID=$!
log "app pid=$APP_PID (extracted package binary)"
# The xdo helper can race a transient X window during WebKit startup (Xlib's
# default BadWindow handler exits); retry the wait before failing.
WAIT_ATTEMPT=0
until "$HELPER" wait >>"$RUNS" 2>&1; do
  WAIT_ATTEMPT=$((WAIT_ATTEMPT + 1))
  if (( WAIT_ATTEMPT >= 3 )); then
    log "FATAL: window wait failed ${WAIT_ATTEMPT} times"
    exit 5
  fi
  log "window wait attempt $WAIT_ATTEMPT failed (transient X window race); retrying"
  sleep 1
done
printf '[wait] window found on attempt %d\n' "$((WAIT_ATTEMPT + 1))" >>"$RUNS"
sleep "${SMOKE_SETTLE:-3}"
shot 01-launch.png

# The fixture references local resources, so the aggregate authorization prompt
# can be up; block it (保持阻止, 279,548) before navigating to the About page.
PROMPT_PIXEL="$(pixel_at "$EVIDENCE/01-launch.png" 60 400 || true)"
PROMPT_R="${PROMPT_PIXEL%% *}"
if [[ -n "$PROMPT_R" ]] && (( PROMPT_R < 240 )); then
  log "local-resource prompt detected -> 保持阻止 (279,548)"
  run "$HELPER" click 279 548
  sleep 1
  shot 01b-prompt-blocked.png
fi

log "== About page: more menu -> End (last item 关于) -> Return =="
run "$HELPER" click 1245 26
sleep 1
# The menu focuses its first enabled item on open; 'End' moves to the last
# enabled item (关于) regardless of the document state (Down would wrap).
run "$HELPER" key End
sleep 0.3
run "$HELPER" key Return
sleep 1.5
shot 02-about.png

log "== license viewer (查看许可证) =="
run "$HELPER" click 499 579
sleep 1.5
shot 03-license-viewer.png
run "$HELPER" key Escape
sleep 1

log "== third-party notices viewer (第三方声明) =="
run "$HELPER" click 649 579
sleep 1.5
shot 04-third-party-viewer.png
run "$HELPER" key Escape
sleep 0.8
run "$HELPER" key Escape
sleep 1

log "== clean termination (WM_DELETE_WINDOW) =="
run "$HELPER" close
for _ in $(seq 1 80); do
  kill -0 "$APP_PID" 2>/dev/null || break
  sleep 0.1
done
if kill -0 "$APP_PID" 2>/dev/null; then
  log "NON-CLEAN: app alive after close request; SIGTERM"
  kill -TERM "$APP_PID" 2>/dev/null || true
  sleep 1
fi
if kill -0 "$APP_PID" 2>/dev/null; then
  log "NON-CLEAN: SIGKILL"
  kill -KILL "$APP_PID" 2>/dev/null || true
fi
wait "$APP_PID" 2>/dev/null && EXIT_CODE=0 || EXIT_CODE=$?
APP_PID=""
log "app exit code: ${EXIT_CODE}"
# Best-effort capture of the desktop after the window is gone (root capture can
# fail once the app's colormap is released; the missing window is itself the
# evidence and the pgrep check below is authoritative).
shot 05-after-close.png || log "post-close root screenshot unavailable (window already closed)"
if pgrep -f "$APP_BIN" >/dev/null 2>&1; then
  log "FATAL: extracted app process still running"
  pgrep -af "$APP_BIN" >>"$RUNS" 2>&1 || true
  exit 5
fi
log "no extracted app process remains"
log "app.log tail:"
tail -5 "$EVIDENCE/app.log" | tee -a "$RUNS" || true
log "== verification finished; evidence: $EVIDENCE =="
