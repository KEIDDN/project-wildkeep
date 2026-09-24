import type { LootEntry } from "../../data/enemies";
import { ITEMS, type ItemDef } from "../../data/items";
import { RARITY_ORDER, type Rarity } from "../core/types";
import type { InventoryStack } from "../save/schema";

type Rand = () => number;

const int = (rand: Rand, min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

export function rollLoot(entries: LootEntry[], luckBonus = 0, rand: Rand = Math.random): InventoryStack[] {
  const results: InventoryStack[] = [];
  for (const entry of entries) {
    // Luck matters most for the rare stuff.
    const chance = Math.min(1, entry.chance * (entry.chance < 0.2 ? 1 + luckBonus * 3 : 1));
    if (rand() < chance) results.push({ itemId: entry.itemId, quantity: int(rand, entry.min, entry.max) });
  }
  return results;
}

/**
 * Deeper floors shed deeper materials: every kill has a small chance of an
 * ore or reagent from the floor's depth band, so pushing deeper pays even
 * before the chests.
 */
const FLOOR_DROPS: { from: number; itemId: string; chance: number; max: number }[] = [
  { from: 1, itemId: "coal", chance: 0.08, max: 2 },
  { from: 3, itemId: "iron_ore", chance: 0.1, max: 2 },
  { from: 4, itemId: "copper_ore", chance: 0.1, max: 2 },
  { from: 7, itemId: "silver_ore", chance: 0.08, max: 2 },
  { from: 9, itemId: "healroot", chance: 0.06, max: 1 },
  { from: 11, itemId: "gold_ore", chance: 0.07, max: 1 },
  { from: 16, itemId: "mithril_ore", chance: 0.04, max: 1 },
];

export function floorBonusDrops(floor: number, luck = 0, rank: "normal" | "elite" | "boss" = "normal", rand: Rand = Math.random): InventoryStack[] {
  const mult = (rank === "normal" ? 1 : rank === "elite" ? 2.5 : 5) * (1 + luck);
  const out: InventoryStack[] = [];
  for (const d of FLOOR_DROPS) {
    if (floor < d.from) continue;
    if (rand() < Math.min(0.9, d.chance * mult)) out.push({ itemId: d.itemId, quantity: int(rand, 1, d.max) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gear: rarity first, then an item of that rarity the depth allows. Most
// rolls are common or uncommon; epics are an event; legendaries are a story.
// ---------------------------------------------------------------------------

/** Base odds of each rarity for one gear roll. */
const RARITY_WEIGHT: Record<Rarity, number> = { common: 52, uncommon: 33, rare: 6, epic: 1.6, legendary: 0.4 };

/** Roughly how deep a piece of gear starts turning up (from its value). */
export function gearDepth(def: ItemDef): number {
  const v = def.value;
  if (v <= 20) return 1;
  if (v <= 70) return 2;
  if (v <= 170) return 5;
  if (v <= 320) return 9;
  if (v <= 700) return 13;
  return 17;
}

const GEAR_POOL = (): ItemDef[] => Object.values(ITEMS).filter((d) => d.equipSlot && !d.keyItem && !d.uniqueFrom && d.value > 0);
let pool: ItemDef[] | null = null;

/**
 * One gear roll. `depth` is the dungeon floor (or the area's level); luck
 * and depth tilt the odds toward the good stuff; `upChance` (Golden Touch)
 * can bump the result one rarity. Returns null when nothing fits.
 */
export function rollGear(depth: number, luck = 0, rand: Rand = Math.random, opts: { minRarity?: Rarity; upChance?: number } = {}): string | null {
  pool ??= GEAR_POOL();
  const min = RARITY_ORDER.indexOf(opts.minRarity ?? "common");
  const d = Math.max(0, depth - 1);
  const weights = RARITY_ORDER.map((r, i) => {
    if (i < min) return 0;
    const deep = i >= 2 ? 1 + d * (0.04 + 0.02 * (i - 2)) : i === 0 ? Math.max(0.3, 1 - d * 0.04) : 1;
    return RARITY_WEIGHT[r] * deep * (i >= 2 ? 1 + luck * 2 : 1);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  let idx = min;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      idx = i;
      break;
    }
  }
  if (opts.upChance && rand() < opts.upChance) idx = Math.min(RARITY_ORDER.length - 1, idx + 1);
  // Nothing of that rarity this shallow? Step down one tier at most (never
  // below the minimum) — too-good rolls on shallow floors fizzle instead of
  // flooding the early game with rares.
  for (let i = idx; i >= Math.max(min, idx - 1); i--) {
    const fits = pool.filter((g) => g.rarity === RARITY_ORDER[i] && gearDepth(g) <= depth + 1);
    if (fits.length) return fits[Math.floor(rand() * fits.length)].id;
  }
  return null;
}

/** A boss's own unique, if the dice agree (rare on purpose). */
export function rollUnique(bossId: string, luck = 0, rand: Rand = Math.random): string | null {
  const own = Object.values(ITEMS).filter((d) => d.uniqueFrom === bossId);
  for (const d of own) {
    const chance = (d.rarity === "legendary" ? 0.06 : 0.12) * (1 + luck * 2);
    if (rand() < chance) return d.id;
  }
  return null;
}

/** How often each source rolls for gear at all. */
export const GEAR_CHANCE = { normal: 0.015, elite: 0.1, guardian: 0.3, chest: 0.12, rareChest: 0.45 };

interface ChestEntry {
  itemId: string;
  min: number;
  max: number;
  weight: number;
  minTier?: number;
}

// Weighted chest table: materials, potions and trinkets. Gear comes from a
// separate rarity roll (see rollGear), so chests don't hand out swords.
const CHEST_TABLE: ChestEntry[] = [
  { itemId: "iron_ore", min: 1, max: 3, weight: 18 },
  { itemId: "leather", min: 1, max: 3, weight: 12 },
  { itemId: "health_potion", min: 1, max: 1, weight: 14 },
  { itemId: "greater_potion", min: 1, max: 1, weight: 4, minTier: 2 },
  { itemId: "coal", min: 2, max: 4, weight: 10 },
  { itemId: "gold_ore", min: 1, max: 2, weight: 6 },
  { itemId: "crystal", min: 1, max: 1, weight: 5 },
  { itemId: "sapphire", min: 1, max: 1, weight: 3 },
  { itemId: "emerald", min: 1, max: 1, weight: 3 },
  { itemId: "arrow", min: 3, max: 8, weight: 6 },
  // --- jackpots (boosted by luck / rare chests) ---
  { itemId: "ruby", min: 1, max: 1, weight: 1 },
  { itemId: "amethyst", min: 1, max: 1, weight: 1 },
  { itemId: "diamond", min: 1, max: 1, weight: 0.2 },
  // --- deeper floors (chest tier = 1 + floor/4) ---
  { itemId: "copper_ore", min: 1, max: 3, weight: 10, minTier: 2 },
  { itemId: "return_scroll", min: 1, max: 1, weight: 6, minTier: 2 },
  { itemId: "silver_ore", min: 1, max: 3, weight: 8, minTier: 3 },
  { itemId: "healroot_salve", min: 1, max: 1, weight: 5, minTier: 3 },
  { itemId: "gold_bar", min: 1, max: 1, weight: 3, minTier: 4 },
  { itemId: "mithril_ore", min: 1, max: 2, weight: 2.5, minTier: 5 },
];

/** The special reward in a boss floor's chest: a gear roll that can't come out worse than rare. */
export function rollBossReward(floor: number, luck = 0, rand: Rand = Math.random, upChance = 0): InventoryStack | null {
  const id = rollGear(floor + 2, luck, rand, { minRarity: floor >= 15 ? "epic" : "rare", upChance });
  return id ? { itemId: id, quantity: 1 } : null;
}

export function rollChestLoot(tier: number, isRare: boolean, luckBonus = 0, rand: Rand = Math.random, extraRolls = 0): InventoryStack[] {
  const rolls = (isRare ? 3 : 1) + (tier >= 3 ? 1 : 0) + extraRolls;
  const jackpotBoost = 1 + luckBonus * 5 + (isRare ? 2 : 0) + (tier - 1) * 0.5;
  const table = CHEST_TABLE.filter((e) => (e.minTier ?? 1) <= tier).map((e) => ({
    ...e,
    weight: e.weight <= 1.5 ? e.weight * jackpotBoost : e.weight,
  }));
  const results: InventoryStack[] = [];
  for (let i = 0; i < rolls; i++) {
    const total = table.reduce((s, e) => s + e.weight, 0);
    let roll = rand() * total;
    let pick = table[table.length - 1];
    for (const e of table) {
      roll -= e.weight;
      if (roll <= 0) {
        pick = e;
        break;
      }
    }
    const q = int(rand, pick.min, pick.max);
    const existing = results.find((r) => r.itemId === pick.itemId);
    if (existing) existing.quantity += q;
    else results.push({ itemId: pick.itemId, quantity: q });
  }
  return results;
}

export function chestGold(tier: number, isRare: boolean, rand: Rand = Math.random): number {
  const base = int(rand, 5, 12) * tier;
  return isRare ? Math.round(base * 2.5) : base;
}
