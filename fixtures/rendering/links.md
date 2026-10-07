# Links and anchors (rendering-pipeline §2.4a / §2.11)

## Duplicate 标题

First occurrence.

## Duplicate 标题

Second occurrence (anchor gets a `-1` suffix; slugs stay unique in document
order).

[Jump to the first duplicate](#duplicate-标题) and to a
[missing fragment](#does-not-exist) (must show a not-found explanation).

## More links

- [Page-internal](#more-links)
- [Relative document](./mixed-cn-en.md)
- [Relative with fragment](./mixed-cn-en.md#数学小节)
- [External](https://example.com/docs)
- [Unsupported protocol](ftp://example.com/file)
- [Dangerous javascript: link](javascript:alert('x'))
- [Mail protocol](mailto:nobody@example.invalid)

A link whose text contains CJK and emoji: [纸栈 🚀](https://example.com/纸栈)

Autolink: <https://example.com/autolink>
