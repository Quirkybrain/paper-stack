# Source map sample (rendering-pipeline §3; NF11)

CJK 多字节段落：中文与 English 混排。

Emoji line: 🚀🎉 and a combining mark: e&#x301; (decomposed) beside é (composed).

```rust
fn source_range() -> &'static str {
    "数据 slice"
}
```

Inline formula $x_{i+1}$ and block:

$$
\frac{1}{2}
$$

| 列 | 值 |
|---|---|
| 中 | 文 |

Final ASCII line.
