#!/usr/bin/env python3
"""Generate THIRD_PARTY_NOTICES.md for PaperStack (wp-43 C2; R30/NF12).

Method (deterministic, no network required for the Rust side):

- npm: ``pnpm licenses list --prod --json`` at the repository root. That is the
  production dependency closure recorded in ``pnpm-lock.yaml`` (devDependencies
  excluded because they are not shipped).
- Rust: ``cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1
  --locked``. From the resolved graph the script walks the *normal* dependency
  edges of the ``paperstack`` root package (``dep_kinds.kind`` is ``null``);
  build/dev-only crates are not part of the shipped binary and are excluded.
- Bundled rendering resources (KaTeX fonts, Shiki grammars/themes, Mermaid) are
  documented from installed package metadata and the versioned upstream Shiki
  NOTICE files. Unresolved per-asset licensing is explicitly identified;
  SQLite is documented because ``rusqlite`` builds its bundled amalgamation.

Usage (from the repository root, or any directory):

    python3 packaging/third-party-inventory.py > THIRD_PARTY_NOTICES.md

Coverage limits are stated inside the generated document; this script is an
inventory aid, not a legal audit.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LICENSE_NAMES = (
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "LICENSE-MIT",
    "license",
    "license.md",
    "license.txt",
    "COPYING",
    "COPYING.txt",
)

# Best-effort SPDX-ish detection for packages that do not declare a license in
# their package metadata (only used for ``Unknown`` npm entries).
LICENSE_FINGERPRINTS = (
    (r"The MIT License|MIT License|Permission is hereby granted, free of charge", "MIT"),
    (r"Apache License.*Version 2\.0", "Apache-2.0"),
    (r"ISC License|Permission to use, copy, modify, and/or distribute this software", "ISC"),
    (r"Redistribution and use in source and binary forms", "BSD (see license file)"),
    (r"GNU LESSER GENERAL PUBLIC LICENSE", "LGPL (see license file)"),
    (r"GNU GENERAL PUBLIC LICENSE", "GPL (see license file)"),
    (r"This is free and unencumbered software released into the public domain", "Unlicense"),
    (r"Mozilla Public License, v\. 2\.0|Mozilla Public License Version 2\.0", "MPL-2.0"),
)


def run(command: list[str], cwd: Path | None = None) -> bytes:
    try:
        return subprocess.run(
            command,
            cwd=cwd or REPO_ROOT,
            check=True,
            capture_output=True,
        ).stdout
    except FileNotFoundError:
        sys.exit(f"required tool not found: {command[0]}")
    except subprocess.CalledProcessError as error:
        sys.exit(
            f"command failed: {' '.join(command)}\n"
            f"{error.stderr.decode(errors='replace').strip()}"
        )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def detect_license_from_files(package_paths: list[str]) -> str:
    """Best-effort license detection for npm packages without metadata."""
    for raw in package_paths:
        path = Path(raw)
        if not path.is_dir():
            continue
        for name in LICENSE_NAMES:
            candidate = path / name
            if not candidate.is_file():
                continue
            text = candidate.read_text(errors="replace")[:64_000]
            for pattern, label in LICENSE_FINGERPRINTS:
                if re.search(pattern, text, re.IGNORECASE):
                    return f"{label} (package license file `{name}`; not declared in package metadata)"
            first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
            return f"Unknown (see {name}: {first_line[:60]})"
    return "Unknown (no license metadata or file found)"


def npm_inventory() -> list[tuple[str, str, str]]:
    raw = run(["pnpm", "licenses", "list", "--prod", "--json"])
    groups = json.loads(raw)
    entries: dict[tuple[str, str], dict[str, str]] = {}
    for declared_license, packages in groups.items():
        for package in packages:
            versions = package.get("versions") or ["?"]
            for version in versions:
                license_name = declared_license
                if declared_license == "Unknown":
                    license_name = detect_license_from_files(package.get("paths") or [])
                entries[(package["name"], version)] = {
                    "name": package["name"],
                    "version": version,
                    "license": license_name,
                }
    return sorted(
        ((item["name"], item["version"], item["license"]) for item in entries.values()),
        key=lambda row: (row[0].lower(), row[1]),
    )


def rust_runtime_packages() -> list[dict]:
    raw = run(
        [
            "cargo",
            "metadata",
            "--manifest-path",
            "src-tauri/Cargo.toml",
            "--format-version",
            "1",
            "--locked",
        ]
    )
    metadata = json.loads(raw)
    packages = {package["id"]: package for package in metadata["packages"]}
    nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
    root = metadata["resolve"]["root"]

    reachable: set[str] = set()
    queue = [root]
    while queue:
        current = queue.pop()
        if current in reachable:
            continue
        reachable.add(current)
        for dependency in nodes[current].get("deps", []):
            kinds = dependency.get("dep_kinds") or []
            # kind == null is a normal (runtime) dependency; "dev"/"build" are
            # not part of the distributed binary.
            if any(kind.get("kind") is None for kind in kinds):
                queue.append(dependency["pkg"])

    runtime = [packages[package_id] for package_id in reachable if package_id != root]
    runtime.sort(key=lambda package: (package["name"].lower(), package["version"]))
    return runtime


def npm_counts(rows: list[tuple[str, str, str]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for _, _, license_name in rows:
        counts[license_name] = counts.get(license_name, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: item[0].lower()))


def rust_counts(packages: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for package in packages:
        license_name = package.get("license") or "NOASSERTION (no SPDX in cargo metadata)"
        counts[license_name] = counts.get(license_name, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: item[0].lower()))


def main() -> None:
    npm_rows = npm_inventory()
    rust_packages = rust_runtime_packages()
    pnpm_lock = REPO_ROOT / "pnpm-lock.yaml"
    cargo_lock = REPO_ROOT / "src-tauri/Cargo.lock"
    generated_lock_lines = [
        f"- `pnpm-lock.yaml` — sha256 `{sha256_file(pnpm_lock)}`",
        f"- `src-tauri/Cargo.lock` — sha256 `{sha256_file(cargo_lock)}`",
    ]

    out: list[str] = []
    add = out.append

    add("# 纸栈 PaperStack 第三方软件声明（Third-Party Notices）")
    add("")
    add(
        "本文档清点 PaperStack v0.1.0 的候选第三方运行期依赖和已识别的渲染资源。"
        "源码仓库中的本次修订不会自动替换已构建的安装包；发布新包须重新构建并核验包内文本。"
    )
    add("")
    add("## 方法与范围（Method and Coverage）")
    add("")
    add("**生成方法（本次清单）：**")
    add("")
    add(f"- npm 运行期闭包：`pnpm licenses list --prod --json`（{len(npm_rows)} 个包/版本；pnpm 10.34.6）。")
    add(
        f"- Rust 运行期闭包：`cargo metadata --locked` 解析图中从 `paperstack` 根包"
        f"沿普通依赖边可达的 crate（{len(rust_packages)} 个 crate；Rust 1.96.0）。"
    )
    add(
        "- 渲染资源：KaTeX 字体、Shiki 语法/主题、Mermaid 根据安装包元数据及"
        " Shiki 所用上游资源包的版本化 NOTICE 记录；逐项授权仍有未决项。"
    )
    add("")
    add("**引用的锁文件（结论应以真实锁文件为准）：**")
    add("")
    out.extend(generated_lock_lines)
    add("")
    add("**明确的覆盖限制（本清单不是法律审计）：**")
    add("")
    add(
        "1. npm 列为 **production 依赖闭包**（含传递依赖，含仅类型声明的 `@types/*`，"
        "其不注入运行时代码），不含 devDependencies；Rust 列为 **普通依赖运行期闭包**，"
        "不含 build-dependencies、dev-dependencies 与仅编译期使用的过程宏。"
    )
    add(
        "2. 解析图是上界：按目标平台/feature 裁剪后未链接进最终二进制的 crate 仍可能出现在表中；"
        "依赖表不能单独证明最终载荷完整性或许可兼容性。"
    )
    add(
        "3. Shiki 包的 MIT 元数据不能替代所含 TextMate 语法和主题各自的上游许可。"
        "精确版本的 `tm-grammars`/`tm-themes` 有 NOTICE，但本清单和既有安装包均未附其"
        "许可原文；`glsl`、`yaml` 两项语法还缺少上游逐件授权依据，详见下文。"
    )
    add(
        "4. KaTeX 字体随 npm 包提供；包内未见单独字体许可文件。字体上游来源及逐项许可"
        "未在本清单独立核实。界面文字使用系统字体，不随包附带其字体文件。"
    )
    add(
        "5. 许可证名称来自包元数据（SPDX 字段）或包内许可文件的人工可复核读取；"
        "本清单不构成法律意见，最终合规结论需由法律审计结合真实锁文件与上游通知确认。"
    )
    add("")
    add("## 许可兼容性状态（Compatibility Status）")
    add("")
    add(
        "PaperStack 原创代码标识为 **GPL-3.0-only**（仓库根 `LICENSE` 是该 GPLv3 全文）。"
        "下表的 SPDX 标识来自依赖元数据，不能据此推断整个应用组合已通过许可兼容性核查。"
        "尤其是打入前端载荷的 `elkjs@0.9.3` 标识为 EPL-2.0。"
        "该版本的 `LICENSE.md` 第 3.2 节和 Exhibit A 要求初始贡献者附上明确的次级许可声明；"
        "版本 `0.9.3` 的上游源码仅有未填写许可名称的 Exhibit A 模板，未发现 GPL 次级许可声明。"
        "因此本清单**不能确认**其与 PaperStack GPL-3.0-only 应用组合的许可兼容性，"
        "不能将该版本按 GPL 次级许可处理。其他条目的元数据也不是对完整载荷的法律结论。"
        "第三方作品保留其各自权利人与许可，不统一改归 Quirkybrain（R30）。"
    )
    add("")
    add(
        "`elkjs@0.9.3` 核对来源：[版本源码](https://github.com/kieler/elkjs/tree/0.9.3)、"
        "[该版本许可文本](https://github.com/kieler/elkjs/blob/0.9.3/LICENSE.md)；"
        "[上游关于新增 GPLv3 次级许可的议题](https://github.com/kieler/elkjs/issues/373)"
        "属于后续版本讨论，不适用于本锁定版本。公开二进制前须另行解决此项。"
    )
    add("")
    add(
        "> 随现有安装包离线提供的是 PaperStack 的 GPLv3 `LICENSE` 全文与本清单的旧版本；"
        "清单列举第三方许可证名称，不包含各依赖或上游渲染资源的全部许可证原文。"
    )
    add("")

    add(f"## npm production 依赖闭包（{len(npm_rows)} 条）")
    add("")
    add("按许可分组统计：" + "、".join(f"{name} × {count}" for name, count in npm_counts(npm_rows).items()))
    add("")
    add("| 包 | 版本 | 许可证（包元数据） |")
    add("|---|---|---|")
    for name, version, license_name in npm_rows:
        add(f"| `{name}` | {version} | {license_name} |")
    add("")
    add(
        "> 版本与来源（npm registry + 锁定 tarball 完整性）以 `pnpm-lock.yaml` 为准；"
        "上表版本即锁文件解析结果。"
    )
    add("")

    add(f"## Rust 运行期依赖闭包（{len(rust_packages)} 个 crate）")
    add("")
    add(
        "按许可证统计："
        + "；".join(
            f"{name} × {count}" for name, count in rust_counts(rust_packages).items()
        )
    )
    add("")
    add("| Crate | 版本 | 许可证（cargo metadata） |")
    add("|---|---|---|")
    for package in rust_packages:
        license_name = package.get("license") or "NOASSERTION（元数据未给出 SPDX，需人工核对）"
        add(f"| `{package['name']}` | {package['version']} | {license_name} |")
    add("")
    add(
        "> 来源：crates.io registry（版本与校验和以 `src-tauri/Cargo.lock` 为准）；"
        "本闭包不含仅编译期/构建期 crate。"
    )
    add("")

    add("## 随包渲染资源与字体（Bundled Rendering Resources）")
    add("")
    add("| 资源 | 版本 | 许可/说明 |")
    add("|---|---|---|")
    add(
        "| KaTeX（公式渲染） | 见 npm 表（`katex`） | 包元数据与 `LICENSE` 为 MIT"
        "（Khan Academy and other contributors）。`dist/fonts/` 包内无单独字体许可文件；"
        "字体上游来源和逐项许可仍待独立核实。 |"
    )
    add(
        "| Shiki（代码高亮） | `@shikijs/langs`/`themes` 4.5.0 | Shiki 自身的 `LICENSE`"
        " 为 MIT（Pine Wu、Anthony Fu）。直接选择 `c`、`cpp`、`python`、`rust`、`java`、"
        "`javascript`、`typescript`、`bash`、`json`、`yaml`、`sql` 与 `github-light`；"
        "其中 `cpp` 又导入 `cpp-macro`、`regexp`、`glsl`，`bash` 映射 `shellscript`。"
        "Shiki v4.5.0 锁定 `tm-grammars@1.32.22` 与 `tm-themes@1.12.12`。"
        "这两个包的 NOTICE 覆盖所选主题及多数语法，但语法 NOTICE 未列 `glsl.json`、"
        "`yaml.json`，对应原始仓库也未见明确许可文件；逐项授权未闭合。 |"
    )
    add(
        "| Mermaid（图表渲染） | 见 npm 表（`mermaid`） | MIT（Knut Sveidqvist 等，包内 `LICENSE`）；"
        "其运行期依赖（d3、elkjs、khroma 等）见 npm 闭包；`elkjs@0.9.3` 的兼容性未决。 |"
    )
    add(
        "| SQLite（经 `rusqlite` bundled 静态编译） | 见 Rust 表（`libsqlite3-sys`） | 公有领域（SQLite，"
        "https://sqlite.org/copyright.html）；编译进二进制的 amalgamation 随 `libsqlite3-sys` 发行。 |"
    )
    add(
        "| 界面字体 | — | 不随包发行；使用系统字体回退（无第三方字体文件被再分发）。 |"
    )
    add("")
    add(
        "Shiki 精确上游依据：[v4.5.0 锁文件](https://github.com/shikijs/shiki/blob/v4.5.0/pnpm-lock.yaml)、"
        "[tm-grammars@1.32.22 NOTICE 包](https://registry.npmjs.org/tm-grammars/-/tm-grammars-1.32.22.tgz)、"
        "[tm-themes@1.12.12 NOTICE 包](https://registry.npmjs.org/tm-themes/-/tm-themes-1.12.12.tgz)、"
        "[`glsl` 原始项目](https://github.com/polym0rph/GLSL.tmbundle)、"
        "[`yaml` 原始项目](https://github.com/textmate/yaml.tmbundle)。"
    )
    add("")
    add(
        "> 本文件由 `packaging/third-party-inventory.py` 生成；"
        "更新依赖后重新运行 `python3 packaging/third-party-inventory.py > THIRD_PARTY_NOTICES.md`。"
    )
    add("")

    sys.stdout.write("\n".join(out))


if __name__ == "__main__":
    main()
