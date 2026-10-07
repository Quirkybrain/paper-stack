#!/usr/bin/env bash
# run-at-final-probes.sh — wp-42 at-final supplementary probes for acceptance
# sub-paths that the classic group scripts do not exercise: AT11 second-block
# and folded-block copy byte checks (wp-34 fix2/fix4a sequences) and AT21's
# "稍后" (later) collapse path (wp-34 fix4a sequence). Same binary, same
# AT_EVIDENCE=at-final fixed conditions as run-at-final.sh; run after the main
# batch (the app must not be running).
#
# Usage: bash tests/desktop/run-at-final-probes.sh [at11|at21|all]
set -uo pipefail
AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-final}"
export AT_EVIDENCE
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
ensure_helper
fix_conditions

# ---- AT11: first/second/folded code-block copy byte evidence --------------
section_at11() {
  AT_GROUP=at11fp
  group_header "AT11 copy probes (first + second + folded blocks)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at11fp"

  reset_data
  launch_app "$FIXTURES/rendering/code.md"
  # wait for the pipeline to finish rendering (the parse placeholder must be
  # gone before the hover/click sequence; the first probe raced it)
  sleep 4
  shot "at11-fp-a-rendered.png"
  run "$HELPER" click 640 350
  sleep 0.8
  shot "at11-fp-a-hover.png"
  # first C block copy action (same coordinate family as run-at-c)
  set_clip "PROBE-SENTINEL"
  click 866 278
  sleep 0.8
  get_clip >"$EVIDENCE/at11-fp-clip-c.txt" 2>/dev/null || true
  log "AT11 fp first-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-fp-clip-c.txt")"
  od -c "$EVIDENCE/at11-fp-clip-c.txt" >>"$RUNS"
  # second (C++) block copy action (wp-34 fix2 discovery coordinate)
  set_clip "PROBE-SENTINEL"
  click 866 397
  sleep 0.8
  get_clip >"$EVIDENCE/at11-fp-clip-cpp.txt" 2>/dev/null || true
  log "AT11 fp second-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-fp-clip-cpp.txt")"
  od -c "$EVIDENCE/at11-fp-clip-cpp.txt" >>"$RUNS"
  # folded 45-line block: scroll to bottom, back up, hover, copy while folded
  wheel 640 400 5 30
  sleep 1
  shot "at11-fp-b-fold-end.png"
  wheel 640 400 4 6
  sleep 1
  shot "at11-fp-c-fold-top.png"
  run "$HELPER" click 640 350
  sleep 0.8
  shot "at11-fp-d-fold-hover.png"
  set_clip "PROBE-SENTINEL"
  click 715 155
  sleep 0.8
  get_clip >"$EVIDENCE/at11-fp-clip-fold.txt" 2>/dev/null || true
  log "AT11 fp folded-block clipboard bytes=$(wc -c < "$EVIDENCE/at11-fp-clip-fold.txt") lines=$(wc -l < "$EVIDENCE/at11-fp-clip-fold.txt")"
  terminate_app
}

# ---- AT21: banner -> 现在更新, second banner -> 稍后 collapse --------------
section_at21() {
  AT_GROUP=at21fp
  group_header "AT21 later-collapse probe"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at21fp"

  reset_data
  A21="$INPUTS/at21-fp"
  mkdir -p "$A21"
  cp "$FIXTURES/update/v1.md" "$A21/doc.md"
  launch_app "$A21/doc.md"
  sleep 1.5
  shot "at21-fp-a-v1.png"
  printf '\n新增段落：v2 已写入。\n' >>"$A21/doc.md"
  sleep 3
  shot "at21-fp-b-banner.png"
  click 1089 113   # 现在更新
  sleep 2
  shot "at21-fp-c-updated.png"
  printf '\n再次追加：v3。\n' >>"$A21/doc.md"
  sleep 3
  shot "at21-fp-d-banner2.png"
  click 1213 113   # 稍后
  sleep 1
  shot "at21-fp-e-later-collapsed.png"
  terminate_app
}

case "${1:-all}" in
  at11) section_at11 ;;
  at21) section_at21 ;;
  all)  section_at11; section_at21 ;;
  *) echo "usage: $0 [at11|at21|all]" >&2; exit 2 ;;
esac

group_footer
