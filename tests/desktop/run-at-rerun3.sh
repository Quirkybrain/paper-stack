#!/usr/bin/env bash
# run-at-rerun3.sh — wp-34b re-runs: AT26 (remote image WITH path; blocked
# default; session-allow flow against a reachable host), AT28 (export
# protection in the error state and with a registered document; non-source
# target writes), AT30 (About legal text, no raw i18n keys).
# Isolated data per scenario group (no session restore across groups).
AT_GROUP=rerun3
export AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun}"
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
group_header "AT26 + AT28 + AT30 re-runs (wp-34b)"
ensure_helper
fix_conditions

# app_sockets <outfile>: process-tree socket lines for the app binary.
app_sockets() {
  local out="$1"
  ps -eo pid,args | grep -F "$APP_BIN" | grep -v grep | awk '{print $1}' >"$out.pids"
  : >"$out"
  local pid
  for pid in $(cat "$out.pids"); do
    ss -tanp 2>/dev/null | grep "pid=$pid," >>"$out" || true
  done
  log "$(basename "$out"): $(wc -l <"$out") socket lines (pids: $(tr '\n' ' ' <"$out.pids"))"
}

# ================================================================ AT26 =====
# The confirmation dialog auto-opens for the first blocked remote resource;
# block it once to capture the placeholder-only state, then re-open and allow.
reset_data
A26="$INPUTS/at26"
mkdir -p "$A26"
printf '# Remote with path\n\n![remote png](https://httpbin.org/image/png)\n' >"$A26/remote-path.md"
timeout 10 curl -sI https://httpbin.org/image/png -o /dev/null -w "curl httpbin /image/png: %{http_code}\n" >>"$RUNS" 2>&1 || true
launch_app "$A26/remote-path.md"
sleep 3.5
shot "at26-r2-a-blocked-with-path-dialog.png"
app_sockets "$EVIDENCE/at26-r2-sockets-blocked.txt"
click 279 487    # 保持阻止
sleep 1.5
shot "at26-r2-b-blocked-placeholder.png"
click 260 260    # 了解连接范围 on the placeholder (re-prompt)
sleep 1.5
shot "at26-r2-c-confirm-dialog.png"
click 449 487    # 本次文档允许加载
sleep 4
shot "at26-r2-d-after-allow.png"
app_sockets "$EVIDENCE/at26-r2-sockets-after.txt"
terminate_app

# ================================================================ AT28 =====
A28="$INPUTS/at28b"
mkdir -p "$A28"
# Case A: main document in an error state; export to its own source directory.
reset_data
launch_app "$FIXTURES/encoding/latin1.md"
sleep 2
shot "at28-r2-a-error.png"
click 1130 107   # 诊断
sleep 1.5
shot "at28-r2-b-panel.png"
click 449 511    # 导出诊断 (focus, then activate by keyboard)
sleep 0.5
key space
sleep 1.5
shot "at28-r2-c-preview.png"
click 384 637    # 选择保存位置 (opens the GTK save dialog)
sleep 1.5
set_clip "$FIXTURES/encoding/probe-out.txt"
key ctrl+l
sleep 0.8
key ctrl+v
sleep 0.8
key Return
sleep 2.5
shot "at28-r2-d-protected-blocked.png"
find "$FIXTURES/encoding" -maxdepth 1 -name 'probe-out*' | tee -a "$RUNS"
log "AT28 case A protected-target files found: $(find "$FIXTURES/encoding" -maxdepth 1 -name 'probe-out*' | wc -l)"
# Observed: the command-level rejection surfaces as an overwrite confirmation
# (new finding wp-34b). Complete the confirm path to show protection holds.
wheel 640 500 5 3
sleep 1
shot "at28-r2-d2-overwrite-buttons.png"
click 350 623    # 确定 (overwrite confirm)
sleep 2.5
shot "at28-r2-d3-after-overwrite-confirm.png"
find "$FIXTURES/encoding" -maxdepth 1 -name 'probe-out*' | tee -a "$RUNS"
log "AT28 case A files after overwrite confirm: $(find "$FIXTURES/encoding" -maxdepth 1 -name 'probe-out*' | wc -l)"
# Case B: non-source target writes fine (same still-open preview dialog).
click 384 637
sleep 1.5
set_clip "$A28/out.txt"
key ctrl+l
sleep 0.8
key ctrl+v
sleep 0.8
key Return
sleep 2.5
shot "at28-r2-e-nonsource-success.png"
find "$A28" -type f | tee -a "$RUNS"
find "$A28" -type f -exec sha256sum {} + >>"$RUNS" 2>&1 || true
key Escape
sleep 0.8
terminate_app
rm -rf "$A28"

# Case C: registered document + error document; export to the registered
# document's source directory must be rejected.
reset_data
launch_app "$FIXTURES/rendering/math.md"
sleep 1.5
run_out "$EVIDENCE/second-rerun3-latin1.log" timeout 30 "$APP_BIN" "$FIXTURES/encoding/latin1.md"
sleep 2.5
shot "at28-r2-f-two-docs-latin1-active.png"
click 1130 107   # 诊断 on the active error tab
sleep 1.5
# The panel lists two entries for this scenario; its 导出诊断 button sits at
# y≈681 (measured from at28-probe-5-panel-C.png).
click 449 681
sleep 0.5
key space
sleep 1.5
shot "at28-r2-g-preview-registered.png"
# The preview lists the registered document (documents count=1), so the
# action row sits lower than Case A: 选择保存位置 centred at (384,723).
click 384 723
sleep 1.5
set_clip "$FIXTURES/rendering/probe-out.txt"
key ctrl+l
sleep 0.8
key ctrl+v
sleep 0.8
key Return
sleep 2.5
# The blocked notice renders below the fold; scroll the modal to reveal it.
wheel 640 400 5 4
sleep 1
shot "at28-r2-h-registered-blocked.png"
find "$FIXTURES/rendering" -maxdepth 1 -name 'probe-out*' | tee -a "$RUNS"
log "AT28 case C protected-target files found: $(find "$FIXTURES/rendering" -maxdepth 1 -name 'probe-out*' | wc -l)"
terminate_app

# ================================================================ AT30 =====
reset_data
launch_app
sleep 1.5
click 1245 26
sleep 0.7
key Down
key Down
key Down
key Return
sleep 1.5
shot "at30-r2-a-about.png"
click 499 579   # 查看许可证 (adjust if the translated source note shifts it)
sleep 1.2
shot "at30-r2-b-license-viewer.png"
key Escape
sleep 0.5
terminate_app

group_footer
