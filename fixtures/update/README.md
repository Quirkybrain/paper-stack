# Update fixtures

Tiny deterministic inputs for the wp-28 update/anchor flows (T-53..T-55) and
the fixed update scenarios (T-59).

| File | Purpose |
|---|---|
| `v1.md` | Base document version. |
| `v2.md` | Changed version sharing one identical anchor paragraph with `v1.md`. |
| `replacement-save.md` | Rename-over replacement-save scenario notes (script steps, expectations). |
| `repeated-blocks.md` | Shared anchor text appears twice → fingerprint ambiguity → approximate only. |
| `heading-moved.md` | Same paragraph under a different heading path → approximate only. |
| `no-shared-anchor.md` | No fingerprint matches → nearest-trusted-heading/top fallback + approximate. |

The files are intentionally minimal: tests synthesize large documents in memory
instead of committing 10/50MiB corpora, and the real packaged-app save-replace
observation is scheduled for wp-34 (marked UNVERIFIED until then). Scenarios
that need two versions pair each variant with the corresponding block in
`v1.md`/`v2.md`; tests never modify the fixtures.
