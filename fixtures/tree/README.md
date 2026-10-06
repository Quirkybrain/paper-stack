# Directory-tree fixtures (wp-10, T-11)

Committed tree for `services/tree.rs` state tests (contracts §3.2; R02/R25):

```text
tree/
├── outside/secret.md          # outside the root: symlink target / escape vector
└── root/
    ├── a.md
    ├── sub/
    │   ├── b.md
    │   └── deep/c.md
    ├── empty/.keep             # placeholder: tests that need a truly empty directory
    │                          # create one in a tempdir (git cannot commit empty dirs)
    ├── link-inside -> sub
    ├── link-inside-file.md -> a.md
    ├── link-outside -> ../outside
    └── link-broken -> missing-target
```

Expected states when listing `root`: `a.md` file/ok/markdown, `sub`
directory/ok/hasChildren, `empty` directory/ok (hasChildren only if the
`.keep` marker is present), `link-inside` symlink/symlink-inside,
`link-inside-file.md` symlink/symlink-inside, `link-outside`
symlink/symlink-outside, `link-broken` symlink/missing.

Permission-denied, 2000-entry truncation and socket (`other` kind) cases are
created in tempdirs at test time; committed fixtures are never chmod-ed.
