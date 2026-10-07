#!/usr/bin/env python3
"""find-gtk-accept.py — locate the GTK file-dialog accept button in a root
screenshot (wp-34 test tooling).

The GTK file chooser (Select Folder / Open File) draws its default accept
button as a filled accent-blue rectangle with white text at the far right of
the dialog headerbar. This script scans a full-root PNG for horizontal blue
runs of button-like length (the location entry's focus border is either a very
long run or vertical strokes, so it is excluded) and prints the largest
blob's center as "x y" in root coordinates (1:1 with X).

Usage: find-gtk-accept.py <root.png> [max_y]
max_y defaults to 600 (dialog header area on the 2520x1680 test screen).
Exit 0 with "x y" on success, 3 when no candidate is found.
"""
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("find-gtk-accept: PIL unavailable", file=sys.stderr)
    sys.exit(2)


# GTK/Adwaita accent blue #3584e4 with theme tolerance.
def is_blue(r: int, g: int, b: int) -> bool:
    return b > 160 and b - r > 45 and b - g > 25 and g > 55


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    max_y = int(sys.argv[2]) if len(sys.argv) > 2 else 600

    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()

    runs = []  # (x0, x1, y)
    for y in range(0, min(h, max_y)):
        x = 0
        while x < w:
            r, g, b = px[x, y]
            if is_blue(r, g, b):
                start = x
                while x < w:
                    r, g, b = px[x, y]
                    if not is_blue(r, g, b):
                        break
                    x += 1
                length = x - start
                if 20 <= length <= 220:
                    runs.append((start, x - 1, y))
            else:
                x += 1

    if not runs:
        print("find-gtk-accept: no accent-blue button run found", file=sys.stderr)
        return 3

    # Merge runs into blobs (same row or one row apart, overlapping x ranges).
    blobs = []  # [x0, y0, x1, y1, n]
    for x0, x1, y in runs:
        joined = None
        for bl in blobs:
            if y <= bl[3] + 2 and x1 >= bl[0] - 6 and x0 <= bl[2] + 6:
                if joined is None or bl[4] > joined[4]:
                    joined = bl
        if joined is None:
            blobs.append([x0, y, x1, y, 1])
        else:
            joined[0] = min(joined[0], x0)
            joined[1] = min(joined[1], y)
            joined[2] = max(joined[2], x1)
            joined[3] = max(joined[3], y)
            joined[4] += 1

    # A button is a compact, tall-enough blob with substantial row coverage.
    best = None
    for bl in blobs:
        bw = bl[2] - bl[0]
        bh = bl[3] - bl[1]
        if bh >= 18 and 30 <= bw <= 240 and bl[4] >= bh * 0.6:
            if best is None or bl[4] > best[4]:
                best = bl
    if best is None:
        print("find-gtk-accept: no solid button blob found", file=sys.stderr)
        return 3

    print(f"{(best[0] + best[2]) // 2} {(best[1] + best[3]) // 2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
