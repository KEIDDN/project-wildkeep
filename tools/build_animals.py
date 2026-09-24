"""
Generates the woodland animals (the art packs don't include any).

Each animal is composed from simple shapes (body, head, ears, legs, tail…)
drawn pixel-exact at 1x, then shaded (lit top, darker belly edge) and given
the packs' 1px dark outline, so they sit comfortably next to Pixel Crawler
sprites. Legs are posed per frame for a small run cycle.

Output: public/sprites/animals/<id>.png — one strip, frames left→right:
  idle0 idle1 run0 run1 run2 run3 — all facing right — and a manifest entry
  in src/data/generated/assets.json under "animals".

Run:  python3 tools/build_animals.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/sprites/animals"
MANIFEST = ROOT / "src/data/generated/assets.json"

OUTLINE = (34, 24, 26, 255)

# Leg phase per frame: (front pair offset, back pair offset) in px.
IDLE = [(0, 0), (0, 0)]
RUN = [(-2, 2), (0, 0), (2, -2), (0, 0)]
BOB = [0, 0, -1, 0, -1, 0]  # body lift per frame


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def outline(im):
    """1px dark outline around every opaque pixel (4-neighbourhood)."""
    w, h = im.size
    src = im.load()
    out = im.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    dst[x, y] = OUTLINE
                    break
    return out


def light(im, base):
    """Top-lit shading: pixels of the base colour get lighter near the top
    edge of their column and darker at the bottom."""
    w, h = im.size
    px = im.load()
    for x in range(w):
        col = [y for y in range(h) if px[x, y][:3] == base[:3]]
        if not col:
            continue
        top, bot = min(col), max(col)
        for y in col:
            if y == top:
                px[x, y] = shade(base, 1.18)
            elif y >= bot - 1 and bot - top > 3:
                px[x, y] = shade(base, 0.78)


def canvas(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def legs(d, xs, ground, length, width, color, phase):
    """Two leg pairs: xs = (front_x, back_x)."""
    front, back = xs
    fo, bo = phase
    for x, off in ((front, fo), (front - 2, -fo), (back, bo), (back + 2, -bo)):
        d.rectangle([x + off, ground - length, x + off + width - 1, ground], fill=color)


# ---------------------------------------------------------------------------
# Species. Each draw(frame) -> RGBA image (w x h), facing right, feet at the
# bottom row minus 1.
# ---------------------------------------------------------------------------

def rabbit(frame):
    W, H = 20, 16
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    body = (170, 134, 98, 255)
    belly = (214, 190, 158, 255)
    ground = H - 2
    lift = BOB[frame] * (2 if frame >= 2 else 1)
    phase = (IDLE + RUN)[frame]
    # hops: legs tuck when airborne
    legs(d, (13, 6), ground, 2 if frame >= 2 and frame % 2 == 0 else 1, 2, shade(body, 0.8), (phase[0] // 2, phase[1] // 2))
    d.ellipse([4, 7 + lift, 15, 14 + lift], fill=body)
    d.ellipse([7, 11 + lift, 13, 14 + lift], fill=belly)
    d.ellipse([12, 4 + lift, 18, 10 + lift], fill=body)  # head
    ear = 0 if frame != 1 else 1
    d.rectangle([13, 0 + lift + ear, 14, 5 + lift], fill=body)  # ears
    d.rectangle([15, 1 + lift, 16, 5 + lift], fill=body)
    d.point((14, 2 + lift + ear), fill=(230, 160, 160, 255))
    d.point((16, 3 + lift), fill=(230, 160, 160, 255))
    d.ellipse([2, 8 + lift, 5, 11 + lift], fill=(244, 240, 232, 255))  # tail
    light(im, body)
    d = ImageDraw.Draw(im)
    d.point((16, 6 + lift), fill=(20, 16, 18, 255))  # eye
    d.point((18, 8 + lift), fill=(200, 110, 120, 255))  # nose
    return outline(im)


def fox(frame):
    W, H = 28, 18
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    body = (214, 112, 48, 255)
    white = (244, 236, 222, 255)
    dark = (60, 38, 34, 255)
    ground = H - 2
    lift = BOB[frame]
    phase = (IDLE + RUN)[frame]
    legs(d, (18, 8), ground, 4, 2, dark, phase)
    # tail: big and bushy, white tip
    wag = -1 if frame == 1 else 0
    d.ellipse([0, 6 + lift + wag, 9, 11 + lift + wag], fill=body)
    d.ellipse([0, 7 + lift + wag, 3, 10 + lift + wag], fill=white)
    d.ellipse([6, 7 + lift, 21, 13 + lift], fill=body)  # body
    d.ellipse([10, 10 + lift, 18, 13 + lift], fill=white)  # chest/belly
    d.ellipse([18, 4 + lift, 25, 10 + lift], fill=body)  # head
    d.polygon([(24, 7 + lift), (27, 8 + lift), (24, 9 + lift)], fill=body)  # snout
    d.polygon([(19, 5 + lift), (20, 1 + lift), (22, 5 + lift)], fill=body)  # ears
    d.polygon([(22, 5 + lift), (23, 1 + lift), (25, 5 + lift)], fill=body)
    light(im, body)
    d = ImageDraw.Draw(im)
    d.point((23, 6 + lift), fill=(20, 16, 18, 255))
    d.point((27, 8 + lift), fill=(20, 16, 18, 255))
    d.line([(20, 9 + lift), (24, 9 + lift)], fill=white)
    return outline(im)


def deer(frame, antlers=True):
    W, H = 30, 30
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    body = (156, 104, 62, 255)
    belly = (214, 180, 140, 255)
    leg = (110, 72, 44, 255)
    ground = H - 2
    lift = BOB[frame]
    phase = (IDLE + RUN)[frame]
    legs(d, (20, 8), ground, 9, 2, leg, (phase[0] * 1.5, phase[1] * 1.5))
    d.ellipse([4, 12 + lift, 23, 21 + lift], fill=body)
    d.ellipse([8, 17 + lift, 20, 21 + lift], fill=belly)
    head_dip = 2 if frame == 1 else 0  # grazing bob
    d.polygon([(18, 14 + lift), (21, 5 + lift + head_dip), (24, 6 + lift + head_dip), (22, 15 + lift)], fill=body)  # neck
    d.ellipse([20, 3 + lift + head_dip, 27, 9 + lift + head_dip], fill=body)  # head
    d.polygon([(26, 5 + lift + head_dip), (29, 7 + lift + head_dip), (26, 8 + lift + head_dip)], fill=body)
    d.polygon([(20, 4 + lift + head_dip), (19, 1 + lift + head_dip), (22, 3 + lift + head_dip)], fill=body)  # ear
    d.ellipse([3, 12 + lift, 6, 15 + lift], fill=(244, 240, 232, 255))  # tail
    light(im, body)
    d = ImageDraw.Draw(im)
    if antlers:
        a = (228, 212, 180, 255)
        hy = 3 + lift + head_dip
        d.line([(22, hy), (21, hy - 3), (19, hy - 4)], fill=a)
        d.line([(21, hy - 3), (22, hy - 5)], fill=a)
        d.line([(24, hy), (25, hy - 3), (27, hy - 4)], fill=a)
        d.line([(25, hy - 3), (25, hy - 5)], fill=a)
    d.point((25, 5 + lift + head_dip), fill=(20, 16, 18, 255))
    d.point((29, 7 + lift + head_dip), fill=(30, 20, 20, 255))
    return outline(im)


def boar(frame, pig=False):
    W, H = 28, 18
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    body = (236, 162, 170, 255) if pig else (98, 70, 54, 255)
    dark = (200, 120, 130, 255) if pig else (58, 40, 32, 255)
    ground = H - 2
    lift = BOB[frame]
    phase = (IDLE + RUN)[frame]
    legs(d, (18, 7), ground, 3, 3, dark, phase)
    d.ellipse([2, 4 + lift, 22, 14 + lift], fill=body)
    snout_dip = 1 if frame == 1 else 0
    d.ellipse([16, 5 + lift + snout_dip, 25, 13 + lift + snout_dip], fill=body)  # head
    d.rectangle([24, 8 + lift + snout_dip, 26, 11 + lift + snout_dip], fill=dark)  # snout
    d.polygon([(18, 6 + lift), (19, 2 + lift), (21, 6 + lift)], fill=body)  # ear
    if pig:
        d.arc([0, 4 + lift, 5, 9 + lift], 180, 360, fill=dark)  # curly tail
    else:
        for x in range(5, 18, 2):  # bristly back
            d.point((x, 4 + lift - (x % 4 == 1)), fill=dark)
    light(im, body)
    d = ImageDraw.Draw(im)
    d.point((21, 8 + lift + snout_dip), fill=(20, 16, 18, 255))
    if not pig:
        d.line([(24, 12 + lift + snout_dip), (25, 10 + lift + snout_dip)], fill=(244, 236, 222, 255))  # tusk
    return outline(im)


SPECIES = {
    "rabbit": rabbit,
    "fox": fox,
    "deer": deer,
    "boar": lambda f: boar(f, pig=False),
    "pig": lambda f: boar(f, pig=True),
}


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text())
    manifest["animals"] = {}
    for name, draw in SPECIES.items():
        frames = [draw(i) for i in range(6)]
        w, h = frames[0].size
        strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
        for i, fr in enumerate(frames):
            strip.alpha_composite(fr, (i * w, 0))
        strip.save(OUT / f"{name}.png")
        # Feet sit on the second-to-last row.
        manifest["animals"][name] = {"frameW": w, "frameH": h, "frames": len(frames), "anchorX": 0.5, "anchorY": (h - 1) / h}
        print(f"{name}: {w}x{h} x{len(frames)}")
    MANIFEST.write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    build()
