import { Graphics, Sprite, Texture } from "pixi.js";
import { Entity, type Interactable } from "./Entity";
import type { Game } from "../Game";
import type { Area } from "../world/Area";
import { TILE } from "../../game/core/constants";
import { hasRod } from "../../game/fishing";
import { SeededRandom } from "../../game/core/rng";
import { t } from "../../i18n";

/** Water palette, taken from Pixel Crawler's water tiles so it sits with the art. */
const WATER = [0x3e, 0x92, 0xd1];
const WATER_SHADE = [0x41, 0x85, 0xca];
const DEEP = [0x3b, 0x7e, 0xc2];
const FOAM = [0xa3, 0xc8, 0xee];
const FOAM_MID = [0x7b, 0xaa, 0xdb];
const MUD = [0x9f, 0x6c, 0x3f];
const MUD_DARK = [0x86, 0x59, 0x32];
const MUD_DEEP = [0x6c, 0x43, 0x26];
const PLANK = [0x9a, 0x6a, 0x3e];
const PLANK_DARK = [0x6a, 0x44, 0x26];

export interface LakeShape {
  /** Ellipses in tiles (centre + radii) whose union is the water. */
  blobs: { cx: number; cy: number; rx: number; ry: number }[];
  /** A wooden pier (tiles) that's walkable over the water. */
  pier?: { x: number; y: number; w: number; h: number };
  seed: string;
}

/**
 * A body of water: a baked pixel-art texture (wobbly shoreline, mud rim,
 * foam line, deeper middle), solid water tiles, twinkling glints, and one
 * interaction — fish wherever you're facing open water.
 */
export class Lake extends Entity implements Interactable {
  interactRadius = 10;
  interactPriority = 3;
  private readonly shape: LakeShape;
  private readonly texture: Texture;
  private readonly glints = new Graphics();
  private glintT = 0;
  private readonly rng: SeededRandom;
  private readonly bounds: { x: number; y: number; w: number; h: number };
  private readonly noise: (x: number, y: number) => number;
  /** Where the line would land, if you're facing water. */
  private spot: { x: number; y: number } | null = null;
  private ix = -1e6;
  private iy = -1e6;

  constructor(area: Area, shape: LakeShape) {
    super(0, 0);
    this.shape = shape;
    this.rng = SeededRandom.fromString(shape.seed);
    const r = this.rng;
    const wob = Array.from({ length: 64 }, () => r.next());
    this.noise = (x, y) => {
      const a = wob[(Math.floor(x / 9) * 7 + Math.floor(y / 7) * 13) & 63];
      const b = wob[(Math.floor(x / 4) * 5 + Math.floor(y / 5) * 11 + 17) & 63];
      return a * 0.7 + b * 0.3;
    };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const b of shape.blobs) {
      x0 = Math.min(x0, (b.cx - b.rx - 1) * TILE);
      y0 = Math.min(y0, (b.cy - b.ry - 1) * TILE);
      x1 = Math.max(x1, (b.cx + b.rx + 1) * TILE);
      y1 = Math.max(y1, (b.cy + b.ry + 1) * TILE);
    }
    this.bounds = { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
    this.texture = this.bake();
    const sprite = new Sprite(this.texture);
    sprite.position.set(this.bounds.x, this.bounds.y);
    area.ground.addChild(sprite, this.glints);
    this.view.visible = false;

    // Water tiles are solid (the shoreline itself stays walkable).
    for (let ty = Math.floor(y0 / TILE); ty <= Math.ceil(y1 / TILE); ty++)
      for (let tx = Math.floor(x0 / TILE); tx <= Math.ceil(x1 / TILE); tx++) {
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        if (this.depth(cx, cy) > 5 && !this.onPier(cx, cy)) area.collision.setSolidCell(tx, ty);
      }
  }

  /** How far inside the water a world pixel is (≤ 0 = dry land). */
  depth(px: number, py: number): number {
    let best = -Infinity;
    for (const b of this.shape.blobs) {
      const dx = (px / TILE - b.cx) / b.rx;
      const dy = (py / TILE - b.cy) / b.ry;
      const d = 1 - Math.sqrt(dx * dx + dy * dy);
      best = Math.max(best, d * Math.min(b.rx, b.ry) * TILE);
    }
    return best + (this.noise(px, py) - 0.5) * 7;
  }

  onPier(px: number, py: number): boolean {
    const p = this.shape.pier;
    return !!p && px >= p.x * TILE && px < (p.x + p.w) * TILE && py >= p.y * TILE && py < (p.y + p.h) * TILE;
  }

  isWater(px: number, py: number): boolean {
    return this.depth(px, py) > 2 && !this.onPier(px, py);
  }

  private bake(): Texture {
    const { x: bx, y: by, w, h } = this.bounds;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    const px = img.data;
    const r = SeededRandom.fromString(`${this.shape.seed}:px`);
    const put = (x: number, y: number, c: number[], a = 255) => {
      const i = (y * w + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = a;
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const wx = bx + x;
        const wy = by + y;
        const d = this.depth(wx, wy);
        if (this.onPier(wx, wy)) {
          // Planks run across, with dark gaps and posts at the corners.
          const ly = wy - this.shape.pier!.y * TILE;
          const lx = wx - this.shape.pier!.x * TILE;
          const gap = ly % 5 === 4;
          const edge = lx < 1 || lx >= this.shape.pier!.w * TILE - 1;
          put(x, y, gap || edge ? PLANK_DARK : PLANK);
          continue;
        }
        if (d <= -3) continue;
        if (d <= 0) {
          // Mud rim on the land side.
          put(x, y, d > -1 ? MUD_DARK : r.bool(0.18) ? MUD_DEEP : MUD, d > -1.5 ? 255 : 200);
        } else if (d < 1.5) put(x, y, FOAM);
        else if (d < 3) put(x, y, FOAM_MID);
        else put(x, y, d > 26 ? DEEP : d > 18 ? WATER_SHADE : WATER);
      }
    // Little wave marks: short light dashes scattered over open water.
    for (let i = 0; i < (w * h) / 180; i++) {
      const x = Math.floor(r.next() * (w - 4));
      const y = Math.floor(r.next() * h);
      const d = this.depth(bx + x, by + y);
      if (d < 6 || this.onPier(bx + x, by + y)) continue;
      const len = 2 + Math.floor(r.next() * 3);
      for (let k = 0; k < len; k++) put(x + k, y, d > 18 ? WATER : FOAM_MID);
    }
    ctx.putImageData(img, 0, 0);
    const texture = Texture.from(canvas);
    texture.source.scaleMode = "nearest";
    return texture;
  }

  get interactX() {
    return this.ix;
  }

  get interactY() {
    return this.iy;
  }

  update(dt: number, game: Game): void {
    // Glints: a few bright pixels that come and go.
    this.glintT -= dt;
    if (this.glintT <= 0) {
      this.glintT = 0.18;
      const g = this.glints.clear();
      const { x, y, w, h } = this.bounds;
      for (let i = 0; i < 26; i++) {
        const gx = Math.floor(x + Math.random() * w);
        const gy = Math.floor(y + Math.random() * h);
        if (this.depth(gx, gy) < 6 || this.onPier(gx, gy)) continue;
        g.rect(gx, gy, 2 + Math.floor(Math.random() * 2), 1).fill({ color: 0xd8ecff, alpha: 0.7 });
      }
    }
    // Facing open water? Then this is where the line lands.
    const p = game.player;
    const f = p.facingVector();
    this.spot = null;
    for (const reach of [14, 22, 30]) {
      const sx = p.x + f.x * reach;
      const sy = p.y - 2 + f.y * reach;
      if (this.isWater(sx, sy)) {
        this.spot = { x: sx, y: sy };
        break;
      }
    }
    if (this.spot) {
      this.ix = p.x + f.x * 6;
      this.iy = p.y + f.y * 6;
    } else {
      this.ix = this.iy = -1e6;
    }
  }

  prompt() {
    if (!this.spot) return null;
    return hasRod() ? { verb: t("fish.cast"), target: t("fish.water") } : { verb: t("fish.cast"), target: t("fish.water"), blocked: t("fish.needRod") };
  }

  interact(game: Game) {
    if (!this.spot || !hasRod()) return;
    game.player.startFishing(game, this.spot.x, this.spot.y);
  }

  destroy(): void {
    this.texture.destroy(true);
    super.destroy();
  }
}
