/** What the General Store sells (price is the buy price, not sell value). */
export const GENERAL_STORE_STOCK: { itemId: string; price: number }[] = [
  { itemId: "health_potion", price: 25 },
  { itemId: "greater_potion", price: 75 },
  { itemId: "return_scroll", price: 60 },
  { itemId: "arrow", price: 2 },
  { itemId: "rusty_axe", price: 20 },
  { itemId: "rusty_pickaxe", price: 20 },
  { itemId: "hoe", price: 30 },
  { itemId: "watering_can", price: 40 },
  { itemId: "fishing_rod", price: 45 },
  { itemId: "bait", price: 2 },
  { itemId: "whetstone", price: 15 },
  { itemId: "repair_kit", price: 70 },
  { itemId: "leather_armor", price: 140 },
  { itemId: "gold_ring", price: 260 },
];

/**
 * Specialists: they sell their own gear and pay better than Mira for their
 * own kind of goods (and won't touch anything else).
 */
export const SPECIALISTS = {
  hunter: {
    npc: "garrick",
    stock: [
      { itemId: "hunting_bow", price: 110 },
      { itemId: "arrow", price: 2 },
      { itemId: "leather", price: 12 },
      { itemId: "roast_meat", price: 30 },
    ],
    buys: ["meat_raw", "hide", "feather", "antler", "leather", "bone", "golden_antler", "white_pelt", "dire_tusk", "rabbit_foot"],
    rate: 1.35,
  },
  angler: {
    npc: "marit",
    stock: [
      { itemId: "fishing_rod", price: 45 },
      { itemId: "bait", price: 2 },
      { itemId: "grilled_fish", price: 35 },
    ],
    buys: ["fish_minnow", "fish_perch", "fish_carp", "fish_trout", "fish_salmon", "fish_pike", "fish_rainbow", "fish_moon", "fish_golden"],
    rate: 1.3,
  },
} as const;

export type SpecialistId = keyof typeof SPECIALISTS;

/** Fraction of an item's value the store pays when you sell. */
export const SELL_RATE = { goods: 0.6, gear: 0.35 };

/** Crafting gold costs are scaled by this (Bram has bills too). */
export const CRAFT_GOLD_MULT = 1.5;

/** Tavern menu. */
export const TAVERN_MENU = [
  { id: "stew", name: "Hearty Stew", price: 12, description: "Restores all HP.", icon: "beer" },
  { id: "ale", name: "Frothy Ale", price: 4, description: "Restores 15 HP. Tastes like courage.", icon: "beer" },
] as const;
