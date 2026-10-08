# WP-51 — GitHub 源码公开文档修订

- **Producer**: agent:technical-writer
- **Artifact ID**: ART-60-WP51-PUBLICATION-DOCS
- **Status**: READY_FOR_GATE
- **Revision**: 1
- **Date**: 2026-10-08
- **Task / handoff**: `wp-51-publication-docs` / `state/handoffs/wp-51-publication-docs.json`
- **Branch / baseline**: `task/wp-51-publication-docs` / `25d7bf98690dd4de19f5ffc98bcf059ae370b48b`

## 目的与依据

依据 `state/handoffs/wp-51-publication.request.md` 和
`state/handoffs/wp-51-publication.decisions.md`：保留所有历史提交、分支及工程证据；
先准备公开 `https://github.com/Quirkybrain/paper-stack` 的源码，公开 `.deb` 另行办理。
`artifacts/80-release/package-verification.md` §1–§6 证明 wp-50 已从当时验收修订
重建并验证本地包（sha256
`f72e3dbab442e71dd0df9e0d2ebe90e5699b60960af2ab6824164ba8d4788799`）。
`artifacts/80-release/stage-gate-release.md` §Decision 将 A9 列为公开分发阻塞；
本次文档将其明确限定到后续公开安装包，不将源码仓库准备描述成二进制发布。

## 修订

- `README.md`：说明先公开源码、`output/` 不进入 Git、已跟踪的
  `artifacts/` 证据不受忽略规则移除；将“当前包是 wp-43 旧包”改为 wp-50
  验证记录与完整哈希；保留 X11/Wayland、安装等验证边界。
- `docs/paperstack/known-limitations.md`：区分源码公开与安装包 A9 门禁，
  更新包取代关系，并保留全部 UNVERIFIED 项。
- `docs/paperstack/release-notes-v0.1.0.md`：标为源码先行、安装包暂缓；
  引用 wp-50 最终包报告，不将其当作本轮公开分发物。
- `packaging/README.md`：给出从源码构建后的实际本地安装路径，
  将 wp-50 载荷与法律文件字节比对限定到当时修订；后续声明或源码变化须重建复验。

应用内 `AppInfo.legal.sourceEntryUrl` 仍为 `null`，未改代码或测试；
`THIRD_PARTY_NOTICES.md` 的上游许可待核项未在本任务改动。
上述本地包验证不能证明后续修订的二进制，公开安装包须在最终源码与声明修订上
重新构建和验证。本任务未推送、打标签或发布安装包。

## 验证

- 4 份修订文档中的本地 Markdown 链接：检查 9 处，断链 0；新增报告、
  `LICENSE`、`THIRD_PARTY_NOTICES.md`、wp-50 验证报告及引用脚本路径均存在。
- 禁止的旧包断言（“wp-43 打包产物”“早于 wp-45/wp-47 修复”）在修订的
  4 份文档中均不存在；完整 wp-50 哈希、仓库地址、A9 和 UNVERIFIED 口径均存在。
- `git diff --check`：通过。仅有文档与本报告变化；无产品代码、依赖、锁文件或历史修改。
- 文档任务未运行产品构建或测试；本次改动不触及其执行路径。

## 待后续阶段处理

- 对应源码入口 A9：待仓库中有可访问且版本匹配的源码修订后，更新应用内入口并验证。
- 第三方许可待核项：由独立任务处理；本文未对其作法律结论。
- 后续公开安装包：在最终修订重建、复验并完成发布门禁；Wayland 与干净系统安装仍为 UNVERIFIED。
