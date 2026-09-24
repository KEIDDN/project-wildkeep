import { Graphics } from "pixi.js";

/**
 * Screen-space rain for storm days: a fixed pool of streaks redrawn each
 * frame into one Graphics (no per-frame allocation), plus the occasional
 * distant flash. Only drawn outdoors.
 */
export class Weather {
  readonly view = new Graphics();
  private drops: { x: number; y: number; len: number; speed: number }[] = [];
  private flash = 0;
  private flashTimer = 8;
  active = false;

  update(dt: number, w: number, h: number): void {
    const g = this.view;
    g.clear();
    if (!this.active) return;
    if (this.drops.length === 0) {
      for (let i = 0; i < 160; i++) this.drops.push({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 14, speed: 520 + Math.random() * 260 });
    }
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.speed * 0.18 * dt;
      if (d.y > h) {
        d.y = -d.len;
        d.x = Math.random() * (w + 80);
      }
      g.moveTo(d.x, d.y).lineTo(d.x - d.len * 0.18, d.y + d.len);
    }
    g.stroke({ width: 1.5, color: 0xb8cce8, alpha: 0.45 });
    // Distant lightning, now and then.
    this.flashTimer -= dt;
    if (this.flashTimer <= 0) {
      this.flashTimer = 7 + Math.random() * 12;
      this.flash = 0.35;
    }
    if (this.flash > 0) {
      this.flash -= dt;
      g.rect(0, 0, w, h).fill({ color: 0xe8f0ff, alpha: Math.max(0, this.flash) * 0.5 });
    }
  }
}
