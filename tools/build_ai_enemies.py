"""
Turns the AI enemy concept sheet (Assets/Enemy Assets) into game sprites:
`public/sprites/characters/<id>/{idle,run,death}.png` + manifest entries,
in exactly the format the pack characters use, so `data/enemies.ts` can
reference them like any other sprite.

Each enemy's poses are cut from its labelled region (see tools/ai/sheet.py
for the pixel-art clean-up), scaled together to a target height, aligned on
their feet, and assembled into strips. Death is synthesised (a squash into
the ground) unless the sheet has real death poses.

Run:  python3 tools/build_ai_enemies.py   (also run by build_assets.py)
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageEnhance

sys.path.insert(0, str(Path(__file__).parent / "ai"))
import sheet  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Assets/Enemy Assets"
OUT = ROOT / "public/sprites/characters"
MANIFEST = ROOT / "src/data/generated/assets.json"

# Labelled regions on the sheet (x0, y0, x1, y1), label plates excluded.
REG = {
    "orc_archer": (490, 20, 885, 110), "skeleton_archer": (1390, 20, 1765, 110),
    "goblin": (40, 150, 425, 245), "goblin_shaman": (470, 150, 925, 245), "wolf": (930, 150, 1335, 245), "giant_rat": (1355, 150, 1730, 245),
    "spider": (35, 285, 480, 363), "bat": (505, 285, 955, 363), "slime": (970, 280, 1335, 363), "poison_slime": (1365, 280, 1765, 363),
    "mushroom": (40, 395, 500, 496), "treant": (515, 395, 905, 496), "bandit": (930, 395, 1335, 496), "bandit_archer": (1375, 395, 1765, 496),
    "ghost": (45, 525, 430, 628), "wraith": (455, 525, 870, 628), "cultist": (920, 525, 1305, 628), "bone_mage": (1350, 525, 1735, 628),
    "orc_chieftain": (10, 665, 472, 836), "stone_golem": (474, 665, 872, 836), "necromancer": (872, 665, 1232, 836), "dragon": (1232, 665, 1774, 836),
}
# Fused blobs to split: {region: [(blob index, pieces)]}.
SPLIT = {"wolf": [(0, 3)], "goblin_shaman": [(1, 2)], "orc_chieftain": [(1, 2)], "stone_golem": [(1, 2)], "necromancer": [(0, 3)], "dragon": [(0, 3)]}

# id -> target height (px) of pose 0, idle / run pose indices, optional death poses.
ENEMIES = {
    "ai_goblin": dict(src="goblin", h=20, idle=[0, 1], run=[0, 1, 2, 1]),
    "ai_goblin_shaman": dict(src="goblin_shaman", h=22, idle=[0, 1], run=[0, 1]),
    "ai_wolf": dict(src="wolf", h=19, idle=[1, 0], run=[0, 1]),
    "ai_rat": dict(src="giant_rat", h=13, idle=[0, 1], run=[0, 1, 3, 1]),
    "ai_spider": dict(src="spider", h=13, idle=[0, 1], run=[0, 1, 3, 1]),
    "ai_bat": dict(src="bat", h=13, idle=[0, 1, 2, 1], run=[0, 1, 2, 1]),
    "ai_slime": dict(src="slime", h=13, idle=[0, 1], run=[0, 1, 2, 1]),
    "ai_poison_slime": dict(src="poison_slime", h=14, idle=[0, 1], run=[0, 1, 2, 1], death=[0, 3]),
    "ai_mushroom": dict(src="mushroom", h=20, idle=[0, 1], run=[0, 1, 2, 3]),
    "ai_treant": dict(src="treant", h=27, idle=[0, 1], run=[0, 1, 2, 1]),
    "ai_bandit": dict(src="bandit", h=25, idle=[0, 1], run=[0, 1, 2, 1]),
    "ai_bandit_archer": dict(src="bandit_archer", h=25, idle=[0, 1], run=[0, 1, 2, 1]),
    "ai_ghost": dict(src="ghost", h=23, idle=[0, 1], run=[0, 1, 2, 3]),
    "ai_wraith": dict(src="wraith", h=27, idle=[0, 1], run=[0, 1, 3, 1]),
    "ai_cultist": dict(src="cultist", h=25, idle=[0, 1], run=[0, 1, 2, 1]),
    "ai_bone_mage": dict(src="bone_mage", h=27, idle=[0, 1], run=[0, 1, 3, 1]),
    "ai_orc_archer": dict(src="orc_archer", h=25, idle=[0, 1], run=[0, 1, 2, 3]),
    "ai_skeleton_archer": dict(src="skeleton_archer", h=25, idle=[0, 1], run=[0, 1, 2, 3]),
    "ai_orc_chieftain": dict(src="orc_chieftain", h=44, idle=[0, 2], run=[0, 2]),
    "ai_stone_golem": dict(src="stone_golem", h=48, idle=[0], run=[0], death=[0, 1, 2]),
    "ai_necromancer": dict(src="necromancer", h=44, idle=[0, 2], run=[0, 1, 2, 3]),
    "ai_dragon": dict(src="dragon", h=64, idle=[0], run=[0]),
}


def poses_for(im, region, n_split):
    sub = im.crop(REG[region])
    bs = sorted(sheet.blobs(sub, min_area=40, merge=1), key=lambda b: b[0])
    bs = [(b[0] + REG[region][0], b[1] + REG[region][1], b[2] + REG[region][0], b[3] + REG[region][1], b[4]) for b in bs if b[4] >= 300]
    out = []
    sp = dict(n_split)
    for i, b in enumerate(bs):
        out += sheet.split(im, b, sp[i]) if i in sp else [tuple(b[:4])]
    return out


def feet_x(im):
    """Mean x of opaque pixels in the lowest rows: where the body stands."""
    bb = im.getbbox()
    px = im.load()
    xs = [x for y in range(max(bb[1], bb[3] - 4), bb[3]) for x in range(im.width) if px[x, y][3]]
    return sum(xs) / len(xs) if xs else im.width / 2


def squash(im, k):
    """Death frame: squashed into the ground and darkened."""
    w, h = im.size
    nh = max(2, round(h * k))
    nw = round(w * (1 + (1 - k) * 0.35))
    s = im.resize((nw, nh), Image.NEAREST)
    s = ImageEnhance.Brightness(s).enhance(0.55 + 0.45 * k)
    out = Image.new("RGBA", (max(w, nw), h), (0, 0, 0, 0))
    out.alpha_composite(s, ((max(w, nw) - nw) // 2, h - nh))
    return out


def strip(frames, fw, fh, anchors):
    img = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, (f, fx) in enumerate(zip(frames, anchors)):
        # Feet on the bottom row (+1 px margin), centred on the frame.
        x = round(fw / 2 - fx)
        y = fh - 2 - (f.getbbox()[3] - 1)
        img.alpha_composite(f, (i * fw + max(0, x), max(0, y)))
    return img


def build(manifest=None) -> None:
    im = sheet.load(next(SRC.glob("*.png")))
    own = manifest is None
    if own:
        manifest = json.loads(MANIFEST.read_text())
    cache = {}
    for eid, cfg in ENEMIES.items():
        region = cfg["src"]
        if region not in cache:
            cache[region] = poses_for(im, region, SPLIT.get(region, []))
        poses = cache[region]
        p0 = poses[0]
        scale = (p0[3] - p0[1] + 1) / cfg["h"]
        used = sorted(set(cfg["idle"] + cfg["run"] + cfg.get("death", [])))
        spr = {i: sheet.outline(sheet.pixelate(im, poses[i], scale)) for i in used}
        base = spr[cfg["idle"][0]]
        deaths = [spr[i] for i in cfg["death"]] if "death" in cfg else [base, squash(base, 0.8), squash(base, 0.55), squash(base, 0.3)]
        all_frames = list(spr.values()) + deaths
        fw = max(f.width for f in all_frames) + 6
        fh = max(f.height for f in all_frames) + 4
        meta = {}
        d = OUT / eid
        d.mkdir(parents=True, exist_ok=True)
        for anim, frames in (("idle", [spr[i] for i in cfg["idle"]]), ("run", [spr[i] for i in cfg["run"]]), ("death", deaths)):
            anchors = [feet_x(f) for f in frames]
            # Keep the body still: every frame aligns on the first frame's feet.
            s = strip(frames, fw, fh, anchors)
            s.save(d / f"{anim}.png")
            meta[anim] = {"frameW": fw, "frameH": fh, "frames": len(frames), "anchorX": 0.5, "anchorY": round((fh - 1) / fh, 4), "bodyH": base.height - 2}
        manifest["characters"][eid] = meta
        print(f"{eid}: {fw}x{fh}, idle {len(cfg['idle'])} run {len(cfg['run'])} death {len(deaths)}")
    if own:
        MANIFEST.write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    build()
