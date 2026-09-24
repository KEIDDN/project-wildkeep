import { Graphics, Sprite, type Texture } from "pixi.js";
import { Entity, isHittable, type Hittable } from "./Entity";
import type { DamageType } from "../../data/combat";
import type { Game } from "../Game";
import type { Stats } from "../../game/core/types";
import { resolveAttack } from "../../game/systems/combatSystem";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { usePlayerStore } from "../../store/playerStore";

/**
 * Something flying through the air: a skeleton archer's bone, the player's
 * arrow. Moves in a straight line at "chest height", stops at walls, and
 * hits the first valid target it touches (enemy shots hit the player;
 * player shots hit anything hittable — enemies, animals, villagers).
 */
export class Projectile extends Entity {
  private vx: number;
  private vy: number;
  private life: number;
  private readonly owner: "player" | "enemy";
  private readonly stats: Stats;
  private readonly sprite: Sprite | Graphics;
  private readonly onHit?: (game: Game, target?: Hittable) => void;
  private readonly damageType: DamageType;
  private readonly orb: number | null;
  private age = 0;
  get hostile(): boolean {
    return this.owner === "enemy";
  }
  /** Height above the ground the shot flies at (for drawing only). */
  private readonly z = 10;

  constructor(
    x: number,
    y: number,
    angle: number,
    opts: { owner: "player" | "enemy"; stats: Stats; speed?: number; range?: number; texture?: Texture; color?: number; orb?: number; onHit?: (game: Game, target?: Hittable) => void; damageType?: DamageType },
  ) {
    super(x, y);
    const speed = opts.speed ?? 170;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = (opts.range ?? 170) / speed;
    this.owner = opts.owner;
    this.stats = opts.stats;
    this.onHit = opts.onHit;
    this.damageType = opts.damageType ?? "pierce";
    this.orb = opts.orb ?? null;
    if (opts.orb !== undefined) {
      // A magic bolt: bright core, coloured halo. It lights its way.
      const g = new Graphics();
      g.circle(0, 0, 4).fill({ color: opts.orb, alpha: 0.35 });
      g.circle(0, 0, 2.5).fill(opts.orb);
      g.circle(-0.5, -0.5, 1.2).fill(0xffffff);
      this.sprite = g;
    } else if (opts.texture) {
      const s = new Sprite(opts.texture);
      s.anchor.set(0.5);
      // Arrow icons point up-right (45°): rotate to the flight direction.
      s.rotation = angle + Math.PI / 4;
      this.sprite = s;
    } else {
      const g = new Graphics();
      g.roundRect(-4, -1.5, 8, 3, 1.5).fill(opts.color ?? 0xe8e0cc).stroke({ width: 1, color: 0x2a1a20 });
      g.rotation = angle;
      this.sprite = g;
    }
    this.sprite.y = -this.z;
    const shadow = new Graphics().ellipse(0, 0, 3, 1.2).fill({ color: 0, alpha: 0.25 });
    this.view.addChild(shadow, this.sprite);
  }

  light() {
    return this.orb === null ? null : { x: this.x, y: this.y - this.z, radius: 26, color: this.orb, intensity: 0.9, flare: true };
  }

  update(dt: number, game: Game): void {
    this.life -= dt;
    this.age += dt;
    if (this.orb !== null) {
      this.sprite.scale.set(1 + Math.sin(this.age * 20) * 0.15);
      if (Math.random() < dt * 25) game.fx.burst(this.x, this.y - this.z, "spark", 1, { speed: 6, up: 4, life: 0.3 });
    }
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (this.life <= 0 || game.area.collision.blocked({ x: nx - 1, y: ny - 2, w: 2, h: 2 })) {
      game.fx.burst(this.x, this.y - this.z, "dust", 4, { speed: 20, up: 10, height: this.z, life: 0.3 });
      game.removeEntity(this);
      return;
    }
    this.x = nx;
    this.y = ny;

    if (this.owner === "enemy") {
      const p = game.player;
      if (Math.hypot(p.x - this.x, p.y - 8 - (this.y - this.z)) < 9 && p.state !== "dead") {
        // Parried: knocked back the way it came, now on your side.
        if (p.tryParry(game, this.x - this.vx * 0.2, this.y - this.vy * 0.2)) {
          const speed = Math.hypot(this.vx, this.vy) * 1.2;
          game.area.add(new Projectile(this.x, this.y, Math.atan2(-this.vy, -this.vx), { owner: "player", stats: { ...this.stats, attack: this.stats.attack * 1.5 }, speed, range: 180, orb: this.orb ?? undefined }));
          game.removeEntity(this);
          return;
        }
        if (!p.isInvulnerable) {
          const { damage } = resolveAttack(this.stats, playerEffectiveStats(usePlayerStore.getState()));
          p.hurt(game, damage, this.x - this.vx * 0.1, this.y - this.vy * 0.1);
        }
        game.removeEntity(this);
      }
      return;
    }
    for (const e of game.area.entities) {
      if (e === this || e.removed || !isHittable(e) || e.dead) continue;
      if (Math.hypot(e.x - this.x, e.centerY - (this.y - this.z)) > e.hitRadius + 5) continue;
      const roll = resolveAttack(this.stats, e.stats);
      e.takeHit(game, roll.damage, roll.isCrit, this.x - this.vx * 0.2, this.y - this.vy * 0.2, 0.6, { type: this.damageType });
      game.fx.burst(e.x, e.centerY, "spark", 4, { speed: 40, up: 20, life: 0.2 });
      this.onHit?.(game, e);
      game.removeEntity(this);
      return;
    }
  }
}
