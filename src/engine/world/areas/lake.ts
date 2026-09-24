import type { Game } from "../../Game";
import type { Area } from "../Area";
import { Outdoor } from "./outdoor";
import { TILE } from "../../../game/core/constants";
import { Lake } from "../../entities/Lake";
import { InteractSpot, npc } from "../../entities/Props";
import { Animal } from "../../entities/Animal";
import { Fireflies } from "../../fx/Fireflies";
import { waterSpot } from "../waterSpots";
import { t } from "../../../i18n";

/**
 * Mirror Lake, south of the village: a still lake with a pier, reeds, a
 * few herbs and Marit, who has been fishing here since before the pier.
 *
 *            ‖ road to Wildkeep
 *     trees  ‖      trees
 *      ~~~~~~╫~~~~~~~
 *    ~~~~~~~~╫pier~~~~~~
 *     ~~~~~ Mirror Lake ~~~~   → (the river to Saltmere: washed out)
 *        ~~~~~~~~~~~~~~
 */
const COLS = 56;
const ROWS = 40;

export function buildLake(game: Game): Area {
  const o = new Outdoor(game, "lake", COLS, ROWS, "mirror-lake");
  const area = o.area;
  const ter = o.terrain;
  const R = o.rng;

  // ---- paths --------------------------------------------------------------
  ter.path([[28, 0], [28, 12]], 3, "dirt");
  ter.path([[28, 12], [48, 12], [48, 26], [COLS - 1, 26]], 2, "dirt");
  ter.blob(24, 11, 3, 2, "dirt", R);

  // ---- the lake -------------------------------------------------------------
  const lake = new Lake(area, {
    seed: "mirror-lake",
    blobs: [
      { cx: 27, cy: 23, rx: 14, ry: 8 },
      { cx: 17, cy: 26, rx: 7, ry: 5 },
      { cx: 37, cy: 21, rx: 6, ry: 5 },
    ],
    pier: { x: 29, y: 14, w: 2, h: 6 },
  });
  area.add(lake);
  o.reserve(9, 14, 36, 19);
  o.reserve(28, 13, 3, 8);

  // Reeds and rocks along the shore.
  for (const [x, y] of [
    [12, 21],
    [14, 30],
    [20, 31],
    [34, 30],
    [40, 26],
    [42, 18],
    [16, 18],
    [24, 15],
    [36, 15],
  ])
    area.prop("cattail", x * TILE + R.int(-4, 4), y * TILE + R.int(-2, 2), { flat: false });
  area.prop("rock_grey_medium", 43 * TILE, 22 * TILE, { collider: { w: 18, h: 8 } });
  area.prop("rock_grey_large", 10 * TILE, 28 * TILE, { collider: { w: 24, h: 10 } });
  area.prop("log_long", 22 * TILE, 12 * TILE + 8, { flat: true });
  area.prop("bench", 25 * TILE, 11 * TILE + 4, { collider: { w: 54, h: 8 } });
  o.reserve(22, 10, 6, 3);
  area.prop("crates", 31 * TILE + 8, 13 * TILE, { collider: { w: 40, h: 6 } });
  area.prop("barrel_water", 27 * TILE, 13 * TILE + 4, { collider: { w: 12, h: 6 } });
  waterSpot(area, 27 * TILE, 13 * TILE + 8);
  o.reserve(26, 12, 8, 2);
  // Lamp at the root of the pier: evening fishing.
  o.prop("lamp_post", 31, 12, { w: 6, h: 4 });

  // Marit fishes off the end of the pier.
  const marit = npc("marit", 30 * TILE, 19 * TILE + 4, { face: "down" });
  if (marit) area.add(marit);

  // East: the river road towards the coast — washed out for now.
  area.add(
    new InteractSpot(
      (COLS - 2) * TILE,
      26 * TILE + 8,
      () => ({ verb: t("prompt.look"), target: t("prompt.target.washedOut") }),
      (g) => g.ui.pushToast(t("toast.washedOut"), "info", { icon: "map_isle" }),
      { radius: 20, priority: 1, marker: true },
    ),
  );
  area.solidCells(COLS - 1, 24, 1, 5);

  // A few things worth picking up.
  o.node("herb", 20, 8);
  o.node("herb", 44, 32);
  o.node("tree", 8, 10);
  o.node("tree", 48, 8);
  o.node("rock", 50, 32);
  o.node("mushroom", 6, 33);

  // ---- exits ----------------------------------------------------------------
  area.trigger({ rect: { x: 26 * TILE, y: 0, w: 5 * TILE, h: 8 }, travel: { area: "town", spawn: "south" }, requireDir: "up" });
  area.spawns.north = { x: 28 * TILE + 8, y: 2 * TILE, dir: "down" };
  area.spawns.default = area.spawns.north;
  area.spawns.pier = { x: 30 * TILE, y: 16 * TILE };

  // ---- borders + dressing ------------------------------------------------------
  o.forestWall(0, 0, 26, 3, ["tree_oak", "tree_pine", "tree_tall"]);
  o.forestWall(31, 0, COLS - 31, 3, ["tree_oak", "tree_pine", "tree_tall"]);
  o.forestWall(0, 3, 2, ROWS - 3, ["tree_pine", "tree_oak"]);
  o.forestWall(COLS - 2, 3, 2, 21, ["tree_pine", "tree_oak"]);
  o.forestWall(COLS - 2, 29, 2, ROWS - 29, ["tree_pine", "tree_oak"]);
  o.forestWall(0, ROWS - 3, COLS, 3, ["tree_oak", "tree_pine", "tree_oak_autumn", "tree_tall"]);
  for (let i = 0; i < 14; i++) {
    const x = R.int(3, COLS - 4);
    const y = R.int(4, ROWS - 5);
    if (o.freeArea(x - 1, y - 1, 3, 2)) o.tree(R.pick(["tree_oak", "tree_pine", "tree_small", "tree_oak_autumn"]), x, y);
  }
  o.scatter({ x: 2, y: 3, w: COLS - 4, h: ROWS - 6 }, 90);
  o.scatter({ x: 2, y: 3, w: COLS - 4, h: ROWS - 6 }, 12, ["bush_green", "bush_lime", "rock_small", "fern"], true);

  // Ducks? No ducks. Rabbits and a deer come down to drink.
  for (const [x, y, kind] of [
    [12, 8, "rabbit"],
    [44, 30, "rabbit"],
    [8, 34, "deer"],
  ] as const) {
    if (o.freeArea(x, y, 1, 1)) area.add(new Animal(x * TILE, y * TILE, kind));
  }
  area.add(new Fireflies(area, 14));
  area.light({ x: 30 * TILE, y: 18 * TILE, radius: 40, color: 0xffd08a, intensity: 0.5, flicker: 0.4 });
  return o.finish();
}
