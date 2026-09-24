/**
 * Random world events: at most one per day, rolled each morning. They're
 * meant to make you go "what is happening today?" — mostly fun, never a
 * lasting punishment. Text lives in i18n (worldEvent.<id>.title / .desc).
 *
 * What each one does is implemented where it happens (town, woods, dungeon,
 * tavern…), all asking `eventActive(id)` from game/social/worldEvents.ts.
 * Adding one = an entry here + its text + a check wherever it matters.
 */
export type WorldEventId = "merchant" | "festival" | "strike" | "brawl" | "storm" | "golden_glow" | "pig" | "stranger";

export interface WorldEventDef {
  id: WorldEventId;
  icon: string;
  weight: number;
  /** Not before this day. */
  minDay: number;
}

export const WORLD_EVENTS: WorldEventDef[] = [
  { id: "merchant", icon: "coin_bag", weight: 3, minDay: 2 },
  { id: "festival", icon: "beer", weight: 2, minDay: 3 },
  { id: "strike", icon: "orc_tusk", weight: 2, minDay: 2 },
  { id: "brawl", icon: "tankard", weight: 2, minDay: 2 },
  { id: "storm", icon: "crystal", weight: 2, minDay: 2 },
  { id: "golden_glow", icon: "gold_ore", weight: 2, minDay: 2 },
  { id: "pig", icon: "meat_raw", weight: 2, minDay: 2 },
  { id: "stranger", icon: "chest", weight: 2, minDay: 3 },
];

/** Chance that a day has no event at all (quiet days matter too). */
export const QUIET_DAY_CHANCE = 0.4;

/** What Zoltan the travelling merchant brings (buy-only). */
export const TRAVELLING_STOCK: { itemId: string; price: number }[] = [
  { itemId: "lucky_charm", price: 180 },
  { itemId: "amethyst_ring", price: 420 },
  { itemId: "greater_potion", price: 40 },
  { itemId: "moon_elixir", price: 140 },
  { itemId: "hunting_bow", price: 90 },
  { itemId: "arrow", price: 2 },
  { itemId: "leather_boots", price: 25 },
  { itemId: "sapphire", price: 70 },
];

/** The Mysterious Traveler's one product. */
export const MYSTERY_STOCK: { itemId: string; price: number }[] = [{ itemId: "mystery_box", price: 50 }];

/** What can come out of a mystery box (weights). Mostly fine. Sometimes a sock. */
export const MYSTERY_BOX_LOOT: { itemId: string; quantity: number; weight: number }[] = [
  { itemId: "old_sock", quantity: 1, weight: 14 },
  { itemId: "health_potion", quantity: 3, weight: 16 },
  { itemId: "iron_bar", quantity: 4, weight: 12 },
  { itemId: "sapphire", quantity: 1, weight: 10 },
  { itemId: "emerald", quantity: 1, weight: 10 },
  { itemId: "ruby", quantity: 1, weight: 6 },
  { itemId: "lucky_charm", quantity: 1, weight: 5 },
  { itemId: "rabbit_foot", quantity: 1, weight: 6 },
  { itemId: "lucky_horseshoe", quantity: 1, weight: 3 },
  { itemId: "diamond", quantity: 1, weight: 2 },
  { itemId: "phoenix_pendant", quantity: 1, weight: 0.6 },
];
