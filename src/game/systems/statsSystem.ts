import { getItem, type RelicEffects } from "../../data/items";
import type { EquipmentSaveState } from "../save/schema";
import type { Stats } from "../core/types";

export function computeEffectiveStats(
  base: Stats,
  equipment: EquipmentSaveState,
): Stats {
  const result: Stats = { ...base };
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const def = getItem(itemId);
    if (!def.statBonus) continue;
    result.maxHp += def.statBonus.maxHp ?? 0;
    result.attack += def.statBonus.attack ?? 0;
    result.defense += def.statBonus.defense ?? 0;
    result.crit += def.statBonus.crit ?? 0;
    result.luck += def.statBonus.luck ?? 0;
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
  const relicId = equipment.relic;
  if (!relicId) return total;
  const def = getItem(relicId);
  if (!def.relicEffects) return total;
  return { ...total, ...def.relicEffects };
}

export function xpForLevel(level: number): number {
  return Math.round(20 * Math.pow(level, 1.5));
}

export function statGainsForLevel(): Partial<Stats> {
  return { maxHp: 6, attack: 1, defense: 1 };
}
