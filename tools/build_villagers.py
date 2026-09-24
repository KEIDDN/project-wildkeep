"""
Generates the paper-doll villager sheets: the Pixel Crawler `Body_A` base
split into tintable layers plus procedurally drawn accessories, so the game
can dress dozens of townsfolk differently from one set of animations.

Output: public/sprites/villager/<anim>_<dir>.png — one row per layer (see
LAYERS), every frame 64x64 like the player. Material and accessory pixels
are grey-scale shades (a runtime tint recolours them keeping the shading);
the `base` row keeps the original outline and eyes untouched.

The head is located the same way as for the player (build_player.py): the
highest head-sized blob of skin. Accessories are drawn relative to it, per
direction, then given the pack's dark outline.

Run:  python3 tools/build_villagers.py
"""
from pathlib import Path
from PIL import Image

import build_player as bp

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/sprites/villager"
F = 64

ANIMS = {
    "idle": ("Idle_Base", "Idle", {"down": "Down", "up": "Up", "side": "Side"}),
    "walk": ("Walk_Base", "Walk", {"down": "Down", "up": "Up", "side": "Side"}),
}

# Row order of the output sheets. Keep in sync with engine/entities/villager.ts.
LAYERS = [
    "base", "skin", "eyes", "hair", "tunic", "belt", "pants", "boots",
    "cape", "longhair", "apron", "beard", "hood", "hat", "cap", "pointy", "helm",
]
LI = {n: i for i, n in enumerate(LAYERS)}
OUTLINE = 34  # outline grey (stays near-black under any tint)

IRIS = (76, 181, 40)
SHADE = {bp.SKIN_DARK: 150, bp.SKIN_LIGHT: 205, bp.SKIN_HI: 240}


def head_boxes(px, n):
    boxes = []
    for i in range(n):
        head = bp.find_head(bp.skin_components(px, i * F))
        if head:
            xs = [p[0] - i * F for p in head]
            ys = [p[1] for p in head]
            boxes.append((min(xs), max(xs), min(ys), max(ys)))
        else:
            boxes.append(None)
    for i in range(n):
        if boxes[i] is None:
            near = sorted((abs(j - i), b) for j, b in enumerate(boxes) if b is not None)
            boxes[i] = near[0][1]
    return boxes


class Canvas:
    """One frame's layers: {layer: {(x, y): grey}}."""

    def __init__(self):
        self.px = {n: {} for n in LAYERS}

    def put(self, layer, x, y, g):
        if 0 <= x < F and 0 <= y < F:
            self.px[layer][(x, y)] = g

    def rect(self, layer, x0, y0, x1, y1, g):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(layer, x, y, g)

    def outline(self, layer, skip_below=None):
        pts = self.px[layer]
        add = {}
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n not in pts and 0 <= n[0] < F and 0 <= n[1] < F:
                    if skip_below is not None and n[1] > skip_below:
                        continue
                    add[n] = OUTLINE
        pts.update(add)

    def shade_rows(self, layer, top, light=232, mid=200, dark=150, bottom=None):
        """Top-lit: the first row of each column light, the last dark."""
        pts = self.px[layer]
        cols = {}
        for (x, y) in pts:
            cols.setdefault(x, []).append(y)
        for x, ys in cols.items():
            ys.sort()
            for y in ys:
                g = mid
                if y == ys[0]:
                    g = light
                elif y == ys[-1] and len(ys) > 2:
                    g = dark
                pts[(x, y)] = g


def body_layers(c: Canvas, px, fx, direction, box):
    """Split the painted-by-material body into layers."""
    comps = bp.skin_components(px, fx)
    head = bp.find_head(comps) or bp.head_from_box(comps, box, fx)
    head_set = set(head or [])
    hx0, hx1, hy0, hy1 = box
    hcx = (hx0 + hx1) / 2 + fx
    skin_px = {p for pts in comps for p in pts}
    for y in range(F):
        for x in range(fx, fx + F):
            p = px[x, y]
            if not p[3]:
                continue
            lx = x - fx
            if (x, y) not in skin_px:
                if p[:3] == IRIS:
                    c.put("eyes", lx, y, 215)
                else:
                    c.put("base", lx, y, None)  # original pixel (outline, eye whites)
                continue
            g = SHADE.get(p[:3], 205)
            if (x, y) in head_set:
                rel = y - hy0
                if direction == "up":
                    hair = y <= hy1 - 1
                elif direction == "side":
                    hair = rel <= 3 or (rel <= 8 and x < hcx - 1)
                else:
                    hair = rel <= 2 or (rel <= 5 and (lx <= hx0 + 1 or lx >= hx1 - 1))
                # Skin underneath hair too, so bald villagers aren't holes.
                c.put("skin", lx, y, g)
                if hair:
                    c.put("hair", lx, y, g)
                continue
            c.put(bp.body_material(y), lx, y, g)


def silhouette(px, fx):
    return {(x - fx, y) for y in range(F) for x in range(fx, fx + F) if px[x, y][3]}


def accessories(c: Canvas, direction, box, body):
    x0, x1, y0, y1 = box
    hc = (x0 + x1) // 2
    side = direction == "side"
    up = direction == "up"
    torso = [(x, y) for (x, y) in body if y1 + 2 <= y <= 44]
    bx0 = min(x for x, _ in torso)
    bx1 = max(x for x, _ in torso)

    # --- wide-brim hat (farmer, hunter) ---------------------------------
    L = "hat"
    fwd = 1 if side else 0
    c.rect(L, x0 + 1 + fwd, y0 - 3, x1 - 1 + fwd, y0 + 1, 205)
    for x in (x0 + 1 + fwd, x1 - 1 + fwd):
        c.px[L].pop((x, y0 - 3), None)
    c.rect(L, x0 + 2 + fwd, y0 - 3, x1 - 2 + fwd, y0 - 3, 240)
    c.rect(L, x0 - 3 + fwd * 2, y0 + 2, x1 + 3 + fwd * 2, y0 + 2, 190)
    c.rect(L, x0 - 2 + fwd * 2, y0 + 3, x1 + 2 + fwd * 2, y0 + 3, 150)
    c.rect(L, x0 + 1 + fwd, y0 + 1, x1 - 1 + fwd, y0 + 1, 120)  # band
    c.outline(L)

    # --- small cap / beret ----------------------------------------------
    L = "cap"
    c.rect(L, x0, y0 - 1, x1, y0 + 2, 205)
    c.rect(L, x0 + 1, y0 - 2, x1 - 1, y0 - 2, 235)
    c.rect(L, x0, y0 + 2, x1, y0 + 2, 150)
    if side:
        c.rect(L, x1 + 1, y0 + 2, x1 + 3, y0 + 2, 160)  # peak
    c.outline(L)

    # --- pointy wizard hat ----------------------------------------------
    L = "pointy"
    c.rect(L, x0 - 2, y0 + 1, x1 + 2, y0 + 2, 170)
    height = 10
    for i in range(height):
        w = max(0, 5 - (i * 5) // height)
        cx = hc + (1 if i > height * 0.6 else 0) + (1 if i > height * 0.85 else 0)
        c.rect(L, cx - w, y0 - i, cx + w, y0 - i, 215 if i % 4 else 240)
    c.rect(L, x0 - 1, y0, x1 + 1, y0, 130)  # band
    c.outline(L)

    # --- guard helmet -----------------------------------------------------
    L = "helm"
    bottom = y1 + 1 if up else y0 + 5
    c.rect(L, x0 - 1, y0 - 1, x1 + 1, bottom, 200)
    c.px[L].pop((x0 - 1, y0 - 1), None)
    c.px[L].pop((x1 + 1, y0 - 1), None)
    c.rect(L, x0, y0 - 1, x1, y0 - 1, 245)
    c.rect(L, x0 - 1, bottom, x1 + 1, bottom, 140)
    if not up:
        nose = hc + (2 if side else 0)
        c.rect(L, nose, bottom + 1, nose, bottom + 3, 170)
        if side:  # open face: no metal in front of the eyes
            for y in range(y0 + 3, bottom):
                c.px[L].pop((x1 + 1, y), None)
                c.px[L].pop((x1, y), None)
    c.outline(L)

    # --- hood + mantle ----------------------------------------------------
    L = "hood"
    if up:
        c.rect(L, x0 - 1, y0 - 1, x1 + 1, y1 + 1, 200)
    elif side:
        c.rect(L, x0 - 1, y0 - 1, x1 - 1, y0 + 2, 200)
        c.rect(L, x0 - 1, y0 - 1, hc, y1 + 1, 200)
    else:
        c.rect(L, x0 - 1, y0 - 1, x1 + 1, y0 + 2, 200)
        c.rect(L, x0 - 1, y0 - 1, x0 + 1, y1 + 1, 185)
        c.rect(L, x1 - 1, y0 - 1, x1 + 1, y1 + 1, 185)
    c.rect(L, x0 - 1, y0 - 1, x1 + 1, y0 - 1, 235) if not side else c.rect(L, x0, y0 - 1, x1 - 2, y0 - 1, 235)
    c.rect(L, bx0 - 1, y1 + 1, bx1 + 1, y1 + 3, 170)  # mantle
    c.outline(L)

    # --- cape -------------------------------------------------------------
    L = "cape"
    if up:
        for (x, y) in body:
            if y1 + 1 <= y <= 44:
                c.put(L, x, y, 190 if y < 40 else 150)
        c.rect(L, bx0 - 1, y1 + 2, bx0 - 1, 43, 150)
        c.rect(L, bx1 + 1, y1 + 2, bx1 + 1, 43, 150)
    elif side:
        for y in range(y1 + 1, 44):
            spread = (y - y1) // 4
            c.rect(L, bx0 - 1 - spread, y, bx0 + 2, y, 170 if y < 40 else 140)
    else:
        c.rect(L, bx0 - 1, y1 + 1, bx0 + 1, y1 + 2, 190)
        c.rect(L, bx1 - 1, y1 + 1, bx1 + 1, y1 + 2, 190)
        c.rect(L, bx0 - 1, y1 + 3, bx0 - 1, 42, 150)
        c.rect(L, bx1 + 1, y1 + 3, bx1 + 1, 42, 150)
    c.outline(L)

    # --- long hair (tinted like the hair) -----------------------------------
    L = "longhair"
    if up:
        c.rect(L, x0 - 1, y0, x1 + 1, y1 + 5, 190)
        c.rect(L, x0, y0 - 1, x1, y0 - 1, 230)
    elif side:
        c.rect(L, x0 - 1, y0 + 1, hc - 1, y1 + 5, 190)
        c.rect(L, x0, y0 - 1, x1 - 1, y0 + 1, 225)
    else:
        c.rect(L, x0 - 1, y0 + 2, x0 + 1, y1 + 5, 190)
        c.rect(L, x1 - 1, y0 + 2, x1 + 1, y1 + 5, 190)
        c.rect(L, x0, y0 - 1, x1, y0 + 1, 225)
    c.outline(L)

    # --- beard ------------------------------------------------------------------
    L = "beard"
    if side:
        c.rect(L, hc, y1 - 3, x1 + 1, y1 + 1, 200)
        c.rect(L, hc + 1, y1 + 2, x1, y1 + 3, 170)
    elif not up:
        c.rect(L, x0 + 1, y1 - 3, x1 - 1, y1, 200)
        c.rect(L, x0 + 2, y1 + 1, x1 - 2, y1 + 2, 185)
        c.rect(L, hc - 1, y1 + 3, hc + 1, y1 + 3, 160)
        # Mouth stays visible.
        c.px[L].pop((hc, y1 - 3), None)
        c.px[L].pop((hc + 1, y1 - 3), None)
    if c.px[L]:
        c.outline(L)

    # --- apron ------------------------------------------------------------------
    L = "apron"
    if not up:
        ax0, ax1 = (hc - 1, bx1) if side else (hc - 4, hc + 4)
        for (x, y) in body:
            if y1 + 5 <= y <= 43 and ax0 <= x <= ax1:
                c.put(L, x, y, 205 if y < 42 else 160)
        # Neck strap.
        if not side:
            c.put(L, hc - 3, y1 + 3, 170)
            c.put(L, hc + 3, y1 + 3, 170)
            c.put(L, hc - 3, y1 + 4, 170)
            c.put(L, hc + 3, y1 + 4, 170)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.png"):
        f.unlink()
    for name, (folder, prefix, dirs) in ANIMS.items():
        for d, suffix in dirs.items():
            src = Image.open(bp.SRC / folder / f"{prefix}_{suffix}-Sheet.png").convert("RGBA")
            px = src.load()
            n = src.width // F
            boxes = head_boxes(px, n)
            out = Image.new("RGBA", (src.width, F * len(LAYERS)), (0, 0, 0, 0))
            dst = out.load()
            for i in range(n):
                fx = i * F
                c = Canvas()
                body_layers(c, px, fx, d, boxes[i])
                accessories(c, d, boxes[i], silhouette(px, fx))
                for layer, pts in c.px.items():
                    row = LI[layer] * F
                    for (x, y), g in pts.items():
                        if layer == "base":
                            dst[fx + x, row + y] = px[fx + x, y]
                        else:
                            dst[fx + x, row + y] = (g, g, g, 255)
            out.save(OUT / f"{name}_{d}.png")
            print(f"villager {name}_{d}: {n} frames x {len(LAYERS)} layers")


if __name__ == "__main__":
    build()
