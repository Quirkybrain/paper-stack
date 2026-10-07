# 纸栈 PaperStack · wp-19a Worker 启动修复报告（worker 导出条件 / 失败重试语义）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP19A
- **Artifact Type**: Implementation Evidence Report（Worker 构建解析条件修复、客户端失败语义对齐、构建产物冒烟）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-19a-workerfix`（任务分支 `task/wp-19a-workerfix`；父分支 `feat/v0.1.0`；基线提交 `511958d9629b249cb2bf30db545a25008f0b04f6`）
- **Components**: C-11 文档解析/渲染管线（Worker 边界与回退，rendering-pipeline §6）
- **Last Verified**: 2026-10-07
- **Scope**: `vite.config.ts`、`src/document/**`、`artifacts/60-implementation/**`。未修改 `package.json`、锁文件、`src-tauri/**`、框架文件或其它 `src` 路径。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（只读未改，与 handoff 一致）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/60-implementation/wp-19-reader.md` | `5b59dd7166563d1be0f45235c783b33488f6343eacee814c5642b488f1c31f85` | ✓ |
| `artifacts/30-architecture/rendering-pipeline.md` | `6fe1f74a28be026338af865bb6b9725785cdfcd08ce4ca2fd137bb9d70143919` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9fcb90f745b82446fc50f98a1358ff979ff205c23ea43920f6c3ac88a` | ✓ |

基线 `511958d`；进入时工作树干净、分支 `task/wp-19a-workerfix`；`swe_guard.py status` 显示本任务 ACTIVE，快照 `refs/swe/snapshots/20261006T233752Z-wp-19a-workerfix-6614dd48`（`d8f17d6d`）。

## 2. 根因（wp-19 §7 复核 + 一处扩展）

wp-19 §7 已确证第一条致命路径：worker bundle 用 **browser 导出条件**解析 `micromark → parse-entities → decode-named-character-reference`，得到 `index.dom.js`；该文件在模块求值期执行 `document.createElement('i')`，Web Worker 无 `document` → 首个解析在 Worker error 后回退，后续解析长期复用死 Worker 而悬挂（wp-19 D-19-8 已以“永久黑名单”止损）。

本次修复复核时发现**第二条同样致命的 DOM 入口**（wp-19 报告未列出）：`rehype-katex` 在解析期调用 `hast-util-from-html-isomorphic`（`rehype-katex/lib/index.js:11,133`），其 browser 条件入口 `lib/browser.js` 在模块顶层执行 `new DOMParser()`。基线 worker chunk 中同时存在这两个 browser 入口。Node 对照实验：

```text
导入基线 chunk（无 DOM 全局）                → ReferenceError: document is not defined
stub document 后再导入（越过第一条）          → ReferenceError: DOMParser is not defined
```

结论：只修 `decode-named-character-reference` 仍不足以让 Worker 启动；worker bundle 必须对这两个包采用 `worker`/`default`（无 DOM）入口。

### 2.1 为什么不用直接的 `resolve.conditions`（Vite 8.3.3 机制核验）

| 尝试的机制 | 实测结果 |
|---|---|
| `worker.plugins` 里 `config` 钩子修改 `resolve.conditions` | **无效**，worker chunk 字节不变。Vite 文档明确：worker 选项在 config 钩子中的修改会被忽略；worker 构建复用 `client` 环境的解析配置 |
| `worker.rolldownOptions.resolve.conditionNames` | **无效**，worker chunk 不变。Vite 8 构建期模块解析由内部 Oxc resolver 完成，不经过 rolldown 原生解析器 |
| 顶层 `resolve.conditions: ['module','worker','browser','development|production']` | worker 修复成功，但**主线程 bundle 同时被改变**：rehype-katex 的 `DOMParser` 入口被 parse5 入口替换（`new DOMParser` 消失、主 chunk 1,181,110 → 1,219,655 字节）→ 越出“worker 修复”范围，放弃 |
| 上游现状 | `vitejs/vite#7439`（per-worker 导出条件）仍开放；`#20230` 作为重复关闭。Vite 8.3.3 无 per-worker `resolve` 选项（`UserConfig.worker` 仅有 `format/plugins/rollupOptions/rolldownOptions`） |

## 3. 修复 1：worker 构建的导出条件（`vite.config.ts`）

采用 Vite 支持的 **worker 专属插件面**：`worker.plugins`（文档明确该函数返回的插件用于 worker bundle 的构建）。插件以 `enforce:'pre'` + `resolveId` 在解析最前拦截两个已知会命中 browser DOM 入口的模块，用 Vite 自身 resolver 定位其 browser 入口（兼容 pnpm 非提升布局，无需 `require.resolve` 穿透传递依赖），再指向同包的无 DOM 入口（即各自 `worker`/`default` 导出）：

```ts
const WORKER_SAFE_ENTRIES: Record<string, string> = {
  // browser: index.dom.js → worker/default: index.js
  'decode-named-character-reference': 'index.js',
  // browser: lib/browser.js → worker/default: ../index.js
  'hast-util-from-html-isomorphic': '../index.js',
}

function workerExportConditions(): Plugin {
  return {
    name: 'paperstack:worker-export-conditions',
    enforce: 'pre',
    async resolveId(source, importer) {
      const safeEntry = WORKER_SAFE_ENTRIES[source]
      if (safeEntry === undefined) return null
      const browserEntry = await this.resolve(source, importer, { skipSelf: true })
      if (!browserEntry || browserEntry.external) return null
      return normalizePath(resolvePath(dirname(browserEntry.id), safeEntry))
    },
  }
}

// defineConfig({ ..., worker: { plugins: () => [workerExportConditions()] }, ... })
```

配置文件内含完整 WHY 注释（Vite 8 行为、两个包的浏览器入口、`#7439`、维护提示与冒烟脚本位置）。**边界**：仅 worker bundle 受影响；主线程 bundle 保持 browser 解析（差分证据见 §5.5）。

## 4. 修复 2：Worker 失败语义（`src/document/worker/client.ts`）

对齐 rendering-pipeline §6（“Worker 不可用 → 回退主线程同管线 + `PS_WORKER_FAILED`”；“必要时终止并重建 Worker”）：

- 移除会话级永久黑名单 `sharedClientUnavailable`。
- 致命错误：`dropSharedClient` 仅终止并丢弃当前 client；**下一次解析重建 Worker 重试**；单次解析仍然回退同管线并携带 `PS_WORKER_FAILED`，诊断诚实。
- Worker 构造失败：仅本次解析回退，后续解析可重试（环境限制解除即自动恢复）。
- 取消语义、任务令牌、结构化克隆不变。

测试调整（`src/document/worker/protocol.test.ts` 16 → 17）：

| 测试 | 断言 |
|---|---|
| 既有：致命错误后 client 失败并拒绝后续 parse（同一 client 实例） | 保留 |
| 新：`retries a fresh worker after a fatal error instead of blacklisting it permanently` | 首个 Worker 崩溃 → 回退；第二次解析创建**新** Worker 且响应被采用（`usedWorker:true`，无诊断）；死 Worker 已 terminate |
| 新：`keeps degrading in-process when every worker startup fails` | 连续两次启动失败均逐次回退 + `PS_WORKER_FAILED`，两个 Worker 均被终止 |

## 5. 验证证据（当前修订实测；工作目录=项目根）

### 5.1 DoD 命令

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm typecheck` | PASS（`tsc --noEmit`，0 错误） |
| 2 | `pnpm lint` | PASS（`eslint .`，0 error / 0 warning） |
| 3 | `pnpm test -- --run` | PASS：**29 个测试文件，218/218 通过**（wp-19 基线 217 + 净增 1；protocol.test.ts 16→17） |
| 4 | `pnpm build` | PASS（`tsc && vite build`，1.40s；`index-AGznMw4w.js` 1,181.07 kB / gzip 361.16 kB；`parse.worker-Cl_Oe0ZH.js` 2,490.34 kB） |

### 5.2 构建产物检查（修复前/后）

| 断言 | 基线 chunk（browser 条件） | 修复后 chunk |
|---|---|---|
| 文件名 / 字节 | `parse.worker-BnVvon-q.js` / 2,451,785 | `parse.worker-Cl_Oe0ZH.js` / 2,490,343 |
| `decode-named-character-reference` DOM 路径（`document.createElement('i')`） | **1** | **0** |
| `hast-util-from-html-isomorphic` browser 入口（`new DOMParser`） | **1** | **0** |
| Node 导入（无 DOM 全局） | `ReferenceError: document is not defined`（stub `document` 后 `ReferenceError: DOMParser is not defined`） | 模块求值成功 |

说明：修复后 chunk 中仍有 20 处 `document.createElement*`，全部位于 KaTeX 的 DOM 构建方法（`toNode()` 等）方法体内，属解析路径不调用的死代码；worker 解析使用 `renderToString`/`toMarkup`。无 DOM 全局的完整解析往返（§5.3）证明执行路径不触碰 DOM。

### 5.3 Node 构建产物冒烟（`src/document/worker/smoke.worker-build.mjs`）

```sh
pnpm build
node src/document/worker/smoke.worker-build.mjs
```

输出：

```text
[worker-smoke] PASS parse.worker-Cl_Oe0ZH.js: task=smoke-1 status=ok blocks=6 segments=8 diagnostics=0 (no DOM globals)
```

脚本行为：确认 `document`/`DOMParser` 未定义 → 以 worker-like `self`（`addEventListener`/`postMessage`）导入 `dist/assets/parse.worker-*.js`（模块求值必须成功）→ 发送含实体（`&amp;`/`&copy;`/`&notin;`）、行内/块公式、Rust 围栏、中文/emoji、任务列表的解析任务 → 断言 `parsed` 信封、`status:ok`、无诊断、≥4 blocks、≥1 segment，并断言 hast 中存在 KaTeX 渲染元素（`katex`/`katex-display`，覆盖 rehype-katex → `fromHtmlIsomorphic` 运行时路径）与 `div.code-block[data-language=rust]`（覆盖 Shiki 懒加载高亮路径）。失败则以非零码退出。

### 5.4 真实应用冒烟（X11 `:1`）

构建/运行（与 wp-19 §6 相同流程）：

```sh
pnpm tauri build --debug --no-bundle   # beforeBuildCommand = pnpm build；PASS
DISPLAY=:1 ./src-tauri/target/debug/paperstack "$(pwd)/fixtures/reader-min/reader-min.md"
```

窗口核验：`xwininfo -root -tree` → `0x2200003 "纸栈 PaperStack" ("paperstack") 1280x800+14+49`；进程全程无 stderr；截图后手动终止。

| 证据 | 路径 | 视觉确认内容 |
|---|---|---|
| 主文档冒烟 | `artifacts/60-implementation/evidence/wp-19a-smoke.png` | 工具栏 `reader-min.md`；行内/块 KaTeX 正常；未知宏仅本公式回退（本地化文案 + 源码）；Rust 高亮 + 行号；中文/中英混排 |
| 第二文档（单实例队列） | `artifacts/60-implementation/evidence/wp-19a-smoke-second-tab.png` | 第二实例经事件桥在既有窗口打开 `fixtures/encoding/utf8-cn-emoji.md`：标签栏 `reader-min.md` + `utf8-cn-emoji.md`，第二文档正常渲染（wp-19 的“第二个文档停在正在解析”不复现），第二实例进程退出 |

**如实声明**：Reader 最小版无诊断面板（wp-26），无法从 UI 直接观察 `usedWorker:true`；本次未在 webview 内直接观测“worker active”。worker 路径的证据为 §5.2（产物检查）+ §5.3（无 DOM 全局的构建产物解析往返）+ 负对照；§5.4 仅证明真实应用端到端渲染与多文档可用。不主张未观测的事实。

### 5.5 差分构建（隔离 vite.config 变更）

对同一源码分别以“仅去除 worker 导出条件插件”的配置构建（`--outDir` 两次构建字节稳定的对照），对所有产物做内容哈希归一化后比较：

- 115 个 JS/CSS/HTML 产物中 **114 个内容完全一致**（仅内容哈希文件名不同）；
- 唯一内容差异是 `parse.worker-*.js`（本次修复目标，2,451,785 → 2,490,343 字节）。

即：修复 1 只改变 worker bundle，主线程 bundle 的解析语义（含 rehype-katex 的 DOMParser 路径）保持不变。修复 2（client）是有意的主线程行为变化，由 §5.1 的 17 项协议测试覆盖。

## 6. 决策、偏差与残余 UNVERIFIED

- **D-19A-1 机制选择**：Vite 8.3.3 不存在 per-worker `resolve.conditions`（上游 #7439 开放，docs 明确 worker config 钩子修改被忽略；`worker.rolldownOptions.resolve` 不参与 Vite 解析）。任务提示的 `resolve.conditions` 全局方案会改变主 bundle（实测），故采用 `worker.plugins` 支持的 worker 专属插件 + `resolveId`，把两个模块映射到其 `worker`/`default` 入口。
- **D-19A-2 第二条 DOM 入口**：`hast-util-from-html-isomorphic`（rehype-katex 依赖）为 wp-19 报告未列出的第二处启动崩溃点；本修复一并处理，否则 Worker 仍无法启动。
- **D-19A-3 重试策略**：按 §6“终止并重建 Worker”语义，失败为 per-parse：致命错误丢弃 client，下次解析重建；无会话永久黑名单。重复失败时每次解析仍先尝试 Worker 再回退，正确性不降级、诊断诚实。
- **D-19A-4 冒烟载体**：按任务许可，构建产物冒烟为 `src/document/worker/smoke.worker-build.mjs`，在证据运行中经 `node` 执行（不进入 vitest：它依赖先 `pnpm build` 的 dist 产物）。
- **残余 UNVERIFIED**：
  - webview 内 `usedWorker:true` 的直接观测（无诊断面板；见 §5.4 声明）——待 wp-26 诊断面板或后续可观测化；
  - `pnpm dev` 开发模式 worker 依赖预打包路径（`optimizeDeps` 的 browser 条件解析）未验证；本任务范围为生产构建；
  - Wayland 会话；Windows/macOS 构建；
  - `WORKER_SAFE_ENTRIES` 为显式清单：未来新增“browser 入口含 DOM、worker 入口无 DOM”的依赖需人工登记（配置文件注释已提示；冒烟脚本在导入/解析触碰 DOM 时失败）。
- **维护提示**：worker chunk 中的 KaTeX `toNode()` DOM 死代码若未来被 worker 路径调用将失败；当前引擎只用字符串渲染路径，冒烟覆盖。

## 7. 结论与下一步

Worker 构建现在对两个 DOM-only browser 入口采用 worker/default（无 DOM）变体：构建产物在无 DOM 全局下可导入并完成解析往返（含公式/代码/实体路径），真实应用端到端渲染与多文档流程正常；客户端失败语义与 §6 对齐（per-parse 回退 + 重建重试，无永久黑名单）。DoD 四项命令全部通过。待独立质量审查与 Gate；建议后续（wp-26/诊断面板）补足 `usedWorker` 的可观测证据。
