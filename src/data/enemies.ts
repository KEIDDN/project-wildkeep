import { floorProfile } from "./dungeonFloors";
import { enemyName, enemyRankTitle } from "../i18n/content";
import type { Stats } from "../game/core/types";
import type { Affix, DamageType } from "./combat";

export interface LootEntry {
  itemId: string;
  min: number;
  max: number;
  chance: number; // 0-1 independent roll
}

/**
 * Everything about an enemy is data. Adding a new enemy means exporting its
 * sprite strips in `tools/build_assets.py` (CHARACTERS) and adding an entry
 * here — no system code changes.
 */
export interface EnemyDef {
  id: string;
  name: string;
  sprite: string; // character id in the asset manifest (idle / run / death strips)
  scale?: number;
  tint?: number;
  stats: Stats;
  speed: number; // world px / sec while chasing
  aggroRange: number; // px
  attackRange: number; // px, starts a wind-up when this close
  windupSec: number; // telegraph before the lunge
  cooldownSec: number;
  xp: number;
  gold: [number, number];
  loot: LootEntry[];
  boss?: boolean;
  /** melee: close in and lunge. ranged: keep distance and shoot. */
  behavior?: "melee" | "ranged";
  /** Hits it can take before it flinches (heavies shrug off jabs). */
  poise?: number;
  /** Ranged: preferred distance and shot speed. */
  keepAway?: number;
  shotSpeed?: number;
  /** Ranged: a glowing magic orb of this colour instead of an arrow. */
  shot?: number;
  /** Floats (ghosts, bats): no shadow bob, drifts a little. */
  hover?: boolean;
  /** Attack patterns it picks from (weighted). Default: a plain lunge (melee) or a shot (ranged). */
  attacks?: { kind: AttackKind; weight: number }[];
  /** Bosses: patterns added below half health (phase two). */
  phase2?: AttackKind[];
  /** Summoners: what they raise. */
  summons?: string[];
  weak?: DamageType[];
  resist?: DamageType[];
  undead?: boolean;
  /** Affixes it always has (a shieldbearer is always shielded). */
  innate?: Affix[];
  /** Runs away once below this fraction of health (cowards). */
  fleeBelow?: number;
}

/**
 * How an enemy attacks. Every pattern has its own telegraph (see Enemy):
 *   lunge   a short dash — red wedge on the ground
 *   combo   two or three quick lunges in a row
 *   slam    ground pound around itself — filling circle; long recovery
 *   charge  a long straight rush — red lane; stuns itself on walls
 *   shot    one projectile — aim line
 *   volley  three projectiles in a fan
 *   summon  raises minions
 *   heal    patches up a hurt ally (shamans: kill them first)
 *   explode blows itself up — flashing circle (hurts other monsters too)
 */
export type AttackKind = "lunge" | "combo" | "slam" | "charge" | "shot" | "volley" | "summon" | "heal" | "explode";

/** Attacks a well-timed parry can turn aside (red telegraphs). The rest must be dodged. */
export const PARRYABLE = new Set<AttackKind>(["lunge", "combo", "shot", "volley"]);

/** Compact constructor for the bestiary below. */
function mob(
  id: string,
  name: string,
  sprite: string,
  s: { hp: number; atk: number; def?: number; crit?: number; speed: number; aggro?: number; range?: number; windup?: number; cd?: number; xp: number; gold: [number, number]; poise?: number },
  loot: LootEntry[],
  extra: Partial<EnemyDef> = {},
): EnemyDef {
  return {
    id,
    name,
    sprite,
    stats: { maxHp: s.hp, attack: s.atk, defense: s.def ?? 0, crit: s.crit ?? 0.05, luck: 0 },
    speed: s.speed,
    aggroRange: s.aggro ?? 90,
    attackRange: s.range ?? 16,
    windupSec: s.windup ?? 0.45,
    cooldownSec: s.cd ?? 1.2,
    xp: s.xp,
    gold: s.gold,
    poise: s.poise,
    loot,
    ...extra,
  };
}

const l = (itemId: string, min: number, max: number, chance: number): LootEntry => ({ itemId, min, max, chance });

/**
 * The wider bestiary (art: tools/build_ai_enemies.py). Where they live:
 *
 *   Whisperwood   slimes, shroomlings; wolves after dark
 *   Deepwood      goblins, bandits, poison slimes, wolves; wraiths at night
 *   Ancient Grove treants (elite), shroomlings, ghosts at night
 *   Old Mine      rats, bats up top; spiders, bone rattlers deeper
 *   The Depths    each depth band adds its own (see data/dungeonFloors.ts)
 */
const BESTIARY: EnemyDef[] = [
  mob("slime", "Slime", "ai_slime", { hp: 12, atk: 4, speed: 30, aggro: 60, range: 13, windup: 0.5, xp: 6, gold: [1, 3], poise: 1 }, [l("herb", 1, 1, 0.25), l("crystal", 1, 1, 0.03)]),
  mob("poison_slime", "Bog Slime", "ai_poison_slime", { hp: 18, atk: 6, speed: 30, aggro: 70, range: 13, windup: 0.5, xp: 10, gold: [2, 5], poise: 1 }, [l("emberbloom", 1, 1, 0.2), l("amethyst", 1, 1, 0.04)]),
  mob("shroomling", "Shroomling", "ai_mushroom", { hp: 14, atk: 5, speed: 36, aggro: 55, range: 14, windup: 0.55, xp: 7, gold: [1, 4] }, [l("mushroom", 1, 2, 0.8)]),
  mob("wolf", "Grey Wolf", "ai_wolf", { hp: 18, atk: 7, speed: 72, aggro: 115, range: 16, windup: 0.35, cd: 0.9, xp: 12, gold: [0, 2] }, [l("hide", 1, 1, 0.6), l("meat_raw", 1, 1, 0.5)]),
  mob("giant_rat", "Giant Rat", "ai_rat", { hp: 8, atk: 4, speed: 70, aggro: 90, range: 12, windup: 0.3, cd: 0.8, xp: 5, gold: [0, 2], poise: 1 }, [l("bone", 1, 1, 0.2), l("old_sock", 1, 1, 0.04)]),
  mob("cave_spider", "Cave Spider", "ai_spider", { hp: 11, atk: 6, speed: 64, aggro: 95, range: 13, windup: 0.3, cd: 0.9, xp: 8, gold: [1, 3], poise: 1 }, [l("crystal", 1, 1, 0.06), l("bone", 1, 1, 0.2)]),
  mob("bat", "Cave Bat", "ai_bat", { hp: 6, atk: 4, speed: 84, aggro: 100, range: 13, windup: 0.25, cd: 0.9, xp: 4, gold: [0, 1], poise: 1 }, [l("feather", 1, 1, 0.3)], { hover: true }),
  mob("goblin", "Goblin", "ai_goblin", { hp: 14, atk: 6, crit: 0.1, speed: 64, aggro: 100, range: 15, windup: 0.35, cd: 0.9, xp: 10, gold: [3, 9] }, [l("leather", 1, 1, 0.3), l("emerald", 1, 1, 0.03), l("goblin_bread", 1, 1, 0.15)]),
  mob("goblin_shaman", "Goblin Shaman", "ai_goblin_shaman", { hp: 14, atk: 7, speed: 40, aggro: 120, range: 105, windup: 0.6, cd: 1.7, xp: 14, gold: [4, 10], poise: 1 }, [l("emberbloom", 1, 1, 0.3), l("suspicious_potion", 1, 1, 0.2)], { behavior: "ranged", keepAway: 64, shotSpeed: 120, shot: 0x9aff6a }),
  mob("treant", "Treant", "ai_treant", { hp: 60, atk: 11, def: 3, speed: 22, aggro: 70, range: 20, windup: 0.9, cd: 1.8, xp: 38, gold: [4, 10], poise: 7 }, [l("ancient_wood", 1, 2, 0.7), l("hardwood", 2, 3, 0.8)]),
  mob("bandit", "Bandit", "ai_bandit", { hp: 26, atk: 8, def: 1, crit: 0.12, speed: 58, aggro: 110, range: 16, windup: 0.35, cd: 0.9, xp: 18, gold: [8, 18] }, [l("leather", 1, 2, 0.4), l("iron_ore", 1, 2, 0.3), l("loaded_dice", 1, 1, 0.02)]),
  mob("bandit_archer", "Bandit Archer", "ai_bandit_archer", { hp: 18, atk: 7, speed: 40, aggro: 125, range: 110, windup: 0.6, cd: 1.6, xp: 16, gold: [6, 14], poise: 1 }, [l("arrow", 2, 5, 0.5), l("feather", 1, 2, 0.4)], { behavior: "ranged", keepAway: 62, shotSpeed: 150 }),
  mob("ghost", "Restless Ghost", "ai_ghost", { hp: 16, atk: 7, speed: 52, aggro: 100, range: 15, windup: 0.5, cd: 1.1, xp: 12, gold: [2, 6], poise: 1 }, [l("moonpetal", 1, 1, 0.1), l("sapphire", 1, 1, 0.03)], { hover: true }),
  mob("wraith", "Wraith", "ai_wraith", { hp: 28, atk: 10, def: 1, speed: 60, aggro: 120, range: 17, windup: 0.4, cd: 1, xp: 22, gold: [5, 12], poise: 3 }, [l("amethyst", 1, 1, 0.06), l("moonpetal", 1, 1, 0.15)], { hover: true }),
  mob("cultist", "Cultist", "ai_cultist", { hp: 20, atk: 9, speed: 42, aggro: 130, range: 110, windup: 0.65, cd: 1.6, xp: 20, gold: [8, 16], poise: 1 }, [l("ruby", 1, 1, 0.04), l("greater_potion", 1, 1, 0.1)], { behavior: "ranged", keepAway: 70, shotSpeed: 125, shot: 0xff5a3a }),
  mob("bone_mage", "Bone Mage", "ai_bone_mage", { hp: 22, atk: 10, speed: 40, aggro: 130, range: 110, windup: 0.6, cd: 1.5, xp: 22, gold: [8, 16], poise: 2 }, [l("bone", 2, 3, 0.7), l("amethyst", 1, 1, 0.05)], { behavior: "ranged", keepAway: 66, shotSpeed: 130, shot: 0xb07aff }),
  mob("orc_archer", "Orc Archer", "ai_orc_archer", { hp: 16, atk: 7, speed: 40, aggro: 120, range: 110, windup: 0.6, cd: 1.6, xp: 14, gold: [4, 9], poise: 1 }, [l("arrow", 2, 4, 0.4), l("orc_tusk", 1, 1, 0.15)], { behavior: "ranged", keepAway: 60, shotSpeed: 150 }),
  // --- deeper dungeon specialists --------------------------------------------------
  mob("skeleton_guard", "Bone Shieldbearer", "skeleton_warrior", { hp: 26, atk: 8, def: 2, speed: 40, aggro: 95, range: 17, windup: 0.5, cd: 1.3, xp: 22, gold: [3, 8], poise: 4 }, [l("bone", 1, 3, 0.6), l("iron_ore", 1, 2, 0.25)], { tint: 0xc0c8d8, innate: ["shielded"] }),
  mob("orc_berserker", "Orc Berserker", "orc_rogue", { hp: 34, atk: 10, def: 1, crit: 0.1, speed: 58, aggro: 120, range: 17, windup: 0.45, cd: 1.2, xp: 28, gold: [5, 12], poise: 3 }, [l("orc_tusk", 1, 2, 0.4), l("leather", 1, 2, 0.4)], { tint: 0xff9a8a, scale: 1.05, innate: ["frenzied"] }),
  mob("powder_goblin", "Powder Goblin", "ai_goblin", { hp: 10, atk: 15, speed: 74, aggro: 120, range: 20, windup: 0.9, cd: 1, xp: 12, gold: [2, 6], poise: 1 }, [l("coal", 1, 2, 0.5)], { tint: 0x9a8a70 }),
  // --- bosses ------------------------------------------------------------------
  mob("stone_golem", "The Moss Colossus", "ai_stone_golem", { hp: 110, atk: 12, def: 5, speed: 24, aggro: 130, range: 24, windup: 0.95, cd: 1.7, xp: 260, gold: [70, 120], poise: 12 }, [l("stone", 6, 10, 1), l("diamond", 1, 1, 0.3), l("mithril_ore", 2, 4, 0.6)], { boss: true }),
  mob("necromancer", "Morwen the Unburied", "ai_necromancer", { hp: 90, atk: 13, def: 3, speed: 34, aggro: 150, range: 120, windup: 0.6, cd: 1.1, xp: 360, gold: [90, 150], poise: 8 }, [l("amethyst", 1, 2, 0.8), l("phoenix_pendant", 1, 1, 0.03), l("moon_elixir", 1, 2, 0.6)], { boss: true, behavior: "ranged", keepAway: 80, shotSpeed: 140, shot: 0x9a5aff }),
  mob("dragon", "Emberwing, the Old Flame", "ai_dragon", { hp: 180, atk: 16, def: 5, speed: 30, aggro: 170, range: 130, windup: 0.8, cd: 1.3, xp: 600, gold: [160, 260], poise: 16 }, [l("diamond", 1, 2, 1), l("sunfire_brand", 1, 1, 0.04), l("gold_bar", 3, 6, 1)], { boss: true, behavior: "ranged", keepAway: 90, shotSpeed: 160, shot: 0xff8a2a }),
];


export const ENEMIES: Record<string, EnemyDef> = {
  orc: {
    id: "orc",
    name: "Orc Grunt",
    sprite: "orc",
    stats: { maxHp: 20, attack: 6, defense: 0, crit: 0.05, luck: 0 },
    speed: 42,
    aggroRange: 80,
    attackRange: 16,
    windupSec: 0.5,
    cooldownSec: 1.3,
    xp: 12,
    gold: [3, 8],
    poise: 2,
    loot: [
      { itemId: "leather", min: 1, max: 2, chance: 0.55 },
      { itemId: "orc_tusk", min: 1, max: 1, chance: 0.18 },
      { itemId: "health_potion", min: 1, max: 1, chance: 0.08 },
    ],
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    sprite: "skeleton",
    stats: { maxHp: 15, attack: 7, defense: 0, crit: 0.08, luck: 0 },
    speed: 50,
    aggroRange: 85,
    attackRange: 16,
    windupSec: 0.42,
    cooldownSec: 1.2,
    xp: 11,
    gold: [2, 7],
    loot: [
      { itemId: "bone", min: 1, max: 3, chance: 0.6 },
      { itemId: "iron_ore", min: 1, max: 2, chance: 0.2 },
      { itemId: "sapphire", min: 1, max: 1, chance: 0.03 },
    ],
  },
  orc_rogue: {
    id: "orc_rogue",
    name: "Orc Cutthroat",
    sprite: "orc_rogue",
    stats: { maxHp: 24, attack: 8, defense: 1, crit: 0.12, luck: 0 },
    speed: 62,
    aggroRange: 110,
    attackRange: 17,
    windupSec: 0.32,
    cooldownSec: 0.75,
    xp: 20,
    gold: [6, 14],
    loot: [
      { itemId: "leather", min: 1, max: 3, chance: 0.5 },
      { itemId: "orc_tusk", min: 1, max: 2, chance: 0.3 },
      { itemId: "emerald", min: 1, max: 1, chance: 0.05 },
    ],
  },
  skeleton_rogue: {
    id: "skeleton_rogue",
    name: "Bone Stalker",
    sprite: "skeleton_rogue",
    stats: { maxHp: 20, attack: 9, defense: 1, crit: 0.12, luck: 0 },
    speed: 66,
    aggroRange: 115,
    attackRange: 17,
    windupSec: 0.3,
    cooldownSec: 0.7,
    xp: 19,
    gold: [5, 12],
    loot: [
      { itemId: "bone", min: 2, max: 4, chance: 0.6 },
      { itemId: "gold_ore", min: 1, max: 1, chance: 0.12 },
      { itemId: "amethyst", min: 1, max: 1, chance: 0.03 },
    ],
  },
  skeleton_archer: {
    id: "skeleton_archer",
    name: "Skeleton Archer",
    sprite: "ai_skeleton_archer",
    stats: { maxHp: 12, attack: 7, defense: 0, crit: 0.05, luck: 0 },
    speed: 38,
    aggroRange: 120,
    attackRange: 110,
    windupSec: 0.6,
    cooldownSec: 1.6,
    xp: 14,
    gold: [3, 8],
    behavior: "ranged",
    keepAway: 60,
    shotSpeed: 150,
    poise: 1,
    loot: [
      { itemId: "bone", min: 1, max: 3, chance: 0.6 },
      { itemId: "feather", min: 1, max: 2, chance: 0.4 },
      { itemId: "arrow", min: 2, max: 5, chance: 0.3 },
    ],
  },
  bone_rattler: {
    id: "bone_rattler",
    name: "Bone Rattler",
    sprite: "skeleton",
    scale: 0.78,
    tint: 0xe8d0b0,
    stats: { maxHp: 7, attack: 5, defense: 0, crit: 0.05, luck: 0 },
    speed: 74,
    aggroRange: 100,
    attackRange: 13,
    windupSec: 0.28,
    cooldownSec: 0.9,
    xp: 6,
    gold: [1, 4],
    poise: 1,
    loot: [{ itemId: "bone", min: 1, max: 1, chance: 0.5 }],
  },
  orc_brute: {
    id: "orc_brute",
    name: "Orc Brute",
    sprite: "orc_warrior",
    scale: 1.12,
    tint: 0xd8c8b0,
    stats: { maxHp: 55, attack: 12, defense: 3, crit: 0.05, luck: 0 },
    speed: 30,
    aggroRange: 95,
    attackRange: 20,
    windupSec: 0.8,
    cooldownSec: 1.6,
    xp: 34,
    gold: [10, 22],
    poise: 5,
    loot: [
      { itemId: "orc_tusk", min: 1, max: 2, chance: 0.6 },
      { itemId: "leather", min: 2, max: 4, chance: 0.6 },
      { itemId: "iron_bar", min: 1, max: 2, chance: 0.25 },
    ],
  },
  orc_warrior: {
    id: "orc_warrior",
    name: "Grukk the Warboss",
    sprite: "ai_orc_chieftain",
    stats: { maxHp: 72, attack: 9, defense: 2, crit: 0.08, luck: 0 },
    speed: 40,
    aggroRange: 120,
    attackRange: 20,
    windupSec: 0.65,
    cooldownSec: 1.2,
    xp: 80,
    gold: [25, 45],
    poise: 6,
    loot: [
      { itemId: "orc_tusk", min: 2, max: 3, chance: 1 },
      { itemId: "ruby", min: 1, max: 1, chance: 0.25 },
    ],
    boss: true,
  },
  skeleton_warrior: {
    id: "skeleton_warrior",
    name: "The Hollow Knight",
    sprite: "skeleton_warrior",
    scale: 1.35,
    stats: { maxHp: 64, attack: 9, defense: 3, crit: 0.1, luck: 0 },
    speed: 46,
    aggroRange: 140,
    attackRange: 21,
    windupSec: 0.5,
    cooldownSec: 0.9,
    xp: 160,
    gold: [50, 90],
    poise: 6,
    loot: [
      { itemId: "bone", min: 3, max: 6, chance: 1 },
      { itemId: "amethyst", min: 1, max: 1, chance: 0.35 },
    ],
    boss: true,
  },
};

for (const d of BESTIARY) ENEMIES[d.id] = d;

/**
 * Behaviour and weaknesses, kept apart from the stat lines above so the
 * combat identity of each creature reads at a glance.
 *   blunt  cracks bones, shells and stone      (mauls)
 *   pierce finds gaps in armour and hide      (spears, daggers, arrows)
 *   slash  cuts soft things — slimes, wood     (swords)
 */
const w = (kind: AttackKind, weight = 1) => ({ kind, weight });
const UNDEAD: Partial<EnemyDef> = { undead: true, weak: ["blunt"], resist: ["pierce"] };
const TRAITS: Record<string, Partial<EnemyDef>> = {
  skeleton: UNDEAD,
  skeleton_rogue: { ...UNDEAD, attacks: [w("combo", 2), w("lunge")] },
  skeleton_archer: { ...UNDEAD, attacks: [w("shot", 3), w("volley")] },
  bone_rattler: UNDEAD,
  skeleton_guard: { ...UNDEAD, attacks: [w("lunge"), w("combo")] },
  bone_mage: { ...UNDEAD, attacks: [w("shot", 2), w("volley")] },
  ghost: { undead: true, resist: ["blunt"], weak: ["slash"] },
  wraith: { undead: true, resist: ["pierce", "blunt"], attacks: [w("lunge", 2), w("combo")] },
  slime: { resist: ["blunt"], weak: ["slash"] },
  poison_slime: { resist: ["blunt"], weak: ["slash"] },
  shroomling: { weak: ["slash"] },
  orc_rogue: { attacks: [w("combo", 2), w("lunge")] },
  orc_brute: { resist: ["slash"], weak: ["pierce"], attacks: [w("slam", 2), w("lunge")] },
  orc_berserker: { attacks: [w("charge", 2), w("combo", 2)] },
  bandit: { attacks: [w("combo"), w("lunge")], fleeBelow: 0.2 },
  goblin: { fleeBelow: 0.3 },
  goblin_shaman: { attacks: [w("shot", 2), w("heal", 2)], fleeBelow: 0.35 },
  powder_goblin: { attacks: [w("explode")], innate: ["explosive"] },
  cultist: { attacks: [w("shot", 2), w("volley")] },
  treant: { weak: ["slash"], resist: ["pierce"], attacks: [w("slam", 2), w("lunge")] },
  cave_spider: { weak: ["blunt"] },
  bat: { weak: ["pierce"] },
  wolf: { attacks: [w("lunge", 3), w("charge")] },
  // bosses: a pattern mix, plus new tricks at half health
  orc_warrior: { attacks: [w("lunge", 2), w("charge", 2)], phase2: ["slam"] },
  skeleton_warrior: { ...UNDEAD, innate: ["shielded"], attacks: [w("combo", 2), w("lunge")], phase2: ["slam", "charge"] },
  stone_golem: { weak: ["blunt"], resist: ["slash", "pierce"], attacks: [w("slam", 3), w("lunge")], phase2: ["charge"] },
  necromancer: { undead: true, attacks: [w("shot", 2), w("volley", 2), w("summon", 2)], phase2: ["summon", "volley"], summons: ["bone_rattler", "skeleton"] },
  dragon: { weak: ["pierce"], attacks: [w("volley", 3), w("shot"), w("charge")], phase2: ["slam", "volley"] },
};
for (const [id, extra] of Object.entries(TRAITS)) Object.assign(ENEMIES[id], extra);

export function getEnemy(id: string): EnemyDef {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy id: ${id}`);
  return def;
}

export type EnemyRank = "normal" | "elite" | "boss";

/** Scales an enemy for a dungeon floor (see data/dungeonFloors.ts). */
export function scaledStats(def: EnemyDef, floor: number, rank: EnemyRank = "normal"): Stats {
  const p = floorProfile(floor);
  const elite = rank === "elite";
  return {
    ...def.stats,
    maxHp: Math.round(def.stats.maxHp * p.hpMult * (elite ? 1.8 : 1)),
    attack: Math.round((def.stats.attack * p.atkMult + p.atkAdd) * (elite ? 1.25 : 1)),
    defense: def.stats.defense + p.defAdd + (elite ? 1 : 0),
    crit: def.stats.crit + (elite ? 0.05 : 0),
  };
}

/** Bosses get grander titles the deeper they're met. */
export function enemyTitle(def: EnemyDef, floor: number, rank: EnemyRank): string {
  const name = enemyName(def.id, def.name);
  if (rank === "elite") return enemyRankTitle("elite", name);
  if (rank !== "boss") return name;
  // Bosses with a proper name of their own keep it.
  if (!["orc_warrior", "skeleton_warrior"].includes(def.id)) return name;
  if (floor >= 20) return enemyRankTitle("abyssal", name);
  if (floor >= 15) return enemyRankTitle("boneCrowned", name);
  return name;
}
