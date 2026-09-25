import { SeededRandom } from "../game/core/rng";
import { CROPS } from "./crops";

/**
 * Travelling merchants: people (and one goblin) who turn up somewhere now and
 * then — in the woods, by the tavern, on event days — with a few things to
 * sell. Each has a pool; what's actually on the blanket today is a seeded
 * roll, and one item is usually on a "deal". Not a permanent shop: a surprise.
 */
export interface MerchantItem {
  itemId: string;
  price: number;
  weight?: number;
}

export interface MerchantDef {
  id: string;
  /** NPC def id (data/npcs.ts) — look, name, dialogue. */
  npc: string;
  pool: MerchantItem[];
  /** How many items are on offer on a given day. */
  count: [number, number];
  /** Always on the stall, whatever the day (Bella's seeds). */
  always?: MerchantItem[];
}

export const MERCHANTS: Record<string, MerchantDef> = {
  // A goblin who "found" all of this. Cheap, strange, occasionally great.
  grisby: {
    id: "grisby",
    npc: "grisby",
    count: [4, 6],
    pool: [
      { itemId: "suspicious_potion", price: 9, weight: 3 },
      { itemId: "goblin_bread", price: 5, weight: 3 },
      { itemId: "old_sock", price: 12, weight: 1 },
      { itemId: "mystery_box", price: 38, weight: 2 },
      { itemId: "iron_ore", price: 6, weight: 2 },
      { itemId: "silver_ore", price: 16, weight: 1 },
      { itemId: "emerald", price: 55, weight: 1 },
      { itemId: "singing_horseshoe", price: 110, weight: 1 },
      { itemId: "return_scroll", price: 40, weight: 1 },
    ],
  },
  // Herb-wife: everything that grows, and remedies made from it.
  olwen: {
    id: "olwen",
    npc: "olwen",
    count: [4, 5],
    pool: [
      { itemId: "herb", price: 4, weight: 3 },
      { itemId: "healroot", price: 14, weight: 2 },
      { itemId: "moonpetal", price: 32, weight: 1 },
      { itemId: "emberbloom", price: 12, weight: 2 },
      { itemId: "healroot_salve", price: 42, weight: 2 },
      { itemId: "forest_stew", price: 24, weight: 2 },
      { itemId: "moon_elixir", price: 150, weight: 1 },
    ],
  },
  // Gambler turned salesman: all luck, no refunds.
  lou: {
    id: "lou",
    npc: "lucky_lou",
    count: [3, 5],
    pool: [
      { itemId: "loaded_dice", price: 160, weight: 1 },
      { itemId: "rabbit_foot", price: 80, weight: 2 },
      { itemId: "lucky_charm", price: 190, weight: 1 },
      { itemId: "singing_horseshoe", price: 95, weight: 2 },
      { itemId: "mystery_box", price: 45, weight: 3 },
      { itemId: "gold_ring", price: 140, weight: 1 },
    ],
  },
  // A retired knight selling his old kit, one piece at a time, with stories.
  reginald: {
    id: "reginald",
    npc: "sir_reginald",
    count: [3, 5],
    pool: [
      { itemId: "leather_cap", price: 30, weight: 2 },
      { itemId: "leather_boots", price: 28, weight: 2 },
      { itemId: "iron_helm", price: 110, weight: 1 },
      { itemId: "iron_boots", price: 95, weight: 1 },
      { itemId: "iron_sword", price: 120, weight: 1 },
      { itemId: "leather_armor", price: 80, weight: 2 },
      { itemId: "greater_potion", price: 45, weight: 2 },
    ],
  },
  // Village market (daytime stalls in Wildkeep).
  bella: {
    id: "bella",
    npc: "bella",
    count: [5, 6],
    always: CROPS.slice(0, 3).map((c) => ({ itemId: c.seed, price: c.seedPrice })),
    pool: [
      ...CROPS.slice(3).map((c) => ({ itemId: c.seed, price: c.seedPrice, weight: c.rare ? 1 : 3 })),
      { itemId: "apple_pie", price: 14, weight: 3 },
      { itemId: "herb", price: 5, weight: 3 },
      { itemId: "healroot", price: 16, weight: 2 },
      { itemId: "forest_stew", price: 22, weight: 2 },
      { itemId: "health_potion", price: 17, weight: 2 },
    ],
  },
  tomas: {
    id: "tomas",
    npc: "tomas",
    count: [3, 5],
    pool: [
      { itemId: "roast_meat", price: 15, weight: 3 },
      { itemId: "goblin_bread", price: 5, weight: 2 },
      { itemId: "arrow", price: 2, weight: 3 },
      { itemId: "plank", price: 6, weight: 2 },
      { itemId: "coal", price: 5, weight: 2 },
      { itemId: "leather", price: 8, weight: 1 },
    ],
  },
  // Trapper: bows, arrows, hides — and she buys nothing, so don't ask.
  rika: {
    id: "rika",
    npc: "rika",
    count: [3, 4],
    pool: [
      { itemId: "arrow", price: 2, weight: 4 },
      { itemId: "hunting_bow", price: 85, weight: 1 },
      { itemId: "roast_meat", price: 16, weight: 3 },
      { itemId: "leather", price: 7, weight: 2 },
      { itemId: "feather", price: 4, weight: 2 },
    ],
  },
};

export interface StockLine {
  itemId: string;
  price: number;
  /** Today's special: marked down. */
  deal?: boolean;
}

/** What a merchant has on the blanket today. */
export function merchantStock(id: string, day: number): StockLine[] {
  const m = MERCHANTS[id];
  if (!m) return [];
  const rng = SeededRandom.fromString(`merchant:${id}:${day}`);
  const n = rng.int(m.count[0], m.count[1]);
  const pool = [...m.pool];
  const out: StockLine[] = [];
  while (out.length < n && pool.length) {
    const it = rng.weighted(pool.map((p) => ({ item: p, weight: p.weight ?? 1 })));
    pool.splice(pool.indexOf(it), 1);
    // Prices wobble a little day to day.
    out.push({ itemId: it.itemId, price: Math.max(1, Math.round(it.price * rng.float(0.85, 1.2))) });
  }
  for (const a of m.always ?? []) out.unshift({ itemId: a.itemId, price: a.price });
  if (out.length && rng.bool(0.7)) {
    const d = out[rng.int(0, out.length - 1)];
    d.price = Math.max(1, Math.round(d.price * 0.65));
    d.deal = true;
  }
  return out;
}
