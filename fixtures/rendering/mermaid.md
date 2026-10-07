# Mermaid samples (rendering-pipeline §2.10)

Flowchart (supported):

```mermaid
flowchart LR
  A[打开文件] --> B{解析管线}
  B -->|成功| C[正文渲染]
  B -->|失败| D[源码回退]
```

Sequence diagram (supported):

```mermaid
sequenceDiagram
  participant U as 用户
  participant R as Reader
  U->>R: 打开文档
  R-->>U: 首屏
```

Class diagram (supported):

```mermaid
classDiagram
  class Session
  Session : +int generation
  Session : +int displayVersion
```

Syntax error must stay local (source fallback + diagnostics):

```mermaid
flowchart LR
  A[unclosed --> B[[[
```

Unsupported diagram type (pie) must show the supported-range explanation,
not a crash:

```mermaid
pie title Shares
  "A" : 60
  "B" : 40
```
