import type { Stats } from "../core/types";
import type { EquipmentSaveState } from "../save/schema";
import { computeEffectiveStats } from "./statsSystem";
import { skillStatBonus, type SkillState } from "./skills";
import { houseLevelInfo } from "../../data/house";
import { useTownStore } from "../../store/townStore";
import { useSocialStore } from "../../store/socialStore";
import { talentStats, type TalentRanks } from "../../data/talents";
import { wearFactors } from "./durability";

export function currentHouseLevel(): number {
  return useTownStore.getState().buildingLevels.house ?? 1;
}

/** Liquid courage (the tavern): harder swings, sloppier guard. */
export function drunkStats(level: number): { attack: number; defense: number } {
  if (level >= 80) return { attack: 3, defense: -4 };
  if (level >= 50) return { attack: 2, defense: -2 };
  return { attack: 0, defense: 0 };
}

/** Bonuses that come from progression rather than gear: skills, talents, home (and the tavern). */
export function progressionBonus(skills: SkillState, houseLevel: number, talents?: TalentRanks): Partial<Stats> {
  const s = skillStatBonus(skills);
  const tl = talentStats(talents);
  const drunk = drunkStats(useSocialStore.getState().drunk);
  const add = (k: keyof Stats) => (s[k] ?? 0) + (tl[k] ?? 0);
  return { attack: add("attack") + drunk.attack, defense: add("defense") + drunk.defense, crit: add("crit"), luck: add("luck"), maxHp: add("maxHp") + houseLevelInfo(houseLevel).perks.maxHp };
}

/** The player's real stats: base + gear + skills + talents + house. */
export function playerEffectiveStats(
  p: { baseStats: Stats; equipment: EquipmentSaveState; skills: SkillState; talents?: TalentRanks; wear?: Partial<Record<string, number>> },
  houseLevel = currentHouseLevel(),
): Stats {
  return computeEffectiveStats(p.baseStats, p.equipment, progressionBonus(p.skills, houseLevel, p.talents), wearFactors(p.equipment, p.wear));
}
