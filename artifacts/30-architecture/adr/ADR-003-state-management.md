# ADR-003 状态管理（State Management）

- **Producer**: agent:solution-architect
- **Status**: VALID
- **Decision Status**: Accepted
- **Revision**: 1
- **Last Verified**: 2026-10-07
- **Date**: 2026-10-07
- **Deciders**: solution-architect
- **Affected Artifacts**: `architecture.md` §6、`contracts.md` §6、`rendering-pipeline.md` §2.12

## Context

计划书 §3.2 明确“界面状态：React hooks、Context、useReducer；首版不额外引入大型状态框架”。但纸栈的状态并非只有 UI：每标签有文档会话（显示版本、待更新候选、任务代次、历史、选区/检查层、视图模式），重对象（rawText、hast、搜索索引、块注册表）体量可达数 MiB，且异步结果必须按代次丢弃（R22/AT22）。React `useState` 直接持有重对象会造成复制与 re-render 成本；全部塞进单一 reducer 也会让快照巨大。SRS §3.3 还要求“共享读取缓存不得共享选区或错误串用授权”。

## Options

- **A：Redux/Zustand/Jotai 等外部状态库**。与计划书“不额外引入大型状态框架”冲突；体积与依赖成本对 v0.1.0 不成比例。
- **B：单全局 useReducer + Context**。简单，但每标签会话与重对象需要分层，否则一次更新重渲染全树。
- **C：全局 reducer（应用/标签/面板/模态） + 每标签文档会话 reducer + 重对象模块级 Map**。计划书组合的自然延伸；重对象按 `docId+version` 不可变共享，React 只持有句柄与轻量状态；选区/历史按标签独立。
- **D：命令式类实例（MobX 风格）**。偏离计划书；可测试性与 React 集成需额外约定；否决。

## Decision

采用 Option C：

1. **全局 store**（`src/app/store`）：标签列表、活动标签、面板开合、设置快照、授权请求队列、模态/提示；`useReducer + Context`，动作由事件桥与服务层派发。
2. **文档会话 reducer**（`features/reader`）：按标签持有 `{docId, status, displayVersion, pendingVersion?, generation, viewMode, selectionClearedByUpdate?, history, position}`；任务令牌（`docId/version/generation`）随动作流转，提交规则由 contracts.md §6 规范并在 reducer 单点实现。
3. **重对象模块级 Map**（`DocumentModel`）：`docId+version → {rawText, hast, outline, blocks, segments, lineIndex?}`，LRU ≤2 版本/文档；React 组件经 selector 取需要的切片；关闭标签即释放。
4. **refs 仅用于** DOM/滚动焦点、计时器、Worker 句柄、去抖控制；不得作为业务状态来源。
5. **禁止 localStorage/sessionStorage 保存产品状态**；持久状态一律经 services → Rust（NF08 单一控制面）。
6. 选区/历史/授权决策按标签/文档隔离；只读模型可共享（SRS §3.3）。

## Consequences

- 正面：无新依赖；重对象不进 React 快照；每标签隔离明确；提交规则集中可测（AT22 可注入乱序测试）。
- 代价：需要少量样板（actions/reducers/selectors）与纪律（禁止绕过 store 直接改模型）；Context 粒度过粗时需用分片 Context 或选择器优化，实测量化（NF04–NF06）。
- 风险：reducer 中放置重计算会拖慢交互——约定 reducer 只处理轻量状态与句柄，重计算留在 Worker/纯函数。
- 未来若引入状态库，仅替换 store 层，不影响 services/document 契约。

## Constraints

- 不引入大型状态框架（计划书 §3.2；PC 约束）。
- 任何用户可见状态变化必须经 reducer/动作，禁止组件内隐式全局可变状态。
- 与 contracts.md §6 的提交规则一致：陈旧结果不得提交（R22、R05）。

## Affected Artifacts

- `architecture.md` §6（状态所有权表）。
- `contracts.md` §6（任务令牌与提交规则）。
- 下游：`src/app`、`features/*` 实现与组件测试。
