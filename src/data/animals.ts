/**
 * Woodland animals: independent of enemies, they live in the forests and
 * react to you. The hunting loop they prepare:
 *
 *   bow → aim (mouse) → shoot → arrow → hit animal → meat / hide / feathers
 *
 * (A sword works too, if you can get close. Walk, don't run: running
 * spooks them from much further away.)
 */
export type AnimalTemper = "skittish" | "curious" | "aggressive" | "tame";

export interface AnimalDef {
  id: string;
  /** English name (translations in i18n content "animals"). */
  name: string;
  sprite: string;
  temper: AnimalTemper;
  maxHp: number;
  defense: number;
  wanderSpeed: number;
  fleeSpeed: number;
  /** Spook distance when you walk / when you run. */
  spook: [walk: number, run: number];
  /** Aggressive animals: charge damage. */
  attack?: number;
  xp: number;
  drops: { itemId: string; min: number; max: number; chance: number }[];
  /** Variants reuse a sprite with a tint and size. */
  tint?: number;
  scale?: number;
  /** Rare quarry: glints, and the whole wood knows when it's about. */
  rare?: boolean;
}

export const ANIMALS: Record<string, AnimalDef> = {
  rabbit: {
    id: "rabbit",
    name: "Rabbit",
    sprite: "rabbit",
    temper: "skittish",
    maxHp: 4,
    defense: 0,
    wanderSpeed: 18,
    fleeSpeed: 92,
    spook: [34, 70],
    xp: 4,
    drops: [
      { itemId: "meat_raw", min: 1, max: 1, chance: 0.9 },
      { itemId: "hide", min: 1, max: 1, chance: 0.35 },
      { itemId: "rabbit_foot", min: 1, max: 1, chance: 0.06 },
    ],
  },
  deer: {
    id: "deer",
    name: "Deer",
    sprite: "deer",
    temper: "skittish",
    maxHp: 16,
    defense: 1,
    wanderSpeed: 14,
    fleeSpeed: 104,
    spook: [48, 96],
    xp: 12,
    drops: [
      { itemId: "meat_raw", min: 2, max: 3, chance: 1 },
      { itemId: "hide", min: 1, max: 2, chance: 0.9 },
      { itemId: "antler", min: 1, max: 1, chance: 0.4 },
    ],
  },
  fox: {
    id: "fox",
    name: "Fox",
    sprite: "fox",
    temper: "curious",
    maxHp: 8,
    defense: 0,
    wanderSpeed: 24,
    fleeSpeed: 96,
    spook: [26, 60],
    xp: 7,
    drops: [
      { itemId: "hide", min: 1, max: 1, chance: 0.8 },
      { itemId: "feather", min: 1, max: 3, chance: 0.4 },
    ],
  },
  boar: {
    id: "boar",
    name: "Boar",
    sprite: "boar",
    temper: "aggressive",
    maxHp: 26,
    defense: 2,
    wanderSpeed: 16,
    fleeSpeed: 80,
    spook: [30, 44],
    attack: 7,
    xp: 16,
    drops: [
      { itemId: "meat_raw", min: 2, max: 4, chance: 1 },
      { itemId: "hide", min: 1, max: 2, chance: 0.8 },
      { itemId: "orc_tusk", min: 1, max: 1, chance: 0.15 },
    ],
  },
  // --- rare quarry (a small chance per visit; see spawnFauna) -----------------
  golden_stag: {
    id: "golden_stag",
    name: "Golden Stag",
    sprite: "deer",
    tint: 0xffd870,
    scale: 1.15,
    rare: true,
    temper: "skittish",
    maxHp: 34,
    defense: 2,
    wanderSpeed: 14,
    fleeSpeed: 128,
    spook: [72, 140],
    xp: 70,
    drops: [
      { itemId: "golden_antler", min: 1, max: 1, chance: 1 },
      { itemId: "hide", min: 2, max: 3, chance: 1 },
      { itemId: "meat_raw", min: 2, max: 3, chance: 1 },
    ],
  },
  white_hare: {
    id: "white_hare",
    name: "White Hare",
    sprite: "rabbit",
    tint: 0xf4f6ff,
    rare: true,
    temper: "skittish",
    maxHp: 7,
    defense: 0,
    wanderSpeed: 22,
    fleeSpeed: 115,
    spook: [48, 96],
    xp: 22,
    drops: [
      { itemId: "white_pelt", min: 1, max: 1, chance: 1 },
      { itemId: "rabbit_foot", min: 1, max: 1, chance: 0.6 },
    ],
  },
  dire_boar: {
    id: "dire_boar",
    name: "Old Tusker",
    sprite: "boar",
    tint: 0x9a7a6a,
    scale: 1.4,
    rare: true,
    temper: "aggressive",
    maxHp: 80,
    defense: 4,
    wanderSpeed: 14,
    fleeSpeed: 86,
    spook: [44, 60],
    attack: 14,
    xp: 60,
    drops: [
      { itemId: "dire_tusk", min: 1, max: 1, chance: 1 },
      { itemId: "hide", min: 2, max: 3, chance: 1 },
      { itemId: "meat_raw", min: 4, max: 6, chance: 1 },
    ],
  },
  pig: {
    id: "pig",
    name: "Duchess the Pig",
    sprite: "pig",
    temper: "tame",
    maxHp: 9999,
    defense: 99,
    wanderSpeed: 20,
    fleeSpeed: 56,
    spook: [22, 36],
    xp: 0,
    drops: [],
  },
};

/** Which animals roam each forest (weights), how many, and the rare quarry
 * that sometimes turns up (chance per visit). */
export const FOREST_FAUNA: Record<string, { count: number; kinds: { id: string; weight: number }[]; rare: { id: string; chance: number }[] }> = {
  forest: { count: 9, kinds: [{ id: "rabbit", weight: 5 }, { id: "deer", weight: 2 }, { id: "fox", weight: 1.5 }, { id: "boar", weight: 0.8 }], rare: [{ id: "white_hare", chance: 0.12 }] },
  deep_forest: { count: 9, kinds: [{ id: "deer", weight: 3 }, { id: "boar", weight: 3 }, { id: "fox", weight: 2 }, { id: "rabbit", weight: 2 }], rare: [{ id: "dire_boar", chance: 0.12 }, { id: "white_hare", chance: 0.06 }] },
  ancient_grove: { count: 7, kinds: [{ id: "deer", weight: 4 }, { id: "fox", weight: 2 }, { id: "rabbit", weight: 2 }], rare: [{ id: "golden_stag", chance: 0.15 }] },
};
