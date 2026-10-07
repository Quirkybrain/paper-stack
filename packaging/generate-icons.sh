#!/usr/bin/env bash
# generate-icons.sh — regenerate src-tauri/icons/*.png from packaging/icon.svg
# (wp-43 C2 packaging; ADR-008). ffmpeg with the librsvg SVG decoder is used as
# the rasteriser (no extra toolchain dependency; see packaging/README.md).
#
# Usage: bash packaging/generate-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVG="$ROOT/packaging/icon.svg"
OUT="$ROOT/src-tauri/icons"

command -v ffmpeg >/dev/null 2>&1 || {
  echo "generate-icons.sh: ffmpeg not found (needs the librsvg SVG decoder)" >&2
  exit 3
}
# Capture first: `ffmpeg -decoders | grep -q` trips pipefail via SIGPIPE when
# grep exits after the first match.
DECODERS="$(ffmpeg -hide_banner -decoders 2>/dev/null || true)"
grep -q librsvg <<<"$DECODERS" || {
  echo "generate-icons.sh: this ffmpeg build has no librsvg decoder" >&2
  exit 3
}

mkdir -p "$OUT"
render() { # render <size> <output-file>
  ffmpeg -y -loglevel error -i "$SVG" \
    -vf "scale=$1:$1:flags=lanczos" -frames:v 1 -update 1 "$OUT/$2"
  echo "rendered $OUT/$2 ($1x$1)"
}

# Sizes used by the Tauri bundle configuration (tauri.conf.json bundle.icon)
# and the hicolor icon hierarchy of the .deb package.
render 32 32x32.png
render 128 128x128.png
render 256 '128x128@2x.png'
render 1024 icon.png

echo "icons regenerated from packaging/icon.svg"
