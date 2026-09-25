import { Graphics, Text } from "pixi.js";
import { Entity, isHittable, type HitInfo, type Hittable } from "./Entity";
import type { Game } from "../Game";
import { CharacterSprite, type AnimDef } from "./CharacterSprite";
import { characterFrames } from "../textures";
import { PARRYABLE, enemyTitle, getEnemy, scaledStats, type AttackKind, type EnemyDef, type EnemyRank } from "../../data/enemies";
import type { Stats } from "../../game/core/types";
import { resolveAttack } from "../../game/systems/combatSystem";
import { counterStunMult } from "../../data/talents";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { usePlayerStore } from "../../store/playerStore";
import { audio } from "../../game/audio/AudioManager";
import type { LightSource } from "../fx/Lighting";
import { Projectile } from "./Projectile";
import { eventActive } from "../../game/social/worldEvents";
import { t, tl } from "../../i18n";
import { AFFIX_COLOR, BANE_MULT, GUARD_MULT, PARRY, RESIST_MULT, WEAK_MULT, rollAffixes, type Affix } from "../../data/combat";
import { WORLD_FONT } from "../../game/core/constants";

type AIState = "idle" | "wander" | "chase" | "circle" | "windup" | "lunge" | "charge" | "recover" | "hurt" | "stunned" | "flee" | "dying" | "dead";

const COLLIDER = { w: 10, h: 6 };

/** Per pattern: telegraph length (× the enemy's wind-up) and damage multiplier. */
const PATTERN: Record<AttackKind, { windup: number; damage: number }> = {
  lunge: { windup: 1, damage: 1 },
  combo: { windup: 1, damage: 0.8 },
  slam: { windup: 1.3, damage: 1.35 },
  charge: { windup: 1.15, damage: 1.25 },
  shot: { windup: 1, damage: 1 },
  volley: { windup: 1.15, damage: 0.85 },
  summon: { windup: 1.3, damage: 0 },
  heal: { windup: 0.9, damage: 0 },
  explode: { windup: 1, damage: 1.6 },
};

const MELEE = new Set<AttackKind>(["lunge", "combo", "slam", "charge", "explode"]);

/**
 * A monster with a small, readable state machine:
 *
 *   idle/wander --(sees you)--> chase --(in range, has a token)--> windup
 *        ^                        |  (no token / on cooldown) -> circle
 *        |                        v
 *        +---- recover <---- strike (lunge / slam / charge / shot…)
 *
 * Every attack is telegraphed on the ground (wedge, circle, lane, aim line)
 * so the player can read it and choose: hit first, dodge, or step out. Only
 * a couple of melee monsters wind up at once (attack tokens); the rest
 * circle, which keeps fights readable and positioning meaningful.
 *
 * Elites roll affixes (swift, armored, vampiric, frenzied, explosive,
 * shielded); bosses gain new patterns below half health.
 */
export class Enemy extends Entity implements Hittable {
  readonly def: EnemyDef;
  readonly stats: Stats;
  hp: number;
  private body: CharacterSprite;
  private hpBar = new Graphics();
  /** Little stars circling the head while stunned: "hit me now". */
  private dizzy = new Graphics();
  /** Ground telegraph, drawn under the body. */
  private tele = new Graphics();
  private shieldG: Graphics | null = null;
  private label: Text | null = null;
  state: AIState = "idle";
  private timer = 0;
  private homeX: number;
  private homeY: number;
  private wanderX = 0;
  private wanderY = 0;
  private vx = 0;
  private vy = 0;
  private lungeDX = 0;
  private lungeDY = 0;
  private dealtDamage = false;
  private flash = 0;
  private showBar = 0;
  private cooldown = 0;
  private facingLeft = false;
  private turnTimer = 0;
  private circleSign = Math.random() < 0.5 ? 1 : -1;
  private attack: AttackKind = "lunge";
  /** The attack it means to use next (picked once, so it commits to a plan). */
  private planned: AttackKind | null = null;
  private strikesLeft = 0;
  private windupTotal = 1;
  private chargeFrom = { x: 0, y: 0 };
  private labelTimer = 0;
  /** Hits left before a flinch; refills after a moment of not being hit. */
  private poise: number;
  private readonly maxPoise: number;
  private poiseRegen = 0;
  /** On strike days orcs ignore you until you start something. */
  private provoked = false;
  private strikeBark = 0;
  private fled = false;
  private enraged = false;
  private frenzy = false;
  private guardDown = 0;
  private minions: Enemy[] = [];
  private teleDrawn = false;

  readonly spawnId: string;
  readonly floor: number;
  readonly rank: EnemyRank;
  /** Holds this floor's stairs (gets the big health bar). */
  readonly guardian: boolean;
  /** Raised by a summoner: worth little, drops nothing. */
  readonly summoned: boolean;
  readonly affixes: Affix[];
  readonly name: string;
  private scale: number;
  private speed: number;

  constructor(x: number, y: number, defId: string, spawnId: string, floor: number, rank: EnemyRank, guardian = false, opts: { summoned?: boolean } = {}) {
    super(x, y);
    this.spawnId = spawnId;
    this.floor = floor;
    this.rank = rank;
    this.guardian = guardian;
    this.summoned = !!opts.summoned;
    this.def = getEnemy(defId);
    const innate = this.def.innate ?? [];
    this.affixes = [...innate, ...(rank === "elite" ? rollAffixes(`${spawnId}:${floor}:${defId}`, floor, innate) : [])];
    const stats = scaledStats(this.def, floor, rank);
    if (this.has("armored")) stats.defense += 3;
    this.stats = stats;
    this.name = enemyTitle(this.def, floor, rank);
    this.scale = (this.def.scale ?? 1) * (rank === "elite" ? 1.12 : 1);
    this.speed = this.def.speed * (this.has("swift") ? 1.35 : 1);
    this.hp = this.stats.maxHp;
    this.maxPoise = (this.def.poise ?? 2) + (rank === "elite" ? 2 : 0) + (this.has("armored") ? 3 : 0);
    this.poise = this.maxPoise;
    this.homeX = x;
    this.homeY = y;

    const anim = (name: string, fps: number, loop: boolean): AnimDef => {
      const { frames, meta } = characterFrames(this.def.sprite, name);
      return { frames, anchorX: meta.anchorX, anchorY: meta.anchorY, fps, loop };
    };
    this.body = new CharacterSprite(
      { idle: anim("idle", 6, true), run: anim("run", 11, true), death: anim("death", 10, false) },
      "idle",
      this.scale,
      12,
    );
    this.body.sprite.tint = this.baseTint;
    this.view.addChild(this.tele, this.body.view, this.hpBar, this.dizzy);
    if (this.guarded) {
      this.shieldG = new Graphics();
      this.shieldG.roundRect(-3, -8, 6, 11, 2).fill(0x5a6a88).stroke({ width: 1, color: 0x1a1016 });
      this.shieldG.rect(-1, -6, 2, 7).fill(0xa8c0e8);
      this.view.addChild(this.shieldG);
    }
    // Elites wear their affixes over their heads.
    const shown = rank === "elite" ? this.affixes : [];
    if (shown.length) {
      this.label = new Text({
        text: shown.map((a) => t(`combat.affix.${a}`)).join(" · "),
        style: { fontFamily: WORLD_FONT, fontSize: 6, fill: AFFIX_COLOR[shown[0]], stroke: { color: 0x1a1016, width: 2 } },
        resolution: 8,
      });
      this.label.anchor.set(0.5, 1);
      this.label.y = -this.height - 7;
      this.view.addChild(this.label);
    }
    this.body.onComplete = (a) => {
      if (a === "death") this.state = "dead";
    };
    this.timer = Math.random() * 2;
  }

  has(a: Affix): boolean {
    return this.affixes.includes(a);
  }

  private get guarded(): boolean {
    return this.has("shielded");
  }

  /** Bosses (and floor guardians) get the big bar and slower knockback. */
  get isBoss(): boolean {
    return this.rank === "boss" || this.guardian;
  }

  private get baseTint(): number {
    if (this.frenzy) return 0xff9a80;
    if (this.has("armored")) return 0xc8ccd8;
    return this.rank === "elite" ? 0xffd890 : (this.def.tint ?? 0xffffff);
  }

  get dead(): boolean {
    return this.state === "dying" || this.state === "dead";
  }

  get height(): number {
    return 26 * this.scale;
  }

  /** Point used for hit checks (roughly the torso). */
  get centerY(): number {
    return this.y - this.height * 0.45;
  }

  get hitRadius(): number {
    return 6 * this.scale;
  }

  /** Busy with a melee attack (counts against the attack tokens). */
  get engaging(): boolean {
    return (this.state === "windup" && MELEE.has(this.attack)) || this.state === "lunge" || this.state === "charge";
  }

  /** About to hit the player right now: a dodge now is a perfect dodge. */
  threatens(px: number, py: number, window: number): boolean {
    const d = Math.hypot(px - this.x, py - this.y);
    if (this.state === "windup" && MELEE.has(this.attack) && this.timer <= window) {
      const reach = this.attack === "charge" ? 90 : this.attack === "slam" || this.attack === "explode" ? this.slamRadius + 10 : this.def.attackRange * this.scale + 34;
      return d < reach;
    }
    return (this.state === "lunge" || this.state === "charge") && d < 40;
  }

  /** True if a hit from `fromX` lands on its back. */
  isBehind(fromX: number): boolean {
    return (fromX < this.x) !== this.facingLeft && Math.abs(fromX - this.x) > 2;
  }

  private get slamRadius(): number {
    return this.attack === "explode" ? 34 : 26 * this.scale;
  }

  update(dt: number, game: Game): void {
    this.timer -= dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.labelTimer = Math.max(0, this.labelTimer - dt);
    this.guardDown = Math.max(0, this.guardDown - dt);
    this.poiseRegen -= dt;
    if (this.poiseRegen <= 0) this.poise = this.maxPoise;
    this.flash = Math.max(0, this.flash - dt);
    this.showBar = Math.max(0, this.showBar - dt);

    if (this.state === "dead") {
      this.view.alpha -= dt * 1.2;
      if (this.view.alpha <= 0) game.removeEntity(this);
      return;
    }
    if (this.state === "dying") return;

    const p = game.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const playerAlive = p.state !== "dead";

    const onStrike = !this.provoked && !this.isBoss && this.def.sprite.startsWith("orc") && eventActive("strike");
    if (onStrike && (this.state === "idle" || this.state === "wander")) {
      this.strikeBark -= dt;
      if (dist < 70 && this.strikeBark <= 0) {
        this.strikeBark = 6 + Math.random() * 6;
        const lines = tl("events.strikeChants");
        game.fx.bubble(lines[Math.floor(Math.random() * lines.length)], () => (this.removed || this.dead ? null : { x: this.x, y: this.y - this.height - 6 }), 2.6, 0xffe0a0);
      }
    }

    if (this.teleDrawn) {
      this.tele.clear();
      this.teleDrawn = false;
    }
    switch (this.state) {
      case "idle":
        this.body.play("idle");
        if (playerAlive && dist < this.def.aggroRange && !onStrike) this.aggro(game);
        else if (this.timer <= 0) {
          this.state = "wander";
          this.timer = 1 + Math.random() * 1.5;
          const a = Math.random() * Math.PI * 2;
          this.wanderX = Math.cos(a);
          this.wanderY = Math.sin(a);
        }
        break;
      case "wander": {
        this.body.play("run");
        const home = Math.hypot(this.homeX - this.x, this.homeY - this.y);
        if (home > 40) {
          this.wanderX = (this.homeX - this.x) / home;
          this.wanderY = (this.homeY - this.y) / home;
        }
        this.step(game, this.wanderX * this.speed * 0.4 * dt, this.wanderY * this.speed * 0.4 * dt);
        if (playerAlive && dist < this.def.aggroRange && !onStrike) this.aggro(game);
        else if (this.timer <= 0) {
          this.state = "idle";
          this.timer = 1.5 + Math.random() * 2.5;
        }
        break;
      }
      case "chase":
      case "circle": {
        if (!playerAlive || dist > this.def.aggroRange * 2.2) {
          this.state = "idle";
          this.timer = 1;
          break;
        }
        if (this.def.fleeBelow && !this.fled && this.hp < this.stats.maxHp * this.def.fleeBelow) {
          this.fled = true;
          this.state = "flee";
          this.timer = 2.2;
          game.fx.text(this.x, this.y - this.height - 6, t("combat.flee"), 0xfff0c0, { size: 7, life: 0.8 });
          break;
        }
        this.body.play("run");
        if (this.ranged) {
          this.rangedMove(game, dt, dx, dy, dist);
          if (dist <= this.def.attackRange && this.cooldown <= 0) this.beginWindup(game, dx, dy, dist);
          break;
        }
        const kind = (this.planned ??= this.nextAttack());
        const inRange = dist <= this.def.attackRange + 6 || (kind === "charge" && dist < 110 && dist > 36) || ((kind === "slam" || kind === "explode") && dist < this.slamRadius);
        const canAttack = this.cooldown <= 0 && (this.isBoss || kind === "explode" || game.attackTokenFree(this));
        if (inRange && canAttack) {
          this.attack = kind;
          this.planned = null;
          this.beginWindup(game, dx, dy, dist);
          break;
        }
        // Close but waiting (cooldown or no token): circle instead of standing.
        const close = dist < this.def.attackRange + 26;
        if (close && !canAttack && !this.isBoss) {
          this.state = "circle";
          const keep = this.def.attackRange + 16;
          const tx = (-dy / dist) * this.circleSign;
          const ty = (dx / dist) * this.circleSign;
          const radial = (dist - keep) / 12;
          const sep = game.enemySeparation(this);
          let mx = tx * 0.8 + (dx / dist) * radial + sep.x;
          let my = ty * 0.8 + (dy / dist) * radial + sep.y;
          const ml = Math.hypot(mx, my) || 1;
          mx /= ml;
          my /= ml;
          const before = { x: this.x, y: this.y };
          this.step(game, mx * this.speed * 0.55 * dt, my * this.speed * 0.55 * dt);
          if (Math.hypot(this.x - before.x, this.y - before.y) < this.speed * 0.1 * dt) this.circleSign *= -1;
        } else if (dist > this.def.attackRange - 2) {
          this.state = "chase";
          // Separation from other enemies so packs don't stack into one sprite.
          const sep = game.enemySeparation(this);
          const mx = dx / dist + sep.x;
          const my = dy / dist + sep.y;
          const ml = Math.hypot(mx, my) || 1;
          const sp = this.speed * (this.frenzy ? 1.2 : 1);
          this.step(game, (mx / ml) * sp * dt, (my / ml) * sp * dt);
        }
        break;
      }
      case "flee": {
        this.body.play("run");
        this.step(game, (-dx / dist) * this.speed * 1.1 * dt, (-dy / dist) * this.speed * 1.1 * dt);
        if (this.timer <= 0) this.state = "chase";
        break;
      }
      case "windup":
        this.windup(game, dt, dx, dy, dist);
        break;
      case "lunge": {
        this.body.play("run");
        const sp = this.speed * 3.2 + 60;
        this.step(game, this.lungeDX * sp * dt, this.lungeDY * sp * dt);
        const reach = this.def.attackRange * this.scale;
        if (!this.dealtDamage && Math.hypot(p.x - this.x, p.y - this.y) < reach) {
          this.dealtDamage = true;
          this.hitPlayer(game, PATTERN[this.attack].damage);
        }
        if (this.timer <= 0) {
          if (this.strikesLeft > 0) {
            // Next hit of the combo: a short, re-aimed wind-up.
            this.strikesLeft--;
            this.state = "windup";
            this.timer = this.windupTotal = 0.2;
            this.aimAt(dx, dy, dist);
            break;
          }
          this.state = "recover";
          this.timer = 0.35;
          this.cooldown = this.cooldownTime();
        }
        break;
      }
      case "charge": {
        this.body.play("run");
        this.body.setSpeed(1.8);
        const sp = Math.max(170, this.speed * 3.6);
        const bx = this.x;
        const by = this.y;
        this.step(game, this.lungeDX * sp * dt, this.lungeDY * sp * dt);
        if (Math.random() < dt * 30) game.fx.burst(this.x, this.y, "dust", 1, { speed: 14, up: 10, height: 1, life: 0.35 });
        if (!this.dealtDamage && Math.hypot(p.x - this.x, p.y - this.y) < 14 * this.scale) {
          this.dealtDamage = true;
          this.hitPlayer(game, PATTERN.charge.damage);
        }
        const moved = Math.hypot(this.x - bx, this.y - by);
        if (moved < sp * dt * 0.3 && this.timer < 0.5) {
          // Slammed into a wall: dazed and wide open.
          this.body.setSpeed(1);
          game.shake(2.5, 0.2);
          game.fx.burst(this.x + this.lungeDX * 6, this.y - 8, "stone", 10, { speed: 40, up: 30 });
          audio.sfx("hit", { pitch: 0.6 });
          this.stun(game, 1.4);
          break;
        }
        if (this.timer <= 0 || Math.hypot(this.x - this.chargeFrom.x, this.y - this.chargeFrom.y) > 150) {
          this.body.setSpeed(1);
          this.state = "recover";
          this.timer = 0.5;
          this.cooldown = this.cooldownTime();
        }
        break;
      }
      case "recover":
        this.body.play("idle");
        if (this.timer <= 0) this.state = "chase";
        break;
      case "stunned":
        this.body.play("idle");
        this.body.sprite.x = Math.sin(this.timer * 40) * 1;
        this.drawDizzy();
        if (this.timer <= 0) {
          this.body.sprite.x = 0;
          this.dizzy.clear();
          this.state = "chase";
        }
        break;
      case "hurt":
        this.step(game, this.vx * dt, this.vy * dt);
        this.vx *= Math.pow(0.002, dt);
        this.vy *= Math.pow(0.002, dt);
        if (this.timer <= 0) this.state = "chase";
        break;
    }

    // Whatever ended the stun, the stars go with it.
    if (this.state !== "stunned" && this.dizzyShown) {
      this.dizzy.clear();
      this.dizzyShown = false;
    }

    // Shielded enemies turn slowly: get round the side of them.
    this.turnTimer -= dt;
    const turnable = this.state !== "lunge" && this.state !== "charge" && this.state !== "hurt" && this.state !== "stunned";
    if (Math.abs(dx) > 2 && turnable && (!this.guarded || this.turnTimer <= 0)) {
      if (this.facingLeft !== dx < 0) this.turnTimer = 0.7;
      this.facingLeft = dx < 0;
    }
    if (this.state === "wander") this.facingLeft = this.wanderX < 0;
    if (this.state === "flee") this.facingLeft = dx > 0;
    this.body.setFlip(this.facingLeft);
    if (this.state !== "windup") this.body.sprite.tint = this.baseTint;
    if (this.shieldG) {
      this.shieldG.visible = this.guardDown <= 0 && this.state !== "stunned";
      this.shieldG.position.set(this.facingLeft ? -7 * this.scale : 7 * this.scale, -8 * this.scale);
    }
    // Hit flash: an additive white copy of the body, plus a squash-and-pop.
    this.body.flash(this.flash > 0 ? Math.min(1, this.flash / 0.1) * 0.85 : 0);
    const pop = this.flash > 0 ? this.flash / 0.12 : 0;
    this.body.view.scale.set(1 + pop * 0.14, 1 - pop * 0.12);
    // Floaters (ghosts, bats) drift above their shadow.
    if (this.def.hover) this.body.sprite.y = -4 + Math.sin(performance.now() / 260 + this.homeX) * 2;
    this.drawBar();
  }

  // ---------------------------------------------------------------------------
  // Attacks
  // ---------------------------------------------------------------------------

  private get ranged(): boolean {
    return this.def.behavior === "ranged";
  }

  private attackPool(): { kind: AttackKind; weight: number }[] {
    const base = this.def.attacks ?? [{ kind: this.ranged ? "shot" : "lunge", weight: 1 }];
    if (!this.enraged || !this.def.phase2) return base;
    return [...base, ...this.def.phase2.map((kind) => ({ kind, weight: 2 }))];
  }

  private nextAttack(): AttackKind {
    const pool = this.attackPool().filter((a) => (a.kind === "summon" ? this.minions.filter((m) => !m.dead && !m.removed).length < 4 : true));
    const total = pool.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    for (const a of pool) {
      r -= a.weight;
      if (r <= 0) return a.kind;
    }
    return pool[0]?.kind ?? "lunge";
  }

  private cooldownTime(): number {
    let cd = this.def.cooldownSec * (0.85 + Math.random() * 0.3);
    if (this.frenzy) cd *= 0.5;
    if (this.enraged) cd *= 0.8;
    return cd;
  }

  private aimAt(dx: number, dy: number, dist: number) {
    this.lungeDX = dx / dist;
    this.lungeDY = dy / dist;
  }

  private beginWindup(game: Game, dx: number, dy: number, dist: number) {
    if (this.ranged) this.attack = this.nextAttack();
    // Support casters with nobody to heal just shoot.
    if (this.attack === "heal" && !this.healTarget(game)) this.attack = "shot";
    this.state = "windup";
    let w = this.def.windupSec * PATTERN[this.attack].windup;
    if (this.has("swift")) w *= 0.75;
    if (this.enraged) w *= 0.85;
    if (this.attack === "explode") w = 0.9;
    this.timer = this.windupTotal = w;
    this.strikesLeft = this.attack === "combo" ? (this.rank === "normal" ? 1 : 2) : 0;
    this.aimAt(dx, dy, dist);
    if (this.attack === "charge" || this.attack === "slam" || this.attack === "explode") audio.sfx("swing", { pitch: 0.5 });
  }

  private windup(game: Game, _dt: number, dx: number, dy: number, dist: number) {
    this.body.play("idle");
    const k = 1 - Math.max(0, this.timer) / this.windupTotal;
    // Lunges track you until the last moment; charges lock their lane early.
    if (this.attack !== "charge" || k < 0.45) this.aimAt(dx, dy, dist);
    this.body.sprite.tint = Math.floor(this.timer * (this.attack === "explode" ? 30 : 20)) % 2 ? 0xff5050 : 0xffffff;
    this.drawTelegraph(k);
    if (this.timer > 0) return;
    this.body.sprite.tint = this.baseTint;
    this.tele.clear();
    const p = game.player;
    switch (this.attack) {
      case "lunge":
      case "combo":
        this.state = "lunge";
        this.timer = 0.16;
        this.dealtDamage = false;
        return;
      case "charge":
        this.state = "charge";
        this.timer = 0.7;
        this.dealtDamage = false;
        this.chargeFrom = { x: this.x, y: this.y };
        audio.sfx("swing", { pitch: 0.6 });
        return;
      case "slam": {
        const r = this.slamRadius;
        game.fx.ring(this.x, this.y - 2, r, 0xffc080, 0.3);
        game.fx.burst(this.x, this.y, "dust", 16, { speed: 60, up: 30, height: 1 });
        game.shake(3, 0.25);
        audio.sfx("hit", { pitch: 0.5 });
        if (Math.hypot(p.x - this.x, p.y - this.y) < r + 4) this.hitPlayer(game, PATTERN.slam.damage);
        this.state = "recover";
        this.timer = 0.7;
        this.cooldown = this.cooldownTime();
        return;
      }
      case "explode":
        this.hp = 0;
        explode(game, this.x, this.y, 34, this.stats, this);
        this.die(game);
        return;
      case "shot":
        this.shoot(game, Math.atan2(p.y - 8 - (this.y - 10), p.x - this.x));
        break;
      case "volley": {
        const a = Math.atan2(p.y - 8 - (this.y - 10), p.x - this.x);
        for (const off of [-0.24, 0, 0.24]) this.shoot(game, a + off, PATTERN.volley.damage);
        break;
      }
      case "summon":
        this.summon(game);
        break;
      case "heal": {
        const ally = this.healTarget(game);
        if (ally) {
          const n = Math.round(ally.stats.maxHp * 0.3);
          ally.hp = Math.min(ally.stats.maxHp, ally.hp + n);
          ally.showBar = 2;
          game.fx.burst(ally.x, ally.centerY, "heal", 14, { speed: 20, up: 40 });
          game.fx.text(ally.x, ally.y - ally.height - 4, `+${n}`, 0x7dff7d, { size: 8, bold: true });
          audio.sfx("potion", { pitch: 0.8 });
        }
        break;
      }
    }
    this.state = "recover";
    this.timer = 0.45;
    this.cooldown = this.cooldownTime();
  }

  /** The ground telegraph for the current wind-up (k: 0 → 1 as it fills). */
  private drawTelegraph(k: number) {
    const g = this.tele;
    this.teleDrawn = true;
    const a = 0.12 + k * 0.3;
    // Red: parry or dodge. Amber: can't be parried — get out of the way.
    const red = PARRYABLE.has(this.attack) ? 0xff3a2a : 0xff9a1a;
    const ang = Math.atan2(this.lungeDY, this.lungeDX);
    switch (this.attack) {
      case "lunge":
      case "combo": {
        const len = this.def.attackRange * this.scale + 24;
        const spread = 0.42;
        g.moveTo(0, 0)
          .lineTo(Math.cos(ang - spread) * len, Math.sin(ang - spread) * len * 0.7)
          .lineTo(Math.cos(ang) * len * 1.08, Math.sin(ang) * len * 0.75)
          .lineTo(Math.cos(ang + spread) * len, Math.sin(ang + spread) * len * 0.7)
          .closePath()
          .fill({ color: red, alpha: a });
        break;
      }
      case "charge": {
        const len = 140;
        const hw = 6 * this.scale;
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const ex = Math.cos(ang) * len;
        const ey = Math.sin(ang) * len;
        g.poly([nx * hw, ny * hw, ex + nx * hw, ey + ny * hw, ex - nx * hw, ey - ny * hw, -nx * hw, -ny * hw]).fill({ color: red, alpha: a * 0.8 });
        g.poly([nx * hw, ny * hw, ex * k + nx * hw, ey * k + ny * hw, ex * k - nx * hw, ey * k - ny * hw, -nx * hw, -ny * hw]).fill({ color: red, alpha: 0.25 });
        break;
      }
      case "slam":
      case "explode": {
        const r = this.slamRadius;
        g.ellipse(0, 0, r, r * 0.7).fill({ color: this.attack === "explode" ? 0xffa020 : red, alpha: 0.1 }).stroke({ width: 1, color: red, alpha: 0.6 });
        g.ellipse(0, 0, r * k, r * 0.7 * k).fill({ color: red, alpha: 0.3 });
        break;
      }
      case "shot":
      case "volley": {
        const len = this.def.attackRange;
        g.moveTo(0, -10).lineTo(Math.cos(ang) * len, Math.sin(ang) * len - 10).stroke({ width: 1, color: this.def.shot ?? 0xffd0a0, alpha: 0.15 + k * 0.4 });
        break;
      }
      case "summon":
      case "heal": {
        const c = this.attack === "heal" ? 0x7dff7d : 0xb07aff;
        g.ellipse(0, 0, 14 * k + 4, (14 * k + 4) * 0.6).stroke({ width: 1, color: c, alpha: 0.8 });
        break;
      }
    }
  }

  private healTarget(game: Game): Enemy | null {
    let best: Enemy | null = null;
    for (const e of game.enemies()) {
      if (e === this || Math.hypot(e.x - this.x, e.y - this.y) > 100 || e.hp > e.stats.maxHp * 0.75) continue;
      if (!best || e.hp / e.stats.maxHp < best.hp / best.stats.maxHp) best = e;
    }
    return best;
  }

  private summon(game: Game) {
    const kinds = this.def.summons ?? ["bone_rattler"];
    const n = this.enraged ? 3 : 2;
    game.fx.ring(this.x, this.y - 4, 30, 0xb07aff, 0.5);
    audio.sfx("rare", { pitch: 0.5 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const x = this.x + Math.cos(a) * 22;
      const y = this.y + Math.sin(a) * 14;
      if (game.area.collision.blocked({ x: x - 5, y: y - 3, w: 10, h: 6 })) continue;
      const m = new Enemy(x, y, kinds[i % kinds.length], `${this.spawnId}:s${Math.floor(Math.random() * 1e6)}`, this.floor, "normal", false, { summoned: true });
      m.state = "chase";
      this.minions.push(m);
      game.area.add(m);
      game.fx.burst(x, y - 6, "bone", 8, { speed: 30, up: 40 });
    }
  }

  /** Deals this enemy's damage to the player (× pattern multiplier). */
  private hitPlayer(game: Game, mult: number) {
    if (PARRYABLE.has(this.attack) && game.player.tryParry(game, this.x, this.y)) {
      this.parried(game);
      return;
    }
    const defender = playerEffectiveStats(usePlayerStore.getState());
    const { damage } = resolveAttack({ ...this.stats, attack: this.stats.attack * mult }, defender);
    if (game.player.hurt(game, damage, this.x, this.y) && this.has("vampiric")) {
      const n = Math.max(1, Math.round(damage * 0.5));
      this.hp = Math.min(this.stats.maxHp, this.hp + n);
      game.fx.text(this.x, this.y - this.height - 4, `+${n}`, 0xff6a7a, { size: 7 });
      game.fx.burst(this.x, this.centerY, "blood", 5, { speed: 20, up: 30 });
    }
  }

  private shoot(game: Game, angle: number, mult = 1) {
    const stats = mult === 1 ? this.stats : { ...this.stats, attack: this.stats.attack * mult };
    game.area.add(new Projectile(this.x + Math.cos(angle) * 6, this.y, angle, { owner: "enemy", stats, speed: this.def.shotSpeed ?? 150, range: 190, orb: this.def.shot }));
    audio.sfx("swing", { pitch: this.def.shot !== undefined ? 0.8 : 1.4 });
  }

  /** Archers keep their distance and shoot when they have a line. */
  private rangedMove(game: Game, dt: number, dx: number, dy: number, dist: number) {
    const keep = this.def.keepAway ?? 60;
    const sep = game.enemySeparation(this);
    let mx = sep.x;
    let my = sep.y;
    if (dist < keep) {
      mx -= dx / dist;
      my -= dy / dist;
    } else if (dist > this.def.attackRange) {
      mx += dx / dist;
      my += dy / dist;
    } else {
      // In range: sidestep a little so they're not sitting ducks.
      mx += (-dy / dist) * this.circleSign * 0.4;
      my += (dx / dist) * this.circleSign * 0.4;
    }
    const ml = Math.hypot(mx, my);
    if (ml > 0.05) this.step(game, (mx / ml) * this.speed * dt, (my / ml) * this.speed * dt);
    else this.body.play("idle");
  }

  private aggro(game: Game) {
    this.state = "chase";
    game.fx.text(this.x, this.y - this.height - 6, "!", 0xffd54f, { size: 10, bold: true, life: 0.6 });
    if (this.isBoss) game.onBossAggro(this);
  }

  private step(game: Game, dx: number, dy: number) {
    const r = game.area.collision.move(this.x, this.y, COLLIDER.w, COLLIDER.h, dx, dy);
    this.x = r.x;
    this.y = r.y;
  }

  /** Three stars orbiting the head; they fade in the last half-second so
   * you can see the opening closing. */
  private dizzyShown = false;
  private drawDizzy() {
    this.dizzyShown = true;
    const g = this.dizzy.clear();
    const y = -this.height - 3;
    const a = Math.min(1, this.timer / 0.5);
    const t = performance.now() / 1000;
    for (let i = 0; i < 3; i++) {
      const ang = t * 5 + (i * Math.PI * 2) / 3;
      const x = Math.round(Math.cos(ang) * 7);
      const sy = Math.round(y + Math.sin(ang) * 2);
      const front = Math.sin(ang) > 0;
      g.rect(x - 1, sy, 3, 1).rect(x, sy - 1, 1, 3).fill({ color: front ? 0xfff2a0 : 0xc8a850, alpha: a });
    }
  }

  private stun(game: Game, time: number) {
    this.state = "stunned";
    this.timer = time;
    this.tele.clear();
    this.body.setSpeed(1);
    game.fx.text(this.x, this.y - this.height - 6, t("combat.stunned"), 0x9fd8ff, { size: 8, bold: true, life: 0.9 });
  }

  /** Turned aside by a parry: knocked off balance, guard down, wide open. */
  parried(game: Game) {
    this.strikesLeft = 0;
    this.dealtDamage = true;
    this.poise = this.maxPoise;
    this.guardDown = Math.max(this.guardDown, 3);
    this.showBar = 3;
    this.cooldown = this.cooldownTime();
    const d = Math.hypot(this.x - game.player.x, this.y - game.player.y) || 1;
    this.step(game, ((this.x - game.player.x) / d) * 10, ((this.y - game.player.y) / d) * 10);
    this.stun(game, (this.isBoss ? PARRY.bossStun : PARRY.stun) * counterStunMult(usePlayerStore.getState().talents));
  }

  /** Small floating word ("Weak!", "Blocked"), throttled so it doesn't spam. */
  private word(game: Game, text: string, color: number) {
    if (this.labelTimer > 0) return;
    this.labelTimer = 0.9;
    game.fx.text(this.x, this.y - this.height - 12, text, color, { size: 7, bold: true, life: 0.8 });
  }

  // ---------------------------------------------------------------------------
  // Taking hits
  // ---------------------------------------------------------------------------

  takeHit(game: Game, damage: number, crit: boolean, fromX: number, fromY: number, knock = 1, info: HitInfo = {}): void {
    if (this.dead) return;
    this.provoked = true;
    let dmg = damage;
    // Weaknesses and resistances.
    if (info.type && this.def.weak?.includes(info.type)) {
      dmg *= WEAK_MULT;
      this.word(game, t("combat.weak"), 0xffa040);
    } else if (info.type && (this.def.resist?.includes(info.type) || (this.has("armored") && info.type !== "blunt"))) {
      dmg *= this.def.resist?.includes(info.type) ? RESIST_MULT : 0.8;
      this.word(game, t("combat.resist"), 0xa8a8b0);
    }
    if (info.bane === "undead" && this.def.undead) {
      dmg *= BANE_MULT;
      game.fx.burst(this.x, this.centerY, "crystal", 6, { speed: 40, up: 30 });
    }
    // Shield: hits from the front bounce off unless they're heavy.
    let blocked = false;
    if (this.guarded && this.guardDown <= 0 && this.state !== "stunned" && !info.friendly) {
      const fromFront = (fromX < this.x) === this.facingLeft;
      if (fromFront && info.heavy) {
        this.guardDown = 4;
        audio.sfx("hit", { pitch: 0.5 });
        game.fx.burst(this.x + (this.facingLeft ? -6 : 6), this.centerY, "spark", 14, { speed: 70, up: 40 });
        this.word(game, t("combat.guardBreak"), 0x9fd8ff);
        this.labelTimer = 0;
        this.stun(game, 1.1);
      } else if (fromFront) {
        blocked = true;
        dmg *= GUARD_MULT;
        game.fx.burst(this.x + (this.facingLeft ? -6 : 6), this.centerY, "spark", 5, { speed: 50, up: 20 });
        audio.sfx("hit", { pitch: 1.6 });
        this.word(game, t("combat.blocked"), 0x8ab8ff);
      }
    }
    const final = Math.max(1, Math.round(dmg));
    this.hp -= final;
    this.flash = blocked ? 0.04 : 0.12;
    this.showBar = 3;
    const color = blocked ? 0x8ab8ff : crit ? 0xffd54f : dmg > damage * 1.2 ? 0xffa040 : dmg < damage * 0.85 ? 0xb8b8c0 : 0xffffff;
    game.fx.text(this.x + (Math.random() * 8 - 4), this.y - this.height - 2, crit ? `${final}!` : `${final}`, color, {
      size: crit || info.heavy ? 11 : 8,
      bold: crit || !!info.heavy,
    });
    game.fx.burst(this.x, this.centerY, this.def.undead ? "bone" : "blood", crit ? 10 : blocked ? 0 : 6, { speed: 50, up: 50 });
    audio.sfx("enemy_hit", { pitch: (crit ? 0.8 : blocked ? 1.4 : 1) / Math.sqrt(info.weight ?? 1) });
    if (this.hp <= 0) {
      this.die(game);
      return;
    }
    // Frenzy and boss phase two kick in at half health.
    if (this.hp < this.stats.maxHp * 0.5) {
      if (this.has("frenzied") && !this.frenzy) {
        this.frenzy = true;
        game.fx.text(this.x, this.y - this.height - 12, t("combat.frenzy"), 0xff9a3a, { size: 8, bold: true });
        game.fx.ring(this.x, this.centerY, 18, 0xff6a3a, 0.35);
      }
      if (this.isBoss && this.def.phase2 && !this.enraged) {
        this.enraged = true;
        game.fx.text(this.x, this.y - this.height - 14, t("combat.enraged"), 0xff5a4a, { size: 11, bold: true, life: 1.4 });
        game.fx.ring(this.x, this.centerY, 46, 0xff4a3a, 0.6);
        game.shake(4, 0.4);
        audio.sfx("enemy_die", { pitch: 0.5 });
        if (this.def.phase2.includes("summon")) this.summon(game);
      }
    }
    if (blocked) {
      if (this.state === "idle" || this.state === "wander") this.aggro(game);
      return;
    }
    if (this.state === "stunned") return;
    // Poise: only every few hits make it flinch, heavies barely move, and
    // nobody is knocked out of an attack except by a heavy blow.
    this.poise -= info.poise ?? (knock >= 1.5 ? 2 : 1);
    this.poiseRegen = 1.2;
    const attacking = this.state === "windup" || this.state === "lunge" || this.state === "charge";
    const staggered = (this.poise <= 0 && (!attacking || knock >= 1.5)) || (!!info.heavy && !this.isBoss);
    const heavy = this.isBoss || this.maxPoise >= 5;
    const kb = (heavy ? 40 : staggered ? 140 : 50) * knock;
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.vx = ((this.x - fromX) / d) * kb;
    this.vy = ((this.y - fromY) / d) * kb;
    const wasUnaware = this.state === "idle" || this.state === "wander";
    if (staggered) {
      this.poise = this.maxPoise;
      this.state = "hurt";
      this.tele.clear();
      this.body.setSpeed(1);
      this.timer = heavy ? 0.12 : info.heavy ? 0.45 : 0.24;
    } else if (!attacking) {
      // Not staggered: it keeps coming (slid back a little).
      this.step(game, this.vx * 0.05, this.vy * 0.05);
      if (wasUnaware || this.state === "flee") this.state = "chase";
    }
    if (wasUnaware && !info.friendly) {
      game.fx.text(this.x, this.y - this.height - 6, "!", 0xffd54f, { size: 10, bold: true, life: 0.6 });
      if (this.isBoss) game.onBossAggro(this);
    }
  }

  private die(game: Game) {
    this.state = "dying";
    this.hp = 0;
    this.hpBar.clear();
    this.tele.clear();
    this.dizzy.clear();
    this.label?.destroy();
    this.label = null;
    if (this.shieldG) this.shieldG.visible = false;
    this.body.sprite.alpha = 1;
    this.body.sprite.x = 0;
    this.body.setSpeed(1);
    this.body.flash(0);
    this.body.view.scale.set(1);
    this.body.sprite.tint = this.baseTint;
    this.body.play("death", true);
    this.body.shadow.visible = false;
    audio.sfx("enemy_die");
    // Death feedback scales with what you just beat.
    game.fx.burst(this.x, this.centerY, this.def.undead ? "bone" : "blood", this.isBoss ? 30 : this.rank === "elite" ? 16 : 9, { speed: 60, up: 60 });
    if (this.rank !== "normal") game.fx.burst(this.x, this.centerY, "gold", this.isBoss ? 30 : 12, { speed: 50, up: 80 });
    game.shake(this.isBoss ? 5 : this.rank === "elite" ? 2.5 : 1.5, this.isBoss ? 0.5 : 0.14);
    if (this.isBoss) game.hitStop(260);
    for (const m of this.minions) if (!m.dead && !m.removed) m.takeHit(game, 9999, false, this.x, this.y, 1, { friendly: true });
    // Explosive elites go off shortly after they drop.
    if (this.has("explosive") && this.attack !== "explode") game.area.add(new Blast(this.x, this.y, 30, this.stats, 0.75));
    game.onEnemyKilled(this);
  }

  private drawBar() {
    const g = this.hpBar;
    g.clear();
    if (this.showBar <= 0 || this.isBoss || this.dead) return;
    const w = this.rank === "elite" ? 22 : 16;
    const y = -this.height - 4;
    g.rect(-w / 2 - 1, y - 1, w + 2, 4).fill(0x1a1016);
    g.rect(-w / 2, y, w, 2).fill(0x4a1a1a);
    g.rect(-w / 2, y, Math.max(0, (w * this.hp) / this.stats.maxHp), 2).fill(this.rank === "elite" ? 0xffb03a : 0xe0453a);
  }

  light(): LightSource | null {
    if (this.dead) return null;
    if (this.state === "windup" && this.attack === "explode") return { x: this.x, y: this.y - 8, radius: 30, color: 0xffa040, intensity: 0.8, flicker: 1 };
    if (this.rank === "normal") return null;
    if (this.rank === "elite") return { x: this.x, y: this.y - 12, radius: 24, color: 0xffd060, intensity: 0.45, flicker: 0.5 };
    return { x: this.x, y: this.y - 12, radius: 36, color: 0xff6a4a, intensity: 0.5, flicker: 1 };
  }
}

/** A blast that hurts everyone nearby — player and monsters alike. */
function explode(game: Game, x: number, y: number, radius: number, stats: Stats, source: Entity | null) {
  game.fx.ring(x, y - 4, radius, 0xffa040, 0.35);
  game.fx.burst(x, y - 6, "gold", 20, { speed: 90, up: 70 });
  game.fx.burst(x, y - 4, "coal", 14, { speed: 70, up: 50 });
  game.shake(4, 0.3);
  audio.sfx("enemy_die", { pitch: 0.6 });
  const p = game.player;
  if (Math.hypot(p.x - x, p.y - y) < radius + 4) {
    const { damage } = resolveAttack({ ...stats, crit: 0, attack: stats.attack * PATTERN.explode.damage }, playerEffectiveStats(usePlayerStore.getState()));
    p.hurt(game, damage, x, y);
  }
  for (const e of game.area.entities.slice()) {
    if (e === source || e.removed || !isHittable(e) || e.dead || !(e instanceof Enemy)) continue;
    if (Math.hypot(e.x - x, e.y - y) > radius + e.hitRadius) continue;
    e.takeHit(game, Math.round(stats.attack * 1.2), false, x, y, 1.6, { friendly: true, poise: 3 });
  }
}

/** A delayed blast with a flashing warning circle (explosive elites). */
class Blast extends Entity {
  private g = new Graphics();
  private timer: number;
  private readonly total: number;
  private readonly radius: number;
  private readonly stats: Stats;

  constructor(x: number, y: number, radius: number, stats: Stats, delay: number) {
    super(x, y);
    this.radius = radius;
    this.stats = stats;
    this.timer = this.total = delay;
    this.sortBias = -40;
    this.view.addChild(this.g);
  }

  update(dt: number, game: Game): void {
    this.timer -= dt;
    const k = 1 - this.timer / this.total;
    const r = this.radius;
    this.g.clear();
    this.g.ellipse(0, 0, r, r * 0.7).fill({ color: 0xff3a2a, alpha: Math.floor(this.timer * 16) % 2 ? 0.18 : 0.08 }).stroke({ width: 1, color: 0xff6a3a, alpha: 0.7 });
    this.g.ellipse(0, 0, r * k, r * 0.7 * k).fill({ color: 0xffa040, alpha: 0.3 });
    if (this.timer <= 0) {
      explode(game, this.x, this.y, r, this.stats, null);
      game.removeEntity(this);
    }
  }

  light(): LightSource {
    return { x: this.x, y: this.y - 6, radius: 28, color: 0xffa040, intensity: 0.7, flicker: 1 };
  }
}
