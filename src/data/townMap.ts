/**
 * Wildkeep as the map draws it: a simplified plan in town tiles, matching
 * engine/world/areas/town.ts. When the village grows, add the new building
 * here too (the map's "Wildkeep" tab shows these).
 */
export const TOWN_COLS = 64;
export const TOWN_ROWS = 68;

export type TownGround = "street" | "plaza" | "soil" | "water" | "yard";

export interface TownShape {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "building" | "ground";
  ground?: TownGround;
  /** Roof colour for buildings. */
  roof?: number;
}

export interface TownLandmark {
  id: string;
  icon: string;
  /** Tile position of the marker. */
  x: number;
  y: number;
  /** Interiors that count as being here. */
  areas?: string[];
}

export const TOWN_SHAPES: TownShape[] = [
  // ground
  { kind: "ground", ground: "street", x: 0, y: 17, w: 64, h: 3 },
  { kind: "ground", ground: "street", x: 29, y: 5, w: 3, h: 12 },
  { kind: "ground", ground: "street", x: 28, y: 28, w: 3, h: 9 },
  { kind: "ground", ground: "street", x: 9, y: 35, w: 21, h: 3 },
  { kind: "ground", ground: "street", x: 28, y: 36, w: 3, h: 32 },
  { kind: "ground", ground: "street", x: 5, y: 50, w: 54, h: 3 },
  { kind: "ground", ground: "plaza", x: 6, y: 53, w: 14, h: 7 },
  { kind: "ground", ground: "yard", x: 46, y: 40, w: 13, h: 8 },
  { kind: "ground", ground: "soil", x: 34, y: 54, w: 13, h: 5 },
  { kind: "ground", ground: "plaza", x: 22, y: 20, w: 15, h: 9 },
  { kind: "ground", ground: "soil", x: 4, y: 22, w: 9, h: 6 },
  { kind: "ground", ground: "yard", x: 37, y: 20, w: 11, h: 9 },
  { kind: "ground", ground: "water", x: 23, y: 32, w: 2, h: 2 },
  // buildings (footprints, roughly)
  { kind: "building", x: 4, y: 9, w: 8, h: 8, roof: 0x8a4a3a },
  { kind: "building", x: 15, y: 10, w: 8, h: 7, roof: 0x4a6a8a },
  { kind: "building", x: 35, y: 10, w: 8, h: 7, roof: 0x5a5a66 },
  { kind: "building", x: 45, y: 8, w: 16, h: 9, roof: 0x7a3a2a },
  { kind: "building", x: 52, y: 27, w: 8, h: 8, roof: 0x6a5a3a },
  { kind: "building", x: 7, y: 31, w: 5, h: 4, roof: 0x5a5060 },
  { kind: "building", x: 32, y: 32, w: 9, h: 2, roof: 0xb04a3a },
  { kind: "building", x: 6, y: 41, w: 8, h: 8, roof: 0x7a5a8a },
  { kind: "building", x: 17, y: 41, w: 8, h: 8, roof: 0x8a6a3a },
  { kind: "building", x: 33, y: 40, w: 8, h: 9, roof: 0x4a6a3a },
  { kind: "building", x: 50, y: 52, w: 8, h: 8, roof: 0xa05a3a },
];

export const TOWN_LANDMARKS: TownLandmark[] = [
  { id: "home", icon: "house", x: 8, y: 17, areas: ["house"] },
  { id: "shop", icon: "coin_bag", x: 19, y: 17, areas: ["shop"] },
  { id: "forge", icon: "anvil", x: 39, y: 17, areas: ["forge"] },
  { id: "tavern", icon: "beer", x: 53, y: 17, areas: ["tavern"] },
  { id: "mine", icon: "map_mine", x: 30, y: 5 },
  { id: "plaza", icon: "map_camp", x: 29, y: 24 },
  { id: "board", icon: "journal", x: 20, y: 23 },
  { id: "garden", icon: "seed_turnip", x: 8, y: 24 },
  { id: "market", icon: "crop_pumpkin", x: 36, y: 33 },
  { id: "fountain", icon: "gold_coin", x: 24, y: 33 },
  { id: "bench", icon: "craft", x: 41, y: 27 },
  { id: "barrow", icon: "map_portal", x: 9, y: 35 },
  { id: "cottage", icon: "map_hut", x: 56, y: 35 },
  { id: "to_forest", icon: "map_tree", x: 63, y: 18 },
  { id: "to_tower", icon: "map_tower", x: 0.6, y: 18 },
  { id: "to_lake", icon: "map_lake", x: 29, y: 67 },
  { id: "lodge", icon: "bow_wood", x: 37, y: 49 },
  { id: "yard", icon: "sword_wood", x: 52, y: 43 },
  { id: "shrine", icon: "clover", x: 13, y: 56 },
  { id: "pen", icon: "meat_raw", x: 40, y: 56 },
  { id: "lane", icon: "map_house", x: 15, y: 51 },
];
