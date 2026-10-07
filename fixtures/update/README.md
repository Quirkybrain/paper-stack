# Update fixtures

Tiny deterministic inputs for the wp-28 update/anchor flows (T-53..T-55).

| File | Purpose |
|---|---|
| `v1.md` | Base document version. |
| `v2.md` | Changed version sharing one identical anchor paragraph with `v1.md`. |
| `replacement-save.md` | Rename-over replacement-save scenario notes (script steps, expectations). |

The files are intentionally minimal: tests synthesize large documents in memory
instead of committing 10/50MiB corpora, and the real packaged-app save-replace
observation is scheduled for wp-34 (marked UNVERIFIED until then).
