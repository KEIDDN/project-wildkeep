import type { Texture } from "pixi.js";
import { frames } from "../textures";
import type { AnimDef, CharacterSprite } from "./CharacterSprite";
import { SeededRandom } from "../../game/core/rng";

/**
 * Paper-doll villagers (see tools/build_villagers.py): one set of animations
 * split into tintable layers — skin, hair, clothes — plus accessories
 * (hats, hoods, beards, aprons, capes, helmets). A `VillagerLook` says which
 * layers show and in what colours, so every townsperson can look like
 * themselves without a sprite of their own.
 */

/** Row order of the villager sheets. Must match tools/build_villagers.py. */
export const VILLAGER_ROWS = ["base", "skin", "eyes", "hair", "tunic", "belt", "pants", "boots", "cape", "longhair", "apron", "beard", "hood", "hat", "cap", "pointy", "helm"] as const;
type Row = (typeof VILLAGER_ROWS)[number];

/** Draw order (bottom to top). `base` (outline + eye whites) is the body sprite itself. */
export const VILLAGER_LAYERS: Row[] = ["skin", "eyes", "hair", "tunic", "belt", "pants", "boots", "apron", "cape", "longhair", "beard", "hood", "hat", "cap", "pointy", "helm"];

const ANIMS = [
  { key: "idle", count: 4, fps: 5 },
  { key: "walk", count: 6, fps: 9 },
] as const;
const DIRS = ["down", "up", "side"] as const;

export const VILLAGER_SHEET_PATHS = ANIMS.flatMap((a) => DIRS.map((d) => `/sprites/villager/${a.key}_${d}.png`));

export interface VillagerLook {
  skin: number;
  eyes?: number;
  /** null = bald. */
  hair: number | null;
  tunic: number;
  belt?: number;
  pants: number;
  boots: number;
  longHair?: boolean;
  beard?: number;
  apron?: number;
  cape?: number;
  hood?: number;
  hat?: number;
  cap?: number;
  pointy?: number;
  helm?: number;
  /** Children are small; a few grown-ups are big. */
  scale?: number;
}

let animCache: Record<string, AnimDef> | null = null;

/** Animation set keyed `idle_down`, `walk_side`… with every layer attached. */
export function villagerAnims(): Record<string, AnimDef> {
  if (animCache) return animCache;
  const out: Record<string, AnimDef> = {};
  for (const a of ANIMS)
    for (const d of DIRS) {
      const path = `/sprites/villager/${a.key}_${d}.png`;
      const layers: Record<string, Texture[]> = {};
      VILLAGER_ROWS.forEach((row, i) => {
        if (row !== "base") layers[row] = frames(path, 64, 64, a.count, i);
      });
      out[`${a.key}_${d}`] = { frames: frames(path, 64, 64, a.count, 0), anchorX: 0.5, anchorY: 0.75, fps: a.fps, loop: true, layers };
    }
  animCache = out;
  return out;
}

/** Layer grey is ~205 for the lit tone; lift the tint so a colour reads as
 * itself on the lit side of the cloth. */
function lift(c: number): number {
  const ch = (s: number) => Math.min(255, Math.round((((c >> s) & 255) * 255) / 205));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function applyLook(body: CharacterSprite, look: VillagerLook): void {
  const set = (layer: Row, c: number | null | undefined) => body.setLayer(layer, c === undefined || c === null ? null : lift(c));
  set("skin", look.skin);
  set("eyes", look.eyes ?? 0x4a3a2a);
  set("hair", look.hair);
  set("tunic", look.tunic);
  set("belt", look.belt ?? 0x5a3a22);
  set("pants", look.pants);
  set("boots", look.boots);
  set("apron", look.apron);
  set("cape", look.cape);
  set("longhair", look.longHair && look.hair !== null ? look.hair : null);
  set("beard", look.beard);
  set("hood", look.hood);
  set("hat", look.hat);
  set("cap", look.cap);
  set("pointy", look.pointy);
  set("helm", look.helm);
}

// ---------------------------------------------------------------------------
// Palettes + archetypes
// ---------------------------------------------------------------------------

export const SKIN = [0xf6d2b4, 0xeebd96, 0xd9a070, 0xb97c52, 0x8e5a3a, 0x6a4028, 0xc9e0b0 /* half-something */];
export const HAIR = [0x2a2020, 0x4a3024, 0x7a4a2a, 0xa86a36, 0xd8b060, 0xc8482a, 0xe8e4dc, 0x9a9a9a, 0x3a3a5a, 0x6a2a5a];
export const EYES = [0x3a6ac0, 0x4a8a3a, 0x6a4a2a, 0x2a2a2a, 0x8a6a2a, 0x6a6a8a];
const EARTH = [0x6a5a3a, 0x7a6a48, 0x5a6a3a, 0x8a7a5a, 0x6a4a34, 0x4a5a44];
const BRIGHT = [0xb84a3a, 0x3a6ab8, 0xd8a038, 0x4a9a5a, 0x8a4ab0, 0xd87a9a, 0x3a9aa8, 0xe8d8b0];
const DARK = [0x2a2a3a, 0x3a2a3a, 0x2a3a3a, 0x3a3228, 0x44344a];
const LEATHER = [0x7a4a2a, 0x5a3a22, 0x8a5a34, 0x4a3024];
const PANTS = [0x5a4634, 0x3a3a4a, 0x6a5a44, 0x2a2a30, 0x5a5a5a, 0x7a6448];
const STEEL = 0xb8c0cc;

export type Archetype =
  | "farmer"
  | "blacksmith"
  | "merchant"
  | "gambler"
  | "bartender"
  | "miner"
  | "hunter"
  | "guard"
  | "traveler"
  | "wizard"
  | "elder"
  | "child"
  | "adventurer"
  | "noble"
  | "drunk"
  | "stranger"
  | "villager";

/** A random but coherent look for an archetype. Same seed -> same person. */
export function randomLook(archetype: Archetype, seed: string): VillagerLook {
  const r = SeededRandom.fromString(`look:${seed}`);
  const hairC = r.pick(HAIR);
  const base: VillagerLook = {
    skin: r.pick(SKIN.slice(0, 6)),
    eyes: r.pick(EYES),
    hair: r.bool(0.08) ? null : hairC,
    tunic: r.pick([...EARTH, ...BRIGHT]),
    pants: r.pick(PANTS),
    boots: r.pick(LEATHER),
    belt: r.pick(LEATHER),
    longHair: r.bool(0.35),
  };
  const beard = () => (base.hair !== null && r.bool(0.5) ? { beard: base.hair } : {});
  switch (archetype) {
    case "farmer":
      return { ...base, tunic: r.pick(EARTH), ...(r.bool(0.7) ? { hat: r.pick([0xe8c878, 0xd8b060, 0xc8a050]) } : {}), ...beard() };
    case "blacksmith":
      return { ...base, hair: r.bool(0.5) ? null : base.hair, longHair: false, tunic: r.pick(DARK), apron: r.pick(LEATHER), beard: base.hair ?? r.pick(HAIR) };
    case "merchant":
      return { ...base, tunic: r.pick(BRIGHT), cap: r.pick(BRIGHT), ...(r.bool(0.5) ? { cape: r.pick(BRIGHT) } : {}) };
    case "gambler":
      return { ...base, tunic: r.pick([0x6a2a4a, 0x2a2a5a, 0x8a2a2a, 0x2a4a3a]), ...(r.bool(0.6) ? { hat: r.pick(DARK) } : { cap: r.pick(DARK) }), ...beard() };
    case "bartender":
      return { ...base, tunic: r.pick(EARTH), apron: 0xe8e0d0 };
    case "miner":
      return { ...base, tunic: r.pick([0x5a5048, 0x6a5a48, 0x4a4440]), cap: r.pick([0xd8a038, 0x8a6a3a]), pants: 0x3a3a40, ...beard() };
    case "hunter":
      return { ...base, tunic: r.pick([0x4a5a34, 0x5a4a2a, 0x3a4a2a]), hood: r.pick([0x4a6a34, 0x6a5a3a]), cape: r.pick([0x5a4a2a, 0x3a4a2a]) };
    case "guard":
      return { ...base, longHair: false, tunic: 0x8a8a98, helm: STEEL, cape: r.pick([0xa83a3a, 0x3a5aa8]), pants: 0x3a3a4a, boots: 0x3a3a44 };
    case "traveler":
      return { ...base, tunic: r.pick(EARTH), hood: r.pick([0x7a6448, 0x6a5a4a, 0x5a4a3a]), cape: r.pick(LEATHER) };
    case "wizard":
      return { ...base, hair: r.pick([0xe8e4dc, 0x9a9a9a]), longHair: true, beard: r.pick([0xe8e4dc, 0xcfcfcf]), tunic: r.pick([0x4a3a8a, 0x2a4a8a, 0x6a2a6a]), pointy: r.pick([0x4a3a8a, 0x2a4a8a, 0x6a2a6a, 0x3a2a4a]) };
    case "elder":
      return { ...base, hair: r.pick([0xe8e4dc, 0x9a9a9a, 0xc8c8c0]), ...(r.bool(0.6) ? { beard: 0xd8d8d0 } : {}), tunic: r.pick(EARTH), ...(r.bool(0.4) ? { cape: r.pick(EARTH) } : {}) };
    case "child":
      return { ...base, tunic: r.pick(BRIGHT), scale: 0.78, ...(r.bool(0.3) ? { cap: r.pick(BRIGHT) } : {}) };
    case "adventurer":
      return { ...base, tunic: r.pick([0x8a8a98, 0x6a4a34, 0x3a5a7a]), cape: r.pick(BRIGHT), ...(r.bool(0.3) ? { helm: STEEL } : {}) };
    case "noble":
      return { ...base, tunic: r.pick([0x6a2a8a, 0x2a3a8a, 0x8a2a3a]), cape: r.pick([0xd8a038, 0x8a2a6a, 0x2a2a5a]), belt: 0xd8b040, boots: 0x2a2a2a };
    case "drunk":
      return { ...base, skin: r.pick([0xeab098, 0xd89880]), tunic: r.pick(EARTH), ...(r.bool(0.5) ? { cap: r.pick(EARTH) } : {}), ...beard() };
    case "stranger":
      return { ...base, tunic: r.pick(DARK), hood: r.pick([0x2a2a3a, 0x3a2a3a, 0x1e1e28]), cape: r.pick(DARK), eyes: 0xd8b040 };
    default:
      return { ...base, ...(r.bool(0.25) ? { cap: r.pick([...EARTH, ...BRIGHT]) } : {}), ...(r.bool(0.2) ? beard() : {}) };
  }
}
