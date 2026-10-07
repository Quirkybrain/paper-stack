#!/usr/bin/env bash
# run-at-rerun-wp38.sh — wp-38 revision-4 re-run driver on the wp-35a (Rust)
# + wp-36a (frontend) fixed release binary (evidence:
# artifacts/70-verification/evidence/at-rerun3/).
#
# Fixed conditions (same as wp-34/34b/34d): X11 DISPLAY=:1, light GTK_THEME,
# text-scaling 1.25, isolated XDG_DATA_HOME (per scenario) + isolated
# XDG_CACHE_HOME (per section).
#
# Sections (Review A §10.3 + Review B §9.1 affected desktop items):
#   at02 — directory tree on the auth-gated read_directory (normal scans +
#          symlink/empty/no-permission rows).
#   at06 — session restore / recents / preference-off, plus the NEW A-01
#          behavior: a revoked grant is NOT re-granted by restore.
#   at09 — sanitization after the D-3 schema removal: script stripped, math
#          still renders (KaTeX), macro bomb isolated, mermaid cap.
#   at12 — Mermaid routing through the single trusted-HTML entry (render,
#          error/pie fallback, zoom overlay).
#   at14 — outline jump to duplicate headings (unchanged behavior).
#   at15 — in-page fragments + footnote references/back-refs (B-02), missing
#          fragment notice.
#   at16 — per-tab history around footnote and fragment navigation (B-02).
#   at25 — authorization dialogs + revoke effect: directory scan denied after
#          revoke (A-02).
#   at27 — explicit clear of recents/session/authorizations + write-back
#          suppression.
#   at30 — About page key resolution (D-34-1) + DocumentInfoPanel basics
#          (B-04) + no-placeholder scan.
#   suite — `pnpm test -- --run` (expect 547) and the i18n guard.
#
# Usage: bash tests/desktop/run-at-rerun-wp38.sh [at02|at06|at09|at12|at14|at15|at16|at25|at27|at30|suite|all]
AT_EVIDENCE="${AT_EVIDENCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/artifacts/70-verification/evidence/at-rerun3}"
export AT_EVIDENCE
source "$(dirname "${BASH_SOURCE[0]}")/acceptance-lib.sh"
ensure_helper
fix_conditions

# dump_grants <tag>: read-only authorizations snapshot appended to runs.log.
dump_grants() {
  local tag="$1"
  printf '\n== authorizations dump [%s] %s ==\n' "$tag" "$(db_path)" >>"$RUNS"
  python3 - "$(db_path)" >>"$RUNS" 2>&1 <<'PY'
import sqlite3, sys
con = sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
try:
    rows = con.execute(
        'select grant_id, kind, canonical_path, scope, origins_json from authorizations order by granted_at'
    ).fetchall()
except Exception as exc:
    print(f'-- authorizations: ERR {exc}')
    raise SystemExit
print(f'-- authorizations: {len(rows)}')
for row in rows:
    print('  ', row)
PY
}

# ---------------------------------------------------------------- AT02 ------
section_at02() {
  AT_GROUP=at02r4
  group_header "AT02 directory tree after auth-gated read_directory (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at02"

  mkdir -p "$INPUTS/at02/dir2/sub-empty" "$INPUTS/at02/dir2/plain"
  cp "$FIXTURES/rendering/math.md" "$INPUTS/at02/dir2/plain/note.md"
  mkdir -p "$INPUTS/at02/noperm"

  reset_data
  launch_app
  open_picker_dir
  confirm_picker_path "$FIXTURES/tree/root"
  key ctrl+b
  sleep 1
  shot "at02-r4-a-tree-root.png"
  click 100 465
  sleep 1
  shot "at02-r4-b-sub-expanded.png"
  click 100 559
  sleep 1
  shot "at02-r4-c-deep-expanded.png"
  click 100 602
  sleep 1.5
  shot "at02-r4-d-open-c-md.png"
  terminate_app

  # symlink status rows (broken / outside scope) in the root listing
  launch_app
  open_picker_dir
  confirm_picker_path "$FIXTURES/tree/root"
  key ctrl+b
  sleep 1
  click 100 273
  sleep 1
  shot "at02-r4-e-link-broken.png"
  click 100 422
  sleep 1
  shot "at02-r4-f-link-outside.png"
  terminate_app

  # empty subdirectory
  reset_data
  launch_app
  open_picker_dir
  confirm_picker_path "$INPUTS/at02/dir2"
  key ctrl+b
  sleep 1
  shot "at02-r4-g-dir2.png"
  click 100 228
  sleep 1
  shot "at02-r4-h-empty-subdir.png"
  terminate_app

  # unreadable directory -> PS_IO_PERMISSION banner
  reset_data
  chmod 000 "$INPUTS/at02/noperm"
  launch_app
  open_picker_dir
  confirm_picker_path "$INPUTS/at02/noperm"
  key ctrl+b
  sleep 1
  shot "at02-r4-i-no-permission.png"
  terminate_app
  chmod 755 "$INPUTS/at02/noperm"
}

# ---------------------------------------------------------------- AT06 ------
section_at06() {
  AT_GROUP=at06r4
  group_header "AT06 restore/recents + revoked grant not re-granted (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at06"

  # -- Normal restore / recents / preference-off --------------------------
  reset_data
  launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
  sleep 1.5
  shot "at06-r4-a-two-tabs-math-active.png"
  key ctrl+Tab
  sleep 1
  shot "at06-r4-b-tables-active.png"
  sleep 2.5
  terminate_app
  db_dump "AT06r4 after first clean exit (expect session_tabs=2, recents=2)"

  launch_app
  sleep 3.5
  shot "at06-r4-c-restored-session.png"
  terminate_app
  db_dump "AT06r4 after restore exit"

  # preference off -> welcome page, recents still listed
  launch_app
  sleep 2
  key ctrl+comma
  sleep 1
  shot "at06-r4-d-settings-reading.png"
  wheel 600 500 5 4
  sleep 1
  shot "at06-r4-e-settings-scrolled.png"
  click 540 634
  sleep 1.2
  shot "at06-r4-f-pref-toggled-off.png"
  key Escape
  sleep 0.8
  terminate_app
  db_dump "AT06r4 settings after preference toggle (expect startup.restoreSession=false)"

  launch_app
  sleep 3.5
  shot "at06-r4-g-pref-off-welcome-recents.png"
  terminate_app
  db_dump "AT06r4 after preference-off relaunch"
}

# AT06 revoke continuation is a separate function so the revoke step can be
# re-driven independently once its coordinates are pinned.
section_at06_revoke() {
  AT_GROUP=at06r4
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at06"
  reset_data
  A6="$INPUTS/at06-r4"
  mkdir -p "$A6"
  cp "$FIXTURES/rendering/math.md" "$A6/doc.md"
  launch_app "$A6/doc.md"
  sleep 2
  shot "at06-r4-h-doc-loaded.png"
  dump_grants "AT06r4 after explicit open (expect 1 persistent file grant)"
  key ctrl+comma
  sleep 1
  click 278 303
  sleep 1
  wheel 600 500 5 6
  sleep 1
  shot "at06-r4-i-privacy-grants.png"
  # revoke button of the only persistent grant (first grants row, x≈1035)
  click "${AT06_REVOKE_X:-1035}" "${AT06_REVOKE_Y:-596}"
  sleep 1.5
  shot "at06-r4-j-revoked-notice.png"
  key Escape
  sleep 1
  terminate_app
  dump_grants "AT06r4 after revoke exit (expect 0 grants)"
  launch_app
  sleep 4
  shot "at06-r4-k-restore-unavailable.png"
  # retry keeps the tab unavailable (entry='restore' stays a lifecycle event)
  click "${AT06_RETRY_X:-1082}" "${AT06_RETRY_Y:-113}"
  sleep 2.5
  shot "at06-r4-l-retry-still-unavailable.png"
  terminate_app
  dump_grants "AT06r4 after restore+retry (expect still 0 grants)"
  db_dump "AT06r4 after revoked restore"
}

# ---------------------------------------------------------------- AT09 ------
section_at09() {
  AT_GROUP=at09r4
  group_header "AT09 sanitization after D-3 removal (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at09"

  reset_data
  launch_app "$FIXTURES/security/malicious.md"
  sleep 2.5
  # block the aggregate local-resource dialog (Escape = 保持阻止; retried until
  # the pixel probe confirms the overlay is gone)
  dismiss_modal "at09-r4-a-local-prompt" 4
  sleep 1
  shot "at09-r4-b-top.png"
  wheel 640 400 5 3
  sleep 1
  shot "at09-r4-c-mid.png"
  wheel 640 400 5 6
  sleep 1
  shot "at09-r4-d-macro.png"
  wheel 640 400 5 6
  sleep 1
  shot "at09-r4-e-mermaid-overflow.png"
  wheel 640 400 5 10
  sleep 1
  shot "at09-r4-f-bottom.png"
  terminate_app

  # math must still render under the strict §5.2 schema (D-3 removal, B-10);
  # the same doc carries a script that must be stripped.
  reset_data
  A9="$INPUTS/at09-r4"
  mkdir -p "$A9"
  {
    printf '# Math + script after D-3 removal\n\n'
    printf '<script>window.__pwned = true; alert("should not run")</script>\n\n'
    printf 'Inline math: $x^2 + y^2 = z^2$ and $\\alpha$.\n\n'
    printf '$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$\n\n'
    printf 'Trailing text so the paragraph is visible.\n'
  } >"$A9/doc.md"
  launch_app "$A9/doc.md"
  sleep 2.5
  shot "at09-r4-g-math-script.png"
  terminate_app
}

# ---------------------------------------------------------------- AT12 ------
section_at12() {
  AT_GROUP=at12r4
  group_header "AT12 Mermaid via the single trusted-HTML entry (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at12"

  reset_data
  launch_app "$FIXTURES/rendering/mermaid.md"
  sleep 2.5
  shot "at12-r4-a-flowchart.png"
  wheel 640 400 5 5
  sleep 1
  shot "at12-r4-b-sequence.png"
  wheel 640 400 5 5
  sleep 1
  shot "at12-r4-c-class.png"
  wheel 640 400 5 5
  sleep 1
  shot "at12-r4-d-error-pie.png"
  # zoom overlay exercises the second injection site (enlarged layer)
  wheel 640 400 4 20
  sleep 1.5
  shot "at12-r4-e-top.png"
  click 373 248
  sleep 1.5
  shot "at12-r4-f-zoom-overlay.png"
  key Escape
  sleep 1
  shot "at12-r4-g-zoom-closed.png"
  terminate_app
}

# ---------------------------------------------------------------- AT14 ------
section_at14() {
  AT_GROUP=at14r4
  group_header "AT14 outline duplicate-heading jumps (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at14"

  reset_data
  launch_app "$FIXTURES/rendering/links.md"
  sleep 1.5
  shot "at14-r4-a-top.png"
  key ctrl+b
  sleep 1
  shot "at14-r4-b-outline.png"
  wheel 640 400 5 10
  sleep 1
  shot "at14-r4-c-scrolled.png"
  click 139 229
  sleep 1.5
  key ctrl+b
  sleep 1
  shot "at14-r4-d-after-outline-1.png"
  key ctrl+b
  sleep 1
  click 139 278
  sleep 1.5
  key ctrl+b
  sleep 1
  shot "at14-r4-e-after-outline-2.png"
  terminate_app
}

# ---------------------------------------------------------------- AT15 ------
section_at15() {
  AT_GROUP=at15r4
  group_header "AT15 fragments + footnote back-refs (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at15"

  # -- existing links.md fragment behavior --------------------------------
  reset_data
  launch_app "$FIXTURES/rendering/links.md"
  sleep 1.5
  wheel 640 400 4 20
  sleep 1.5
  shot "at15-r4-a-top.png"
  click 300 418
  sleep 1.5
  shot "at15-r4-b-fragment-jump.png"
  wheel 640 400 4 20
  sleep 1.5
  click 630 418
  sleep 1.5
  shot "at15-r4-c-missing-fragment-notice.png"
  click 1207 108
  sleep 1
  wheel 640 400 4 20
  sleep 1.5
  click 300 573
  sleep 1.5
  shot "at15-r4-d-page-internal-jump.png"
  terminate_app

  # -- footnote reference -> note -> back-ref (B-02) ----------------------
  reset_data
  A15="$INPUTS/at15-r4"
  mkdir -p "$A15"
  write_footnote_doc "$A15/footnotes.md"
  launch_app "$A15/footnotes.md"
  sleep 2
  shot "at15-r4-e-footnote-top.png"
  # click the first superscript reference (coordinates pinned from the shot)
  click "${AT15_REF1_X:-367}" "${AT15_REF1_Y:-171}"
  sleep 1.5
  shot "at15-r4-f-note-from-ref1.png"
  # click the first back-ref (↩) in the footnote section
  click "${AT15_BACK1_X:-640}" "${AT15_BACK1_Y:-730}"
  sleep 1.5
  shot "at15-r4-g-backref1-return.png"
  # second reference -> note -> second back-ref
  wheel 640 400 4 20
  sleep 1.5
  click "${AT15_REF2_X:-367}" "${AT15_REF2_Y:-233}"
  sleep 1.5
  shot "at15-r4-h-note-from-ref2.png"
  click "${AT15_BACK2_X:-672}" "${AT15_BACK2_Y:-730}"
  sleep 1.5
  shot "at15-r4-i-backref2-return.png"
  terminate_app
}

# write_footnote_doc <path>: footnote sample with enough filler paragraphs
# that the footnote section sits below the fold (so ref/back-ref navigation
# is observable as a scroll).
write_footnote_doc() {
  local path="$1" i
  {
    printf '# 脚注样例\n\n'
    printf '第一处引用在这里[^one]。\n\n'
    printf '第二处引用在这里[^one]。\n\n'
    for i in $(seq 1 16); do
      printf '填充段落 %s，用于把脚注区推到首屏之外。\n\n' "$i"
    done
    printf '[^one]: 脚注正文。点击回引应返回对应引用处。\n'
  } >"$path"
}

# ---------------------------------------------------------------- AT16 ------
section_at16() {
  AT_GROUP=at16r4
  group_header "AT16 history around footnote navigation (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at16"

  reset_data
  A15="$INPUTS/at15-r4"
  mkdir -p "$A15"
  write_footnote_doc "$A15/footnotes.md"
  launch_app "$A15/footnotes.md"
  sleep 2
  shot "at16-r4-a-top.png"
  click "${AT15_REF1_X:-367}" "${AT15_REF1_Y:-171}"
  sleep 1.5
  shot "at16-r4-b-footnote-jump.png"
  key alt+Left
  sleep 1.5
  shot "at16-r4-c-back-to-ref.png"
  key alt+Right
  sleep 1.5
  shot "at16-r4-d-forward-again.png"
  key alt+Left
  sleep 1.5
  # second ref -> back-ref -> then history back/forward
  wheel 640 400 4 20
  sleep 1.5
  click "${AT15_REF2_X:-367}" "${AT15_REF2_Y:-233}"
  sleep 1.5
  shot "at16-r4-e-ref2-jump.png"
  key alt+Left
  sleep 1.5
  shot "at16-r4-f-back-after-ref2.png"
  terminate_app
}

# ---------------------------------------------------------------- AT25 ------
section_at25() {
  AT_GROUP=at25r4
  group_header "AT25 auth dialogs + revoke effect on directory scan (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at25"

  reset_data
  launch_app "$FIXTURES/reader-min/reader-min.md"
  sleep 3
  shot "at25-r4-a-aggregate-prompt.png"
  # deny (Escape = 保持阻止; first synthetic click may be swallowed) until the
  # overlay is pixel-verified gone -> placeholder stays
  dismiss_modal "at25-r4-b-deny" 4
  sleep 1
  shot "at25-r4-b-denied-placeholder.png"

  # open a directory: the picker creates the session-scoped root used by the
  # file tree (no persistent directory grant exists in the settings list)
  open_picker_dir
  confirm_picker_path "$FIXTURES/tree/root"
  key ctrl+b
  sleep 1.5
  shot "at25-r4-c-nav-panel.png"
  # the nav panel may default to 大纲; select the 文件 (tree) tab
  click 37 113
  sleep 1
  shot "at25-r4-c2-tree-granted.png"

  # revoke the persistent file grant through 设置 -> 隐私
  key ctrl+comma
  sleep 1
  click 278 303
  sleep 1
  wheel 600 500 5 12
  sleep 1.5
  shot "at25-r4-d-grants-list.png"
  click "${AT25_REVOKE_X:-1035}" "${AT25_REVOKE_Y:-617}"
  sleep 1.5
  shot "at25-r4-e-revoked-notice.png"

  # clear the remaining authorizations (directory session grant) explicitly
  click "${AT25_CLEAR_BTN_X:-511}" "${AT25_CLEAR_BTN_Y:-504}"
  sleep 1.5
  shot "at25-r4-f0-clear-dialog.png"
  wheel 640 480 5 6
  sleep 1
  shot "at25-r4-f1-clear-dialog-scrolled.png"
  click "${AT25_AUTH_CB_X:-233}" "${AT25_AUTH_CB_Y:-430}"
  sleep 0.5
  shot "at25-r4-f2-auth-selected.png"
  click "${AT25_CONFIRM_X:-386}" "${AT25_CONFIRM_Y:-662}"
  sleep 2.5
  shot "at25-r4-f3-clear-results.png"
  click "${AT25_RESULT_CLOSE_X:-257}" "${AT25_RESULT_CLOSE_Y:-551}"
  sleep 1
  key Escape
  sleep 1.5
  shot "at25-r4-g-back-to-reader.png"
  # expand `sub` for a NEW scan -> must be denied by the auth gate
  click 37 113
  sleep 0.5
  shot "at25-r4-g2-tree-before-expand.png"
  click 100 465
  sleep 1.5
  shot "at25-r4-h-scan-denied.png"
  # retry stays denied
  click "${AT25_RETRY_X:-302}" "${AT25_RETRY_Y:-503}"
  sleep 1.5
  shot "at25-r4-i-retry-denied.png"
  # control: an explicit re-open of the directory re-establishes the grant
  # and the same 重试 then loads the listing
  open_picker_dir
  confirm_picker_path "$FIXTURES/tree/root"
  sleep 1
  click 37 113
  sleep 1
  click "${AT25_RETRY_X:-302}" "${AT25_RETRY_Y:-503}"
  sleep 1.5
  shot "at25-r4-j-reopen-regranted.png"
  dump_grants "AT25r4 after explicit directory re-open (expect session directory grant)"
  terminate_app
}

# ---------------------------------------------------------------- AT27 ------
section_at27() {
  AT_GROUP=at27r4
  group_header "AT27 explicit clear incl. authorizations + suppression (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at27"

  reset_data
  # seed: two documents (session/recents/positions/2 file grants)
  launch_app "$FIXTURES/rendering/math.md" "$FIXTURES/rendering/tables.md"
  sleep 1.5
  terminate_app
  # seed: one directory grant
  launch_app
  open_picker_dir
  confirm_picker_path "$FIXTURES/tree/root"
  sleep 1.5
  terminate_app
  db_dump "AT27r4 seed state"
  dump_grants "AT27r4 seed (expect 2 file + 1 directory grants)"

  launch_app
  sleep 3
  key ctrl+comma
  sleep 1
  click 278 303
  sleep 1
  shot "at27-r4-a-privacy-usage.png"
  # open the clear dialog (button below the usage list, unscrolled view)
  click "${AT27_CLEAR_BTN_X:-511}" "${AT27_CLEAR_BTN_Y:-622}"
  sleep 1.5
  shot "at27-r4-b-clear-dialog.png"
  # select 最近阅读 and 位置与会话 in the unscrolled dialog
  click 233 "${AT27_RECENTS_CB_Y:-291}"
  sleep 0.4
  click 233 "${AT27_POSSESSION_CB_Y:-411}"
  sleep 0.5
  shot "at27-r4-c-selected-top.png"
  # scroll to the 授权 row and select it
  wheel 640 480 5 6
  sleep 1
  shot "at27-r4-d-dialog-scrolled.png"
  click "${AT27_AUTH_CB_X:-233}" "${AT27_AUTH_CB_Y:-407}"
  sleep 0.5
  shot "at27-r4-e-auth-selected.png"
  # confirm (danger button in the dialog footer)
  click "${AT27_CONFIRM_X:-386}" "${AT27_CONFIRM_Y:-662}"
  sleep 3
  shot "at27-r4-f-clear-results.png"
  # close the result panel (button sits below the per-category result list)
  click "${AT27_CLOSE_X:-257}" "${AT27_CLOSE_Y:-663}"
  sleep 1.5
  shot "at27-r4-g-after-clear.png"
  key Escape
  sleep 1
  terminate_app
  db_dump "AT27r4 after clear+exit (expect recents/session/positions 0)"
  dump_grants "AT27r4 after clear (expect 0 grants)"
  # fresh relaunch: nothing restored, no recents
  launch_app
  sleep 3
  shot "at27-r4-h-relaunch-welcome.png"
  terminate_app
}

# ---------------------------------------------------------------- AT30 ------
section_at30() {
  AT_GROUP=at30r4
  group_header "AT30 About + DocumentInfoPanel + placeholder scan (wp-38)"
  export LAUNCH_ENV="XDG_CACHE_HOME=$EVIDENCE/cache-at30"

  reset_data
  launch_app
  sleep 1.5
  shot "at30-r4-a-welcome.png"
  click 1245 26
  sleep 0.8
  # more menu order (wp-36a B-05): 查看源码, 更新行为, 关闭文档, 设置, 关于
  key Down
  key Down
  key Down
  key Down
  key Down
  key Return
  sleep 1.5
  shot "at30-r4-b-about.png"
  click 499 579
  sleep 1
  shot "at30-r4-c-license-viewer.png"
  key Escape
  sleep 0.8
  key Escape
  sleep 1

  # DocumentInfoPanel: open a document through the picker, then click the
  # filename button in the toolbar.
  open_picker_file
  confirm_picker_path "$FIXTURES/rendering/math.md"
  sleep 2.5
  shot "at30-r4-d-reader.png"
  click "${AT30_FILENAME_X:-280}" "${AT30_FILENAME_Y:-33}"
  sleep 1.5
  shot "at30-r4-e-document-info.png"
  # explicit close button (X) of the popover; the trigger keeps focus
  click "${AT30_INFO_CLOSE_X:-661}" "${AT30_INFO_CLOSE_Y:-91}"
  sleep 1
  shot "at30-r4-f-info-closed.png"
  terminate_app

  # DR-07: no v1 placeholder / coming-soon entries in shipped source
  {
    echo "== placeholder / coming-soon scan (production sources) =="
    grep -rniE "coming soon|敬请期待|即将推出|建设中|under construction" \
      "$ROOT/src" --include=*.ts --include=*.tsx | grep -v "\.test\." || echo "NO MATCHES"
  } >"$EVIDENCE/at30-r4-placeholder-scan.txt" 2>&1
  log "AT30 placeholder scan: $(tr '\n' ' ' <"$EVIDENCE/at30-r4-placeholder-scan.txt")"
}

# ---------------------------------------------------------------- suite -----
section_suite() {
  AT_GROUP=suite
  group_header "frontend suite + i18n guard on the wp-38 revision"
  run_out "$EVIDENCE/unit-suite-r4.log" pnpm test -- --run
  grep -E "Test Files|Tests " "$EVIDENCE/unit-suite-r4.log" | tail -4 | tee -a "$RUNS"
}

case "${1:-all}" in
  at02) section_at02 ;;
  at06) section_at06 ;;
  at06-revoke) section_at06_revoke ;;
  at09) section_at09 ;;
  at12) section_at12 ;;
  at14) section_at14 ;;
  at15) section_at15 ;;
  at16) section_at16 ;;
  at25) section_at25 ;;
  at27) section_at27 ;;
  at30) section_at30 ;;
  suite) section_suite ;;
  all)
    section_at02
    section_at06
    section_at06_revoke
    section_at09
    section_at12
    section_at14
    section_at15
    section_at16
    section_at25
    section_at27
    section_at30
    section_suite
    ;;
  *)
    echo "usage: $0 [at02|at06|at06-revoke|at09|at12|at14|at15|at16|at25|at27|at30|suite|all]" >&2
    exit 2
    ;;
esac

group_footer
