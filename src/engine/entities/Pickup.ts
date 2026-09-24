import { Graphics, Sprite } from "pixi.js";
import { Entity } from "./Entity";
import type { Game } from "../Game";
import { tex } from "../textures";
import { icon16Path } from "../../data/assets";
import { getItem } from "../../data/items";
import { RARITY_COLOR, rarityRank } from "../../game/core/types";
import type { LightSource } from "../fx/Lighting";
import { audio } from "../../game/audio/AudioManager";
import { t } from "../../i18n";

/**
 * A dropped item or gold. Pops out with an arc, bounces, then gets pulled
 * toward the player and collected — so every resource you earn is something
 * you *see* land and fly into your pack.
 */
export class Pickup extends Entity {
  private icon: Sprite;
  private glow: Graphics | null = null;
  private z = 0;
  private vz: number;
  private vx: number;
  private vy: number;
  private age = 0;
  private collected = false;
  private rank: number;
  /** Epic / legendary gear: a pillar of light so you see it from afar. */
  private beam: Graphics | null = null;
  private announced = false;

  readonly kind: "item" | "gold";
  readonly itemId: string;

  readonly quantity: number;

  constructor(
    x: number,
    y: number,
    kind: "item" | "gold",
    itemId: string,
    quantity: number,
  ) {
    super(x, y);
    this.kind = kind;
    this.itemId = itemId;

    this.quantity = quantity;
    const iconId = kind === "gold" ? "gold_coin" : getItem(itemId).icon;
    this.rank = kind === "gold" ? 0 : rarityRank(getItem(itemId).rarity);
    if (this.rank >= 2) {
      const color = RARITY_COLOR[getItem(itemId).rarity];
      if (this.rank >= 3) {
        this.beam = new Graphics();
        for (let i = 0; i < 4; i++) this.beam.rect(-3 + i, -70, 6 - i * 2, 70).fill({ color, alpha: 0.12 + i * 0.06 });
        this.view.addChild(this.beam);
      }
      this.glow = new Graphics().circle(0, -6, 7).fill({ color, alpha: 0.35 });
      this.view.addChild(this.glow);
    }
    this.icon = new Sprite(tex(icon16Path(iconId)));
    this.icon.anchor.set(0.5, 1);
    if (kind === "gold") this.icon.scale.set(0.75);
    const shadow = new Graphics().ellipse(0, 0, 4, 1.5).fill({ color: 0, alpha: 0.3 });
    this.view.addChild(shadow, this.icon);
    const ang = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 26;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed * 0.6;
    this.vz = 70 + Math.random() * 40;
  }

  update(dt: number, game: Game): void {
    if (this.collected) return;
    this.age += dt;
    const p = game.player;
    const dx = p.x - this.x;
    const dy = p.y - 6 - this.y;
    const dist = Math.hypot(dx, dy);

    // Good gear lingers a moment on the ground: you should *see* what dropped.
    const settle = this.rank >= 2 && this.kind === "item" && getItem(this.itemId).equipSlot ? 1.1 : 0.45;
    if (this.rank >= 2 && !this.announced && this.age > 0.5) {
      this.announced = true;
      const def = getItem(this.itemId);
      if (def.equipSlot) {
        game.fx.text(this.x, this.y - 18, t(`common.rarity.${def.rarity}`), Number.parseInt(RARITY_COLOR[def.rarity].slice(1), 16), { size: 8, bold: true, life: 1.4 });
        if (this.rank >= 3) {
          game.fx.ring(this.x, this.y - 4, 22, Number.parseInt(RARITY_COLOR[def.rarity].slice(1), 16), 0.6);
          audio.sfx("rare", { pitch: this.rank >= 4 ? 0.7 : 0.9 });
        }
      }
    }
    if (this.age > settle && dist < 44) {
      // Magnet: accelerate toward the player.
      const pull = 160 + (44 - dist) * 8;
      this.x += (dx / dist) * pull * dt;
      this.y += (dy / dist) * pull * dt;
      this.z = Math.max(0, this.z - 60 * dt);
      if (dist < 7) {
        this.collected = true;
        game.collectPickup(this);
        return;
      }
    } else {
      this.vz -= 260 * dt;
      this.z += this.vz * dt;
      if (this.z < 0) {
        this.z = 0;
        this.vz = Math.abs(this.vz) > 30 ? -this.vz * 0.4 : 0;
        this.vx *= 0.5;
        this.vy *= 0.5;
      }
      const r = game.area.collision.move(this.x, this.y, 4, 2, this.vx * dt, this.vy * dt);
      if (r.hitX) this.vx = -this.vx * 0.5;
      if (r.hitY) this.vy = -this.vy * 0.5;
      this.x = r.x;
      this.y = r.y;
    }
    const bob = this.z === 0 && this.age > 0.6 ? Math.sin(this.age * 5) * 1 : 0;
    this.icon.y = -Math.round(this.z + bob);
    if (this.glow) this.glow.alpha = 0.6 + Math.sin(this.age * 6) * 0.3;
    if (this.beam) this.beam.alpha = 0.7 + Math.sin(this.age * 4) * 0.3;
  }

  light(): LightSource | null {
    if (this.rank < 2) return null;
    if (this.rank >= 3) return { x: this.x, y: this.y - 10, radius: 34, color: Number.parseInt(RARITY_COLOR[getItem(this.itemId).rarity].slice(1), 16), intensity: 0.9, flicker: 0.3 };
    return { x: this.x, y: this.y - 6, radius: 18, color: 0xfff0c0, intensity: 0.7 };
  }
}
