import { Container, Graphics, Sprite, Text, Texture, type ColorSource } from "pixi.js";
import type { ParticleKind } from "../../data/resourceNodes";
import { WORLD_FONT } from "../../game/core/constants";

/**
 * Lightweight world-space effects: pixel particles (chips, sparks, leaves),
 * floating text (damage numbers, "+3 Wood"), and expanding rings. Everything
 * is pooled-by-lifetime and removed when done.
 */

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  vz: number;
  z: number;
  groundY: number;
  life: number;
  maxLife: number;
  gravity: number;
  spin: number;
  bounce: boolean;
}

interface Floater {
  t: Text;
  vy: number;
  life: number;
  maxLife: number;
  baseY: number;
}

interface Slash {
  g: Graphics;
  life: number;
  maxLife: number;
  angle: number;
  spread: number;
  sweep: 1 | -1;
  radius: number;
  thickness: number;
  color: number;
}

interface Bubble {
  c: Container;
  life: number;
  maxLife: number;
  follow: () => { x: number; y: number } | null;
}

interface Ghost {
  s: Sprite;
  life: number;
  maxLife: number;
  alpha: number;
}

interface Ring {
  g: Graphics;
  life: number;
  maxLife: number;
  radius: number;
  color: ColorSource;
}

const PALETTES: Record<ParticleKind | "blood" | "bone" | "spark" | "dust" | "gold_coin" | "heal", number[]> = {
  wood: [0x8a5a32, 0xb07a44, 0x5e3a20, 0xd6a26a],
  leaf: [0x5aa33a, 0x3f7f2a, 0x8bc34a, 0x2e5e22],
  stone: [0x9a9387, 0x6f6a62, 0xc2bcb0, 0x524d47],
  ore: [0xc9703e, 0x8c4626, 0xe0a070],
  coal: [0x2a262e, 0x151318, 0x4a4450],
  gold: [0xffd75a, 0xe0a82e, 0xfff1a8],
  crystal: [0x9fe3ff, 0x5fb8ff, 0xe6fbff, 0x3f7fd0],
  herb: [0x7ed957, 0x4caf50, 0xc5f09a, 0xffffff],
  blood: [0xb3261e, 0x7a1510, 0xd9483b],
  bone: [0xe8e0cc, 0xb8ae98, 0xffffff],
  spark: [0xfff3b0, 0xffd54f, 0xffffff],
  dust: [0xcab79a, 0xa8957a, 0x8c7a62],
  gold_coin: [0xffd54f, 0xffb300, 0xfff59d],
  heal: [0x8cff8c, 0x4cd964, 0xe8ffe8],
};

export type FxPalette = keyof typeof PALETTES;

export class Effects {
  /** Particles live in the world (they get lit/darkened like everything). */
  readonly layer = new Container();
  /** Text sits above the lighting overlay so numbers stay readable. */
  readonly textLayer = new Container();
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  private slashes: Slash[] = [];
  private ghosts: Ghost[] = [];
  private bubbles: Bubble[] = [];
  private twinkles: { g: Graphics; life: number; maxLife: number }[] = [];

  burst(x: number, y: number, palette: FxPalette, count: number, opts: { speed?: number; up?: number; height?: number; life?: number; size?: number } = {}): void {
    const colors = PALETTES[palette];
    const speed = opts.speed ?? 40;
    for (let i = 0; i < count; i++) {
      const s = new Sprite(Texture.WHITE);
      const size = opts.size ?? (Math.random() < 0.3 ? 2 : 1);
      s.width = size;
      s.height = size;
      s.tint = colors[(Math.random() * colors.length) | 0];
      s.anchor.set(0.5);
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      const p: Particle = {
        s,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp * 0.4,
        vz: (opts.up ?? 60) * (0.6 + Math.random() * 0.8),
        z: opts.height ?? 6,
        groundY: y + (Math.random() * 6 - 3),
        life: 0,
        maxLife: (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6),
        gravity: 220,
        spin: 0,
        bounce: palette !== "spark" && palette !== "heal",
      };
      s.position.set(x, y - p.z);
      this.layer.addChild(s);
      this.particles.push(p);
    }
  }

  /** Floating text (damage numbers, pickups). */
  text(x: number, y: number, str: string, color: ColorSource, opts: { size?: number; life?: number; bold?: boolean } = {}): void {
    const t = new Text({
      text: str,
      style: {
        fontFamily: WORLD_FONT,
        fontSize: opts.size ?? 8,
        fill: color,
        fontWeight: opts.bold ? "700" : "400",
        stroke: { color: 0x1a1016, width: 2 },
        align: "center",
      },
      resolution: 6,
    });
    t.anchor.set(0.5, 1);
    t.position.set(Math.round(x), Math.round(y));
    t.roundPixels = true;
    this.textLayer.addChild(t);
    this.floaters.push({ t, vy: -26, life: 0, maxLife: opts.life ?? 0.9, baseY: y });
  }

  ring(x: number, y: number, radius: number, color: ColorSource, life = 0.35): void {
    const g = new Graphics();
    g.position.set(x, y);
    this.layer.addChild(g);
    this.rings.push({ g, life: 0, maxLife: life, radius, color });
  }

  /**
   * A sword swing: a crescent that sweeps across `spread` radians either side
   * of `angle`, thick at its leading edge and fading behind. Squashed a bit
   * vertically so it reads as a horizontal swing in the top-down view.
   */
  slash(x: number, y: number, angle: number, opts: { spread?: number; sweep?: 1 | -1; radius?: number; thickness?: number; color?: number; life?: number } = {}): void {
    const g = new Graphics();
    g.position.set(x, y);
    this.layer.addChild(g);
    this.slashes.push({
      g,
      life: 0,
      maxLife: opts.life ?? 0.16,
      angle,
      spread: opts.spread ?? 1.2,
      sweep: opts.sweep ?? 1,
      radius: opts.radius ?? 18,
      thickness: opts.thickness ?? 5,
      color: opts.color ?? 0xffffff,
    });
  }

  /**
   * A speech bubble over someone's head that follows them (`follow` returns
   * their head position, or null once they're gone). Lives above the
   * lighting so night-time chatter stays readable.
   */
  bubble(text: string, follow: () => { x: number; y: number } | null, life = 3.2, tint = 0xfff6e0): void {
    const c = new Container();
    const txt = new Text({
      text,
      style: { fontFamily: WORLD_FONT, fontSize: 6, fill: 0x2a1a20, wordWrap: true, wordWrapWidth: 96, align: "center", lineHeight: 7 },
      resolution: 8,
    });
    txt.anchor.set(0.5, 1);
    txt.position.set(0, -4);
    const w = Math.ceil(txt.width) + 8;
    const h = Math.ceil(txt.height) + 4;
    const g = new Graphics();
    g.roundRect(-w / 2, -h - 3, w, h, 3).fill({ color: tint, alpha: 0.96 }).stroke({ width: 1, color: 0x2a1a20 });
    g.poly([-3, -3.5, 3, -3.5, 0, 0]).fill(tint).stroke({ width: 1, color: 0x2a1a20 });
    g.rect(-2.5, -4.5, 5, 2).fill(tint);
    c.addChild(g, txt);
    // One bubble per speaker at a time.
    for (const b of this.bubbles) if (b.follow === follow) b.life = b.maxLife;
    const p = follow();
    if (p) c.position.set(Math.round(p.x), Math.round(p.y));
    this.textLayer.addChild(c);
    this.bubbles.push({ c, life: 0, maxLife: life, follow });
  }

  /** A tiny four-point star that blooms and fades (harvestable glint). */
  twinkle(x: number, y: number, color = 0xfff8d8): void {
    const g = new Graphics();
    g.poly([0, -3, 0.7, -0.7, 3, 0, 0.7, 0.7, 0, 3, -0.7, 0.7, -3, 0, -0.7, -0.7]).fill(color);
    g.position.set(Math.round(x), Math.round(y));
    g.scale.set(0);
    this.layer.addChild(g);
    this.twinkles.push({ g, life: 0, maxLife: 0.6 });
  }

  /** A fading copy of a sprite (dodge afterimages). */
  ghost(s: Sprite, life: number): void {
    this.layer.addChild(s);
    this.ghosts.push({ s, life: 0, maxLife: life, alpha: s.alpha });
  }

  private drawSlash(sl: Slash) {
    const k = sl.life / sl.maxLife;
    const head = Math.min(1, k * 1.8);
    const tail = Math.max(0, k * 1.8 - 0.8);
    const a0 = sl.angle - sl.spread * sl.sweep;
    const span = sl.spread * 2 * sl.sweep;
    const steps = 10;
    const outer: number[] = [];
    const inner: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = tail + ((head - tail) * i) / steps;
      const a = a0 + span * t;
      // Thickest at the leading edge.
      const th = sl.thickness * (0.25 + 0.75 * (i / steps));
      const ca = Math.cos(a);
      const sa = Math.sin(a) * 0.75;
      outer.push(ca * sl.radius, sa * sl.radius);
      inner.push(ca * (sl.radius - th), sa * (sl.radius - th));
    }
    const pts = [...outer];
    for (let i = inner.length - 2; i >= 0; i -= 2) pts.push(inner[i], inner[i + 1]);
    sl.g.clear().poly(pts).fill({ color: sl.color, alpha: Math.max(0, 1 - k * 0.9) });
  }

  update(dt: number): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      sl.life += dt;
      if (sl.life >= sl.maxLife) {
        sl.g.destroy();
        this.slashes.splice(i, 1);
      } else this.drawSlash(sl);
    }
    for (let i = this.twinkles.length - 1; i >= 0; i--) {
      const tw = this.twinkles[i];
      tw.life += dt;
      const k = tw.life / tw.maxLife;
      tw.g.scale.set(Math.sin(Math.min(1, k) * Math.PI) * 1.1);
      tw.g.rotation = k * 0.8;
      if (tw.life >= tw.maxLife) {
        tw.g.destroy();
        this.twinkles.splice(i, 1);
      }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt;
      const p = b.follow();
      if (!p || b.life >= b.maxLife) {
        b.c.destroy({ children: true });
        this.bubbles.splice(i, 1);
        continue;
      }
      b.c.position.set(Math.round(p.x), Math.round(p.y));
      const k = b.life / b.maxLife;
      b.c.alpha = k > 0.85 ? 1 - (k - 0.85) / 0.15 : Math.min(1, b.life * 8);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const gh = this.ghosts[i];
      gh.life += dt;
      gh.s.alpha = gh.alpha * Math.max(0, 1 - gh.life / gh.maxLife);
      if (gh.life >= gh.maxLife) {
        gh.s.destroy();
        this.ghosts.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vz -= p.gravity * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        p.z = 0;
        if (p.bounce && Math.abs(p.vz) > 20) p.vz = -p.vz * 0.35;
        else p.vz = 0;
        p.vx *= 0.7;
        p.vy *= 0.7;
      }
      p.groundY += p.vy * dt;
      p.s.x += p.vx * dt;
      p.s.y = p.groundY - p.z;
      const k = p.life / p.maxLife;
      p.s.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (p.life >= p.maxLife) {
        p.s.destroy();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life += dt;
      f.vy *= Math.pow(0.05, dt);
      f.t.y = Math.round(f.t.y + f.vy * dt);
      const k = f.life / f.maxLife;
      f.t.alpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      // pop-in scale
      const pop = k < 0.12 ? 1 + (0.12 - k) * 5 : 1;
      f.t.scale.set(pop);
      if (f.life >= f.maxLife) {
        f.t.destroy();
        this.floaters.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const k = r.life / r.maxLife;
      r.g.clear();
      r.g.circle(0, 0, r.radius * (0.3 + k * 0.7)).stroke({ color: r.color, width: 1, alpha: 1 - k });
      if (r.life >= r.maxLife) {
        r.g.destroy();
        this.rings.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.layer.removeChildren().forEach((c) => c.destroy());
    this.textLayer.removeChildren().forEach((c) => c.destroy());
    this.particles = [];
    this.floaters = [];
    this.rings = [];
    this.slashes = [];
    this.ghosts = [];
    this.bubbles = [];
    this.twinkles = [];
  }
}
