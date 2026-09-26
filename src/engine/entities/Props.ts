import { AnimatedSprite, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { Entity, type Hittable, type Interactable } from "./Entity";
import type { Game } from "../Game";
import type { LightSource } from "../fx/Lighting";
import type { InteractionPrompt } from "../../store/uiStore";
import { CharacterSprite, type AnimDef } from "./CharacterSprite";
import { characterFrames } from "../textures";
import { getNpc, NPCS, type NpcDef } from "../../data/npcs";
import { dialogueFor, hitLine, npcAvailable } from "../../game/npcs";
import { questMarker } from "../../game/quests";
import { WORLD_FONT } from "../../game/core/constants";
import { npcLines, npcName } from "../../i18n/content";
import { usePlayerStore } from "../../store/playerStore";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { audio } from "../../game/audio/AudioManager";
import { t } from "../../i18n";
import type { Direction } from "../../game/core/types";
import { VILLAGER_LAYERS, applyLook, randomLook, villagerAnims, type VillagerLook } from "./villager";

/** A static (or looping animated) sprite anchored at its base. */
export class Prop extends Entity {
  readonly sprite: Sprite;
  private lightDef: LightSource | null = null;

  constructor(x: number, y: number, texture: Texture | Texture[], opts: { anchorY?: number; fps?: number; flat?: boolean; scale?: number; tint?: number; alpha?: number } = {}) {
    super(x, y);
    if (Array.isArray(texture)) {
      const a = new AnimatedSprite(texture);
      a.animationSpeed = (opts.fps ?? 8) / 60;
      a.gotoAndPlay(Math.floor(Math.random() * texture.length));
      this.sprite = a;
    } else {
      this.sprite = new Sprite(texture);
    }
    this.sprite.anchor.set(0.5, opts.anchorY ?? 1);
    if (opts.scale) this.sprite.scale.set(opts.scale);
    if (opts.tint !== undefined) this.sprite.tint = opts.tint;
    if (opts.alpha !== undefined) this.sprite.alpha = opts.alpha;
    // Flat things (rugs, decals, flowers) always draw under characters.
    if (opts.flat) this.sortBias = -10000;
    this.flat = !!opts.flat;
    this.view.addChild(this.sprite);
  }

  /** Tall props (trees, buildings) go see-through while the player is
   * hidden behind them, so you never lose your character in a forest. */
  fadeBehind = false;
  private readonly flat: boolean;

  /** Can be baked into the ground: flat, still, unlit, never changes. */
  get isDecal(): boolean {
    return this.flat && !this.fadeBehind && !this.lightDef && !(this.sprite instanceof AnimatedSprite);
  }

  get isStatic(): boolean {
    return !this.fadeBehind;
  }

  update(dt: number, game: Game): void {
    if (!this.fadeBehind) return;
    const p = game.player;
    const s = this.sprite;
    // Cheap reject: most trees are nowhere near the player and fully opaque.
    if (s.alpha === 1 && (Math.abs(p.x - this.x) > 48 || p.y > this.y || p.y < this.y - 140)) return;
    const behind =
      p.y < this.y - 2 &&
      p.y > this.y - s.height + 6 &&
      Math.abs(p.x - this.x) < s.width * 0.42;
    const target = behind ? 0.45 : 1;
    s.alpha += (target - s.alpha) * Math.min(1, dt * 10);
    if (Math.abs(s.alpha - target) < 0.01) s.alpha = target;
  }

  withLight(light: Omit<LightSource, "x" | "y"> & { dx?: number; dy?: number }): this {
    this.lightDef = { ...light, x: this.x + (light.dx ?? 0), y: this.y + (light.dy ?? 0) };
    return this;
  }

  light(): LightSource | null {
    return this.lightDef;
  }
}

/** Invisible (or marker-only) interaction point: doors, beds, signs, tables. */
export class InteractSpot extends Entity implements Interactable {
  interactRadius: number;
  interactPriority: number;
  private marker: Graphics | null = null;
  private age = 0;

  private promptFn: (game: Game) => InteractionPrompt | null;
  private onInteract: (game: Game) => void;

  constructor(
    x: number,
    y: number,
    promptFn: (game: Game) => InteractionPrompt | null,
    onInteract: (game: Game) => void,
    opts: { radius?: number; priority?: number; marker?: boolean } = {},
  ) {
    super(x, y);
    this.promptFn = promptFn;
    this.onInteract = onInteract;
    this.interactRadius = opts.radius ?? 18;
    this.interactPriority = opts.priority ?? 2;
    if (opts.marker) {
      // A soft pulsing ground marker for exits / important spots.
      this.marker = new Graphics();
      this.view.addChild(this.marker);
      this.sortBias = -10000;
    }
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y;
  }

  prompt(game: Game) {
    return this.promptFn(game);
  }

  interact(game: Game) {
    this.onInteract(game);
  }

  update(dt: number): void {
    if (!this.marker) return;
    this.age += dt;
    const a = 0.25 + Math.sin(this.age * 3) * 0.15;
    this.marker.clear().ellipse(0, 0, 9, 3.5).fill({ color: 0xffe6a0, alpha: a });
  }
}

/**
 * A townsperson: idles (or strolls between waypoints), turns to face you,
 * talks on interact, chatters now and then (see BarkDirector), and reacts —
 * loudly — if you hit them. Most are created from data/npcs.ts via `npc()`.
 */
export class Npc extends Entity implements Interactable, Hittable {
  private body: CharacterSprite;
  interactRadius = 22;
  interactPriority = 0;
  readonly collider?: { w: number; h: number };
  /** Data definition (null for generic, unnamed extras). */
  readonly def: NpcDef | null;
  readonly stats = { maxHp: 1, attack: 0, defense: 0, crit: 0, luck: 0 };
  readonly hitRadius = 6;
  readonly dead = false;

  private npcName: string;
  private talk: (game: Game) => void;
  private verb: string | null;
  private route: { x: number; y: number }[] | null;
  private leg = 0;
  private pause = 0;
  private talking = 0;
  private flinch = 0;
  private hitCooldown = 0;
  private vx = 0;
  private vy = 0;
  facingLeft = false;
  /** Villagers can face all four ways; pack sprites only left/right. */
  private dir: Direction = "side";
  private readonly directional: boolean;
  private restDir: Direction;
  private anim: "idle" | "walk" = "idle";
  /** "!" / "?" over their head when they've quest business with you. */
  private marker: Text | null = null;
  private markerCheck = Math.random() * 0.5;
  private markerTime = 0;
  /** Walking somewhere on their own (schedules): overrides the route. */
  private errand: { x: number; y: number; onArrive?: () => void } | null = null;

  constructor(
    x: number,
    y: number,
    visual: string | VillagerLook,
    npcName: string,
    talk: (game: Game) => void,
    opts: { facingLeft?: boolean; face?: Direction; verb?: string; tint?: number; route?: { x: number; y: number }[]; def?: NpcDef } = {},
  ) {
    super(x, y);
    this.def = opts.def ?? null;
    this.npcName = npcName;
    this.talk = talk;
    this.route = opts.route && opts.route.length > 1 ? opts.route : null;
    // Wanderers don't block (they'd trap the player in doorways), and
    // neither do people with a schedule: a collider stays where it was
    // registered, and they'll walk off later.
    if (!this.route && !opts.def?.schedule) this.collider = { w: 10, h: 5 };
    this.facingLeft = !!opts.facingLeft;
    if (typeof visual === "string") {
      this.directional = false;
      const anims: Record<string, AnimDef> = {};
      const idle = characterFrames(visual, "idle");
      anims.idle = { frames: idle.frames, anchorX: idle.meta.anchorX, anchorY: idle.meta.anchorY, fps: 5, loop: true };
      for (const walkName of ["walk", "run"]) {
        try {
          const walk = characterFrames(visual, walkName);
          anims.walk = { frames: walk.frames, anchorX: walk.meta.anchorX, anchorY: walk.meta.anchorY, fps: walkName === "run" ? 7 : 9, loop: true };
          break;
        } catch {
          /* idle-only sprite */
        }
      }
      this.body = new CharacterSprite(anims, "idle", 1, 11);
      if (opts.tint) this.body.sprite.tint = opts.tint;
    } else {
      this.directional = true;
      this.dir = opts.face ?? (opts.facingLeft !== undefined ? "side" : "down");
      this.body = new CharacterSprite(villagerAnims(), `idle_${this.dir}`, visual.scale ?? 1, 11, [...VILLAGER_LAYERS]);
      applyLook(this.body, visual);
    }
    this.restDir = this.dir;
    this.body.sprite.gotoAndPlay(Math.floor(Math.random() * this.body.frameCount));
    this.body.setFlip(this.facingLeft);
    this.view.addChild(this.body.view);
    this.verb = opts.verb ?? null;
    this.pause = Math.random() * 3;
  }

  /** Replace what happens when you talk to them (happenings, scenes). */
  setTalk(fn: (game: Game) => void): void {
    this.talk = fn;
  }

  /** Busy talking (or being told off). */
  get busy(): boolean {
    return this.talking > 0 || this.flinch > 0;
  }

  private play(anim: "idle" | "walk") {
    this.anim = anim;
    const key = this.directional ? `${anim}_${this.dir}` : anim;
    this.body.play(this.body.has(key) ? key : this.directional ? `idle_${this.dir}` : "idle");
  }

  /** Turn toward a point (four ways for villagers, left/right otherwise). */
  faceToward(tx: number, ty: number) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    if (this.directional && Math.abs(dy) > Math.abs(dx) * 1.1) this.setDir(dy < 0 ? "up" : "down", this.facingLeft);
    else this.setDir("side", dx < 0);
  }

  private setDir(dir: Direction, left: boolean) {
    const changed = dir !== this.dir;
    this.dir = this.directional ? dir : "side";
    this.facingLeft = left;
    this.body.setFlip(this.dir === "side" && left);
    if (changed) this.play(this.anim);
  }

  /** Scheduled townsfolk: the spot they're at / heading to. */
  spot: string | null = null;

  /** Stroll between these points (or stand still with null). */
  setRoute(route: { x: number; y: number }[] | null) {
    this.route = route && route.length > 1 ? route : null;
    this.leg = 0;
  }

  /** Walk to a point, then (optionally) do something — e.g. go indoors. */
  walkTo(x: number, y: number, onArrive?: () => void) {
    this.errand = { x, y, onArrive };
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y;
  }

  get centerY(): number {
    return this.y - 12;
  }

  /** Head position for speech bubbles. */
  headPoint(): { x: number; y: number } | null {
    return this.removed ? null : { x: this.x, y: this.y - 30 };
  }

  get displayName(): string {
    return this.def ? npcName(this.def) : this.npcName;
  }

  prompt() {
    const verb = this.verb === "Gamble with" ? t("prompt.gamble") : this.verb ?? t("prompt.talk");
    return { verb, target: this.displayName, alt: this.def && NPCS[this.def.id] ? { action: "gift" as const, label: t("gift.give") } : undefined };
  }

  interact(game: Game) {
    this.faceToward(game.player.x, game.player.y);
    this.talking = 2.5;
    this.play("idle");
    this.talk(game);
  }

  /** Say something out loud (speech bubble). */
  say(game: Game, text: string, life = 3.2): void {
    game.fx.bubble(text, () => this.headPoint(), life);
  }

  /** Can this person see a point? (Used by stealing.) Close and roughly
   * facing it, or right next to it. */
  notices(x: number, y: number): number {
    const d = Math.hypot(x - this.x, y - this.y);
    if (d > 110) return 0;
    const facing = (x < this.x) === this.facingLeft || Math.abs(x - this.x) < 8;
    return Math.max(0, 1 - d / 120) * (facing ? 1 : 0.35);
  }

  /** Hit by the player's sword: no damage, but a scene (and Honor). */
  takeHit(game: Game, _damage: number, _crit: boolean, fromX: number, fromY: number): void {
    this.flinch = 0.25;
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.vx = ((this.x - fromX) / d) * 60;
    this.vy = ((this.y - fromY) / d) * 60;
    this.faceToward(fromX, fromY);
    if (this.hitCooldown > 0) return;
    this.hitCooldown = 3;
    this.say(game, this.def ? hitLine(this.def) : t("npc.ow1"));
    onNpcHit(this);
  }

  private updateMarker(dt: number) {
    if (!this.def) return;
    this.markerCheck -= dt;
    this.markerTime += dt;
    if (this.markerCheck <= 0) {
      this.markerCheck = 0.5;
      const m = questMarker(this.def.id);
      if (m && !this.marker) {
        this.marker = new Text({ text: m, style: { fontFamily: WORLD_FONT, fontSize: 11, fontWeight: "700", fill: 0xffd54f, stroke: { color: 0x1a1016, width: 3 } }, resolution: 8 });
        this.marker.anchor.set(0.5, 1);
        this.view.addChild(this.marker);
      } else if (!m && this.marker) {
        this.marker.destroy();
        this.marker = null;
      }
      if (this.marker && m) {
        this.marker.text = m;
        this.marker.style.fill = m === "?" ? 0x9fe8ff : 0xffd54f;
      }
    }
    if (this.marker) this.marker.y = -34 + Math.round(Math.sin(this.markerTime * 4) * 1.5);
  }

  update(dt: number, game: Game) {
    this.updateMarker(dt);
    const d = Math.abs(game.player.x - this.x) + Math.abs(game.player.y - this.y);
    this.talking = Math.max(0, this.talking - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (this.flinch > 0) {
      this.flinch -= dt;
      this.body.flash(Math.max(0, this.flinch * 3));
      const r = game.area.collision.move(this.x, this.y, 8, 4, this.vx * dt, this.vy * dt);
      this.x = r.x;
      this.y = r.y;
      this.vx *= Math.pow(0.02, dt);
      this.vy *= Math.pow(0.02, dt);
      if (this.flinch <= 0) this.body.flash(0);
      return;
    }
    // Errands (going home, heading to the tavern) come first.
    if (this.errand && this.talking <= 0) {
      if (this.step(this.errand.x, this.errand.y, dt, 30)) {
        const onArrive = this.errand.onArrive;
        this.errand = null;
        this.play("idle");
        onArrive?.();
      }
      return;
    }
    // Strollers stop to chat when you walk up to them.
    if (this.route && this.talking <= 0 && d > 30) {
      this.pause -= dt;
      if (this.pause <= 0) {
        const target = this.route[this.leg];
        if (this.step(target.x, target.y, dt, 22)) {
          this.leg = (this.leg + 1) % this.route.length;
          this.pause = 1.5 + Math.random() * 3;
          this.play("idle");
        }
        return;
      }
    }
    if (this.anim === "walk") this.play("idle");
    if (d < 48) this.faceToward(game.player.x, game.player.y);
    else if (this.directional && this.dir !== this.restDir && this.talking <= 0 && !this.route) this.setDir(this.restDir, this.facingLeft);
  }

  /** One frame of walking toward a point; true once there. */
  private step(tx: number, ty: number, dt: number, speed: number): boolean {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const s = Math.min(dist, speed * dt);
    this.x += (dx / dist) * s;
    this.y += (dy / dist) * s;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) this.faceToward(tx, ty);
    if (this.anim !== "walk") this.play(this.body.has(this.directional ? `walk_${this.dir}` : "walk") ? "walk" : "idle");
    return false;
  }
}

/** Honor + gossip for hitting a villager (set by game/social/crime). */
let onNpcHit: (npc: Npc) => void = () => {};
export function setNpcHitHandler(fn: (npc: Npc) => void): void {
  onNpcHit = fn;
}

/**
 * Place an NPC from data/npcs.ts. Returns null when they're not around
 * (opening hours, or off on one of their mysterious trips).
 */
export function npc(id: string, x: number, y: number, opts: { facingLeft?: boolean; face?: Direction; route?: { x: number; y: number }[] } = {}): Npc | null {
  const def = getNpc(id);
  if (!npcAvailable(def)) return null;
  return new Npc(x, y, npcVisual(def), def.name, (g) => talkTo(g, def), { ...opts, tint: def.tint, verb: def.verb, def });
}

/** Talking to a named NPC: their dialogue, plus any daily service. */
function talkTo(g: Game, def: NpcDef) {
  // Healers heal, but quest business comes first.
  if (def.service === "heal" && !questMarker(def.id)) {
    const p = usePlayerStore.getState();
    const hurt = p.hp < playerEffectiveStats(p).maxHp;
    const lines = npcLines(def, hurt ? "healed" : "healthy") ?? [];
    if (hurt) {
      p.fullHeal();
      audio.sfx("potion");
      g.fx.burst(g.player.x, g.player.y - 12, "heal", 16, { speed: 20, up: 50 });
    }
    g.ui.showDialogue({ speaker: npcName(def), portrait: def.portrait, lines: [...lines] });
    return;
  }
  g.ui.showDialogue(dialogueFor(def));
}

/** A named NPC's look: a villager outfit when defined, else their pack sprite. */
export function npcVisual(def: NpcDef): string | VillagerLook {
  if (!def.look) return def.sprite;
  return typeof def.look === "string" ? randomLook(def.look, def.id) : def.look;
}

/**
 * Something small you could pocket (a pie on a sill, a tankard, a tip jar).
 * Shows its icon; gone for the day once taken. See game/social/crime.ts.
 */
export class StealSpot extends Entity implements Interactable {
  interactRadius = 14;
  interactPriority = 3;
  private sprite: Sprite;
  private steal: StealDefLike;
  private onSteal: (game: Game) => void;
  private isUsed: () => boolean;

  constructor(x: number, y: number, icon: Texture, steal: StealDefLike, onSteal: (game: Game) => void, isUsed: () => boolean) {
    super(x, y);
    this.steal = steal;
    this.onSteal = onSteal;
    this.isUsed = isUsed;
    this.sprite = new Sprite(icon);
    this.sprite.anchor.set(0.5, 1);
    this.view.addChild(this.sprite);
    this.sortBias = 2;
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y + 6;
  }

  prompt() {
    if (this.isUsed()) return null;
    return { verb: t("prompt.pocket"), target: t(this.steal.target) };
  }

  interact(game: Game) {
    if (this.isUsed()) return;
    this.onSteal(game);
  }

  update() {
    this.sprite.visible = !this.isUsed();
  }
}

type StealDefLike = { target: import("../../i18n").TKey };
