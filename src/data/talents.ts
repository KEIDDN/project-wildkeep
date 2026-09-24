import type { Stats } from "../game/core/types";

/**
 * The talent tree: six branches of connected nodes (the sixth, Magic,
 * opens once you've been taught at the Crooked Tower). One point
 * per character level, a bonus point every fifth level, and a few from
 * quests. Rows (tiers) unlock down each branch; capstones also need a
 * character level. ~30 nodes: small enough to read at a glance, big enough
 * that two characters at level 20 play differently.
 *
 *   COMBAT       Sharp Edge · Weapon Master → Keen Eye · Heavy Hand
 *                → Whirlwind (R) · Executioner → Duelist
 *   SURVIVAL     Iron Skin · Endurance → Second Wind · Light Step
 *                → Shadow Roll · Field Medic → Last Stand
 *   EXPLORATION  Fleet Foot · Lumberjack · Prospector · Forager
 *                → Wanderer · Hunter → Treasure Sense
 *   TRADE        Haggler · Artisan → Green Thumb → Fence
 *   LUCK         Lucky Find → Card Sharp · Golden Touch → High Roller → Jackpot
 *
 * Effects are data read through the helpers at the bottom. Text lives in
 * i18n (talents.<id>.name / .desc). Ranks of retired talents are ignored.
 */
export type TalentBranch = "combat" | "survival" | "exploration" | "trade" | "luck" | "magic";
export type TalentId =
  // combat
  | "sharp_edge"
  | "weapon_master"
  | "keen_eye"
  | "heavy_hand"
  | "iron_wall"
  | "whirlwind"
  | "executioner"
  | "counterstrike"
  | "duelist"
  // survival
  | "iron_skin"
  | "endurance"
  | "second_wind"
  | "light_step"
  | "deep_lungs"
  | "shadow_roll"
  | "field_medic"
  | "last_stand"
  // exploration
  | "fleet_foot"
  | "lumberjack"
  | "prospector"
  | "forager"
  | "wanderer"
  | "hunter"
  | "angler"
  | "treasure_sense"
  // craft & trade
  | "haggler"
  | "artisan"
  | "early_riser"
  | "tinkerer"
  | "green_thumb"
  | "stout_heart"
  | "fence"
  // luck
  | "lucky_find"
  | "card_sharp"
  | "golden_touch"
  | "high_roller"
  | "jackpot"
  // magic (opens once you've learned magic)
  | "mana_well"
  | "attunement"
  | "spark_mastery"
  | "chain_spark";

export interface TalentDef {
  id: TalentId;
  branch: TalentBranch;
  icon: string;
  maxRank: number;
  /** Row in its branch (0 = top). */
  tier: number;
  /** Column inside the branch (0 left, 1 middle, 2 right) for the tree view. */
  col: number;
  requires?: { id: TalentId; rank: number };
  /** Character level needed before the first rank. */
  level?: number;
  /** Active ability or a build-defining capstone (drawn bigger). */
  keystone?: boolean;
}

const T = (id: TalentId, branch: TalentBranch, icon: string, maxRank: number, tier: number, col: number, extra: Partial<TalentDef> = {}): TalentDef => ({ id, branch, icon, maxRank, tier, col, ...extra });
const req = (id: TalentId, r = 1) => ({ requires: { id, rank: r } });

export const TALENTS: TalentDef[] = [
  // COMBAT — damage, crits, parries, weapon handling.
  T("sharp_edge", "combat", "sword_iron", 3, 0, 0),
  T("weapon_master", "combat", "dagger_iron", 3, 0, 2),
  T("keen_eye", "combat", "sword_steel", 2, 1, 0, req("sharp_edge")),
  T("iron_wall", "combat", "glyph_shield", 2, 1, 1, req("weapon_master")),
  T("heavy_hand", "combat", "maul_iron", 2, 1, 2, req("weapon_master")),
  T("whirlwind", "combat", "sword_epic", 1, 2, 0, { ...req("sharp_edge", 2), level: 4, keystone: true }),
  T("executioner", "combat", "mace_spiked", 1, 2, 1, { ...req("keen_eye"), level: 6 }),
  T("counterstrike", "combat", "rapier", 1, 2, 2, { ...req("iron_wall", 2), level: 6, keystone: true }),
  T("duelist", "combat", "sword_legendary", 1, 3, 1, { ...req("heavy_hand"), level: 10, keystone: true }),

  // SURVIVAL — health, stamina, dodging, staying alive.
  T("iron_skin", "survival", "armor_iron", 3, 0, 0),
  T("endurance", "survival", "glyph_bolt", 3, 0, 2),
  T("second_wind", "survival", "potion_health", 2, 1, 0, req("iron_skin")),
  T("deep_lungs", "survival", "boots_leather", 2, 1, 1, req("endurance")),
  T("light_step", "survival", "boots_iron", 2, 1, 2, req("endurance")),
  T("field_medic", "survival", "potion_salve", 2, 2, 0, req("second_wind")),
  T("shadow_roll", "survival", "boots_steel", 1, 2, 2, req("light_step")),
  T("last_stand", "survival", "helm_steel", 1, 3, 1, { ...req("second_wind", 2), level: 8, keystone: true }),

  // EXPLORATION — moving, gathering, hunting, fishing, finding.
  T("fleet_foot", "exploration", "boots_mithril", 2, 0, 1),
  T("lumberjack", "exploration", "axe_iron", 2, 0, 0),
  T("prospector", "exploration", "pickaxe_iron", 2, 0, 2),
  T("forager", "exploration", "herb", 2, 1, 0, req("lumberjack")),
  T("hunter", "exploration", "bow_wood", 2, 1, 1, req("fleet_foot")),
  T("angler", "exploration", "rod_wood", 2, 1, 2, req("prospector")),
  T("wanderer", "exploration", "map_scroll", 2, 2, 1, req("fleet_foot", 2)),
  T("treasure_sense", "exploration", "chest", 1, 3, 1, { ...req("wanderer"), level: 5, keystone: true }),

  // CRAFT & TRADE — money, making, mending, farming, the working day.
  T("haggler", "trade", "coin_bag", 3, 0, 0),
  T("artisan", "trade", "anvil", 2, 0, 2),
  T("early_riser", "trade", "glyph_sun", 2, 1, 1),
  T("tinkerer", "trade", "repair_kit", 2, 1, 2, req("artisan")),
  T("green_thumb", "trade", "healroot", 2, 2, 1, req("early_riser")),
  T("stout_heart", "trade", "meat_roast", 2, 2, 2, req("tinkerer")),
  T("fence", "trade", "key", 1, 2, 0, { ...req("haggler", 2), level: 5, keystone: true }),

  // LUCK — loot, gambling, the odd miracle.
  T("lucky_find", "luck", "clover", 3, 0, 1),
  T("card_sharp", "luck", "dice", 1, 1, 0, req("lucky_find")),
  T("golden_touch", "luck", "gold_bar", 2, 1, 2, req("lucky_find")),
  T("high_roller", "luck", "horseshoe", 1, 2, 0, { ...req("card_sharp"), level: 6 }),
  T("jackpot", "luck", "gold_coin", 1, 3, 1, { ...req("golden_touch", 2), level: 10, keystone: true }),

  // MAGIC — sealed until someone teaches you (the Crooked Tower).
  T("mana_well", "magic", "glyph_mana", 3, 0, 1),
  T("attunement", "magic", "mana_potion", 2, 1, 0, req("mana_well")),
  T("spark_mastery", "magic", "spellbook", 2, 1, 2, req("mana_well")),
  T("chain_spark", "magic", "crystal", 1, 2, 1, { ...req("spark_mastery", 2), level: 6, keystone: true }),
];

export const TALENT_BRANCHES: TalentBranch[] = ["combat", "survival", "exploration", "trade", "luck", "magic"];

export type TalentRanks = Partial<Record<TalentId, number>>;

const KNOWN = new Set<string>(TALENTS.map((d) => d.id));

export const rank = (t: TalentRanks | undefined, id: TalentId): number => t?.[id] ?? 0;

/** Points earned by level: one per level after the first, plus a bonus
 * point on every fifth level. */
export function pointsFromLevel(level: number): number {
  return Math.max(0, level - 1) + Math.floor(level / 5);
}

export function pointsSpent(t: TalentRanks | undefined): number {
  return Object.entries(t ?? {}).reduce((a, [id, r]) => a + (KNOWN.has(id) ? (r ?? 0) : 0), 0);
}

/** Unspent points (level points + bonus points from quests − spent). */
export function talentPoints(level: number, t: TalentRanks | undefined, bonus = 0): number {
  return Math.max(0, pointsFromLevel(level) + bonus - pointsSpent(t));
}

export type LearnCheck = "ok" | "maxed" | "noPoints" | "locked" | "level" | "sealed";

/** `magicOpen`: has the player learned magic (the Magic branch is sealed until then)? */
export function canLearn(def: TalentDef, t: TalentRanks | undefined, level: number, bonus = 0, magicOpen = false): LearnCheck {
  if (rank(t, def.id) >= def.maxRank) return "maxed";
  if (def.branch === "magic" && !magicOpen) return "sealed";
  if (def.requires && rank(t, def.requires.id) < def.requires.rank) return "locked";
  if (def.level && level < def.level) return "level";
  if (talentPoints(level, t, bonus) <= 0) return "noPoints";
  return "ok";
}

/** Gold to unlearn everything (cheap early, so experimenting is fine). */
export function respecCost(level: number): number {
  return 25 * level;
}

// ---- effects -------------------------------------------------------------------

/** Flat stat bonuses from talents. */
export function talentStats(t: TalentRanks | undefined): Partial<Stats> {
  return {
    attack: rank(t, "sharp_edge") * 2,
    crit: rank(t, "keen_eye") * 0.04,
    defense: rank(t, "iron_skin") * 2,
    maxHp: rank(t, "second_wind") * 12,
    luck: rank(t, "lucky_find") * 0.02,
  };
}

/** Swing speed multiplier (Weapon Master). */
export const swingSpeedMult = (t: TalentRanks | undefined) => 1 + rank(t, "weapon_master") * 0.06;
/** Heavy attack damage and stamina multipliers (Heavy Hand). */
export const heavyDamageMult = (t: TalentRanks | undefined) => 1 + rank(t, "heavy_hand") * 0.2;
export const heavyCostMult = (t: TalentRanks | undefined) => 1 - rank(t, "heavy_hand") * 0.25;
/** Bonus damage on enemies below 30% health (Executioner). */
export const executeMult = (t: TalentRanks | undefined) => (rank(t, "executioner") ? 1.35 : 1);
/** Perfect-dodge window and riposte length multiplier (Duelist). */
export const duelistMult = (t: TalentRanks | undefined) => (rank(t, "duelist") ? 1.6 : 1);
/** Extra maximum stamina (Endurance). */
export const staminaBonus = (t: TalentRanks | undefined) => rank(t, "endurance") * 15;
/** Dodge cooldown multiplier (Light Step). */
export const dodgeCooldownMult = (t: TalentRanks | undefined) => 1 - rank(t, "light_step") * 0.2;
/** Dodge distance / i-frame multiplier (Shadow Roll). */
export const dodgeReachMult = (t: TalentRanks | undefined) => 1 + rank(t, "shadow_roll") * 0.25;
/** Healing from potions and food (Field Medic). */
export const healMult = (t: TalentRanks | undefined) => 1 + rank(t, "field_medic") * 0.2;
/** Last Stand: survive a killing blow at 1 HP, this often (seconds). */
export const LAST_STAND_COOLDOWN = 300;
/** Movement speed multiplier (Fleet Foot). */
export const moveSpeedMult = (t: TalentRanks | undefined) => 1 + rank(t, "fleet_foot") * 0.06;
/** Extra gathering power and double-yield chance for a node's skill. */
export function gatherTalent(t: TalentRanks | undefined, skill: string): { power: number; double: number } {
  const r = skill === "woodcutting" ? rank(t, "lumberjack") : skill === "mining" ? rank(t, "prospector") : skill === "gathering" ? rank(t, "forager") : 0;
  return { power: r, double: r * 0.08 };
}
/** Character XP multiplier (Wanderer). */
export const xpMult = (t: TalentRanks | undefined) => 1 + rank(t, "wanderer") * 0.08;
/** Hunting: animal drop multiplier and arrow damage (Hunter). */
export const huntDropChance = (t: TalentRanks | undefined) => rank(t, "hunter") * 0.25;
export const arrowBonus = (t: TalentRanks | undefined) => rank(t, "hunter") * 3;
/** Extra item roll in every chest (Treasure Sense). */
export const chestRollBonus = (t: TalentRanks | undefined) => rank(t, "treasure_sense");
/** Shop price multipliers (Haggler). */
export const hagglerSell = (t: TalentRanks | undefined) => 1 + rank(t, "haggler") * 0.05;
export const hagglerBuy = (t: TalentRanks | undefined) => 1 - rank(t, "haggler") * 0.04;
/** Crafting gold cost multiplier (Artisan). */
export const artisanGold = (t: TalentRanks | undefined) => 1 - rank(t, "artisan") * 0.2;
/** Crop growth speed and bonus-harvest chance (Green Thumb). */
export const cropGrowthMult = (t: TalentRanks | undefined) => 1 + rank(t, "green_thumb") * 0.2;
export const bonusHarvestChance = (t: TalentRanks | undefined) => rank(t, "green_thumb") * 0.2;
/** Fence: stolen goods can be sold (at this fraction of the price). */
export const fenceRate = (t: TalentRanks | undefined) => (rank(t, "fence") ? 0.55 : 0);
/** Gambling winnings multiplier (Card Sharp). */
export const gamblingWinMult = (t: TalentRanks | undefined) => 1 + rank(t, "card_sharp") * 0.1;
/** Chance a loot drop comes out one rarity better (Golden Touch). */
export const rarityUpChance = (t: TalentRanks | undefined) => rank(t, "golden_touch") * 0.06;
/** Table limit multiplier (High Roller). */
export const tableLimitMult = (t: TalentRanks | undefined) => (rank(t, "high_roller") ? 2 : 1);
/** Chance any kill spills a purse of gold (Jackpot). */
export const jackpotChance = (t: TalentRanks | undefined) => (rank(t, "jackpot") ? 0.02 : 0);

/** Parried enemies stay staggered longer and ripostes hit harder (Counterstrike). */
export const counterStunMult = (t: TalentRanks | undefined) => (rank(t, "counterstrike") ? 1.5 : 1);
export const counterRiposteMult = (t: TalentRanks | undefined) => (rank(t, "counterstrike") ? 1.4 : 1);
/** Fishing: bites come sooner and rare fish more often (Angler). */
export const anglerBite = (t: TalentRanks | undefined) => 1 - rank(t, "angler") * 0.2;
export const anglerRare = (t: TalentRanks | undefined) => rank(t, "angler") * 0.35;
/** Magic: max mana, mana regen, spark damage. */
export const manaWellBonus = (t: TalentRanks | undefined) => rank(t, "mana_well") * 15;
export const attunementMult = (t: TalentRanks | undefined) => 1 + rank(t, "attunement") * 0.35;
export const sparkMult = (t: TalentRanks | undefined) => 1 + rank(t, "spark_mastery") * 0.25;

/** Parry window multiplier (Iron Wall). */
export const parryWindowMult = (t: TalentRanks | undefined) => 1 + rank(t, "iron_wall") * 0.3;
/** Sprint stamina cost multiplier (Deep Lungs). */
export const sprintCostMult = (t: TalentRanks | undefined) => 1 - rank(t, "deep_lungs") * 0.25;

/** Whirlwind: an active spin attack on R. */
export const WHIRLWIND = { cooldown: 8, damage: 1.4, radius: 34 };
