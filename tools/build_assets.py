"""
Wildkeep asset pipeline.

Turns the raw third-party packs in `Assets/` (gitignored) into the curated,
game-ready files under `public/` plus a metadata manifest the TypeScript side
imports (`src/data/generated/assets.json`).

What it does:
  * copies the tilesets the renderer auto-tiles from
  * crops named props / resource-node sprites out of the prop sheets
  * composes whole building exteriors from the modular building kit
    (walls + roof chevrons + doors + windows + signs) and records their
    collision footprint and door position
  * exports character / mob sprite strips with per-animation foot anchors
    (the packs mix 32px idle frames with 64px run frames; the anchor keeps
    feet planted when switching animations)
  * crops item icons from the Raven Fantasy icon sheet
  * flattens the Pixel Crawler tavern mockup (minus its baked NPC layers)
    into interior backgrounds + an "above player" overlay + a collision grid
  * builds the clothed player (see build_player.py)

Run from the repo root:  python3 tools/build_assets.py
"""
from __future__ import annotations

import json
import shutil
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "Assets"
PC = A / "Pixel Crawler - Free Pack"
ENV = PC / "Environment"
PUB = ROOT / "public"
GEN = ROOT / "src/data/generated"

manifest: dict = {"props": {}, "anims": {}, "buildings": {}, "characters": {}, "interiors": {}}


def load(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def crop(im: Image.Image, x: int, y: int, w: int, h: int) -> Image.Image:
    return im.crop((x, y, x + w, y + h))


def save(im: Image.Image, rel: str) -> None:
    p = PUB / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p)


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


# ---------------------------------------------------------------------------
# Tilesets
# ---------------------------------------------------------------------------

def build_tiles() -> None:
    dst = PUB / "sprites/tiles"
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True)
    for src, name in [
        (ENV / "Tilesets/Floors_Tiles.png", "floors.png"),
        (ENV / "Tilesets/Dungeon_Tiles.png", "dungeon.png"),
        (ENV / "Tilesets/Wall_Tiles.png", "cliffs.png"),
        (ENV / "Tilesets/Wall_Variations.png", "cliff_faces.png"),
        (ENV / "Tilesets/Water_tiles.png", "water.png"),
    ]:
        shutil.copy(src, dst / name)


# ---------------------------------------------------------------------------
# Props
# ---------------------------------------------------------------------------

S = ENV / "Props/Static"
TREES = S / "Trees"

# name: (sheet, x, y, w, h)
PROPS: dict[str, tuple[Path, int, int, int, int]] = {
    # --- trees (gatherable + decorative) ---
    "tree_oak": (TREES / "Model_01/Size_04.png", 0, 0, 80, 128),
    "tree_oak_gold": (TREES / "Model_01/Size_04.png", 80, 0, 80, 128),
    "tree_oak_autumn": (TREES / "Model_01/Size_04.png", 0, 128, 80, 128),
    "tree_oak_dead": (TREES / "Model_01/Size_04.png", 160, 0, 80, 128),
    "stump_oak": (TREES / "Model_01/Size_04.png", 320, 0, 48, 32),
    "stump_oak_autumn": (TREES / "Model_01/Size_04.png", 320, 96, 48, 32),
    "tree_small": (TREES / "Model_01/Size_03.png", 0, 0, 48, 96),
    "tree_pine": (TREES / "Model_02/Size_04.png", 0, 0, 64, 112),
    "tree_pine_dark": (TREES / "Model_02/Size_04.png", 64, 112, 64, 112),
    "tree_pine_small": (TREES / "Model_02/Size_03.png", 0, 0, 48, 80),
    "tree_tall": (TREES / "Model_03/Size_03.png", 0, 0, 64, 144),
    "tree_tall_autumn": (TREES / "Model_03/Size_03.png", 64, 144, 64, 144),
    # --- rocks / minerals ---
    "rock_large": (S / "Rocks.png", 2, 19, 28, 43),
    "rock_medium": (S / "Rocks.png", 35, 19, 26, 27),
    "rock_small": (S / "Rocks.png", 65, 19, 14, 11),
    "rock_grey_large": (S / "Rocks.png", 98, 19, 28, 43),
    "rock_grey_medium": (S / "Rocks.png", 131, 19, 26, 27),
    "rock_dark_medium": (S / "Rocks.png", 35, 115, 26, 27),
    "rubble": (S / "Rocks.png", 48, 51, 15, 10),
    "rubble_grey": (S / "Rocks.png", 144, 51, 15, 10),
    "pebble_a": (S / "Rocks.png", 81, 68, 11, 9),
    "pebble_b": (S / "Rocks.png", 68, 69, 8, 7),
    "crystal_a": (S / "Rocks.png", 146, 279, 12, 25),
    "crystal_b": (S / "Rocks.png", 164, 289, 8, 15),
    "crystal_c": (S / "Rocks.png", 179, 289, 10, 15),
    # --- vegetation ---
    "bush_green": (S / "Vegetation.png", 2, 5, 29, 27),
    "bush_lime": (S / "Vegetation.png", 50, 5, 29, 27),
    "bush_olive": (S / "Vegetation.png", 98, 5, 29, 27),
    "bush_autumn": (S / "Vegetation.png", 146, 5, 29, 27),
    "bush_large": (S / "Vegetation.png", 2, 99, 43, 43),
    "bush_large_autumn": (S / "Vegetation.png", 146, 99, 43, 43),
    "fern": (S / "Vegetation.png", 80, 147, 31, 25),
    "fern_big": (S / "Vegetation.png", 112, 166, 32, 26),
    "plant_leafy": (S / "Vegetation.png", 64, 144, 16, 16),
    "sprout": (S / "Vegetation.png", 6, 150, 5, 8),
    "grass_tuft_a": (S / "Vegetation.png", 21, 150, 8, 6),
    "grass_tuft_b": (S / "Vegetation.png", 51, 150, 9, 6),
    "cattail": (S / "Vegetation.png", 145, 166, 15, 26),
    "foxglove": (S / "Vegetation.png", 195, 161, 11, 31),
    "foxglove_small": (S / "Vegetation.png", 212, 165, 9, 27),
    "mushroom_big": (S / "Vegetation.png", 49, 338, 14, 14),
    "mushroom_a": (S / "Vegetation.png", 36, 340, 8, 9),
    "flower_red": (S / "Vegetation.png", 53, 373, 7, 6),
    "flower_white": (S / "Vegetation.png", 53, 389, 7, 6),
    "flower_blue": (S / "Vegetation.png", 53, 405, 7, 6),
    "flower_yellow": (S / "Vegetation.png", 53, 421, 7, 6),
    "flower_red_b": (S / "Vegetation.png", 100, 373, 8, 7),
    "flower_white_b": (S / "Vegetation.png", 100, 389, 8, 7),
    "flower_blue_b": (S / "Vegetation.png", 100, 405, 8, 7),
    "flower_yellow_b": (S / "Vegetation.png", 100, 421, 8, 7),
    "dead_tree": (S / "Vegetation.png", 196, 98, 39, 46),
    "coal_heap": (S / "Resources.png", 11, 20, 31, 18),
    "log_long": (S / "Resources.png", 16, 85, 32, 6),
    # --- furniture / town dressing ---
    "barrel": (S / "Furniture.png", 769, 80, 14, 16),
    "barrel_water": (S / "Furniture.png", 769, 13, 14, 19),
    "pot_a": (S / "Furniture.png", 754, 16, 12, 16),
    "pot_b": (S / "Furniture.png", 738, 17, 12, 15),
    "vase": (S / "Furniture.png", 787, 76, 10, 20),
    "crates": (S / "Furniture.png", 720, 73, 48, 23),
    "crate_stack": (S / "Furniture.png", 736, 105, 32, 23),
    "chest_closed": (S / "Furniture.png", 752, 172, 16, 20),
    "chest_open": (S / "Furniture.png", 736, 165, 16, 27),
    "chain": (S / "Furniture.png", 772, 165, 8, 41),
    "bench": (S / "Furniture.png", 83, 432, 58, 32),
    "lamp_post": (S / "Furniture.png", 147, 448, 27, 46),
    "lantern": (S / "Furniture.png", 176, 451, 14, 20),
    "fence_post": (S / "Furniture.png", 148, 422, 8, 23),
    "fence_rail": (S / "Furniture.png", 179, 422, 58, 23),
    "table_long": (S / "Furniture.png", 0, 18, 80, 30),
    "wardrobe": (S / "Furniture.png", 3, 48, 26, 48),
    "shop_counter": (S / "Furniture.png", 32, 52, 48, 28),
    "coal_crate": (S / "Resources.png", 16, 156, 15, 20),
    "empty_crate": (S / "Resources.png", 0, 157, 15, 19),
    # --- dungeon dressing ---
    "tomb_arch": (S / "Dungeon_Props.png", 97, 1, 14, 21),
    "tomb_wood": (S / "Dungeon_Props.png", 113, 2, 14, 20),
    "coffin": (S / "Dungeon_Props.png", 129, 2, 14, 20),
    "lever": (S / "Dungeon_Props.png", 74, 12, 22, 18),
    "banner_red": (S / "Dungeon_Props.png", 67, 70, 10, 21),
    "banner_blue": (S / "Dungeon_Props.png", 83, 70, 10, 21),
    "banner_green": (S / "Dungeon_Props.png", 99, 70, 10, 21),
    "stone_slab": (S / "Dungeon_Props.png", 11, 85, 42, 8),
    "coal_pile": (S / "Resources.png", 49, 17, 14, 11),
    # --- stations ---
    "anvil": (ENV / "Structures/Stations/Anvil/Anvil.png", 6, 37, 53, 34),
    "furnace": (ENV / "Structures/Stations/Furnace/Furnace.png", 112, 68, 77, 62),
}


def build_props() -> None:
    dst = PUB / "sprites/props"
    if dst.exists():
        shutil.rmtree(dst)
    cache: dict[Path, Image.Image] = {}
    for name, (sheet, x, y, w, h) in PROPS.items():
        if sheet not in cache:
            cache[sheet] = load(sheet)
        im = trim(crop(cache[sheet], x, y, w, h))
        save(im, f"sprites/props/{name}.png")
        manifest["props"][name] = {"w": im.width, "h": im.height}

    # Resource-node composites that don't exist as single sprites.
    grey = load(PUB / "sprites/props/rock_grey_medium.png")
    save(ore_vein(grey, (201, 112, 62), (140, 70, 38)), "sprites/props/ore_vein.png")
    manifest["props"]["ore_vein"] = {"w": grey.width, "h": grey.height}
    grey_big = load(PUB / "sprites/props/rock_grey_large.png")
    gold = ore_vein(grey_big, (255, 210, 90), (196, 140, 40), seed=7)
    save(gold, "sprites/props/gold_vein.png")
    manifest["props"]["gold_vein"] = {"w": gold.width, "h": gold.height}
    for name, light, dark, seed in [
        ("copper_vein", (230, 132, 72), (160, 78, 40), 21),
        ("silver_vein", (236, 240, 248), (150, 160, 178), 22),
        ("mithril_vein", (120, 240, 220), (40, 160, 170), 23),
    ]:
        v = ore_vein(ore_vein(grey, light, dark, seed=seed), light, dark, seed=seed + 50)
        save(v, f"sprites/props/{name}.png")
        manifest["props"][name] = {"w": v.width, "h": v.height}
    gem = ore_vein(ore_vein(ore_vein(grey_big, (230, 60, 70), (140, 20, 40), seed=31), (70, 150, 255), (30, 70, 170), seed=32), (90, 220, 110), (30, 120, 60), seed=33)
    save(gem, "sprites/props/gem_vein.png")
    manifest["props"]["gem_vein"] = {"w": gem.width, "h": gem.height}
    coal = ore_vein(ore_vein(grey, (52, 48, 58), (22, 20, 26), seed=11), (40, 36, 44), (14, 12, 16), seed=5)
    save(coal, "sprites/props/coal_vein.png")
    manifest["props"]["coal_vein"] = {"w": coal.width, "h": coal.height}

    # Log pile: three of the pack's cut logs stacked with a slight stagger.
    log = trim(crop(load(S / "Resources.png"), 16, 85, 32, 6))
    pile = Image.new("RGBA", (log.width + 6, 16))
    for i, (dx, dy) in enumerate([(3, 0), (0, 5), (6, 10)]):
        pile.alpha_composite(log, (dx, dy))
    save(pile, "sprites/props/log_pile.png")
    manifest["props"]["log_pile"] = {"w": pile.width, "h": pile.height}

    cluster = Image.new("RGBA", (30, 26))
    cluster.alpha_composite(load(PUB / "sprites/props/crystal_b.png"), (1, 11))
    cluster.alpha_composite(load(PUB / "sprites/props/crystal_a.png"), (9, 1))
    cluster.alpha_composite(load(PUB / "sprites/props/crystal_c.png"), (19, 11))
    cluster = trim(cluster)
    save(cluster, "sprites/props/crystal_cluster.png")
    manifest["props"]["crystal_cluster"] = {"w": cluster.width, "h": cluster.height}


def ore_vein(rock: Image.Image, light, dark, seed: int = 3) -> Image.Image:
    """Paints ore flecks onto a rock's lit face in small 2x2 clusters."""
    im = rock.copy()
    px = im.load()
    import random

    rng = random.Random(seed)
    w, h = im.size
    placed = 0
    tries = 0
    while placed < 7 and tries < 400:
        tries += 1
        x, y = rng.randrange(2, w - 3), rng.randrange(2, h - 3)
        cells = [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
        if not all(px[c][3] == 255 and sum(px[c][:3]) > 180 for c in cells):
            continue
        px[x, y] = light + (255,)
        px[x + 1, y] = light + (255,)
        px[x, y + 1] = dark + (255,)
        px[x + 1, y + 1] = dark + (255,)
        placed += 1
    return im


# ---------------------------------------------------------------------------
# Animated strips (props / stations)
# ---------------------------------------------------------------------------

ANIMS = {
    # name: (path, frameW, frameH, frames, row)
    "bonfire": (ENV / "Structures/Stations/Bonfire/Bonfire_01-Sheet.png", 32, 32, 4, 0),
    "fire": (ENV / "Structures/Stations/Bonfire/Fire_01-Sheet.png", 32, 48, 4, 0),
    "smoke": (ENV / "Structures/Stations/Bonfire/Smoke-Sheet.png", 32, 48, 4, 0),
    "anvil_work": (ENV / "Structures/Stations/Anvil/Anvil_01-Sheet.png", 64, 80, 8, 0),
}


def build_anims() -> None:
    dst = PUB / "sprites/anims"
    if dst.exists():
        shutil.rmtree(dst)
    for name, (path, fw, fh, n, row) in ANIMS.items():
        im = load(path)
        strip = crop(im, 0, row * fh, fw * n, fh)
        save(strip, f"sprites/anims/{name}.png")
        manifest["anims"][name] = {"frameW": fw, "frameH": fh, "frames": n}


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------

BK = ENV / "Structures/Buildings"
RAVEN16 = A / "Free - Raven Fantasy Icons/Free - Raven Fantasy Icons/Full Spritesheet/16x16.png"

WALL_STYLES = {"log": 0, "plank": 96, "board": 192, "timber": 288, "plaster": 384, "brick": 480}
DOORS = {"plank": (101, 29, 22, 35), "iron": (133, 27, 22, 37), "arched": (164, 27, 24, 37)}
WINDOW = (132, 99, 24, 25)
WINDOW_ARCHED = (69, 69, 22, 29)
CHIMNEY = (4, 73, 24, 60)


def wall_strip(walls: Image.Image, style_x: int, width_px: int, h: int = 56) -> Image.Image:
    out = Image.new("RGBA", (width_px, h))
    wide = crop(walls, style_x, 184, 32, h)
    narrow = crop(walls, style_x + 32, 184, 16, h)
    x = 0
    while x < width_px:
        if width_px - x >= 32:
            out.alpha_composite(wide, (x, 0))
            x += 32
        else:
            out.alpha_composite(narrow, (x, 0))
            x += 16
    return out


def sign_board(icon_col: int, icon_row: int) -> Image.Image:
    raven = load(RAVEN16)
    icon = crop(raven, icon_col * 16, icon_row * 16, 16, 16)
    board = Image.new("RGBA", (24, 26))
    d = ImageDraw.Draw(board)
    d.line([(6, 0), (6, 5)], fill=(40, 30, 24, 255))
    d.line([(17, 0), (17, 5)], fill=(40, 30, 24, 255))
    d.rectangle([0, 5, 23, 25], fill=(26, 18, 14, 255))
    d.rectangle([1, 6, 22, 24], fill=(120, 78, 44, 255))
    d.rectangle([1, 6, 22, 7], fill=(158, 108, 62, 255))
    d.rectangle([1, 23, 22, 24], fill=(86, 54, 30, 255))
    board.alpha_composite(icon, (4, 8))
    return board


def compose_building(
    width_tiles: int,
    wall: str,
    roof: str = "brown",
    depth: int = 2,
    door: str = "plank",
    door_x: int | None = None,
    windows: list[int] | None = None,
    chimney_x: int | None = None,
    sign: tuple[int, int, int] | None = None,
    arched_windows: bool = False,
) -> tuple[Image.Image, dict]:
    roofs = load(BK / "Roofs.png")
    walls = load(BK / "Walls.png")
    props = load(BK / "Props.png")
    chev = crop(roofs, 128 if roof == "green" else 0, 6, 128, 89)
    panel = crop(roofs, 40, 168, 48, 32)
    W = width_tiles * 16
    top = depth * 14 + (12 if chimney_x is not None else 0)
    wall_top = top + 89 - 8
    H = wall_top + 56
    im = Image.new("RGBA", (W, H))

    # Chimney sits behind the roof so only its top pokes out.
    if chimney_x is not None:
        im.alpha_composite(crop(props, *CHIMNEY), (chimney_x, 0))

    # Gable fill (the triangle under each chevron).
    gable_src = Image.new("RGBA", (W, 96))
    for gx in range(0, W, 48):
        for gy in range(0, 96, 32):
            gable_src.alpha_composite(panel, (gx, gy))
    mask = Image.new("L", (W, 96), 0)
    md = ImageDraw.Draw(mask)
    for cx in range(0, W, 128):
        md.polygon([(cx, 96), (cx, 85), (cx + 64, 55), (cx + 128, 85), (cx + 128, 96)], fill=255)
    im.paste(gable_src, (0, top), mask)

    im.alpha_composite(wall_strip(walls, WALL_STYLES[wall], W), (0, wall_top))

    for cx in range(0, W, 128):
        for k in range(depth, -1, -1):
            im.alpha_composite(chev, (cx, top - k * 14))

    win = crop(props, *(WINDOW_ARCHED if arched_windows else WINDOW))
    for wx in windows or []:
        im.alpha_composite(win, (wx, H - 42 if not arched_windows else H - 46))

    dx, dy, dw, dh = DOORS[door]
    if door_x is None:
        door_x = (W - dw) // 2
    im.alpha_composite(crop(props, dx, dy, dw, dh), (door_x, H - dh))

    if sign:
        sx, icol, irow = sign
        im.alpha_composite(sign_board(icol, irow), (sx, wall_top + 4))

    meta = {
        "w": W,
        "h": H,
        # Solid footprint: the wall and the lower part of the roof. The upper
        # roof overlaps what's behind it but stays walk-behind-able.
        "solid": {"x": 2, "y": max(0, H - 64), "w": W - 4, "h": 64 - 2},
        "door": {"x": door_x, "y": H - dh, "w": dw, "h": dh},
    }
    return im, meta


BUILDINGS = {
    "house": dict(width_tiles=8, wall="log", roof="brown", depth=2, windows=[14, 90], chimney_x=94),
    # Home upgrades (src/data/house.ts): each level changes material, roof
    # and height so progress is visible from across the village.
    "house_2": dict(width_tiles=8, wall="plaster", roof="brown", depth=2, windows=[10, 94], chimney_x=94),
    "house_3": dict(width_tiles=8, wall="timber", roof="green", depth=2, windows=[10, 94], chimney_x=14),
    "house_4": dict(
        width_tiles=8, wall="brick", roof="green", depth=3, door="arched", windows=[14, 92], chimney_x=94, arched_windows=True
    ),
    "shop": dict(
        width_tiles=8, wall="brick", roof="green", depth=2, windows=[10, 94], door="iron", sign=(84, 13, 9)
    ),
    "blacksmith": dict(
        width_tiles=8,
        wall="plank",
        roof="brown",
        depth=1,
        door="iron",
        windows=[12],
        chimney_x=12,
        sign=(88, 12, 7),
    ),
    "tavern": dict(
        width_tiles=16,
        wall="timber",
        roof="brown",
        depth=3,
        door="arched",
        door_x=116,
        windows=[14, 52, 172, 214],
        chimney_x=200,
        sign=(84, 6, 31),
    ),
}


def build_buildings() -> None:
    dst = PUB / "sprites/buildings"
    if dst.exists():
        shutil.rmtree(dst)
    for name, spec in BUILDINGS.items():
        im, meta = compose_building(**spec)
        save(im, f"sprites/buildings/{name}.png")
        manifest["buildings"][name] = meta

    # The mine mouth for the dungeon: a slice of cliff face with the timber
    # entrance, plus a plain cliff segment to tile beside it.
    faces = load(ENV / "Tilesets/Wall_Variations.png")
    entrance = crop(faces, 176, 80, 80, 80)
    save(entrance, "sprites/buildings/mine_entrance.png")
    manifest["buildings"]["mine_entrance"] = {
        "w": 80,
        "h": 80,
        "solid": {"x": 0, "y": 0, "w": 80, "h": 70},
        "door": {"x": 20, "y": 30, "w": 36, "h": 42},
    }
    cliff = crop(faces, 32, 80, 144, 80)
    save(cliff, "sprites/buildings/cliff_face.png")
    manifest["buildings"]["cliff_face"] = {"w": 144, "h": 80, "solid": {"x": 0, "y": 0, "w": 144, "h": 70}}

    # Ruined crypt entrance for the deep forest: the dungeon arch doorway set
    # into a chunk of dungeon wall.
    dung = load(ENV / "Tilesets/Dungeon_Tiles.png")
    crypt = Image.new("RGBA", (64, 64))
    wallface = crop(dung, 0, 0, 48, 48)
    crypt.alpha_composite(wallface, (0, 16))
    crypt.alpha_composite(wallface, (16, 16))
    crypt.alpha_composite(crop(dung, 0, 0, 64, 16), (0, 0))
    crypt.alpha_composite(crop(dung, 0, 160, 32, 48), (16, 16))
    save(crypt, "sprites/buildings/crypt_entrance.png")
    manifest["buildings"]["crypt_entrance"] = {
        "w": 64,
        "h": 64,
        "solid": {"x": 0, "y": 8, "w": 64, "h": 52},
        "door": {"x": 18, "y": 24, "w": 28, "h": 40},
    }


# ---------------------------------------------------------------------------
# Characters (mobs + NPCs)
# ---------------------------------------------------------------------------

E = PC / "Entities"
MOB = E / "Mobs"
# id: {anim: (path, frameW)}
CHARACTERS = {
    "orc": {
        "idle": (MOB / "Orc Crew/Orc/Idle/Idle-Sheet.png", 32),
        "run": (MOB / "Orc Crew/Orc/Run/Run-Sheet.png", 64),
        "death": (MOB / "Orc Crew/Orc/Death/Death-Sheet.png", 64),
    },
    "orc_rogue": {
        "idle": (MOB / "Orc Crew/Orc - Rogue/Idle/Idle-Sheet.png", 32),
        "run": (MOB / "Orc Crew/Orc - Rogue/Run/Run-Sheet.png", 64),
        "death": (MOB / "Orc Crew/Orc - Rogue/Death/Death-Sheet.png", 64),
    },
    "orc_warrior": {
        "idle": (MOB / "Orc Crew/Orc - Warrior/Idle/Idle-Sheet.png", 32),
        "run": (MOB / "Orc Crew/Orc - Warrior/Run/Run-Sheet.png", 64),
        "death": (MOB / "Orc Crew/Orc - Warrior/Death/Death-Sheet.png", 96),
    },
    "skeleton": {
        "idle": (MOB / "Skeleton Crew/Skeleton - Base/Idle/Idle-Sheet.png", 32),
        "run": (MOB / "Skeleton Crew/Skeleton - Base/Run/Run-Sheet.png", 64),
        "death": (MOB / "Skeleton Crew/Skeleton - Base/Death/Death-Sheet.png", 64),
    },
    "skeleton_rogue": {
        "idle": (MOB / "Skeleton Crew/Skeleton - Rogue/Idle/Idle-Sheet.png", 32),
        "run": (MOB / "Skeleton Crew/Skeleton - Rogue/Run/Run-Sheet.png", 64),
        "death": (MOB / "Skeleton Crew/Skeleton - Rogue/Death/Death-Sheet.png", 64),
    },
    "skeleton_warrior": {
        "idle": (MOB / "Skeleton Crew/Skeleton - Warrior/Idle/Idle-Sheet.png", 32),
        "run": (MOB / "Skeleton Crew/Skeleton - Warrior/Run/Run-Sheet.png", 64),
        "death": (MOB / "Skeleton Crew/Skeleton - Warrior/Death/Death-Sheet.png", 64),
    },
    "npc_barmaid": {
        "idle": (E / "Npc's/Citizen_F/Tavern_A/Idle_Hold/Idle_Side-Sheet.png", 64),
        "walk": (E / "Npc's/Citizen_F/Tavern_A/Walk_Hold/Walk_Side-Sheet.png", 64),
    },
    "npc_maid": {
        "idle": (E / "Npc's/Citizen_F/Tavern_A/Idle/Idle_Side-Sheet.png", 64),
        "walk": (E / "Npc's/Citizen_F/Tavern_A/Walk/Walk_Side-Sheet.png", 64),
    },
    "npc_barkeep": {
        "idle": (E / "Npc's/Citizen_F/Tavern_B/Idle/Idle_Side-Sheet.png", 64),
        "walk": (E / "Npc's/Citizen_F/Tavern_B/Walk/Walk_Side-Sheet.png", 64),
    },
    "npc_peasant": {
        "idle": (E / "Npc's/Citizen_F/Peasant_A/Idle/Idle-Sheet.png", 64),
        "walk": (E / "Npc's/Citizen_F/Peasant_A/Walk/Walk-Sheet.png", 64),
    },
    "npc_knight": {
        "idle": (E / "Npc's/Knight/Idle/Idle-Sheet.png", 32),
        "walk": (E / "Npc's/Knight/Run/Run-Sheet.png", 64),
    },
    "npc_wizard": {
        "idle": (E / "Npc's/Wizzard/Idle/Idle-Sheet.png", 32),
        "walk": (E / "Npc's/Wizzard/Run/Run-Sheet.png", 64),
    },
    "npc_rogue": {
        "idle": (E / "Npc's/Rogue/Idle/Idle-Sheet.png", 32),
        "walk": (E / "Npc's/Rogue/Run/Run-Sheet.png", 64),
    },
}


def foot_anchor(im: Image.Image, fw: int) -> tuple[float, float, int]:
    """Union bbox of all frames -> (anchorX, anchorY) normalized so the
    sprite's feet land on the entity position; also returns body height."""
    fh = im.height
    n = im.width // fw
    x0, y0, x1, y1 = fw, fh, 0, 0
    for i in range(n):
        bb = crop(im, i * fw, 0, fw, fh).getbbox()
        if not bb:
            continue
        x0, y0 = min(x0, bb[0]), min(y0, bb[1])
        x1, y1 = max(x1, bb[2]), max(y1, bb[3])
    # Center horizontally on the first frame's body (death frames sprawl).
    first = crop(im, 0, 0, fw, fh).getbbox() or (x0, y0, x1, y1)
    cx = (first[0] + first[2]) / 2
    return cx / fw, y1 / fh, y1 - first[1]


def build_characters() -> None:
    dst = PUB / "sprites/characters"
    if dst.exists():
        shutil.rmtree(dst)
    for cid, anims in CHARACTERS.items():
        meta = {}
        for anim, (path, fw) in anims.items():
            im = load(path)
            ax, ay, body_h = foot_anchor(im, fw)
            save(im, f"sprites/characters/{cid}/{anim}.png")
            meta[anim] = {
                "frameW": fw,
                "frameH": im.height,
                "frames": im.width // fw,
                "anchorX": round(ax, 4),
                "anchorY": round(ay, 4),
                "bodyH": body_h,
            }
        manifest["characters"][cid] = meta


# ---------------------------------------------------------------------------
# Icons
# ---------------------------------------------------------------------------

RAVEN32 = A / "Free - Raven Fantasy Icons/Free - Raven Fantasy Icons/Full Spritesheet/32x32.png"
ICONS = {
    # resources
    "wood": (12, 6),
    "stone": (1, 13),
    "iron_ore": (0, 13),
    "gold_ore": (0, 12),
    "iron_bar": (9, 13),
    "herb": (0, 15),
    "emberbloom": (6, 16),
    "mushroom": (7, 15),
    "crystal": (13, 10),
    "leather": (11, 12),
    "bone": (13, 13),
    "orc_tusk": (8, 14),
    "ruby": (2, 10),
    "sapphire": (0, 10),
    "emerald": (1, 10),
    "amethyst": (5, 10),
    "diamond": (7, 10),
    "coal": (15, 23),
    "plank": (10, 12),
    "stone_brick": (8, 13),
    "copper_ore": (1, 12),
    "silver_ore": (3, 13),
    "mithril_ore": (14, 15),
    "copper_bar": (1, 9),
    "silver_bar": (3, 9),
    "gold_bar": (5, 9),
    "mithril_bar": (8, 9),
    "hardwood": (13, 6),
    "ancient_wood": (15, 6),
    "healroot": (11, 15),
    "moonpetal": (13, 15),
    # currency / misc
    "gold_coin": (2, 8),
    "coin_bag": (13, 9),
    "chest": (5, 0),
    "key": (8, 4),
    "beer": (6, 31),
    "anvil": (12, 7),
    "dice": (13, 0),
    # consumables
    "potion_health": (3, 17),
    "potion_greater": (8, 17),
    "stew": (2, 29),
    "scroll_return": (8, 18),
    "potion_salve": (14, 3),
    "potion_moon": (10, 3),
    "lantern_item": (4, 5),
    "sword_silver": (0, 111),
    "sword_mithril": (13, 105),
    "armor_silver": (1, 117),
    "armor_mithril": (13, 118),
    "pickaxe_mithril": (3, 109),
    "axe_mithril": (3, 111),
    "journal": (0, 18),
    # skills / ui glyphs
    "skill_strength": (0, 41),
    "sleep": (14, 42),
    "house": (15, 0),
    "craft": (15, 56),
    # weapons
    "sword_wood": (7, 95),
    "sword_iron": (7, 90),
    "sword_steel": (7, 100),
    "sword_epic": (6, 108),
    "sword_legendary": (0, 105),
    "dagger_iron": (0, 90),
    "dagger_steel": (0, 100),
    "maul_iron": (4, 92),
    "maul_steel": (4, 102),
    "spear_iron": (13, 90),
    "spear_steel": (13, 100),
    "mace_spiked": (1, 94),
    "rapier": (8, 94),
    # farming (seeds row 26, crops rows 27/35/36) + quest items
    "seed_turnip": (0, 26), "seed_carrot": (1, 26), "seed_potato": (2, 26), "seed_tomato": (3, 26),
    "seed_strawberry": (4, 26), "seed_pumpkin": (5, 26), "seed_corn": (6, 26), "seed_melon": (9, 26),
    "crop_turnip": (5, 34), "crop_carrot": (8, 27), "crop_potato": (9, 27), "crop_tomato": (1, 27),
    "crop_strawberry": (0, 27), "crop_pumpkin": (13, 27), "crop_corn": (3, 36), "crop_melon": (12, 27),
    "seed_onion": (8, 26), "crop_onion": (7, 27), "seed_cabbage": (11, 26), "crop_cabbage": (4, 34),
    "seed_pepper": (4, 28), "crop_pepper": (5, 27), "seed_grape": (6, 26), "crop_grape": (10, 27),
    "seed_duskberry": (13, 28), "crop_duskberry": (7, 36), "seed_healroot": (3, 28),
    "seed_moonroot": (15, 28), "crop_moonroot": (5, 35),
    "femur": (6, 14),
    "cleaver_grukk": (5, 112),
    "crown_hollow": (6, 119),
    "heart_golem": (3, 133),
    "ring_grave": (5, 115),
    "mail_emberscale": (4, 120),
    # tools
    "axe_rusty": (7, 96),
    "axe_iron": (7, 91),
    "axe_steel": (7, 101),
    "pickaxe_rusty": (1, 96),
    "pickaxe_iron": (1, 91),
    "pickaxe_steel": (1, 101),
    # armor
    "armor_cloth": (3, 126),
    "armor_leather": (5, 123),
    "armor_iron": (0, 120),
    "armor_steel": (14, 120),
    # accessories / relics
    "ring_gold": (3, 115),
    "ring_amethyst": (5, 115),
    "amulet": (8, 115),
    "clover": (12, 41),
    "horseshoe": (5, 7),
    "pendant_phoenix": (4, 136),
    # head + feet
    "helm_leather": (12, 122),
    "helm_iron": (0, 119),
    "helm_steel": (14, 119),
    "helm_mithril": (3, 119),
    "boots_leather": (14, 127),
    "boots_iron": (0, 121),
    "boots_steel": (14, 121),
    "boots_mithril": (3, 121),
    # hunting
    "meat_raw": (0, 30),
    "meat_roast": (5, 30),
    "hide": (10, 14),
    "feather": (7, 25),
    "antler": (8, 14),
    "rabbit_foot": (15, 14),
    "bow_wood": (4, 111),
    "arrow": (0, 25),
    # stealable odds and ends
    "apple_pie": (4, 33),
    "tankard": (7, 31),
    # v0.7: farming / fishing tools, fish, HUD + map glyphs
    "hoe": (7, 56),
    "watering_can": (12, 56),
    "rod_wood": (0, 21),
    "rod_iron": (1, 21),
    "bait_worm": (5, 21),
    "fish_minnow": (8, 22),
    "fish_perch": (9, 22),
    "fish_trout": (9, 21),
    "fish_carp": (13, 21),
    "fish_salmon": (10, 22),
    "fish_pike": (15, 22),
    "fish_rainbow": (12, 21),
    "fish_moon": (13, 22),
    "fish_golden": (11, 22),
    "fish_cooked": (6, 30),
    "repair_kit": (5, 57),
    "whetstone": (7, 57),
    "glyph_heart": (2, 41),
    "glyph_shield": (7, 41),
    "glyph_bolt": (0, 64),
    "glyph_mana": (3, 37),
    "glyph_sun": (15, 64),
    "map_scroll": (0, 19),
    "map_mine": (8, 1),
    "map_cave": (7, 1),
    "map_tree": (15, 1),
    "map_bigtree": (13, 2),
    "map_portal": (3, 2),
    "map_tower": (5, 2),
    "map_chapel": (4, 2),
    "map_house": (2, 2),
    "map_hut": (0, 2),
    "map_watchtower": (1, 2),
    "map_mountain": (13, 1),
    "map_ruins": (10, 1),
    "map_lake": (3, 1),
    "map_isle": (5, 1),
    "map_camp": (6, 1),
    "map_crystal": (9, 1),
    "map_unknown": (12, 0),
    "map_flag": (10, 2),
    "map_anvil": (6, 2),
    "map_tavern": (15, 0),
    "tent": (12, 5),
    "mana_potion": (10, 7),
    "spellbook": (4, 18),
}


def build_icons() -> None:
    for d in ("icons", "icons16"):
        if (PUB / d).exists():
            shutil.rmtree(PUB / d)
    sheet = load(RAVEN32)
    small = load(RAVEN16)
    for name, (c, r) in ICONS.items():
        save(crop(sheet, c * 32, r * 32, 32, 32), f"icons/{name}.png")
        # 16px twins are used for items lying in the world.
        save(crop(small, c * 16, r * 16, 16, 16), f"icons16/{name}.png")


UI_SHEET = A / "UI MAIN/PNG/SpriteSheet.png"
UI_CROPS = {
    "panel": (32, 128, 157, 65),
    "slot": (40, 550, 33, 36),
    "button": (491, 1387, 57, 22),
    "button_down": (132, 1557, 57, 20),
    "banner": (32, 496, 150, 32),
    "bubble": (38, 983, 109, 34),
}


def build_ui() -> None:
    dst = PUB / "ui"
    if dst.exists():
        shutil.rmtree(dst)
    sheet = load(UI_SHEET)
    for name, rect in UI_CROPS.items():
        save(crop(sheet, *rect), f"ui/{name}.png")


# ---------------------------------------------------------------------------
# Interiors (from the tavern mockup .aseprite, NPC layers removed)
# ---------------------------------------------------------------------------

def parse_aseprite(path: Path) -> dict:
    d = path.read_bytes()
    _size, magic, frames, W, H, depth = struct.unpack_from("<IHHHHH", d, 0)
    assert magic == 0xA5E0 and depth == 32
    pos = 128
    layers, cels = [], []
    fsize, _fm, oldc, _dur = struct.unpack_from("<IHHH", d, pos)
    nch = struct.unpack_from("<I", d, pos + 12)[0] or oldc
    p = pos + 16
    for _ in range(nch):
        csize, ctype = struct.unpack_from("<IH", d, p)
        body = d[p + 6 : p + csize]
        if ctype == 0x2004:
            ln = struct.unpack_from("<H", body, 16)[0]
            layers.append(body[18 : 18 + ln].decode())
        elif ctype == 0x2005:
            li, x, y, _opa, ct = struct.unpack_from("<HhhBH", body, 0)
            if ct == 2:
                w, h = struct.unpack_from("<HH", body, 16)
                cels.append((li, x, y, Image.frombytes("RGBA", (w, h), zlib.decompress(body[20:]))))
        p += csize
    return {"W": W, "H": H, "layers": layers, "cels": cels}


def layer_image(a: dict, names: list[str]) -> Image.Image:
    im = Image.new("RGBA", (a["W"], a["H"]))
    idx = {n: i for i, n in enumerate(a["layers"])}
    wanted = sorted(idx[n] for n in names)
    for li in wanted:
        for cli, x, y, ci in a["cels"]:
            if cli == li:
                im.alpha_composite(ci, (x, y))
    return im


def collision_grid(a: dict, region: tuple[int, int, int, int], cell: int, walkable_rects, blocked_rects, prop_layers=("Props_01", "Props_02")) -> list[str]:
    ground = layer_image(a, ["Ground"]).load()
    walls = layer_image(a, ["Walls"]).load()
    props = layer_image(a, list(prop_layers)).load() if prop_layers else None
    rx, ry, rw, rh = region

    def cov(px, cx, cy):
        n = 0
        for y in range(cy, cy + cell):
            for x in range(cx, cx + cell):
                if px[x, y][3] > 0:
                    n += 1
        return n / (cell * cell)

    rows = []
    for gy in range(rh // cell):
        row = ""
        for gx in range(rw // cell):
            px_, py_ = rx + gx * cell, ry + gy * cell
            ok = cov(ground, px_, py_) > 0.5 and cov(walls, px_, py_) < 0.3 and (props is None or cov(props, px_, py_) < 0.35)
            cx, cy = px_ + cell / 2, py_ + cell / 2
            for (x0, y0, x1, y1) in walkable_rects:
                if x0 <= cx < x1 and y0 <= cy < y1:
                    ok = True
            for (x0, y0, x1, y1) in blocked_rects:
                if x0 <= cx < x1 and y0 <= cy < y1:
                    ok = False
            row += "." if ok else "#"
        rows.append(row)
    return rows


INTERIORS = {
    "tavern": {
        "region": (0, 0, 640, 464),
        # Stairs and the corridor exit are drawn on the Walls layer; open them.
        # Finer cells than the small rooms: with 8px cells a gap you could
        # plainly see between two chairs was often one free cell, narrower
        # than the player, i.e. an invisible wall.
        "cell": 4,
        # Props stripped from the art (and made walkable): the left leaf of
        # the hinged bar flap swings open, so the kitchen and the pantry
        # behind the bar can actually be reached.
        "open": [(222, 189, 241, 211)],
        "walkable": [
            (222, 189, 241, 211),  # open bar flap
            # The aisles either side of the middle table read as walkable
            # but were 8-9px wide (the player is 10): trim the bench/pillar
            # edges a couple of pixels so the nook between the tables opens.
            (366, 236, 378, 262),
            (452, 236, 466, 262),
            (178, 335, 226, 420),  # hall -> corridor stairs
            (433, 112, 624, 144),  # casino platform steps
            (225, 111, 257, 145),  # kitchen -> hall steps
            (15, 160, 49, 206),  # kitchen stairs
            (0, 414, 20, 446),  # corridor exit (west door)
        ],
        "blocked": [],
    },
    "house": {
        "region": (312, 464, 144, 176),
        "walkable": [(368, 624, 400, 640)],  # doorway at the bottom
        "blocked": [],
    },
    # Mira's General Store: the empty beige guest room, furniture stripped;
    # the counter and shelves are placed as props by the game.
    "shop": {
        "region": (488, 464, 144, 176),
        "walkable": [(544, 624, 576, 640)],  # doorway at the bottom
        "blocked": [],
        "layers": ["BG", "Ground", "Light", "Walls", "Wall_Props"],
    },
    # Bram's forge: the stone scullery under the tavern kitchen (its stairs
    # read as the way up to his loft). The Light layer (sauce splats) is
    # left out; furnace, anvil and racks are placed as props by the game.
    "forge": {
        "region": (0, 140, 160, 212),
        "walkable": [(64, 330, 96, 352)],  # doorway at the bottom
        "blocked": [],
        "layers": ["BG", "Ground", "Walls", "Wall_Props"],
    },
}


def build_interiors() -> None:
    a = parse_aseprite(PC / "MockUps/Tavern.aseprite")
    base_layers = ["BG", "Ground", "Ground_Decor", "Light", "Walls", "Wall_Props", "Props_01", "Props_02", "Table_Tops"]
    base = layer_image(a, base_layers)
    above = layer_image(a, ["Roof"])
    dst = PUB / "sprites/interiors"
    if dst.exists():
        shutil.rmtree(dst)
    for name, spec in INTERIORS.items():
        rx, ry, rw, rh = spec["region"]
        bg = Image.new("RGBA", (rw, rh), (0, 0, 0, 255))
        src = layer_image(a, spec["layers"]) if "layers" in spec else base
        bg.alpha_composite(crop(src, rx, ry, rw, rh))
        if spec.get("open"):
            bare = layer_image(a, [l for l in base_layers if l not in ("Props_01", "Props_02", "Table_Tops")])
            for (x0, y0, x1, y1) in spec["open"]:
                patch = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 255))
                patch.alpha_composite(bare.crop((x0, y0, x1, y1)))
                bg.paste(patch, (x0 - rx, y0 - ry))
        save(bg, f"sprites/interiors/{name}.png")
        ov = crop(above, rx, ry, rw, rh)
        has_overlay = ov.getbbox() is not None
        if has_overlay:
            save(ov, f"sprites/interiors/{name}_above.png")
        # Rooms with their furniture stripped only collide with walls.
        cell = spec.get("cell", 8)
        rows = collision_grid(a, spec["region"], cell, spec["walkable"], spec["blocked"], () if "layers" in spec else ("Props_01", "Props_02"))
        manifest["interiors"][name] = {
            "w": rw,
            "h": rh,
            "cell": cell,
            "overlay": has_overlay,
            "collision": rows,
        }


# ---------------------------------------------------------------------------

GLASS = {(107, 168, 178): (255, 214, 120), (62, 117, 139): (255, 170, 80), (132, 166, 179): (255, 226, 150), (149, 173, 180): (255, 236, 170)}


def build_glows() -> None:
    """Night window glow: every pane of glass in a building sprite, recoloured
    warm. The game draws it over the darkness after dusk (emissive), so lit
    windows actually glow instead of being dimmed with the wall."""
    for name in list(manifest["buildings"]):
        path = PUB / f"sprites/buildings/{name}.png"
        if not path.exists():
            continue
        im = Image.open(path).convert("RGBA")
        out = Image.new("RGBA", im.size, (0, 0, 0, 0))
        src, dst = im.load(), out.load()
        n = 0
        for y in range(im.height):
            for x in range(im.width):
                p = src[x, y]
                if p[3] and p[:3] in GLASS:
                    dst[x, y] = GLASS[p[:3]] + (255,)
                    n += 1
        if n:
            save(out, f"sprites/buildings/{name}_glow.png")
            manifest["buildings"][name]["glow"] = True


def main() -> None:
    build_tiles()
    build_props()
    sys.path.insert(0, str(Path(__file__).parent))
    import build_ai_props

    build_ai_props.build(manifest)
    build_anims()
    build_buildings()
    build_glows()
    build_characters()
    sys.path.insert(0, str(Path(__file__).parent))
    import build_ai_enemies

    build_ai_enemies.build(manifest)
    build_icons()
    build_ui()
    build_interiors()
    sys.path.insert(0, str(Path(__file__).parent))
    import build_player

    build_player.build()
    import build_villagers

    build_villagers.build()
    GEN.mkdir(parents=True, exist_ok=True)
    (GEN / "assets.json").write_text(json.dumps(manifest, indent=1))
    # Animals are drawn procedurally (no pack sprites); they add their own
    # manifest section.
    import build_animals

    build_animals.build()
    print("props:", len(manifest["props"]), "buildings:", list(manifest["buildings"]),
          "characters:", list(manifest["characters"]))


if __name__ == "__main__":
    main()
