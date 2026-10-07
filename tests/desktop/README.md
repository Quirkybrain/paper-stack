# tests/desktop — X11 desktop verification tooling (test-only)

Test tooling for the PaperStack EA-RUN and later desktop acceptance runs
(ADR-010: real app + scripted input + screenshots; implementation plan §5.3).
**None of this is shipped in the application bundle.**

## Prerequisites (this host, verified 2026-10-07)

- X11 session reachable at `DISPLAY=:1` (this machine has no Wayland session).
- `libxdo` headers and library: `/usr/include/xdo.h`, `libxdo.so.3`.
  There is **no `libxdo.pc`** on this host, so the helper is linked without
  pkg-config.
- `cc`, `xwininfo`, `xwd`, `ffmpeg` (there is no `xdotool`/`wmctrl`/`scrot`).
- Project dependencies installed, `pnpm` with the pinned `@tauri-apps/cli`.
- For `run-smoke.sh`: enough time for one release build
  (`pnpm tauri build --no-bundle`).

## xdo-helper

```sh
cc -O2 tests/desktop/xdo-helper.c -lxdo -lX11 -o tests/desktop/xdo-helper
```

The compiled binary is gitignored (`.gitignore` in this directory).

Commands (window class defaults to `paperstack`, the app window instance):

```text
list     [class]                          list matching windows
find     [class]                          print hex window id
geometry [class]                          print id/x/y/w/h/viewable
focus    [class]                          activate + focus, verify X input focus
key      <keyseq> [class]                 verify focus, then send an XTEST key sequence
resize   <w> <h> [class]                  resize the window, wait for the requested size
click    <x> <y> [button] [count] [class] XTEST click at window-relative coordinates
                                          (button 4/5 = wheel up/down)
wait     [class]                          wait up to 60 s for the window to appear
close    [class]                          send WM_DELETE_WINDOW (clean close request)
```

Safety: before any key injection the helper activates/focuses the window and
verifies that the X input focus is the window or one of its descendants; if
verification fails it exits 4 **without sending keys**, so XTEST events cannot
leak into unrelated user windows.

Examples:

```sh
DISPLAY=:1 tests/desktop/xdo-helper focus
DISPLAY=:1 tests/desktop/xdo-helper key ctrl+w
DISPLAY=:1 tests/desktop/xdo-helper click 640 500 5 6   # 6 wheel-down ticks
DISPLAY=:1 tests/desktop/xdo-helper resize 1024 640
```

## screenshot.sh

```sh
tests/desktop/screenshot.sh <out.png> [window-name]
```

Default window name: `纸栈 PaperStack`. Lookup order:
`xwininfo -root -tree` match (first line that is not the `mutter-x11-frames`
frame) → `xwd -id` → `ffmpeg` PNG. If the window cannot be found or `xwd`
fails, a full-root capture is used as a deterministic fallback (noted on
stderr). `DISPLAY_SCREENSHOT` overrides `DISPLAY`.

## run-smoke.sh (one-command EA-RUN reproduction)

```sh
bash tests/desktop/run-smoke.sh
```

What it does:

1. checks prerequisites and rebuilds `xdo-helper` when missing or stale;
2. release build `pnpm tauri build --no-bundle`, records wall time and the
   binary sha256;
3. records the actual system theme and forces the light condition for the run
   (`gsettings set org.gnome.desktop.interface color-scheme prefer-light`,
   original value restored on exit, plus `GTK_THEME=Adwaita:light` for the app
   process; the app itself pins light tokens);
4. launches the release binary with `fixtures/reader-min/reader-min.md` and
   waits for the real window;
5. drives the checks (wheel-scroll through code/task-list/mermaid/image/table,
   one Tab, second instance via CLI handoff, Ctrl+W, 1024×640 resize) and
   captures screenshots into
   `artifacts/70-verification/evidence/early-run/`;
6. terminates the app with a WM_DELETE_WINDOW request and records whether the
   clean close succeeded (fallbacks: second request, SIGTERM, SIGKILL).

Every executed command, its output and exit code are collected in
`artifacts/70-verification/evidence/early-run/runs.log`; build output goes to
`build.log`, app output to `app.log`, the second instance to
`second-instance.log`.

Environment override: `DISPLAY_SMOKE` (default `:1`).

**Screenshots are evidence, not verification.** The EA-RUN report
(`artifacts/70-verification/early-run.md`) records item-by-item visual
observations; items that could not be executed are marked `UNVERIFIED`.

## Acceptance runs and fixed-item re-runs (wp-34 / wp-34b / wp-34d)

`acceptance-lib.sh` provides the shared driver helpers (isolated
`XDG_DATA_HOME`, controlled launch/termination, scripted input, screenshots,
DB snapshots). The group scripts `run-at-a.sh` … `run-at-e.sh` drive AT01–AT30
(wp-34 acceptance, evidence `evidence/at/`), `run-at-rerun{1,1b,2,3,3b,4}.sh`
re-ran the fixed items for wp-34b (evidence `evidence/at-rerun/`), and the
unified wp-34d driver re-runs the residual AT19/26/28 defects on the wp-34c
binary:

```sh
bash tests/desktop/run-at-rerun-wp34d.sh [at19|at26|at28|regression|all]
# evidence: artifacts/70-verification/evidence/at-rerun2/
```

Helpers used by the recovery paths:

- `find-gtk-accept.py` — locates the GTK file-chooser accept button in a root
  screenshot (accent-blue blob) so save-dialog closure can be verified
  visually instead of by window-tree timing.
- `find-app-button.py` — locates an in-app button by design-token colour
  (`accent` #176b5b / `danger` #b42318) in a client screenshot; used for the
  export preview's 选择保存位置 and the overwrite confirmation's 确定.
- `run-at-rerun-wp34d.sh` additionally isolates `XDG_CACHE_HOME` per scenario
  and preserves the overwritten/case-B export bytes as evidence.

## Known limitations

- X11 only. libxdo/XTEST do not work on Wayland, and this host has no Wayland
  session (Wayland checks stay `UNVERIFIED`, ADR-010).
- Input injection drives the currently focused window; the helper verifies the
  focus target before injecting keys, but runs must not be interleaved with
  other interactive work on the same display.
- Window resize depends on window-manager support (mutters honors it here);
  `resize` exits 5 if the requested size is not reached and the script records
  the actual geometry.
- File-dialog interactions (Open file/directory pickers) are not automated.
- Screenshot fallback captures the whole root window, including any other
  windows on the desktop; inspect the stderr note when it fires.
- ImageMagick (`identify`) is optional and not required.
