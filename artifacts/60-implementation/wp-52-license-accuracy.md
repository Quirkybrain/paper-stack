# PaperStack · wp-52 第三方许可清单准确性修订

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP52
- **Artifact Type**: Implementation Evidence Report
- **Status**: UNVERIFIED（待独立评审与编排者门禁）
- **Revision**: 1
- **Last Verified**: 2026-10-08
- **Task**: `wp-52-license-accuracy`；分支 `task/wp-52-license-accuracy`；父分支 `chore/github-publication`；基线 `25d7bf98690dd4de19f5ffc98bcf059ae370b48b`
- **Inputs**: `state/handoffs/wp-52-license-accuracy.json` 固定的用户请求、用户决定、`config/project.md`、Release Stage Gate 和两个锁文件
- **Recovery**: 修改前快照 `refs/swe/snapshots/20261008T050709Z-wp-52-license-accuracy-0d040f00`
- **Write scope**: `packaging/third-party-inventory.py`、`THIRD_PARTY_NOTICES.md`、本报告；未改依赖、应用代码或既有 `.deb`

## 修订与依据

| 修订 | 依据与边界 |
|---|---|
| 移除“未发现已知与 GPLv3 不兼容的运行期条目”与笼统的 EPL 次级许可结论 | 锁定的 `elkjs@0.9.3` 仅声明 EPL-2.0。其[版本源码](https://github.com/kieler/elkjs/tree/0.9.3)及[许可文本 §3.2、Exhibit A](https://github.com/kieler/elkjs/blob/0.9.3/LICENSE.md)没有填写 GPL 次级许可名称；许可文本明确说仅附带 Exhibit A 模板不足以授权次级许可。[上游新增 GPLv3 的议题](https://github.com/kieler/elkjs/issues/373)属于后续工作，不能追溯适用于 0.9.3。`pnpm build` 后 `dist/assets/elk-IJKZMXRS-B5i2FM2T.js` 为 1,462,935 字节，含 `org.eclipse.elk`，并被 `mermaid.core-Cy6wFkQy.js` 的动态导入表引用。此处记录未解决的兼容性风险，不作法律最终判断。 |
| 修正 Shiki 语法、主题的覆盖说明 | [Shiki v4.5.0 锁文件](https://github.com/shikijs/shiki/blob/v4.5.0/pnpm-lock.yaml)固定 `tm-grammars@1.32.22`、`tm-themes@1.12.12`。精确 npm 包中的 [语法 NOTICE](https://registry.npmjs.org/tm-grammars/-/tm-grammars-1.32.22.tgz)与[主题 NOTICE](https://registry.npmjs.org/tm-themes/-/tm-themes-1.12.12.tgz)覆盖大部分已选语法和 `github-light`。`src/document/plugins/shiki.ts` 所选 `cpp` 还导入 `cpp-macro`、`regexp`、`glsl`，`bash` 映射 `shellscript`。以 NOTICE 的 `Files:` 文件名精确匹配时，`glsl.json`、`yaml.json` 不在语法 NOTICE 中；[GLSL 原始项目](https://github.com/polym0rph/GLSL.tmbundle)及[YAML 原始项目](https://github.com/textmate/yaml.tmbundle)未找到明确的根目录许可文件。记录授权依据未闭合，不能把 Shiki 包自身 MIT 元数据当作逐项授权。 |
| 澄清离线文本与字体的声明 | `src-tauri/tauri.conf.json` 的资源映射只有仓库根 `LICENSE` 和 `THIRD_PARTY_NOTICES.md`。前者是 PaperStack 的 GPLv3 全文，后者是依赖清单；现有安装包未附上各依赖或 Shiki 上游资源的完整许可原文。KaTeX 包内字体没有单独许可文件，故清单只说明包元数据，不再断言字体上游逐项许可已经核实。 |
| 限定本修订适用范围 | 用户决定“先公开源码仓库，稍后发布 .deb”；生成后的清单只更新仓库文本。既有本地 `.deb` 字节保持原样，公开二进制仍待对应源码入口、依赖许可、资源通知、重建与验证。 |

ELK 与 Shiki 的版本判断使用具体标签或精确 npm tarball；GLSL、YAML 原始项目链接只用于识别来源，未作为锁定版本的授权依据。`glsl`/`yaml` 的授权结论是“未核实”，不是“无许可”或侵权判断。本修订不是法律审计。

## 验证

| 检查 | 结果 |
|---|---|
| `pnpm install --offline --frozen-lockfile` | PASS；只生成忽略的 `node_modules/`，锁文件未改。 |
| `python3 -m py_compile packaging/third-party-inventory.py` | PASS。 |
| `python3 packaging/third-party-inventory.py \| cmp - THIRD_PARTY_NOTICES.md` | PASS；生成输出与提交文件逐字节一致，新文件 SHA-256 `6ccfbe03129377b566040aa9bdfc4ec0a9ea85c5b5a7ffd65179bd0dd736848f`。 |
| 基线与新清单的 npm/Rust 表格逐行比较 | PASS；npm 263 条、Rust 540 条全部不变。旧的全局兼容性断言不存在；未决项均有明文。 |
| 锁文件哈希 | `pnpm-lock.yaml` 为 `d1b796a2d5eb1cebc86fe22d2735e340846f2fafd6c0fcf63b12642d6b10ff08`；`src-tauri/Cargo.lock` 为 `7ef9a84fea22179491f8c413aa9f7aa7f88e991a322fa2a097a2ad1ae5e78263`，均与基线和清单一致。 |
| `pnpm build` | PASS；`tsc && vite build`，2649 个模块；上述 ELK chunk 进入 `dist/`。仅构建前端用于确认资源事实，未生成 `.deb`。 |
| 精确 Shiki npm 包 NOTICE 文件名核对 | `c.json`、`cpp.json`、`cpp-macro.json`、`regexp.json`、`shellscript.json` 有对应项；`glsl.json`、`yaml.json` 无对应项。`es-tag-glsl.json` 是不同文件，未误认为 `glsl.json`。主题 NOTICE 含 `github-light.json`。 |
| `git diff --check` | PASS。 |

## 未完成项与交接

本任务只为**源码仓库公开**修正清单措辞。公开 `.deb` 仍需解决 `elkjs@0.9.3` 的 EPL/GPL 兼容性依据、Shiki `glsl`/`yaml` 与字体等逐项通知、对应源码入口，并重建和验证安装包。历史 release 与打包报告记录的是旧修订及旧二进制，不能用作这些新结论的通过证据。独立评审和 Artifact Validation 由后续 Gate 执行。
