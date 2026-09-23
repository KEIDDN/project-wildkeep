import type { Texture } from "pixi.js";
import { loadFrames } from "../pixi/AssetManager";
import { AnimatedEntity } from "./AnimatedEntity";
import type { EnemyDef } from "../../data/enemies";
import { RENDER_SCALE } from "../../game/core/constants";

export type EnemyAction = "idle" | "run" | "death";

export class EnemyVisual {
  private entity!: AnimatedEntity;
  private frames: Record<EnemyAction, Texture[]> = {} as Record<EnemyAction, Texture[]>;
  private loaded = false;

  async load(def: EnemyDef): Promise<AnimatedEntity> {
    const [idle, run, death] = await Promise.all([
      loadFrames(def.sheets.idle, def.frameSize, def.idleFrames),
      loadFrames(def.sheets.run, def.frameSize, def.runFrames),
      loadFrames(def.sheets.death, def.frameSize, def.deathFrames),
    ]);
    this.frames = { idle, run, death };
    this.entity = new AnimatedEntity(idle);
    this.entity.setScale(RENDER_SCALE);
    this.loaded = true;
    return this.entity;
  }

  update(action: EnemyAction, facingLeft = false) {
    if (!this.loaded) return;
    const loop = action !== "death";
    const speed = action === "death" ? 0.15 : action === "run" ? 0.2 : 0.1;
    this.entity.play(action, this.frames[action], { loop, speed });
    this.entity.setFlip(facingLeft);
  }

  get sprite() {
    return this.entity.sprite;
  }

  setPosition(x: number, y: number) {
    this.entity.setPosition(x, y);
  }
}
