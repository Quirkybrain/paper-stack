# Encoding fixtures (wp-10, T-08)

Byte-exact documents for the open-validation/decoding matrix
(contracts §2.1 command 4; R01–R03). **Some files are intentionally invalid**;
they are test data, never user content.

| File | Bytes | Expected open result |
|---|---|---|
| `utf8-cn-emoji.md` | UTF-8, CJK + emoji + decomposed combining char, no trailing newline | opened, `encoding=utf-8`, text preserved |
| `crlf.md` | CRLF line endings, no trailing newline | opened, CRLF kept as content |
| `bom.md` | UTF-8 BOM + body | opened, `encoding=utf-8-bom`, BOM stripped from text |
| `empty.md` | 0 bytes | opened, empty document (`lineCount = 1`) |
| `binary.md` | NUL bytes and control bytes (invalid UTF-8) | rejected `PS_ENC_UNSUPPORTED` |
| `latin1.md` | Latin-1 bytes (invalid UTF-8) | rejected `PS_ENC_UNSUPPORTED` |

Tests never modify these files (read-only guarantee, security-model §8).
