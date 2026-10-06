# 纸栈 PaperStack · v0.1.0 简体中文字符串目录（zh-CN String Catalog）

- **Producer**: agent:experience-designer
- **Artifact ID**: ART-40-STRINGS
- **Artifact Type**: i18n String Catalog（简体中文界面文案，`locales/zh-CN.json` 的规范来源）
- **Status**: VALID
- **Revision**: 1
- **Owner**: experience-designer
- **Task**: `wp-05-ux`（任务分支 `task/wp-05-ux`；父分支 `feat/v0.1.0`；基线提交 `9dbd58b5005f813282a5d3cc13ccb480909769a6`；产出提交主题 `docs(ux): specify v0.1.0 ui and string catalog`）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 v0.1.0；覆盖 `ui-spec.md` §3 全部 UI00–UI07 用户可见文本与辅助技术名称。UI08（LaTeX/PDF）与 F01–F07 无任何键；不提供“建设中”占位文案。
- **Depends On**: `artifacts/40-ux/ui-spec.md`（ART-40-UX Rev 1）；`input/design/02_纸栈_PaperStack_交互设计说明书_V1.0.md`（PS-IXD-001 V1.0，界面权威）；`artifacts/30-architecture/contracts.md`（`paperstack-ipc-r1` §5 `messageKey` 映射）；`artifacts/20-requirements/requirements-baseline.md`（PC-06）。

## 0. 使用规则

1. **调用方式**：组件只调用 `t(key, params?)`（`src/app/i18n.ts`），**不得硬编码自然语言字符串**；参数使用 `{name}` 形式插值。资源文件：`src/locales/zh-CN.json`（ADR-009；计划书 §2.1；PC-06）。
2. **回退策略**：zh-CN 为 v0.1.0 默认与唯一语言；缺失键按 `zh-CN → 原样 key ＋ 开发警告` 回退（架构 §8）。新增语言仅新增 `locales/{locale}.json`，不分叉代码。
3. **键名规范**：小写点分命名空间（`reader.toolbar.open` 风格即本表的 `toolbar.open` 等）；按区域/组件分组；语义稳定，不把整句中文当键。
4. **来源标注**：`IXD §x 行 y` 表示 IXD 原文引用的行号（pinned SHA-256 `786096e3…`）；`spec §x` 表示 `ui-spec.md` 选词（IXD 未冻结，属 VC 记录范围）。
5. **契约错误映射**：§14 的键名与 contracts §5 `messageKey` 列**逐字一致**；UI 只显示该键对应文案，`details` 仅供“详细技术信息”折叠（contracts §5 规则）。
6. **计数与格式**：`{count}`、`{size}`、`{path}` 等由前端格式化助手提供（字节单位、相对时间见 §16）；不得在翻译文本中拼接代码。
7. **排除**：工具栏、菜单、设置中不出现任何后续版本能力文案（LaTeX/PDF/批注/账号/插件；IXD §13.2 末段、requirements-baseline §7.4）。

---

## 1. 应用与通用

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `app.name` | 纸栈 PaperStack | 关于、窗口标题 | IXD §15.1 行 459 |
| `common.cancel` | 取消 | 所有对话框/操作 | spec §3（通用） |
| `common.close` | 关闭 | 通用按钮 | spec §3 |
| `common.confirm` | 确定 | 通用确认（明确动作优先用具体动词） | spec §3 |
| `common.retry` | 重试 | 通用重试入口 | IXD §5.1 行 152 等 |
| `common.remove` | 移除 | 最近列表等 | IXD §4.1 行 122 |
| `common.more` | 更多 | 工具栏 | IXD §2.2 行 68 |
| `common.done` | 完成 | 设置/向导收尾 | spec §3 |
| `common.back` | 返回 | 通用 | spec §3 |
| `common.on` | 开 | 开关状态（辅助技术） | spec §3 |
| `common.off` | 关 | 开关状态（辅助技术） | spec §3 |
| `common.loading` | 正在加载 | 通用加载 | spec §3 |
| `common.unavailable` | 不可用 | 通用状态 | spec §3 |

## 2. UI00 欢迎与最近阅读

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `welcome.title` | 打开一份文档。 | WelcomePage 标题 | IXD §4.1 行 122 |
| `welcome.openFile` | 打开文件 | WelcomePage 主按钮 | IXD §4.1 行 122 |
| `welcome.openDirectory` | 打开目录 | WelcomePage 次按钮 | IXD §4.1 行 122 |
| `welcome.note` | 直接读取本地文件，不移动、不修改原文 | WelcomePage 说明 | IXD §4.1 行 122 |
| `welcome.recent.title` | 最近阅读 | RecentList 标题 | IXD §4.1 行 122 |
| `welcome.recent.unavailable` | 原文件不可用 | RecentList 条目状态 | IXD §4.1 行 124 |
| `welcome.recent.remove` | 移除 | RecentList 条目动作（仅移除记录） | IXD §4.1 行 122 |
| `welcome.recent.removeAria` | 从最近列表移除：{name}（不删除源文件） | RecentList 图标按钮名称 | spec §3.1 |
| `welcome.builtinSample` | 内置示例 | 示例卡标签 | IXD §4.1 行 124 |
| `welcome.builtinSample.note` | 应用内置的示例文档，可离线阅读。 | 示例卡说明 | spec §3.1 |
| `welcome.open.cancelled` | （选择器已取消，界面保持不变） | 无可见文案；仅测试记录 | IXD §4.2 行 127 |

## 3. 工具栏、菜单与标签（UI01）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `toolbar.aria` | 阅读工具栏 | Toolbar 名称 | spec §6.3 |
| `toolbar.open` | 打开 | 工具栏 | IXD §2.2 行 68 |
| `toolbar.open.file` | 打开文件 | 打开菜单项 | IXD §2.2 行 70 |
| `toolbar.open.directory` | 打开目录 | 打开菜单项 | IXD §2.2 行 70 |
| `toolbar.back` | 后退 | 工具栏 | IXD §2.2 行 68 |
| `toolbar.forward` | 前进 | 工具栏 | IXD §2.2 行 68 |
| `toolbar.navToggle` | 导航面板 | 工具栏（切换） | IXD §2.2 行 68 |
| `toolbar.navToggle.show` | 显示导航面板 | 工具提示/名称 | spec §6.3 |
| `toolbar.navToggle.hide` | 收起导航面板 | 工具提示/名称 | spec §6.3 |
| `toolbar.find` | 查找 | 工具栏 | IXD §2.2 行 68 |
| `toolbar.typography` | 显示设置 | Aa 浮层入口 | IXD §2.2 行 68 |
| `toolbar.typography.aria` | 显示设置（Aa） | 图标按钮名称 | spec §6.3 |
| `toolbar.more` | 更多 | 工具栏菜单 | IXD §2.2 行 68 |
| `toolbar.more.aria` | 更多操作 | 图标按钮名称 | spec §6.3 |
| `toolbar.disabled.noBack` | 没有可后退的历史 | 后退禁用原因 | IXD §2.2 行 68；§16.2 行 516 |
| `toolbar.disabled.noForward` | 没有可前进的历史 | 前进禁用原因 | 同上 |
| `toolbar.disabled.noDocument` | 当前没有可搜索的文档 | 查找禁用原因 | 同上 |
| `menu.viewSource` | 查看源码 | 更多菜单（阅读视图） | IXD §2.2 行 70；§8.1 行 248 |
| `menu.backToReading` | 返回阅读 | 更多菜单（源码视图） | IXD §8.1 行 248 |
| `menu.updateBehavior` | 更新行为 | 更多菜单 | IXD §2.2 行 70 |
| `menu.closeDocument` | 关闭文档 | 更多菜单 | IXD §2.2 行 70 |
| `menu.settings` | 完整设置 | 更多菜单 | IXD §2.2 行 70 |
| `menu.about` | 关于 | 更多菜单 | IXD §2.2 行 70 |
| `tabs.aria` | 文档标签 | TabBar 名称 | spec §6.3 |
| `tabs.all` | 所有标签 | 标签溢出入口 | IXD §5.3 行 170 |
| `tabs.close.aria` | 关闭标签：{name} | 标签关闭动作名称 | IXD §5.3 行 170 |
| `tabs.badge.newVersion` | 有新版本 | 标签/文件名标记 | IXD §10.1 行 312 |
| `document.info.title` | 文档信息 | DocumentInfoPanel | IXD §2.2 行 72 |
| `document.info.encoding` | 编码：{value} | DocumentInfoPanel | IXD §2.2 行 72 |
| `document.info.path` | 完整路径：{path} | DocumentInfoPanel | IXD §2.2 行 72 |
| `document.info.version` | 内容版本：{value} | DocumentInfoPanel | IXD §2.2 行 72 |
| `document.info.issues` | 资源问题 | DocumentInfoPanel | IXD §2.2 行 72 |
| `document.info.readonly` | 只读 | 文档信息/状态 | IXD §2.2 行 72；§8.1 |
| `document.info.close` | 关闭文档信息 | 面板关闭 | spec §3.2 |

## 4. 文档状态、更新与阅读异常（UI01/UI07）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `document.empty` | 文档为空 | 正文空文件状态 | IXD §4.2 行 135 |
| `document.loading.read` | 正在读取 | 加载阶段（>1s） | IXD §4.2 行 128 |
| `document.loading.parse` | 正在解析 | 加载阶段（>1s） | IXD §4.2 行 128 |
| `document.loading.cancel` | 取消 | 长任务取消 | IXD §4.2 行 128 |
| `document.unavailable.title` | 找不到原文件 | 源不可用提示 | IXD §11.1 行 338 |
| `document.unavailable.message` | 保留了已加载内容，但它可能不是最新版本。 | 源不可用提示 | IXD §11.1 行 338 |
| `document.unavailable.relink` | 重新定位 | 源不可用动作 | IXD §11.1 行 338 |
| `document.unavailable.closeTab` | 关闭标签 | 源不可用动作 | IXD §11.1 行 338 |
| `document.relink.reassociated` | 已重新关联同一文件，恢复原文档身份。 | relink 结果 | IXD §11.1 行 340 |
| `document.relink.newVersion` | 所选文件内容与已加载内容不同，将按新版本处理，位置可能只能近似恢复。 | relink 结果（先说明后采用） | IXD §11.1 行 340 |
| `document.position.notSaved` | 本次位置未能保存，下次可能无法恢复。 | 位置保存失败提示 | IXD §16.2 行 514 |
| `document.state.notSaved` | 本次阅读位置可能无法保存。 | 数据库/偏好保存失败降级 | IXD §11.1 行 342 |
| `document.badge.simplified` | 简化阅读 | 简化模式状态标签 | IXD §11.2 行 350 |
| `document.badge.sourceOnly` | 只读源码 | 源码窗口模式标签 | IXD §11.2 行 351 |
| `document.badge.unavailable` | 原文件不可用 | 标签/文件名状态 | IXD §11.1 行 338 |
| `update.banner` | 文件已有新版本。你正在阅读的内容未改变。 | UpdateBanner | IXD §10.1 行 310 |
| `update.badge` | 有新版本 | 文件名/标签标记（可再次展开） | IXD §10.1 行 312 |
| `update.action.now` | 现在更新 | UpdateBanner 主按钮 | IXD §10.1 行 310 |
| `update.action.later` | 稍后 | UpdateBanner 次按钮（仅折叠） | IXD §10.1 行 310–312 |
| `update.paused.selection` | 为保留选中文本，已暂停自动更新。 | 跟随模式·有选区 | IXD §10.2 行 320；§16.2 行 508 |
| `update.paused.inspect` | 为保留当前操作，已暂停自动更新。 | 跟随模式·检查层 | IXD §10.2 行 320 |
| `update.action.updateAndClearSelection` | 更新并清除选区 | 选区下主动更新按钮 | IXD §10.2 行 322 |
| `update.action.continueReading` | 继续阅读 | 暂停提示动作 | IXD §16.2 行 508 |
| `update.position.exact` | 已更新，已保持阅读位置 | 提交后精确提示 | IXD §10.3 行 328 |
| `update.position.approx` | 已更新，位置近似恢复 | 提交后近似提示 | IXD §10.3 行 328 |
| `update.action.viewChapter` | 查看当前章节 | 近似恢复动作 | IXD §16.2 行 509 |
| `nav.return.exact` | 已恢复阅读位置 | 历史返回·唯一匹配 | IXD §6.4 行 207 |
| `nav.return.approx` | 文档已更新，已恢复到相近章节 | 历史返回·近似 | IXD §6.4 行 207 |
| `update.mode.keep` | 保持当前阅读 | 更新行为选项（默认） | IXD §13.2 行 408；R21 |
| `update.mode.follow` | 跟随最新版本 | 更新行为选项 | IXD §13.2 行 408；R21 |

## 5. 导航面板（UI02）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `nav.aria` | 导航面板 | NavPanel 名称 | spec §6.3 |
| `nav.tab.files` | 文件 | 面板切换 | IXD §2.1 行 58 |
| `nav.tab.outline` | 大纲 | 面板切换 | IXD §2.1 行 58 |
| `nav.fileTree.aria` | 文件树 | FileTree 名称 | spec §6.3 |
| `nav.outline.aria` | 文档大纲 | OutlineTree 名称 | spec §6.3 |
| `nav.showOtherFiles` | 显示其他文件 | 文件树过滤 | IXD §5.1 行 150 |
| `nav.retry` | 重试 | 节点加载失败 | IXD §5.1 行 152 |
| `nav.loading` | 正在加载 | 目录/节点加载 | spec §3.3 |
| `nav.empty.directory` | 此目录为空。 | 空目录状态 | spec §3.3（R02 空目录） |
| `nav.empty.outline` | 此文档没有标题。 | 空大纲状态 | spec §3.3 |
| `nav.node.noPermission` | 无权限 | 节点状态 | IXD §5.1 行 152；R02 |
| `nav.node.outsideRoot` | 超出授权范围 | 节点状态 | IXD §5.1；R25 |
| `nav.node.symlinkOutside` | 链接指向授权范围之外 | 节点状态 | R02/R25 |
| `nav.node.missing` | 已缺失 | 节点状态 | R02 |
| `nav.node.truncated` | 目录内容较多，仅显示部分条目。 | 目录列表截断 | spec §3.3（contracts 上限 2000） |
| `nav.unsupported` | 本版不支持打开此类型文件。 | 不支持类型点击 | IXD §5.1 行 150 |

## 6. 页内搜索（UI03）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `search.aria` | 页内搜索 | SearchBar 名称 | spec §6.3 |
| `search.placeholder` | 查找 | 输入框占位 | spec §3.4 |
| `search.scope.body` | 正文 | 范围选项 | IXD §7.1 行 217 |
| `search.scope.source` | 源码 | 范围选项 | IXD §7.1 行 217 |
| `search.caseSensitive` | 区分大小写 | 选项 | IXD §7.1 行 217 |
| `search.counter` | {current}/{total} | 当前/总数（0/N 为未选择态） | IXD §7.1 行 219 |
| `search.counter.aria` | 第 {current} 项，共 {total} 项 | 辅助技术播报 | spec §6.3 |
| `search.prev` | 上一项 | 按钮 | IXD §7.1 行 217 |
| `search.next` | 下一项 | 按钮 | IXD §7.1 行 217 |
| `search.close` | 关闭搜索 | 关闭按钮（Esc 等价） | IXD §7.1 行 217 |
| `search.indexing` | 正在建立全文索引 | 索引未就绪状态 | IXD §7.2 行 229 |
| `search.noResults` | 未在当前正文中找到 | 无结果状态 | IXD §7.2 行 231 |
| `search.noResults.hint` | 可切换到源码查找 | 无结果建议 | IXD §7.2 行 231 |
| `search.wrapped.first` | 已回到第一项 | 循环提示 | IXD §7.2 行 230 |
| `search.wrapped.last` | 已回到最后一项 | 循环提示 | IXD §7.2 行 230 |
| `search.formulaMatch` | 公式源码匹配 | 命中标记 | IXD §7.2 行 233 |
| `search.formulaMatch.inspect` | 检查源码 | 命中动作 | IXD §7.2 行 233 |
| `search.incomplete` | 结果未完成，未完整扫描全部内容 | 取消/超预算状态 | IXD §7.2 行 234 |
| `search.cancelled` | 搜索已取消 | 取消状态 | IXD §7.2 行 234 |
| `search.enterHint` | Enter 下一项，Shift+Enter 上一项 | 输入提示（首次未选择时为第一/最后一项） | IXD §7.1 行 219；§17.1 行 529 |

## 7. 只读源码（UI04）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `source.title` | 源码 · 只读 | 源码视图顶部 | IXD §8.1 行 248 |
| `source.back` | 返回阅读 | 视图切换按钮 | IXD §8.1 行 248 |
| `source.loading` | 正在读取源码片段 | 窗口加载 | spec §3.5 |
| `source.window` | 已显示第 {start}–{end} 行，共 {total} 行 | >50MiB 窗口说明 | IXD §11.2 行 351；R29 |
| `source.scanIncomplete` | 已扫描 {scanned} 字节，共 {total} 字节，结果不完整 | 源码搜索完整性说明 | IXD §11.2 行 355；contracts §2.1 |
| `source.notLocated` | 未能精确定位，已返回最近位置 | 返回映射失败 | IXD §8.1 行 250；R18 |

## 8. 内容检查与放大（UI05）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `inspect.aria` | 内容检查 | InspectDrawer 名称 | spec §6.3 |
| `inspect.close` | 关闭内容检查 | 抽屉关闭 | spec §3.6 |
| `inspect.sourceChanged` | 来源内容已更新，已回到最近位置 | 目标消失提示 | IXD §8.2 行 256 |
| `formula.drawer.title` | 公式 | 公式抽屉 | IXD §8.2 行 254 |
| `formula.action.viewSource` | 查看源码 | 公式工具 | IXD §8.2 行 254 |
| `formula.action.copySource` | 复制源码 | 公式工具 | IXD §8.2 行 254 |
| `formula.action.zoom` | 放大 | 公式工具 | IXD §8.2 行 254 |
| `formula.copied` | 已复制 | 复制成功（约 1.5s 恢复） | IXD §8.2 行 255 |
| `formula.copyFailed` | 复制失败，请重试或手动选择文本。 | 复制失败（持久） | IXD §16.2 行 513 |
| `formula.sourceLabel` | 公式源码 | 抽屉字段（不含 $） | IXD §8.2 行 254 |
| `formula.chapterLabel` | 来源章节 | 抽屉字段 | IXD §8.2 行 254 |
| `formula.diagnostics` | 诊断 | 抽屉字段 | IXD §8.2 行 254 |
| `code.action.copy` | 复制 | 代码块操作 | IXD §8.3 行 262 |
| `code.action.copyAria` | 复制此代码块 | 复制按钮名称（对象化） | IXD §8.3 行 267 |
| `code.copied` | 已复制 | 复制成功 | IXD §8.2 行 255（通用规则） |
| `code.copyFailed` | 复制失败，请重试或手动选择文本。 | 复制失败 | IXD §16.2 行 513 |
| `code.action.wrap` | 换行 | 代码块切换（会话偏好） | IXD §8.3 行 263 |
| `code.action.wrapAria` | 切换代码换行 | 切换名称 | spec §3.6 |
| `code.action.expand` | 展开全部 {count} 行 | 长块折叠入口 | IXD §8.3 行 264 |
| `code.action.collapse` | 收起 | 折叠块收起 | spec §3.6 |
| `code.collapsed` | 已折叠：显示前 {shown} 行，共 {total} 行 | 折叠状态说明 | IXD §8.3 行 264 |
| `code.action.viewSource` | 查看源码 | 代码块操作 | IXD §8.3 行 265 |
| `code.lineCount` | 共 {count} 行 | 行数说明 | spec §3.6 |
| `mermaid.action.viewSource` | 查看源码 | 图表工具 | IXD §9.3 行 289 |
| `mermaid.action.zoom` | 放大 | 图表工具 | IXD §9.3 行 289 |
| `mermaid.error.title` | 图表渲染失败 | 局部错误 | IXD §9.3 行 297 |
| `mermaid.error.type` | 图种：{type} | 诊断 | IXD §9.3 行 289 |
| `mermaid.error.engine` | 引擎版本：{version} | 诊断 | IXD §9.3 行 289 |
| `mermaid.error.summary` | 错误摘要：{summary} | 诊断 | IXD §9.3 行 289 |
| `mermaid.error.range` | 定位范围：{range} | 诊断 | IXD §9.3 行 289 |
| `mermaid.unsupported` | 本版支持流程图、时序图与类图；此图种不在支持范围内。 | 不支持图种 | IXD §9.3 行 298；R12 |
| `mermaid.timeout` | 图表渲染超过资源限制，已停止。可查看源码继续阅读。 | 超时/节点超限 | IXD §9.3 行 298 |
| `image.missing` | 找不到这张图片 | 图片不存在 | IXD §9.3 行 293 |
| `image.outsideRoot` | 图片位于当前授权目录之外 | 越界资源 | IXD §9.3 行 294 |
| `image.remoteBlocked` | 已阻止远程图片 | 远程未允许 | IXD §9.3 行 295 |
| `image.loadFailed` | 图片加载失败 | 一般加载失败 | spec §3.6 |
| `image.tooLarge` | 图片超过本版大小或解码限制 | 超限 | IXD §9.3 行 296 |
| `image.decodeFailed` | 图片无法解码或格式不受支持 | 损坏/格式 | IXD §9.3 行 296 |
| `image.viewPath` | 查看相对路径 | 缺失图片动作 | IXD §9.3 行 293 |
| `image.relPath` | 相对路径：{path} | 路径展示 | IXD §9.3 行 293 |
| `image.allowScope` | 选择允许的范围 | 越界动作 | IXD §16.2 行 511 |
| `image.learnRemote` | 了解连接范围 | 远程阻止动作 | IXD §9.3 行 295 |
| `image.allowOnce` | 本次允许 | 远程阻止动作 | IXD §9.3 行 295 |
| `image.retry` | 重试 | 加载失败动作 | IXD §9.3 行 296；R26 |
| `image.gifStatic` | 动图首版仅显示静态首帧。 | GIF 信息说明 | IXD §9.1 行 277 |
| `image.placeholder.alt` | 暂无替代文本 | 无 alt 时的提示（不虚构图像含义） | IXD §9.1 行 279 |
| `zoom.title` | 放大查看 | ZoomOverlay 标题 | IXD §9.2 行 283 |
| `zoom.close` | 关闭放大查看 | 覆盖层关闭 | IXD §9.2 行 283 |
| `zoom.in` | 放大 | 缩放按钮 | IXD §9.2 行 283 |
| `zoom.out` | 缩小 | 缩放按钮 | IXD §9.2 行 283 |
| `zoom.fitWidth` | 适宽 | 缩放按钮 | IXD §9.2 行 283 |
| `zoom.reset` | 100% | 重置按钮 | IXD §9.2 行 283 |
| `zoom.hint` | 滚轮平移内容；Ctrl+滚轮缩放。 | 操作说明 | IXD §9.2 行 285 |
| `zoom.arrowHint` | 方向键平移内容 | 非拖拽替代 | IXD §9.2 行 283 |

## 9. 设置（Aa 浮层与完整设置，UI06）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `settings.title` | 设置 | SettingsDialog | IXD §2.2 行 70 |
| `settings.category.reading` | 阅读 | 设置分类 | IXD §13.2 行 407 |
| `settings.category.fileUpdate` | 文件与更新 | 设置分类 | IXD §13.2 行 408 |
| `settings.category.syntax` | 语法 | 设置分类 | IXD §13.2 行 409 |
| `settings.category.privacy` | 隐私 | 设置分类 | IXD §13.2 行 410 |
| `settings.category.about` | 关于 | 设置分类 | IXD §13.2 行 411 |
| `settings.reading.fontSize` | 正文字号 | ReadingSection/Aa | IXD §13.1 行 399 |
| `settings.reading.lineHeight` | 行距 | ReadingSection/Aa | IXD §13.1 行 399 |
| `settings.reading.maxWidth` | 正文宽度 | ReadingSection/Aa | IXD §13.1 行 399 |
| `settings.reading.theme` | 主题 | ReadingSection/Aa | IXD §13.1 行 399 |
| `settings.reading.theme.system` | 跟随系统 | 主题选项（默认） | IXD §13.1；SRS §6.1 |
| `settings.reading.theme.light` | 浅色 | 主题选项 | IXD §13.1 行 399 |
| `settings.reading.theme.dark` | 深色 | 主题选项 | IXD §13.1 行 399 |
| `settings.reading.restoreSession` | 启动时恢复上次阅读 | ReadingSection | IXD §13.2 行 407 |
| `settings.reading.restoreDefaults` | 恢复显示默认 | Aa/ReadingSection（仅显示字段） | IXD §13.3 行 419 |
| `settings.reading.range.fontSize` | 范围 14–24px | 字段提示 | IXD §3.2 行 106；§13.1 行 399 |
| `settings.reading.range.lineHeight` | 范围 1.5–2.2 | 字段提示 | IXD §3.2 行 106 |
| `settings.reading.range.maxWidth` | 范围 560–960px | 字段提示 | IXD §3.2 行 106 |
| `settings.reading.invalidValue` | 数值超出范围，已保留上一个有效值。 | 无效输入反馈 | IXD §13.1 行 399 |
| `settings.fileUpdate.defaultLabel` | 新文档默认更新行为 | FileUpdateSection | IXD §13.2 行 408 |
| `settings.fileUpdate.keepDesc` | 发现新版本时保持当前内容，等待你确认更新。 | 选项说明 | spec §3.7 |
| `settings.fileUpdate.followDesc` | 文档在前台且没有选区或检查操作时，自动更新到最新版本。 | 选项说明 | spec §3.7 |
| `settings.fileUpdate.currentLabel` | 当前文档更新行为 | FileUpdateSection | IXD §13.2 行 408 |
| `settings.fileUpdate.currentScope` | 当前文档覆盖仅在本次文档会话内有效。 | 作用域说明 | IXD §13.2 行 408 |
| `settings.syntax.mode` | 语法模式 | SyntaxSection | IXD §13.2 行 409 |
| `settings.syntax.technical` | 技术文档（默认） | 模式选项 | IXD §13.2 行 409；R08 |
| `settings.syntax.standard` | 标准 Markdown | 模式选项 | IXD §13.2 行 409；R08 |
| `settings.syntax.inlineDollar` | 行内美元公式 | 当前文档开关 | IXD §13.2 行 409；R10 |
| `settings.syntax.inlineDollarHint` | 关闭后 $…$ 按原文显示，$$ 块公式不受影响。 | 选项说明 | 渲染管线 §2.3；R10 |
| `settings.privacy.remember` | 记住阅读记录 | PrivacySection | IXD §13.2 行 410；§14.1 行 439 |
| `settings.privacy.rememberHint` | 关闭后停止写入最近、位置与会话记录。 | 选项说明 | IXD §14.1 行 439 |
| `settings.privacy.clear` | 清除已有记录 | PrivacySection 入口 | IXD §14.1 行 439 |
| `settings.privacy.grants` | 持久授权 | PrivacySection | IXD §13.2 行 410 |
| `settings.privacy.grantsEmpty` | 暂无持久授权。 | 空列表 | spec §3.7 |
| `settings.privacy.revoke` | 撤销 | 授权行动作 | IXD §12.1 行 385；R25 |
| `settings.privacy.logs` | 诊断日志 | PrivacySection | IXD §13.2 行 410 |
| `settings.privacy.logsUsage` | 当前用量：{size}（上限 {max}） | 日志/缓存用量 | spec §3.7（SRS §6.1：10MiB/256MiB） |
| `settings.privacy.noSourceDelete` | 清除操作不会删除原始文档。 | 清除说明 | IXD §14.1 行 429 |
| `settings.saveFailed` | 本次已生效，但未能保存到本地 | 设置保存失败提示 | IXD §13.3 行 417 |
| `settings.saveFailed.retry` | 重试 | 保存失败动作 | IXD §13.3 行 417 |

## 10. 隐私与清除（UI06）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `dialog.clear.title` | 清除记录 | ClearDataDialog | IXD §14.1 行 429 |
| `dialog.clear.intro` | 选择要清除的类别。清除操作不会删除原始文档。 | ClearDataDialog 说明 | IXD §14.1 行 429 |
| `storage.category.recents` | 最近阅读 | 类别行 | IXD §14.1 行 431–437 |
| `storage.category.positions` | 位置记录 | 类别行 | IXD §14.1 行 431–437 |
| `storage.category.session` | 会话记录 | 类别行 | IXD §14.1 行 431–437 |
| `storage.category.positionsSession` | 位置与会话 | UI 合并类别显示 | IXD §14.1 行 433 |
| `storage.category.cache` | 缓存 | 类别行 | IXD §14.1 行 434 |
| `storage.category.authorizations` | 授权 | 类别行 | IXD §14.1 行 435 |
| `storage.category.logs` | 诊断日志 | 类别行 | IXD §14.1 行 436 |
| `dialog.clear.desc.recents` | 从最近列表移除所选历史，不删除原文。 | 类别说明 | IXD §14.1 行 433 |
| `dialog.clear.desc.positions` | 下次不恢复被清除的位置；当前会话停止继续写回。 | 类别说明 | IXD §14.1 行 434 |
| `dialog.clear.desc.session` | 下次不恢复被清除的会话；当前会话停止继续写回。 | 类别说明 | IXD §14.1 行 434 |
| `dialog.clear.desc.cache` | 移除可重建的磁盘缓存；已打开的正文不受影响。 | 类别说明 | IXD §14.1 行 435 |
| `dialog.clear.desc.authorizations` | 停止对应授权的新读取并删除授权记录。 | 类别说明 | IXD §14.1 行 436 |
| `dialog.clear.desc.logs` | 移除指定的诊断日志，不会上传日志。 | 类别说明 | IXD §14.1 行 437 |
| `dialog.clear.usage` | {count} 项 · {size} | 类别数量/空间 | IXD §14.1 行 429 |
| `dialog.clear.usageCount` | {count} 项 | 类别数量 | IXD §14.1 行 429 |
| `dialog.clear.action.recents` | 清除{count}条最近记录 | 选中后按钮（示例格式） | IXD §14.1 行 429 |
| `dialog.clear.action.generic` | 清除所选类别 | 多类别选中按钮 | spec §3.8 |
| `dialog.clear.result.partial` | 部分类别未能清除，请查看各项结果。 | 部分失败结果 | IXD §14.3 行 449 |
| `dialog.clear.result.cleared` | 已清除 {count} 项 | 单类成功结果 | spec §3.8 |
| `dialog.clear.result.done` | 清除完成 | 成功汇总 | spec §3.8 |

## 11. 权限对话框（UI07）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `dialog.authLocal.title` | 允许读取此目录中的关联资源？ | AuthLocalDialog | IXD §12.1 行 369 |
| `dialog.authLocal.scope` | 授权范围：{path} | 规范化范围 | IXD §12.1 行 369 |
| `dialog.authLocal.count` | 涉及资源：{count} 个 | 资源数量 | IXD §12.1 行 369 |
| `dialog.authLocal.noWrite` | 只用于读取此目录中的关联资源，不会写入你的原文件。 | 说明 | IXD §12.1 行 369 |
| `dialog.authLocal.allow` | 允许本次读取 | 按钮 | IXD §12.1 行 371 |
| `dialog.authLocal.blocked` | 保持阻止 | 按钮（安全默认） | IXD §12.1 行 371；§12.3 行 389 |
| `dialog.authLocal.remember` | 记住此目录授权 | 复选框（默认不选） | IXD §12.1 行 371 |
| `dialog.authLocal.rememberHint` | 默认不勾选；勾选后下次启动仍可访问此目录。 | 复选框说明 | IXD §12.1 行 371；R25 |
| `dialog.authLocal.osDenied` | 系统未允许读取此位置，需要在系统中授予权限。 | 操作系统权限说明 | IXD §12.1 行 373 |
| `dialog.authRemote.title` | 加载将连接以下图片服务器 | AuthRemoteDialog | IXD §12.2 行 377 |
| `dialog.authRemote.domains` | 目标域名 | 域名列表标签 | IXD §12.2 行 377 |
| `dialog.authRemote.allow` | 本次文档允许加载 | 按钮（仅当前文档会话） | IXD §12.2 行 377 |
| `dialog.authRemote.blocked` | 保持阻止 | 按钮（安全默认） | IXD §12.2 行 377 |
| `dialog.authRemote.sessionNote` | 仅对当前文档会话生效；关闭文档、撤销或退出后失效。 | 会话级说明 | IXD §12.2 行 377；R26 |
| `dialog.authRemote.redirectBlocked` | 图片重定向到了未确认的地址，已阻止。 | 重定向阻止 | IXD §12.2 行 379；contracts §5 |

## 12. 大文档（UI07）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `largeDoc.title` | 大文档阅读 | LargeDocDialog | IXD §11.2 行 346 |
| `largeDoc.message` | 这个文档较大（{size}），请选择打开方式。 | 提示 | IXD §11.2 行 348 |
| `largeDoc.simplified` | 简化阅读 | 选项 1 | IXD §11.2 行 350 |
| `largeDoc.simplifiedDesc` | 保留全文文本与基础结构；公式、图表等重型内容显示源码。搜索与复制完整可用。 | 选项说明 | IXD §11.2 行 350 |
| `largeDoc.sourceOnly` | 只读源码 | 选项 2 | IXD §11.2 行 351 |
| `largeDoc.sourceOnlyDesc` | 以可控方式显示解码文本，可查找与复制，不做重型渲染。 | 选项说明 | IXD §11.2 行 351 |
| `largeDoc.cancel` | 取消 | 选项 3 | IXD §11.2 行 352 |
| `largeDoc.hardLimit` | 文件超过本版处理上限（50MiB），本版不进行全量渲染，请选择其他文件。 | 硬上限说明 | IXD §11.2 行 353；SRS §6.1 |
| `largeDoc.coverage` | 已显示范围与全文索引范围将分别说明。 | 覆盖说明 | IXD §11.2 行 355 |

## 13. 诊断（UI06/UI07）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `diagnostics.title` | 诊断 | DiagnosticsPanel | IXD §15.2 行 467 |
| `diagnostics.reason` | 无法读取这个文件 | 简明原因（示例） | IXD §15.2 行 467 |
| `diagnostics.category` | 错误类别 | 字段 | IXD §15.2 行 467 |
| `diagnostics.docVersion` | 文档展示版本 | 字段 | IXD §15.2 行 467 |
| `diagnostics.sourceLocation` | 源位置：{range} | 字段（行号展示） | IXD §15.2 行 467 |
| `diagnostics.details` | 详细技术信息 | 折叠区 | IXD §15.2 行 467 |
| `diagnostics.retry` | 重试 | 动作 | IXD §15.2 行 467 |
| `diagnostics.continue` | 继续阅读 | 动作 | IXD §15.2 行 467 |
| `diagnostics.copySummary` | 复制诊断摘要 | 动作（默认脱敏） | IXD §15.2 行 469 |
| `diagnostics.copy.copied` | 已复制 | 复制成功 | IXD §8.2 行 255（通用规则） |
| `diagnostics.copy.failed` | 复制失败，请重试或手动选择文本。 | 复制失败 | IXD §16.2 行 513 |
| `diagnostics.export` | 导出诊断 | 动作 | IXD §15.3 行 473 |
| `diagnostics.preview.title` | 诊断预览 | ExportPreviewDialog | IXD §15.3 行 473 |
| `diagnostics.preview.redacted` | 已默认脱敏；不包含正文与私人路径。 | 预览说明 | IXD §15.2 行 469；R28 |
| `diagnostics.preview.includeSource` | 包含源码上下文 | 复选框（默认不选） | IXD §15.2 行 469 |
| `diagnostics.preview.includePaths` | 包含完整路径 | 复选框（默认不选） | IXD §15.2 行 469；R28 |
| `diagnostics.preview.redactions` | 已脱敏 {count} 处 | 预览统计 | spec §3.8（contracts DiagnosticsPreview） |
| `diagnostics.preview.copy` | 复制 | 预览动作 | spec §3.8 |
| `diagnostics.export.chooseTarget` | 选择保存位置 | 动作 | IXD §15.3 行 473 |
| `diagnostics.export.overwrite` | 目标文件已存在，是否覆盖？ | 覆盖确认 | IXD §15.3 行 479 |
| `diagnostics.export.blocked` | 该位置是受保护的源文件或源目录，请另选位置。 | 受保护位置拒绝 | IXD §15.3 行 479；R04 |
| `diagnostics.export.saveFailed` | 保存失败。预览内容已保留，可手动复制。 | 写失败 | IXD §15.3 行 479 |
| `diagnostics.export.success` | 已导出到 {path} | 成功结果 | IXD §15.3 行 473 |
| `diagnostics.errorId` | 错误编号：{id} | 未知错误 | IXD §15.2；R28 |
| `diagnostics.unknown` | 发生未预期错误 | 未知错误标题 | R28 |

## 14. 错误消息（contracts §5 `messageKey` 逐字映射）

| key（= messageKey） | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `error.io.notFound` | 找不到文件或资源。 | 块内/对话框/通知 | contracts §5；IXD §16.2 |
| `error.io.permission` | 没有读取权限。 | 打开/读取失败 | contracts §5 |
| `error.io.readFailed` | 读取文件失败。 | 打开/读取失败 | contracts §5 |
| `error.io.writeFailed` | 写入失败，请检查应用目录空间与权限。 | 设置/导出失败 | contracts §5 |
| `error.io.changed` | 文件在读取期间发生变化，请重试。 | 更新读取不稳定 | contracts §7.4；R22 |
| `error.io.exportBlocked` | 该位置是受保护的源位置；请另选保存位置。 | 诊断导出 | contracts §5；R28 |
| `error.encoding.unsupported` | 此文件不是 UTF-8 编码，本版暂不支持。 | 打开失败 | contracts §5；R03 |
| `error.encoding.formatUnsupported` | 本版仅支持 .md 与 .markdown 文件。 | 打开失败 | contracts §5；R03 |
| `error.auth.denied` | 需要你的授权才能继续。 | 资源/读取 | contracts §5；R25 |
| `error.auth.revoked` | 授权已被撤销，已停止新的读取。 | 授权撤销后 | contracts §5；R07 |
| `error.auth.outsideRoot` | 目标位于当前授权目录之外。 | 资源/链接 | contracts §5；R25 |
| `error.resource.remoteBlocked` | 已阻止远程图片。 | 块内占位 | contracts §5；R26 |
| `error.resource.remoteProtocol` | 仅支持 HTTPS 图片地址。 | 远程图片 | contracts §5；R26 |
| `error.resource.redirectBlocked` | 图片重定向到了未确认的地址，已阻止。 | 远程图片 | contracts §5；R26 |
| `error.resource.remoteLimit` | 远程图片超过大小或超时限制。 | 远程图片 | contracts §5；R26 |
| `error.resource.remoteFailed` | 远程图片加载失败。 | 远程图片（可手动重试） | contracts §5；R26 |
| `error.resource.missing` | 找不到这张图片。 | 块内占位 | contracts §5；IXD §9.3 行 293 |
| `error.resource.decode` | 图片无法解码或格式不受支持。 | 块内占位 | contracts §5；R13 |
| `error.resource.unsupported` | 不支持此链接或资源类型。 | 链接/资源 | contracts §5；R15 |
| `error.parse.local` | 此处内容渲染失败，已显示可读回退。 | 块内诊断（公式/图表/代码） | contracts §5；R10–R12 |
| `error.parse.document` | 文档解析失败，已回退到源码视图。 | 文档级回退 | contracts §5；渲染 §2.1 |
| `error.storage.dbFailure` | 本地记录读写失败；本次阅读不受影响。 | 通知/设置 | contracts §5；NF08 |
| `error.storage.migration` | 记录迁移失败，旧记录暂不可用。 | 启动/隐私 | contracts §5；ADR-004 |
| `error.storage.unavailable` | 本地存储不可用，已进入内存阅读模式。 | 启动/通知 | contracts §5；NF08 |
| `error.limit.size` | 文件超过本版全量处理上限，可用源码分段查看。 | 打开失败/大文档 | contracts §5；R29 |
| `error.limit.complexity` | 文档复杂度超过预算，可切换简化阅读。 | 大文档 | contracts §5；R29 |
| `error.limit.image` | 图片超过本版大小或像素上限。 | 块内占位 | contracts §5；R13/R29 |
| `error.limit.mermaid` | 图表超过节点数或时间限制。 | 图表占位 | contracts §5；R12/R29 |
| `error.limit.search` | 搜索超出预算，结果可能不完整。 | 搜索状态 | contracts §5；R17/R29 |
| `error.internal.unexpected` | 发生未预期错误。 | 通用错误 | contracts §5；R28 |
| `error.internal.cancelled` | 操作已取消。 | 任务取消（不展示为失败） | contracts §5 |
| `error.internal.worker` | 解析组件不可用，已回退到备用解析。 | 通知/诊断 | contracts §5；ADR-002 |

## 15. 关于与许可证（UI06）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `about.title` | 关于 | AboutSection | IXD §15.1 行 459 |
| `about.product` | 纸栈 PaperStack | 关于页 | IXD §15.1 行 459 |
| `about.version` | 版本 {version} | 关于页（真实版本） | IXD §15.1 行 459 |
| `about.owner` | 所属者：Quirkybrain | 关于页 | IXD §15.1 行 459 |
| `about.license` | GNU GPL v3.0（GPL-3.0-only） | 关于页 | IXD §15.1 行 459 |
| `about.viewLicense` | 查看许可证 | 关于页动作（离线） | IXD §15.1 行 461 |
| `about.thirdParty` | 第三方声明 | 关于页动作（离线） | IXD §15.1 行 461 |
| `about.buildInfo` | 构建信息 | 关于页动作 | IXD §15.1 行 461 |
| `about.source` | 获取对应源码 | 关于页动作（真实发行元数据） | IXD §15.1 行 461；R30 |
| `about.sourceUnconfigured` | 未配置对应源码入口；公开发行前必须补齐。 | 无配置时的原因 | IXD §15.1 行 461；SRS R30 |
| `about.gplNote` | 本软件按 GPLv3 提供、无担保（除非另有明确承诺），用户可按许可证条件传播与修改。 | 关于页说明 | IXD §15.1 行 463 |
| `about.offlineNote` | 许可证与第三方声明随应用提供，可离线查看。 | 关于页说明 | IXD §15.4 行 483 |
| `about.website` | 项目网站 | 关于页动作（用户主动点击后联网） | IXD §15.4 行 483 |
| `legal.license.title` | 许可证 | LegalTextViewer | IXD §15.1 行 461 |
| `legal.thirdParty.title` | 第三方声明 | LegalTextViewer | IXD §15.1 行 461 |
| `legal.close` | 关闭 | LegalTextViewer | spec §3.7 |

## 16. 键盘快捷键与帮助（关于页离线内容）

> 快捷键组合本身为界面常量（不翻译）；下表仅登记可翻译的动作描述键。快捷键表内容对应 IXD §17.1 行 522–536。

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `shortcuts.title` | 键盘快捷键 | 关于页/帮助 | IXD §15.4 行 483 |
| `shortcuts.intro` | 以下快捷键可在当前版本使用。 | 帮助说明 | spec §3.7 |
| `shortcuts.action.openFile` | 打开文件 | Ctrl+O | IXD §17.1 行 526 |
| `shortcuts.action.openDirectory` | 打开目录 | Ctrl+Shift+O | IXD §17.1 行 527 |
| `shortcuts.action.find` | 页内查找 | Ctrl+F | IXD §17.1 行 528 |
| `shortcuts.action.searchNextPrev` | 下一项／上一项 | Enter／Shift+Enter（仅搜索输入、非输入法组合） | IXD §17.1 行 529 |
| `shortcuts.action.backForward` | 后退／前进 | Alt+左／右 | IXD §17.1 行 530 |
| `shortcuts.action.closeDocument` | 关闭当前文档 | Ctrl+W | IXD §17.1 行 531 |
| `shortcuts.action.nextPrevTab` | 下一个／上一个标签 | Ctrl+Tab／Ctrl+Shift+Tab | IXD §17.1 行 532 |
| `shortcuts.action.toggleNav` | 导航区显示／收起 | Ctrl+B | IXD §17.1 行 533 |
| `shortcuts.action.settings` | 打开设置 | Ctrl+, | IXD §17.1 行 534 |
| `shortcuts.action.fontSize` | 正文增大／减小／重置字号 | Ctrl++／Ctrl+-／Ctrl+0 | IXD §17.1 行 535 |
| `shortcuts.action.escape` | 关闭最上层临时区域 | Esc（不退出应用） | IXD §17.1 行 536 |
| `shortcuts.menu` | 快捷键与帮助 | 关于页入口 | IXD §15.4 行 483 |

## 17. 辅助技术名称与提示（aria/tooltip）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `aria.toolbar` | 阅读工具栏 | Toolbar | spec §6.3 |
| `aria.tabs` | 文档标签 | TabBar | spec §6.3 |
| `aria.tabpanel` | 文档内容 | 正文容器 | spec §6.3 |
| `aria.skipToBody` | 跳到正文 | SkipLink | IXD §17.2 行 540 |
| `aria.documentBody` | 文档正文 | main landmark | spec §6.3 |
| `aria.updateBanner` | 文件更新提示 | Banner | spec §6.3 |
| `aria.recentList` | 最近阅读 | RecentList | spec §6.3 |
| `aria.inspectDrawer` | 内容检查 | InspectDrawer | spec §6.3 |
| `aria.zoomDialog` | 放大查看 | ZoomOverlay | spec §6.3 |
| `tooltip.disabled.noBack` | 没有可后退的历史 | 后退禁用提示 | IXD §2.2 行 68；§17.2 |
| `tooltip.disabled.noForward` | 没有可前进的历史 | 前进禁用提示 | 同上 |
| `tooltip.disabled.noDocument` | 当前没有可搜索的文档 | 查找禁用提示 | 同上 |
| `tooltip.tab.close` | 关闭标签：{name} | 标签关闭提示 | IXD §5.3 行 170 |
| `tooltip.recent.remove` | 从最近列表移除（不删除源文件） | 最近条目移除提示 | IXD §4.1 行 122 |

## 18. 格式与时间（格式化助手输出）

| key | zh-CN | where used（组件/UI 区域） | source |
|---|---|---|---|
| `time.justNow` | 刚刚 | RecentList 相对时间 | spec §3.1 |
| `time.minutesAgo` | {count} 分钟前 | RecentList 相对时间 | spec §3.1 |
| `time.hoursAgo` | {count} 小时前 | RecentList 相对时间 | spec §3.1 |
| `time.daysAgo` | {count} 天前 | RecentList 相对时间 | spec §3.1 |
| `time.date` | {date} | 超过早于 7 天的记录 | spec §3.1 |
| `format.bytes` | {size} | 存储用量（由格式化助手生成单位） | spec §3.8 |
| `format.lines` | 第 {start}–{end} 行 | 源位置/窗口范围 | IXD §11.2 行 351 |

---

**校验说明**：本表键名与 `ui-spec.md` §3 各区域一一对应；§14 与 `contracts.md` §5 的 32 个稳定错误码逐条对齐；全部键不包含正文内容、私人路径或令牌（R28）。后续新增文案必须先更新本表再进入实现，不得在组件中临时硬编码。
