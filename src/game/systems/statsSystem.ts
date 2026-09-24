import { getItem, type RelicEffects } from "../../data/items";
import type { EquipmentSaveState } from "../save/schema";
import type { Stats } from "../core/types";

/** `wear`: per-slot multiplier on that piece's bonus (worn gear works less well). */
export function computeEffectiveStats(base: Stats, equipment: EquipmentSaveState, extra: Partial<Stats> = {}, wear: Partial<Record<string, number>> = {}): Stats {
  const result: Stats = { ...base };
  result.maxHp += extra.maxHp ?? 0;
  result.attack += extra.attack ?? 0;
  result.defense += extra.defense ?? 0;
  result.crit += extra.crit ?? 0;
  result.luck += extra.luck ?? 0;
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;
    const bonus = getItem(itemId).statBonus;
    if (!bonus) continue;
    const k = wear[slot] ?? 1;
    result.maxHp += Math.round((bonus.maxHp ?? 0) * k);
    result.attack += Math.round((bonus.attack ?? 0) * k);
    result.defense += Math.round((bonus.defense ?? 0) * k);
    result.crit += (bonus.crit ?? 0) * k;
    result.luck += (bonus.luck ?? 0) * k;
  }
  return result;
}

export function computeRelicEffects(equipment: EquipmentSaveState): Required<RelicEffects> {
  const total: Required<RelicEffects> = {
    rareLootChanceBonus: 0,
    sellValueBonus: 0,
    gatherSpeedBonus: 0,
    cropGrowthBonus: 0,
    dungeonRoomRewardBonus: 0,
  };
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const fx = getItem(itemId).relicEffects;
    if (!fx) continue;
    for (const key of Object.keys(fx) as (keyof RelicEffects)[]) total[key] += fx[key] ?? 0;
  }
  return total;
}

/** XP to go from `level` to the next: 100, 224, 411 … ~3200 at level 10.
 * Kills alone level you slowly; quests, exploration and crafting fill in. */
export function xpForLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.8) + 50);
}

export function statGainsForLevel(level: number): Partial<Stats> {
  return { maxHp: 7, attack: level % 2 === 0 ? 2 : 1, defense: level % 3 === 0 ? 1 : 0 };
}
