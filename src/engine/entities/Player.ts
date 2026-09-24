import { Sprite } from "pixi.js";
import type { Direction } from "../../game/core/types";
import { PLAYER_COLLIDER, PLAYER_RUN_SPEED, PLAYER_WALK_SPEED } from "../../game/core/constants";
import { frames, tex } from "../textures";
import { icon16Path } from "../../data/assets";
import { Projectile } from "./Projectile";
import { t } from "../../i18n";
import { CharacterSprite, type AnimDef } from "./CharacterSprite";
import { Entity } from "./Entity";
import type { Game } from "../Game";
import type { GatherAnim } from "../../data/resourceNodes";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { audio } from "../../game/audio/AudioManager";
import { awardSkillXp } from "../../game/actions";
import { getItem } from "../../data/items";
import { bestTool } from "../../game/systems/toolSystem";
import type { EquipmentSaveState } from "../../game/save/schema";
import { LAST_STAND_COOLDOWN, WHIRLWIND, arrowBonus, dodgeCooldownMult, dodgeReachMult, duelistMult, heavyCostMult, moveSpeedMult, rank, staminaBonus, swingSpeedMult } from "../../data/talents";
import { gearStamina, weaponProfile } from "../../data/items";
import { HEAVY, PARRY, PERFECT_DODGE, STAMINA, type WeaponProfile } from "../../data/combat";
import { isExhausted } from "../../game/systems/vitals";
import { biteDelay, castLine, landFish, rollFish, type FishDef } from "../../game/fishing";
import { itemName } from "../../i18n/content";
import { wearArmorFromHit } from "../../game/systems/durability";
import { MANA_REGEN, SPARK, maxMana } from "../../game/systems/magic";
import { attunementMult, parryWindowMult, sparkMult, sprintCostMult } from "../../data/talents";
import { Graphics } from "pixi.js";
import { drunkDodgeCost, drunkLevel } from "../../game/tavern/drink";
import { RARITY_COLOR } from "../../game/core/types";

/**
 * The player's action state. Exactly one is active, and it alone decides the
 * animation (see `animKey`), so incompatible animations can never fight:
 *
 *   free ──attack──▶ attack ──(anim ends / combo)──▶ free
 *     │  ──E on node─▶ gather ──(move / node gone)──▶ free
 *     │  ──F / RMB──▶ dodge  ──(timer)──▶ free
 *     │  ──attack w/ bow──▶ shoot (draw, loose) ──▶ free
 *     │  ──V──▶ parry (guard up, then recovery) ──▶ free
 *     └── hit ──▶ hurt ──(timer)──▶ free          any ──0 HP──▶ dead
 *
 * `free` covers idle / walk / run. Every timed state also has a hard time
 * limit, so a missed animation callback can't leave the player stuck.
 */
export type PlayerState = "free" | "attack" | "charge" | "shoot" | "gather" | "hurt" | "dodge" | "spin" | "parry" | "fish" | "dead";

/** One swing as the combat system sees it. */
export interface Swing {
  /** Index into COMBO (damage / knock / reach shape). */
  step: number;
  weapon: WeaponProfile;
  heavy: boolean;
  /** Swung with an empty stamina bar: slow and weak. */
  winded: boolean;
  /** Straight after a perfect dodge: a guaranteed, harder crit. */
  riposte: boolean;
  finisher: boolean;
}

const SHEETS: { key: string; file: string; count: number; fps: number; loop: boolean }[] = [
  { key: "idle", file: "idle", count: 4, fps: 6, loop: true },
  { key: "walk", file: "walk", count: 6, fps: 10, loop: true },
  { key: "run", file: "run", count: 6, fps: 15, loop: true },
  // The thrust sheet has the sword in hand, so attacks never look like
  // chopping (which uses the axe-swing sheet).
  { key: "attack", file: "pierce", count: 8, fps: 24, loop: false },
  { key: "chop", file: "slice", count: 8, fps: 15, loop: false },
  { key: "mine", file: "crush", count: 8, fps: 14, loop: false },
  { key: "collect", file: "collect", count: 8, fps: 14, loop: false },
  { key: "hurt", file: "hit", count: 4, fps: 14, loop: false },
  { key: "dead", file: "death", count: 8, fps: 9, loop: false },
  { key: "water", file: "watering", count: 8, fps: 13, loop: false },
  { key: "fish", file: "fishing", count: 8, fps: 10, loop: false },
];

/** Equipment mask layers (rows of `<sheet>_mask.png`, see tools/build_player.py). */
const LAYERS = ["armor", "boots", "helmet", "metal"] as const;

/** Frame on which the swing actually connects, per animation. */
const IMPACT_FRAME: Record<string, number> = { attack: 3, chop: 4, mine: 4, collect: 5, water: 5 };

/** Frame after which a buffered attack chains into the next combo hit. */
const CHAIN_FRAME = 5;

/** Per combo step: damage and knockback multipliers, swing reach, forward lunge. */
export const COMBO = [
  { damage: 1, knock: 1, reach: 1, lunge: 16 },
  { damage: 1.1, knock: 1, reach: 1, lunge: 18 },
  { damage: 1.65, knock: 1.9, reach: 1.25, lunge: 70 },
] as const;

const DODGE = { time: 0.26, speed: 235, invuln: 0.32, cooldown: 0.9 };
/** Whirlwind spin: how long it lasts, and when it connects. */
const SPIN = { time: 0.4, impact: 0.12 };

const MAX_STATE_TIME: Partial<Record<PlayerState, number>> = { attack: 1.3, shoot: 0.8, hurt: 0.5, dodge: 0.5, spin: 0.6, parry: 0.8, charge: HEAVY.maxHold + 0.2 };

/** Bow timing: draw, then loose; then a short recovery. */
const BOW = { draw: 0.22, recover: 0.2, cooldown: 0.5 };

export const PLAYER_SHEET_PATHS = SHEETS.flatMap((s) =>
  (["down", "up", "side"] as const).flatMap((d) => [`/sprites/player/${s.file}_${d}.png`, `/sprites/player/${s.file}_${d}_mask.png`]),
);

export interface GatherTarget {
  x: number;
  y: number;
  alive(): boolean;
  hit(game: Game): void;
  anim: GatherAnim;
}

export class Player extends Entity {
  readonly body: CharacterSprite;
  dir: Direction = "down";
  facingLeft = false;
  state: PlayerState = "free";
  /** Movement direction this frame (unit vector, zero when standing). */
  readonly moveDir = { x: 0, y: 0 };
  /** Position in the wielded weapon's combo of the swing in progress. */
  comboStep = 0;
  /** Stamina: attacks and dodges spend it, it refills when you ease off. */
  stamina: number = STAMINA.max;
  private staminaDelay = 0;
  /** How long the attack button has been held. */
  private holdTime = 0;
  private swing: Swing | null = null;
  /** Seconds left on a riposte (after a perfect dodge). */
  riposte = 0;
  private chargeRing = new Graphics();
  private chargedFx = false;
  private windedNag = 0;
  /** The weapon you're carrying, on your back / hip when your hands are free. */
  private sheath = new Sprite();
  private sheathId: string | null = null;
  private relicTwinkle = 0;
  private lastStandReady = 0;
  private stateTime = 0;
  private moving = false;
  private running = false;
  private invuln = 0;
  private hurtTimer = 0;
  private flashTimer = 0;
  private knockX = 0;
  private knockY = 0;
  private attackCooldown = 0;
  /** Buffered attack press: a press during a hit-stun or swing still fires. */
  private attackBuffer = 0;
  /** Aim point of the buffered attack (mouse), if any. */
  private attackAim: { x: number; y: number } | null = null;
  /** Time left to continue the combo after a swing ends. */
  private comboWindow = 0;
  private dodgeCooldown = 0;
  private dodgeCooldownMax = DODGE.cooldown;
  private whirlCooldown = 0;
  private spinHit = false;
  private dodgeX = 0;
  private dodgeY = 0;
  private ghostTimer = 0;
  private gatherTarget: GatherTarget | null = null;
  private gatherAnim: GatherAnim = "chop";
  private stepTimer = 0;
  private currentAnim = "";
  private looks: Record<string, number | null> = {};
  private unsubLook: (() => void) | null = null;
  /** Set by Game while a UI panel is open or during transitions. */
  frozen = false;
  /** Back-reference so animation callbacks can reach the game. */
  game: Game | null = null;
  private bowSprite: Sprite;
  private aimAngle = 0;
  private loosed = false;
  private noArrowNag = 0;
  private parryCooldown = 0;
  private castCooldown = 0;
  /** A blow was turned aside during this parry (so the recovery is skipped). */
  private parryLanded = false;
  private guardIcon: Sprite;
  /** Ran dry: no sprinting until stamina is back up a bit. */
  private sprintLocked = false;
  /** Fishing: where the float is, what phase, what's biting. */
  private fishing: { x: number; y: number; phase: "cast" | "wait" | "bite" | "strike"; timer: number; fish: FishDef | null } | null = null;
  private bobber = new Graphics();

  constructor(x: number, y: number) {
    super(x, y);
    const anims: Record<string, AnimDef> = {};
    for (const s of SHEETS) {
      for (const d of ["down", "up", "side"] as const) {
        const mask = `/sprites/player/${s.file}_${d}_mask.png`;
        anims[`${s.key}_${d}`] = {
          frames: frames(`/sprites/player/${s.file}_${d}.png`, 64, 64, s.count),
          anchorX: 0.5,
          anchorY: 0.75,
          fps: s.fps,
          loop: s.loop,
          layers: Object.fromEntries(LAYERS.map((l, row) => [l, frames(mask, 64, 64, s.count, row)])),
        };
      }
    }
    this.body = new CharacterSprite(anims, "idle_down", 1, 11, [...LAYERS]);
    this.sheath.anchor.set(0.5);
    this.sheath.visible = false;
    this.view.addChild(this.chargeRing, this.sheath, this.body.view);
    this.bowSprite = new Sprite(tex(icon16Path("bow_wood")));
    this.bowSprite.anchor.set(0.5);
    this.bowSprite.visible = false;
    this.view.addChild(this.bowSprite);
    this.guardIcon = new Sprite(tex(icon16Path("glyph_shield")));
    this.guardIcon.anchor.set(0.5);
    this.guardIcon.visible = false;
    this.view.addChild(this.guardIcon);
    this.bobber.visible = false;
    this.view.addChild(this.bobber);
    this.body.onFrame = (anim, frame) => this.onAnimFrame(anim, frame);
    this.body.onComplete = (anim) => this.onAnimComplete(anim);
    this.refreshLook(usePlayerStore.getState().equipment);
    // Gear shows on the character the moment it's equipped.
    this.unsubLook = usePlayerStore.subscribe((s, prev) => {
      if (s.equipment !== prev.equipment) this.refreshLook(s.equipment);
    });
  }

  /** Ability cooldowns as 0..1 (1 = just used), for the HUD. */
  cooldowns(): { dodge: number; whirl: number; parry: number; spark: number } {
    return {
      spark: this.castCooldown / SPARK.cooldown,
      dodge: this.dodgeCooldownMax > 0 ? this.dodgeCooldown / this.dodgeCooldownMax : 0,
      whirl: this.whirlCooldown / WHIRLWIND.cooldown,
      parry: this.parryCooldown / PARRY.cooldown,
    };
  }

  /** Mana (magic, learned at the Crooked Tower). Zero until then. */
  mana = 0;
  get maxMana(): number {
    return maxMana();
  }

  /** Grows with level and Endurance: early on you can't sprint and swing all day. */
  get maxStamina(): number {
    const s = usePlayerStore.getState();
    return Math.round(STAMINA.max + Math.min(STAMINA.perLevelCap, (s.level - 1) * STAMINA.perLevel) + staminaBonus(s.talents) + gearStamina(s.equipment));
  }

  /** Spends stamina; returns false (and spends what's left) if there wasn't enough. */
  private spend(n: number): boolean {
    const ok = this.stamina >= n;
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaDelay = STAMINA.delay;
    return ok;
  }

  private get weapon(): WeaponProfile {
    return weaponProfile(usePlayerStore.getState().equipment.weapon);
  }

  private nagWinded(game: Game) {
    if (this.windedNag > 0) return;
    this.windedNag = 1.2;
    game.fx.text(this.x, this.y - 34, t("combat.winded"), 0xc8c0b0, { size: 7, life: 0.8 });
  }

  get busy(): boolean {
    return this.state !== "free";
  }

  get isMoving(): boolean {
    return this.moving;
  }

  get isRunning(): boolean {
    return this.moving && this.running;
  }

  get isInvulnerable(): boolean {
    return this.invuln > 0;
  }

  /** Point in front of the player (for interaction + hit checks). */
  facingVector(): { x: number; y: number } {
    if (this.dir === "up") return { x: 0, y: -1 };
    if (this.dir === "down") return { x: 0, y: 1 };
    return { x: this.facingLeft ? -1 : 1, y: 0 };
  }

  faceToward(tx: number, ty: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    if (Math.abs(dx) > Math.abs(dy) * 0.9) {
      this.dir = "side";
      this.facingLeft = dx < 0;
    } else this.dir = dy < 0 ? "up" : "down";
  }

  // ---------------------------------------------------------------------------
  // Look (equipment layers)
  // ---------------------------------------------------------------------------

  private refreshLook(eq: EquipmentSaveState) {
    const look = (id: string | undefined) => (id ? (getItem(id).look ?? null) : null);
    this.looks = { armor: look(eq.armor), boots: look(eq.boots), helmet: look(eq.head), weapon: look(eq.weapon) };
    this.body.setLayer("armor", this.looks.armor);
    this.body.setLayer("boots", this.looks.boots);
    this.body.setLayer("helmet", this.looks.helmet);
    this.applyMetal(this.currentAnim.split("_")[0]);
  }

  /** Blade / tool head tint follows whatever is in hand for this animation. */
  private applyMetal(key: string) {
    let tint: number | null = null;
    if (key === "attack") tint = this.looks.weapon ?? null;
    else if (key === "chop" || key === "mine") {
      const s = usePlayerStore.getState();
      const tool = bestTool(key === "chop" ? "axe" : "pickaxe", s.equipment, useInventoryStore.getState().stacks);
      tint = tool?.look ?? null;
    }
    this.body.setLayer("metal", tint);
  }

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  private setState(next: PlayerState) {
    if (this.state === next) return;
    if (this.state === "gather") this.gatherTarget = null;
    if (this.state === "shoot") this.bowSprite.visible = false;
    if (this.state === "fish" && next !== "fish") {
      this.fishing = null;
      this.bobber.visible = false;
    }
    this.state = next;
    this.stateTime = 0;
  }

  /** The one place that picks the animation. */
  private animKey(): string {
    switch (this.state) {
      case "attack":
        return "attack";
      case "charge":
        return this.moving ? "walk" : "idle";
      case "shoot":
        return "idle";
      case "gather":
        return this.gatherAnim;
      case "hurt":
        return "hurt";
      case "dead":
        return "dead";
      case "dodge":
        return "run";
      case "spin":
        return "attack";
      case "parry":
        return "idle";
      case "fish":
        return "fish";
      default:
        return this.moving ? (this.running ? "run" : "walk") : "idle";
    }
  }

  /** Where the carried weapon sits for the current facing (behind you when
   * facing down or sideways, over your back when facing away). */
  private syncSheath() {
    const id = usePlayerStore.getState().equipment.weapon ?? null;
    if (id !== this.sheathId) {
      this.sheathId = id;
      if (id) this.sheath.texture = tex(icon16Path(getItem(id).icon));
    }
    const free = this.state === "free" || this.state === "dodge" || this.state === "hurt" || this.state === "charge";
    this.sheath.visible = !!id && free;
    if (!this.sheath.visible) return;
    const weapon = weaponProfile(id ?? undefined);
    const long = weapon.kind === "spear" || weapon.kind === "maul";
    const s = weapon.kind === "dagger" ? 0.6 : 0.78;
    const front = this.dir === "up";
    const bodyIdx = this.view.getChildIndex(this.body.view);
    const idx = this.view.getChildIndex(this.sheath);
    if (front && idx < bodyIdx) this.view.setChildIndex(this.sheath, this.view.children.length - 1);
    else if (!front && idx > bodyIdx) this.view.setChildIndex(this.sheath, bodyIdx);
    // Icons point up-right; mirroring makes them point up-left.
    const mirror = front || (this.dir === "side" && !this.facingLeft);
    const x = this.dir === "side" ? (this.facingLeft ? 4 : -4) : front ? -2 : 3;
    this.sheath.position.set(x, long ? -15 : this.dir === "side" ? -10 : -13);
    this.sheath.rotation = mirror ? -0.15 : 0.15;
    this.sheath.scale.set(mirror ? -s : s, s);
  }

  private syncAnim(restart = false) {
    const key = this.animKey();
    const name = `${key}_${this.dir}`;
    if (restart || name !== this.currentAnim) {
      this.currentAnim = name;
      this.body.play(name, restart);
      this.applyMetal(key);
    }
    this.body.setFlip(this.dir === "side" && this.facingLeft);
    this.syncSheath();
    // Cadence follows speed: dodging is a sprint; swings follow the weapon.
    const sw = this.swing;
    this.body.setSpeed(this.state === "dodge" ? 1.7 : this.state === "attack" && sw ? sw.weapon.speed * swingSpeedMult(usePlayerStore.getState().talents) * (sw.winded ? 0.75 : 1) * (sw.heavy ? 0.85 : 1) : this.state === "charge" ? 0.5 : 1);
  }

  update(dt: number, game: Game): void {
    this.stateTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.whirlCooldown = Math.max(0, this.whirlCooldown - dt);
    this.noArrowNag = Math.max(0, this.noArrowNag - dt);
    this.parryCooldown = Math.max(0, this.parryCooldown - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.riposte = Math.max(0, this.riposte - dt);
    this.windedNag = Math.max(0, this.windedNag - dt);
    this.lastStandReady = Math.max(0, this.lastStandReady - dt);
    // A rare-or-better relic keeps a little light about you.
    this.relicTwinkle -= dt;
    if (this.relicTwinkle <= 0) {
      this.relicTwinkle = 0.5;
      const relic = usePlayerStore.getState().equipment.relic;
      const r = relic ? getItem(relic).rarity : null;
      if (r && (r === "rare" || r === "epic" || r === "legendary")) game.fx.twinkle(this.x + (Math.random() - 0.5) * 14, this.y - 6 - Math.random() * 20, Number.parseInt(RARITY_COLOR[r].slice(1), 16));
    }
    if (this.comboWindow <= 0 && this.state !== "attack") this.comboStep = 0;
    this.staminaDelay -= dt;
    // Recovers when you ease off: faster standing or walking, half while exhausted.
    if (this.staminaDelay <= 0 && this.state !== "charge" && this.state !== "parry") {
      const rate = STAMINA.regen * (this.state === "free" ? 1 : 0.5) * (isExhausted() ? 0.5 : 1);
      this.stamina = Math.min(this.maxStamina, this.stamina + rate * dt);
    }
    if (this.sprintLocked && this.stamina >= STAMINA.sprintResume) this.sprintLocked = false;

    const input = game.input;
    const held = !this.frozen && input.held("attack");
    this.holdTime = held ? this.holdTime + dt : 0;
    if (!this.frozen && input.pressed("attack")) {
      this.attackBuffer = 0.3;
      this.attackAim = input.pressedByMouse("attack") ? game.camera.screenToWorld(input.mouseX, input.mouseY) : null;
    }
    const wantsDodge = !this.frozen && input.pressed("dodge");
    const wantsWhirl = !this.frozen && input.pressed("ability");
    const wantsParry = !this.frozen && input.pressed("parry");
    const wantsCast = !this.frozen && input.pressed("cast");
    // Mana trickles back (magic only).
    const mMax = this.maxMana;
    if (mMax > 0) this.mana = Math.min(mMax, this.mana + MANA_REGEN * attunementMult(usePlayerStore.getState().talents) * dt);
    this.castCooldown = Math.max(0, this.castCooldown - dt);
    this.guardIcon.visible = false;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.body.sprite.tint = this.flashTimer > 0 ? 0xff7070 : 0xffffff;
    }
    // Blink while invulnerable (not during a dodge: the ghosts say it all).
    this.body.view.alpha = this.invuln > 0 && this.state !== "dead" && this.state !== "dodge" ? (Math.floor(this.invuln * 16) % 2 ? 0.45 : 1) : 1;

    if (this.riposte > 0 && this.flashTimer <= 0) this.body.sprite.tint = Math.floor(this.riposte * 10) % 2 ? 0xbfefff : 0xffffff;
    else if (this.flashTimer <= 0) this.body.sprite.tint = 0xffffff;
    this.chargeRing.clear();

    if (this.state === "dead") return;

    // Safety net: no timed state outlives its limit.
    const limit = MAX_STATE_TIME[this.state];
    if (limit && this.stateTime > limit) this.setState("free");

    // Knockback slide (collides like normal movement).
    if (Math.abs(this.knockX) + Math.abs(this.knockY) > 1) {
      this.moveBy(game, this.knockX * dt, this.knockY * dt);
      this.knockX *= Math.pow(0.001, dt);
      this.knockY *= Math.pow(0.001, dt);
    }

    const axis = this.frozen ? { x: 0, y: 0 } : this.sway(input.axis(), dt, game);
    const wantsMove = axis.x !== 0 || axis.y !== 0;
    this.moving = false;
    this.moveDir.x = this.moveDir.y = 0;

    switch (this.state) {
      case "hurt":
        this.hurtTimer -= dt;
        if (this.hurtTimer <= 0) this.setState("free");
        break;

      case "dodge": {
        const k = 1 - this.stateTime / DODGE.time;
        const reach = DODGE.speed * dodgeReachMult(usePlayerStore.getState().talents);
        this.moveBy(game, this.dodgeX * reach * Math.max(0.35, k) * dt, this.dodgeY * reach * Math.max(0.35, k) * dt);
        this.moveDir.x = this.dodgeX;
        this.moveDir.y = this.dodgeY;
        this.ghostTimer -= dt;
        if (this.ghostTimer <= 0) {
          this.ghostTimer = 0.045;
          this.spawnGhost(game);
        }
        if (this.stateTime >= DODGE.time) this.setState("free");
        break;
      }

      case "gather":
        if (wantsMove || !this.gatherTarget?.alive()) this.setState("free");
        else if (wantsDodge) this.startDodge(game, axis);
        break;

      case "shoot": {
        // Draw… hold the aim… loose.
        this.bowSprite.visible = true;
        const pull = Math.min(1, this.stateTime / BOW.draw);
        const r = 7 - (this.loosed ? 0 : pull * 2);
        this.bowSprite.position.set(Math.round(Math.cos(this.aimAngle) * r), Math.round(-11 + Math.sin(this.aimAngle) * r * 0.8));
        this.bowSprite.rotation = this.aimAngle + Math.PI / 4;
        if (!this.loosed && this.stateTime >= BOW.draw) {
          this.loosed = true;
          this.loose(game);
        }
        if (this.stateTime >= BOW.draw + BOW.recover) {
          this.bowSprite.visible = false;
          this.setState("free");
        }
        break;
      }

      case "attack": {
        const step = COMBO[this.swing?.step ?? 0];
        // Drift forward during the swing; the finisher (and heavies) lunge.
        if (this.body.frame <= IMPACT_FRAME.attack) {
          const f = this.facingVector();
          const lunge = this.swing?.heavy ? 60 : step.lunge;
          this.moveBy(game, f.x * lunge * dt, f.y * lunge * dt);
        }
        const recovering = this.body.frame >= CHAIN_FRAME;
        if (recovering && wantsParry && this.parryCooldown <= 0) this.startParry(game, axis);
        else if (recovering && wantsDodge) this.startDodge(game, axis);
        else if (recovering && this.attackBuffer > 0 && !this.swing?.heavy && this.comboStep < this.weapon.combo.length - 1) {
          this.comboStep++;
          this.beginSwing(game, axis);
        }
        break;
      }

      case "charge": {
        // Hold to charge; release to swing. Slow walk while winding up.
        const k = Math.min(1, this.stateTime / HEAVY.chargeTime);
        const r = 6 + k * 8;
        this.chargeRing.ellipse(0, 0, r, r * 0.45).stroke({ width: 1, color: k >= 1 ? 0xffe08a : 0xffffff, alpha: 0.4 + k * 0.5 });
        if (k >= 1 && !this.chargedFx) {
          this.chargedFx = true;
          game.fx.ring(this.x, this.y - 10, 14, 0xffe08a, 0.25);
          audio.sfx("swing", { pitch: 1.9 });
        }
        if (wantsDodge) {
          this.startDodge(game, axis);
          break;
        }
        if (wantsMove) {
          this.faceToward(this.x + axis.x, this.y + axis.y);
          this.moveBy(game, axis.x * PLAYER_WALK_SPEED * 0.35 * dt, axis.y * PLAYER_WALK_SPEED * 0.35 * dt);
          this.moving = true;
        }
        if (!held || this.stateTime >= HEAVY.maxHold) {
          if (k >= 1) {
            this.comboStep = 0;
            this.setState("attack");
            this.beginSwing(game, axis, true);
          } else this.setState("free");
        }
        break;
      }

      case "spin": {
        // Turn on the spot, four ways; the blade connects early in the turn.
        const turn = Math.floor((this.stateTime / SPIN.time) * 4) % 4;
        const dirs: [Direction, boolean][] = [
          ["down", false],
          ["side", true],
          ["up", false],
          ["side", false],
        ];
        [this.dir, this.facingLeft] = dirs[turn];
        if (!this.spinHit && this.stateTime >= SPIN.impact) {
          this.spinHit = true;
          game.combat.playerWhirl();
        }
        if (this.stateTime >= SPIN.time) this.setState("free");
        break;
      }

      case "fish":
        this.updateFishing(game, dt, wantsMove || wantsDodge || this.frozen === false && game.input.pressed("attack"));
        break;

      case "parry": {
        const win = PARRY.window * parryWindowMult(usePlayerStore.getState().talents);
        const up = this.stateTime < win;
        // The guard: a shield glyph out in front while it's up.
        const f = this.facingVector();
        this.guardIcon.visible = up;
        this.guardIcon.position.set(f.x * 9, -10 + f.y * 5);
        this.guardIcon.alpha = up ? 1 : 0;
        if (!up && this.parryLanded) this.setState("free");
        else if (this.stateTime >= win + PARRY.recovery) this.setState("free");
        break;
      }

      case "free": {
        if (wantsCast) {
          this.castSpark(game, axis);
          break;
        }
        if (!this.frozen && wantsParry && this.parryCooldown <= 0) {
          this.startParry(game, axis);
          break;
        }
        if (!this.frozen && wantsDodge && this.dodgeCooldown <= 0) {
          this.startDodge(game, axis);
          break;
        }
        if (wantsWhirl) {
          if (rank(usePlayerStore.getState().talents, "whirlwind") < 1) {
            if (this.noArrowNag <= 0) {
              this.noArrowNag = 2;
              game.ui.pushToast(t("talents.whirlLocked"), "info", { icon: "sword_epic" });
            }
          } else if (this.whirlCooldown <= 0 && this.stamina < 20) this.nagWinded(game);
          else if (this.whirlCooldown <= 0) {
            this.spend(20);
            this.whirlCooldown = WHIRLWIND.cooldown;
            this.spinHit = false;
            this.setState("spin");
            this.invuln = Math.max(this.invuln, 0.2);
            audio.sfx("swing", { pitch: 0.7 });
            break;
          }
        }
        if (!this.frozen && this.attackBuffer > 0 && this.attackCooldown <= 0 && this.hasBow()) {
          this.startShoot(game, axis);
          break;
        }
        if (!this.frozen && this.attackBuffer > 0 && this.attackCooldown <= 0) {
          this.comboStep = this.comboWindow > 0 ? Math.min(this.weapon.combo.length - 1, this.comboStep + 1) : 0;
          this.setState("attack");
          this.beginSwing(game, axis);
          break;
        }
        // Still holding after a swing: wind up a heavy.
        if (!this.frozen && this.holdTime >= HEAVY.holdToCharge && this.attackCooldown <= 0.2 && !this.hasBow()) {
          if (this.stamina < STAMINA.heavy) this.nagWinded(game);
          else {
            this.chargedFx = false;
            this.setState("charge");
            break;
          }
        }
        this.running = input.held("sprint") && wantsMove && !this.sprintLocked && this.stamina > 0;
        if (this.running) {
          // Running costs stamina (and pauses its recovery).
          this.stamina = Math.max(0, this.stamina - STAMINA.sprint * sprintCostMult(usePlayerStore.getState().talents) * dt);
          this.staminaDelay = Math.max(this.staminaDelay, 0.25);
          if (this.stamina <= 0) {
            this.sprintLocked = true;
            this.running = false;
            this.nagWinded(game);
          }
        }
        if (wantsMove) {
          const speed = (this.running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED) * moveSpeedMult(usePlayerStore.getState().talents);
          if (Math.abs(axis.x) > Math.abs(axis.y) + 0.01) {
            this.dir = "side";
            this.facingLeft = axis.x < 0;
          } else if (axis.y !== 0) this.dir = axis.y < 0 ? "up" : "down";
          this.moveBy(game, axis.x * speed * dt, axis.y * speed * dt);
          this.moving = true;
          this.moveDir.x = axis.x;
          this.moveDir.y = axis.y;
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) {
            this.stepTimer = this.running ? 0.22 : 0.3;
            game.fx.burst(this.x, this.y, "dust", this.running ? 3 : 1, { speed: 12, up: 10, height: 1, life: 0.35, size: 1 });
          }
        }
        break;
      }
    }
    this.syncAnim();
  }

  private swayTime = 0;
  private stumble = 0;

  /** A few drinks in, your feet have opinions: the stick drifts, and when
   * you're really gone, you stumble now and then. */
  private sway(axis: { x: number; y: number }, dt: number, game: Game): { x: number; y: number } {
    const d = drunkLevel();
    if (d < 50) return axis;
    this.swayTime += dt;
    const k = d >= 80 ? 0.55 : 0.3;
    const moving = axis.x !== 0 || axis.y !== 0;
    if (d >= 80) {
      this.stumble -= dt;
      if (this.stumble <= 0) {
        this.stumble = 2.5 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        this.knockX += Math.cos(a) * 70;
        this.knockY += Math.sin(a) * 70;
        if (Math.random() < 0.4) game.fx.text(this.x, this.y - 34, t("drunk.hic"), 0xffe0a0, { size: 7, life: 0.8 });
      }
    }
    if (!moving) return axis;
    const a = Math.sin(this.swayTime * 1.7) * k + Math.sin(this.swayTime * 3.1) * k * 0.4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: axis.x * c - axis.y * s, y: axis.x * s + axis.y * c };
  }

  moveBy(game: Game, dx: number, dy: number): void {
    const r = game.area.collision.move(this.x, this.y, PLAYER_COLLIDER.w, PLAYER_COLLIDER.h, dx, dy);
    this.x = r.x;
    this.y = r.y;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Starts (or chains) one swing of the combo. Aims at the mouse if the
   * attack was a click, else at the held direction, else straight ahead. */
  private beginSwing(game: Game, axis: { x: number; y: number }, heavy = false) {
    this.attackBuffer = 0;
    if (this.attackAim) this.faceToward(this.attackAim.x, this.attackAim.y);
    else if (axis.x !== 0 || axis.y !== 0) this.faceToward(this.x + axis.x, this.y + axis.y);
    this.attackAim = null;
    this.stateTime = 0;
    const weapon = this.weapon;
    const last = heavy || this.comboStep === weapon.combo.length - 1;
    const winded = !this.spend(weapon.cost + (heavy ? STAMINA.heavy * heavyCostMult(usePlayerStore.getState().talents) : 0));
    if (winded) this.nagWinded(game);
    this.swing = { step: heavy ? 2 : weapon.combo[this.comboStep], weapon, heavy, winded, riposte: false, finisher: last };
    this.attackCooldown = heavy ? 0.35 : last ? 0.45 / weapon.speed : 0.12;
    this.syncAnim(true);
    audio.sfx("swing", { pitch: heavy ? 0.6 : last ? 0.8 : this.comboStep % 2 === 1 ? 1.12 : 1 });
  }

  /** Kept for callers outside the loop (e.g. tests); goes through the combo. */
  startAttack(): void {
    if (this.state !== "free" || !this.game) return;
    this.comboStep = 0;
    this.setState("attack");
    this.beginSwing(this.game, { x: 0, y: 0 });
  }

  // ---------------------------------------------------------------------------
  // Bow (hunting foundation)
  // ---------------------------------------------------------------------------

  private hasBow(): boolean {
    const w = usePlayerStore.getState().equipment.weapon;
    return !!w && !!getItem(w).ammo;
  }

  private startShoot(game: Game, axis: { x: number; y: number }) {
    this.attackBuffer = 0;
    const ammo = getItem(usePlayerStore.getState().equipment.weapon!).ammo!;
    if (!useInventoryStore.getState().hasItem(ammo)) {
      this.attackAim = null;
      if (this.noArrowNag <= 0) {
        this.noArrowNag = 2;
        game.ui.pushToast(t("toast.noArrows"), "warning", { icon: "arrow" });
        audio.sfx("deny");
      }
      return;
    }
    // Aim at the cursor for clicks; otherwise along the held / facing direction.
    let angle: number;
    if (this.attackAim) angle = Math.atan2(this.attackAim.y - (this.y - 10), this.attackAim.x - this.x);
    else if (axis.x !== 0 || axis.y !== 0) angle = Math.atan2(axis.y, axis.x);
    else {
      const f = this.facingVector();
      angle = Math.atan2(f.y, f.x);
    }
    this.attackAim = null;
    this.aimAngle = angle;
    this.faceToward(this.x + Math.cos(angle), this.y + Math.sin(angle));
    this.loosed = false;
    this.attackCooldown = BOW.cooldown;
    this.setState("shoot");
    this.syncAnim(true);
    audio.sfx("swing", { pitch: 0.6 });
  }

  private loose(game: Game) {
    const ammo = getItem(usePlayerStore.getState().equipment.weapon!).ammo!;
    if (!useInventoryStore.getState().removeItem(ammo, 1)) return;
    const stats = game.playerStats();
    game.area.add(
      new Projectile(this.x + Math.cos(this.aimAngle) * 8, this.y + Math.sin(this.aimAngle) * 4, this.aimAngle, {
        owner: "player",
        stats: { ...stats, attack: stats.attack + 4 + arrowBonus(usePlayerStore.getState().talents) },
        speed: 230,
        range: 200,
        texture: tex(icon16Path("arrow")),
      }),
    );
    audio.sfx("swing", { pitch: 1.8 });
  }

  /** Spark: a bolt of lightning towards where you're moving, the cursor, or ahead. */
  private castSpark(game: Game, axis: { x: number; y: number }) {
    if (this.maxMana <= 0) {
      if (this.noArrowNag <= 0) {
        this.noArrowNag = 2;
        game.ui.pushToast(t("magic.noSpells"), "info", { icon: "spellbook" });
      }
      return;
    }
    if (this.castCooldown > 0) return;
    if (this.mana < SPARK.cost) {
      if (this.noArrowNag <= 0) {
        this.noArrowNag = 1.2;
        game.fx.text(this.x, this.y - 34, t("magic.noMana"), 0x8ab8ff, { size: 7, life: 0.8 });
        audio.sfx("deny");
      }
      return;
    }
    this.mana -= SPARK.cost;
    this.castCooldown = SPARK.cooldown;
    let angle: number;
    if (axis.x !== 0 || axis.y !== 0) angle = Math.atan2(axis.y, axis.x);
    else if (game.input.mouseInside) {
      const m = game.camera.screenToWorld(game.input.mouseX, game.input.mouseY);
      angle = Math.atan2(m.y - (this.y - 10), m.x - this.x);
    } else {
      const f = this.facingVector();
      angle = Math.atan2(f.y, f.x);
    }
    this.faceToward(this.x + Math.cos(angle), this.y + Math.sin(angle));
    const p = usePlayerStore.getState();
    const stats = game.playerStats();
    const power = { ...stats, attack: Math.round((stats.attack * 0.7 + 6 + p.level) * sparkMult(p.talents)) };
    const chain = rank(p.talents, "chain_spark") > 0;
    const bolt = (x: number, y: number, a: number, jumps: number) =>
      new Projectile(x, y, a, {
        owner: "player",
        stats: power,
        speed: SPARK.speed,
        range: SPARK.range,
        orb: 0x9ad0ff,
        damageType: "blunt",
        onHit: (g, target) => {
          g.fx.burst(target?.x ?? x, (target?.centerY ?? y) - 2, "crystal", 10, { speed: 50, up: 30, life: 0.3 });
          audio.sfx("hit", { pitch: 1.8 });
          if (!jumps || !target) return;
          // Chain Spark: leap to the nearest other enemy.
          const next = g.enemies().filter((e) => e !== (target as unknown) && Math.hypot(e.x - target.x, e.y - target.y) < 90).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
          if (next) g.area.add(bolt(target.x, target.y, Math.atan2(next.centerY - target.centerY, next.x - target.x), jumps - 1));
        },
      });
    game.area.add(bolt(this.x + Math.cos(angle) * 8, this.y + Math.sin(angle) * 4, angle, chain ? 1 : 0));
    game.fx.burst(this.x + Math.cos(angle) * 10, this.y - 12, "crystal", 6, { speed: 30, up: 10, life: 0.3 });
    audio.sfx("rare", { pitch: 2.2 });
  }

  private startParry(game: Game, axis: { x: number; y: number }) {
    if (this.stamina < PARRY.cost) {
      this.nagWinded(game);
      audio.sfx("deny");
      return;
    }
    this.spend(PARRY.cost);
    if (axis.x !== 0 || axis.y !== 0) this.faceToward(this.x + axis.x, this.y + axis.y);
    this.parryLanded = false;
    this.parryCooldown = PARRY.cooldown;
    this.comboStep = 0;
    this.comboWindow = 0;
    this.attackBuffer = 0;
    this.setState("parry");
    this.syncAnim(true);
    audio.sfx("swing", { pitch: 1.7 });
  }

  /**
   * Called when a parryable blow is about to land. True if the guard was up
   * in time: the blow is turned aside and the attacker left open.
   */
  tryParry(game: Game, fromX: number, fromY: number): boolean {
    if (this.state !== "parry" || this.stateTime > PARRY.window * parryWindowMult(usePlayerStore.getState().talents)) return false;
    this.parryLanded = true;
    this.faceToward(fromX, fromY);
    this.riposte = Math.max(this.riposte, PARRY.riposte);
    this.stamina = Math.min(this.maxStamina, this.stamina + PARRY.refund);
    this.invuln = Math.max(this.invuln, 0.25);
    const mx = (this.x + fromX) / 2;
    const my = (this.y + fromY) / 2 - 10;
    game.fx.burst(mx, my, "spark", 18, { speed: 90, up: 50, life: 0.35 });
    game.fx.ring(mx, my, 16, 0xfff0b0, 0.25);
    game.fx.text(this.x, this.y - 38, t("combat.parried"), 0xfff0b0, { size: 10, bold: true, life: 1 });
    game.hitStop(150);
    game.shake(2, 0.12);
    audio.sfx("hit", { pitch: 1.9 });
    audio.sfx("rare", { pitch: 1.6 });
    awardSkillXp("defense", 3);
    return true;
  }

  private startDodge(game: Game, axis: { x: number; y: number }) {
    if (this.dodgeCooldown > 0) return;
    const cost = STAMINA.dodge * drunkDodgeCost();
    if (this.stamina < cost) {
      this.nagWinded(game);
      audio.sfx("deny");
      return;
    }
    this.spend(cost);
    // Perfect dodge: right as something was about to land.
    const duel = duelistMult(usePlayerStore.getState().talents);
    if (game.perfectDodgeWindow(this.x, this.y, PERFECT_DODGE.window * duel)) {
      this.riposte = PERFECT_DODGE.riposte * duel;
      this.stamina = Math.min(this.maxStamina, this.stamina + PERFECT_DODGE.refund);
      game.fx.text(this.x, this.y - 36, t("combat.perfect"), 0x9fe8ff, { size: 9, bold: true, life: 1 });
      game.fx.ring(this.x, this.y - 10, 20, 0x9fe8ff, 0.3);
      game.hitStop(PERFECT_DODGE.slowMo * 1000);
      audio.sfx("rare", { pitch: 1.4 });
    }
    const f = axis.x !== 0 || axis.y !== 0 ? axis : this.facingVector();
    const len = Math.hypot(f.x, f.y) || 1;
    this.dodgeX = f.x / len;
    this.dodgeY = f.y / len;
    if (axis.x !== 0 || axis.y !== 0) this.faceToward(this.x + axis.x, this.y + axis.y);
    this.setState("dodge");
    const talents = usePlayerStore.getState().talents;
    this.invuln = Math.max(this.invuln, DODGE.invuln * dodgeReachMult(talents));
    this.dodgeCooldownMax = DODGE.cooldown * dodgeCooldownMult(talents);
    this.dodgeCooldown = this.dodgeCooldownMax;
    this.ghostTimer = 0;
    this.knockX = this.knockY = 0;
    this.comboStep = 0;
    this.comboWindow = 0;
    game.fx.burst(this.x, this.y, "dust", 5, { speed: 30, up: 14, height: 1, life: 0.4, size: 1 });
    audio.sfx("swing", { pitch: 1.5 });
  }

  /** Afterimage: a fading copy of the current frame left behind. */
  private spawnGhost(game: Game) {
    const g = new Sprite(this.body.sprite.texture);
    g.anchor.copyFrom(this.body.sprite.anchor);
    g.scale.copyFrom(this.body.sprite.scale);
    g.position.set(this.x, this.y);
    g.tint = 0x9fd8ff;
    g.alpha = 0.5;
    game.fx.ghost(g, 0.22);
  }

  startGather(target: GatherTarget): void {
    if (this.state !== "free") return;
    this.gatherTarget = target;
    this.gatherAnim = target.anim;
    this.setState("gather");
    this.faceToward(target.x, target.y);
    this.syncAnim(true);
  }

  // ---------------------------------------------------------------------------
  // Fishing
  // ---------------------------------------------------------------------------

  /** Cast towards open water at (x, y). */
  startFishing(game: Game, x: number, y: number): void {
    if (this.state !== "free") return;
    this.faceToward(x, y);
    castLine();
    this.fishing = { x, y, phase: "cast", timer: 0.45, fish: null };
    this.setState("fish");
    this.syncAnim(true);
    audio.sfx("swing", { pitch: 0.8 });
    void game;
  }

  /** Interact while fishing: strike (in time, or not). Returns true if handled. */
  fishingInput(game: Game): boolean {
    const f = this.fishing;
    if (this.state !== "fish" || !f) return false;
    if (f.phase === "bite" && f.fish) {
      f.phase = "strike";
      f.timer = 0.5;
      this.body.hold(7);
      const res = landFish(f.fish);
      if (res.escaped) {
        game.fx.text(this.x, this.y - 36, t("fish.snapped"), 0xffa080, { size: 8, bold: true });
        audio.sfx("deny");
      } else {
        const def = getItem(res.itemId);
        game.fx.text(this.x, this.y - 36, `+1 ${itemName(res.itemId)}`, def.rarity === "common" ? 0xf5ecd6 : Number.parseInt(RARITY_COLOR[def.rarity].slice(1), 16), { size: 8, bold: true, life: 1.2 });
        game.fx.burst(f.x, f.y - 2, "crystal", 12, { speed: 40, up: 50 });
        if (def.rarity !== "common") game.ui.pushLootReveal(res.itemId, 1);
        else game.ui.pushItemToast(res.itemId, itemName(res.itemId), 1, def.icon, def.rarity);
        audio.sfx(def.rarity === "common" ? "pickup" : "rare");
      }
      return true;
    }
    if (f.phase === "wait" || f.phase === "cast") {
      // Too eager: reel in an empty hook.
      game.fx.text(this.x, this.y - 34, t("fish.tooEarly"), 0xc8c0b0, { size: 7 });
      this.endFishing();
      return true;
    }
    return true;
  }

  private updateFishing(game: Game, dt: number, cancel: boolean) {
    const f = this.fishing;
    if (!f) return this.setState("free");
    if (cancel && f.phase !== "strike") return this.endFishing();
    f.timer -= dt;
    // The float, drawn relative to you.
    const b = this.bobber;
    b.visible = f.phase !== "cast" || f.timer < 0.15;
    const bob = f.phase === "bite" ? Math.sin(performance.now() / 40) * 1.5 + 1 : Math.sin(performance.now() / 400) * 0.6;
    b.clear();
    b.position.set(Math.round(f.x - this.x), Math.round(f.y - this.y + bob));
    b.ellipse(0, 1, 4, 1.5).stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
    b.rect(-1, -2, 2, 2).fill(0xe0453a).rect(-1, 0, 2, 1).fill(0xffffff);
    switch (f.phase) {
      case "cast":
        if (this.body.frame >= 3) this.body.hold(3);
        if (f.timer <= 0) {
          f.phase = "wait";
          f.timer = biteDelay();
          this.body.hold(4);
          game.fx.burst(f.x, f.y, "crystal", 5, { speed: 16, up: 12, life: 0.4 });
          audio.sfx("potion", { pitch: 1.6 });
        }
        break;
      case "wait":
        this.body.hold(Math.floor(performance.now() / 500) % 2 ? 4 : 5);
        if (f.timer <= 0) {
          f.phase = "bite";
          f.fish = rollFish();
          f.timer = f.fish.window;
          this.body.hold(6);
          game.fx.text(f.x, f.y - 14, "!", 0xffd54f, { size: 12, bold: true, life: f.fish.window });
          game.fx.burst(f.x, f.y, "crystal", 8, { speed: 24, up: 20, life: 0.4 });
          audio.sfx("rare", { pitch: 2 });
          game.shake(1, 0.08);
        }
        break;
      case "bite":
        if (f.timer <= 0) {
          game.fx.text(this.x, this.y - 34, t("fish.gotAway"), 0xc8c0b0, { size: 7 });
          audio.sfx("deny");
          this.endFishing();
        }
        break;
      case "strike":
        if (f.timer <= 0) this.endFishing();
        break;
    }
  }

  private endFishing() {
    this.fishing = null;
    this.bobber.visible = false;
    this.setState("free");
  }

  /**
   * A one-off piece of work (tilling, watering, planting, casting): plays the
   * matching animation and runs `onImpact` on its impact frame.
   */
  performAction(anim: GatherAnim, x: number, y: number, onImpact: (game: Game) => void): boolean {
    if (this.state !== "free") return false;
    let done = false;
    this.startGather({
      x,
      y,
      anim,
      alive: () => !done,
      hit: (game) => {
        done = true;
        onImpact(game);
      },
    });
    return true;
  }

  cancelGather(): void {
    if (this.state === "gather") this.setState("free");
    this.gatherTarget = null;
  }

  private onAnimFrame(anim: string, frame: number) {
    const key = anim.split("_")[0];
    if (frame !== IMPACT_FRAME[key]) return;
    const game = this.game;
    if (!game) return;
    if (key === "attack" && this.state === "attack" && this.swing) {
      if (this.riposte > 0) {
        this.swing.riposte = true;
        this.riposte = 0;
      }
      game.combat.playerStrike(this.swing);
    }
    else if (this.state === "gather" && key === this.gatherAnim && this.gatherTarget?.alive()) this.gatherTarget.hit(game);
  }

  private onAnimComplete(anim: string) {
    const key = anim.split("_")[0];
    if (key === "attack" && this.state === "attack") {
      const len = this.weapon.combo.length;
      const heavy = this.swing?.heavy;
      this.setState("free");
      this.comboWindow = !heavy && this.comboStep < len - 1 ? 0.35 : 0;
      if (heavy || this.comboStep >= len - 1) this.comboStep = 0;
    }
    if (this.state === "gather" && key === this.gatherAnim) {
      if (this.gatherTarget?.alive()) this.syncAnim(true);
      else this.setState("free");
    }
    if (key === "dead") this.game?.onPlayerDeathAnimationDone();
  }

  hurt(game: Game, damage: number, fromX: number, fromY: number): boolean {
    if (this.invuln > 0 || this.state === "dead") return false;
    // Caught mid-whiff: a parry that met nothing leaves you open.
    if (this.state === "parry" && !this.parryLanded) {
      damage = Math.round(damage * PARRY.exposed);
      game.fx.text(this.x, this.y - 44, t("combat.offGuard"), 0xffa080, { size: 7, bold: true, life: 0.8 });
    }
    this.swing = null;
    const store = usePlayerStore.getState();
    // Last Stand: a killing blow leaves you on 1 HP instead (every few minutes).
    if (damage >= store.hp && rank(store.talents, "last_stand") && this.lastStandReady <= 0) {
      this.lastStandReady = LAST_STAND_COOLDOWN;
      damage = Math.max(0, store.hp - 1);
      this.invuln = 1.5;
      game.fx.text(this.x, this.y - 40, t("talents.lastStand"), 0xffd54f, { size: 10, bold: true, life: 1.4 });
      game.fx.ring(this.x, this.y - 10, 26, 0xffd54f, 0.5);
      audio.sfx("levelup", { pitch: 0.7 });
    }
    store.takeDamage(damage);
    wearArmorFromHit();
    awardSkillXp("defense", Math.max(1, Math.round(damage * 0.6)));
    this.invuln = 0.75;
    this.flashTimer = 0.12;
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.knockX = ((this.x - fromX) / d) * 150;
    this.knockY = ((this.y - fromY) / d) * 150;
    game.fx.text(this.x, this.y - 30, `-${damage}`, 0xff5a4e, { size: 9, bold: true });
    game.fx.burst(this.x, this.y - 10, "blood", 6, { speed: 40, up: 40 });
    game.shake(3, 0.2);
    audio.sfx("player_hurt");
    this.comboStep = 0;
    this.comboWindow = 0;
    if (usePlayerStore.getState().hp <= 0) {
      this.die();
    } else {
      this.setState("hurt");
      this.hurtTimer = 0.22;
      this.syncAnim(true);
    }
    return true;
  }

  die(): void {
    this.setState("dead");
    this.gatherTarget = null;
    this.body.view.alpha = 1;
    this.syncAnim(true);
  }

  revive(): void {
    this.setState("free");
    this.invuln = 1;
    this.knockX = this.knockY = 0;
    this.dir = "down";
    this.syncAnim(true);
  }

  resetForArea(x: number, y: number, dir: Direction = "down"): void {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.knockX = this.knockY = 0;
    this.attackBuffer = 0;
    this.comboStep = 0;
    this.comboWindow = 0;
    if (this.state !== "dead") this.setState("free");
    this.gatherTarget = null;
    this.moving = false;
    this.syncAnim(true);
    this.syncView();
  }

  destroy(): void {
    this.unsubLook?.();
    this.unsubLook = null;
    super.destroy();
  }
}
