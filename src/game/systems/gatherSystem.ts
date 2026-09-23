import type { SeededRandom } from "../core/rng";
import type { ResourceNodeDef } from "../../data/resourceNodes";
import type { RolledLoot } from "./lootSystem";
import { getItem, type ToolKind } from "../../data/items";
import type { EquipmentSaveState } from "../save/schema";
import type { InventoryStack } from "../save/schema";

/** Highest tool power the player owns for a given tool kind, whether the
 * tool is equipped or just sitting in the pack — gathering shouldn't force
 * constant slot-juggling between an axe and a pickaxe. */
export function bestToolPower(
  kind: ToolKind,
  equipment: EquipmentSaveState,
  inventory: InventoryStack[],
): number {
  let power = 0;
  const equippedTool = equipment.tool ? getItem(equipment.tool) : undefined;
  if (equippedTool?.toolKind === kind) {
    power = Math.max(power, equippedTool.toolPower ?? 0);
  }
  for (const stack of inventory) {
    const def = getItem(stack.itemId);
    if (def.toolKind === kind) {
      power = Math.max(power, def.toolPower ?? 0);
    }
  }
  return power;
}

export function canGather(
  node: ResourceNodeDef,
  equipment: EquipmentSaveState,
  inventory: InventoryStack[],
): boolean {
  if (!node.toolKind) return true;
  return bestToolPower(node.toolKind, equipment, inventory) >= (node.toolPowerRequired ?? 1);
}

export function rollGatherDrops(rng: SeededRandom, node: ResourceNodeDef): RolledLoot[] {
  return node.drops.map((drop) => ({
    itemId: drop.itemId,
    quantity: rng.int(drop.min, drop.max),
  }));
}
