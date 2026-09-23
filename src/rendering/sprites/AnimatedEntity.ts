import { AnimatedSprite, type Texture } from "pixi.js";
import { ENTITY_ANCHOR_Y } from "../../game/core/constants";

/** Thin wrapper around PIXI.AnimatedSprite that avoids restarting an
 * animation that's already playing, and centralizes anchor/flip handling. */
export class AnimatedEntity {
  readonly sprite: AnimatedSprite;
  private currentKey: string | null = null;

  constructor(initialFrames: Texture[]) {
    this.sprite = new AnimatedSprite(initialFrames);
    this.sprite.anchor.set(0.5, ENTITY_ANCHOR_Y);
    this.sprite.animationSpeed = 0.15;
    this.sprite.play();
  }

  play(key: string, frames: Texture[], opts?: { loop?: boolean; speed?: number }) {
    if (this.currentKey === key) return;
    this.currentKey = key;
    this.sprite.textures = frames;
    this.sprite.loop = opts?.loop ?? true;
    this.sprite.animationSpeed = opts?.speed ?? 0.15;
    this.sprite.gotoAndPlay(0);
  }

  setFlip(flipped: boolean) {
    this.sprite.scale.x = flipped ? -Math.abs(this.sprite.scale.x || 1) : Math.abs(this.sprite.scale.x || 1);
  }

  setScale(scale: number) {
    const flipped = this.sprite.scale.x < 0;
    this.sprite.scale.set(flipped ? -scale : scale, scale);
  }

  setPosition(x: number, y: number) {
    this.sprite.position.set(x, y);
  }

  destroy() {
    this.sprite.destroy();
  }
}
