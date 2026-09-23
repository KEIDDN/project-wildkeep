export type Direction = "down" | "up" | "side";

export interface Vector2 {
  x: number;
  y: number;
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#c9c9c9",
  uncommon: "#5fd35f",
  rare: "#4fa9ff",
  epic: "#c374ff",
  legendary: "#ffb347",
};

export interface Stats {
  maxHp: number;
  attack: number;
  defense: number;
  crit: number; // 0-1 chance
  luck: number; // 0-1, biases rare loot / crit / rare gather
}

export type SceneId = "town" | "forest" | "dungeon";
