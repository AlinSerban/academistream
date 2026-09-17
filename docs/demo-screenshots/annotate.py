"""Draw simple circles/arrows on screenshots for marked variants."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def arrow(draw: ImageDraw.ImageDraw, tip: tuple[int, int], tail: tuple[int, int], color, width=4):
    draw.line([tail, tip], fill=color, width=width)
    tx, ty = tip
    dx = tip[0] - tail[0]
    dy = tip[1] - tail[1]
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    # arrow head
    left = (tx - ux * 18 - uy * 10, ty - uy * 18 + ux * 10)
    right = (tx - ux * 18 + uy * 10, ty - uy * 18 - ux * 10)
    draw.polygon([tip, left, right], fill=color)


def main() -> None:
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    raw = sys.argv[3]
    if raw.endswith('.json') and Path(raw).exists():
        marks = json.loads(Path(raw).read_text(encoding='utf-8-sig'))
    else:
        marks = json.loads(raw.lstrip('\ufeff'))
    color = (220, 60, 40)
    img = Image.open(src).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for m in marks:
        kind = m["kind"]
        if kind == "circle":
            x, y, r = m["x"], m["y"], m.get("r", 28)
            draw.ellipse([x - r, y - r, x + r, y + r], outline=color + (230,), width=5)
        elif kind == "arrow":
            arrow(
                draw,
                tip=(m["x"], m["y"]),
                tail=(m["tx"], m["ty"]),
                color=color + (230,),
            )
        elif kind == "rect":
            x1, y1, x2, y2 = m["x1"], m["y1"], m["x2"], m["y2"]
            pad = m.get("pad", 6)
            draw.rectangle(
                [x1 - pad, y1 - pad, x2 + pad, y2 + pad],
                outline=color + (230,),
                width=4,
            )

    out = Image.alpha_composite(img, overlay).convert("RGB")
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "PNG")
    print(f"wrote {dst}")


if __name__ == "__main__":
    main()
