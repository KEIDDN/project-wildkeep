import { AnimatedSprite, Graphics, type Texture } from "pixi.js";
import { Entity, type Hittable, type Interactable } from "./Entity";
import type { Game } from "../Game";
import { ANIMALS, type AnimalDef } from "../../data/animals";
import { ASSETS, animalPath } from "../../data/assets";
import { frames } from "../textures";
import type { Stats } from "../../game/core/types";
import { rollLoot } from "../../game/systems/lootSystem";
import { grantXp, awardSkillXp } from "../../game/actions";
import { gameEvents } from "../../game/events";
import { useSocialStore } from "../../store/socialStore";
import { usePlayerStore } from "../../store/playerStore";
import { huntDropChance } from "../../data/talents";
import { audio } from "../../game/audio/AudioManager";
import { showTutorial } from "../../game/tutorial";
import { animalName } from "../../i18n/content";
import { t } from "../../i18n";
import type { InteractionPrompt } from "../../store/uiStore";

type AnimalState = "idle" | "wander" | "flee" | "approach" | "charge" | "recover" | "dying";

const COLLIDER = { w: 8, h: 4 };

/**
 * A woodland animal. Not an enemy: it has its own small life (graze,
 * wander) and reacts to you — skittish ones bolt (sooner if you run),
 * curious foxes edge closer before thinking better of it, boars charge
 * when cornered or hit. Hunted animals drop meat, hides and feathers.
 */
export class Animal extends Entity implements Hittable, Interactable {
  readonly def: AnimalDef;
  readonly stats: Stats;
  hp: number;
  private sprite: AnimatedSprite;
  private idleFrames: Texture[];
  private runFrames: Texture[];
  private state: AnimalState = "idle";
  private timer = Math.random() * 3;
  private dirX = 0;
  private dirY = 0;
  private homeX: number;
  private homeY: number;
  private flash = 0;
  private facingLeft = Math.random() < 0.5;
  private hitDone = false;
  /** Set when it can be caught by hand (Duchess the pig). */
  onCatch: ((game: Game, animal: Animal) => void) | null = null;
  /** Kept inside a fence (the village pig pen). */
  penned: { x: number; y: number; w: number; h: number } | null = null;
  interactRadius = 18;
  interactPriority = 0;

  constructor(x: number, y: number, id: string) {
    super(x, y);
    this.def = ANIMALS[id];
    this.stats = { maxHp: this.def.maxHp, attack: this.def.attack ?? 0, defense: this.def.defense, crit: 0, luck: 0 };
    this.hp = this.def.maxHp;
    this.homeX = x;
    this.homeY = y;
    const meta = ASSETS.animals[this.def.sprite];
    const all = frames(animalPath(this.def.sprite), meta.frameW, meta.frameH, meta.frames);
    this.idleFrames = all.slice(0, 2);
    this.runFrames = all.slice(2, 6);
    this.sprite = new AnimatedSprite(this.idleFrames);
    this.sprite.anchor.set(meta.anchorX, meta.anchorY);
    this.sprite.animationSpeed = 2 / 60;
    this.sprite.play();
    this.sprite.roundPixels = true;
    this.sprite.tint = this.def.tint ?? 0xffffff;
    const shadow = new Graphics().ellipse(0, 0, meta.frameW * 0.3, 2).fill({ color: 0, alpha: 0.25 });
    this.view.addChild(shadow, this.sprite);
  }

  get dead(): boolean {
    return this.state === "dying";
  }

  get centerY(): number {
    return this.y - ASSETS.animals[this.def.sprite].frameH * 0.4;
  }

  get hitRadius(): number {
    return ASSETS.animals[this.def.sprite].frameW * 0.28;
  }

  // --- catchable (the escaped pig) -------------------------------------------------------

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y;
  }

  prompt(): InteractionPrompt | null {
    if (!this.onCatch || this.dead) return null;
    return { verb: t("events.catchPig"), target: animalName(this.def.id, this.def.name) };
  }

  interact(game: Game): void {
    this.onCatch?.(game, this);
  }

  // --- behaviour -------------------------------------------------------------------------

  private setAnim(run: boolean, speed: number) {
    const want = run ? this.runFrames : this.idleFrames;
    if (this.sprite.textures !== want) {
      this.sprite.textures = want;
      this.sprite.play();
    }
    this.sprite.animationSpeed = run ? Math.min(0.35, speed / 300) : 2 / 60;
  }

  private step(game: Game, speed: number, dt: number) {
    const r = game.area.collision.move(this.x, this.y, COLLIDER.w, COLLIDER.h, this.dirX * speed * dt, this.dirY * speed * dt);
    // Blocked: pick a new direction (animals don't get stuck on trees).
    if ((r.hitX || r.hitY) && this.state !== "charge") {
      const a = Math.random() * Math.PI * 2;
      this.dirX = Math.cos(a);
      this.dirY = Math.sin(a);
    }
    this.x = r.x;
    this.y = r.y;
    const pen = this.penned;
    if (pen) {
      this.x = Math.max(pen.x, Math.min(pen.x + pen.w, this.x));
      this.y = Math.max(pen.y, Math.min(pen.y + pen.h, this.y));
    }
    if (Math.abs(this.dirX) > 0.1) this.facingLeft = this.dirX < 0;
  }

  update(dt: number, game: Game): void {
    this.timer -= dt;
    if (this.flash > 0) {
      this.flash -= dt;
      this.sprite.tint = this.flash > 0 ? 0xff9090 : (this.def.tint ?? 0xffffff);
    }
    if (this.state === "dying") {
      this.view.alpha -= dt * 0.8;
      if (this.view.alpha <= 0) game.removeEntity(this);
      return;
    }
    const p = game.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    const running = p.isMoving && p.isRunning;
    const spook = this.def.spook[running ? 1 : 0];
    if (dist < 110) showTutorial("hunting");

    switch (this.state) {
      case "idle":
      case "wander": {
        if (this.def.temper === "aggressive" && dist < spook) {
          this.startCharge(dx, dy, dist);
          break;
        }
        if (this.def.temper === "curious" && dist < spook * 2.4 && dist > spook && Math.random() < dt * 0.5) {
          this.state = "approach";
          this.timer = 1.2;
          break;
        }
        if (dist < spook && this.def.temper !== "aggressive") {
          this.startFlee(dx, dy, dist);
          this.alertHerd(game);
          break;
        }
        if (this.state === "idle") {
          this.setAnim(false, 0);
          if (this.timer <= 0) {
            this.state = "wander";
            this.timer = 1 + Math.random() * 2;
            const home = Math.hypot(this.homeX - this.x, this.homeY - this.y);
            const a = home > 60 ? Math.atan2(this.homeY - this.y, this.homeX - this.x) : Math.random() * Math.PI * 2;
            this.dirX = Math.cos(a);
            this.dirY = Math.sin(a);
          }
        } else {
          this.setAnim(true, this.def.wanderSpeed);
          this.step(game, this.def.wanderSpeed, dt);
          if (this.timer <= 0) {
            this.state = "idle";
            this.timer = 1.5 + Math.random() * 3;
          }
        }
        break;
      }
      case "approach":
        // A curious fox sniffs toward you, then thinks better of it.
        this.dirX = dx / (dist || 1);
        this.dirY = dy / (dist || 1);
        this.setAnim(true, this.def.wanderSpeed);
        this.step(game, this.def.wanderSpeed * 0.8, dt);
        if (dist < this.def.spook[0] * 0.8 || this.timer <= 0) this.startFlee(dx, dy, dist);
        break;
      case "flee":
        this.setAnim(true, this.def.fleeSpeed);
        this.step(game, this.def.fleeSpeed, dt);
        if (this.timer <= 0) {
          this.state = dist > spook * 1.5 ? "idle" : "flee";
          this.timer = dist > spook * 1.5 ? 1 + Math.random() * 2 : 0.6;
          if (this.state === "flee") this.aimAway(dx, dy, dist);
          // Wherever it ends up is its new home.
          this.homeX = this.x;
          this.homeY = this.y;
        }
        break;
      case "charge":
        this.setAnim(true, this.def.fleeSpeed * 1.4);
        this.step(game, this.def.fleeSpeed * 1.4, dt);
        if (!this.hitDone && dist < 12 && p.state !== "dead") {
          this.hitDone = true;
          p.hurt(game, Math.max(1, (this.def.attack ?? 4) - Math.floor(game.playerStats().defense * 0.5)), this.x, this.y);
        }
        if (this.timer <= 0) {
          this.state = "recover";
          this.timer = 1.1;
        }
        break;
      case "recover":
        this.setAnim(false, 0);
        if (this.timer <= 0) {
          this.state = dist < 70 ? "idle" : "wander";
          this.timer = 0.5;
        }
        break;
    }
    const sc = this.def.scale ?? 1;
    this.sprite.scale.set(this.facingLeft ? -sc : sc, sc);
    // Rare quarry glints now and then.
    if (this.def.rare && Math.random() < dt * 3) game.fx.twinkle(this.x + (Math.random() - 0.5) * 16, this.y - 6 - Math.random() * 14, 0xfff2b0);
  }

  private aimAway(dx: number, dy: number, dist: number) {
    const a = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.9;
    this.dirX = Math.cos(a);
    this.dirY = Math.sin(a);
    void dist;
  }

  /** One bolts, the herd bolts: nearby skittish animals take the hint. */
  private alertHerd(game: Game) {
    for (const e of game.area.entities) {
      if (!(e instanceof Animal) || e === this || e.dead || e.def.temper !== "skittish" || e.state === "flee") continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) > 70) continue;
      e.startFlee(game.player.x - e.x, game.player.y - e.y, 1);
    }
  }

  private startFlee(dx: number, dy: number, dist: number) {
    this.state = "flee";
    this.timer = 1.4 + Math.random() * 0.8;
    this.aimAway(dx, dy, dist);
  }

  private startCharge(dx: number, dy: number, dist: number) {
    this.state = "charge";
    this.timer = 0.7;
    this.hitDone = false;
    this.dirX = dx / (dist || 1);
    this.dirY = dy / (dist || 1);
    audio.sfx("enemy_hit", { pitch: 0.6 });
  }

  takeHit(game: Game, damage: number, crit: boolean, fromX: number, fromY: number): void {
    if (this.dead) return;
    this.flash = 0.15;
    game.fx.text(this.x, this.y - ASSETS.animals[this.def.sprite].frameH - 2, crit ? `${damage}!` : `${damage}`, crit ? 0xffd54f : 0xffffff, { size: crit ? 10 : 8, bold: crit });
    if (this.def.temper === "tame") {
      // You can't hunt Duchess. She'd never forgive you. Neither would Hob.
      this.startFlee(fromX - this.x, fromY - this.y, 1);
      audio.sfx("deny", { pitch: 1.6 });
      return;
    }
    this.hp -= damage;
    game.fx.burst(this.x, this.centerY, "blood", 4, { speed: 30, up: 30 });
    audio.sfx("enemy_hit", { pitch: 1.3 });
    if (this.hp <= 0) {
      this.die(game);
      return;
    }
    const dx = game.player.x - this.x;
    const dy = game.player.y - this.y;
    if (this.def.temper === "aggressive") this.startCharge(dx, dy, Math.hypot(dx, dy));
    else {
      this.startFlee(dx, dy, Math.hypot(dx, dy));
      this.alertHerd(game);
    }
  }

  private die(game: Game) {
    this.state = "dying";
    this.sprite.stop();
    this.sprite.rotation = this.facingLeft ? -Math.PI / 2 : Math.PI / 2;
    this.sprite.y = -2;
    const talents = usePlayerStore.getState().talents;
    const drops = rollLoot(this.def.drops, game.playerStats().luck);
    // Hunter talent: a chance of a second helping of everything.
    if (Math.random() < huntDropChance(talents)) drops.push(...rollLoot(this.def.drops, game.playerStats().luck));
    for (const l of drops) game.spawnPickup(this.x, this.y - 4, "item", l.itemId, l.quantity);
    awardSkillXp("gathering", this.def.xp);
    grantXp(this.def.xp);
    useSocialStore.getState().addDeed("animalsHunted");
    gameEvents.emit("animalHunted", { animalId: this.def.id });
  }
}
