#!/usr/bin/env bash
# NF06 resource calibration (T-60; requirements NF06; plan §5.4).
#
# Samples the PSS/RSS of the application process TREE (main + WebKit helpers)
# from /proc, and snapshots `ss -tanp` sockets of the same tree as the
# no-sudo substitute for packet capture (plan §5.5). No sudo, no tcpdump.
#
# Scenarios (release binary, X11 DISPLAY):
#   idle                 no document, settle, then sample
#   open <file>          document via CLI, sample from window appearance
#   matrix               idle + generated 100KiB/1MiB/10MiB corpora
#
# Results are CALIBRATION on this machine (12-core/15GiB, non-reference) and
# are never written as compliance. Raw samples stay under
# artifacts/70-verification/evidence/wp-32/perf/.
#
# Usage: tests/perf/measure-nf06-memory.sh <idle|open <file>|matrix>
# Env: PAPERSTACK_BIN, PS_TOTAL_MS (default 12000), PS_SAMPLE_MS (default 200),
#      PS_SETTLE_MS (default 3000, idle only), DISPLAY
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-}"
FILE="${2:-}"
BIN="${PAPERSTACK_BIN:-$ROOT/src-tauri/target/release/paperstack}"
TOTAL_MS="${PS_TOTAL_MS:-12000}"
SAMPLE_MS="${PS_SAMPLE_MS:-200}"
SETTLE_MS="${PS_SETTLE_MS:-3000}"
EVIDENCE="$ROOT/artifacts/70-verification/evidence/wp-32/perf"
GENERATED="$ROOT/artifacts/70-verification/evidence/generated"
HELPER="$ROOT/tests/perf/proc_tree.py"

mkdir -p "$EVIDENCE" "$ROOT/tests/perf/.bin"

[[ -x "$BIN" ]] || { echo "missing release binary: $BIN" >&2; exit 2; }

build_xwait() {
  local xwait="$ROOT/tests/perf/.bin/xwait"
  if [[ ! -x "$xwait" || "$ROOT/tests/perf/xwait.c" -nt "$xwait" ]]; then
    cc -O2 "$ROOT/tests/perf/xwait.c" -lxdo -lX11 -o "$xwait" || return 1
  fi
  echo "$xwait"
}

close_app() {
  local pid="$1" helper="$ROOT/tests/desktop/xdo-helper" waited=0
  if [[ -x "$helper" ]]; then
    "$helper" close paperstack >/dev/null 2>&1 || true
  fi
  while kill -0 "$pid" 2>/dev/null; do
    sleep 0.05
    waited=$((waited + 50))
    if [[ $waited -ge 8000 ]]; then
      kill -TERM "$pid" 2>/dev/null || true
      sleep 0.5
      kill -KILL "$pid" 2>/dev/null || true
      return 1
    fi
  done
  return 0
}

median() { # numbers on stdin -> median (integer)
  local values=()
  while IFS= read -r value; do values+=("$value"); done
  local n=${#values[@]}
  if [[ $n -eq 0 ]]; then
    echo 0
    return
  fi
  if [[ $((n % 2)) -eq 1 ]]; then
    echo "${values[$((n / 2))]}"
  else
    echo $(( (values[n / 2 - 1] + values[n / 2]) / 2 ))
  fi
}

stats_from_raw() { # raw file: t_ms pss_kb rss_kb procs
  local raw="$1"
  local samples pss_peak rss_peak pss_median
  samples="$(wc -l < "$raw")"
  pss_peak="$(awk '{ if ($2 > max) max = $2 } END { print max + 0 }' "$raw")"
  rss_peak="$(awk '{ if ($3 > max) max = $3 } END { print max + 0 }' "$raw")"
  pss_median="$(awk '{ print $2 }' "$raw" | sort -n | median)"
  printf 'samples=%d pss_peak_kb=%d pss_median_kb=%d rss_peak_kb=%d\n' \
    "$samples" "$pss_peak" "$pss_median" "$rss_peak"
}

run_scenario() { # label file
  local label="$1" file="$2"
  local raw="$EVIDENCE/nf06-$label.raw" sockets="$EVIDENCE/nf06-$label.sockets"
  local xwait pid
  xwait="$(build_xwait)" || { echo "cannot build xwait" >&2; exit 2; }

  if [[ -n "$file" ]]; then
    "$BIN" "$file" >/dev/null 2>&1 &
  else
    "$BIN" >/dev/null 2>&1 &
  fi
  pid=$!
  if ! "$xwait" paperstack 30000 >/dev/null; then
    echo "NF06 $label: window did not appear" >&2
    kill -TERM "$pid" 2>/dev/null || true
    echo "$label,samples=0,pss_peak_kb=NA,pss_median_kb=NA,rss_peak_kb=NA,status=NO_WINDOW" >> "$EVIDENCE/nf06-summary.csv"
    return 1
  fi
  if [[ -z "$file" ]]; then sleep "$(awk -v ms="$SETTLE_MS" 'BEGIN { print ms / 1000 }')"; fi

  python3 "$HELPER" watch "$pid" "$TOTAL_MS" "$SAMPLE_MS" > "$raw"
  python3 "$HELPER" sockets "$pid" > "$sockets" 2> "$sockets.count"
  close_app "$pid" || true

  local summary
  summary="$(stats_from_raw "$raw")"
  local sha
  sha="$(sha256sum "$BIN" | awk '{print $1}')"
  echo "$label,$summary,binary_sha256=$sha,source=${file:-none}" >> "$EVIDENCE/nf06-summary.csv"
  echo "NF06 scenario=$label $summary source=${file:-none}"
  echo "NF06 $label sockets: $(cat "$sockets.count" 2>/dev/null || echo SOCKETS=0) raw=$raw"
  # Every sample must exist for the result to be usable (>=30 requested).
  [[ "$(wc -l < "$raw")" -ge 30 ]]
}

if [[ "$MODE" == "idle" ]]; then
  run_scenario idle ""
elif [[ "$MODE" == "open" ]]; then
  [[ -f "$FILE" ]] || { echo "open needs an existing file" >&2; exit 2; }
  run_scenario "open-$(basename "$FILE" .md)" "$FILE"
elif [[ "$MODE" == "matrix" ]]; then
  echo "scenario,samples,pss_peak_kb,pss_median_kb,rss_peak_kb,binary_sha256,source" > "$EVIDENCE/nf06-summary.csv"
  run_scenario idle "" || true
  for size in 100KiB 1MiB 10MiB; do
    corpus="$GENERATED/corpus-$size.md"
    if [[ ! -f "$corpus" ]]; then
      echo "missing $corpus; run: node tests/perf/generate-corpus.mjs" >&2
      exit 2
    fi
    run_scenario "open-$size" "$corpus" || true
  done
else
  echo "usage: $0 <idle|open <file>|matrix>" >&2
  exit 2
fi
