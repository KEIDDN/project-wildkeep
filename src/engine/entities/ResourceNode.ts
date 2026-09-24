import { Sprite } from "pixi.js";
import { t } from "../../i18n";
import { nodeName, toolName } from "../../i18n/content";
import { Entity, type Interactable } from "./Entity";
import type { Game } from "../Game";
import type { Area } from "../world/Area";
import type { GatherTarget } from "./Player";
import { getNodeDef, type ResourceNodeDef } from "../../data/resourceNodes";
import { propPath } from "../../data/assets";
import { tex } from "../textures";
import { getItem } from "../../data/items";
import { bestTool } from "../../game/systems/toolSystem";
import { spendEnergy } from "../../game/systems/vitals";
import { WEAR_TOOL, toolDurability, wearState, wearTool } from "../../game/systems/durability";
import { gatherTalent } from "../../data/talents";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useWorldStore } from "../../store/worldStore";
import { computeRelicEffects } from "../../game/systems/statsSystem";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { doubleYieldChance, gatherPowerBonus, rareFindBonus } from "../../game/systems/skills";
import { isNight } from "../../game/time/clock";
import { useTimeStore } from "../../store/timeStore";
import type { LightSource } from "../fx/Lighting";
import { awardSkillXp, grantXp } from "../../game/actions";
import { gameEvents } from "../../game/events";
import { audio } from "../../game/audio/AudioManager";
import type { InteractionPrompt } from "../../store/uiStore";


/**
 * A gatherable world object (tree, rock, ore vein, herb…). Takes several
 * swings; each swing shakes it and throws particles, and the last one pops
 * the drops out as pickups and swaps to a depleted sprite (stump, rubble,
 * sprout) until it regrows.
 */
export class ResourceNode extends Entity implements Interactable, GatherTarget {
  readonly def: ResourceNodeDef;
  private full: Sprite;
  private depleted: Sprite | null;
  private hp: number;
  private shakeTime = 0;
  private colliderId: number | null = null;
  private respawnAt = 0;
  interactRadius: number;
  interactPriority = 1;
  private twinkle = Math.random() * 3;
  private glow: Sprite | null = null;
  private glowTime = 0;

  /** The area this node lives in (not game.area: nodes are built before
   * their area becomes current). */
  private area: Area;
  readonly key: string;

  constructor(
    x: number,
    y: number,
    defId: string,
    /** Stable id: area + position, used to persist regrow timers. */
    key: string,
    area: Area,
  ) {
    super(x, y);
    this.area = area;
    this.key = key;
    this.def = getNodeDef(defId);
    this.full = new Sprite(tex(propPath(this.def.sprite)));
    this.full.anchor.set(0.5, 1);
    if (this.def.scale) this.full.scale.set(this.def.scale);
    if (this.def.tint !== undefined) this.full.tint = this.def.tint;
    this.depleted = this.def.depletedSprite ? new Sprite(tex(propPath(this.def.depletedSprite))) : null;
    if (this.depleted) {
      this.depleted.anchor.set(0.5, 1);
      this.view.addChild(this.depleted);
    }
    this.view.addChild(this.full);
    this.hp = this.def.hits;
    this.interactRadius = Math.max(16, (this.def.collider?.w ?? 10) / 2 + 12);

    const saved = useWorldStore.getState().nodeRespawns[key] ?? 0;
    if (saved > Date.now()) this.setDepleted(saved);
    else this.setAlive();
  }

  get anim() {
    return this.def.anim;
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y;
  }

  alive(): boolean {
    return this.hp > 0;
  }

  private setAlive() {
    this.hp = this.def.hits;
    this.full.visible = true;
    this.full.alpha = 1;
    if (this.depleted) this.depleted.visible = false;
    if (this.def.collider && this.colliderId === null) {
      const c = this.def.collider;
      this.colliderId = this.area.collision.addRect({ x: this.x - c.w / 2, y: this.y - c.h, w: c.w, h: c.h });
    }
  }

  private setDepleted(until: number) {
    this.hp = 0;
    this.respawnAt = until;
    this.full.visible = false;
    if (this.depleted) this.depleted.visible = true;
    if (this.colliderId !== null) {
      this.area.collision.removeRect(this.colliderId);
      this.colliderId = null;
    }
  }

  /** Night-only plants are closed buds by day. */
  private get dormant(): boolean {
    return !!this.def.nightOnly && !isNight(useTimeStore.getState().minute);
  }

  prompt(): InteractionPrompt | null {
    if (!this.alive()) return null;
    const name = nodeName(this.def.id, this.def.name);
    if (this.dormant) return { verb: t("prompt.closed"), target: name, blocked: t("prompt.bloomsAtNight") };
    const verb = this.def.anim === "chop" ? t("prompt.chop") : this.def.anim === "mine" ? t("prompt.mine") : t("prompt.gather");
    const missing = this.missingTool();
    return { verb, target: name, blocked: missing ? t("prompt.needs", { tool: missing }) : undefined, selfHandled: true };
  }

  private missingTool(): string | null {
    if (!this.def.toolKind) return null;
    const p = usePlayerStore.getState();
    const tool = bestTool(this.def.toolKind, p.equipment, useInventoryStore.getState().stacks);
    if ((tool?.toolPower ?? 0) >= this.def.toolPowerRequired) return null;
    return toolName(this.def.toolKind as "axe" | "pickaxe", this.def.toolPowerRequired);
  }

  interact(game: Game): void {
    if (!this.alive() || this.dormant) return;
    const missing = this.missingTool();
    if (missing) {
      game.ui.pushToast(t("prompt.needsTo", { tool: missing }), "warning");
      audio.sfx("deny");
      this.shakeTime = 0.15;
      return;
    }
    game.player.startGather(this);
  }

  /** Called by the player on the impact frame of each swing. */
  hit(game: Game): void {
    if (!this.alive()) return;
    const p = usePlayerStore.getState();
    const tool = this.def.toolKind ? bestTool(this.def.toolKind, p.equipment, useInventoryStore.getState().stacks) : null;
    const speedBonus = computeRelicEffects(p.equipment).gatherSpeedBonus + gatherPowerBonus(p.skills[this.def.skill].level);
    // Hard work: spends the day's energy and wears the tool. Tired hands and
    // blunt tools still work, just slower.
    const rested = spendEnergy(this.def.anim === "chop" ? "chop" : this.def.anim === "mine" ? "mine" : "gather");
    let wear = 1;
    if (tool) {
      const d = toolDurability(tool.id);
      wear = WEAR_TOOL[wearState(d.cur, d.max)];
      wearTool(tool.id, 0.5);
    }
    const power = ((tool?.toolPower ?? 1) * wear * (1 + speedBonus) + gatherTalent(p.talents, this.def.skill).power * 0.5) * (rested ? 1 : 0.6);
    this.hp -= power;
    this.shakeTime = 0.18;

    const cx = this.x;
    const cy = this.y - Math.min(20, this.full.height * 0.35);
    for (const kind of this.def.particles) {
      game.fx.burst(cx, cy, kind, kind === "leaf" ? 5 : 8, { speed: 45, up: 55, height: 8 });
    }
    if (this.def.anim === "mine") game.fx.burst(cx, cy, "spark", 3, { speed: 60, up: 40, life: 0.25 });
    audio.sfx(this.def.anim === "chop" ? "chop" : this.def.anim === "mine" ? "mine" : "collect");
    game.shake(this.def.anim === "collect" ? 0 : 1.2, 0.08);

    if (this.hp <= 0) this.deplete(game);
  }

  private deplete(game: Game) {
    const rand = Math.random;
    const p = usePlayerStore.getState();
    const skillLevel = p.skills[this.def.skill].level;
    // Skill: a chance the node yields double. Luck: rare drops more often.
    const double = rand() < doubleYieldChance(skillLevel) + gatherTalent(p.talents, this.def.skill).double;
    const luck = playerEffectiveStats(p).luck;
    let dropped = 0;
    const rareBonus = rareFindBonus(skillLevel);
    for (const d of this.def.drops) {
      const chance = d.chance === undefined ? 1 : Math.min(1, d.chance * (1 + luck * 4 + (d.rare ? rareBonus : 0)));
      if (rand() > chance) continue;
      const q = (Math.floor(rand() * (d.max - d.min + 1)) + d.min) * (double && d.chance === undefined ? 2 : 1);
      // One pickup per unit (capped) so a big haul looks like a big haul.
      const pieces = Math.min(q, 5);
      for (let i = 0; i < pieces; i++) {
        const share = i === pieces - 1 ? q - Math.floor(q / pieces) * (pieces - 1) : Math.floor(q / pieces);
        if (share > 0) game.spawnPickup(this.x, this.y - 4, "item", d.itemId, share);
      }
      dropped += q;
      if (getItem(d.itemId).rarity !== "common" && d.chance !== undefined) game.fx.ring(this.x, this.y - 8, 18, 0xffe27a);
    }
    void dropped;
    grantXp(2);
    const player = usePlayerStore.getState();
    const res = player.gainXp(this.def.xp);
    if (res.leveledUp) game.combat.levelUp(res.newLevel);
    awardSkillXp(this.def.skill, this.def.xp * 2);
    game.fx.text(this.x, this.y - this.full.height - 2, `+${this.def.xp} XP`, 0x9fd8ff, { size: 7 });
    if (double) game.fx.text(this.x, this.y - this.full.height - 11, t("toast.doubleYield"), 0xffe27a, { size: 7, bold: true });
    gameEvents.emit("resourceGathered", { nodeId: this.def.id, skill: this.def.skill });
    game.fx.burst(this.x, this.y - 6, this.def.particles[0], 14, { speed: 60, up: 70 });

    const until = Date.now() + this.def.respawnSec * 1000;
    useWorldStore.getState().setNodeRespawn(this.key, until);
    this.setDepleted(until);
    if (this.def.anim === "chop") game.shake(2.5, 0.2);
  }

  update(dt: number, game: Game): void {
    // Tall nodes (trees) go see-through while the player is behind them.
    const p = game.player;
    const behind = this.alive() && p.y < this.y - 2 && p.y > this.y - this.full.height + 6 && Math.abs(p.x - this.x) < this.full.width * 0.42;
    this.view.alpha += ((behind ? 0.45 : 1) - this.view.alpha) * Math.min(1, dt * 10);
    if (!this.alive()) {
      if (Date.now() >= this.respawnAt) {
        this.setAlive();
        this.full.alpha = 0;
      }
      return;
    }
    if (this.def.nightOnly) {
      // Petals open at dusk and close at dawn.
      const target = this.dormant ? 0.35 : 1;
      this.full.alpha += (target - this.full.alpha) * Math.min(1, dt * 2);
    } else if (this.full.alpha < 1) this.full.alpha = Math.min(1, this.full.alpha + dt * 2);
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const m = this.shakeTime > 0 ? Math.sin(this.shakeTime * 90) * 1.5 : 0;
      this.full.x = Math.round(m);
      // Trees sway from the base.
      this.full.rotation = this.def.anim === "chop" ? m * 0.012 : 0;
    }
    this.readability(dt, game);
  }

  /**
   * "You can use this": now and then a little twinkle when you're around,
   * and a soft glow when you're close. Decorative scenery never does either,
   * so players learn what's harvestable without labels.
   */
  private readability(dt: number, game: Game) {
    const p = game.player;
    const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y);
    if (this.dormant) return;
    this.twinkle -= dt;
    if (d < 260 && this.twinkle <= 0) {
      this.twinkle = 2.2 + Math.random() * 3.5;
      const h = this.full.height;
      const w = this.full.width;
      const color = this.def.anim === "collect" ? 0xd8ffb0 : this.def.anim === "mine" ? 0xfff0c0 : 0xfff8d8;
      game.fx.twinkle(this.x + (Math.random() - 0.5) * w * 0.5, this.y - h * (0.35 + Math.random() * 0.45), color);
    }
    const near = d < 46 && !p.busy;
    if (near && !this.glow) {
      this.glow = new Sprite(this.full.texture);
      this.glow.anchor.copyFrom(this.full.anchor);
      this.glow.scale.copyFrom(this.full.scale);
      this.glow.blendMode = "add";
      this.glow.alpha = 0;
      this.view.addChild(this.glow);
    }
    if (this.glow) {
      this.glowTime += dt;
      const target = near ? 0.12 + Math.sin(this.glowTime * 4) * 0.05 : 0;
      this.glow.alpha += (target - this.glow.alpha) * Math.min(1, dt * 8);
      this.glow.visible = this.full.visible && this.glow.alpha > 0.005;
      this.glow.x = this.full.x;
      this.glow.rotation = this.full.rotation;
    }
  }

  light(): LightSource | null {
    if (!this.def.glow || !this.alive() || this.dormant) return null;
    return { x: this.x, y: this.y - 10, radius: 30, color: this.def.glow, intensity: 0.75, flicker: 0.3 };
  }

  destroy(): void {
    if (this.colliderId !== null) this.area.collision.removeRect(this.colliderId);
    super.destroy();
  }
}
