# 纸栈 PaperStack 第三方软件声明（Third-Party Notices）

本文档随 PaperStack v0.1.0 分发，覆盖应用实际装载的第三方运行期组件，供离线查看（R30、NF12）。

## 方法与范围（Method and Coverage）

**生成方法（本次清单）：**

- npm 运行期闭包：`pnpm licenses list --prod --json`（263 个包/版本；pnpm 10.34.6）。
- Rust 运行期闭包：`cargo metadata --locked` 解析图中从 `paperstack` 根包沿普通依赖边可达的 crate（540 个 crate；Rust 1.96.0）。
- 渲染资源：KaTeX 字体、Shiki 语法/主题、Mermaid 按其安装包内 LICENSE/元数据记录。

**引用的锁文件（结论应以真实锁文件为准）：**

- `pnpm-lock.yaml` — sha256 `d1b796a2d5eb1cebc86fe22d2735e340846f2fafd6c0fcf63b12642d6b10ff08`
- `src-tauri/Cargo.lock` — sha256 `7ef9a84fea22179491f8c413aa9f7aa7f88e991a322fa2a097a2ad1ae5e78263`

**明确的覆盖限制（本清单不是法律审计）：**

1. npm 列为 **production 依赖闭包**（含传递依赖，含仅类型声明的 `@types/*`，其不注入运行时代码），不含 devDependencies；Rust 列为 **普通依赖运行期闭包**，不含 build-dependencies、dev-dependencies 与仅编译期使用的过程宏。
2. 解析图是上界：按目标平台/feature 裁剪后未链接进最终二进制的 crate 仍可能出现在表中；反向漏列未发现（闭包由 cargo/pnpm 解析结果推导）。
3. Shiki 的词法语法（grammar）与主题来自上游 TextMate 生态项目，其**逐件上游许可**未随 npm 包提供；表中按 Shiki 包（MIT）记录，实际随包发行的语法子集见下文“渲染资源”一节。
4. KaTeX 字体、界面字体等字体文件随对应 npm 包按该包许可证发行；npm 包内无单独字体许可文件。
5. 许可证名称来自包元数据（SPDX 字段）或包内许可文件的人工可复核读取；本清单不构成法律意见，最终合规结论需由法律审计结合真实锁文件与上游通知确认。

## GPL-3.0-only 兼容性说明（Compatibility Stance）

PaperStack 自身以 **GPL-3.0-only** 发行（未改写 GPLv3 全文见仓库根 `LICENSE`）。本清单所列运行期许可（MIT、Apache-2.0、ISC、BSD-2/3-Clause、MPL-2.0 或 Apache-2.0、EPL-2.0、Unlicense 等）均为开源/自由软件许可，未发现已知与 GPLv3 不兼容的运行期条目；其中 MPL-2.0/EPL-2.0 的 GPL 兼容性依赖其许可文本中的二次许可（secondary license）条款，最终兼容性结论应由法律审计确认。`(MPL-2.0 OR Apache-2.0)` 条目（DOMPurify）可在 GPL 兼容场景下按 Apache-2.0 使用。第三方条目保留其原始许可与作者，不统一改归 Quirkybrain（R30）。

> 许可原文与完整性核对：`LICENSE`（GPL-3.0-only 全文）与本文档随安装包（`/usr/lib/paperstack/`）及应用“关于”页离线提供。

## npm production 依赖闭包（263 条）

按许可分组统计：(MPL-2.0 OR Apache-2.0) × 1、Apache-2.0 × 6、Apache-2.0 OR MIT × 1、BSD-2-Clause × 1、BSD-3-Clause × 6、EPL-2.0 × 1、ISC × 35、MIT × 210、MIT (package license file `license`; not declared in package metadata) × 1、Unlicense × 1

| 包 | 版本 | 许可证（包元数据） |
|---|---|---|
| `@antfu/install-pkg` | 2.1.0 | MIT |
| `@braintree/sanitize-url` | 7.1.2 | MIT |
| `@chevrotain/cst-dts-gen` | 13.2.0 | Apache-2.0 |
| `@chevrotain/gast` | 13.2.0 | Apache-2.0 |
| `@chevrotain/regexp-to-ast` | 13.2.0 | Apache-2.0 |
| `@chevrotain/types` | 13.2.0 | Apache-2.0 |
| `@chevrotain/utils` | 13.2.0 | Apache-2.0 |
| `@iconify/types` | 2.0.0 | MIT |
| `@iconify/utils` | 3.1.7 | MIT |
| `@mermaid-js/parser` | 2.0.1 | MIT |
| `@shikijs/core` | 4.5.0 | MIT |
| `@shikijs/engine-javascript` | 4.5.0 | MIT |
| `@shikijs/engine-oniguruma` | 4.5.0 | MIT |
| `@shikijs/langs` | 4.5.0 | MIT |
| `@shikijs/primitive` | 4.5.0 | MIT |
| `@shikijs/themes` | 4.5.0 | MIT |
| `@shikijs/types` | 4.5.0 | MIT |
| `@shikijs/vscode-textmate` | 10.0.2 | MIT |
| `@tauri-apps/api` | 2.12.1 | Apache-2.0 OR MIT |
| `@types/d3` | 7.4.3 | MIT |
| `@types/d3-array` | 3.2.2 | MIT |
| `@types/d3-axis` | 3.0.6 | MIT |
| `@types/d3-brush` | 3.0.6 | MIT |
| `@types/d3-chord` | 3.0.6 | MIT |
| `@types/d3-color` | 3.1.3 | MIT |
| `@types/d3-contour` | 3.0.6 | MIT |
| `@types/d3-delaunay` | 6.0.4 | MIT |
| `@types/d3-dispatch` | 3.0.7 | MIT |
| `@types/d3-drag` | 3.0.7 | MIT |
| `@types/d3-dsv` | 3.0.7 | MIT |
| `@types/d3-ease` | 3.0.2 | MIT |
| `@types/d3-fetch` | 3.0.7 | MIT |
| `@types/d3-force` | 3.0.10 | MIT |
| `@types/d3-format` | 3.0.4 | MIT |
| `@types/d3-geo` | 3.1.1 | MIT |
| `@types/d3-hierarchy` | 3.1.7 | MIT |
| `@types/d3-interpolate` | 3.0.4 | MIT |
| `@types/d3-path` | 3.1.1 | MIT |
| `@types/d3-polygon` | 3.0.2 | MIT |
| `@types/d3-quadtree` | 3.0.6 | MIT |
| `@types/d3-random` | 3.0.4 | MIT |
| `@types/d3-scale` | 4.0.9 | MIT |
| `@types/d3-scale-chromatic` | 3.1.0 | MIT |
| `@types/d3-selection` | 3.0.12 | MIT |
| `@types/d3-shape` | 3.2.0 | MIT |
| `@types/d3-time` | 3.0.4 | MIT |
| `@types/d3-time-format` | 4.0.3 | MIT |
| `@types/d3-timer` | 3.0.2 | MIT |
| `@types/d3-transition` | 3.0.9 | MIT |
| `@types/d3-zoom` | 3.0.9 | MIT |
| `@types/debug` | 4.1.13 | MIT |
| `@types/estree` | 1.0.9 | MIT |
| `@types/estree-jsx` | 1.0.5 | MIT |
| `@types/geojson` | 7946.0.16 | MIT |
| `@types/hast` | 3.0.5 | MIT |
| `@types/katex` | 0.16.8 | MIT |
| `@types/mdast` | 4.0.4 | MIT |
| `@types/ms` | 2.1.0 | MIT |
| `@types/trusted-types` | 2.0.7 | MIT |
| `@types/unist` | 2.0.11 | MIT |
| `@types/unist` | 3.0.3 | MIT |
| `@ungap/structured-clone` | 1.4.0 | ISC |
| `@upsetjs/venn.js` | 2.0.0 | MIT |
| `bail` | 2.0.2 | MIT |
| `ccount` | 2.0.1 | MIT |
| `character-entities` | 2.0.2 | MIT |
| `character-entities-html4` | 2.1.0 | MIT |
| `character-entities-legacy` | 3.0.0 | MIT |
| `character-reference-invalid` | 2.0.1 | MIT |
| `chevrotain` | 13.2.0 | Apache-2.0 |
| `comma-separated-tokens` | 2.0.3 | MIT |
| `commander` | 15.0.0 | MIT |
| `commander` | 7.2.0 | MIT |
| `commander` | 8.3.0 | MIT |
| `cose-base` | 1.0.3 | MIT |
| `cose-base` | 2.2.0 | MIT |
| `cytoscape` | 3.34.3 | MIT |
| `cytoscape-cose-bilkent` | 4.1.0 | MIT |
| `cytoscape-fcose` | 2.2.0 | MIT |
| `d3` | 7.9.0 | ISC |
| `d3-array` | 2.12.1 | BSD-3-Clause |
| `d3-array` | 3.2.4 | ISC |
| `d3-axis` | 3.0.0 | ISC |
| `d3-brush` | 3.0.0 | ISC |
| `d3-chord` | 3.0.1 | ISC |
| `d3-color` | 3.1.0 | ISC |
| `d3-contour` | 4.0.2 | ISC |
| `d3-delaunay` | 6.0.4 | ISC |
| `d3-dispatch` | 3.0.1 | ISC |
| `d3-drag` | 3.0.0 | ISC |
| `d3-dsv` | 3.0.1 | ISC |
| `d3-ease` | 3.0.1 | BSD-3-Clause |
| `d3-fetch` | 3.0.1 | ISC |
| `d3-force` | 3.0.0 | ISC |
| `d3-format` | 3.1.2 | ISC |
| `d3-geo` | 3.1.1 | ISC |
| `d3-hierarchy` | 3.1.2 | ISC |
| `d3-interpolate` | 3.0.1 | ISC |
| `d3-path` | 1.0.9 | BSD-3-Clause |
| `d3-path` | 3.1.0 | ISC |
| `d3-polygon` | 3.0.1 | ISC |
| `d3-quadtree` | 3.0.1 | ISC |
| `d3-random` | 3.0.1 | ISC |
| `d3-sankey` | 0.12.3 | BSD-3-Clause |
| `d3-scale` | 4.0.2 | ISC |
| `d3-scale-chromatic` | 3.1.0 | ISC |
| `d3-selection` | 3.0.0 | ISC |
| `d3-shape` | 1.3.7 | BSD-3-Clause |
| `d3-shape` | 3.2.0 | ISC |
| `d3-time` | 3.1.0 | ISC |
| `d3-time-format` | 4.1.0 | ISC |
| `d3-timer` | 3.0.1 | ISC |
| `d3-transition` | 3.0.1 | ISC |
| `d3-zoom` | 3.0.0 | ISC |
| `dagre-d3-es` | 7.0.14 | MIT |
| `dayjs` | 1.11.23 | MIT |
| `debug` | 4.4.3 | MIT |
| `decode-named-character-reference` | 1.3.0 | MIT |
| `delaunator` | 5.1.0 | ISC |
| `dequal` | 2.0.3 | MIT |
| `devlop` | 1.1.0 | MIT |
| `dompurify` | 3.4.16 | (MPL-2.0 OR Apache-2.0) |
| `elkjs` | 0.9.3 | EPL-2.0 |
| `entities` | 6.0.1 | BSD-2-Clause |
| `es-toolkit` | 1.52.0 | MIT |
| `escape-string-regexp` | 5.0.0 | MIT |
| `estree-util-is-identifier-name` | 3.0.0 | MIT |
| `extend` | 3.0.2 | MIT |
| `hachure-fill` | 0.5.2 | MIT |
| `hast-util-from-dom` | 5.0.1 | ISC |
| `hast-util-from-html` | 2.0.3 | MIT |
| `hast-util-from-html-isomorphic` | 2.0.0 | MIT |
| `hast-util-from-parse5` | 8.0.3 | MIT |
| `hast-util-is-element` | 3.0.0 | MIT |
| `hast-util-parse-selector` | 4.0.0 | MIT |
| `hast-util-raw` | 9.1.0 | MIT |
| `hast-util-sanitize` | 5.0.2 | MIT |
| `hast-util-to-html` | 9.0.5 | MIT |
| `hast-util-to-jsx-runtime` | 2.3.6 | MIT |
| `hast-util-to-parse5` | 8.0.1 | MIT |
| `hast-util-to-text` | 4.0.2 | MIT |
| `hast-util-whitespace` | 3.0.0 | MIT |
| `hastscript` | 9.0.1 | MIT |
| `html-void-elements` | 3.0.0 | MIT |
| `iconv-lite` | 0.6.3 | MIT |
| `import-meta-resolve` | 4.2.0 | MIT |
| `inline-style-parser` | 0.2.7 | MIT |
| `internmap` | 1.0.1 | ISC |
| `internmap` | 2.0.3 | ISC |
| `is-alphabetical` | 2.0.1 | MIT |
| `is-alphanumerical` | 2.0.1 | MIT |
| `is-decimal` | 2.0.1 | MIT |
| `is-hexadecimal` | 2.0.1 | MIT |
| `is-plain-obj` | 4.1.0 | MIT |
| `katex` | 0.16.47 | MIT |
| `katex` | 0.19.0 | MIT |
| `khroma` | 2.1.0 | MIT (package license file `license`; not declared in package metadata) |
| `layout-base` | 1.0.2 | MIT |
| `layout-base` | 2.0.1 | MIT |
| `lodash-es` | 4.18.1 | MIT |
| `longest-streak` | 3.1.0 | MIT |
| `markdown-table` | 3.0.4 | MIT |
| `marked` | 16.4.2 | MIT |
| `mdast-util-find-and-replace` | 3.0.3 | MIT |
| `mdast-util-from-markdown` | 2.1.0 | MIT |
| `mdast-util-gfm` | 3.1.0 | MIT |
| `mdast-util-gfm-autolink-literal` | 2.0.1 | MIT |
| `mdast-util-gfm-footnote` | 2.1.0 | MIT |
| `mdast-util-gfm-strikethrough` | 2.0.1 | MIT |
| `mdast-util-gfm-table` | 2.0.0 | MIT |
| `mdast-util-gfm-task-list-item` | 2.0.0 | MIT |
| `mdast-util-math` | 3.0.0 | MIT |
| `mdast-util-mdx-expression` | 2.0.1 | MIT |
| `mdast-util-mdx-jsx` | 3.2.0 | MIT |
| `mdast-util-mdxjs-esm` | 2.0.1 | MIT |
| `mdast-util-phrasing` | 4.1.0 | MIT |
| `mdast-util-to-hast` | 13.2.1 | MIT |
| `mdast-util-to-markdown` | 2.2.0 | MIT |
| `mdast-util-to-string` | 4.0.0 | MIT |
| `mermaid` | 12.1.0 | MIT |
| `micromark` | 4.0.3 | MIT |
| `micromark-core-commonmark` | 2.0.4 | MIT |
| `micromark-extension-gfm` | 3.0.0 | MIT |
| `micromark-extension-gfm-autolink-literal` | 2.1.0 | MIT |
| `micromark-extension-gfm-footnote` | 2.1.0 | MIT |
| `micromark-extension-gfm-strikethrough` | 2.1.0 | MIT |
| `micromark-extension-gfm-table` | 2.1.2 | MIT |
| `micromark-extension-gfm-tagfilter` | 2.0.0 | MIT |
| `micromark-extension-gfm-task-list-item` | 2.1.0 | MIT |
| `micromark-extension-math` | 3.1.0 | MIT |
| `micromark-factory-destination` | 2.0.1 | MIT |
| `micromark-factory-label` | 2.0.1 | MIT |
| `micromark-factory-space` | 2.1.0 | MIT |
| `micromark-factory-title` | 2.0.1 | MIT |
| `micromark-factory-whitespace` | 2.0.1 | MIT |
| `micromark-util-character` | 2.1.1 | MIT |
| `micromark-util-chunked` | 2.0.1 | MIT |
| `micromark-util-classify-character` | 2.0.1 | MIT |
| `micromark-util-combine-extensions` | 2.0.1 | MIT |
| `micromark-util-decode-numeric-character-reference` | 2.0.2 | MIT |
| `micromark-util-decode-string` | 2.0.1 | MIT |
| `micromark-util-edit-map` | 1.0.0 | MIT |
| `micromark-util-encode` | 2.0.1 | MIT |
| `micromark-util-html-tag-name` | 2.0.1 | MIT |
| `micromark-util-normalize-identifier` | 2.0.1 | MIT |
| `micromark-util-resolve-all` | 2.0.1 | MIT |
| `micromark-util-sanitize-uri` | 2.0.1 | MIT |
| `micromark-util-subtokenize` | 2.1.0 | MIT |
| `micromark-util-symbol` | 2.0.1 | MIT |
| `micromark-util-types` | 2.0.3 | MIT |
| `ms` | 2.1.3 | MIT |
| `oniguruma-parser` | 0.12.2 | MIT |
| `oniguruma-to-es` | 4.3.6 | MIT |
| `package-manager-detector` | 1.9.0 | MIT |
| `parse-entities` | 4.0.2 | MIT |
| `parse5` | 7.3.0 | MIT |
| `path-data-parser` | 0.1.0 | MIT |
| `points-on-curve` | 0.2.0 | MIT |
| `points-on-path` | 0.2.1 | MIT |
| `property-information` | 7.2.0 | MIT |
| `react` | 19.3.0 | MIT |
| `react-dom` | 19.3.0 | MIT |
| `regex` | 6.1.0 | MIT |
| `regex-recursion` | 6.0.2 | MIT |
| `regex-utilities` | 2.3.0 | MIT |
| `rehype-katex` | 7.0.1 | MIT |
| `rehype-raw` | 7.0.0 | MIT |
| `rehype-react` | 8.0.0 | MIT |
| `rehype-sanitize` | 6.0.0 | MIT |
| `remark-gfm` | 4.0.1 | MIT |
| `remark-math` | 6.0.0 | MIT |
| `remark-parse` | 11.0.0 | MIT |
| `remark-rehype` | 11.1.2 | MIT |
| `remark-stringify` | 11.0.0 | MIT |
| `robust-predicates` | 3.0.3 | Unlicense |
| `roughjs` | 4.6.6 | MIT |
| `rw` | 1.3.3 | BSD-3-Clause |
| `safer-buffer` | 2.1.2 | MIT |
| `scheduler` | 0.28.0 | MIT |
| `shiki` | 4.5.0 | MIT |
| `space-separated-tokens` | 2.0.2 | MIT |
| `stringify-entities` | 4.0.4 | MIT |
| `style-to-js` | 1.1.21 | MIT |
| `style-to-object` | 1.0.14 | MIT |
| `stylis` | 4.4.0 | MIT |
| `tinyexec` | 1.3.1 | MIT |
| `trim-lines` | 3.0.1 | MIT |
| `trough` | 2.2.0 | MIT |
| `ts-dedent` | 2.3.0 | MIT |
| `unified` | 11.0.5 | MIT |
| `unist-util-find-after` | 5.0.0 | MIT |
| `unist-util-is` | 6.0.1 | MIT |
| `unist-util-position` | 5.0.0 | MIT |
| `unist-util-remove-position` | 5.0.0 | MIT |
| `unist-util-stringify-position` | 4.0.0 | MIT |
| `unist-util-visit` | 5.1.0 | MIT |
| `unist-util-visit-parents` | 6.0.2 | MIT |
| `uuid` | 14.0.2 | MIT |
| `vfile` | 6.0.3 | MIT |
| `vfile-location` | 5.0.3 | MIT |
| `vfile-message` | 4.0.3 | MIT |
| `web-namespaces` | 2.0.1 | MIT |
| `zwitch` | 2.0.4 | MIT |

> 版本与来源（npm registry + 锁定 tarball 完整性）以 `pnpm-lock.yaml` 为准；上表版本即锁文件解析结果。

## Rust 运行期依赖闭包（540 个 crate）

按许可证统计：(MIT OR Apache-2.0) AND Unicode-3.0 × 1；0BSD OR MIT OR Apache-2.0 × 1；Apache-2.0 × 3；Apache-2.0 / MIT × 1；Apache-2.0 AND ISC × 1；Apache-2.0 AND MIT × 1；Apache-2.0 OR BSL-1.0 × 1；Apache-2.0 OR ISC OR MIT × 2；Apache-2.0 OR MIT × 47；Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT × 5；Apache-2.0/MIT × 3；BSD-2-Clause OR Apache-2.0 OR MIT × 2；BSD-3-Clause × 3；BSD-3-Clause AND MIT × 1；BSD-3-Clause OR Apache-2.0 × 2；BSD-3-Clause OR MIT OR Apache-2.0 × 2；BSD-3-Clause/MIT × 1；BSL-1.0 × 2；CC0-1.0 × 1；CC0-1.0 OR MIT-0 OR Apache-2.0 × 1；CDLA-Permissive-2.0 × 1；ISC × 5；MIT × 132；MIT OR Apache-2.0 × 242；MIT OR Apache-2.0 OR LGPL-2.1-or-later × 2；MIT OR Apache-2.0 OR Zlib × 4；MIT OR Zlib OR Apache-2.0 × 2；MIT/Apache-2.0 × 16；MPL-2.0 × 5；Unicode-3.0 × 18；Unlicense OR MIT × 10；Unlicense/MIT × 2；Zlib × 3；Zlib OR Apache-2.0 OR MIT × 17

| Crate | 版本 | 许可证（cargo metadata） |
|---|---|---|
| `adler2` | 2.0.1 | 0BSD OR MIT OR Apache-2.0 |
| `aho-corasick` | 1.1.5 | Unlicense OR MIT |
| `alloc-no-stdlib` | 3.0.0 | BSD-3-Clause |
| `alloc-stdlib` | 0.3.0 | BSD-3-Clause |
| `android_system_properties` | 0.1.6 | MIT OR Apache-2.0 |
| `anyhow` | 1.0.104 | MIT OR Apache-2.0 |
| `arboard` | 3.6.1 | MIT OR Apache-2.0 |
| `async-broadcast` | 0.7.2 | MIT OR Apache-2.0 |
| `async-channel` | 2.5.0 | Apache-2.0 OR MIT |
| `async-executor` | 1.14.0 | Apache-2.0 OR MIT |
| `async-io` | 2.6.0 | Apache-2.0 OR MIT |
| `async-lock` | 3.4.2 | Apache-2.0 OR MIT |
| `async-process` | 2.5.0 | Apache-2.0 OR MIT |
| `async-recursion` | 1.2.0 | MIT OR Apache-2.0 |
| `async-signal` | 0.2.14 | Apache-2.0 OR MIT |
| `async-task` | 4.7.1 | Apache-2.0 OR MIT |
| `async-trait` | 0.1.92 | MIT OR Apache-2.0 |
| `atk` | 0.18.2 | MIT |
| `atk-sys` | 0.18.2 | MIT |
| `atomic-waker` | 1.1.2 | Apache-2.0 OR MIT |
| `base64` | 0.21.7 | MIT OR Apache-2.0 |
| `base64` | 0.22.1 | MIT OR Apache-2.0 |
| `base64` | 0.23.1 | MIT OR Apache-2.0 |
| `bit-set` | 0.8.0 | Apache-2.0 OR MIT |
| `bit-vec` | 0.8.0 | Apache-2.0 OR MIT |
| `bitflags` | 1.3.2 | MIT/Apache-2.0 |
| `bitflags` | 2.13.2 | MIT OR Apache-2.0 |
| `block-buffer` | 0.10.4 | MIT OR Apache-2.0 |
| `block-buffer` | 0.12.1 | MIT OR Apache-2.0 |
| `block2` | 0.6.2 | MIT |
| `blocking` | 1.7.0 | Apache-2.0 OR MIT |
| `brotli` | 9.0.0 | BSD-3-Clause AND MIT |
| `brotli-decompressor` | 6.0.1 | BSD-3-Clause/MIT |
| `bs58` | 0.5.1 | MIT/Apache-2.0 |
| `bumpalo` | 3.20.3 | MIT OR Apache-2.0 |
| `bytemuck` | 1.25.2 | Zlib OR Apache-2.0 OR MIT |
| `byteorder` | 1.5.0 | Unlicense OR MIT |
| `byteorder-lite` | 0.1.0 | Unlicense OR MIT |
| `bytes` | 1.12.1 | MIT |
| `cairo-rs` | 0.18.5 | MIT |
| `cairo-sys-rs` | 0.18.2 | MIT |
| `camino` | 1.2.6 | MIT OR Apache-2.0 |
| `cargo-platform` | 0.1.9 | MIT OR Apache-2.0 |
| `cargo_metadata` | 0.19.2 | MIT |
| `cesu8` | 1.1.0 | Apache-2.0/MIT |
| `cfb` | 0.14.0 | MIT |
| `cfg-if` | 1.0.5 | MIT OR Apache-2.0 |
| `chacha20` | 0.10.2 | MIT OR Apache-2.0 |
| `chrono` | 0.4.45 | MIT OR Apache-2.0 |
| `clipboard-win` | 5.4.1 | BSL-1.0 |
| `combine` | 4.6.8 | MIT |
| `concurrent-queue` | 2.5.0 | Apache-2.0 OR MIT |
| `const-oid` | 0.10.2 | Apache-2.0 OR MIT |
| `cookie` | 0.18.2 | MIT OR Apache-2.0 |
| `core-foundation` | 0.10.1 | MIT OR Apache-2.0 |
| `core-foundation-sys` | 0.8.7 | MIT OR Apache-2.0 |
| `core-graphics` | 0.25.0 | MIT OR Apache-2.0 |
| `core-graphics-types` | 0.2.0 | MIT OR Apache-2.0 |
| `cpufeatures` | 0.2.17 | MIT OR Apache-2.0 |
| `cpufeatures` | 0.3.1 | MIT OR Apache-2.0 |
| `crc32fast` | 1.5.2 | MIT OR Apache-2.0 |
| `crossbeam-channel` | 0.5.17 | MIT OR Apache-2.0 |
| `crossbeam-utils` | 0.8.23 | MIT OR Apache-2.0 |
| `crunchy` | 0.2.4 | MIT |
| `crypto-common` | 0.1.7 | MIT OR Apache-2.0 |
| `crypto-common` | 0.2.2 | MIT OR Apache-2.0 |
| `cssparser` | 0.37.0 | MPL-2.0 |
| `cssparser-macros` | 0.7.1 | MPL-2.0 |
| `ctor` | 1.0.13 | Apache-2.0 OR MIT |
| `darling` | 0.24.1 | MIT |
| `darling_core` | 0.24.1 | MIT |
| `darling_macro` | 0.24.1 | MIT |
| `dbus` | 0.9.12 | Apache-2.0/MIT |
| `defmt` | 1.1.1 | MIT OR Apache-2.0 |
| `defmt-macros` | 1.1.1 | MIT OR Apache-2.0 |
| `defmt-parser` | 1.0.0 | MIT OR Apache-2.0 |
| `deranged` | 0.5.8 | MIT OR Apache-2.0 |
| `derive_more` | 2.1.1 | MIT |
| `derive_more-impl` | 2.1.1 | MIT |
| `digest` | 0.10.7 | MIT OR Apache-2.0 |
| `digest` | 0.11.3 | MIT OR Apache-2.0 |
| `dirs` | 7.0.0 | MIT OR Apache-2.0 |
| `dirs-sys` | 0.5.0 | MIT OR Apache-2.0 |
| `dispatch2` | 0.3.1 | Zlib OR Apache-2.0 OR MIT |
| `displaydoc` | 0.2.7 | MIT OR Apache-2.0 |
| `dlopen2` | 0.8.2 | MIT |
| `dlopen2_derive` | 0.4.3 | MIT |
| `dom_query` | 0.28.0 | MIT |
| `downcast-rs` | 1.2.1 | MIT/Apache-2.0 |
| `dpi` | 0.1.2 | Apache-2.0 AND MIT |
| `dtoa` | 1.0.11 | MIT OR Apache-2.0 |
| `dtoa-short` | 0.3.5 | MPL-2.0 |
| `dunce` | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 |
| `dyn-clone` | 1.0.20 | MIT OR Apache-2.0 |
| `embed_plist` | 1.2.2 | MIT OR Apache-2.0 |
| `endi` | 1.1.1 | MIT |
| `enumflags2` | 0.7.12 | MIT OR Apache-2.0 |
| `enumflags2_derive` | 0.7.12 | MIT OR Apache-2.0 |
| `equivalent` | 1.0.2 | Apache-2.0 OR MIT |
| `erased-serde` | 0.4.10 | MIT OR Apache-2.0 |
| `errno` | 0.3.14 | MIT OR Apache-2.0 |
| `error-code` | 3.4.0 | BSL-1.0 |
| `event-listener` | 5.4.2 | Apache-2.0 OR MIT |
| `event-listener-strategy` | 0.5.4 | Apache-2.0 OR MIT |
| `fallible-iterator` | 0.3.0 | MIT/Apache-2.0 |
| `fallible-streaming-iterator` | 0.1.9 | MIT/Apache-2.0 |
| `fastrand` | 2.5.0 | Apache-2.0 OR MIT |
| `fax` | 0.2.7 | MIT |
| `fdeflate` | 0.3.7 | MIT OR Apache-2.0 |
| `field-offset` | 0.3.6 | MIT OR Apache-2.0 |
| `fixedbitset` | 0.5.7 | MIT OR Apache-2.0 |
| `flate2` | 1.1.10 | MIT OR Apache-2.0 |
| `fnv` | 1.0.7 | Apache-2.0 / MIT |
| `foldhash` | 0.1.5 | Zlib |
| `foldhash` | 0.2.0 | Zlib |
| `foreign-types` | 0.5.0 | MIT/Apache-2.0 |
| `foreign-types-macros` | 0.2.4 | MIT/Apache-2.0 |
| `foreign-types-shared` | 0.3.1 | MIT/Apache-2.0 |
| `form_urlencoded` | 1.2.2 | MIT OR Apache-2.0 |
| `fsevent-sys` | 4.1.0 | MIT |
| `futures-channel` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-core` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-executor` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-io` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-lite` | 2.6.1 | Apache-2.0 OR MIT |
| `futures-macro` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-sink` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-task` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-util` | 0.3.34 | MIT OR Apache-2.0 |
| `gdk` | 0.18.2 | MIT |
| `gdk-pixbuf` | 0.18.5 | MIT |
| `gdk-pixbuf-sys` | 0.18.0 | MIT |
| `gdk-sys` | 0.18.2 | MIT |
| `gdkwayland-sys` | 0.18.2 | MIT |
| `gdkx11` | 0.18.2 | MIT |
| `gdkx11-sys` | 0.18.2 | MIT |
| `generic-array` | 0.14.7 | MIT |
| `gethostname` | 1.1.0 | Apache-2.0 |
| `getrandom` | 0.2.17 | MIT OR Apache-2.0 |
| `getrandom` | 0.3.4 | MIT OR Apache-2.0 |
| `getrandom` | 0.4.3 | MIT OR Apache-2.0 |
| `gio` | 0.18.4 | MIT |
| `gio-sys` | 0.18.1 | MIT |
| `glib` | 0.18.5 | MIT |
| `glib-macros` | 0.18.5 | MIT |
| `glib-sys` | 0.18.1 | MIT |
| `glob` | 0.3.4 | MIT OR Apache-2.0 |
| `gobject-sys` | 0.18.0 | MIT |
| `gtk` | 0.18.2 | MIT |
| `gtk-sys` | 0.18.2 | MIT |
| `gtk3-macros` | 0.18.2 | MIT |
| `half` | 2.7.1 | MIT OR Apache-2.0 |
| `hashbrown` | 0.12.3 | MIT OR Apache-2.0 |
| `hashbrown` | 0.15.5 | MIT OR Apache-2.0 |
| `hashbrown` | 0.16.1 | MIT OR Apache-2.0 |
| `hashbrown` | 0.17.1 | MIT OR Apache-2.0 |
| `hashlink` | 0.12.2 | MIT OR Apache-2.0 |
| `heck` | 0.4.1 | MIT OR Apache-2.0 |
| `heck` | 0.5.0 | MIT OR Apache-2.0 |
| `hermit-abi` | 0.5.3 | MIT OR Apache-2.0 |
| `hex` | 0.4.3 | MIT OR Apache-2.0 |
| `html5ever` | 0.39.0 | MIT OR Apache-2.0 |
| `http` | 1.5.0 | MIT OR Apache-2.0 |
| `http-body` | 1.1.0 | MIT |
| `http-body-util` | 0.1.5 | MIT |
| `http-range` | 0.1.5 | MIT |
| `httparse` | 1.10.1 | MIT OR Apache-2.0 |
| `hybrid-array` | 0.4.15 | MIT OR Apache-2.0 |
| `hyper` | 1.12.0 | MIT |
| `hyper-rustls` | 0.27.10 | Apache-2.0 OR ISC OR MIT |
| `hyper-util` | 0.1.21 | MIT |
| `iana-time-zone` | 0.1.65 | MIT OR Apache-2.0 |
| `iana-time-zone-haiku` | 0.1.2 | MIT OR Apache-2.0 |
| `ico` | 0.5.0 | MIT |
| `icu_collections` | 2.3.0 | Unicode-3.0 |
| `icu_locale_core` | 2.3.0 | Unicode-3.0 |
| `icu_normalizer` | 2.3.0 | Unicode-3.0 |
| `icu_normalizer_data` | 2.3.0 | Unicode-3.0 |
| `icu_properties` | 2.3.0 | Unicode-3.0 |
| `icu_properties_data` | 2.3.0 | Unicode-3.0 |
| `icu_provider` | 2.3.1 | Unicode-3.0 |
| `ident_case` | 1.0.1 | MIT/Apache-2.0 |
| `idna` | 1.1.0 | MIT OR Apache-2.0 |
| `idna_adapter` | 1.2.2 | Apache-2.0 OR MIT |
| `image` | 0.25.10 | MIT OR Apache-2.0 |
| `indexmap` | 1.9.3 | Apache-2.0 OR MIT |
| `indexmap` | 2.14.2 | Apache-2.0 OR MIT |
| `infer` | 0.22.0 | MIT |
| `inotify` | 0.11.5 | ISC |
| `inotify-sys` | 0.1.8 | ISC |
| `ipnet` | 2.12.2 | MIT OR Apache-2.0 |
| `is-docker` | 0.2.0 | MIT |
| `is-wsl` | 0.4.0 | MIT |
| `itoa` | 1.0.18 | MIT OR Apache-2.0 |
| `javascriptcore-rs` | 1.1.2 | MIT |
| `javascriptcore-rs-sys` | 1.1.1 | MIT |
| `jiff` | 0.2.38 | Unlicense OR MIT |
| `jiff-core` | 0.1.1 | Unlicense OR MIT |
| `jiff-static` | 0.2.38 | Unlicense OR MIT |
| `jiff-tzdb` | 0.1.9 | Unlicense OR MIT |
| `jiff-tzdb-platform` | 0.1.3 | Unlicense OR MIT |
| `jni` | 0.21.1 | MIT/Apache-2.0 |
| `jni-sys` | 0.3.1 | MIT OR Apache-2.0 |
| `jni-sys` | 0.4.1 | MIT OR Apache-2.0 |
| `jni-sys-macros` | 0.4.1 | MIT OR Apache-2.0 |
| `js-sys` | 0.3.106 | MIT OR Apache-2.0 |
| `json-patch` | 4.2.0 | MIT/Apache-2.0 |
| `jsonptr` | 0.7.1 | MIT OR Apache-2.0 |
| `keyboard-types` | 0.8.3 | MIT OR Apache-2.0 |
| `kqueue` | 1.2.1 | MIT |
| `kqueue-sys` | 1.1.2 | MIT |
| `lazy_static` | 1.5.1 | MIT OR Apache-2.0 |
| `libappindicator` | 0.9.0 | Apache-2.0 OR MIT |
| `libappindicator-sys` | 0.9.0 | Apache-2.0 OR MIT |
| `libc` | 0.2.190 | MIT OR Apache-2.0 |
| `libdbus-sys` | 0.2.7 | Apache-2.0/MIT |
| `libloading` | 0.7.4 | ISC |
| `libredox` | 0.1.25 | MIT |
| `libsqlite3-sys` | 0.38.2 | MIT |
| `linux-raw-sys` | 0.12.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `litemap` | 0.8.3 | Unicode-3.0 |
| `lock_api` | 0.4.14 | MIT OR Apache-2.0 |
| `log` | 0.4.34 | MIT OR Apache-2.0 |
| `lru-slab` | 0.1.3 | MIT OR Apache-2.0 OR Zlib |
| `markup5ever` | 0.39.0 | MIT OR Apache-2.0 |
| `matchers` | 0.2.0 | MIT |
| `memchr` | 2.8.3 | Unlicense OR MIT |
| `memoffset` | 0.9.1 | MIT |
| `mime` | 0.3.17 | MIT OR Apache-2.0 |
| `miniz_oxide` | 0.8.9 | MIT OR Zlib OR Apache-2.0 |
| `miniz_oxide` | 0.9.1 | MIT OR Zlib OR Apache-2.0 |
| `mio` | 1.2.4 | MIT |
| `moxcms` | 0.8.1 | BSD-3-Clause OR Apache-2.0 |
| `muda` | 0.20.0 | Apache-2.0 OR MIT |
| `ndk` | 0.9.0 | MIT OR Apache-2.0 |
| `ndk-context` | 0.1.1 | MIT OR Apache-2.0 |
| `ndk-sys` | 0.6.0+11769913 | MIT OR Apache-2.0 |
| `new_debug_unreachable` | 1.0.6 | MIT |
| `nom` | 8.0.0 | MIT |
| `notify` | 8.2.0 | CC0-1.0 |
| `notify-types` | 2.1.0 | MIT OR Apache-2.0 |
| `nu-ansi-term` | 0.50.3 | MIT |
| `num-conv` | 0.2.2 | MIT OR Apache-2.0 |
| `num-traits` | 0.2.19 | MIT OR Apache-2.0 |
| `num_enum` | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 |
| `num_enum_derive` | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 |
| `objc2` | 0.6.5 | MIT |
| `objc2-app-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-cloud-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-core-data` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-core-foundation` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-core-graphics` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-core-image` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-core-location` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-core-text` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-encode` | 4.1.0 | MIT |
| `objc2-exception-helper` | 0.1.1 | Zlib OR Apache-2.0 OR MIT |
| `objc2-foundation` | 0.3.2 | MIT |
| `objc2-io-surface` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-quartz-core` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-ui-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-user-notifications` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `objc2-web-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT |
| `once_cell` | 1.21.4 | MIT OR Apache-2.0 |
| `open` | 5.4.4 | MIT |
| `option-ext` | 0.2.0 | MPL-2.0 |
| `ordered-stream` | 0.2.0 | MIT OR Apache-2.0 |
| `os_pipe` | 1.2.3 | MIT |
| `pango` | 0.18.3 | MIT |
| `pango-sys` | 0.18.0 | MIT |
| `parking` | 2.2.1 | Apache-2.0 OR MIT |
| `parking_lot` | 0.12.5 | MIT OR Apache-2.0 |
| `parking_lot_core` | 0.9.12 | MIT OR Apache-2.0 |
| `percent-encoding` | 2.3.2 | MIT OR Apache-2.0 |
| `petgraph` | 0.8.3 | MIT OR Apache-2.0 |
| `phf` | 0.13.1 | MIT |
| `phf_generator` | 0.13.1 | MIT |
| `phf_macros` | 0.13.1 | MIT |
| `phf_shared` | 0.13.1 | MIT |
| `pin-project-lite` | 0.2.17 | Apache-2.0 OR MIT |
| `piper` | 0.2.5 | MIT OR Apache-2.0 |
| `plist` | 1.10.1 | MIT |
| `png` | 0.17.16 | MIT OR Apache-2.0 |
| `png` | 0.18.1 | MIT OR Apache-2.0 |
| `polling` | 3.11.0 | Apache-2.0 OR MIT |
| `portable-atomic` | 1.15.0 | Apache-2.0 OR MIT |
| `portable-atomic-util` | 0.2.8 | Apache-2.0 OR MIT |
| `potential_utf` | 0.1.6 | Unicode-3.0 |
| `powerfmt` | 0.2.1 | MIT OR Apache-2.0 |
| `precomputed-hash` | 0.1.1 | MIT |
| `proc-macro-crate` | 1.3.1 | MIT OR Apache-2.0 |
| `proc-macro-crate` | 2.0.2 | MIT OR Apache-2.0 |
| `proc-macro-crate` | 3.5.0 | MIT OR Apache-2.0 |
| `proc-macro-error` | 1.0.4 | MIT OR Apache-2.0 |
| `proc-macro-error-attr` | 1.0.4 | MIT OR Apache-2.0 |
| `proc-macro2` | 1.0.107 | MIT OR Apache-2.0 |
| `pxfm` | 0.1.30 | BSD-3-Clause OR Apache-2.0 |
| `quick-error` | 2.0.1 | MIT/Apache-2.0 |
| `quick-xml` | 0.41.0 | MIT |
| `quick-xml` | 0.42.0 | MIT |
| `quinn` | 0.11.12 | MIT OR Apache-2.0 |
| `quinn-proto` | 0.11.19 | MIT OR Apache-2.0 |
| `quinn-udp` | 0.5.16 | MIT OR Apache-2.0 |
| `quote` | 1.0.47 | MIT OR Apache-2.0 |
| `r-efi` | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| `r-efi` | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| `rand` | 0.10.3 | MIT OR Apache-2.0 |
| `rand_core` | 0.10.1 | MIT OR Apache-2.0 |
| `rand_pcg` | 0.10.2 | MIT OR Apache-2.0 |
| `raw-window-handle` | 0.6.2 | MIT OR Apache-2.0 OR Zlib |
| `redox_syscall` | 0.5.18 | MIT |
| `redox_users` | 0.5.3 | MIT |
| `ref-cast` | 1.0.27 | MIT OR Apache-2.0 |
| `ref-cast-impl` | 1.0.27 | MIT OR Apache-2.0 |
| `regex` | 1.13.1 | MIT OR Apache-2.0 |
| `regex-automata` | 0.4.18 | MIT OR Apache-2.0 |
| `regex-syntax` | 0.8.11 | MIT OR Apache-2.0 |
| `reqwest` | 0.12.28 | MIT OR Apache-2.0 |
| `reqwest` | 0.13.5 | MIT OR Apache-2.0 |
| `rfd` | 0.16.0 | MIT |
| `ring` | 0.17.14 | Apache-2.0 AND ISC |
| `rsqlite-vfs` | 0.1.1 | MIT |
| `rusqlite` | 0.40.2 | MIT |
| `rustc-hash` | 2.1.3 | Apache-2.0 OR MIT |
| `rustix` | 1.1.5 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `rustls` | 0.23.45 | Apache-2.0 OR ISC OR MIT |
| `rustls-pki-types` | 1.15.1 | MIT OR Apache-2.0 |
| `rustls-webpki` | 0.103.15 | ISC |
| `rustversion` | 1.0.23 | MIT OR Apache-2.0 |
| `ryu` | 1.0.23 | Apache-2.0 OR BSL-1.0 |
| `same-file` | 1.0.6 | Unlicense/MIT |
| `schemars` | 0.8.22 | MIT |
| `schemars` | 0.9.0 | MIT |
| `schemars` | 1.2.2 | MIT |
| `schemars_derive` | 0.8.22 | MIT |
| `scopeguard` | 1.2.0 | MIT OR Apache-2.0 |
| `selectors` | 0.38.0 | MPL-2.0 |
| `semver` | 1.0.28 | MIT OR Apache-2.0 |
| `serde` | 1.0.229 | MIT OR Apache-2.0 |
| `serde-untagged` | 0.1.9 | MIT OR Apache-2.0 |
| `serde_core` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_derive` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_derive_internals` | 0.29.1 | MIT OR Apache-2.0 |
| `serde_json` | 1.0.151 | MIT OR Apache-2.0 |
| `serde_repr` | 0.1.21 | MIT OR Apache-2.0 |
| `serde_spanned` | 0.6.9 | MIT OR Apache-2.0 |
| `serde_spanned` | 1.1.1 | MIT OR Apache-2.0 |
| `serde_urlencoded` | 0.7.1 | MIT/Apache-2.0 |
| `serde_with` | 3.24.0 | MIT OR Apache-2.0 |
| `serde_with_macros` | 3.24.0 | MIT OR Apache-2.0 |
| `serialize-to-javascript` | 0.1.2 | MIT OR Apache-2.0 |
| `serialize-to-javascript-impl` | 0.1.2 | MIT OR Apache-2.0 |
| `servo_arc` | 0.4.3 | MIT OR Apache-2.0 |
| `sha2` | 0.10.9 | MIT OR Apache-2.0 |
| `sha2` | 0.11.0 | MIT OR Apache-2.0 |
| `sharded-slab` | 0.1.7 | MIT |
| `signal-hook-registry` | 1.4.8 | MIT OR Apache-2.0 |
| `simd-adler32` | 0.3.10 | MIT |
| `siphasher` | 1.0.4 | MIT OR Apache-2.0 |
| `slab` | 0.4.12 | MIT |
| `smallvec` | 1.16.2 | MIT OR Apache-2.0 |
| `socket2` | 0.6.5 | MIT OR Apache-2.0 |
| `softbuffer` | 0.4.8 | MIT OR Apache-2.0 |
| `soup3` | 0.5.0 | MIT |
| `soup3-sys` | 0.5.0 | MIT |
| `sqlite-wasm-rs` | 0.5.5 | MIT |
| `stable_deref_trait` | 1.2.1 | MIT OR Apache-2.0 |
| `string_cache` | 0.9.0 | MIT OR Apache-2.0 |
| `strsim` | 0.11.1 | MIT |
| `subtle` | 2.6.1 | BSD-3-Clause |
| `swift-rs` | 1.0.8 | MIT OR Apache-2.0 |
| `syn` | 1.0.109 | MIT OR Apache-2.0 |
| `syn` | 2.0.119 | MIT OR Apache-2.0 |
| `syn` | 3.0.6 | MIT OR Apache-2.0 |
| `sync_wrapper` | 1.0.2 | Apache-2.0 |
| `synstructure` | 0.14.0 | MIT |
| `tao` | 0.37.1 | Apache-2.0 |
| `tao-macros` | 0.1.4 | MIT OR Apache-2.0 |
| `tauri` | 2.12.1 | Apache-2.0 OR MIT |
| `tauri-codegen` | 2.7.1 | Apache-2.0 OR MIT |
| `tauri-macros` | 2.7.1 | Apache-2.0 OR MIT |
| `tauri-plugin-clipboard-manager` | 2.4.1 | Apache-2.0 OR MIT |
| `tauri-plugin-dialog` | 2.8.1 | Apache-2.0 OR MIT |
| `tauri-plugin-fs` | 2.6.0 | Apache-2.0 OR MIT |
| `tauri-plugin-opener` | 2.7.0 | Apache-2.0 OR MIT |
| `tauri-plugin-single-instance` | 2.5.2 | Apache-2.0 OR MIT |
| `tauri-runtime` | 2.12.1 | Apache-2.0 OR MIT |
| `tauri-runtime-wry` | 2.12.1 | Apache-2.0 OR MIT |
| `tauri-utils` | 2.10.1 | Apache-2.0 OR MIT |
| `tempfile` | 3.27.0 | MIT OR Apache-2.0 |
| `tendril` | 0.5.1 | MIT OR Apache-2.0 |
| `thiserror` | 1.0.69 | MIT OR Apache-2.0 |
| `thiserror` | 2.0.21 | MIT OR Apache-2.0 |
| `thiserror-impl` | 1.0.69 | MIT OR Apache-2.0 |
| `thiserror-impl` | 2.0.21 | MIT OR Apache-2.0 |
| `thread_local` | 1.1.10 | MIT OR Apache-2.0 |
| `tiff` | 0.11.3 | MIT |
| `time` | 0.3.55 | MIT OR Apache-2.0 |
| `time-core` | 0.1.9 | MIT OR Apache-2.0 |
| `time-macros` | 0.2.32 | MIT OR Apache-2.0 |
| `tinystr` | 0.8.4 | Unicode-3.0 |
| `tinyvec` | 1.13.3 | Zlib OR Apache-2.0 OR MIT |
| `tokio` | 1.53.2 | MIT |
| `tokio-rustls` | 0.26.6 | MIT OR Apache-2.0 |
| `tokio-util` | 0.7.19 | MIT |
| `toml` | 1.1.6+spec-1.1.0 | MIT OR Apache-2.0 |
| `toml_datetime` | 0.6.3 | MIT OR Apache-2.0 |
| `toml_datetime` | 1.1.1+spec-1.1.0 | MIT OR Apache-2.0 |
| `toml_edit` | 0.19.15 | MIT OR Apache-2.0 |
| `toml_edit` | 0.20.2 | MIT OR Apache-2.0 |
| `toml_edit` | 0.25.15+spec-1.1.0 | MIT OR Apache-2.0 |
| `toml_parser` | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 |
| `toml_writer` | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 |
| `tower` | 0.5.3 | MIT |
| `tower-http` | 0.6.11 | MIT |
| `tower-layer` | 0.3.3 | MIT |
| `tower-service` | 0.3.3 | MIT |
| `tracing` | 0.1.44 | MIT |
| `tracing-attributes` | 0.1.31 | MIT |
| `tracing-core` | 0.1.36 | MIT |
| `tracing-log` | 0.2.0 | MIT |
| `tracing-subscriber` | 0.3.23 | MIT |
| `tray-icon` | 0.25.1 | MIT OR Apache-2.0 |
| `tree_magic_mini` | 3.2.2 | MIT |
| `try-lock` | 0.2.5 | MIT |
| `typeid` | 1.0.3 | MIT OR Apache-2.0 |
| `typenum` | 1.20.1 | MIT OR Apache-2.0 |
| `uds_windows` | 1.2.1 | MIT |
| `unicode-ident` | 1.0.26 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| `unicode-segmentation` | 1.13.3 | MIT OR Apache-2.0 |
| `untrusted` | 0.9.0 | ISC |
| `url` | 2.5.8 | MIT OR Apache-2.0 |
| `urlpattern` | 0.6.0 | MIT |
| `utf8_iter` | 1.0.4 | Apache-2.0 OR MIT |
| `uuid` | 1.27.0 | Apache-2.0 OR MIT |
| `valuable` | 0.1.1 | MIT |
| `walkdir` | 2.5.0 | Unlicense/MIT |
| `want` | 0.3.2 | MIT |
| `wasi` | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wasip2` | 1.0.4+wasi-0.2.12 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wasm-bindgen` | 0.2.129 | MIT OR Apache-2.0 |
| `wasm-bindgen-futures` | 0.4.79 | MIT OR Apache-2.0 |
| `wasm-bindgen-macro` | 0.2.129 | MIT OR Apache-2.0 |
| `wasm-bindgen-macro-support` | 0.2.129 | MIT OR Apache-2.0 |
| `wasm-bindgen-shared` | 0.2.129 | MIT OR Apache-2.0 |
| `wasm-streams` | 0.5.0 | MIT OR Apache-2.0 |
| `wayland-backend` | 0.3.17 | MIT |
| `wayland-client` | 0.31.15 | MIT |
| `wayland-protocols` | 0.32.13 | MIT |
| `wayland-protocols-wlr` | 0.3.12 | MIT |
| `wayland-scanner` | 0.31.11 | MIT |
| `wayland-sys` | 0.31.11 | MIT |
| `web-sys` | 0.3.106 | MIT OR Apache-2.0 |
| `web-time` | 1.1.0 | MIT OR Apache-2.0 |
| `web_atoms` | 0.2.6 | MIT OR Apache-2.0 |
| `webkit2gtk` | 2.0.2 | MIT |
| `webkit2gtk-sys` | 2.0.2 | MIT |
| `webpki-roots` | 1.0.9 | CDLA-Permissive-2.0 |
| `webview2-com` | 0.39.1 | MIT |
| `webview2-com-macros` | 0.8.1 | MIT |
| `webview2-com-sys` | 0.39.1 | MIT |
| `weezl` | 0.1.12 | MIT OR Apache-2.0 |
| `winapi` | 0.3.9 | MIT/Apache-2.0 |
| `winapi-i686-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 |
| `winapi-util` | 0.1.11 | Unlicense OR MIT |
| `winapi-x86_64-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 |
| `window-vibrancy` | 0.8.1 | Apache-2.0 OR MIT |
| `windows` | 0.62.2 | MIT OR Apache-2.0 |
| `windows-collections` | 0.3.2 | MIT OR Apache-2.0 |
| `windows-core` | 0.62.2 | MIT OR Apache-2.0 |
| `windows-future` | 0.3.2 | MIT OR Apache-2.0 |
| `windows-implement` | 0.60.2 | MIT OR Apache-2.0 |
| `windows-interface` | 0.59.3 | MIT OR Apache-2.0 |
| `windows-link` | 0.2.1 | MIT OR Apache-2.0 |
| `windows-numerics` | 0.3.1 | MIT OR Apache-2.0 |
| `windows-result` | 0.4.1 | MIT OR Apache-2.0 |
| `windows-strings` | 0.5.1 | MIT OR Apache-2.0 |
| `windows-sys` | 0.45.0 | MIT OR Apache-2.0 |
| `windows-sys` | 0.52.0 | MIT OR Apache-2.0 |
| `windows-sys` | 0.60.2 | MIT OR Apache-2.0 |
| `windows-sys` | 0.61.2 | MIT OR Apache-2.0 |
| `windows-targets` | 0.42.2 | MIT OR Apache-2.0 |
| `windows-targets` | 0.52.6 | MIT OR Apache-2.0 |
| `windows-targets` | 0.53.5 | MIT OR Apache-2.0 |
| `windows-threading` | 0.2.1 | MIT OR Apache-2.0 |
| `windows-version` | 0.1.7 | MIT OR Apache-2.0 |
| `windows_aarch64_gnullvm` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_aarch64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_aarch64_gnullvm` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_aarch64_msvc` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_aarch64_msvc` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_aarch64_msvc` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_i686_gnu` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_i686_gnu` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_i686_gnu` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_i686_gnullvm` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_i686_gnullvm` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_i686_msvc` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_i686_msvc` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_i686_msvc` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_x86_64_gnu` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_x86_64_gnu` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_x86_64_gnu` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_x86_64_gnullvm` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_x86_64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_x86_64_gnullvm` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_x86_64_msvc` | 0.42.2 | MIT OR Apache-2.0 |
| `windows_x86_64_msvc` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_x86_64_msvc` | 0.53.1 | MIT OR Apache-2.0 |
| `winnow` | 0.5.40 | MIT |
| `winnow` | 1.0.4 | MIT |
| `wit-bindgen` | 0.57.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wl-clipboard-rs` | 0.9.4 | MIT OR Apache-2.0 |
| `writeable` | 0.6.4 | Unicode-3.0 |
| `wry` | 0.57.0 | Apache-2.0 OR MIT |
| `x11` | 2.21.0 | MIT |
| `x11-dl` | 2.21.0 | MIT |
| `x11rb` | 0.13.2 | MIT OR Apache-2.0 |
| `x11rb-protocol` | 0.13.2 | MIT OR Apache-2.0 |
| `yoke` | 0.8.3 | Unicode-3.0 |
| `yoke-derive` | 0.8.4 | Unicode-3.0 |
| `zbus` | 5.19.0 | MIT |
| `zbus_macros` | 5.19.0 | MIT |
| `zbus_names` | 4.3.4 | MIT |
| `zcheapstr` | 1.1.0 | MIT |
| `zerocopy` | 0.8.60 | BSD-2-Clause OR Apache-2.0 OR MIT |
| `zerocopy-derive` | 0.8.60 | BSD-2-Clause OR Apache-2.0 OR MIT |
| `zerofrom` | 0.1.8 | Unicode-3.0 |
| `zerofrom-derive` | 0.1.8 | Unicode-3.0 |
| `zeroize` | 1.9.1 | Apache-2.0 OR MIT |
| `zerotrie` | 0.2.5 | Unicode-3.0 |
| `zerovec` | 0.11.8 | Unicode-3.0 |
| `zerovec-derive` | 0.11.6 | Unicode-3.0 |
| `zlib-rs` | 0.6.8 | Zlib |
| `zmij` | 1.0.23 | MIT |
| `zune-core` | 0.5.3 | MIT OR Apache-2.0 OR Zlib |
| `zune-jpeg` | 0.5.15 | MIT OR Apache-2.0 OR Zlib |
| `zvariant` | 5.15.0 | MIT |
| `zvariant_derive` | 5.15.0 | MIT |
| `zvariant_utils` | 4.2.0 | MIT |

> 来源：crates.io registry（版本与校验和以 `src-tauri/Cargo.lock` 为准）；本闭包不含仅编译期/构建期 crate。

## 随包渲染资源与字体（Bundled Rendering Resources）

| 资源 | 版本 | 许可/说明 |
|---|---|---|
| KaTeX（公式渲染） | 见 npm 表（`katex`） | MIT（Khan Academy and other contributors，包内 `LICENSE`）。`dist/fonts/` 随包发行的 KaTeX 字体无单独许可文件，按包许可证发行；字体源自 Computer Modern/AMS 字体族。 |
| Shiki（代码高亮） | 见 npm 表（`shiki` 及 `@shikijs/*`） | MIT（Pine Wu、Anthony Fu，包内 `LICENSE`）。实际装载语法：`c`、`cpp`、`python`、`rust`、`java`、`javascript`、`typescript`、`bash`、`json`、`yaml`、`sql`；主题 `github-light`。语法/主题由上游TextMate 生态项目派生（大多为 MIT），上游逐件许可未随 npm 包提供，再分发前应核对上游。 |
| Mermaid（图表渲染） | 见 npm 表（`mermaid`） | MIT（Knut Sveidqvist 等，包内 `LICENSE`）；其运行期依赖（d3、elkjs、khroma 等）见 npm 闭包。 |
| SQLite（经 `rusqlite` bundled 静态编译） | 见 Rust 表（`libsqlite3-sys`） | 公有领域（SQLite，https://sqlite.org/copyright.html）；编译进二进制的 amalgamation 随 `libsqlite3-sys` 发行。 |
| 界面字体 | — | 不随包发行；使用系统字体回退（无第三方字体文件被再分发）。 |

> 本文件由 `packaging/third-party-inventory.py` 生成；更新依赖后重新运行 `python3 packaging/third-party-inventory.py > THIRD_PARTY_NOTICES.md`。
