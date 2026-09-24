import { Container, Sprite, type Renderer, type Texture } from "pixi.js";
import { TILESETS } from "../../data/assets";
import { SeededRandom } from "../../game/core/rng";
import { TILE } from "../../game/core/constants";
import { tile } from "../textures";

/**
 * Ground terrain for outdoor areas.
 *
 * Pixel Crawler's floor sheet is laid out as "hole" autotiles: each terrain
 * block has a 5x5 ring template where the terrain surrounds a transparent
 * 3x3 hole, plus solid fill tiles. So paths are drawn as the *base* layer and
 * grass is laid on top, using the ring pieces to give every grass/path
 * boundary its ragged, hand-drawn edge.
 */

export type TerrainType = "grass" | "darkgrass" | "dirt" | "cobble";

const BLOCK_X: Record<TerrainType, number> = { grass: 0, darkgrass: 0, dirt: 10, cobble: 5 };
const isGrass = (t: TerrainType) => t === "grass" || t === "darkgrass";

export class TerrainGrid {
  readonly cells: TerrainType[];
  readonly w: number;
  readonly h: number;

  constructor(
    w: number,
    h: number,
    fill: TerrainType = "grass",
  ) {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: w * h }, () => fill);
  }

  get(x: number, y: number): TerrainType {
    x = Math.max(0, Math.min(this.w - 1, x));
    y = Math.max(0, Math.min(this.h - 1, y));
    return this.cells[y * this.w + x];
  }

  set(x: number, y: number, t: TerrainType): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = t;
  }

  rect(x: number, y: number, w: number, h: number, t: TerrainType): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, t);
    return this;
  }

  /** A path of the given width through waypoints (axis-aligned segments). */
  path(points: [number, number][], width: number, t: TerrainType): this {
    const half = Math.floor(width / 2);
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const minX = Math.min(x0, x1) - half;
      const minY = Math.min(y0, y1) - half;
      this.rect(minX, minY, Math.abs(x1 - x0) + width, Math.abs(y1 - y0) + width, t);
    }
    return this;
  }

  /** Rough blob (for clearings / dark patches). */
  blob(cx: number, cy: number, rx: number, ry: number, t: TerrainType, rng: SeededRandom): this {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++)
      for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 0.85 + rng.float(0, 0.3)) this.set(x, y, t);
      }
    return this;
  }

  private smoothed = false;

  /** Converts grass slivers into path so every remaining grass edge has an
   * autotile piece. Idempotent. */
  smooth(): void {
    if (this.smoothed) return;
    this.smoothed = true;
    // 1-wide grass slivers (path on opposite sides) can cascade safely.
    for (let pass = 0; pass < 4; pass++) {
      if (!this.convert((n) => (!isGrass(n[0]) && !isGrass(n[2])) || (!isGrass(n[1]) && !isGrass(n[3])))) break;
    }
    // Convex grass corners (path on two adjacent sides) convert once, judged
    // against a snapshot — iterating this would flood whole regions.
    this.convert((n) => n.filter((c) => !isGrass(c)).length >= 2);
  }

  private convert(test: (n: TerrainType[]) => boolean): boolean {
    const snapshot = [...this.cells];
    const at = (x: number, y: number) => snapshot[Math.max(0, Math.min(this.h - 1, y)) * this.w + Math.max(0, Math.min(this.w - 1, x))];
    let changed = false;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!isGrass(at(x, y))) continue;
        const n = [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)];
        if (!test(n)) continue;
        this.set(x, y, n.find((c) => !isGrass(c))!);
        changed = true;
      }
    return changed;
  }
}

function fill(type: TerrainType, rng: SeededRandom): Texture {
  const bx = BLOCK_X[type];
  // Row 10 holds the base fills; row 11 is a darker set (used for dark grass).
  const row = type === "darkgrass" ? 11 : 10;
  return tile(TILESETS.floors, bx + rng.int(1, 3), row);
}

function ring(tx: number, ty: number, variant: number): Texture {
  return tile(TILESETS.floors, tx, ty + variant * 5);
}

export function buildTerrain(grid: TerrainGrid, renderer: Renderer, seed = "terrain"): Container {
  grid.smooth();
  const rng = SeededRandom.fromString(seed);
  const layer = new Container();
  const add = (t: Texture, x: number, y: number) => {
    const s = new Sprite(t);
    s.position.set(x * TILE, y * TILE);
    layer.addChild(s);
  };

  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const t = grid.get(x, y);
      const N = grid.get(x, y - 1);
      const S = grid.get(x, y + 1);
      const E = grid.get(x + 1, y);
      const W = grid.get(x - 1, y);
      const v = rng.bool(0.5) ? 1 : 0;

      if (!isGrass(t)) {
        add(fill(t, rng), x, y);
        // Grass fringes creeping onto the path.
        const gN = isGrass(N);
        const gS = isGrass(S);
        const gE = isGrass(E);
        const gW = isGrass(W);
        if (gN && gW) add(ring(1, 1, v), x, y);
        if (gN && gE) add(ring(3, 1, v), x, y);
        if (gS && gW) add(ring(1, 3, v), x, y);
        if (gS && gE) add(ring(3, 3, v), x, y);
        if (gN && !gW && !gE) add(ring(2, 1, v), x, y);
        if (gS && !gW && !gE) add(ring(2, 3, v), x, y);
        if (gW && !gN && !gS) add(ring(1, 2, v), x, y);
        if (gE && !gN && !gS) add(ring(3, 2, v), x, y);
        continue;
      }

      const pN = !isGrass(N);
      const pS = !isGrass(S);
      const pE = !isGrass(E);
      const pW = !isGrass(W);
      if (!pN && !pS && !pE && !pW) {
        add(fill(t, rng), x, y);
        continue;
      }
      // Edge grass: path underneath, cut grass on top.
      const under = pN ? N : pS ? S : pE ? E : W;
      add(fill(under, rng), x, y);
      if (pS) {
        const l = isGrass(grid.get(x - 1, y + 1));
        const r = isGrass(grid.get(x + 1, y + 1));
        add(ring(l && !r ? 1 : r && !l ? 3 : 2, 0, v), x, y);
      } else if (pN) {
        const l = isGrass(grid.get(x - 1, y - 1));
        const r = isGrass(grid.get(x + 1, y - 1));
        add(ring(l && !r ? 1 : r && !l ? 3 : 2, 4, v), x, y);
      } else if (pE) {
        const u = isGrass(grid.get(x + 1, y - 1));
        const d = isGrass(grid.get(x + 1, y + 1));
        add(ring(0, u && !d ? 1 : d && !u ? 3 : 2, v), x, y);
      } else if (pW) {
        const u = isGrass(grid.get(x - 1, y - 1));
        const d = isGrass(grid.get(x - 1, y + 1));
        add(ring(4, u && !d ? 1 : d && !u ? 3 : 2, v), x, y);
      }
    }
  }

  // Bake thousands of tile sprites into one texture.
  const baked = renderer.generateTexture({ target: layer, resolution: 1, antialias: false });
  baked.source.scaleMode = "nearest";
  layer.destroy({ children: true });
  const out = new Container();
  out.addChild(new Sprite(baked));
  return out;
}
