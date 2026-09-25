import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from "pixi.js";
import type { Camera } from "../Camera";
import type { VisionMap } from "./Vision";

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity?: number;
  flicker?: number; // 0..1
  /** Draw a small glowing core over the darkness (lamp flames, torches). */
  flare?: boolean;
}

let lightTexture: Texture | null = null;
let flareTexture: Texture | null = null;

function radial(size: number, curve: (d: number) => number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, curve(d))) * 255);
    }
  ctx.putImageData(img, 0, 0);
  return Texture.from(canvas);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Bright core, long soft shoulder, nothing past the radius. The light
 * buffer is rendered at world-pixel resolution and scaled up with nearest
 * sampling, so this smooth curve lands on screen as pixel-art steps. */
function getLightTexture(): Texture {
  return (lightTexture ??= radial(128, (d) => Math.pow(1 - smoothstep(0.12, 1, d), 1.35)));
}

function getFlareTexture(): Texture {
  return (flareTexture ??= radial(32, (d) => Math.pow(Math.max(0, 1 - d), 2.2)));
}

/**
 * Darkness overlay: a render texture filled with the ambient colour, with
 * additive lights punched into it, multiplied over the world.
 *
 * The buffer has one texel per *world* pixel and is aligned to the world
 * grid (not the screen), so light edges step in the same pixels as the art
 * and never shimmer as the camera scrolls. There are no hard edges anywhere:
 * outside every light things simply fade into the ambient dark.
 *
 * `flares` (a separate layer drawn over the darkness) holds small additive
 * glows for lamps and torches, and `night` (0..1) tells emissive things like
 * lit windows how strongly to shine.
 */
export class Lighting {
  readonly sprite: Sprite;
  readonly flares = new Container();
  /** 0 in daylight, 1 in full darkness. */
  night = 0;
  private rt: RenderTexture;
  private scene = new Container();
  private ambientFill = new Graphics();
  private lightLayer = new Container();
  /** Line-of-sight fog, multiplied over ambient + lights (dungeons). */
  private visionSprite = new Sprite();
  private vision: VisionMap | null = null;
  private pool: Sprite[] = [];
  private flarePool: Sprite[] = [];
  private time = 0;
  /** Multiply colour for everything the lights don't reach (1,1,1 = none). */
  private ambientRGB: [number, number, number] = [1, 1, 1];

  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.rt = RenderTexture.create({ width: 16, height: 16, scaleMode: "nearest" });
    this.sprite = new Sprite(this.rt);
    this.sprite.blendMode = "multiply";
    this.visionSprite.blendMode = "multiply";
    this.visionSprite.visible = false;
    this.scene.addChild(this.ambientFill, this.lightLayer, this.visionSprite);
  }

  /** Fog of war for the current area, or null for none. */
  setVision(v: VisionMap | null): void {
    this.vision = v;
    this.visionSprite.visible = !!v;
    if (v) {
      this.visionSprite.texture = v.texture;
      this.visionSprite.scale.set(v.cell);
    }
  }

  get enabled(): boolean {
    return Math.min(...this.ambientRGB) < 0.985;
  }

  /** Scalar darkness for interiors: blends toward a cool tint as it gets darker. */
  setAmbientLevel(a: number, tint = 0x6a70a8): void {
    const c = (shift: number) => a + (1 - a) * (((tint >> shift) & 255) / 255) * 0.35;
    this.ambientRGB = [c(16), c(8), c(0)];
  }

  /** Underground: properly dark, a little cold. Only what your lantern and
   * the torches reach is visible. */
  setUnderground(level: number): void {
    this.ambientRGB = [level * 0.85, level * 0.9, level * 1.2];
  }

  /** Explicit multiply colour (outdoor day/night). */
  setAmbientColor(r: number, g: number, b: number): void {
    this.ambientRGB = [r, g, b];
  }

  update(dt: number, camera: Camera, lights: LightSource[]): void {
    const lum = (this.ambientRGB[0] + this.ambientRGB[1] + this.ambientRGB[2]) / 3;
    this.night = Math.max(0, Math.min(1, (0.82 - lum) / 0.4));
    this.sprite.visible = this.enabled;
    this.flares.visible = this.enabled && this.night > 0.02;
    if (!this.enabled) return;
    this.time += dt;
    const z = camera.zoom;
    // World pixel at the buffer's top-left, snapped to the world grid.
    const gx0 = Math.floor(-camera.originX / z) - 1;
    const gy0 = Math.floor(-camera.originY / z) - 1;
    const w = Math.ceil(camera.screenW / z) + 3;
    const h = Math.ceil(camera.screenH / z) + 3;
    if (this.rt.width !== w || this.rt.height !== h) this.rt.resize(w, h);
    this.sprite.scale.set(z);
    this.sprite.position.set(camera.originX + gx0 * z, camera.originY + gy0 * z);

    const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
    const [ar, ag, ab] = this.ambientRGB;
    this.ambientFill.clear().rect(0, 0, w, h).fill((to255(ar) << 16) | (to255(ag) << 8) | to255(ab));

    const tex = getLightTexture();
    const ftex = getFlareTexture();
    let used = 0;
    let flares = 0;
    for (const l of lights) {
      const wob = 1 + (l.flicker ?? 0) * 0.05 * Math.sin(this.time * 9 + l.x) + (l.flicker ?? 0) * 0.03 * Math.sin(this.time * 23 + l.y);
      const r = l.radius * wob;
      const lx = l.x - gx0;
      const ly = l.y - gy0;
      if (lx + r < 0 || ly + r < 0 || lx - r > w || ly - r > h) continue;
      let s = this.pool[used];
      if (!s) {
        s = new Sprite(tex);
        s.anchor.set(0.5);
        s.blendMode = "add";
        this.pool.push(s);
        this.lightLayer.addChild(s);
      }
      s.visible = true;
      s.position.set(lx, ly);
      s.width = s.height = r * 2;
      s.tint = l.color;
      s.alpha = (l.intensity ?? 1) * 0.9;
      used++;
      if (l.flare ?? (l.flicker ?? 0) >= 0.5) {
        let f = this.flarePool[flares];
        if (!f) {
          f = new Sprite(ftex);
          f.anchor.set(0.5);
          f.blendMode = "add";
          this.flarePool.push(f);
          this.flares.addChild(f);
        }
        f.visible = true;
        const p = camera.worldToScreen(l.x, l.y);
        f.position.set(p.x, p.y);
        f.width = f.height = Math.max(10, l.radius * 0.36) * z * wob;
        f.tint = l.color;
        f.alpha = 0.55 * this.night * (l.intensity ?? 1);
        flares++;
      }
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false;
    if (this.vision) {
      // Texel centres sit on tile centres; the border is dark.
      const c = this.vision.cell;
      this.visionSprite.position.set(-this.vision.border * c - gx0, -this.vision.border * c - gy0);
    }
    for (let i = flares; i < this.flarePool.length; i++) this.flarePool[i].visible = false;
    this.renderer.render({ container: this.scene, target: this.rt, clear: true });
  }

  destroy(): void {
    this.rt.destroy(true);
    this.scene.destroy({ children: true });
    this.flares.destroy({ children: true });
    this.sprite.destroy();
  }
}
