"""
Generates the clothed player sprite sheets from the Pixel Crawler `Body_A`
base (which ships as a bare body with no equipment layers).

Clothing is painted procedurally: the head is found as its own connected
skin-colored blob (the pack draws an outline under the chin), and the body
below is banded by distance from the ground line (feet always sit on y=47 of
the 64px frame). Skin shades are remapped to cloth shades, so the original
per-pixel shading is preserved. Tools, effects and outlines are untouched.

Run:  python3 tools/build_player.py
"""
from collections import deque
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Assets/Pixel Crawler - Free Pack/Entities/Characters/Body_A/Animations"
OUT = ROOT / "public/sprites/player"
FRAME = 64

SKIN_LIGHT = (217, 160, 102)
SKIN_DARK = (162, 101, 67)
SKIN_HI = (250, 200, 149)
SKIN = {SKIN_LIGHT, SKIN_DARK, SKIN_HI}

# (light, dark) per material. Hi-light skin maps to a lighter tint.
PALETTE = {
    "hair": ((122, 70, 38), (84, 46, 26)),
    "tunic": ((70, 116, 92), (44, 78, 62)),
    "belt": ((92, 58, 34), (66, 40, 24)),
    "pants": ((122, 92, 62), (86, 62, 42)),
    "boots": ((70, 48, 36), (46, 32, 26)),
}

# animation name -> (source folder, file prefix, {dir: suffix})
ANIMS = {
    "idle": ("Idle_Base", "Idle", {"down": "Down", "up": "Up", "side": "Side"}),
    "walk": ("Walk_Base", "Walk", {"down": "Down", "up": "Up", "side": "Side"}),
    "run": ("Run_Base", "Run", {"down": "Down", "up": "Up", "side": "Side"}),
    "slice": ("Slice_Base", "Slice", {"down": "Down", "up": "Up", "side": "Side"}),
    "pierce": ("Pierce_Base", "Pierce", {"down": "Down", "up": "Top", "side": "Side"}),
    "crush": ("Crush_Base", "Crush", {"down": "Down", "up": "Up", "side": "Side"}),
    "collect": ("Collect_Base", "Collect", {"down": "Down", "up": "Up", "side": "Side"}),
    "hit": ("Hit_Base", "Hit", {"down": "Down", "up": "Up", "side": "Side"}),
    "death": ("Death_Base", "Death", {"down": "Down", "up": "Up", "side": "Side"}),
    "watering": ("Watering_Base", "Watering", {"down": "Down", "up": "Up", "side": "Side"}),
    "fishing": ("Fishing_Base", "Fishing", {"down": "Down", "up": "Up", "side": "Side"}),
}


def skin_components(px, fx):
    seen = set()
    comps = []
    for y in range(FRAME):
        for x in range(fx, fx + FRAME):
            p = px[x, y]
            if not p[3] or p[:3] not in SKIN or (x, y) in seen:
                continue
            q = deque([(x, y)])
            seen.add((x, y))
            pts = []
            while q:
                a, b = q.popleft()
                pts.append((a, b))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = (a + dx, b + dy)
                    if fx <= n[0] < fx + FRAME and 0 <= n[1] < FRAME and n not in seen:
                        c = px[n]
                        if c[3] and c[:3] in SKIN:
                            seen.add(n)
                            q.append(n)
            comps.append(pts)
    return comps


def find_head(comps):
    """Head = the highest blob of head-like size whose vertical extent is
    head-sized; falls back to the topmost sizeable blob."""
    best = None
    for pts in comps:
        ys = [p[1] for p in pts]
        h = max(ys) - min(ys) + 1
        if 40 <= len(pts) <= 125 and h <= 14:
            if best is None or min(ys) < min(p[1] for p in best):
                best = pts
    return best


def shade(color, material):
    light, dark = PALETTE[material]
    if color == SKIN_DARK:
        return dark
    if color == SKIN_HI:
        return tuple(min(255, c + 30) for c in light)
    return light


def body_material(y):
    if y >= 45:
        return "boots"
    if y >= 41:
        return "pants"
    if y == 40:
        return "belt"
    return "tunic"


def head_from_box(comps, box, fx):
    """Fallback for frames where the head's skin touches an arm (so no
    head-sized blob exists): take the skin pixels inside the head box of a
    neighbouring frame. Heads barely move between frames."""
    x0, x1, y0, y1 = box
    # A little slack: the head bobs a pixel or two between frames.
    return [p for pts in comps for p in pts if x0 - 2 <= p[0] - fx <= x1 + 2 and y0 - 2 <= p[1] <= y1]


def paint_frame(px, fx, direction, head_box=None):
    comps = skin_components(px, fx)
    head = find_head(comps)
    if head is None and head_box is not None:
        head = head_from_box(comps, head_box, fx)
    head_set = set(head or [])
    if head:
        xs = [p[0] for p in head]
        ys = [p[1] for p in head]
        hx0, hx1, hy0, hy1 = min(xs), max(xs), min(ys), max(ys)
        hcx = (hx0 + hx1) / 2
    for pts in comps:
        for (x, y) in pts:
            c = px[x, y][:3]
            if (x, y) in head_set:
                rel = y - hy0
                hair = False
                if direction == "up":
                    hair = y <= hy1 - 1
                elif direction == "side":
                    # Side sheets face right: hair covers the crown and the back.
                    hair = rel <= 3 or (rel <= 8 and x < hcx - 1)
                else:
                    hair = rel <= 2 or (rel <= 5 and (x <= hx0 + 1 or x >= hx1 - 1))
                if hair:
                    px[x, y] = shade(c, "hair") + (255,)
                continue
            px[x, y] = shade(c, body_material(y)) + (255,)


# Mask layers for equipment visuals (see engine/entities/Player.ts). Each
# `<anim>_<dir>_mask.png` has one row per layer; a pixel is grey-scale shade
# (so a runtime tint recolours it with the original shading) or transparent.
MASK_LAYERS = ["armor", "boots", "helmet", "metal"]


def shade_of(rgb, light, dark):
    if rgb == dark:
        return 150
    if rgb == light:
        return 205
    return 240


def mask_value(rgb):
    """(layer index, grey) for a painted pixel, or None."""
    t_light, t_dark = PALETTE["tunic"]
    if rgb in (t_light, t_dark) or rgb == tuple(min(255, c + 30) for c in t_light):
        return 0, shade_of(rgb, t_light, t_dark)
    b_light, b_dark = PALETTE["boots"]
    if rgb in (b_light, b_dark) or rgb == tuple(min(255, c + 30) for c in b_light):
        return 1, shade_of(rgb, b_light, b_dark)
    h_light, h_dark = PALETTE["hair"]
    if rgb in (h_light, h_dark) or rgb == tuple(min(255, c + 30) for c in h_light):
        return 2, shade_of(rgb, h_light, h_dark)
    # Blades and tool heads (never the eyes, which are also grey/white).
    metal = {(64, 69, 69): 70, (146, 143, 136): 140, (204, 201, 194): 200, (255, 255, 254): 250}
    if rgb in metal:
        return 3, metal[rgb]
    return None


def build_masks(im):
    w, h = im.size
    out = Image.new("RGBA", (w, h * len(MASK_LAYERS)), (0, 0, 0, 0))
    src = im.load()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            p = src[x, y]
            if not p[3]:
                continue
            m = mask_value(p[:3])
            if m:
                layer, g = m
                dst[x, y + layer * h] = (g, g, g, 255)
    return out


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.png"):
        f.unlink()
    for name, (folder, prefix, dirs) in ANIMS.items():
        for d, suffix in dirs.items():
            src = SRC / folder / f"{prefix}_{suffix}-Sheet.png"
            im = Image.open(src).convert("RGBA")
            px = im.load()
            n = im.width // FRAME
            # Head boxes (frame-relative) from frames where detection works.
            boxes = []
            for i in range(n):
                head = find_head(skin_components(px, i * FRAME))
                if head:
                    xs = [p[0] - i * FRAME for p in head]
                    ys = [p[1] for p in head]
                    boxes.append((min(xs), max(xs), min(ys), max(ys)))
                else:
                    boxes.append(None)
            for i in range(n):
                box = boxes[i]
                if box is None:
                    near = sorted((abs(j - i), b) for j, b in enumerate(boxes) if b is not None)
                    if not near:
                        raise SystemExit(f"{name}_{d}: no head found in any frame")
                    box = near[0][1]
                    print(f"  {name}_{d} frame {i}: head merged with body, using neighbour's head box")
                paint_frame(px, i * FRAME, d, box)
            im.save(OUT / f"{name}_{d}.png")
            build_masks(im).save(OUT / f"{name}_{d}_mask.png")
            print(f"{name}_{d}: {im.width // FRAME} frames")


BLADES_JSON = ROOT / "src/data/generated/player_blades.json"


def split_blades():
    """The attack (pierce) sheets come with a sword baked into the hand. Move
    it out of the body into the metal mask only, so the game decides what is
    held: the sword shape tinted like the weapon's icon, or — for daggers,
    spears, maces — the weapon's own sprite. Also records, per frame, where the
    grip is and how long the blade is (frame-relative to the player's anchor,
    0.5 / 0.75 of a 64px frame; side sheets face right). Idempotent."""
    out = {}
    for d in ("side", "down", "up"):
        base = Image.open(OUT / f"pierce_{d}.png").convert("RGBA")
        mask = Image.open(OUT / f"pierce_{d}_mask.png").convert("RGBA")
        bp, mp = base.load(), mask.load()
        h = base.height
        metal_row = MASK_LAYERS.index("metal") * h
        frames = []
        for i in range(base.width // FRAME):
            pts = []
            for y in range(h):
                for x in range(i * FRAME, (i + 1) * FRAME):
                    if mp[x, y + metal_row][3]:
                        pts.append((x - i * FRAME, y))
                        bp[x, y] = (0, 0, 0, 0)
            if len(pts) < 4:
                frames.append(None)
                continue
            xs = sorted(p[0] for p in pts)
            ys = sorted(p[1] for p in pts)
            ax, ay = FRAME * 0.5, FRAME * 0.75
            if d == "side":
                grip = (xs[0], ys[len(ys) // 2])
                length = xs[-1] - xs[0] + 1
            elif d == "down":
                grip = (xs[len(xs) // 2], ys[0])
                length = ys[-1] - ys[0] + 1
            else:
                grip = (xs[len(xs) // 2], ys[-1])
                length = ys[-1] - ys[0] + 1
            frames.append({"x": grip[0] - ax, "y": grip[1] - ay, "len": length})
        base.save(OUT / f"pierce_{d}.png")
        out[d] = frames
    BLADES_JSON.write_text(json.dumps(out, indent=1))
    print("pierce blades split:", {k: sum(1 for f in v if f) for k, v in out.items()})


if __name__ == "__main__":
    build()
    split_blades()
