import { Container } from "pixi.js";
import type { Game } from "../Game";
import type { InteractionPrompt } from "../../store/uiStore";
import type { LightSource } from "../fx/Lighting";

/**
 * Anything that lives in an area's y-sorted entity layer. `x, y` is the
 * point on the ground under the entity (its feet / base); the view's zIndex
 * follows `y` so things further down the screen draw in front.
 */
export abstract class Entity {
  /** Screen pixels per world pixel (the camera zoom). Moving things snap to
   * the screen-pixel grid rather than the world-pixel grid, so they glide
   * smoothly against a smoothly-following camera instead of jittering in
   * zoom-sized steps. Set by Game on resize. */
  static snap = 1;
  readonly view = new Container();
  x = 0;
  y = 0;
  removed = false;
  /** Extra draw-order offset (e.g. flat decals sort below characters). */
  sortBias = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // Off-screen entities are skipped by the renderer in areas that cull
    // (see Area.cull / Game.tick); elsewhere this flag is inert.
    this.view.cullable = true;
    // Cull the entity as a whole, never piece by piece.
    this.view.cullableChildren = false;
  }

  /** Static entities never move or animate by code: the loop skips them. */
  get isStatic(): boolean {
    return false;
  }

  update(_dt: number, _game: Game): void {}

  /** Lights this entity contributes this frame (torches, glowing chests…). */
  light?(): LightSource | null;

  syncView(): void {
    if (this.removed) return;
    const k = Entity.snap;
    this.view.position.set(Math.round(this.x * k) / k, Math.round(this.y * k) / k);
    this.view.zIndex = this.y + this.sortBias;
  }

  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.view.destroy({ children: true });
  }
}

/** Something the player can press E on. */
export interface Interactable {
  /** Point the player needs to be near (usually the base/front). */
  interactX: number;
  interactY: number;
  interactRadius: number;
  /** Lower wins when several are in range. */
  interactPriority?: number;
  prompt(game: Game): InteractionPrompt | null;
  interact(game: Game): void;
}

export function isInteractable(e: unknown): e is Interactable {
  return typeof e === "object" && e !== null && "interact" in e && "prompt" in e;
}

/** Something the player's weapon can hit: enemies, animals, (later) crates. */
export interface Hittable {
  x: number;
  y: number;
  /** Torso point used for hit checks and impact effects. */
  readonly centerY: number;
  /** Rough body radius (bigger things are easier to hit). */
  readonly hitRadius: number;
  readonly dead: boolean;
  /** Defense etc. for the damage roll. */
  readonly stats: import("../../game/core/types").Stats;
  takeHit(game: Game, damage: number, crit: boolean, fromX: number, fromY: number, knock?: number, info?: HitInfo): void;
}

/** What kind of hit it was (weapon damage type, charged heavy, silver…). */
export interface HitInfo {
  type?: import("../../data/combat").DamageType;
  heavy?: boolean;
  bane?: "undead";
  /** Poise damage (default 1). */
  poise?: number;
  /** A monster's blast, not the player (no aggro fanfare, no crits). */
  friendly?: boolean;
}

export function isHittable(e: unknown): e is Hittable {
  return typeof e === "object" && e !== null && "takeHit" in e && "hitRadius" in e;
}
