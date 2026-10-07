# 纸栈 PaperStack · v0.1.0 安全模型（Security Model）

- **Producer**: agent:solution-architect
- **Artifact ID**: ART-30-SEC
- **Artifact Type**: Security Model（威胁模型、授权算法、资源策略、内容隔离、能力与 CSP、脱敏、只读保证）
- **Status**: VALID
- **Revision**: 2
- **Owner**: solution-architect
- **Task**: `wp-03-architecture`（任务分支 `task/wp-03-architecture`；父分支 `feat/v0.1.0`；基线提交 `7b6f7338c75e4151cb0d684ef2e4a93bb6a9a64b`；产出提交主题 `docs(architecture): define v0.1.0 architecture and contracts`）
- **Last Verified**: 2026-10-07
- **Scope**: v0.1.0 威胁边界与强制控制。安全相关产品条款：R04、R07、R09、R10、R12、R15、R25、R26、R28、NF01–NF03；交互：IX06、IX10、IX14。
- **Depends On**: `contracts.md`（§3.6、§5）、`data-model.md`（§3.2、§6）；ART-20-RB §3、§7.3；SRS §7；计划书 §4.1、§5.4、§5.6。
- **Downstream**: Rust `services/{paths,auth,resources}`、`document/render`（消毒 schema）、capabilities/CSP 配置、恶意样例 fixtures、质量审查与安全测试。
- **变更记录**: Rev 2（2026-10-07，`wp-37-note`）：§5.2 同步——`a` 增加脚注回引 `id` 白名单 `^ps-fn(ref)?-[A-Za-z0-9-]+$`（B-02）；登记 D-3 增量（`math-inline`/`math-display`）已移除、`code` className 仅 `^language-…$`（B-10）；语义与实现对齐，无行为/接口变化；Change Impact 见 `CHANGE-IMPACT-note-1.md`。

---

## 1. 威胁模型摘要

**信任边界**：Rust 进程内受信任层持有文件系统、网络、数据库能力；WebView 内呈现的文档内容**完全不可信**。文档内容只能通过 `paperstack-ipc-r1` 的显式命令间接请求能力，且每个请求都在 Rust 侧重新校验授权（contracts.md §2.1、§9）。

| # | 威胁 | 场景 | 控制 | 依据 |
|---|---|---|---|---|
| T1 | 脚本/事件注入 | 文档含 `<script>`、`onerror`、`javascript:` 链接 | 白名单消毒（§5）+ CSP `script-src 'self'`；无 `dangerouslySetInnerHTML` 未消毒路径 | R09、NF03 |
| T2 | 路径逃逸 | `../../etc/passwd`、符号链接指向根外 | §2 算法：canonicalize 后组件级根匹配；`../` 在根内合法、根外拒绝 | R25、NF03 |
| T3 | 资源耗尽 | 超大文件/图片、复杂图表、巨型公式、搜索风暴 | 大小/像素/节点/超时帽（§3、§4、architecture §7）；搜索超预算显式不完整 | R29、NF06 |
| T4 | 网络追踪/外联 | 远程图片、自动请求、遥测 | 默认零文档网络请求；会话级显式允许；受控 HTTPS 获取；无遥测/远程脚本/联网字体 | R26、NF02 |
| T5 | 隐私泄露（诊断/记录） | 导出含正文、完整私人路径、URL 令牌；库含正文 | 默认脱敏、预览即导出、导出位置校验；库中无全文快照 | R27、R28、SRS §6.2 |
| T6 | 本地数据篡改/误授 | 界面伪造路径请求能力；最近列表自动重授权 | 授权仅由 Rust 注册表判定；路径字符串不是凭证；清除授权不自动恢复 | R25、R07 |
| T7 | 供应链/分发不一致 | 依赖或资源与发行版本不符 | 锁文件 + 随包资源 + `THIRD_PARTY_NOTICES.md` + 对应源码入口（未配置即阻塞发布） | R30、NF12 |
| T8 | 恶意内容破坏原文 | 错误恢复、导出、清理写入源目录 | 只读保证（§8）：无源写路径；导出拒绝受保护源位置 | R04、NF01 |
| T9 | 不受控的 Tauri 能力 | 文档内容触达 fs/shell/http | 不注册并禁用通用插件；命令白名单；最小 capabilities（§6） | PC-02、NF03 |

**不在 v0.1.0 控制范围**：内核/固件级攻击、操作系统内存取证痕迹（交换区/崩溃转储）、用户主动将应用数据目录共享给他人、本机其他进程对源文件的修改（应用只保证“不写”，不保证“不变”，R04/NF01 以写入监测取证）。

## 2. 授权模型与路径校验算法

### 2.1 授权类型

| 类型 | 获取 | 默认作用域 | 持久化 | 撤销效果 |
|---|---|---|---|---|
| 单文件读取 | 用户打开该文件（dialog/drop/CLI/system/tree/recent） | 按文档记录、可撤销 | `authorizations(kind='file', scope='persistent')` | 停止该文件新读取；已加载内容保留或关闭（R07、R25） |
| 目录读取（根授权） | 用户打开目录，或对越界资源做“允许本次读取/记住此目录”确认 | `session`；勾选“记住”才 `persistent` | 见 data-model §3.2 | 停止新读取/扫描/资源加载；不清空最近列表 |
| 远程图片会话 | 文档会话内显式“本次文档允许加载” | 仅当前文档会话 | `authorizations(kind='remote', scope='session')` | 取消在途请求、卸载远程资源、删除缓存（R26） |

授权确认 UI：一次性聚合目录确认（不逐图弹窗）、默认按钮为安全项、`remember` 复选框默认不选、模态限制 Tab、Esc 等同“保持阻止”（IX10；R25）。

### 2.2 路径校验算法（强制顺序）

```text
authorize_local_read(docId, rawRef):
 1. rawRef 为空或含 NUL → PS_IO_NOT_FOUND。
 2. rawRef 含 URL scheme：
    - http/https → 转远程策略（§4），不走本算法；
    - 其它（data:, javascript:, file:, vscode: 等）→ PS_RESOURCE_UNSUPPORTED。
 3. 百分号解码只做 URL 语义必需的解码；解码后再做第 1 步检查。
 4. 基准目录 = 请求文档 docId 的 canonical 父目录（Rust 注册表给出，不接受界面自带基准）。
 5. 相对路径 → join(基准, rawRef)；绝对路径 → 原样。词法清理 `.` 与 `..`（仅此处允许 `..`；
    根内 `../` 合法，能否最终通过由第 8 步决定）。
 6. 目标不存在 → 对最近存在祖先 canonicalize 后仍按第 8 步判定；目标文件缺失返回 PS_RESOURCE_MISSING
    （不区分“根外缺失”与“根内缺失”之外的信息泄露由 UI 文案统一处理）。
 7. canonicalize 目标（完全解析符号链接）。若解析失败（权限/循环）→ PS_IO_PERMISSION/PS_IO_NOT_FOUND。
 8. 授权匹配：对每条有效 grant（file/directory，file 精确相等；directory 用组件级 starts_with）判定。
    target 必须等于根或在根之下（禁止字符串前缀比较，必须组件比较）。
    **符号链接逃逸**：因第 7 步已完全解析，链接指向根外时 canonical target 落在根外 → 拒绝（PS_AUTH_OUTSIDE_ROOT）。
 9. 通过 → Rust 授予 asset 协议 scope（精确到该 canonical 文件）并生成 asset URL；生成前重新 canonicalize
    一次以收窄 TOCTOU 窗口；若结果变化，从第 4 步重试一次，仍不一致则拒绝。
10. 未通过 → PS_AUTH_OUTSIDE_ROOT（附 rootCandidate = 目标 canonical 父目录，供 UI 发起目录授权）。
```

- 目录树节点（R02）：子项符号链接状态由解析其目标给出；目标在根内可展开（`symlink-inside`），根外显示 `symlink-outside` 并提供“重新授权该目标”等式（IX02、R25）。
- 大小写：路径比较大小写敏感（Linux）；仅扩展名判断忽略大小写（R01）。
- 该算法同时服务于文本链接跨文档导航（目标文档经 `open_documents` 单文件授权，不因图片理由开放整树，R25）。

## 3. 本地资源策略

- **根内才可读**：全部本地资源（图片、跨文档链接）经 §2；asset URL 只能由 Rust 生成（contracts.md §2.1）。
- **撤销**：`revoke_grant` 停止新读取并移除 asset scope；已解码的图片在内存中的显示可保留（正文可继续看或关闭），但后续请求即失败（R07、R25）。
- **缺失/受限/解码**分别呈现，不统一为“图片不存在”（R13、IX07）。
- 图片初始预算：单图 ≤20MiB、≤32MP；超出不解码、给占位与说明（R29）。
- **SVG 直载不在承诺内**（R13）：文档中的 `.svg` 引用按不支持处理（PS_RESOURCE_DECODE）；Mermaid 生成的 SVG 是受信引擎输出（§5）。

## 4. 远程资源策略（R26）

```text
REMOTE POLICY (v0.1.0):
- 默认阻止：未获会话允许的远程图片不发起任何请求（AT26 断网/抓包验证零请求）。
- 允许粒度：grant_remote_session(docId, origins[])，origin = "https://host[:port]"（默认端口 443）。
- 协议：仅 https；http/其它 → PS_REMOTE_PROTOCOL。
- 解析：DNS 解析后、连接前检查**全部**地址；命中私网/环回/链路本地/ULA/组播/未指定地址 → 拒绝。
  IPv4: 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16；
  IPv6: ::/128, ::1, fe80::/10, fc00::/7, ff00::/8, ::ffff:私网映射。
- 重定向：最多 3 跳；每跳必须为 https、origin 仍在会话允许集合内且地址检查通过；
  否则 PS_REMOTE_REDIRECT_BLOCKED（附新 origin，供用户重新确认；**不自动扩大范围**）。
- 大小/时间帽（初始，可校准）：单响应 ≤20MiB、连接超时 5s、总超时 15s。
- 无自动重试：失败返回，用户可手动重试；不循环、不后台保活。
- 最小化：不使用 Cookie 持久化；不发送 Referer；UA 固定 "PaperStack/0.1.0"。
- 缓存：仅允许后的成功响应写入 app cache（≤256MiB LRU）；撤销会话授权即删除对应条目与文件。
```

## 5. 内容隔离（消毒 schema，强制）

### 5.1 处理边界（ADR-002）

文档文本只经过一次消毒；**引擎输出（KaTeX/Shiki/Mermaid）在消毒之后注入**，作为受信节点，不再次从文档文本解析；不得为恢复公式/高亮而放开全部 style 或事件属性（R09）。

### 5.2 `rehype-sanitize` schema（在 `defaultSchema` 基础上增删）

| 类别 | 规则 |
|---|---|
| 允许标签 | `p br hr h1–h6 ul ol li blockquote pre code em strong del a img table thead tbody tfoot tr th td details summary span sup sub section input` |
| 禁止标签（剥离） | `script style iframe object embed form button svg (原始) math video audio source link meta base template textarea select option` |
| 全局属性 | 无（默认剥离全部事件属性 `on*`、`style`、`srcset`、`ping`、`target`、`class`，除下列逐元素规则） |
| `a` | `href`（协议 `http https mailto` + 相对/片段，含脚注回引 `#ps-fn(ref)-…` 片段）、`title`、`id` 匹配 `^ps-fn(ref)?-[A-Za-z0-9-]+$`（仅脚注回引锚点） |
| `img` | `src`（协议仅 `http https`；相对路径允许）、`alt`、`title` |
| `h1–h6` | `id` 匹配 `^ps-h-[a-z0-9-]{1,128}$`（由大纲变换生成，重复标题加 `-1`、`-2` 后缀） |
| `code` | `className` 匹配 `^language-[A-Za-z0-9_+-]{1,32}$` |
| `li` | `className` 仅允许 `task-list-item` |
| `input` | `type` 仅 `checkbox`；`checked`；`disabled`（由后置插件强制 `disabled=true`，R04） |
| `details` | `open` |
| `td`/`th` | `align` 匹配 `^(left|center|right)$` |
| GFM 脚注 | `section`（`className="footnotes"`、`dataFootnotes`）、`li id` 匹配 `^ps-fn-[A-Za-z0-9-]+$`、`a id` 与 `a href` 片段匹配 `^ps-fn(ref)?-[A-Za-z0-9-]+$` |
| clobber | `clobberPrefix=""`：id 仅由上述白名单产生且模式受限；应用自身 DOM id 使用 `app-` 前缀避免碰撞 |
| 协议白名单 | `href: http https mailto`；`src: http https`；其余（`javascript:` `data:` `file:` `asset:`）一律剥离 |
| 原始 HTML 子集 | 仅可靠处理为上述允许标签；`details/summary` 为明确子集；其余原始 HTML 文本化或剥离并保留可读回退（R08、R09） |

- **D-3 增量（历史，已移除）**：`code` className 曾按 D-3 门禁增加 `math-(inline|display)` 备选；B-10 证实严格按本节 schema（仅 `^language-…$`）`$x^2$`/`$$y$$` 仍由引擎渲染，故该增量已删除，`math-inline`/`math-display` 不再允许（被剥离）；实现与本节逐字一致（wp-36a）。
- **`dangerouslySetInnerHTML` 禁令（强制）**：仅允许在“消毒后受信引擎输出”单一封装组件（`Document/SanitizedNode`）内出现；代码中其它位置禁止；由质量审查静态检查（R09；ADR-002）。
- **KaTeX**：`trust:false`、`strict:"warn"`、`maxSize`/`maxExpand` 受控值、宏按文档隔离；输出（含其 `style` 与 MathML 节点）为受信注入——允许注入的结构族为 KaTeX 固定生成的 `span/annotation/math/semantics/mstyle/mrow/…` 与 `class/style/aria-hidden` 等固定属性，不接受文档文本影响属性值（R10）。
- **Shiki**：高亮在文档文本之外生成；主题/语法随包；输出结构族为 `<pre class="shiki">`/`<code>`/`<span class|style>`（主题配色），为受信注入（R11）。
- **Mermaid**：`securityLevel:'strict'`、`htmlLabels:false`、固定安全配置，文档不能降低；渲染超时/节点超限给局部错误与源码，不重试循环（R12）。
- **图片**：消毒保留原始 `src` 字符串，实际加载一律经 `check_resource_access`/`fetch_remote_image`；React 图片组件决定占位/加载/阻止（R13、R26）。

## 6. Tauri 能力、插件与 CSP

**插件注册白名单（其余不注册）**：`tauri-plugin-dialog`（仅 Rust 使用）、`tauri-plugin-clipboard-manager`（仅 `write-text`）、`tauri-plugin-opener`（仅 Rust 使用）、`tauri-plugin-single-instance`（仅 Rust）。**不引入** fs/shell/http/自动更新等插件（PC-02；T9）。

**capabilities 最小集（`src-tauri/capabilities/default.json`）**：
- 核心：`core:default` 的窗口/事件基础 + 显式 `core:window:allow-close`、`core:window:allow-destroy`（退出流程）；不授予文件系统、Shell、HTTP 相关权限。
- `clipboard-manager:allow-write-text`（唯一 JS 可见插件权限）。
- 不授予 dialog/opener 的 JS 权限（全部经 Rust 命令包装，contracts.md §9）。
- asset 协议：`assetProtocol.enable=true`、静态 scope 为空；scope 只能由 Rust 在 §2 校验后运行时扩缩（R25）。
- 权限标识以 Tauri 2 实际版本为准，实现时逐项在编译与运行中验证（实现任务 DoD；不得“先全开再收”）。

**生产 CSP（`tauri.conf.json` → `app.security.csp`）**：

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' asset: http://asset.localhost data: blob:;
font-src 'self' data:;
connect-src 'self' ipc: http://ipc.localhost;
worker-src 'self' blob:;
object-src 'none';
frame-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none'
```

- `style-src 'unsafe-inline'` 为受控取舍：KaTeX/Shiki/Mermaid 以受信输出注入内联 style；用户内容中的 `style` 在消毒阶段已被剥离、脚本被 `script-src 'self'` 阻断，故不构成用户可控样式注入通道（ADR-001 记录该决策与替代方案）。
- `devCsp` 仅额外允许 Vite HMR 的 `ws://localhost:<port>`/`http://localhost:<port>`；生产构建不得包含。
- 不访问 CDN：字体、语法、图表资源随包（R30、NF02；`font-src 'self' data:`）。

## 7. 诊断脱敏与导出校验

**默认脱敏（preview 与日志同策）**：不含正文/选区/查询；不含完整私人路径（家目录 → `~`，中间目录 → `<dir>`，默认保留末两级）；URL 去除 query/fragment 与令牌，仅保留 `scheme://host`；不含剪贴板内容与令牌/密钥类字段；`details` 只允许白名单键。`includeSourceContext`/`includeFullPaths` 仅在用户明确勾选且预览可见时加入（R28；IX14）。

**导出校验（强制顺序）**：
1. `targetPath` 非空且为绝对路径；`exportId` 未过期（过期 → `PS_IO_NOT_FOUND`）。
2. 目标 == 任一当前已打开文档的 canonical 路径 → `PS_IO_EXPORT_BLOCKED`。
3. 目标位于任一当前已打开文档的 canonical 父目录之内（组件级判定）→ `PS_IO_EXPORT_BLOCKED`。
4. 目标已存在且 `overwrite=false` → 拒绝，由 UI 明确确认后重试（IXD §15.3）。
5. 同目录临时文件 + 原子重命名写入；失败保留预览内容供复制，不自动重试到其它路径、不上传（R28）。
6. 导出写入与 logger 均不接触源目录；不产生任何源写入（NF01）。

## 8. 只读保证（R04/NF01）执行点

| 层 | 保证 |
|---|---|
| Rust 路径层 | `services/files` 只提供读取/stat/哈希/解码 API；无写入源路径的函数；所有文件打开只读 |
| Rust 命令层 | 无写源命令；写操作仅限 storage（app 数据目录）、export（校验后用户目标）、cache/日志 |
| 导出 | §7 校验 + 原子写；拒绝受保护源位置与覆盖已打开源文档 |
| asset 协议 | 只读 scope；无法写 |
| 前端 | 正文静态渲染；任务复选框强制 `disabled`；源码视图为只读 `<pre>`（非 textarea/contenteditable）；无保存按钮/写回调用 |
| 数据层 | 库中无正文副本；清除记录不触碰原文件 |
| 测试 | AT04：正常与错误流程比较源字节哈希与目录文件集合；atime 不计为写入证据；错误恢复不创建同名文件、不格式化原文 |

## 9. 追溯

| 条款 | 本文承接 |
|---|---|
| R04/NF01 | §8；导出 §7；数据无正文副本 |
| R07/R25 | §2–§3；撤销语义；启动复核（data-model §3.2） |
| R09 | §5 消毒 schema；`dangerouslySetInnerHTML` 禁令 |
| R10/R12 | §5.2 KaTeX/Mermaid 受控配置 |
| R15 | §2.2 跨文档目标授权；§4 外部链接白名单（contracts.md 命令 31/32） |
| R26/NF02 | §4 远程策略 |
| R28/NF02 | §7 脱敏与导出校验 |
| NF03 | §1–§6 全部控制；恶意样例 fixtures（tests） |
| R30/NF12 | §6 能力最小化；随包资源；ADR-008 发行一致性 |
