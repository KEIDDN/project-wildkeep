import type { Rect } from "../game/core/types";

/**
 * World collision, independent of rendering:
 *
 *   visual sprite  --(authored data)-->  collision grid / rects  -->  movement
 *
 * A coarse cell grid covers terrain (map edges, dungeon walls, interior
 * walls), and axis-aligned rects cover placed objects (buildings, trees,
 * rocks, furniture). Rects can be removed at runtime, e.g. when a tree is cut
 * down. Entities collide using a small box around their feet.
 */
export class CollisionWorld {
  readonly cols: number;
  readonly rows: number;
  private solid: Uint8Array;
  private rects = new Map<number, Rect>();
  private nextRectId = 1;
  // Spatial hash of rects so queries stay cheap on big maps.
  private buckets = new Map<string, Set<number>>();
  private static readonly BUCKET = 64;

  readonly width: number;
  readonly height: number;
  readonly cell: number;

  constructor(
    width: number,
    height: number,
    cell = 16,
  ) {
    this.width = width;
    this.height = height;
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.solid = new Uint8Array(this.cols * this.rows);
  }

  setSolidCell(cx: number, cy: number, solid = true): void {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    this.solid[cy * this.cols + cx] = solid ? 1 : 0;
  }

  isSolidCell(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.solid[cy * this.cols + cx] === 1;
  }

  addRect(r: Rect): number {
    const id = this.nextRectId++;
    this.rects.set(id, r);
    this.forBuckets(r, (key) => {
      let set = this.buckets.get(key);
      if (!set) this.buckets.set(key, (set = new Set()));
      set.add(id);
    });
    return id;
  }

  removeRect(id: number): void {
    const r = this.rects.get(id);
    if (!r) return;
    this.forBuckets(r, (key) => this.buckets.get(key)?.delete(id));
    this.rects.delete(id);
  }

  private forBuckets(r: Rect, fn: (key: string) => void) {
    const B = CollisionWorld.BUCKET;
    for (let by = Math.floor(r.y / B); by <= Math.floor((r.y + r.h) / B); by++)
      for (let bx = Math.floor(r.x / B); bx <= Math.floor((r.x + r.w) / B); bx++) fn(`${bx},${by}`);
  }

  /** Does this box overlap anything solid? */
  blocked(box: Rect): boolean {
    if (box.x < 0 || box.y < 0 || box.x + box.w > this.width || box.y + box.h > this.height) return true;
    const c = this.cell;
    const x0 = Math.floor(box.x / c);
    const y0 = Math.floor(box.y / c);
    const x1 = Math.floor((box.x + box.w - 0.001) / c);
    const y1 = Math.floor((box.y + box.h - 0.001) / c);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (this.isSolidCell(cx, cy)) return true;

    const seen = new Set<number>();
    let hit = false;
    this.forBuckets(box, (key) => {
      if (hit) return;
      for (const id of this.buckets.get(key) ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const r = this.rects.get(id)!;
        if (box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y) {
          hit = true;
          return;
        }
      }
    });
    return hit;
  }

  /**
   * Moves a feet box (centered on x, bottom at y) by (dx, dy), resolving each
   * axis separately so you slide along walls. When blocked head-on near a
   * corner, nudges sideways so doorways and gaps are easy to enter.
   */
  move(x: number, y: number, w: number, h: number, dx: number, dy: number): { x: number; y: number; hitX: boolean; hitY: boolean } {
    const boxAt = (px: number, py: number): Rect => ({ x: px - w / 2, y: py - h, w, h });
    let hitX = false;
    let hitY = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        if (!this.blocked(boxAt(x + sx, y))) x += sx;
        else {
          hitX = true;
          if (sy === 0) {
            const nudge = this.findNudge(boxAt, x, y, sx, 0);
            if (nudge !== null) y += nudge;
          }
        }
      }
      if (sy !== 0) {
        if (!this.blocked(boxAt(x, y + sy))) y += sy;
        else {
          hitY = true;
          if (sx === 0) {
            const nudge = this.findNudge(boxAt, x, y, 0, sy);
            if (nudge !== null) x += nudge;
          }
        }
      }
    }
    return { x, y, hitX, hitY };
  }

  private findNudge(boxAt: (x: number, y: number) => Rect, x: number, y: number, sx: number, sy: number): number | null {
    // Look up to 6px either side for a free lane; step 0.75px toward it.
    for (let d = 1; d <= 6; d++) {
      for (const sign of [-1, 1]) {
        const ox = sy !== 0 ? sign * d : 0;
        const oy = sx !== 0 ? sign * d : 0;
        if (!this.blocked(boxAt(x + ox + sx, y + oy + sy)) && !this.blocked(boxAt(x + ox, y + oy))) {
          return sign * 0.75;
        }
      }
    }
    return null;
  }
}
