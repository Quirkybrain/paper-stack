# Search fixtures (ADR-007; T-59/61)

`search-samples.md` is the fixed document for the shared search-parity vectors
(`tests/contracts/vectors/search-parity.json`, executed by
`tests/contracts/search-parity.test.ts` and
`src-tauri/tests/contract_search_parity.rs`).

It deliberately contains:
- mixed-case ASCII (`Alpha BETA gamma`);
- formula source strings (inline and block) for the “公式源码匹配” label;
- inline code and fenced code needles;
- image `alt` text;
- CJK (including a single-character query);
- emoji and a decomposed combining mark next to a composed character (no
  Unicode normalization: `é` U+00E9 and `e` + U+0301 are different literals);
- a case-sensitive needle triple;
- a zero-result control: the token `unfindable-zzz` appears exactly once (so it
  is a positive control), while vectors such as `quux-absent-token` must return
  zero hits.

The vector file is the authority for offsets; this fixture only fixes the
bytes. Tests never modify the fixture.
