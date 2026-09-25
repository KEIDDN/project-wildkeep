import { AnimatedSprite, Container, Graphics, Sprite, type Texture } from "pixi.js";

export interface AnimDef {
  frames: Texture[];
  anchorX: number;
  anchorY: number;
  fps: number;
  loop: boolean;
  /** Per-layer frames (same length as `frames`) drawn on top, e.g. armour. */
  layers?: Record<string, Texture[]>;
}

/**
 * AnimatedSprite wrapper for characters: switches between named animations
 * without restarting the current one, applies each strip's own foot anchor
 * (strips in these packs have different canvas sizes), handles facing flips,
 * and exposes frame / completion callbacks for gameplay timing.
 *
 * Optional overlay layers (tinted equipment masks) mirror the body frame by
 * frame, and a white additive "flash" copy of the body sells hits.
 */
export class CharacterSprite {
  readonly view = new Container();
  readonly sprite: AnimatedSprite;
  readonly shadow: Graphics;
  private current = "";
  private anims: Record<string, AnimDef>;
  private baseScale: number;
  private flipped = false;
  private layers = new Map<string, Sprite>();
  private flashSprite: Sprite | null = null;
  private flashLevel = 0;
  private speedScale = 1;
  onFrame: ((anim: string, frame: number) => void) | null = null;
  onComplete: ((anim: string) => void) | null = null;

  constructor(anims: Record<string, AnimDef>, initial: string, scale = 1, shadowWidth = 10, layerNames: string[] = []) {
    this.anims = anims;
    this.baseScale = scale;
    this.shadow = new Graphics().ellipse(0, 0, shadowWidth * scale * 0.5, 2.5 * scale).fill({ color: 0x000000, alpha: 0.28 });
    this.view.addChild(this.shadow);
    const a = anims[initial];
    this.sprite = new AnimatedSprite(a.frames);
    this.sprite.roundPixels = true;
    this.view.addChild(this.sprite);
    for (const name of layerNames) {
      const s = new Sprite();
      s.roundPixels = true;
      s.visible = false;
      this.layers.set(name, s);
      this.view.addChild(s);
    }
    this.sprite.onFrameChange = (f) => {
      this.syncLayers();
      this.onFrame?.(this.current, f);
    };
    this.sprite.onComplete = () => this.onComplete?.(this.current);
    this.play(initial, true);
  }

  get anim(): string {
    return this.current;
  }

  has(name: string): boolean {
    return name in this.anims;
  }

  play(name: string, restart = false): void {
    if (!restart && this.current === name) return;
    const a = this.anims[name];
    if (!a) return;
    this.current = name;
    this.sprite.textures = a.frames;
    this.sprite.anchor.set(a.anchorX, a.anchorY);
    this.sprite.loop = a.loop;
    this.sprite.animationSpeed = (a.fps / 60) * this.speedScale;
    this.sprite.gotoAndPlay(0);
    this.applyScale();
    this.syncLayers();
  }

  /** Scales the current animation's playback (e.g. walk cadence follows
   * movement speed). */
  setSpeed(scale: number): void {
    if (Math.abs(scale - this.speedScale) < 0.01) return;
    this.speedScale = scale;
    const a = this.anims[this.current];
    if (a) this.sprite.animationSpeed = (a.fps / 60) * scale;
  }

  /** Show a layer tinted `tint`, or hide it with null. */
  setLayer(name: string, tint: number | null): void {
    const s = this.layers.get(name);
    if (!s) return;
    s.visible = tint !== null;
    if (tint !== null) s.tint = tint;
    this.syncLayers();
  }

  /** 0..1 white overlay on the body (hit flash). */
  flash(level: number): void {
    if (level > 0 && !this.flashSprite) {
      this.flashSprite = new Sprite();
      this.flashSprite.blendMode = "add";
      this.flashSprite.roundPixels = true;
      this.view.addChild(this.flashSprite);
    }
    this.flashLevel = level;
    if (this.flashSprite) {
      this.flashSprite.visible = level > 0;
      this.flashSprite.alpha = level;
      this.syncLayers();
    }
  }

  private syncLayers() {
    const a = this.anims[this.current];
    if (!a) return;
    const f = Math.min(this.sprite.currentFrame, a.frames.length - 1);
    for (const [name, s] of this.layers) {
      const frames = a.layers?.[name];
      if (!frames) {
        s.renderable = false;
        continue;
      }
      s.renderable = true;
      s.texture = frames[f];
      s.anchor.copyFrom(this.sprite.anchor);
      s.scale.copyFrom(this.sprite.scale);
    }
    if (this.flashSprite && this.flashLevel > 0) {
      this.flashSprite.texture = a.frames[f];
      this.flashSprite.anchor.copyFrom(this.sprite.anchor);
      this.flashSprite.scale.copyFrom(this.sprite.scale);
    }
  }

  setFlip(flipped: boolean): void {
    if (this.flipped === flipped) return;
    this.flipped = flipped;
    this.applyScale();
  }

  setScale(scale: number): void {
    this.baseScale = scale;
    this.applyScale();
  }

  private applyScale() {
    this.sprite.scale.set(this.flipped ? -this.baseScale : this.baseScale, this.baseScale);
    this.syncLayers();
  }

  /** Freeze on one frame of the current animation (manual control). */
  hold(frame: number): void {
    const n = this.sprite.totalFrames;
    this.sprite.gotoAndStop(Math.max(0, Math.min(n - 1, frame)));
    this.syncLayers();
  }

  /** Carry on playing from the held frame. */
  resume(): void {
    if (!this.sprite.playing) this.sprite.play();
  }

  get frame(): number {
    return this.sprite.currentFrame;
  }

  get frameCount(): number {
    return this.sprite.totalFrames;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
