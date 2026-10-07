#!/usr/bin/env bash
# screenshot.sh — deterministic X11 capture for PaperStack EA-RUN evidence
# (ADR-010; implementation plan §5.3): window lookup -> xwd -> ffmpeg PNG.
#
# Usage: tests/desktop/screenshot.sh <out.png> [window-name]
#
# The window is located with `xwininfo -root -tree`, preferring the first
# matching line that is NOT the window-manager frame (mutter-x11-frames), so
# the client surface is captured without decorations. If the window (or xwd on
# it) is unavailable, a full-root capture is used as a deterministic fallback
# and a note is printed to stderr.
#
# Environment:
#   DISPLAY_SCREENSHOT  X display to use (default: ${DISPLAY:-:1})
#
# Dependencies: xwininfo, xwd, ffmpeg (all checked; see README.md).
set -euo pipefail

out="${1:-}"
if [[ -z "$out" ]]; then
  echo "usage: $0 <out.png> [window-name]" >&2
  exit 2
fi
window_name="${2:-纸栈 PaperStack}"
display="${DISPLAY_SCREENSHOT:-${DISPLAY:-:1}}"

for tool in xwininfo xwd ffmpeg; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "screenshot.sh: required tool '$tool' not found" >&2
    exit 3
  fi
done

mkdir -p "$(dirname "$out")"
tmp="$(mktemp /tmp/opencode/paperstack-shot-XXXXXX.xwd)"
trap 'rm -f "$tmp"' EXIT

window_id=""
if command -v xwininfo >/dev/null 2>&1; then
  window_id="$(
    xwininfo -display "$display" -root -tree 2>/dev/null |
      awk -v name="$window_name" 'index($0, name) && $0 !~ /mutter-x11-frames/ { print $1; exit }'
  )"
fi

if [[ -n "$window_id" ]]; then
  if xwd -display "$display" -id "$window_id" -silent -out "$tmp" 2>/dev/null; then
    ffmpeg -y -loglevel error -i "$tmp" -frames:v 1 -update 1 "$out"
    echo "screenshot: window $window_id -> $out"
    exit 0
  fi
  echo "screenshot: xwd failed for window $window_id; falling back to root" >&2
else
  printf "screenshot: window '%s' not found; falling back to root\n" "$window_name" >&2
fi

xwd -display "$display" -root -silent -out "$tmp"
ffmpeg -y -loglevel error -i "$tmp" -frames:v 1 -update 1 "$out"
echo "screenshot: full root (fallback) -> $out" >&2
