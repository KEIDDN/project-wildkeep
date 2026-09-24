/**
 * Combat rules as data: how each weapon family swings, what damage type it
 * deals, the stamina economy, and the affixes elites roll. Engine code
 * (Player, Enemy, CombatSystem) reads these; tuning never touches it.
 *
 * Design: simple to understand (tap = combo, hold = heavy, F = dodge),
 * difficult to master (stamina decides whether you can dodge after that
 * combo, perfect dodges open ripostes, enemies have weaknesses and guards).
 */

export type WeaponKind = "sword" | "dagger" | "maul" | "spear" | "bow";
export type DamageType = "slash" | "blunt" | "pierce";

export interface WeaponProfile {
  kind: WeaponKind;
  damageType: DamageType;
  /** Animation speed (1 = sword). Faster weapons chain quicker. */
  speed: number;
  /** Swing reach multiplier. */
  reach: number;
  /** Minimum cos(angle) from facing a target must be within (lower = wider arc). */
  arc: number;
  /** Damage multiplier per light hit. */
  damage: number;
  knock: number;
  /** Poise damage per light hit (how quickly enemies flinch). */
  poise: number;
  /** Combo steps (indexes into Player COMBO), in order. */
  combo: number[];
  /** Stamina per light swing. */
  cost: number;
  /** Heavy (charged) attack damage multiplier. */
  heavy: number;
  /** Extra crit chance while wielded. */
  crit: number;
}

export const WEAPONS: Record<WeaponKind, WeaponProfile> = {
  sword: { kind: "sword", damageType: "slash", speed: 1, reach: 1, arc: 0.35, damage: 1, knock: 1, poise: 1, combo: [0, 1, 2], cost: 9, heavy: 2.2, crit: 0 },
  // Quick, short, loves crits and backstabs; four-hit combo.
  dagger: { kind: "dagger", damageType: "pierce", speed: 1.4, reach: 0.8, arc: 0.45, damage: 0.72, knock: 0.6, poise: 1, combo: [0, 1, 0, 2], cost: 6, heavy: 1.8, crit: 0.1 },
  // Slow, wide, crushing; two-hit combo that staggers almost anything.
  maul: { kind: "maul", damageType: "blunt", speed: 0.72, reach: 1.1, arc: 0.05, damage: 1.55, knock: 1.7, poise: 2, combo: [0, 2], cost: 15, heavy: 2.6, crit: -0.02 },
  // Long, narrow thrusts: fight from outside their reach.
  spear: { kind: "spear", damageType: "pierce", speed: 0.92, reach: 1.5, arc: 0.72, damage: 1.05, knock: 1.1, poise: 1, combo: [0, 1, 2], cost: 8, heavy: 2.1, crit: 0.02 },
  bow: { kind: "bow", damageType: "pierce", speed: 1, reach: 1, arc: 0.35, damage: 1, knock: 0.6, poise: 1, combo: [0], cost: 7, heavy: 1, crit: 0 },
};

/**
 * Stamina: the next ten seconds. Early on it's tight — a few swings and a
 * dodge, a short sprint — and it grows with level, Endurance and gear.
 */
export const STAMINA = {
  /** Level-1 maximum; see Player.maxStamina for what adds to it. */
  max: 75,
  /** Extra maximum per character level (capped). */
  perLevel: 1.5,
  perLevelCap: 45,
  /** Per second, once `delay` has passed since the last spend. */
  regen: 28,
  delay: 0.7,
  dodge: 22,
  /** Extra cost of a charged heavy on top of a light swing. */
  heavy: 20,
  /** Per second while running. */
  sprint: 13,
  /** After running dry you can't sprint again until you're back to this. */
  sprintResume: 20,
};

/**
 * Parry: raise your guard just as a blow lands. Only some attacks can be
 * parried — lunges, combos and arrows (red telegraphs). Slams, charges and
 * blasts (amber telegraphs) have to be dodged.
 */
export const PARRY = {
  /** Seconds the guard is up after the press. */
  window: 0.2,
  /** Seconds stuck in the stance after a whiff (hits here hurt more). */
  recovery: 0.32,
  cost: 10,
  cooldown: 0.55,
  /** Stagger on a successful parry (bosses shrug it off faster). */
  stun: 1.25,
  bossStun: 0.45,
  refund: 16,
  /** Riposte opening after a parry. */
  riposte: 1.5,
  /** Damage multiplier if you're hit mid-whiff. */
  exposed: 1.25,
};

/** Heavy attack: hold the attack button. */
export const HEAVY = { holdToCharge: 0.22, chargeTime: 0.45, maxHold: 2.5 };

/** Perfect dodge: dodge right as something is about to hit you. */
export const PERFECT_DODGE = { window: 0.26, riposte: 1.6, refund: 20, slowMo: 0.3 };

/** Damage-type multipliers against an enemy's weaknesses / resistances. */
export const WEAK_MULT = 1.5;
export const RESIST_MULT = 0.6;
/** Silver weapons against the undead. */
export const BANE_MULT = 1.5;
/** Guarded (shielded) enemies hit from the front. */
export const GUARD_MULT = 0.25;

// ---- elite affixes ----------------------------------------------------------------

export type Affix = "swift" | "armored" | "vampiric" | "frenzied" | "explosive" | "shielded";

export const AFFIXES: Affix[] = ["swift", "armored", "vampiric", "frenzied", "explosive", "shielded"];

export const AFFIX_COLOR: Record<Affix, number> = {
  swift: 0x9fe8ff,
  armored: 0xc8ccd8,
  vampiric: 0xff5a6a,
  frenzied: 0xff9a3a,
  explosive: 0xffd24a,
  shielded: 0x8ab8ff,
};

/** How many affixes an elite rolls at a given depth / level. */
export function affixCount(floor: number): number {
  if (floor >= 15) return 3;
  if (floor >= 8) return 2;
  return 1;
}

/** Deterministic affix pick from a spawn id (same floor seed, same elite). */
export function rollAffixes(key: string, floor: number, exclude: Affix[] = []): Affix[] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const pool = AFFIXES.filter((a) => !exclude.includes(a));
  const out: Affix[] = [];
  const n = Math.min(pool.length, affixCount(floor));
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}
