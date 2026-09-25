import { Texture } from "pixi.js";

/** Multiply levels written into the vision texture. */
const SEEN_NOW = 255;
const REMEMBERED = 110;
const UNSEEN = 0;

/**
 * Line-of-sight fog for tile maps (dungeon floors).
 *
 * Each tile is one texel of a tiny canvas texture: in view, remembered, or
 * never seen. The Lighting pass multiplies it into its world-pixel buffer
 * with linear filtering, so edges come out as soft gradients that still step
 * in whole art pixels. Walls stop sight (and therefore light), which is what
 * makes the dark read as fog instead of a circle cut into rectangles.
 */
export class VisionMap {
  readonly texture: Texture;
  /** World pixels per tile. */
  readonly cell: number;
  /** Dark margin around the map, wide enough to cover whatever the camera
   * shows past the edge (otherwise the lantern lights the void there). */
  readonly border = 40;
  private readonly w: number;
  private readonly h: number;
  private readonly opaque: (x: number, y: number) => boolean;
  private readonly seen: Uint8Array;
  private readonly visible: Uint8Array;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private lastKey = "";

  constructor(w: number, h: number, cell: number, opaque: (x: number, y: number) => boolean) {
    this.w = w;
    this.h = h;
    this.cell = cell;
    this.opaque = opaque;
    this.seen = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
    this.canvas = document.createElement("canvas");
    this.canvas.width = w + this.border * 2;
    this.canvas.height = h + this.border * 2;
    this.ctx = this.canvas.getContext("2d")!;
    this.img = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    for (let i = 3; i < this.img.data.length; i += 4) this.img.data[i] = 255;
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "linear";
  }

  /** Has the player ever seen this tile? (Unseen lights stay hidden.) */
  seenAt(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.seen[ty * this.w + tx] === 1;
  }

  /** Recompute sight from a world position. Cheap no-op unless the eye moved
   * to another tile or the radius changed. */
  update(wx: number, wy: number, radiusTiles: number): void {
    const ex = Math.floor(wx / this.cell);
    const ey = Math.floor(wy / this.cell);
    const r = Math.ceil(radiusTiles);
    const key = `${ex},${ey},${r}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.visible.fill(0);
    const { w, h } = this;
    const mark = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      this.visible[y * w + x] = 1;
      this.seen[y * w + x] = 1;
    };
    // Ray to every cell centre in range; sight stops at the first opaque cell
    // (which is itself visible: you see the wall, not what's behind it).
    for (let ty = ey - r; ty <= ey + r; ty++)
      for (let tx = ex - r; tx <= ex + r; tx++) {
        const dx = tx - ex;
        const dy = ty - ey;
        if (dx * dx + dy * dy > r * r) continue;
        if (this.lineOfSight(ex, ey, tx, ty)) mark(tx, ty);
      }
    // Walls are drawn up to three tiles tall above the floor they stand on,
    // and every wall edge has a rim: reveal those along with the floor.
    for (let ty = ey - r; ty <= ey + r; ty++)
      for (let tx = ex - r; tx <= ex + r; tx++) {
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        if (!this.visible[ty * w + tx] || this.opaque(tx, ty)) continue;
        for (let k = 1; k <= 3 && this.opaque(tx, ty - k); k++) mark(tx, ty - k);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (this.opaque(tx + ox, ty + oy)) mark(tx + ox, ty + oy);
      }
    this.redraw();
  }

  /** Walk the segment between cell centres in small steps. Diagonal gaps
   * between two opaque cells don't let sight through. */
  private lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 3;
    let px = x0;
    let py = y0;
    for (let i = 1; i < steps; i++) {
      const cx = Math.floor(x0 + 0.5 + (dx * i) / steps);
      const cy = Math.floor(y0 + 0.5 + (dy * i) / steps);
      if (cx === x1 && cy === y1) return true;
      if (cx !== px || cy !== py) {
        if (this.opaque(cx, cy)) return false;
        if (cx !== px && cy !== py && this.opaque(cx, py) && this.opaque(px, cy)) return false;
        px = cx;
        py = cy;
      }
    }
    return true;
  }

  private redraw(): void {
    const data = this.img.data;
    const cw = this.canvas.width;
    const b = this.border;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const v = this.visible[i] ? SEEN_NOW : this.seen[i] ? REMEMBERED : UNSEEN;
        const o = ((y + b) * cw + (x + b)) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
      }
    this.ctx.putImageData(this.img, 0, 0);
    this.texture.source.update();
  }

  destroy(): void {
    this.texture.destroy(true);
  }
}
