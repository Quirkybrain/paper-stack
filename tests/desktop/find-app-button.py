#!/usr/bin/env python3
"""find-app-button.py — locate a PaperStack in-app button in a client-window
screenshot by its design-token colour (wp-34d test tooling).

Usage: find-app-button.py <client.png> <accent|danger> [min_y]
  accent  = --ps-color-accent #176b5b (primary buttons; links/selection share
            the hue, so the largest solid blob wins)
  danger  = --ps-color-danger #b42318 (destructive confirm buttons)
  min_y   = ignore rows above this y (client coordinates)

Prints "<x> <y>" (client coordinates, 1:1 with the app window) or exits 3.
"""
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("find-app-button: PIL unavailable", file=sys.stderr)
    sys.exit(2)


def matches(kind: str, r: int, g: int, b: int) -> bool:
    if kind == "accent":
        return abs(r - 0x17) <= 30 and abs(g - 0x6B) <= 35 and abs(b - 0x5B) <= 35
    if kind == "danger":
        return 150 <= r <= 215 and g <= 75 and b <= 75 and (r - g) >= 80
    return False


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    path, kind = sys.argv[1], sys.argv[2]
    min_y = int(sys.argv[3]) if len(sys.argv) > 3 else 0

    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()

    runs = []  # (x0, x1, y)
    for y in range(min_y, h):
        x = 0
        while x < w:
            r, g, b = px[x, y]
            if matches(kind, r, g, b):
                start = x
                while x < w:
                    r, g, b = px[x, y]
                    if not matches(kind, r, g, b):
                        break
                    x += 1
                if x - start >= 10:
                    runs.append((start, x - 1, y))
            else:
                x += 1

    blobs = []  # [x0, y0, x1, y1, pixels]
    for x0, x1, y in runs:
        joined = None
        for bl in blobs:
            if y <= bl[3] + 2 and x1 >= bl[0] - 4 and x0 <= bl[2] + 4:
                if joined is None or bl[4] > joined[4]:
                    joined = bl
        if joined is None:
            blobs.append([x0, y, x1, y, x1 - x0 + 1])
        else:
            joined[0] = min(joined[0], x0)
            joined[1] = min(joined[1], y)
            joined[2] = max(joined[2], x1)
            joined[3] = max(joined[3], y)
            joined[4] += x1 - x0 + 1

    buttons = [bl for bl in blobs if (bl[2] - bl[0]) >= 40 and (bl[3] - bl[1]) >= 16]
    if not buttons:
        print("find-app-button: no button blob found", file=sys.stderr)
        return 3
    best = max(buttons, key=lambda bl: bl[4])
    print(f"{(best[0] + best[2]) // 2} {(best[1] + best[3]) // 2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
