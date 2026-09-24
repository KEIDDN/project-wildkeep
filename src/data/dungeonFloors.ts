/**
 * Dungeon depth. The dungeon is one endless descent; every floor is
 * generated from (run seed, floor) and gets harder by formula, not by hand.
 *
 * The curve is tuned so gear and skills — not just player level — decide how
 * deep you can comfortably go:
 *   floors 1-3   starter gear is fine
 *   floors 4-7   want iron weapon + armour
 *   floors 8-12  want steel / silver
 *   floors 13+   mithril territory
 * Every 5th floor is a boss floor: beating it unlocks a checkpoint you can
 * start later runs from, and its chest holds a special reward.
 */

export interface FloorTheme {
  name: string;
  /** Multiply tint for the floor / wall tiles. */
  tint: number;
  ambient: number;
  rim: number;
}

const THEMES: { from: number; theme: FloorTheme }[] = [
  { from: 1, theme: { name: "The Old Barrow", tint: 0xffffff, ambient: 0.38, rim: 0x6f8fa8 } },
  { from: 6, theme: { name: "The Sunken Crypt", tint: 0xb8cce8, ambient: 0.32, rim: 0x7fa8c8 } },
  { from: 11, theme: { name: "The Bone Halls", tint: 0xe8c8b0, ambient: 0.28, rim: 0xc89a78 } },
  { from: 16, theme: { name: "The Abyss", tint: 0xb8a0d8, ambient: 0.24, rim: 0xa080d0 } },
];

/**
 * Some floors have a twist, rolled from the run seed. They change how the
 * floor plays, not just its numbers — and several pay you for the trouble.
 */
export type FloorMutator = "gloom" | "horde" | "champions" | "traps" | "hoard";
export const FLOOR_MUTATORS: FloorMutator[] = ["gloom", "horde", "champions", "traps", "hoard"];

export interface FloorProfile {
  floor: number;
  mutator: FloorMutator | null;
  theme: FloorTheme;
  bossFloor: boolean;
  /** Weighted regular enemies (guards, strays). */
  enemies: { id: string; weight: number }[];
  /** Room encounters: `lead` always spawn, the rest are drawn from `fill`;
   * `extra` adds bodies (swarms). */
  encounters: { weight: number; lead: string[]; fill: string[]; extra?: number }[];
  bossId: string;
  hpMult: number;
  atkMult: number;
  atkAdd: number;
  defAdd: number;
  /** Extra enemies per combat room. */
  crowd: number;
  /** Chance a regular enemy spawns as a tougher elite. */
  eliteChance: number;
  goldMult: number;
  xpMult: number;
  /** Added to luck for loot rolls. */
  lootLuck: number;
  /** Chest quality (1 = starter). */
  chestTier: number;
  mainRooms: number;
  /** Ore veins that appear in resource rooms. */
  ores: string[];
  /** Rough gear score the floor expects (see gearScore). */
  recommended: number;
}

export const CHECKPOINT_EVERY = 5;

export function isBossFloor(floor: number): boolean {
  return floor % CHECKPOINT_EVERY === 0;
}

export function floorTheme(floor: number): FloorTheme {
  let t = THEMES[0].theme;
  for (const th of THEMES) if (floor >= th.from) t = th.theme;
  return t;
}

/** The twist on a floor of a run (none on the first floors and boss floors). */
export function floorMutator(seed: string | null | undefined, floor: number): FloorMutator | null {
  if (!seed || floor < 3 || isBossFloor(floor)) return null;
  let h = 2166136261;
  for (const c of `${seed}:mut:${floor}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  if (h % 100 >= Math.min(60, 30 + floor * 2)) return null;
  return FLOOR_MUTATORS[(h >>> 8) % FLOOR_MUTATORS.length];
}

/** A floor's profile, with the run's twist applied when a seed is given. */
export function floorProfile(floor: number, seed?: string | null): FloorProfile {
  const p = baseProfile(floor);
  const m = floorMutator(seed, floor);
  if (!m) return p;
  p.mutator = m;
  if (m === "gloom") {
    p.theme = { ...p.theme, ambient: p.theme.ambient * 0.55 };
    p.lootLuck += 0.06;
  } else if (m === "horde") {
    p.crowd += 1;
    p.xpMult *= 1.25;
  } else if (m === "champions") {
    p.eliteChance = Math.min(0.6, p.eliteChance + 0.22);
    p.lootLuck += 0.1;
  } else if (m === "traps") {
    p.lootLuck += 0.04;
  } else if (m === "hoard") {
    p.chestTier += 1;
    p.eliteChance = Math.min(0.6, p.eliteChance + 0.08);
  }
  return p;
}

function baseProfile(floor: number): FloorProfile {
  const f = Math.max(1, floor);
  const d = f - 1;
  const enemies: { id: string; weight: number }[] = [
    { id: "orc", weight: f <= 8 ? 5 : 2 },
    { id: "skeleton", weight: f >= 4 ? 5 : 3 },
  ];
  if (f >= 3) enemies.push({ id: "orc_rogue", weight: Math.min(5, f - 2) });
  if (f >= 4) enemies.push({ id: "skeleton_rogue", weight: Math.min(5, f - 3) });
  if (f >= 3) enemies.push({ id: "skeleton_archer", weight: Math.min(4, f - 2) });
  // New faces by depth band, so every few floors you meet something new.
  //   1-5 barrow: rats, goblins, orc archers, spiders
  //   6-10 crypt: ghosts, wraiths, bone mages
  //   11-15 bone halls: cultists, bog slimes
  //   16+ abyss: all of the above, angrier
  if (f >= 2) enemies.push({ id: "goblin", weight: f <= 10 ? 3 : 1 });
  if (f >= 3) enemies.push({ id: "orc_archer", weight: 2 });
  if (f >= 4) enemies.push({ id: "cave_spider", weight: 2 });
  if (f >= 6) enemies.push({ id: "ghost", weight: 3 });
  if (f >= 8) enemies.push({ id: "wraith", weight: 2 + Math.min(2, (f - 8) / 3) });
  if (f >= 9) enemies.push({ id: "bone_mage", weight: 2 });
  if (f >= 11) enemies.push({ id: "cultist", weight: 3 }, { id: "poison_slime", weight: 2 });
  // Specialists that change how you fight, not just how long.
  if (f >= 4) enemies.push({ id: "powder_goblin", weight: 1.5 });
  if (f >= 5) enemies.push({ id: "skeleton_guard", weight: 2 + Math.min(2, (f - 5) / 4) });
  if (f >= 7) enemies.push({ id: "orc_berserker", weight: 2 });

  // Encounters get nastier in *composition*, not just numbers: ranged
  // support from floor 3, swarms from 2, brutes from 6, mixed elites later.
  const melee = ["orc", "skeleton", ...(f >= 3 ? ["orc_rogue"] : []), ...(f >= 4 ? ["skeleton_rogue"] : [])];
  const encounters: FloorProfile["encounters"] = [{ weight: 5, lead: [], fill: melee }];
  if (f >= 2) encounters.push({ weight: 2 + Math.min(3, f / 3), lead: [], fill: ["bone_rattler"], extra: 2 + Math.floor(f / 5) });
  if (f >= 3) encounters.push({ weight: 3 + Math.min(3, f / 4), lead: ["skeleton_archer"], fill: melee });
  if (f >= 6) encounters.push({ weight: 2 + Math.min(4, f / 4), lead: ["orc_brute"], fill: ["orc", "orc_rogue", "skeleton_archer"] });
  if (f >= 9) encounters.push({ weight: 2, lead: ["skeleton_archer", "skeleton_archer"], fill: ["skeleton_rogue", "orc_brute"] });
  // Themed packs: rats in the walls, a goblin raiding party, the haunted
  // crypt, a cult circle.
  if (f >= 1 && f <= 7) encounters.push({ weight: 2, lead: [], fill: ["giant_rat"], extra: 2 + Math.floor(f / 3) });
  if (f >= 2) encounters.push({ weight: 2.5, lead: f >= 4 ? ["goblin_shaman"] : [], fill: ["goblin"], extra: 1 });
  if (f >= 4 && f <= 12) encounters.push({ weight: 1.5, lead: [], fill: ["cave_spider"], extra: 1 });
  if (f >= 6) encounters.push({ weight: 3, lead: f >= 9 ? ["bone_mage"] : [], fill: ["ghost", "skeleton", ...(f >= 8 ? ["wraith"] : [])] });
  if (f >= 11) encounters.push({ weight: 3, lead: ["cultist", "cultist"], fill: ["skeleton_rogue", "wraith", "orc_brute"] });
  // Shield wall: guards up front, archers behind — go round, or bring a maul.
  if (f >= 5) encounters.push({ weight: 2.5, lead: ["skeleton_guard", "skeleton_guard", "skeleton_archer"], fill: ["skeleton", "skeleton_archer"] });
  // Demolition crew: the goblins brought powder. Don't stand in a group.
  if (f >= 4) encounters.push({ weight: 1.5, lead: ["powder_goblin", "powder_goblin"], fill: ["goblin", "goblin"], extra: 1 });
  // A shaman keeping brutes on their feet: kill the healer first.
  if (f >= 7) encounters.push({ weight: 2, lead: ["goblin_shaman", "orc_brute"], fill: ["orc", "orc_rogue"] });
  // Berserkers charge in lines: fight near walls and let them hit stone.
  if (f >= 8) encounters.push({ weight: 2, lead: ["orc_berserker", "orc_berserker"], fill: ["orc_archer", "orc"] });
  const bosses = ["orc_warrior", "skeleton_warrior", "stone_golem", "necromancer", "dragon"];
  const ores = ["iron_vein", "cave_rock"];
  if (f >= 4) ores.push("copper_vein");
  if (f >= 7) ores.push("silver_vein", "crystal");
  if (f >= 11) ores.push("gold_vein", "gem_vein");
  if (f >= 16) ores.push("mithril_vein");
  return {
    floor: f,
    mutator: null,
    theme: floorTheme(f),
    bossFloor: isBossFloor(f),
    enemies,
    encounters,
    bossId: bosses[Math.floor(f / CHECKPOINT_EVERY - 1) % bosses.length] ?? bosses[0],
    // Health grows gently: the danger of depth comes from new enemies,
    // affixed elites, encounter mixes and floor twists, not sponges.
    hpMult: 1 + 0.15 * d + 0.006 * d * d,
    atkMult: 1 + 0.12 * d + (f > 5 ? 0.03 * (f - 5) : 0),
    atkAdd: d * 0.7,
    defAdd: Math.floor(d / 3),
    crowd: Math.min(3, Math.floor(d / 4)),
    eliteChance: Math.min(0.35, 0.03 * d),
    goldMult: 1 + 0.15 * d,
    xpMult: 1 + 0.2 * d,
    lootLuck: Math.min(0.5, 0.02 * d),
    chestTier: 1 + Math.floor(d / 4),
    mainRooms: Math.min(10, 6 + Math.floor(d / 3)),
    ores,
    recommended: 6 + d * 5,
  };
}

/**
 * A rough measure of how ready the player is: attack + defense from all
 * sources. Only used to warn ("Dangerous") — never to block.
 */
export function gearScore(stats: { attack: number; defense: number }): number {
  return stats.attack + stats.defense;
}

export type DangerLevel = "easy" | "fair" | "risky" | "deadly";

export function dangerFor(floor: number, stats: { attack: number; defense: number }): DangerLevel {
  const ratio = gearScore(stats) / floorProfile(floor).recommended;
  if (ratio >= 1.4) return "easy";
  if (ratio >= 1) return "fair";
  if (ratio >= 0.7) return "risky";
  return "deadly";
}
