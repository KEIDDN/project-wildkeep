import type { Game } from "../../Game";
import type { Area, Trigger } from "../Area";
import { Outdoor } from "./outdoor";
import type { TerrainType } from "../Terrain";
import type { AreaId } from "../../../game/core/types";
import type { ForestLayout } from "../../../game/procgen/forestGenerator";

export interface WoodsConfig {
  id: AreaId;
  seed: string;
  layout: ForestLayout;
  ground: TerrainType;
  trail: TerrainType;
  treeKinds: string[];
  exits: { trigger: Trigger; spawnName: string; spawn: { x: number; y: number; dir: "up" | "down" | "side" } }[];
  decor?: string[];
  bushKinds?: string[];
  ambient?: number;
  extra?: (o: Outdoor) => void;
}

/** Woodland-floor dressing (under the canopy): ferns, fungi, tufts. */
const UNDERGROWTH = ["fern", "grass_tuft_a", "grass_tuft_b", "mushroom_a", "grass_tuft_a", "sprout", "pebble_a"];

/**
 * Renders a generated forest (game/procgen/forestGenerator):
 *
 *  - dense thicket: solid, wall-to-wall trees, graded so canopies never
 *    bury a walkable edge (hedges, then big bushes, then trees)
 *  - open woodland: walkable darker floor, scattered trunks you weave
 *    between (each with a trunk collider), ferns and fungi
 *  - clearings: bright meadow grass, flowers, the odd bush or boulder
 *  - trails: dirt (or cobble in the grove) winding between them
 */
export function buildWoods(game: Game, cfg: WoodsConfig): Area {
  const L = cfg.layout;
  const cols = L.cols;
  const rows = L.rows;
  const o = new Outdoor(game, cfg.id, cols, rows, cfg.seed);
  const t = o.terrain;
  // One grass for the whole floor: the tileset has no grass/darkgrass
  // transition, so mixing them shows hard square patches.
  const floor: TerrainType = cfg.ground;
  const idx = (x: number, y: number) => y * cols + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = idx(x, y);
      t.set(x, y, L.trail[i] ? cfg.trail : floor);
    }
  t.smooth();

  const isWalk = (x: number, y: number) => inMap(x, y) && L.walk[idx(x, y)] === 1;

  // Nodes first so trees leave room around them.
  for (const [id, x, y] of L.nodes) o.node(id, x, y);
  cfg.extra?.(o);

  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!isWalk(x, y)) o.area.collision.setSolidCell(x, y);

  // ---- dense thicket ---------------------------------------------------------------------------
  // A canopy rises ~7 tiles above its trunk, so vegetation is graded by how
  // close walkable ground is *above* it.
  const clearAbove = (x: number, y: number) => {
    for (let dy = 1; dy <= 9; dy++) for (let dx = -2; dx <= 2; dx++) if (isWalk(x + dx, y - dy)) return dy;
    return 99;
  };
  const tallKinds = cfg.treeKinds;
  const shortKinds = cfg.treeKinds.filter((k) => !k.includes("tall"));
  const hedge = cfg.bushKinds?.filter((k) => k.startsWith("bush")) ?? ["bush_green", "bush_lime", "bush_olive"];
  const bigHedge = cfg.id === "deep_forest" ? ["bush_large_autumn", "tree_pine_small"] : ["bush_large", "tree_pine_small", "bush_large"];
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = 0; x < cols; x++) {
      if (isWalk(x, y) || o.occupied(x, y)) continue;
      const odd = (x + y * 3) % 2 === 0;
      const gap = clearAbove(x, y);
      const edgeSide = isWalk(x - 1, y) || isWalk(x + 1, y) || isWalk(x, y + 1);
      if (gap <= 2) {
        if (odd || edgeSide) o.shrub(o.rng.pick(hedge), x, y);
      } else if (gap <= 5) {
        if (odd) o.shrub(o.rng.pick(bigHedge), x, y);
      } else if (gap <= 8) {
        if (odd) o.tree(o.rng.pick(shortKinds), x, y);
      } else if (odd || (edgeSide && o.rng.bool(0.5))) {
        if (!(o.rng.bool(0.1) && !edgeSide)) o.tree(o.rng.pick(tallKinds), x, y);
      }
    }
  }

  // ---- open woodland: trunks you can walk between -------------------------------------------------
  for (const [x, y] of L.woodTrees) {
    if (o.occupied(x, y)) continue;
    o.tree(o.rng.pick(o.rng.bool(0.7) ? shortKinds : tallKinds), x, y);
  }

  for (const e of cfg.exits) {
    o.area.trigger(e.trigger);
    o.area.spawns[e.spawnName] = e.spawn;
  }
  if (!o.area.spawns.default) o.area.spawns.default = cfg.exits[0].spawn;

  // ---- dressing -------------------------------------------------------------------------------------
  const decor = cfg.decor ?? UNDERGROWTH;
  const bushes = cfg.bushKinds ?? ["bush_green", "bush_lime", "rock_small", "log_pile"];
  // Meadows: flowers and tufts, a bush or a boulder.
  for (const c of L.clearings) {
    const region = { x: c.x - c.rx, y: c.y - c.ry, w: c.rx * 2, h: c.ry * 2 };
    o.scatter(region, Math.round(c.rx * c.ry * 0.7), decor);
    o.scatter(region, Math.max(1, Math.round((c.rx * c.ry) / 16)), bushes, true);
  }
  // Under the canopy: undergrowth, fallen logs, mossy rocks — only on open floor.
  const openScatter = (count: number, kinds: string[], colliders: boolean) => {
    let placed = 0;
    for (let k = 0; k < count * 8 && placed < count; k++) {
      const x = o.rng.int(2, cols - 3);
      const y = o.rng.int(2, rows - 3);
      if (!L.open[idx(x, y)]) continue;
      const before = o.area.entities.length;
      o.scatter({ x, y, w: 1, h: 1 }, 1, kinds, colliders);
      if (o.area.entities.length > before) placed++;
    }
  };
  const openCells = L.open.reduce((n, v) => n + v, 0);
  openScatter(Math.round(openCells * 0.12), UNDERGROWTH, false);
  openScatter(Math.round(openCells * 0.015), [...bushes, "log_long", "rock_medium"], true);
  // Trail verges: tufts and pebbles.
  o.scatter({ x: 1, y: 1, w: cols - 2, h: rows - 2 }, Math.round(cols * rows * 0.02), decor);

  if (cfg.ambient !== undefined) o.area.ambient = cfg.ambient;
  return o.finish({ ground: floor, trees: cfg.treeKinds });
}
