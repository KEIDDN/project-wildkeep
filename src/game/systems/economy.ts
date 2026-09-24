import { getItem } from "../../data/items";
import { SELL_RATE } from "../../data/shops";
import type { EquipmentSaveState } from "../save/schema";
import { computeRelicEffects } from "./statsSystem";

/** What honest merchants pay: materials and food keep most of their value;
 * second-hand gear doesn't (so finding a sword is about the sword, not the resale). */
export function sellPrice(itemId: string, equipment: EquipmentSaveState): number {
  const bonus = computeRelicEffects(equipment).sellValueBonus;
  const def = getItem(itemId);
  return Math.max(1, Math.round(def.value * (def.equipSlot ? SELL_RATE.gear : SELL_RATE.goods) * (1 + bonus)));
}

export function isEquippedItem(itemId: string, equipment: EquipmentSaveState): boolean {
  return Object.values(equipment).includes(itemId);
}
