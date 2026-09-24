"""
Decoration props from the AI concept sheet (Assets/Decorations Assets):
furniture, forge equipment, market stalls, statues, tombstones, doors.

Each is isolated from the packed sheet, pixelated onto its true grid and
outlined (tools/ai/sheet.py), then written as `public/sprites/props/d_<name>.png`
with a manifest entry, so areas place them with `area.prop("d_bed_red", …)`
like any pack prop.

Run:  python3 tools/build_ai_props.py   (also run by build_assets.py)
"""
import json
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent / "ai"))
import sheet  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Assets/Decorations Assets"
OUT = ROOT / "public/sprites/props"
MANIFEST = ROOT / "src/data/generated/assets.json"

# Sheet pixels per art pixel for this sheet (matches the pack's scale).
SCALE = 2.7

# name -> box on the sheet (x0, y0, x1, y1). Boxes may be merged unions.
DECO = {
    # bedroom
    "bed_white": (21, 12, 59, 96), "bed_red": (74, 13, 125, 98), "bed_blue": (140, 13, 192, 97), "bed_green": (207, 12, 267, 97),
    "wardrobe_big": (359, 14, 415, 99), "mirror": (432, 10, 463, 81), "vanity": (1403, 321, 1469, 400),
    # floors + walls
    "rug_red": (31, 121, 78, 175), "rug_blue": (111, 121, 182, 175), "rug_round": (210, 124, 286, 176), "rug_green": (321, 121, 380, 177),
    "rug_long_blue": (23, 195, 143, 255), "rug_long_red": (178, 192, 302, 267),
    "banner_blue2": (922, 171, 945, 221), "banner_green2": (971, 171, 991, 224), "banner_navy": (1081, 173, 1116, 223),
    "plant_pot": (419, 113, 452, 174),
    # study + shop
    "bookshelf_wide": (1147, 157, 1230, 237), "bookcase_a": (466, 448, 527, 543), "bookcase_b": (731, 447, 782, 542), "bookcase_c": (21, 493, 89, 587),
    "shelf_goods": (1024, 327, 1095, 409), "counter_goods": (1117, 339, 1187, 401), "alch_desk": (498, 244, 544, 305),
    "armor_stand": (1347, 233, 1377, 300),
    # kitchen + tavern
    "barrel_a": (23, 279, 64, 336), "barrel_b": (89, 278, 128, 335), "barrel_c": (152, 281, 191, 333),
    "table_long2": (565, 252, 662, 293), "bench_long": (911, 489, 1001, 529), "table_low": (1058, 475, 1133, 527),
    "fireplace": (127, 346, 190, 415), "oven_tall": (221, 345, 266, 421), "stone_oven": (464, 560, 508, 631),
    "washtub": (1313, 411, 1391, 482), "bathtub": (1408, 422, 1511, 492), "sacks": (575, 945, 620, 989),
    # smithy
    "coal_forge": (287, 343, 353, 415), "smith_table": (368, 330, 455, 378), "quench_trough": (367, 387, 428, 442),
    "chimney_forge": (262, 427, 320, 508), "chimney_forge_stone": (325, 427, 383, 508), "forge_fire": (145, 434, 215, 526),
    "brazier_stone": (260, 521, 305, 583),
    # town
    "stall_blue": (1174, 506, 1247, 617), "stall_red": (1265, 503, 1322, 617), "stall_green": (1343, 503, 1422, 617),
    "fountain_big": (27, 611, 97, 725), "fountain_small": (558, 575, 608, 638), "statue_angel": (163, 614, 205, 720),
    "statue_hooded": (245, 607, 284, 715), "flower_box": (929, 771, 977, 817), "hay_a": (352, 939, 383, 973), "hay_b": (401, 945, 439, 994),
    "log_stack": (196, 943, 241, 992),
    # graveyard + ruins + dungeon
    "tomb_a": (865, 615, 903, 686), "tomb_b": (1004, 641, 1046, 709), "tomb_c": (1075, 649, 1118, 723), "tomb_d": (311, 671, 354, 720), "tomb_e": (374, 665, 411, 718),
    "ruin_wall": (434, 641, 497, 707), "ruin_pillar": (1312, 795, 1355, 903), "ruin_tower": (1427, 794, 1457, 911), "pillar": (1476, 509, 1505, 695),
    "skull_big": (1103, 911, 1133, 941), "door_wood": (1001, 737, 1054, 816), "door_iron": (1075, 745, 1142, 823), "door_gate": (1231, 741, 1291, 816),
}


def build(manifest=None) -> None:
    im = sheet.load(next(SRC.glob("*.png")))
    own = manifest is None
    if own:
        manifest = json.loads(MANIFEST.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for name, box in DECO.items():
        spr = sheet.prop_from(im, box, SCALE)
        pid = f"d_{name}"
        spr.save(OUT / f"{pid}.png")
        manifest["props"][pid] = {"w": spr.width, "h": spr.height}
    print(f"ai props: {len(DECO)}")
    if own:
        MANIFEST.write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    build()
