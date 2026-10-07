# Images and resource access (rendering-pipeline §2.11)

Missing relative image (block placeholder with the relative path):

![missing diagram alt](images/missing-diagram.png)

Path traversal attempt (must be rejected, not read):

![traversal attempt alt](../../outside/secret.png)

Remote image (blocked until the user allows the session; no automatic fetch):

![remote sample alt](https://example.invalid/pic.png)

`file:` image (unsupported protocol):

![file protocol alt](file:///etc/passwd)

`data:` SVG with a script payload (unsupported / must not execute):

![data svg alt](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=)

Image inside a link (link routing + image placeholder together):

[![linked image alt](images/also-missing.png)](https://example.com/paperstack)

Decorative image without alt text (empty alt is allowed):

![](images/decorative-missing.png)
