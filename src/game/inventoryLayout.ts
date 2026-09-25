import { getItem } from "../data/items";
import { rarityRank } from "./core/types";
import { itemName } from "../i18n/content";
import type { InventoryStack } from "./save/schema";

/** The bag grid: 7 wide, 5 rows to start, growing a row at a time. */
export const BAG_COLS = 7;
export const BAG_MIN_SLOTS = 35;

const CATEGORY_ORDER = ["weapon", "armor", "tool", "accessory", "relic", "consumable", "utility", "resource"];

export type SortMode = "type" | "rarity" | "value" | "name";

const byName = (a: InventoryStack, b: InventoryStack) => itemName(a.itemId).localeCompare(itemName(b.itemId)) || Number(!!a.stolen) - Number(!!b.stolen);

const COMPARE: Record<SortMode, (a: InventoryStack, b: InventoryStack) => number> = {
  // Key items first, then gear → food → materials, best first within each.
  type: (a, b) => {
    const da = getItem(a.itemId);
    const db = getItem(b.itemId);
    return (
      Number(!!db.keyItem) - Number(!!da.keyItem) ||
      CATEGORY_ORDER.indexOf(da.category) - CATEGORY_ORDER.indexOf(db.category) ||
      rarityRank(db.rarity) - rarityRank(da.rarity) ||
      byName(a, b)
    );
  },
  rarity: (a, b) => rarityRank(getItem(b.itemId).rarity) - rarityRank(getItem(a.itemId).rarity) || COMPARE.type(a, b),
  value: (a, b) => getItem(b.itemId).value * b.quantity - getItem(a.itemId).value * a.quantity || byName(a, b),
  name: byName,
};

export function sortStacks(stacks: InventoryStack[], mode: SortMode = "type"): InventoryStack[] {
  return [...stacks].sort(COMPARE[mode]);
}

/**
 * Where every stack sits in the bag grid. Returns `grid[slot] = stack index`
 * (or -1 for an empty slot). Stacks keep the slot they were dragged to; new
 * ones fill the first free slot. A bag that has never been arranged (old
 * saves) lays out in the classic sorted order.
 */
export function bagLayout(stacks: InventoryStack[], minSlots = BAG_MIN_SLOTS): number[] {
  const pos: number[] = Array.from({ length: stacks.length }, () => -1);
  const used = new Set<number>();
  stacks.forEach((s, i) => {
    if (typeof s.slot === "number" && s.slot >= 0 && !used.has(s.slot)) {
      pos[i] = s.slot;
      used.add(s.slot);
    }
  });
  const rest = stacks.map((_, i) => i).filter((i) => pos[i] < 0);
  if (used.size === 0) rest.sort((a, b) => COMPARE.type(stacks[a], stacks[b]));
  let next = 0;
  for (const i of rest) {
    while (used.has(next)) next++;
    pos[i] = next;
    used.add(next);
  }
  const last = pos.reduce((m, p) => Math.max(m, p), -1);
  // Always one spare row once the bag is nearly full, so there's room to drop.
  const size = Math.max(minSlots, Math.ceil((Math.max(last + 1, stacks.length) + 1) / BAG_COLS) * BAG_COLS);
  const grid: number[] = Array.from({ length: size }, () => -1);
  pos.forEach((p, i) => (grid[p] = i));
  return grid;
}

/** Writes the current layout into the stacks, so later moves are stable. */
export function pinSlots(stacks: InventoryStack[]): InventoryStack[] {
  const grid = bagLayout(stacks);
  const out = stacks.map((s) => ({ ...s }));
  grid.forEach((i, slot) => {
    if (i >= 0) out[i].slot = slot;
  });
  return out;
}

/** Can these two stacks become one? (Same item, same honesty, no wear.) */
export function canMerge(a: InventoryStack, b: InventoryStack): boolean {
  const def = getItem(a.itemId);
  return def.stackable && a.itemId === b.itemId && !!a.stolen === !!b.stolen && a.dur === undefined && b.dur === undefined;
}
