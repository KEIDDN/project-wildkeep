import { getItem, type ItemDef, type ToolKind } from "../../data/items";
import type { EquipmentSaveState, InventoryStack } from "../save/schema";

/** Best tool of a kind the player owns — equipped or just carried. Gathering
 * never forces slot-juggling between an axe and a pickaxe. */
export function bestTool(kind: ToolKind, equipment: EquipmentSaveState, inventory: InventoryStack[]): ItemDef | null {
  let best: ItemDef | null = null;
  const consider = (id: string | undefined) => {
    if (!id) return;
    const def = getItem(id);
    if (def.toolKind === kind && (!best || (def.toolPower ?? 0) > (best.toolPower ?? 0))) best = def;
  };
  consider(equipment.tool);
  for (const s of inventory) consider(s.itemId);
  return best;
}
