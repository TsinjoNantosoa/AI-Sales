"""Generate transparent branding assets and SVG wrappers from official PNG sources."""

from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "src" / "assets" / "branding"
BG = (18, 25, 44)
TOL = 45


def remove_bg(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2]) <= TOL:
                px[x, y] = (r, g, b, 0)
    return im


def write_svg(png_path: Path, svg_path: Path) -> None:
    im = Image.open(png_path)
    w, h = im.size
    b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    svg_path.write_text(
        "\n".join(
            [
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="AI Sales Assistant">',
                f'  <image href="data:image/png;base64,{b64}" width="{w}" height="{h}"/>',
                "</svg>",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    for name in ("ai-sales-mark.png", "ai-sales-logo.png"):
        src = ROOT / name
        if not src.exists():
            continue
        out = remove_bg(Image.open(src))
        stem = src.stem
        out.save(ROOT / f"{stem}.png", "PNG", optimize=True)
        out.save(ROOT / f"{stem}.webp", "WEBP", quality=92, method=6)

    mark_png = ROOT / "ai-sales-mark.png"
    logo_png = ROOT / "ai-sales-logo.png"
    if mark_png.exists():
        write_svg(mark_png, ROOT / "ai-sales-mark.svg")
    if logo_png.exists():
        write_svg(logo_png, ROOT / "ai-sales-logo.svg")
    print("done")


if __name__ == "__main__":
    main()
