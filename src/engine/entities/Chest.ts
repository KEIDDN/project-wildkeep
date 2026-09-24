import { Graphics, Sprite } from "pixi.js";
import { t } from "../../i18n";
import { Entity, type Interactable } from "./Entity";
import type { Game } from "../Game";
import { tex } from "../textures";
import { propPath } from "../../data/assets";
import { chestRollBonus, rarityUpChance } from "../../data/talents";
import { GEAR_CHANCE, rollGear, chestGold, rollBossReward, rollChestLoot } from "../../game/systems/lootSystem";
import { usePlayerStore } from "../../store/playerStore";
import { computeRelicEffects } from "../../game/systems/statsSystem";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { awardSkillXp } from "../../game/actions";
import { audio } from "../../game/audio/AudioManager";
import type { LightSource } from "../fx/Lighting";

/**
 * Dungeon chest. Opening it: lid pops (squash & stretch), a flash, then the
 * loot bursts out as pickups that fly into your bag. Rare chests are gilded,
 * glow, and roll from a richer table.
 */
export class Chest extends Entity implements Interactable {
  private closed: Sprite;
  private open: Sprite;
  private aura: Graphics | null = null;
  private opened = false;
  private age = Math.random() * 10;
  private popTime = 0;
  interactRadius = 18;
  interactPriority = 0;

  readonly chestId: string;
  readonly rare: boolean;

  readonly tier: number;

  private onOpened: (id: string) => void;
  private opts: { bossReward?: boolean; floor?: number; lootLuck?: number };

  constructor(
    x: number,
    y: number,
    chestId: string,
    rare: boolean,
    tier: number,
    alreadyOpened: boolean,
    onOpened: (id: string) => void,
    colliderRect: (r: { x: number; y: number; w: number; h: number }) => void,
    opts: { bossReward?: boolean; floor?: number; lootLuck?: number } = {},
  ) {
    super(x, y);
    this.opts = opts;
    this.chestId = chestId;
    this.rare = rare;

    this.tier = tier;
    this.onOpened = onOpened;
    if (rare) {
      this.aura = new Graphics().ellipse(0, -4, 12, 5).fill({ color: 0xffd54f, alpha: 0.25 });
      this.view.addChild(this.aura);
    }
    this.closed = new Sprite(tex(propPath("chest_closed")));
    this.open = new Sprite(tex(propPath("chest_open")));
    for (const s of [this.closed, this.open]) {
      s.anchor.set(0.5, 1);
      if (rare) s.tint = 0xffe08a;
      this.view.addChild(s);
    }
    this.opened = alreadyOpened;
    this.closed.visible = !alreadyOpened;
    this.open.visible = alreadyOpened;
    colliderRect({ x: x - 7, y: y - 6, w: 14, h: 6 });
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y + 4;
  }

  prompt() {
    if (this.opened) return null;
    return { verb: t("prompt.open"), target: this.rare ? t("prompt.target.gildedChest") : t("prompt.target.chest") };
  }

  interact(game: Game): void {
    if (this.opened) return;
    this.opened = true;
    this.popTime = 0.25;
    this.closed.visible = false;
    this.open.visible = true;
    this.onOpened(this.chestId);
    audio.sfx("chest");
    awardSkillXp("luck", this.rare ? 12 : 4);
    game.player.faceToward(this.x, this.y);

    const p = usePlayerStore.getState();
    const luck = playerEffectiveStats(p).luck + computeRelicEffects(p.equipment).rareLootChanceBonus;
    const loot = rollChestLoot(this.tier, this.rare, luck + (this.opts.lootLuck ?? 0), Math.random, chestRollBonus(p.talents));
    const depth = this.opts.floor ?? this.tier * 3;
    const up = rarityUpChance(p.talents);
    // Boss floors: one guaranteed piece of rare-or-better gear on top.
    if (this.opts.bossReward) {
      const r = rollBossReward(depth, luck, Math.random, up);
      if (r) loot.unshift(r);
    } else if (Math.random() < (this.rare ? GEAR_CHANCE.rareChest : GEAR_CHANCE.chest) * (1 + luck)) {
      const g = rollGear(depth, luck, Math.random, { upChance: up });
      if (g) loot.unshift({ itemId: g, quantity: 1 });
    }
    const gold = chestGold(this.tier, this.rare);

    game.fx.burst(this.x, this.y - 8, this.rare ? "gold" : "spark", this.rare ? 24 : 12, { speed: 55, up: 80 });
    game.fx.ring(this.x, this.y - 6, this.rare ? 28 : 18, this.rare ? 0xffd54f : 0xffffff, 0.5);
    if (this.rare) game.shake(2, 0.2);

    // Stagger the loot so it fountains out rather than appearing at once.
    let delay = 120;
    for (const item of loot) {
      setTimeout(() => !this.removed && game.spawnPickup(this.x, this.y - 6, "item", item.itemId, item.quantity), delay);
      delay += 110;
    }
    const coins = Math.min(6, Math.max(2, Math.round(gold / 10)));
    for (let i = 0; i < coins; i++) {
      const share = i === coins - 1 ? gold - Math.floor(gold / coins) * (coins - 1) : Math.floor(gold / coins);
      setTimeout(() => !this.removed && game.spawnPickup(this.x, this.y - 6, "gold", "gold", share), 60 + i * 50);
    }
  }

  update(dt: number, game: Game): void {
    this.age += dt;
    if (this.aura) this.aura.alpha = this.opened ? 0.15 : 0.6 + Math.sin(this.age * 4) * 0.3;
    if (this.popTime > 0) {
      this.popTime -= dt;
      const k = Math.max(0, this.popTime / 0.25);
      this.open.scale.set(1 + k * 0.25, 1 - k * 0.2 + Math.sin(k * Math.PI) * 0.3);
    }
    // Unopened rare chests glint now and then so they read from across a room.
    if (this.rare && !this.opened && Math.random() < dt * 2.5) {
      game.fx.burst(this.x + (Math.random() * 12 - 6), this.y - 10, "spark", 1, { speed: 4, up: 10, life: 0.5 });
    }
  }

  light(): LightSource | null {
    if (!this.rare) return { x: this.x, y: this.y - 6, radius: 14, color: 0xffe0a0, intensity: this.opened ? 0.2 : 0.45 };
    return { x: this.x, y: this.y - 6, radius: 34, color: 0xffd060, intensity: this.opened ? 0.35 : 0.9, flicker: 0.5 };
  }
}
