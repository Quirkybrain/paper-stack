# Rendering fixtures (rendering-pipeline §7; T-59)

The eight fixed sample classes plus the source-map sample. Each file is small,
deterministic and deliberately covers the listed edge cases. Malicious samples
live in `fixtures/security/` so sanitize failures cannot be confused with
rendering failures.

| File | §7 class | Covers |
|---|---|---|
| `mixed-cn-en.md` | mixed CN/EN | CJK+ASCII paragraphs, inline styles, list, quote, headings |
| `math.md` | math | inline/block math, `$` in code (inline/fenced/indented), escaped `\$`, unclosed `$`, amount ambiguity, unknown macro, wide formula |
| `code.md` | code | the 12 supported languages, unknown language, 45-line block (40/20 fold threshold), no trailing newline on last fenced block |
| `tables.md` | tables | narrow table, wide CJK table (local horizontal scroll path) |
| `mermaid.md` | mermaid | flowchart, sequence, class, syntax error, unsupported diagram type, timeout/over-limit note |
| `images.md` | images | missing relative image, traversal path, remote https image, `file:` image, `data:` SVG script, meaningful `alt` texts |
| `links.md` | links/anchors | duplicate headings (unique anchors), page fragment, missing fragment, relative document, external https, `javascript:`, unsupported scheme |
| `edge-cases.md` | edge cases | empty document body marker, setext heading, 6-level nesting, hard break, tab-indented code, HTML comment, details/summary, no trailing newline |
| `source-map.md` | source map | CJK/emoji/combining/CRLF content for `data-src-*` ↔ text slice assertions |

Conventions: the first heading is an H1 so outline assertions have a stable
root; inline `$…$` is intentional; unknown languages must degrade quietly.
Consumed by `tests/contracts/rendering-fixtures.test.ts`; intended as the fixed
corpus for later window-level walkthroughs (wp-34).
