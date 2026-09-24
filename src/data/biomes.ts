import type { AreaId } from "../game/core/types";
import type { TerrainType } from "../engine/world/Terrain";
import type { SkillId } from "./skills";

/**
 * Forest biomes: rules the procedural forest generator follows. The layout
 * changes every day (seed = biome + day), but entrances, landmarks and what
 * can grow where stay fixed, so exploring never feels meaningless.
 *
 *   Whisperwood  ->  Deepwood  ->  Ancient Grove
 *   (tier 1)         (tier 2)      (tier 3, behind an overgrown path)
 */

export type ForestBiomeId = "forest" | "deep_forest" | "ancient_grove";
export type Side = "west" | "east" | "north" | "south";

export interface BiomeEntrance {
  /** Spawn name used when arriving through this entrance. */
  spawn: string;
  side: Side;
  /** Tile along the edge. */
  at: number;
  to: { area: AreaId; spawn: string };
  /** Flag that must be set before the way is open (else a thicket blocks it). */
  gate?: { flag: string; toolPower: number; label: string };
}

export interface NodeRule {
  id: string;
  weight: number;
  /** Weight grows with a skill (progression-aware spawns). */
  skill?: SkillId;
}

export type PoiKind = "camp" | "shrine" | "fairy_ring" | "satchel" | "den" | "statue" | "picnic" | "ruins" | "fallen_giant" | "stump_circle";

export interface BiomeRules {
  id: ForestBiomeId;
  cols: number;
  rows: number;
  ground: TerrainType;
  trail: TerrainType;
  treeKinds: string[];
  decor: string[];
  bushKinds: string[];
  ambient?: number;
  entrances: BiomeEntrance[];
  clearings: number;
  nodes: NodeRule[];
  nodeCount: number;
  /** Rare spawns reserved for hidden glades. */
  hiddenNodes: string[];
  hiddenGlades: number;
  /** Axe power needed to chop into a hidden glade. */
  thicketPower: number;
  pois: PoiKind[];
  /** 0..1: how much of the forest is open woodland you can walk through
   * (the rest is dense thicket). */
  openness: number;
  /** Biggest clump of one resource (groves, outcrops, herb patches). */
  clusterMax: number;
  /** Fixed landmark kept clear at a tile (e.g. the crypt). */
  landmark?: { x: number; y: number; w: number; h: number };
}

export const BIOMES: Record<ForestBiomeId, BiomeRules> = {
  forest: {
    id: "forest",
    cols: 116,
    rows: 80,
    ground: "grass",
    trail: "dirt",
    treeKinds: ["tree_oak", "tree_oak", "tree_pine", "tree_small", "tree_tall", "tree_oak_autumn"],
    decor: ["flower_red", "flower_white", "flower_blue", "flower_yellow", "grass_tuft_a", "grass_tuft_b", "grass_tuft_a", "plant_leafy", "mushroom_a"],
    bushKinds: ["bush_green", "bush_lime", "rock_small", "log_pile"],
    entrances: [
      { spawn: "west", side: "west", at: 40, to: { area: "town", spawn: "east" } },
      { spawn: "north", side: "north", at: 58, to: { area: "deep_forest", spawn: "south" } },
    ],
    clearings: 13,
    nodes: [
      { id: "tree", weight: 10, skill: "woodcutting" },
      { id: "rock", weight: 5, skill: "mining" },
      { id: "herb", weight: 6, skill: "gathering" },
      { id: "mushroom", weight: 2 },
      { id: "iron_vein", weight: 1.5 },
      { id: "golden_tree", weight: 0.6, skill: "woodcutting" },
      { id: "healroot", weight: 0.8, skill: "gathering" },
    ],
    nodeCount: 96,
    openness: 0.5,
    clusterMax: 5,
    hiddenNodes: ["golden_tree", "healroot", "healroot", "iron_vein", "mushroom"],
    hiddenGlades: 3,
    thicketPower: 1,
    pois: ["camp", "fairy_ring", "shrine", "satchel", "den", "statue", "picnic", "ruins", "fallen_giant", "stump_circle"],
  },
  deep_forest: {
    id: "deep_forest",
    cols: 88,
    rows: 70,
    ground: "darkgrass",
    trail: "dirt",
    treeKinds: ["tree_pine_dark", "tree_tall_autumn", "tree_oak_autumn", "tree_pine", "tree_oak_dead", "tree_tall"],
    decor: ["grass_tuft_a", "grass_tuft_b", "mushroom_a", "flower_blue", "flower_white_b", "pebble_a", "pebble_b"],
    bushKinds: ["bush_autumn", "bush_olive", "rock_dark_medium", "dead_tree"],
    ambient: 0.66,
    entrances: [
      { spawn: "south", side: "south", at: 44, to: { area: "forest", spawn: "north" } },
      {
        spawn: "grove",
        side: "north",
        at: 70,
        to: { area: "ancient_grove", spawn: "south" },
        gate: { flag: "grove_path_cleared", toolPower: 3, label: "Overgrown Path" },
      },
    ],
    clearings: 9,
    nodes: [
      { id: "hardwood_tree", weight: 7, skill: "woodcutting" },
      { id: "tree", weight: 3 },
      { id: "iron_vein", weight: 3, skill: "mining" },
      { id: "gold_vein", weight: 1.2, skill: "mining" },
      { id: "crystal", weight: 1.5 },
      { id: "emberbloom", weight: 4, skill: "gathering" },
      { id: "mushroom", weight: 3 },
      { id: "healroot", weight: 2, skill: "gathering" },
      { id: "moonpetal", weight: 1.2, skill: "gathering" },
      { id: "golden_tree", weight: 1, skill: "woodcutting" },
    ],
    nodeCount: 74,
    openness: 0.46,
    clusterMax: 4,
    hiddenNodes: ["gold_vein", "moonpetal", "moonpetal", "crystal", "golden_tree"],
    hiddenGlades: 2,
    thicketPower: 2,
    pois: ["camp", "shrine", "fairy_ring", "den", "satchel", "statue", "ruins", "fallen_giant"],
    landmark: { x: 38, y: 3, w: 12, h: 8 },
  },
  ancient_grove: {
    id: "ancient_grove",
    cols: 76,
    rows: 58,
    ground: "darkgrass",
    trail: "cobble",
    treeKinds: ["tree_oak", "tree_oak_gold", "tree_tall", "tree_pine_dark", "tree_oak"],
    decor: ["flower_blue_b", "flower_white_b", "mushroom_a", "fern", "grass_tuft_b", "foxglove_small"],
    bushKinds: ["bush_large", "fern_big", "rock_grey_medium"],
    ambient: 0.8,
    entrances: [{ spawn: "south", side: "south", at: 38, to: { area: "deep_forest", spawn: "grove" } }],
    clearings: 7,
    nodes: [
      { id: "ancient_tree", weight: 6, skill: "woodcutting" },
      { id: "hardwood_tree", weight: 3 },
      { id: "moonpetal", weight: 3, skill: "gathering" },
      { id: "healroot", weight: 3, skill: "gathering" },
      { id: "crystal", weight: 2 },
      { id: "mithril_vein", weight: 0.8, skill: "mining" },
      { id: "gem_vein", weight: 0.6 },
    ],
    nodeCount: 54,
    openness: 0.48,
    clusterMax: 4,
    hiddenNodes: ["mithril_vein", "gem_vein", "ancient_tree", "moonpetal"],
    hiddenGlades: 2,
    thicketPower: 3,
    pois: ["shrine", "fairy_ring", "statue", "den", "ruins", "stump_circle"],
  },
};
