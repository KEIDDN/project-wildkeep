import { Area } from "../Area";
import type { Game } from "../../Game";
import { TerrainGrid, buildTerrain, type TerrainType } from "../Terrain";
import { Prop } from "../../entities/Props";
import { tex } from "../../textures";
import { SeededRandom } from "../../../game/core/rng";
import { TILE } from "../../../game/core/constants";
import { ResourceNode } from "../../entities/ResourceNode";
import { propPath, propSize } from "../../../data/assets";

/** Depth (tiles) of the decorative band around outdoor maps. Wider than
 * half the widest view so the camera never needs to stop short of it. */
const SURROUND_TILES = 10;

/** Multiply tint for decorative (non-harvestable) trees. */
const SCENERY_TINT = 0xdce4dc;

/** Trunk colliders for decorative trees (feet box at the base). */
const TREE_TRUNK: Record<string, { w: number; h: number }> = {
  tree_oak: { w: 14, h: 8 },
  tree_oak_autumn: { w: 14, h: 8 },
  tree_oak_gold: { w: 14, h: 8 },
  tree_oak_dead: { w: 12, h: 7 },
  tree_small: { w: 10, h: 6 },
  tree_pine: { w: 12, h: 7 },
  tree_pine_dark: { w: 12, h: 7 },
  tree_pine_small: { w: 10, h: 6 },
  tree_tall: { w: 10, h: 6 },
  tree_tall_autumn: { w: 10, h: 6 },
};

const SMALL_DECOR = [
  "flower_red",
  "flower_white",
  "flower_blue",
  "flower_yellow",
  "flower_red_b",
  "flower_white_b",
  "flower_blue_b",
  "flower_yellow_b",
  "grass_tuft_a",
  "grass_tuft_b",
  "grass_tuft_a",
  "grass_tuft_b",
];

/**
 * Outdoor map scaffolding: terrain grid + an occupancy grid so hand-placed
 * landmarks and procedurally scattered dressing never overlap, and every
 * placement registers its collision alongside its sprite.
 */
export class Outdoor {
  readonly area: Area;
  readonly terrain: TerrainGrid;
  readonly rng: SeededRandom;
  readonly seed: string;
  private occ: Uint8Array;

  readonly game: Game;
  readonly cols: number;

  readonly rows: number;

  constructor(
    game: Game,
    id: Area["id"],
    cols: number,
    rows: number,
    seed: string,
  ) {
    this.game = game;
    this.cols = cols;

    this.rows = rows;
    this.area = new Area(id, cols * TILE, rows * TILE);
    this.terrain = new TerrainGrid(cols, rows);
    this.seed = seed;
    this.rng = SeededRandom.fromString(seed);
    this.occ = new Uint8Array(cols * rows);
  }

  occupied(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.occ[ty * this.cols + tx] === 1;
  }

  reserve(tx: number, ty: number, w = 1, h = 1): void {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.occ[y * this.cols + x] = 1;
  }

  isPath(tx: number, ty: number): boolean {
    const t = this.terrain.get(tx, ty);
    return t === "dirt" || t === "cobble";
  }

  freeArea(tx: number, ty: number, w: number, h: number, allowPath = false): boolean {
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) if (this.occupied(x, y) || (!allowPath && this.isPath(x, y))) return false;
    return true;
  }

  /** Decorative (non-gatherable) tree with a trunk collider; base at tile center-bottom. */
  tree(kind: string, tx: number, ty: number, jitter = true): void {
    const x = tx * TILE + TILE / 2 + (jitter ? this.rng.int(-4, 4) : 0);
    const y = ty * TILE + TILE - 2 + (jitter ? this.rng.int(-3, 3) : 0);
    // Scenery trees are a shade quieter than harvestable ones (which also
    // twinkle), so the eye goes to what you can use.
    const p = this.area.prop(kind, x, y, { collider: TREE_TRUNK[kind] ?? { w: 12, h: 7 }, tint: SCENERY_TINT });
    p.fadeBehind = true;
    this.reserve(tx - 1, ty - 1, 3, 2);
  }

  /** Bush / small tree used as a low hedge along walkable edges. */
  shrub(kind: string, tx: number, ty: number): void {
    const x = tx * TILE + TILE / 2 + this.rng.int(-3, 3);
    const y = ty * TILE + TILE - 2 + this.rng.int(-2, 2);
    const p = this.area.prop(kind, x, y, { collider: { w: 14, h: 6 } });
    if (kind.startsWith("tree")) p.fadeBehind = true;
    this.reserve(tx, ty);
  }

  /** Dense tree cover over a tile region; the region also becomes solid so
   * there are no sneaky gaps between trunks along map borders. */
  forestWall(x0: number, y0: number, w: number, h: number, kinds: string[], opts: { solid?: boolean; spacing?: number } = {}): void {
    const spacing = opts.spacing ?? 2;
    for (let y = y0 + h - 1; y >= y0; y -= spacing - (this.rng.bool(0.3) ? 1 : 0)) {
      for (let x = x0 + (y % 2); x < x0 + w; x += spacing) {
        if (this.occupied(x, y) || this.isPath(x, y)) continue;
        this.tree(this.rng.pick(kinds), x, y);
      }
    }
    if (opts.solid !== false) this.area.solidCells(x0, y0, w, h);
  }

  /** Gatherable resource node at a tile. */
  node(defId: string, tx: number, ty: number): void {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE - 2;
    // The seed is part of the key: forests regrow in new places each day.
    this.area.add(new ResourceNode(x, y, defId, `${this.seed}:${defId}:${tx},${ty}`, this.area));
    this.reserve(tx - 1, ty - 1, 3, 2);
  }

  /** Small prop with optional feet collider. */
  prop(id: string, tx: number, ty: number, collider?: { w: number; h: number }, opts: { dx?: number; dy?: number; flat?: boolean } = {}): void {
    const x = tx * TILE + TILE / 2 + (opts.dx ?? 0);
    const y = ty * TILE + TILE - 1 + (opts.dy ?? 0);
    const p = this.area.prop(id, x, y, { collider, flat: opts.flat });
    // Street lamps glow once the sun goes down (lights only show in the dark).
    if (id === "lamp_post") p.withLight({ radius: 58, color: 0xffc77a, intensity: 0.9, dy: -30, flicker: 0.4, flare: true });
    const size = propSize(id);
    this.reserve(tx, ty, Math.max(1, Math.ceil(size.w / TILE)), 1);
  }

  /** Scatter flowers, tufts, pebbles and bushes into free grass. */
  scatter(region: { x: number; y: number; w: number; h: number }, count: number, kinds: string[] = SMALL_DECOR, colliders = false): void {
    let placed = 0;
    for (let t = 0; t < count * 6 && placed < count; t++) {
      const tx = this.rng.int(region.x, region.x + region.w - 1);
      const ty = this.rng.int(region.y, region.y + region.h - 1);
      if (this.occupied(tx, ty) || this.isPath(tx, ty)) continue;
      const kind = this.rng.pick(kinds);
      const big = kind.startsWith("bush") || kind.startsWith("rock") || kind === "log_pile" || kind === "dead_tree";
      const x = tx * TILE + this.rng.int(2, 14);
      const y = ty * TILE + this.rng.int(8, 15);
      this.area.prop(kind, x, y, { flat: !big, collider: colliders && big ? { w: Math.min(22, propSize(kind).w - 6), h: 7 } : undefined });
      if (big) this.reserve(tx - 1, ty, 3, 1);
      else this.reserve(tx, ty);
      placed++;
    }
  }

  /**
   * Bakes the terrain and wraps the map in a decorative surround: the ground
   * continues past the edge (roads keep going where there's an exit) under a
   * dense band of trees. None of it is walkable — the map's own border still
   * stops you — but the camera may show it, so it can keep the player centred
   * right up to the edge of the world without ever revealing the void.
   */
  finish(opts: { ground?: TerrainType; trees?: string[]; margin?: number } = {}): Area {
    const M = opts.margin ?? SURROUND_TILES;
    const ground = opts.ground ?? "grass";
    const trees = opts.trees ?? ["tree_oak", "tree_pine", "tree_oak_autumn", "tree_tall", "tree_pine"];
    this.terrain.smooth();

    // Exits: roads may run out of the map only here.
    const exitBands = this.area.triggers.map((t) => ({
      x0: Math.floor(t.rect.x / TILE) - 2,
      y0: Math.floor(t.rect.y / TILE) - 2,
      x1: Math.floor((t.rect.x + t.rect.w) / TILE) + 2,
      y1: Math.floor((t.rect.y + t.rect.h) / TILE) + 2,
    }));
    const nearExit = (x: number, y: number) => exitBands.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);

    const W = this.cols + M * 2;
    const H = this.rows + M * 2;
    const ext = new TerrainGrid(W, H, ground);
    const outside = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ix = x - M;
        const iy = y - M;
        const inside = ix >= 0 && iy >= 0 && ix < this.cols && iy < this.rows;
        if (inside) {
          ext.set(x, y, this.terrain.get(ix, iy));
          continue;
        }
        outside[y * W + x] = 1;
        const cx = Math.max(0, Math.min(this.cols - 1, ix));
        const cy = Math.max(0, Math.min(this.rows - 1, iy));
        const edge = this.terrain.get(cx, cy);
        const isRoad = edge === "dirt" || edge === "cobble";
        ext.set(x, y, isRoad && nearExit(cx, cy) ? edge : ground);
      }

    const terrain = buildTerrain(ext, this.game.app.renderer, `${this.area.id}-terrain`);
    terrain.position.set(-M * TILE, -M * TILE);
    // Under anything already painted on the ground (picnic cloths, burrows).
    this.area.ground.addChildAt(terrain, 0);

    // Tree band: staggered rows, denser than the playable forest walls.
    const rng = SeededRandom.fromString(`${this.seed}:surround`);
    for (let y = 0; y < H; y++)
      for (let x = (y % 2) as number; x < W; x += 2) {
        if (!outside[y * W + x]) continue;
        const t = ext.get(x, y);
        if (t === "dirt" || t === "cobble") continue;
        const ix = x - M;
        const iy = y - M;
        // Keep the mouth of each exit road clear.
        if (nearExit(Math.max(0, Math.min(this.cols - 1, ix)), Math.max(0, Math.min(this.rows - 1, iy))) && (ix < 0 || ix >= this.cols) === (iy >= 0 && iy < this.rows)) continue;
        if (rng.bool(0.12)) continue;
        const px = ix * TILE + TILE / 2 + rng.int(-5, 5);
        const py = iy * TILE + TILE - 2 + rng.int(-4, 4);
        this.area.add(new Prop(px, py, tex(propPath(rng.pick(trees))), { tint: 0xc8d0c8 }));
      }
    this.area.viewBounds = { x: -M * TILE, y: -M * TILE, w: W * TILE, h: H * TILE };
    this.area.bakeDecals(this.game.app.renderer, { x: 0, y: 0, w: this.cols * TILE, h: this.rows * TILE });
    // The surround adds a lot of sprites; only draw what's on screen.
    this.area.cull = true;
    return this.area;
  }
}

export { SMALL_DECOR };
