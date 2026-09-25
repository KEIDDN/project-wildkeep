import type { Container } from "pixi.js";
import type { Rect } from "../game/core/types";
import { MAX_ZOOM, MIN_ZOOM, TARGET_VIEW_H, TARGET_VIEW_W } from "../game/core/constants";

/**
 * World camera. Follows a target with exponential smoothing plus a small
 * look-ahead in the direction of travel, clamps to the area's view bounds
 * (so it stops at the edge of the world instead of showing the void), and
 * applies one integer zoom so every pixel of art maps to an exact block of
 * screen pixels.
 *
 * `x, y` is the world point at the centre of the screen. Everything that
 * lives in the world is drawn through `apply`; UI that needs to point at the
 * world uses `worldToScreen`.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 3;
  screenW = 1;
  screenH = 1;
  /** Region the camera may show (world px). */
  bounds: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private shakeTime = 0;
  private shakeMag = 0;
  private offsetX = 0;
  private offsetY = 0;
  /** Screen position of the world origin after the last `apply` (whole
   * screen pixels). Screen-space overlays align to the world grid with it. */
  originX = 0;
  originY = 0;
  private leadX = 0;
  private leadY = 0;
  /** Directional nudge (hits, impacts): springs back to zero. */
  private kickX = 0;
  private kickY = 0;

  resize(screenW: number, screenH: number): void {
    this.screenW = screenW;
    this.screenH = screenH;
    const fit = Math.min(screenW / TARGET_VIEW_W, screenH / TARGET_VIEW_H);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fit)));
    this.clamp();
  }

  get viewW(): number {
    return this.screenW / this.zoom;
  }

  get viewH(): number {
    return this.screenH / this.zoom;
  }

  /** Jump straight to a point (area loads, respawns, sleeping). */
  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.leadX = this.leadY = 0;
    this.clamp();
  }

  /**
   * Ease toward the target. `vx, vy` is the target's movement direction
   * (unit-ish); the camera leans a few pixels ahead of it so you see more of
   * where you're going, and the lead cancels most of the follow lag, keeping
   * the player visually centred while moving.
   */
  follow(tx: number, ty: number, dt: number, vx = 0, vy = 0): void {
    const lead = 6;
    const kl = 1 - Math.exp(-dt * 4);
    this.leadX += (vx * lead - this.leadX) * kl;
    this.leadY += (vy * lead * 0.7 - this.leadY) * kl;
    const k = 1 - Math.exp(-dt * 14);
    this.x += (tx + this.leadX - this.x) * k;
    this.y += (ty + this.leadY - this.y) * k;
    this.clamp();
  }

  shake(magnitude: number, duration: number): void {
    this.shakeMag = Math.max(this.shakeMag, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  /** Push the view a few pixels along (dx, dy) — a blow you can feel land. */
  kick(dx: number, dy: number, magnitude: number): void {
    const len = Math.hypot(dx, dy) || 1;
    this.kickX = Math.max(-6, Math.min(6, this.kickX + (dx / len) * magnitude));
    this.kickY = Math.max(-6, Math.min(6, this.kickY + (dy / len) * magnitude));
  }

  update(dt: number): void {
    const decay = Math.exp(-dt * 16);
    this.kickX *= decay;
    this.kickY *= decay;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeTime * 4);
      this.offsetX = (Math.random() * 2 - 1) * m;
      this.offsetY = (Math.random() * 2 - 1) * m;
      if (this.shakeTime <= 0) {
        this.shakeMag = 0;
        this.offsetX = this.offsetY = 0;
      }
    }
  }

  /** Keep the view inside the bounds; centre maps smaller than the screen. */
  private clamp(): void {
    const b = this.bounds;
    if (b.w <= 0 || b.h <= 0) return;
    const hw = this.viewW / 2;
    const hh = this.viewH / 2;
    this.x = b.w <= this.viewW ? b.x + b.w / 2 : Math.min(Math.max(this.x, b.x + hw), b.x + b.w - hw);
    this.y = b.h <= this.viewH ? b.y + b.h / 2 : Math.min(Math.max(this.y, b.y + hh), b.y + b.h - hh);
  }

  apply(world: Container): void {
    world.scale.set(this.zoom);
    // Round to whole screen pixels so the art grid never lands between pixels.
    this.originX = Math.round(this.screenW / 2 - (this.x + this.offsetX + this.kickX) * this.zoom);
    this.originY = Math.round(this.screenH / 2 - (this.y + this.offsetY + this.kickY) * this.zoom);
    world.position.set(this.originX, this.originY);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: this.screenW / 2 + (x - this.x) * this.zoom,
      y: this.screenH / 2 + (y - this.y) * this.zoom,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + (sx - this.screenW / 2) / this.zoom,
      y: this.y + (sy - this.screenH / 2) / this.zoom,
    };
  }
}
