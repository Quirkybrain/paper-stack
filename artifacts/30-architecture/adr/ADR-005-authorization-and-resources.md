# ADR-005 授权与资源策略（Authorization and Resource Policy）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `security-model.md` §2–§4、`contracts.md` §3.6、`data-model.md` §3.2

## Context

R25 要求：单文件打开只授予文件读取；关联资源按目录一次确认、范围明确；额外目录授权默认仅应用会话；检查实际目标（根内 `../` 合法、根外与符号链接逃逸拒绝）；“权限令牌不能只由界面传来的绝对路径替代”。R26 要求远程图片默认零请求、会话级允许、受控 HTTPS（重定向、私网、大小、超时）。R07/R27 要求撤销后停止新读取、清除授权不自动从最近重新授予。IX10 固定了确认/撤销交互与默认安全动作。

## Options

- **A：前端持有规范化路径并直接传给 asset/文件接口**。最简，但界面路径即可冒领权限，直接违反 R25；否决。
- **B：Rust 授权注册表 + 每次请求重新校验 + 运行时资产 scope 授予**。路径字符串不构成凭证；撤销即收回 scope。
- **C：自定义协议处理器逐请求鉴权**。控制最细，但需自建协议、范围请求与缓存语义；v0.1.0 复杂度不成比例；作为将来可评估项。
- **D：把源文件复制到应用缓存后统一渲染**。写放大、内存与磁盘成本、缓存失效复杂，且扩大隐私面；否决。

## Decision

采用 B，辅以受控远程获取：

1. 授权类型与作用域按 data-model §3.2：文件（按文档、可撤销）、目录（默认 `session`，显式勾选才 `persistent`）、远程（当前文档会话）。
2. 路径校验按 `security-model.md` §2 的固定顺序：基准目录来自 Rust 注册表；词法清理仅用于相对解析；canonicalize 完全解析符号链接；组件级 `starts_with` 匹配授权根；授予 asset scope 前再次 canonicalize 收窄 TOCTOU；失败返回 `PS_AUTH_OUTSIDE_ROOT` 并附 `rootCandidate` 供 UI 发起一次目录确认。
3. asset URL 只由 Rust 生成并携带 `?v=` 观察键；前端不得构造（contracts.md §2.1）。
4. 远程策略按 `security-model.md` §4：HTTPS-only、origin 会话允许、DNS 解析后私网/环回阻断、最多 3 跳且逐跳校验、大小/时间帽、无自动重试、无 Cookie/Referer。
5. 撤销语义：本地撤销停止新读取并移除 scope；远程撤销取消在途请求、删会话缓存并卸载；持久授权行保留但启动时逐条复核，失败重新确认（R07、R25、R26；data-model §3.2）。
6. 目录树符号链接呈现状态并仅允许根内展开；根外目标走“重新授权”路径而非静默跟随（R02）。

## Consequences

- 正面：权限判定单点、可测试（纯函数 + tempfile fixtures）；界面无法以路径“自带”权限；撤销效果确定。
- 已知残余风险：asset scope 为路径型，授权与 WebView 实际读取之间存在 TOCTOU 窗口（通过授予前重复 canonicalize 收窄，不消除）；文档化并接受，不宣称绝对防护。
- 已撤销授权后，已解码进内存的图片可能仍短暂显示；策略为“停止新读取、允许关闭或保留已加载内容”（R07 明示），不做强制抹除承诺。
- 远程图片仅在允许后产生网络请求，满足 AT26 断网默认零请求的观测口径。

## Constraints

- 授权确认默认安全项、无“始终允许所有”快捷（IX10；R25）。
- 不以提升操作系统权限替代应用内确认；系统权限不足时如实说明（IX10）。
- 所有资源（含生成节点引用的资源）统一经过资源策略（R09）。

## Affected Artifacts

- `security-model.md` §2–§4（算法为规范）、`contracts.md` §3.6（命令 24–30）。
- `data-model.md` §3.2（授权记录与启动复核）。
- 下游：Rust `services/{paths,auth,resources}`、IX10 界面实现、恶意路径/符号链接 fixtures。
