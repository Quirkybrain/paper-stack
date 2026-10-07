# Security fixtures (T-59; security-model §5)

`malicious.md` is a single fixed hostile document. Expected handling follows
the failure-isolation table (rendering-pipeline §4) and the sanitize schema
(security-model §5.2): raw HTML is parsed into nodes but only allow-listed
tags/attributes/protocols survive; `script`, `iframe`, `style`, event
attributes (`on*`), `javascript:`/`data:`/`vbscript:` URLs are removed or
textualized; path traversal stays a literal placeholder (never a read);
KaTeX/mermaid over-limit inputs stay local to their block. Task checkboxes
remain disabled.

The matching assertions live in
`tests/contracts/rendering-fixtures.test.ts` (pipeline-level, DOM-free) and the
block-level behavior is covered by the existing unit/component suites. No test
writes to these files.
