import type { Stats } from "../core/types";
import type { SkillId } from "../../data/skills";
import { MAX_SKILL_LEVEL, skillXpForLevel } from "../../data/skills";

export type SkillState = Record<SkillId, { level: number; xp: number }>;

export function freshSkills(): SkillState {
  return {
    strength: { level: 1, xp: 0 },
    defense: { level: 1, xp: 0 },
    mining: { level: 1, xp: 0 },
    woodcutting: { level: 1, xp: 0 },
    gathering: { level: 1, xp: 0 },
    luck: { level: 1, xp: 0 },
    gambling: { level: 1, xp: 0 },
  };
}

/** Adds XP to one skill, rolling over as many levels as it pays for. */
export function addSkillXp(skills: SkillState, id: SkillId, amount: number): { skills: SkillState; gained: number } {
  let { level, xp } = skills[id];
  const start = level;
  xp += Math.max(0, amount);
  while (level < MAX_SKILL_LEVEL && xp >= skillXpForLevel(level)) {
    xp -= skillXpForLevel(level);
    level++;
  }
  if (level >= MAX_SKILL_LEVEL) xp = 0;
  return { skills: { ...skills, [id]: { level, xp } }, gained: level - start };
}

// ---------------------------------------------------------------------------
// What levels are worth. Kept deliberately modest: skills should feel like
// steady growth, not replace gear.
// ---------------------------------------------------------------------------

/** Flat stat bonuses from skills (added on top of base stats + gear). */
export function skillStatBonus(skills: SkillState): Partial<Stats> {
  return {
    // +1 attack every 2 Strength levels.
    attack: Math.floor((skills.strength.level - 1) / 2),
    // Defense: +1 defense every 2 levels and +2 max HP per level.
    defense: Math.floor((skills.defense.level - 1) / 2),
    maxHp: (skills.defense.level - 1) * 2,
    // Luck skill: +0.5% luck per level (rare loot, crits, rare gathers).
    luck: (skills.luck.level - 1) * 0.005,
  };
}

/** Extra damage per swing on resource nodes (multiplier bonus). */
export function gatherPowerBonus(level: number): number {
  return (level - 1) * 0.06;
}

/** Chance that a depleted node drops its haul twice. */
export function doubleYieldChance(level: number): number {
  return Math.min(0.35, (level - 1) * 0.02);
}

/** Multiplier bonus on `rare` node drops (hardwood in oaks, gems in rock…). */
export function rareFindBonus(level: number): number {
  return (level - 1) * 0.05;
}

/** Largest single bet the Blackjack table accepts at a Gambling level. */
export function maxBetFor(gamblingLevel: number): number {
  const ladder = [25, 50, 100, 150, 250, 400, 600, 800, 1000];
  return ladder[Math.min(ladder.length - 1, gamblingLevel - 1)];
}

/**
 * Luck's (tiny) say at the card table: a chance that a push breaks your way.
 * Capped well below the house edge, so the casino always stays risky.
 */
export function luckyPushChance(luckLevel: number): number {
  return Math.min(0.08, (luckLevel - 1) * 0.008);
}
