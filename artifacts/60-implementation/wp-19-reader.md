# 纸栈 PaperStack · wp-19/wp-20 阅读器与引擎实现报告（KaTeX / Shiki / Mermaid / Reader 最小装配 / 事件桥 / 真实冒烟）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP19
- **Artifact Type**: Implementation Evidence Report（引擎插件、阅读器最小装配、事件桥、fixture 与首次真实运行的构建/测试/证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-19-reader`（任务分支 `task/wp-19-reader`；父分支 `feat/v0.1.0`；基线提交 `98678b2cbc538c27cc116cde77ac58d49afc1bc9`；产出提交主题 `feat(reader): add engine plugins and reader assembly`）
- **Components**: C-11 文档解析/渲染管线（引擎槽 ⑧⑨⑩ + ③ remark-math）、阅读器最小装配（UI01 子集）、Tauri 事件桥（wp-16 T-23 延迟项）
- **Last Verified**: 2026-10-07
- **Scope**: `src/**`、`fixtures/reader-min/**`、`package.json`、`pnpm-lock.yaml`、`artifacts/60-implementation/**`。未修改 `vite.config.ts`、`src-tauri/**`、`artifacts/` 其它目录、pinned 输入或框架文件。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（与 handoff 及 `swe_guard.py begin` 冻结一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a28be026338af865bb6b9725785cdfcd08ce4ca2fd137bb9d70143919` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022924f0bf662bae1442856b20346a9e929fea15ad783633ee8568e1fad` | ✓ |
| `artifacts/40-ux/ui-spec.md` | `3a68817ac450b230fbd5f52525970fdf9af8755d1310012d3481a60749052e28` | ✓ |
| `artifacts/60-implementation/wp-17-pipeline.md` | `315e821a48609c127b49eb4290f6101267fcdc99da148bdff55c6e4b01442bbd` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |

基线 `98678b2`；进入时工作树干净、分支 `task/wp-19-reader`；snapshot `refs/swe/snapshots/20261006T230551Z-wp-19-reader-a569760f`（commit `25e86a85`）覆盖 package/lock/src/artifacts 前置字节。

## 2. 交付物（新增/修改）

| 路径 | 内容 |
|---|---|
| `src/document/plugins/katex.ts` | ③ remark-math 注册出口（`remarkMathPlugin`）+ ⑧ KaTeX 引擎：逐节点 pre-flight 隔离、`trust:false`、`strict:'warn'`、`maxSize:20em`、`maxExpand:1000`、每文档新建 macros；失败节点 → `.math-error`（内含可复制源码）+ `PS_PARSE_LOCAL`（`details.engine:'katex'`，不含 KaTeX 错误文本）；成功率经 `rehype-katex` 输出（受信、不再消毒）。 |
| `src/document/plugins/shiki.ts` | ⑨ Shiki 引擎：`import('shiki/core'/'engine/javascript'/langs/themes)` 懒加载（JS 正则引擎，因 CSP 不允许 wasm）；语言集 C/C++/Python/Rust/Java/JS/TS/Bash/JSON/YAML/SQL/plaintext（别名 js/ts/py/sh/yml…），未知 → plaintext 不报错；行号 gutter（`aria-hidden`，不参与复制）；`extractCodeText`/`normalizeCodeCopyPayload`（仅 LF 归一、保留缩进与尾换行）导出给 wp-26；加载失败降级原文 + 诊断。 |
| `src/document/plugins/mermaid.tsx` | ⑩ Mermaid 占位引擎（worker 安全，无 React/DOM import）；冻结 `securityLevel:'strict'`、`htmlLabels:false`、超时 5s、节点帽 5000、源上限 100k 字符；`detectMermaidType`/`renderMermaidDiagram`（渲染器可注入，便于超时/节点帽测试）；`extractMermaidSource` 供 React 层。 |
| `src/document/plugins/register.ts` | 注册 math→code→mermaid 三引擎（顺序契约）。 |
| `src/document/sanitize.ts` | D-3 有界消毒扩展：仅 `code` className 增加 `math-(inline|display)` 备选（见 §4）。 |
| `src/document/pipeline.ts` | ③ 在 technical 模式注册 remark-math（`singleDollarTextMath: inlineMath`）；standard 模式无数学节点。 |
| `src/document/annotate.ts`、`src/document/map.tsx` | 可选 `blockLimit` 渐进挂载（只隐藏，不改变 blockId/源映射语义）。 |
| `src/document/worker/client.ts` | Worker 致命错误语义修复：错误后客户端标记失败、终止并进入共享客户端黑名单，后续解析直接走规范回退（§7 根因）。 |
| `src/features/reader/reader-state.ts` | 多标签纯 reducer：复用（docId/canonicalPath）、MRU→右→左激活、Ctrl+Tab 循环、最短区别父目录标签、session 快照；每标签承载 wp-16 `DocumentSessionState` 与阅读阶段。 |
| `src/features/reader/use-reader.ts` | 编排：启动队列/对话框/事件打开 → `read_document` → Worker/回退解析 → 提交（contract §6 令牌）；watch 刷新（keep 模式 pending）、focus 复核、取消/重试、close 会话保存与失败如实上报；`send` 同步推进 ref 修复 promise 竞态。 |
| `src/features/reader/ReaderScreen.tsx` | UI01 最小装配：工具栏、条件标签栏、加载 >150ms/>1s 规则与取消、错误/取消/空文档状态、更新横幅（keep，仅“稍后”）、Ctrl+O/Ctrl+W/Ctrl+Tab、事件桥挂载、根错误边界。 |
| `src/features/reader/toolbar/ReaderToolbar.tsx`、`tabs/TabBar.tsx`、`body/DocumentView.tsx`、`body/ContentBlock.tsx`、`body/MathErrorBlock.tsx`、`body/ImageBlock.tsx`、`body/MermaidBlock.tsx`、`RootErrorBoundary.tsx`、`reader.css` | 组件与样式。图片经 `check_resource_access` 决定 allowed/占位；Mermaid 可见时懒加载渲染（strict）并本地化错误+源码；公式错误显示本地化标签+源码；外链仅 http(s) 交服务层，页内 fragment 滚动，相对文档链接暂不可点（wp-26）。 |
| `src/app/events.ts` | Tauri 事件桥（注入式 transport）：`watch-changed`、`open-requested`、focus/blur、`close-requested`（可 preventDefault 一次以如实显示保存失败）、drag-drop（仅 `drop` 阶段）。 |
| `src/app/events.test.ts`、`src/document/plugins/*.test.ts`、`src/features/reader/**/*.test.ts(x)`、`src/document/worker/protocol.test.ts` | 新增/扩展测试（§5）。 |
| `src/App.tsx`、`src/main.tsx` | ReaderScreen 挂载；引入 `katex/dist/katex.min.css`（随包字体/样式，离线可用）。 |
| `fixtures/reader-min/reader-min.md` | 2.2 KiB 混合中英样例：标题层级、GFM 表格/任务列表、Rust 代码块、行内/块公式、未知宏错误公式、mermaid、缺失图片、宽表格。 |
| `package.json` / `pnpm-lock.yaml` | 依赖新增（§3）。 |
| `artifacts/60-implementation/evidence/wp-19-smoke*.png` | 真实运行截图（§6）。 |
| `artifacts/60-implementation/wp-19-reader.md` | 本报告。 |

## 3. 依赖新增（仅允许清单）

| 依赖 | 范围 | 锁定版本 | 用途 |
|---|---|---|---|
| `katex` | `^0.19.0` | 0.19.0 | 公式渲染（静态引入；`katex.min.css` 由 `main.tsx` 引入） |
| `rehype-katex` | `^7.0.1` | 7.0.1 | ⑧ 受信 KaTeX hast 输出（预检后整体执行） |
| `remark-math` | `^6.0.0` | 6.0.0 | ③ `$…$`/`$$…$$` mdast 节点 |
| `shiki` | `^4.5.0` | 4.5.0 | ⑨ 懒加载高亮（`shiki/core` + JS 引擎 + 11 语言 + github-light 主题） |
| `mermaid` | `^12.1.0` | 12.1.0 | 可见时图表渲染（主线程动态 import） |
| `@types/katex`（dev） | `^0.16.8` | 0.16.8 | KaTeX 类型 |

未新增任何其它依赖；新增语言/主题均为 `shiki` 子路径，不引入 wasm。

## 4. D-3 消毒 schema 差量（精确记录）

security-model §5.2 原文允许 `code: className ^language-[A-Za-z0-9_+-]{1,32}$`；wp-17 D-3 预判缺口为 `div.math`/`span.math`。实测 `remark-math@6` + `remark-rehype@11`/`mdast-util-math` 生成的标记为
`code.language-math.math-inline`（行内）与 `pre > code.language-math.math-display`（块），因此实际扩展比预判更小：

```diff
-export const LANGUAGE_CLASS_PATTERN = /^language-[A-Za-z0-9_+-]{1,32}$/
+export const CODE_CLASS_PATTERN = /^(language-[A-Za-z0-9_+-]{1,32}|math-(inline|display))$/
...
-    code: [['className', LANGUAGE_CLASS_PATTERN]],
+    code: [['className', CODE_CLASS_PATTERN]],
```

- 仅 `code` 一个元素的 `className` 增加两个固定 token；**没有**新增标签、全局属性、协议、`span/div` 规则或 `style` 许可。
- KaTeX 输出（`.katex*`/MathML/内联 style）由 ⑧ 在消毒**之后**注入，永不再次消毒；因此不需要、也不允许为 `.katex*` 增加 schema 条目（安全边界不变）。
- 回归证据：`katex.test.ts` 验证 `class="language-math evil"` 中 `evil` 被剥离、公式仍渲染；wp-17 对抗样例测试全部保持通过（script/事件/style/javascript: 仍被剥离）。

## 5. DoD 执行证据（当前修订实测；工作目录=项目根）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm typecheck` | PASS（`tsc --noEmit`，0 错误） |
| 2 | `pnpm lint` | PASS（`eslint .`，0 error / 0 warning） |
| 3 | `pnpm test -- --run` | PASS：**29 个测试文件，217/217 通过**（基线 164 + 新增 53；`protocol.test.ts` 14→16） |
| 4 | `pnpm build` | PASS（`tsc && vite build`，1.61s；主 chunk index 1,180.85 kB / gzip 361.06 kB，含 KaTeX；Shiki 语言与 Mermaid 图表为独立懒加载 chunk） |
| 5 | `cargo build --manifest-path src-tauri/Cargo.toml` | PASS（`Finished dev profile`） |

测试分布（新增/修改文件）：

| 测试文件 | 数量 | 覆盖 |
|---|---|---|
| `src/document/plugins/katex.test.ts` | 9 | 行内/块公式；坏宏逐节点隔离+诊断+源码；maxExpand 循环宏；代码上下文不产生数学；`inlineMath:false`；standard 模式；跨文档宏不泄漏；`trust:false` 无 javascript href；D-3 类名差量 |
| `src/document/plugins/shiki.test.ts` | 7 | 语言集/别名/未知降级；复制载荷 LF 归一与缩进/尾换行；Rust 高亮与字面保真；行号 gutter 与复制分离；mermaid 围栏让位；缩进代码不动 |
| `src/document/plugins/mermaid.test.ts` | 8 | 占位节点+源码；standard 保留原文；图种识别；成功/超时（注入）/节点帽/加载失败/语法错误 |
| `src/document/worker/protocol.test.ts` | 16（+2） | 既有 14 项全部保留；新增：致命错误后客户端失败且拒绝后续 parse；启动失败共享 Worker 终止+黑名单，后续解析回退且 `PS_WORKER_FAILED` |
| `src/features/reader/reader-state.test.ts` | 12 | 复用/不重复；MRU→右→左关闭激活；后台关闭不动焦点；最后关闭回空；Ctrl+Tab 循环；最短区别父目录；session 快照；reading→parsing→ready；陈旧结果零影响；失败/取消失效 |
| `src/features/reader/ReaderScreen.test.tsx` | 9 | 空态；渲染（KaTeX+坏宏+图片占位）；读取错误+重试；双文档标签栏+Ctrl+W；watch-changed→pending 横幅（无假“现在更新”）+稍后折叠；focus 复核；拖放打开；退出保存失败如实显示一次；>150ms/>1s 占位与取消 |
| `src/features/reader/body/MermaidBlock.test.tsx` | 4 | 成功 SVG；超时本地化+源码；语法错误+源码；不支持图种不加载渲染器 |
| `src/app/events.test.ts` | 2 | 五类订阅转发（drag 仅 drop）；dispose 解除全部订阅 |

## 6. 真实运行冒烟（首次真实阅读器运行，X11）

构建/运行（debug 可用）：

```sh
pnpm build                                   # 产出 dist/（嵌入前）
pnpm tauri build --debug --no-bundle         # 说明：直接 cargo build 的 debug 二进制加载 devUrl
DISPLAY=:1 ./src-tauri/target/debug/paperstack "$(pwd)/fixtures/reader-min/reader-min.md"
```

说明（D-19-9）：`cargo build`（DoD 命令 5）产出的 debug 二进制按 Tauri 约定加载 `devUrl`，首次尝试显示
`Could not connect to localhost: Connection refused`（如实记录）。改用 `pnpm tauri build --debug --no-bundle`
（前端资源嵌入，二进制同路径）后窗口正常。

窗口核验（`xwininfo -root -tree`）：

```text
0x600a89 "纸栈 PaperStack": ("mutter-x11-frames" ...)  1308x866+168+128
  0x2200003 "纸栈 PaperStack": ("paperstack" "Paperstack")  1280x800
xwininfo -id 0x2200003 → Map State: IsViewable
```

截图命令：`DISPLAY=:1 xwd -id 0x2200003 -out <xwd>` → `ffmpeg -y -i <xwd> <png>`。

| 证据 | 路径 | 视觉确认内容 |
|---|---|---|
| 主文档冒烟 | `artifacts/60-implementation/evidence/wp-19-smoke.png` | 窗口标题；CLI 路径 → 单实例队列 → 事件桥 → 阅读器；工具栏文件名 `reader-min.md`；行内/块 KaTeX；未知宏**仅本公式**回退（“此处内容渲染失败，已显示可读回退。”+ 可复制 `\undefinedmacro{x}`）；Rust 高亮 + 行号 gutter；中文/中英混排布局 |
| 块类型探针（临时 /tmp 文档，未提交） | `artifacts/60-implementation/evidence/wp-19-smoke-blocks.png` | 图片占位（outside-root 文案 + 相对路径）、Mermaid strict 实际渲染（中文节点）、宽表格、标签栏双标签（`reader-min.md`+探针） |
| 单实例第二文档 | `artifacts/60-implementation/evidence/wp-19-smoke-second-tab.png` | 第二实例经 `paperstack://open-requested` 在既有窗口打开 `utf8-cn-emoji.md`：标签栏 ≥2 显示、激活、emoji/组合字符渲染；第二实例进程退出、仅 1 个 app 进程 |

进程稳定性：全程无 stderr 输出、无崩溃；截图后进程存活，手动终止。

**未视觉确认（UNVERIFIED）**：

- Wayland 会话（本机仅 X11 `:1`；NF10/R30 的 Wayland 部分仍待 wp-22/后续）；
- 图片 `allowed` 资产加载路径（asset 协议）：探针图片为 missing/outside-root，未有一次成功加载；
- reader-min 的表格/mermaid/图片位于首屏之下，未滚动查看（同样内容已由探针文档与单测覆盖）；
- 拖放、focus 复核、Ctrl+Tab、取消按钮在真实 WebView 中的交互（均有单测；未做真实 X11 注入）；
- 深色主题、200% 文字缩放、1024×640 窗口（属 wp-22 固定条件 EA-RUN）；
- Worker 边界：见 §7，当前真实解析走规范回退而非 Worker。

## 7. Worker 边界根因与修复（首次真实运行发现；含越界项上报）

**现象**：首个文档正常渲染；其后每个文档停在“正在解析”。用两个 30 字节纯文本文档复现（与内容无关）。

**根因（已确证）**：生产 `parse.worker` bundle 在模块求值期即崩溃——`micromark → parse-entities → decode-named-character-reference` 被 Vite 以 **browser 导出条件**解析为 `index.dom.js`，该文件顶层执行 `document.createElement('i')`；Web Worker 无 `document`。将构建后的 worker chunk 直接在 Node 导入复现 `ReferenceError: document is not defined`。首个解析在 Worker error 事件后按规范回退主线程成功，但 wp-17 的共享客户端未作废，后续解析提交到已死 Worker 而永久悬挂（wp-17 D-13 的“无超时”语义在此暴露）。

**本任务范围内修复（D-19-8）**：`src/document/worker/client.ts` 将 Worker 致命错误视为永久失败：在途任务以 `WorkerUnavailableError` 拒绝→调用方回退；共享客户端终止并加入黑名单；后续 `parseDocumentWithFallback` 直接走同管线主线程回退并附 `PS_WORKER_FAILED`。新增 2 项回归测试。真实运行复验：多文档全部正常渲染。

**越界必需的修复（上报给 Orchestrator，不在本任务写入范围）**：Worker 构建需包含 `worker` 导出条件（或等效排除 browser 变体），属于 `vite.config.ts` 变更（`resolve.conditions`）。建议后续任务执行并在真实运行中验证 `usedWorker:true`；在此之前真实解析在回退路径，功能不降级、诊断诚实（`PS_WORKER_FAILED`），但大文档主线程解析性能未验证。

## 8. 决策、偏差与已知限制

- **D-19-1 合并交付**：handoff 明确合并 wp-19（T-31..T-33）与 wp-20（T-34/T-35）；提交一次成型。
- **D-19-2 D-3 差量小于预判**：见 §4；`div/span` 未放开。
- **D-19-3 Mermaid 分层**：worker 安全的占位/策略在 `document/plugins/mermaid.tsx`，React 渲染组件在 `features/reader/body/MermaidBlock.tsx`——避免把 React/DOM 依赖引入 Worker 图；渲染策略常量与 `renderMermaidDiagram` 仍由 `document/plugins` 拥有，行为与 handoff 描述一致。
- **D-19-4 更新流仅 keep 状态**：`watch-changed`→refresh→`pendingVersion`→横幅；“现在更新”不渲染（wp-29），不提供假动作；“稍后”只折叠横幅并保留“有新版本”标记（INV-UM-05）。
- **D-19-5 未实现操作的呈现**：后退/前进/导航/查找/Aa/打开目录为 present-but-disabled，reason 复用目录键 `common.unavailable`；更多菜单仅“关闭文档”可用（IXD §2.2 不渲染无能力项）；其余菜单项随 wp-24/26/29 进入。
- **D-19-6 不新增本地化键**：字符串目录（378 键）为冻结上游 Artifact，本任务复用既有键（`error.parse.local`、`common.loading`、`common.unavailable`、`error.resource.unsupported`、`error.auth.denied` 等）；`i18n.keys.test` 的 378 键奇偶校验保持通过。若需要新文案，应先由 experience-designer 更新目录。
- **D-19-7 渐进挂载**：为 `annotateTree/renderDocument` 增加可选 `blockLimit`，只影响逐帧挂载数量，blockId/源映射/搜索分段不变。
- **D-19-8/9/10**：见 §7 与 §6。
- **D-19-11 `send` 同步状态**：阅读器编排以纯 reducer 同步推进内部 ref（React 渲染仍走 `useReducer`），消除“dispatch 未提交即 await 完成”的竞态；所有 dispatch 单点通过 `send`。
- **D-19-12 代码块主题固定浅色**：Shiki 固定 `github-light`；深浅主题下的代码配色属 wp-22/显示设置任务。
- **D-19-13 安全**：KaTeX `trust:false`、Mermaid `securityLevel:'strict'`/`htmlLabels:false` 为代码常量不可被文档降低；唯一 `dangerouslySetInnerHTML` 位于 Mermaid 受信输出封装（security-model §5.2 允许的单点）。
- **D-19-14 回退诊断可见性**：`PS_WORKER_FAILED` 记录于解析诊断（wp-26 诊断面板展示）；阅读器最小版不展示诊断列表，未谎报 Worker 可用。

## 9. 失败隔离落地核对（rendering-pipeline §4）

| 失败点 | 实现 | 冒烟/测试证据 |
|---|---|---|
| 单公式 | `.math-error` 占位 + 源码 + `PS_PARSE_LOCAL`(katex) | `wp-19-smoke.png` 可视；`katex.test.ts` |
| 单代码块 | 高亮加载失败 → 原文 + 诊断；语言未知 → plaintext | `shiki.test.ts` |
| 单图表 | 超时/节点帽/语法/不支持 → 本地化错误 + 源码入口；不自动重试 | `mermaid.test.ts`、`MermaidBlock.test.tsx` |
| 单图片 | missing/outside-root/remote-blocked/unsupported/denied → 块内占位 + 相对路径 | `wp-19-smoke-blocks.png`；`ReaderScreen.test.tsx` |
| 文档级解析 | `PS_PARSE_DOC` → 纯源码回退视图（DocumentView fallback） | `DocumentView` 分支；`pipeline.test.ts` 既有 |
| Worker 不可用 | 同管线主线程 + `PS_WORKER_FAILED`；致命错误后不再复用死 Worker | §7；`protocol.test.ts` +2 项 |

## 10. 追溯摘要

- **rendering-pipeline §1/§2.3/§2.8–§2.10/§2.12/§4/§6**：③ remark-math；⑧⑨⑩ 引擎顺序与隔离；按块渐进挂载；失败隔离表；Worker 回退语义（含 §7 修复）。测试：`katex|shiki|mermaid.test.ts`、`reader*`。
- **security-model §5.2**：D-3 精确差量（§4）；KaTeX/Mermaid 受控配置；受信注入不被二次消毒（`pipeline.test.ts` 既有顺序测试仍通过）。
- **contracts §4/§6/§8**：事件桥五类事件；`TaskToken`/提交规则经 wp-16 reducer 单点（`reader-state.test.ts` 陈旧结果丢弃）；服务层只经 `src/services`。
- **models §2/§4/§7**：pending 候选与“稍后”折叠；标签复用/MRU 关闭顺序/≥2 显示。
- **ui-spec §3.2/§4.2/§6.1/§6.3/§6.4**：工具栏/标签/加载阈值/Ctrl 快捷键/角色与禁用原因。
- **wp-17 §7 接口**：引擎按 `registerEngine` 定序注册；`EngineContext` 不变。
- **实现计划 T-31..T-35**：全部落地；T-36/T-37（桌面工具/固定条件 EA-RUN）仍属 wp-21/wp-22。

## 11. 结论与下一步

wp-19/20 实现与本地验证满足 DoD（typecheck/lint/test/build/cargo build 全过），首次真实运行证明端到端管线在 X11 下工作。待独立质量审查与 Gate；**上报一项越界修复**：Worker 构建导出条件（`vite.config.ts`）需在后续授权任务中修复并在真实运行验证 `usedWorker:true`（§7）。相关后续：wp-21 截图脚本与样例集、wp-22 固定条件 EA-RUN（含 Wayland 与交互核对）、wp-24/25/26/29 补齐欢迎页/导航/检查抽屉/更新提交。
