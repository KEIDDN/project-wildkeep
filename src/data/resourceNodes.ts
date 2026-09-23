import type { ToolKind } from "./items";

export interface ResourceNodeDef {
  id: string;
  name: string;
  sprite: string;
  /** Tool needed to gather; undefined means gatherable by hand. */
  toolKind?: ToolKind;
  toolPowerRequired?: number;
  gatherTimeMs: number;
  respawnMs: number;
  xpReward: number;
  skill: "woodcutting" | "mining" | "gathering";
  drops: { itemId: string; min: number; max: number; weight: number }[];
}

export const RESOURCE_NODES: Record<string, ResourceNodeDef> = {
  tree: {
    id: "tree",
    name: "Tree",
    sprite: "/sprites/props/tree_01.png",
    toolKind: "axe",
    toolPowerRequired: 1,
    gatherTimeMs: 1400,
    respawnMs: 12000,
    xpReward: 4,
    skill: "woodcutting",
    drops: [{ itemId: "wood", min: 2, max: 4, weight: 1 }],
  },
  rock: {
    id: "rock",
    name: "Rock",
    sprite: "/sprites/props/rock_node.png",
    toolKind: "pickaxe",
    toolPowerRequired: 1,
    gatherTimeMs: 1400,
    respawnMs: 12000,
    xpReward: 4,
    skill: "mining",
    drops: [{ itemId: "stone", min: 2, max: 4, weight: 1 }],
  },
  ore_vein: {
    id: "ore_vein",
    name: "Ore Vein",
    sprite: "/sprites/props/ore_node.png",
    toolKind: "pickaxe",
    toolPowerRequired: 2,
    gatherTimeMs: 2000,
    respawnMs: 20000,
    xpReward: 8,
    skill: "mining",
    drops: [{ itemId: "iron_ore", min: 1, max: 2, weight: 1 }],
  },
  herb_patch: {
    id: "herb_patch",
    name: "Herb Patch",
    sprite: "/sprites/props/herb_node.png",
    gatherTimeMs: 900,
    respawnMs: 9000,
    xpReward: 3,
    skill: "gathering",
    drops: [{ itemId: "herb", min: 1, max: 2, weight: 1 }],
  },
};
