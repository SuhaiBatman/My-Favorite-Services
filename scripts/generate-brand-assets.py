#!/usr/bin/env python3
"""Build splash/logo PNGs from the light master with transparent backgrounds."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
LIGHT = ASSETS / "splash-icon.png"
DARK = ASSETS / "splash-icon-dark.png"


def lum(r: int, g: int, b: int) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sat(r: int, g: int, b: int) -> float:
    mx, mn = max(r, g, b), min(r, g, b)
    return 0.0 if mx == 0 else (mx - mn) / mx


def is_pink(r: int, g: int, b: int) -> bool:
    return r > 125 and b > 85 and g < r * 0.85 and (r - g) > 35


def is_red(r: int, g: int, b: int) -> bool:
    return r > 165 and g < 95 and b < 95 and r > g + 40


def is_navy_or_dark(r: int, g: int, b: int) -> bool:
    if is_pink(r, g, b) or is_red(r, g, b):
        return False
    l = lum(r, g, b)
    return l < 140 or (l < 180 and sat(r, g, b) < 0.35)


def strip_light_background(src: Image.Image) -> Image.Image:
    img = src.convert("RGBA")
    w, h = img.size
    px = img.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if lum(r, g, b) > 245 and sat(r, g, b) < 0.08:
                continue
            if lum(r, g, b) > 235 and sat(r, g, b) < 0.12:
                continue
            dst[x, y] = (r, g, b, 255)

    return out


def to_dark_variant(src: Image.Image) -> Image.Image:
    img = src.convert("RGBA")
    w, h = img.size
    px = img.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue

            if is_red(r, g, b):
                dst[x, y] = (251, 113, 133, 255)
            elif is_pink(r, g, b):
                dst[x, y] = (
                    min(255, int(r * 1.06 + 14)),
                    min(255, int(g * 1.0 + 12)),
                    min(255, int(b * 1.04 + 16)),
                    255,
                )
            elif is_navy_or_dark(r, g, b):
                dst[x, y] = (248, 250, 252, 255)
            elif sat(r, g, b) > 0.12:
                if lum(r, g, b) < 160:
                    dst[x, y] = (248, 250, 252, 255)
                else:
                    dst[x, y] = (
                        min(255, int(r * 0.5 + 115)),
                        min(255, int(g * 0.4 + 75)),
                        min(255, int(b * 0.5 + 125)),
                        255,
                    )
            elif lum(r, g, b) <= 200:
                dst[x, y] = (248, 250, 252, 255)

    return out


def main() -> None:
    master = Image.open(LIGHT)
    light = strip_light_background(master)
    dark = to_dark_variant(light)
    light.save(LIGHT, optimize=True)
    dark.save(DARK, optimize=True)
    print(f"Updated {LIGHT.name} and {DARK.name}")


if __name__ == "__main__":
    main()
