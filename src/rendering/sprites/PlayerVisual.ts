import type { Texture } from "pixi.js";
import { loadFrames } from "../pixi/AssetManager";
import { AnimatedEntity } from "./AnimatedEntity";
import type { Direction } from "../../game/core/types";
import type { PlayerAction } from "../../store/playerStore";
import { ENTITY_FRAME, RENDER_SCALE } from "../../game/core/constants";

type DirFrames = Record<Direction, Texture[]>;

const ANIMATION_SOURCES: Record<PlayerAction, { prefix: string; count: number; loop: boolean; speed: number }> = {
  idle: { prefix: "idle", count: 4, loop: true, speed: 0.08 },
  walk: { prefix: "walk", count: 6, loop: true, speed: 0.18 },
  attack: { prefix: "attack", count: 8, loop: false, speed: 0.28 },
  gather: { prefix: "gather", count: 8, loop: false, speed: 0.22 },
  hit: { prefix: "hit", count: 4, loop: false, speed: 0.2 },
  dead: { prefix: "death", count: 8, loop: false, speed: 0.15 },
};

export class PlayerVisual {
  private entity!: AnimatedEntity;
  private frames: Record<PlayerAction, DirFrames> = {} as Record<PlayerAction, DirFrames>;
  private loaded = false;

  async load(): Promise<AnimatedEntity> {
    for (const action of Object.keys(ANIMATION_SOURCES) as PlayerAction[]) {
      const { prefix, count } = ANIMATION_SOURCES[action];
      const [down, up, side] = await Promise.all([
        loadFrames(`/sprites/player/${prefix}_down.png`, ENTITY_FRAME, count),
        loadFrames(`/sprites/player/${prefix}_up.png`, ENTITY_FRAME, count),
        loadFrames(`/sprites/player/${prefix}_side.png`, ENTITY_FRAME, count),
      ]);
      this.frames[action] = { down, up, side };
    }
    this.entity = new AnimatedEntity(this.frames.idle.down);
    this.entity.setScale(RENDER_SCALE);
    this.loaded = true;
    return this.entity;
  }

  update(direction: Direction, action: PlayerAction, facingLeft: boolean) {
    if (!this.loaded) return;
    const cfg = ANIMATION_SOURCES[action];
    const frames = this.frames[action][direction];
    this.entity.play(`${action}:${direction}`, frames, { loop: cfg.loop, speed: cfg.speed });
    this.entity.setFlip(direction === "side" && facingLeft);
  }

  get sprite() {
    return this.entity.sprite;
  }

  setPosition(x: number, y: number) {
    this.entity.setPosition(x, y);
  }
}
