export type Direction = "down" | "up" | "side";

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#d6d0c4",
  uncommon: "#6ee06e",
  rare: "#4fb0ff",
  epic: "#cf7dff",
  legendary: "#ffb23e",
};

/** Darker rarity colours that stay readable on the parchment panels. */
export const RARITY_INK: Record<Rarity, string> = {
  common: "#3b2226",
  uncommon: "#2a7a24",
  rare: "#1f5fa8",
  epic: "#7a2fa8",
  legendary: "#b0561a",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export interface Stats {
  maxHp: number;
  attack: number;
  defense: number;
  crit: number; // 0-1 chance
  luck: number; // 0-1, biases rare loot / crit / rare gather
}

/** Every place the player can stand. Dungeons are one area id; their
 * layout comes from the active run's seed. */
export type AreaId =
  | "town"
  | "forest"
  | "deep_forest"
  | "ancient_grove"
  | "mine"
  | "house"
  | "shop"
  | "forge"
  | "tavern"
  | "dungeon"
  | "lake"
  | "tower_hill";

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}
