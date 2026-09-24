/**
 * What grows in your patch. Growth is measured in in-game hours (a day is
 * ~20 real minutes), and only counts on days you watered: a dry plot
 * waits. Some plants keep fruiting after the first harvest.
 *
 * Seeds come from Hob (quest), Bella's market stall and the odd chest;
 * crops sell to Mira, feed quests and the kitchen.
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
}

export const CROPS: CropDef[] = [
  { id: "turnip", seed: "turnip_seed", item: "turnip", hours: 16, yield: [1, 2], seedPrice: 5, color: 0xb05a9a },
  { id: "carrot", seed: "carrot_seed", item: "carrot", hours: 22, yield: [1, 3], seedPrice: 7, color: 0xf08a2a },
  { id: "potato", seed: "potato_seed", item: "potato", hours: 30, yield: [2, 4], seedPrice: 9, color: 0xc8905a },
  { id: "strawberry", seed: "strawberry_seed", item: "strawberry", hours: 30, yield: [2, 3], regrow: 14, seedPrice: 16, color: 0xe03a3a },
  { id: "tomato", seed: "tomato_seed", item: "tomato", hours: 36, yield: [2, 3], regrow: 16, seedPrice: 14, color: 0xe8483a },
  { id: "corn", seed: "corn_seed", item: "corn", hours: 44, yield: [2, 3], seedPrice: 18, color: 0xf0d040 },
  { id: "pumpkin", seed: "pumpkin_seed", item: "pumpkin", hours: 60, yield: [1, 1], seedPrice: 28, color: 0xf08020 },
  { id: "melon", seed: "melon_seed", item: "melon", hours: 72, yield: [1, 2], seedPrice: 34, color: 0x6ac04a },
];

export const CROP_BY_SEED: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.seed, c]));
export const CROP_BY_ID: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.id, c]));
