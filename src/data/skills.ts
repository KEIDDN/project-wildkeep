/**
 * Player skills. Each one levels independently through use; what a level is
 * *worth* lives in `game/systems/skills.ts`, so tuning never touches callers.
 */
export type SkillId = "strength" | "defense" | "mining" | "woodcutting" | "gathering" | "luck" | "gambling";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** How you train it. */
  trainedBy: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  strength: { id: "strength", name: "Strength", icon: "skill_strength", trainedBy: "Fighting monsters" },
  defense: { id: "defense", name: "Defense", icon: "armor_iron", trainedBy: "Taking hits (and living)" },
  mining: { id: "mining", name: "Mining", icon: "pickaxe_iron", trainedBy: "Breaking rocks and ore veins" },
  woodcutting: { id: "woodcutting", name: "Woodcutting", icon: "axe_iron", trainedBy: "Felling trees" },
  gathering: { id: "gathering", name: "Gathering", icon: "herb", trainedBy: "Picking herbs and mushrooms" },
  luck: { id: "luck", name: "Luck", icon: "clover", trainedBy: "Rare finds, chests and lucky hands" },
  gambling: { id: "gambling", name: "Gambling", icon: "dice", trainedBy: "Blackjack and the Wheel of Fates" },
};

export const SKILL_ORDER: SkillId[] = ["strength", "defense", "mining", "woodcutting", "gathering", "luck", "gambling"];

export const MAX_SKILL_LEVEL = 50;

/** XP needed to go from `level` to `level + 1`. */
export function skillXpForLevel(level: number): number {
  return Math.round(28 * Math.pow(level, 1.45));
}
