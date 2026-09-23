import type { SeededRandom } from "../core/rng";
import type { LootEntry } from "../../data/enemies";

export interface RolledLoot {
  itemId: string;
  quantity: number;
}

export function rollLoot(
  rng: SeededRandom,
  entries: LootEntry[],
  luckBonus = 0,
): RolledLoot[] {
  const results: RolledLoot[] = [];
  for (const entry of entries) {
    const chance = Math.min(1, entry.chance + luckBonus);
    if (rng.next() < chance) {
      results.push({
        itemId: entry.itemId,
        quantity: rng.int(entry.min, entry.max),
      });
    }
  }
  return results;
}

const CHEST_TABLE = [
  { itemId: "wood", min: 3, max: 6, weight: 20 },
  { itemId: "stone", min: 3, max: 6, weight: 20 },
  { itemId: "iron_ore", min: 1, max: 3, weight: 14 },
  { itemId: "leather", min: 1, max: 3, weight: 12 },
  { itemId: "health_potion", min: 1, max: 2, weight: 10 },
  { itemId: "iron_sword", min: 1, max: 1, weight: 3 },
  { itemId: "iron_armor", min: 1, max: 1, weight: 3 },
  { itemId: "iron_axe", min: 1, max: 1, weight: 2 },
  { itemId: "iron_pickaxe", min: 1, max: 1, weight: 2 },
  { itemId: "lucky_charm", min: 1, max: 1, weight: 1 },
];

export function rollChestLoot(
  rng: SeededRandom,
  isRare: boolean,
  luckBonus = 0,
): RolledLoot[] {
  const rolls = isRare ? 3 : 2;
  const results: RolledLoot[] = [];
  for (let i = 0; i < rolls; i++) {
    const boosted = CHEST_TABLE.map((e) =>
      e.weight <= 3 ? { ...e, weight: e.weight * (1 + luckBonus * 4) } : e,
    );
    const pick = weightedPick(rng, boosted);
    results.push({ itemId: pick.itemId, quantity: rng.int(pick.min, pick.max) });
  }
  return results;
}

function weightedPick<T extends { weight: number }>(
  rng: SeededRandom,
  entries: T[],
): T {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = rng.next() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

export function goldReward(
  rng: SeededRandom,
  range: [number, number],
  sellValueBonus = 0,
): number {
  const base = rng.int(range[0], range[1]);
  return Math.round(base * (1 + sellValueBonus));
}
