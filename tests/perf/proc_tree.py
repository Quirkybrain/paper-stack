#!/usr/bin/env python3
"""Process-tree accounting for the NF04–NF06 calibration scripts (T-60).

Uses only /proc (no sudo): descendant discovery via /proc/<pid>/stat ppid,
memory via /proc/<pid>/smaps_rollup (Pss/Rss, falling back to statm), sockets
via `ss -tanp` filtered to the tree. All pids belong to the invoking user.

Subcommands:
  pss <root-pid>                       one-shot PSS/RSS sum and pid list
  watch <root-pid> <duration_ms> <interval_ms>
                                       sample lines: t_ms pss_kb rss_kb procs
  sockets <root-pid>                   raw `ss` lines touching tree pids
"""

import os
import subprocess
import sys
import time


def proc_root() -> str:
    return "/proc"


def descendants(root_pid: int) -> list[int]:
    children: dict[int, list[int]] = {}
    for entry in os.listdir(proc_root()):
        if not entry.isdigit():
            continue
        pid = int(entry)
        try:
            with open(f"/proc/{pid}/stat", "rb") as handle:
                raw = handle.read().decode("utf-8", "replace")
        except OSError:
            continue
        # comm may contain spaces/parens; ppid is the field after the last ')'.
        close = raw.rfind(")")
        if close == -1:
            continue
        fields = raw[close + 2 :].split()
        if len(fields) < 2:
            continue
        try:
            ppid = int(fields[1])
        except ValueError:
            continue
        children.setdefault(ppid, []).append(pid)

    ordered: list[int] = []
    queue = [root_pid]
    seen = {root_pid}
    while queue:
        pid = queue.pop(0)
        ordered.append(pid)
        for child in children.get(pid, []):
            if child not in seen:
                seen.add(child)
                queue.append(child)
    return ordered


def memory_kb(pid: int) -> tuple[int, int]:
    """(pss_kb, rss_kb); falls back to statm RSS when smaps is unavailable."""
    try:
        pss = rss = None
        with open(f"/proc/{pid}/smaps_rollup") as handle:
            for line in handle:
                if line.startswith("Pss:"):
                    pss = int(line.split()[1])
                elif line.startswith("Rss:"):
                    rss = int(line.split()[1])
        if pss is not None and rss is not None:
            return pss, rss
    except OSError:
        pass
    try:
        with open(f"/proc/{pid}/statm") as handle:
            fields = handle.read().split()
        rss = int(fields[1]) * (os.sysconf("SC_PAGE_SIZE") // 1024)
        return rss, rss
    except (OSError, IndexError, ValueError):
        return 0, 0


def snapshot(root_pid: int) -> tuple[int, int, list[int]]:
    pids = [pid for pid in descendants(root_pid) if os.path.exists(f"/proc/{pid}")]
    pss = rss = 0
    for pid in pids:
        p, r = memory_kb(pid)
        pss += p
        rss += r
    return pss, rss, pids


def cmd_pss(root_pid: int) -> int:
    pss, rss, pids = snapshot(root_pid)
    print(f"PSS_KB={pss} RSS_KB={rss} PROCS={len(pids)} PIDS={','.join(map(str, pids))}")
    return 0


def cmd_watch(root_pid: int, duration_ms: int, interval_ms: int) -> int:
    started = time.monotonic()
    while True:
        elapsed = int((time.monotonic() - started) * 1000)
        pss, rss, pids = snapshot(root_pid)
        print(f"{elapsed} {pss} {rss} {len(pids)}", flush=True)
        if elapsed >= duration_ms:
            return 0
        time.sleep(interval_ms / 1000)


def cmd_sockets(root_pid: int) -> int:
    _, _, pids = snapshot(root_pid)
    pidset = {str(pid) for pid in pids}
    try:
        result = subprocess.run(
            ["ss", "-tanp"], capture_output=True, text=True, check=False
        )
    except OSError as error:
        print(f"sockets unavailable: {error}", file=sys.stderr)
        return 0
    found = 0
    for line in result.stdout.splitlines():
        if "pid=" not in line:
            continue
        if any(f"pid={pid}," in line or f"pid={pid})" in line for pid in pidset):
            print(line)
            found += 1
    print(f"SOCKETS={found}", file=sys.stderr)
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    command = argv[1]
    root_pid = int(argv[2])
    if command == "pss":
        return cmd_pss(root_pid)
    if command == "watch":
        return cmd_watch(root_pid, int(argv[3]), int(argv[4]))
    if command == "sockets":
        return cmd_sockets(root_pid)
    print(f"unknown subcommand {command!r}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
