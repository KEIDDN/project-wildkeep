import { Graphics } from "pixi.js";
import { Entity } from "../entities/Entity";
import type { Area } from "../world/Area";
import type { Game } from "../Game";

interface Fly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

/**
 * Fireflies drifting around the player after dark. They're drawn in the
 * area's emissive glow layer, which the Game fades in with the darkness —
 * so by day they simply aren't there, and at night they actually glow.
 */
export class Fireflies extends Entity {
  private g = new Graphics();
  private flies: Fly[] = [];
  private t = 0;
  private density: number;

  constructor(area: Area, density = 26) {
    super(0, 0);
    this.density = density;
    area.glow.addChild(this.g);
  }

  get isStatic(): boolean {
    return false;
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    const p = game.player;
    const cam = game.camera;
    const hw = cam.viewW / 2 + 40;
    const hh = cam.viewH / 2 + 40;
    // Keep a swarm around the view; recycle the ones that drift off.
    while (this.flies.length < this.density) this.flies.push(this.spawn(p.x, p.y, hw, hh));
    const g = this.g.clear();
    if (game.lighting.night < 0.2) return;
    for (let i = 0; i < this.flies.length; i++) {
      const f = this.flies[i];
      f.vx += (Math.random() - 0.5) * 30 * dt;
      f.vy += (Math.random() - 0.5) * 30 * dt;
      f.vx *= 0.98;
      f.vy *= 0.98;
      f.x += f.vx * dt * f.speed;
      f.y += f.vy * dt * f.speed;
      if (Math.abs(f.x - cam.x) > hw || Math.abs(f.y - cam.y) > hh) {
        this.flies[i] = this.spawn(cam.x, cam.y, hw, hh);
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.2 + f.phase);
      if (pulse < 0.15) continue;
      g.circle(f.x, f.y, 2.2).fill({ color: 0xd8ff7a, alpha: 0.18 * pulse });
      g.rect(Math.round(f.x), Math.round(f.y), 1, 1).fill({ color: 0xf4ffb8, alpha: pulse });
    }
  }

  private spawn(cx: number, cy: number, hw: number, hh: number): Fly {
    return {
      x: cx + (Math.random() * 2 - 1) * hw,
      y: cy + (Math.random() * 2 - 1) * hh,
      vx: Math.random() * 10 - 5,
      vy: Math.random() * 10 - 5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.8,
    };
  }

  destroy(): void {
    this.g.destroy();
    super.destroy();
  }
}
