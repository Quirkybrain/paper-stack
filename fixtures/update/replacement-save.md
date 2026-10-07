# Replacement-save scenario (rename-over) — script notes

Deterministic manual/automation notes for the T-55 `appeared` path
(models §2.2(b); contract §7.2–7.4). Keep the fixtures tiny; copy them to a
scratch directory before replacing (never modify `fixtures/` in place).

## Scenario

1. Copy the base fixture to a scratch path and open that copy (never modify
   `fixtures/` in place):

   ```bash
   cp fixtures/update/v1.md /tmp/ps-update-target.md
   ```

2. Simulate an external editor's replacement save (write temp + rename):

   ```bash
   cp fixtures/update/v2.md /tmp/ps-update-target.md.tmp
   mv /tmp/ps-update-target.md.tmp /tmp/ps-update-target.md   # atomic rename-over
   ```

   The watch registration covers both the document file and its parent
   directory, so the rename-over reaches the UI as `appeared`
   (not necessarily `modified`).

3. Expected keep mode:
   - the visible content stays at v1;
   - the non-modal banner shows 文件已有新版本。你正在阅读的内容未改变。
     with 现在更新 / 稍后;
   - no tab is duplicated for the same path.
4. Expected follow mode (active tab, no selection, no inspect drawer):
   - the candidate commits automatically;
   - the paired position message is 已更新，已保持阅读位置 or
     已更新，位置近似恢复 — never an unqualified success.

## Notes

- `v1.md` and `v2.md` share one identical paragraph (the fingerprint anchor)
  and differ elsewhere; the pair is intentionally small and deterministic for
  unit/integration tests.
- Real save-replace observation against the packaged app belongs to wp-34;
  this fixture set only fixes the input bytes.
