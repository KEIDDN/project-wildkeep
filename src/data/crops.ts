/**
 * What grows in your patch. Growth is measured in in-game hours (a day is
 * ~20 real minutes), and only counts on days you watered: a dry plot
 * waits. Some plants keep fruiting after the first harvest.
 *
 * Seeds come from Hob (quest), Bella's market stall and the odd chest;
 * crops sell to Mira, feed quests and the kitchen.
 *
 * Economy: a watered day is ~22 growing hours, so a plot nets roughly
 * 12-25g a day whatever you grow (Greta's price, seed paid). Fruiting
 * plants save you replanting, not money: they set fruit every other day
 * (regrow > 24h) — at every-day they out-earned a dungeon run for a few
 * seconds' watering. The garden is steady income beside an adventure, not
 * instead of one.
 */
export interface CropDef {
  id: string;
  seed: string;
  /** Harvested item. */
  item: string;
  /** Watered in-game hours to ripen. */
  hours: number;
  yield: [number, number];
  /** Hours to fruit again after picking (plant stays). */
  regrow?: number;
  /** Seed price at Bella's stall. */
  seedPrice: number;
  /** Plant tint per growth stage (sprout → ripe), drawn procedurally. */
  color: number;
  /** How the plant is drawn: leafy tops over a root, a bush, a vine on a
   * stake, a tall stalk, a sprawling vine, a round head, a herb. */
  shape: CropShape;
  /** Glows faintly at night (magical crops). */
  glow?: boolean;
  /** Only turns up now and then at the market. */
  rare?: boolean;
}

export type CropShape = "root" | "bush" | "stake" | "stalk" | "vine" | "head" | "herb";

export const CROPS: CropDef[] = [
  { id: "turnip", seed: "turnip_seed", item: "turnip", hours: 16, yield: [1, 2], seedPrice: 5, color: 0xb05a9a, shape: "root" },
  { id: "carrot", seed: "carrot_seed", item: "carrot", hours: 22, yield: [1, 3], seedPrice: 7, color: 0xf08a2a, shape: "root" },
  { id: "potato", seed: "potato_seed", item: "potato", hours: 30, yield: [2, 4], seedPrice: 9, color: 0xc8905a, shape: "bush" },
  { id: "strawberry", seed: "strawberry_seed", item: "strawberry", hours: 30, yield: [2, 3], regrow: 30, seedPrice: 16, color: 0xe03a3a, shape: "bush" },
  { id: "tomato", seed: "tomato_seed", item: "tomato", hours: 36, yield: [2, 3], regrow: 30, seedPrice: 14, color: 0xe8483a, shape: "stake" },
  { id: "corn", seed: "corn_seed", item: "corn", hours: 44, yield: [2, 3], seedPrice: 18, color: 0xf0d040, shape: "stalk" },
  { id: "pumpkin", seed: "pumpkin_seed", item: "pumpkin", hours: 60, yield: [1, 2], seedPrice: 28, color: 0xf08020, shape: "vine" },
  { id: "melon", seed: "melon_seed", item: "melon", hours: 72, yield: [1, 2], seedPrice: 34, color: 0x6ac04a, shape: "vine" },
  // v0.8: quick, cheap and cheerful…
  { id: "onion", seed: "onion_seed", item: "onion", hours: 20, yield: [1, 3], seedPrice: 6, color: 0xe8c890, shape: "root" },
  { id: "cabbage", seed: "cabbage_seed", item: "cabbage", hours: 34, yield: [1, 2], seedPrice: 11, color: 0x8ac86a, shape: "head" },
  // …bushes that keep giving…
  { id: "firepepper", seed: "firepepper_seed", item: "firepepper", hours: 28, yield: [2, 4], regrow: 28, seedPrice: 15, color: 0xe0402a, shape: "bush" },
  { id: "duskberry", seed: "duskberry_seed", item: "duskberry", hours: 40, yield: [3, 5], regrow: 32, seedPrice: 20, color: 0x4a6ad8, shape: "bush" },
  { id: "grapes", seed: "grape_seed", item: "grapes", hours: 48, yield: [2, 3], regrow: 36, seedPrice: 24, color: 0x8a4ab0, shape: "stake" },
  // …an apothecary's staple (brews into salves and elixirs)…
  { id: "healroot", seed: "healroot_seed", item: "healroot", hours: 30, yield: [2, 3], seedPrice: 6, color: 0xc89a6a, shape: "herb" },
  // …and something the market shouldn't really be selling.
  { id: "moonroot", seed: "moonroot_seed", item: "moonroot", hours: 80, yield: [1, 2], seedPrice: 60, color: 0x5ae0d0, shape: "root", glow: true, rare: true },
];

export const CROP_BY_SEED: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.seed, c]));
export const CROP_BY_ID: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.id, c]));
