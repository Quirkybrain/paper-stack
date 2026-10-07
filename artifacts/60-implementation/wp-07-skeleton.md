# 纸栈 PaperStack · wp-07 骨架与 i18n 骨架实现报告（T-01, T-02）

- **Producer**: agent:implementation-engineer
- **Artifact ID**: ART-60-IMPL-WP07
- **Artifact Type**: Implementation Evidence Report（工程骨架 + i18n 骨架的构建/测试证据）
- **Status**: VALID
- **Revision**: 1
- **Owner**: implementation-engineer
- **Task**: `wp-07-skeleton`（任务分支 `task/wp-07-skeleton`；父分支 `feat/v0.1.0`；基线提交 `173872a38cc757390fb4d1c15033fe440bd870b8`）
- **Component**: C-01 工程骨架与工具链（含 i18n 骨架）
- **Last Verified**: 2026-10-07
- **Scope**: 仅 T-01/T-02：corepack 固定 pnpm、Vite/Tauri/TS/Rust 工程与锁文件、lint/format 配置、`t()` 骨架与 zh-CN 资源种子。不含任何 v0.1.0 功能命令或界面。

## 1. 输入与基线核验

Pinned 输入 SHA-256 于 2026-10-07 复核，全部与 handoff `state/handoffs/wp-07-skeleton.json` 一致：

| 输入 | SHA-256（实测） | 一致 |
|---|---|---|
| `artifacts/50-plan/implementation-plan.md` | `ce6d7bc785771ed3c75835311bd0267d286d045c5d1804cac1f4556a8b02967f` | ✓ |
| `artifacts/30-architecture/adr/ADR-001-stack-and-runtime.md` | `baa0411e43f84c276f7151f8bc50e52431027d7251ab78baee1fe39f9d840a58` | ✓ |
| `artifacts/30-architecture/adr/ADR-009-i18n.md` | `9527eccc213c95ee549b791d73e42ec5528498c73451e4fc9e3ad6de4a480454` | ✓ |
| `artifacts/40-ux/strings-zh-CN.md` | `97d8a69ca733d802622f7e0e18fb22b113008a646117f09da37de183fb5065c0` | ✓ |
| `config/project.md` | `6dce9e3fc47f729f748fb5eb5df4eba1ddd60411243609a5f9eceda1ac8c0f3b` | ✓ |

基线提交 `173872a` 与 handoff 声明一致；任务分支 `task/wp-07-skeleton`，工作树干净进入。

## 2. 环境与锁定版本

- 环境（实测）：Ubuntu 24.04；Node v24.15.0；corepack 0.34.6；rustc/cargo 1.96.0；GTK3 3.24.41；WebKitGTK 4.1 2.52.6；网络经代理可达 npm registry 与 crates.io。
- **pnpm 固定为 `10.34.6`**（`corepack prepare pnpm@10.34.6 --activate`；`package.json` `packageManager: "pnpm@10.34.6"`）。
- `rust-toolchain.toml` 锁定 `channel = "1.96.0"`。
- pnpm 解析版本（`pnpm-lock.yaml`，lockfileVersion 9.0）：react/react-dom 19.3.0、@tauri-apps/api 2.12.1、@tauri-apps/cli 2.12.1、typescript 6.0.3、vite 8.3.3、@vitejs/plugin-react 6.1.2、vitest 5.0.3、jsdom 30.1.2、eslint 10.12.0、typescript-eslint 8.71.1、eslint-plugin-react-hooks 7.1.1、prettier 3.9.9、@testing-library/react 16.3.3、@testing-library/dom 10.4.2、@testing-library/user-event 14.6.7、@types/react 19.3.0、@types/react-dom 19.3.0、@types/node 26.6.4。
- Cargo 解析版本（`src-tauri/Cargo.lock`）：tauri 2.12.1、tauri-build 2.7.1、tauri-plugin-dialog 2.8.1、tauri-plugin-clipboard-manager 2.4.1、tauri-plugin-opener 2.7.0、tauri-plugin-single-instance 2.5.2、serde 1.0.229、serde_json 1.0.151、thiserror 2.0.21、notify 8.2.0、rusqlite 0.40.2（bundled）、sha2 0.11.0、url 2.5.8、tracing 0.1.44、tracing-subscriber 0.3.23、reqwest 0.12.28（`default-features=false` + `rustls-tls`）、tokio 1.53.2（`sync`+`time`）、tempfile 3.27.0（dev）。

## 3. 交付物清单（30 个文件）

| 路径 | 说明 |
|---|---|
| `package.json` | name/version/author/license/`packageManager` 与全部 scripts（dev/build/typecheck/lint/format/test/tauri） |
| `pnpm-lock.yaml` | `pnpm install` 生成，`--frozen-lockfile` 复核 |
| `tsconfig.json` + `tsconfig.node.json` | strict TS（Vite 模板结构）；`tsconfig.node.json` 的 tsbuildinfo 定向到 `node_modules/.tmp/` |
| `vite.config.ts` | React 插件；dev server 1420 strictPort；`build.outDir=dist`；`test`（jsdom、globals、setup 文件、include） |
| `index.html` | 标题「纸栈 PaperStack」，挂载 `/src/main.tsx` |
| `eslint.config.js` | ESLint 9+ flat config：typescript-eslint recommended + react-hooks；`no-console` off；忽略 `dist/`、`src-tauri/target/`、`src-tauri/gen/` |
| `.prettierrc.json` / `.prettierignore` | printWidth 100、singleQuote、semi=false；忽略框架目录与非产品产物 |
| `src/main.tsx` / `src/App.tsx` / `src/vite-env.d.ts` | 最小真实 React 外壳，渲染 `t('app.name')` 占位 |
| `src/app/i18n.ts` | `t(key, params?)`：扁平点分键查找、`{param}` 插值、缺失键返回 key + dev 警告 |
| `src/locales/zh-CN.json` | 由 pinned strings catalog 生成的 **378** 个键值（逐键一致，占位符原样） |
| `src/app/i18n.test.ts` / `src/app/i18n.keys.test.ts` | 关键键断言、无空值、插值、缺失键行为；键总数=378 的 parity 守卫 |
| `src/test/setup.ts` | Vitest 共享 setup（RTL cleanup） |
| `rust-toolchain.toml` | channel 1.96.0 |
| `src-tauri/Cargo.toml` / `Cargo.lock` | 依赖集合见 §2；`[lib] paperstack_lib` |
| `src-tauri/build.rs` / `src/main.rs` / `src/lib.rs` | `tauri_build::build()`；`run()` 注册 single-instance（首位）/dialog/clipboard/opener 四插件，无自定义命令 |
| `src-tauri/tauri.conf.json` | productName PaperStack、identifier、0.1.0、devUrl 1420、frontendDist ../dist、主窗 1280×800「纸栈 PaperStack」、capabilities 引用 `["default"]` |
| `src-tauri/capabilities/default.json` | 仅 `core:default`（窗口 `main`） |
| `src-tauri/icons/{32x32,128x128,128x128@2x,icon}.png` | 生成的最小有效占位图标（见 §5.1） |
| `src-tauri/.gitignore` | `/target/`、`/gen/schemas` |

## 4. DoD 执行证据（全部在本修订上复跑）

| # | 命令（工作目录） | 结果 | 耗时 |
|---|---|---|---|
| 1 | `pnpm install`（根） | PASS，224 packages，生成 `pnpm-lock.yaml` | 10.6 s |
| 1b | `pnpm install --frozen-lockfile`（根） | PASS，`Lockfile is up to date` | 0.56 s |
| 2a | `pnpm typecheck`（根） | PASS（tsc --noEmit，exit 0） | 1.05 s |
| 2b | `pnpm lint`（根） | PASS（eslint .，exit 0） | 1.73 s |
| 3 | `pnpm test -- --run`（根） | PASS：2 files / 9 tests，0 failed（vitest 5.0.3） | 1.73 s |
| 4 | `pnpm build`（根） | PASS：`dist/index.html` 0.33 kB、`dist/assets/index-B084Aanz.js` 238.96 kB（gzip 76.16 kB） | 1.53 s |
| 5a | `cargo check`（`src-tauri/`） | PASS（首次 1 m 33 s，见 §5.1 失败并修复；修复后 1.2 s） | — |
| 5b | `cargo test`（`src-tauri/`） | PASS：lib/main/doc 3 个 harness，0 failed（骨架暂无 Rust 测试） | 1 m 28 s |

附加检查（计划 §3.2 Rust 组件基线，非 handoff DoD，供门禁参考）：

| 命令 | 结果 | 耗时 |
|---|---|---|
| `cargo clippy --all-targets -- -D warnings` | PASS，无警告 | 15.0 s |
| `cargo fmt --check` | PASS | <1 s |
| `pnpm exec prettier --check .` | PASS（`All matched files use Prettier code style!`） | ~1 s |
| `pnpm exec tsc --noEmit -p tsconfig.node.json` | PASS（`vite.config.ts` 含 `test` 块的类型核验） | 1.2 s |

## 5.1 失败与修复（首次 `cargo check`）

- 现象：首轮 `cargo check`（1 m 33 s）在 `tauri::generate_context!()` 处 proc macro panic：`failed to open icon .../src-tauri/icons/icon.png: No such file or directory`。
- 根因：Tauri 2 codegen 即使未配置 bundle，也要求默认窗口图标 `icons/icon.png` 存在（属工程初始化缺口，非代码缺陷）。
- 处置：生成最小有效占位 PNG 图标集（32/128/256/1024，RGBA，无外部工具）放入 `src-tauri/icons/`；未在 `tauri.conf.json` 增加 bundle/图标引用（打包润色归 wp-40）。修复后 `cargo check` PASS（1.2 s）。
- 证据保留：本报告如实记录首轮失败；未掩盖、未重分类。

## 6. 决策与偏差（相对 handoff/pinned 输入的偏离均在此声明）

1. **TypeScript 固定 `~6.0.3` 而非 npm latest 7.0.2**：typescript-eslint 8.71.1 的 peer 范围为 `>=4.8.4 <6.1.0`；6.0.3 为该范围最新稳定。原因记录于 `package.json` 与本节。
2. **vitest 类型引用用 `/// <reference types="vitest/config" />`**（handoff 写的是旧的 `vitest`）：vitest 5 的官方指引为 `vitest/config`；`test` 块位于 `vite.config.ts`，已用 `tsc -p tsconfig.node.json` 验证类型。
3. **reqwest 固定 0.12.28 而非 latest 0.13.5**：handoff 指定的 `rustls-tls` feature 存在于 0.12 线；0.13 将其更名为 `rustls` 且默认 aws-lc-rs provider（引入额外原生构建链）。0.12.28 使用 ring provider，保持 `default-features=false`+rustls 的既定语义。已在 `Cargo.toml` 注释记录。
4. **tokio 依赖保留并锁定 `sync`+`time` 特性**：Tauri 运行时本身基于 tokio；显式声明后续服务（防抖计时、超时）所需特性，避免依赖特性合并的隐式漂移。已在 `Cargo.toml` 注释记录。
5. **`zh-CN.json` 采用扁平点分键（ADR-009 口径）而非嵌套对象**：catalog 存在父键与子键并存（如 `toolbar.open` 与 `toolbar.open.file`、`search.counter` 与 `search.counter.aria`、`settings.reading.theme` 与 `settings.reading.theme.dark`），嵌套 JSON 无法表示；`t()` 按字面点分键查找。
6. **图标为最小占位集**：见 §5.1；wp-40 负责正式图标与 bundle 配置。
7. **`.prettierignore` 覆盖框架目录**（`.claude/`、`.opencode/`、`artifacts/`、`config/`、`docs/`、`input/`、`scripts/`、`state/` 等），保证 `pnpm format` 不越界改写框架/工件文件。

未修改任何 upstream Artifact、框架文件或 handoff 声明之外的路径。

## 7. 已知限制 / 未验证项（UNVERIFIED）

- 未运行 `tauri dev` / `tauri build`，未打开真实窗口：窗口标题/尺寸配置仅通过配置与编译验证；真实渲染证据属 wp-22（EA-RUN）与打包任务。
- 无 Rust 单元/集成测试落地（骨架 0 tests；C-02 起才有真实测试面）。
- `pnpm build` 产物文件名带内容哈希（`index-B084Aanz.js`），后续修订会变化。
- WebDriver/Wayland 等环境限制按计划 §5.5 保持 UNVERIFIED（与 wp-07 范围无关，不据此宣称通过）。

## 8. 追溯

- 任务：`artifacts/50-plan/implementation-plan.md` §4.1 T-01（工程初始化）、T-02（i18n 骨架），wp-07 行提交范围。
- 组件：C-01；DoD「corepack 固定 pnpm；两锁文件；`pnpm build` 空壳通过；`cargo check` 通过」。
- 依据：ADR-001（技术栈/版本锁定/插件白名单）、ADR-009（i18n 资源包与回退）、`artifacts/40-ux/strings-zh-CN.md`（键源）、`config/project.md` §Technology。
- 下游：wp-08 起在同一工程骨架上添加 Rust 模型/服务；wp-16 扩展 i18n 运行时（调用签名与资源布局已固定，替换实现不改调用点）。

## 9. 下一步

交 `quality-reviewer`/门禁做独立检查：核验锁文件、脚本、i18n 键 parity（378）、capabilities 最小性（仅 `core:default`）与图标占位处置；通过后由 `repository-manager` 以 `rm-07` 合并入 `feat/v0.1.0`。
