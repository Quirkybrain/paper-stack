#!/usr/bin/env python3
# - **Producer**: agent:implementation-engineer
# - **Task**: wp-47-fix3 (D-IT-3 windowed mounting verification tooling)
"""sample-cpu.py — per-process CPU sampling for the wp-47-fix3 verification.

Usage: sample-cpu.py <out.csv> <seconds> [interval] [process-pattern]

Samples /proc/<pid>/stat utime+stime for every process whose cmdline matches
`process-pattern` (default: WebKitWebProcess) and writes one CSV row per
interval:

    epoch_s,elapsed_s,pid_count,total_cpu_percent

CPU percent is computed from the jiffy delta between two consecutive samples
divided by elapsed wall time (100 ticks/s assumed, CLK_TCK read from
os.sysconf). New processes start contributing from their first sample; dead
ones stop. The sampler never blocks the app and exits after `seconds`.
"""

import os
import re
import sys
import time

CLK_TCK = os.sysconf("SC_CLK_TCK")


def matching_pids(pattern: str) -> list[int]:
    pids: list[int] = []
    for name in os.listdir("/proc"):
        if not name.isdigit():
            continue
        try:
            with open(f"/proc/{name}/cmdline", "rb") as handle:
                cmdline = handle.read().replace(b"\0", b" ").decode("utf-8", "replace")
        except OSError:
            continue
        if re.search(pattern, cmdline):
            pids.append(int(name))
    return pids


def cpu_ticks(pid: int) -> int | None:
    try:
        with open(f"/proc/{pid}/stat", "r", encoding="utf-8") as handle:
            fields = handle.read().rsplit(") ", 1)[1].split()
    except OSError:
        return None
    # After the comm field: state(0) ... utime(11), stime(12).
    return int(fields[11]) + int(fields[12])


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    out_path = sys.argv[1]
    seconds = float(sys.argv[2])
    interval = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
    pattern = sys.argv[4] if len(sys.argv) > 4 else "WebKitWebProcess"

    start_wall = time.monotonic()
    start_epoch = time.time()
    previous: dict[int, int] = {}
    previous_wall = start_wall
    for pid in matching_pids(pattern):
        ticks = cpu_ticks(pid)
        if ticks is not None:
            previous[pid] = ticks

    with open(out_path, "w", encoding="utf-8") as out:
        out.write("epoch_s,elapsed_s,pid_count,total_cpu_percent\n")
        while True:
            time.sleep(interval)
            now_wall = time.monotonic()
            elapsed = now_wall - start_wall
            current: dict[int, int] = {}
            for pid in matching_pids(pattern):
                ticks = cpu_ticks(pid)
                if ticks is not None:
                    current[pid] = ticks
            delta_ticks = 0
            for pid, ticks in current.items():
                delta_ticks += ticks - previous.get(pid, ticks)
            window = now_wall - previous_wall
            percent = (delta_ticks / CLK_TCK) / window * 100.0 if window > 0 else 0.0
            out.write(
                f"{start_epoch + elapsed:.3f},{elapsed:.3f},{len(current)},{percent:.1f}\n"
            )
            out.flush()
            previous = current
            previous_wall = now_wall
            if elapsed >= seconds:
                break
    print(f"cpu samples written: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
