# 纸栈 PaperStack · wp-24/wip-26 阅读器 UI 实现报告（欢迎/导航/源码/检查/放大 + W-1 修复）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP24
- **Artifact Type**: Implementation Evidence Report（T-39–T-41、T-45–T-47 实现证据；W-1 修复记录）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-24-nav`（合并 wp-24 + wp-26 范围；任务分支 `task/wp-24-nav`；父分支 `feat/v0.1.0`；基线提交 `f40ee4742689f127ffff218e2ab5b0da458dab4a`；产出提交主题 `feat(reader): add welcome, navigation, source and inspect views`）
- **Components**: UI00 欢迎与最近阅读；UI02 左侧导航；UI04 只读源码；UI05 公式检查抽屉、代码/图表/图片工具与放大层；`src/styles` skip link（W-1）
- **Last Verified**: 2026-10-07
- **Scope**: `src/**`（实现与测试）与 `artifacts/60-implementation/**`（本报告）。未修改 `package.json`、`src-tauri/`、`fixtures/`、pinned 输入、locale 键表或其他 Artifact。

## 1. 输入与基线核验

Pinned 输入在 2026-10-07 复核（SHA-256 与 handoff `state/handoffs/wp-24-nav.json` 一致，只读未改）：

| 输入 | SHA-256 | 一致 |
|---|---|---|
| `artifacts/40-ux/ui-spec.md` | `3a68817a…052e28` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69c…b5065c0` | ✓ |
| `artifacts/35-models/session-and-version-models.md` | `65c36022…568e1fad` | ✓ |
| `artifacts/30-architecture/contracts.md` | `30664dd9…ac88a` | ✓ |
| `artifacts/70-verification/early-run.md` | `76622428…02c134` | ✓ |
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc7…b02967f` | ✓ |

基线 `f40ee47`；任务开始时工作树干净；分支 `task/wp-24-nav`；`python3 scripts/swe_guard.py status` 显示本任务 ACTIVE；所有产出均在 handoff `writes` 范围内。locale 键表保持冻结的 378 键（`src/app/i18n.keys.test.ts` 通过）；未新增任何文案键。

## 2. 交付物与文件清单

### 2.1 新增（`src/features/reader/`）

| 路径 | 内容 |
|---|---|
| `welcome/WelcomePage.tsx` | UI00：标题/主次按钮/说明、最近列表加载与存储降级、示例卡替代 |
| `welcome/RecentList.tsx` | 最近列表：≤6 首屏滚动、文件名+最短区别父目录+相对时间、不可用标记与 relink、移除 |
| `welcome/format.ts` | 相对时间与最短区别父目录纯函数（`now` 可注入） |
| `nav/NavPanel.tsx` | 文件/大纲单辅助区主机、响应式宽度（≥1180/840–1179/<840）、关闭可达、宽度记忆 |
| `nav/FileTree.tsx` | `role=tree`、每层懒加载、焦点/选择分离、键盘模型、失败保留+重试、状态文案、“显示其他文件” |
| `nav/OutlineTree.tsx` | 标题层级、重复标题序号、滚动高亮不抢焦点/不强制展开、来源锚点回调、按文档记忆 |
| `nav/nav-memory.ts` | 按授权根/文档的宽度、展开、滚动记忆；响应式阈值解析；模块级读写辅助 |
| `nav/tree-model.ts` | 可见节点扁平化、主列表过滤、节点状态分类 |
| `nav/outline-model.ts` | 大纲树构建、重复标题编号、默认展开、折叠祖先标记 |
| `nav/use-outline-tracking.ts` | 滚动位置 → 当前锚点（只读监听，无 focus 调用） |
| `source/SourceView.tsx` | 只读 `<pre>` + 行号、进入定位、窗口模式（版本校验 + `data-complete`）、返回位置上报 |
| `source/mapping.ts` | UTF-8 字节 ↔ 行、块查找、返回映射回退决策、可见块 DOM 映射 |
| `inspect/InspectDrawer.tsx` | 340px 非模态公式抽屉宿主（与导航互斥由 ReaderScreen 管理） |
| `inspect/FormulaPanel.tsx` | 公式预览、无 `$` 源码、来源章节、诊断、复制确认/失败持久、查看源码/放大 |
| `inspect/CodeBlock.tsx` | 代码块操作条：整块字面复制（LF 归一、去行号）、换行会话偏好、40/20 折叠、查看源码 |
| `inspect/MathBlock.tsx` | 公式显式工具（检查/查看源码/复制/放大）；内联仅检查入口；嵌套去工具条 |
| `inspect/block-context.ts` | 每块上下文（blockId/headingPath/range/rawText/diagnostics） |
| `inspect/copy-feedback.ts` | 剪贴板反馈状态机（成功 1.5s 恢复、失败持久） |
| `inspect/types.ts` | `FormulaInspectTarget` 形状 |
| `ui-context.tsx` | `ReaderUi`（进入源码/打开检查/打开放大）Provider 与 hook |
| `zoom/ZoomOverlay.tsx` | 独立放大层：标题/关闭/缩小/放大/适宽/100%、拖拽与方向键平移、Ctrl+滚轮缩放、Esc 关闭回焦点 |

### 2.2 修改

| 路径 | 变更 |
|---|---|
| `features/reader/ReaderScreen.tsx` | UI00/UI02/UI04/UI05 装配；辅助区互斥（导航 ↔ 检查，恢复原选择）；Ctrl+B / Ctrl+Shift+O；返回映射与 `source.notLocated` 提示；`ReaderUi` Provider |
| `features/reader/reader-state.ts` | 每标签 `viewMode: 'reading' \| 'source'` + `tab/view` action |
| `features/reader/use-reader.ts` | `pickDirectory`（`pick_directory`+`open_directory`）、`relinkRecent`、`setViewMode`、relink 结果提示 |
| `features/reader/toolbar/ReaderToolbar.tsx` | 打开目录启用；导航切换（显示/收起名称）；更多菜单“查看源码/返回阅读” |
| `features/reader/body/DocumentView.tsx` | 每块 BlockContext；代码块/公式/图表 override 挂载工具 |
| `features/reader/body/MermaidBlock.tsx` | 显式“查看源码（UI04）/放大”工具（无 Provider 时不渲染） |
| `features/reader/body/ImageBlock.tsx` | 允许加载图片的放大入口（其余占位状态保持原状） |
| `features/reader/reader.css` | 欢迎/最近、导航树/大纲、源码视图、检查抽屉、工具条、放大层样式；代码块列布局与操作条 |
| `styles/base.css` | **W-1 修复**：skip link 隐藏态改为 `transform: translateY(-200%)`（见 §5） |
| `App.test.tsx`、`ReaderScreen.test.tsx` | 旧占位断言更新为 UI00 标题（`welcome.title`），并新增集成用例（详见 §4） |

## 3. 验证命令与结果（工作目录 = 项目根；2026-10-07）

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit`，无诊断 | 0 |
| 2 | `pnpm lint` | `eslint .`，无诊断 | 0 |
| 3 | `pnpm test -- --run` | **Test Files 41 passed (41)；Tests 290 passed (290)**，Duration 8.10s（基线 29 文件/218 测试 + 新增 12 文件/65 测试 + ReaderScreen 新增 7 测试） | 0 |
| 4 | `pnpm build` | `tsc && vite build`，`✓ built in 1.47s`（仅既有 >500 kB chunk 提示，非错误） | 0 |

摘要原始输出：`/tmp/opencode/wp24/logs/final.txt`（临时日志，不入库）。测试基线新增 72 个测试，无删除、无跳过、无 `it.skip`；全部确定性（jsdom；剪贴板/计时器用 fake timers）。

## 4. 测试清单（新增 65 + 集成 7）

| 测试文件 | 用例数 | 覆盖（DoD 映射） |
|---|---|---|
| `welcome/WelcomePage.test.tsx` | 9 | 标题/按钮/说明；首屏 6 与顺序；父目录+相对时间；不可用标记+relink；移除；空列表示例卡；存储不可用降级且仍可打开；格式化纯函数 |
| `nav/nav-memory.test.ts` | 6 | 1180/840 阈值；按根/文档的宽度、展开、滚动独立记忆 |
| `nav/tree-model.test.ts` | 3 | 懒加载可见顺序；支持文档与其他资源分区；状态分类 |
| `nav/FileTree.test.tsx` | 8 | 懒展开调用次数；键盘 Up/Down/Right/Left/Enter；焦点与选择分离；失败保留+重试；symlink/缺失状态；显示其他文件+不支持说明；空目录；根级展开/滚动记忆 |
| `nav/OutlineTree.test.tsx` | 7 | 层级；重复标题 (1)/(2)；滚动高亮不抢焦点；折叠分支不强制展开（含 `data-current-subtree`）；导航来源锚点；箭头/Enter；按文档记忆；空大纲 |
| `nav/NavPanel.test.tsx` | 5 | 三种响应式宽度与 data 标记；宽度记忆；关闭可达；无根时文件页禁用；文件树实测挂载与空大纲 |
| `source/mapping.test.ts` | 4 | CJK/emoji 字节↔行；块查找；返回目标回退/无锚点；可见块 DOM 映射 |
| `source/SourceView.test.tsx` | 6 | 只读 `<pre>`+行号且不触发任何磁盘命令；进入映射与返回位置；滚动行跟踪；窗口模式（范围文案+`data-complete=false`）；版本不一致拒绝；读取失败原因/编号/重试 |
| `inspect/CodeBlock.test.tsx` | 6 | 复制载荷（去行号、LF 归一）与成功 1.5s 恢复；失败持久；换行会话记忆；45 行 40/20 折叠与展开/收起；≤40 行不折叠；查看源码范围 |
| `inspect/FormulaPanel.test.tsx` | 3 | 预览/无 `$` 源码/章节/诊断；复制载荷与计时；失败持久+查看源码/放大入口 |
| `zoom/ZoomOverlay.test.tsx` | 6 | 常驻控件；按钮缩放与 100%；适宽测量；Ctrl+滚轮才缩放、普通滚轮与 body 滚轮不缩放；拖拽+方向键平移；Esc 关闭回触发点 |
| `styles/base-css.test.ts` | 2 | **W-1 回归**：隐藏位移 ≥ 元素全高、旧偏移已移除、focus-visible 恢复 |
| `ReaderScreen.test.tsx`（新增 7，共 16） | 7 | 选择器取消状态不变；Ctrl+B 开关导航；检查与导航互斥+关闭恢复；源码视图切换与 `source.notLocated` 回退；打开目录 → 文件树打开文件（entry `tree`）；不可用最近 relink + 结果提示；公式放大层 Esc |

## 5. W-1 修复证据（skip link 未聚焦可见）

EA-RUN §6 W-1：未聚焦 skip link 在窗口左上角露出底部约 15 设备像素。根因：隐藏态 `top: calc(-1 * var(--ps-space-6))`（-32px）小于元素实际高度（内边距 + 行高 + 边框 ≈ 45px）。

修复（`src/styles/base.css`）：

```diff
 .ps-skip-link {
   position: absolute;
   left: var(--ps-space-4);
-  top: calc(-1 * var(--ps-space-6));
+  top: 0;
   ...
-  transition: top var(--ps-transition-fast);
+  transform: translateY(-200%);
+  transition: transform var(--ps-transition-fast);
 }
 .ps-skip-link:focus-visible {
-  top: var(--ps-space-2);
+  transform: translateY(var(--ps-space-2));
 }
```

- `translateY(-200%)` 以元素自身高度为基准上移 200%，完全移出窗口且不依赖固定尺寸；聚焦态回到 `--ps-space-2`。
- 回归检查：`src/styles/base-css.test.ts` 静态断言“隐藏位移 ≥ 100% 自身高度、旧 `top: calc(-1 …)` 不存在、focus-visible 恢复位移”，随 `pnpm test` 一起执行。
- **运行时视觉复核未在本任务执行**（无 X11 会话/不在本任务写范围）：W-1 的桌面截图复跑随 wp-34（T-63）沿用 `tests/desktop/run-smoke.sh` 回归，本报告不声称已通过真实窗口验证。

## 6. 行为说明、偏差与已知缺口（不掩盖）

- **D-24-1 最近列表“移除”为视图级移除**：契约无单条 `remove_recent` 命令（§8 仅 `list_recents`/`touch_recent`/`clear_records`）。UI00 的“移除”只移除本视图列表项（store `recents/removed`），删除持久记录仍由隐私清除（§3.8 / wp-27）负责；按钮名称与提示已写明“不删除源文件”。
- **D-24-2 欢迎页 relink 顺序**：先尝试 `relink_document`（仅 Rust 已注册文档可成功，服务实现要求 docId 在打开表中），无论结果都会以 `entry: 'recent'` 打开用户重新选择的文件；relink 成功时显示 `document.relink.reassociated` / `document.relink.newVersion`，失败（旧会话记录）则静默进入普通重新打开。取消不动任何状态（已测）。
- **D-24-3 大纲“先记录来源”接口**：`OutlineTree.onNavigate(entry, fromAnchorId)` 已按 models §5 捕获来源锚点；历史项入栈/后退属于 wp-25（T-44），本任务未实现也不伪造历史状态。
- **D-24-4 检查抽屉“目标更新后消失”**：`InspectDrawer.sourceChanged` 入口与 `inspect.sourceChanged` 文案已就位，但更新提交流程属 wp-29；本任务不触发该分支。
- **D-24-5 >50MiB 源码窗口分段**：本任务实现 `get_source_info`+`read_source_window` 的版本校验窗口与“已显示第 x–y 行，共 N 行 / `data-complete`”如实呈现（`complete=false` 不称完整）；窗口翻页/连续分段与源码搜索完整性属 wp-28（T-52/IX15）。
- **D-24-6 公式抽屉仅覆盖公式目标**：代码/图表/图片使用各自块内工具（规格 §3.6：代码操作条、图表与图片工具），不进入检查抽屉；其诊断保持块内展示。
- **W-2 未处理**：EA-RUN W-2（合成指针后 XTEST 焦点环）为工具环境限制，不在本任务范围，维持原记录。
- **W-3 未处理**：`asset:` 协议允许加载图片路径仍无实测样例；本任务为该路径补上“放大”入口，但未构造允许加载样例，保持 UNVERIFIED。

## 7. 明确 UNVERIFIED 清单（不得读作通过）

| 项 | 原因 |
|---|---|
| W-1 修复的真实窗口视觉复跑 | 本任务无桌面会话；随 wp-34 的 `run-smoke.sh` 截图复跑 |
| >50MiB 文档完整流程（分段翻页、搜索完整性、取消） | wp-28（T-52）范围；本任务仅实现版本校验窗口基础 |
| 公式目标更新后消失 → 回最近正文位置 + `inspect.sourceChanged` | wp-29（T-53–T-55）更新流程 |
| 大纲导航历史入栈、后退/前进与返回文案 | wp-25（T-44，models §5） |
| `asset:` 协议允许加载图片的实际渲染与放大 | W-3 无允许样例，维持既有 UNVERIFIED |
| Wayland、真实硬件键盘/鼠标、200% 文字缩放、深色主题视觉走查 | EA-RUN §7 口径不变，随 wp-34 复核 |
| CSS 媒体阈值在真实窗口的像素级核对 | 本任务以 `resolveNavLayout` 纯函数 + `data-nav-layout` 类名覆盖；像素级复核随 wp-34 |

## 8. 追溯

- **implementation-plan §4.3**：T-39（WelcomePage/RecentList）、T-40（FileTree）、T-41（OutlineTree+NavPanel）、T-45（SourceView）、T-46（检查抽屉与代码/图表/图片工具）、T-47（ZoomOverlay）；Standards：wp-24/wip-26 组件测试 + 交互冒烟。
- **ui-spec §3.1/§3.3/§3.5/§3.6/§6/§7**：逐条实现；`§6.1` Ctrl+B/Ctrl+Shift+O；`§6.2/6.3` 焦点与角色（`role=tree`、`complementary`、`dialog`）；`EDGE-01/02/03/06/09/11`。
- **contracts §8**：仅调用 `tree.readDirectory/openDirectory`、`files.pickFiles/pickDirectory/openDocuments/relinkDocument/getSourceInfo/readSourceWindow`、`storage.listRecents`、`clipboard.copyText`；未新增命令或字段。
- **strings 目录（378 键冻结）**：全部文案经 `t()` 使用既有键；`no-hardcoded-strings` 与键表校验随测试通过。
- **early-run W-1/§7**：W-1 修复与 UNVERIFIED 口径来源；W-2/W-3 原样保留。
- **models §5**：大纲导航来源锚点回调接口；历史持久化归 wp-25。

## 9. 结论与下一步

UI00、UI02、UI04、UI05（含放大层）已按冻结规格接入真实服务与展示版本，W-1 修复随回归测试落库；`pnpm typecheck`、`pnpm lint`、`pnpm test -- --run`（290/290）、`pnpm build` 四项 DoD 全部通过，提交 `feat(reader): add welcome, navigation, source and inspect views`。待独立质量审查（quality-reviewer）与 Gate；桌面像素级与更新/历史集成留待 wp-29/25/34/28 按 §7 清单闭环。
