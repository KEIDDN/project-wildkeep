import type { SkillId } from "./skills";

/**
 * Every crafting recipe in the game, for every station. Adding a recipe is
 * one entry here; stations just filter this list.
 */
export type StationId = "workbench" | "smelter" | "forge" | "kitchen";

export type RecipeCategory = "tools" | "weapons" | "armor" | "consumables" | "materials" | "utility";

export interface Recipe {
  id: string;
  station: StationId;
  category: RecipeCategory;
  output: { itemId: string; quantity: number };
  inputs: { itemId: string; quantity: number }[];
  gold?: number;
  /** Upgrades consume the previous tier of gear (it must be owned). */
  upgradesFrom?: string;
  /** Skill trained by crafting this. */
  skill?: { id: SkillId; xp: number };
}

export const STATIONS: Record<StationId, { name: string; subtitle: string; icon: string }> = {
  workbench: { name: "Carpenter's Bench", subtitle: "Saw, chisel, stir. Turn raw materials into useful things.", icon: "craft" },
  smelter: { name: "Smelter", subtitle: "Ore and coal in, ingots out.", icon: "iron_bar" },
  forge: { name: "Bram's Forge", subtitle: "Ingots in. Steel out. Upgrades melt down the previous tier.", icon: "anvil" },
  kitchen: { name: "Home Kitchen", subtitle: "Stews and brews from what you forage.", icon: "stew" },
};

const r = (id: string, station: StationId, category: RecipeCategory, output: [string, number], inputs: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id,
  station,
  category,
  output: { itemId: output[0], quantity: output[1] },
  inputs: inputs.map(([itemId, quantity]) => ({ itemId, quantity })),
  ...extra,
});

/**
 * The web of recipes is what ties the world together:
 *   better pickaxe -> deeper mine floors -> better ore -> better gear
 *   -> deeper dungeon floors -> rarer drops -> better gear again.
 */
export const RECIPES: Recipe[] = [
  // --- Carpenter's bench (village forge yard) --------------------------------
  r("plank", "workbench", "materials", ["plank", 1], [["wood", 2]], { skill: { id: "woodcutting", xp: 2 } }),
  r("stone_brick", "workbench", "materials", ["stone_brick", 1], [["stone", 3]], { skill: { id: "mining", xp: 2 } }),
  r("rusty_axe", "workbench", "tools", ["rusty_axe", 1], [["wood", 4], ["stone", 3]]),
  r("rusty_pickaxe", "workbench", "tools", ["rusty_pickaxe", 1], [["wood", 3], ["stone", 4]]),
  r("health_potion", "workbench", "consumables", ["health_potion", 1], [["herb", 3]], { skill: { id: "gathering", xp: 3 } }),
  r("return_scroll", "workbench", "utility", ["return_scroll", 1], [["plank", 2], ["healroot", 1]], { gold: 10, skill: { id: "gathering", xp: 4 } }),
  r("leather_cap", "workbench", "armor", ["leather_cap", 1], [["leather", 3], ["hide", 1]], { skill: { id: "gathering", xp: 4 } }),
  r("leather_boots", "workbench", "armor", ["leather_boots", 1], [["leather", 2], ["hide", 1]], { skill: { id: "gathering", xp: 4 } }),
  r("hunting_bow", "workbench", "weapons", ["hunting_bow", 1], [["plank", 3], ["hide", 1], ["feather", 3]], { gold: 15, skill: { id: "woodcutting", xp: 6 } }),
  r("whetstone", "workbench", "utility", ["whetstone", 1], [["stone", 3]], { skill: { id: "mining", xp: 1 } }),
  r("repair_kit", "workbench", "utility", ["repair_kit", 1], [["plank", 1], ["leather", 2], ["iron_bar", 1]], { gold: 5, skill: { id: "strength", xp: 3 } }),
  r("hoe", "workbench", "tools", ["hoe", 1], [["wood", 3], ["stone", 2]]),
  r("watering_can", "workbench", "tools", ["watering_can", 1], [["plank", 2], ["copper_bar", 1]]),
  r("fishing_rod", "workbench", "tools", ["fishing_rod", 1], [["wood", 3], ["feather", 1]], { skill: { id: "gathering", xp: 3 } }),
  r("arrow", "workbench", "materials", ["arrow", 5], [["wood", 1], ["feather", 1], ["stone", 1]], { skill: { id: "woodcutting", xp: 1 } }),
  r("hunters_hood", "workbench", "armor", ["hunters_hood", 1], [["white_pelt", 2], ["leather", 3]], { gold: 30, skill: { id: "gathering", xp: 12 } }),
  r("tusker_jerkin", "workbench", "armor", ["tusker_jerkin", 1], [["dire_tusk", 1], ["hide", 6], ["leather", 4]], { gold: 60, skill: { id: "gathering", xp: 16 } }),
  r("miners_lantern", "workbench", "utility", ["miners_lantern", 1], [["copper_bar", 3], ["coal", 2]], { skill: { id: "mining", xp: 8 } }),

  // --- Smelter ------------------------------------------------------------------------
  r("iron_bar", "smelter", "materials", ["iron_bar", 1], [["iron_ore", 2], ["coal", 1]], { skill: { id: "mining", xp: 4 } }),
  r("copper_bar", "smelter", "materials", ["copper_bar", 1], [["copper_ore", 2], ["coal", 1]], { skill: { id: "mining", xp: 5 } }),
  r("silver_bar", "smelter", "materials", ["silver_bar", 1], [["silver_ore", 2], ["coal", 2]], { skill: { id: "mining", xp: 8 } }),
  r("gold_bar", "smelter", "materials", ["gold_bar", 1], [["gold_ore", 2], ["coal", 2]], { skill: { id: "mining", xp: 10 } }),
  r("mithril_bar", "smelter", "materials", ["mithril_bar", 1], [["mithril_ore", 3], ["coal", 3], ["crystal", 1]], { skill: { id: "mining", xp: 20 } }),

  // --- Home kitchen (Large House) -------------------------------------------------
  r("grilled_fish", "kitchen", "consumables", ["grilled_fish", 1], [["fish_perch", 1], ["herb", 1]], { skill: { id: "gathering", xp: 3 } }),
  r("grilled_trout", "kitchen", "consumables", ["grilled_fish", 2], [["fish_trout", 1]], { skill: { id: "gathering", xp: 3 } }),
  r("fish_stew", "kitchen", "consumables", ["fish_stew", 1], [["fish_carp", 1], ["potato", 1], ["herb", 1]], { skill: { id: "gathering", xp: 5 } }),
  r("roast_meat", "kitchen", "consumables", ["roast_meat", 1], [["meat_raw", 1], ["herb", 1]], { skill: { id: "gathering", xp: 3 } }),
  r("forest_stew", "kitchen", "consumables", ["forest_stew", 1], [["mushroom", 2], ["herb", 2]], { skill: { id: "gathering", xp: 5 } }),
  r("health_potion_batch", "kitchen", "consumables", ["health_potion", 2], [["herb", 5]], { skill: { id: "gathering", xp: 5 } }),
  r("healroot_salve", "kitchen", "consumables", ["healroot_salve", 1], [["healroot", 2], ["herb", 2], ["mushroom", 1]], { skill: { id: "gathering", xp: 8 } }),
  r("greater_potion", "kitchen", "consumables", ["greater_potion", 1], [["emberbloom", 2], ["herb", 2], ["crystal", 1]], { skill: { id: "gathering", xp: 10 } }),
  r("vegetable_stew", "kitchen", "consumables", ["vegetable_stew", 1], [["carrot", 1], ["potato", 1], ["turnip", 1]], { skill: { id: "gathering", xp: 6 } }),
  r("berry_tart", "kitchen", "consumables", ["berry_tart", 1], [["strawberry", 3], ["herb", 1]], { skill: { id: "gathering", xp: 6 } }),
  r("pumpkin_pie", "kitchen", "consumables", ["pumpkin_pie", 1], [["pumpkin", 1], ["corn", 1]], { skill: { id: "gathering", xp: 12 } }),
  r("moon_elixir", "kitchen", "consumables", ["moon_elixir", 1], [["moonpetal", 2], ["healroot", 2], ["crystal", 1]], { skill: { id: "gathering", xp: 16 } }),

  // --- Bram's forge: tools ----------------------------------------------------------
  r("iron_axe", "forge", "tools", ["iron_axe", 1], [["iron_bar", 4], ["wood", 5], ["coal", 2]], { gold: 20, upgradesFrom: "rusty_axe" }),
  r("iron_pickaxe", "forge", "tools", ["iron_pickaxe", 1], [["iron_bar", 4], ["wood", 5], ["coal", 2]], { gold: 20, upgradesFrom: "rusty_pickaxe" }),
  r("steel_axe", "forge", "tools", ["steel_axe", 1], [["iron_bar", 6], ["coal", 4], ["hardwood", 3], ["crystal", 1]], { gold: 100, upgradesFrom: "iron_axe" }),
  r("steel_pickaxe", "forge", "tools", ["steel_pickaxe", 1], [["iron_bar", 6], ["coal", 4], ["copper_bar", 3], ["crystal", 1]], { gold: 100, upgradesFrom: "iron_pickaxe" }),
  r("mithril_axe", "forge", "tools", ["mithril_axe", 1], [["mithril_bar", 5], ["ancient_wood", 4]], { gold: 300, upgradesFrom: "steel_axe" }),
  r("mithril_pickaxe", "forge", "tools", ["mithril_pickaxe", 1], [["mithril_bar", 5], ["hardwood", 4], ["gold_bar", 2]], { gold: 300, upgradesFrom: "steel_pickaxe" }),

  // --- Bram's forge: weapons -----------------------------------------------------------
  r("iron_sword", "forge", "weapons", ["iron_sword", 1], [["iron_bar", 4], ["plank", 2]], { gold: 30, upgradesFrom: "wooden_sword" }),
  r("steel_sword", "forge", "weapons", ["steel_sword", 1], [["iron_bar", 8], ["coal", 6], ["orc_tusk", 3]], { gold: 140, upgradesFrom: "iron_sword" }),
  r("silver_sword", "forge", "weapons", ["silver_sword", 1], [["silver_bar", 6], ["hardwood", 2], ["sapphire", 1]], { gold: 220, upgradesFrom: "steel_sword" }),
  r("iron_dagger", "forge", "weapons", ["iron_dagger", 1], [["iron_bar", 3], ["leather", 2]], { gold: 25 }),
  r("steel_dagger", "forge", "weapons", ["steel_dagger", 1], [["iron_bar", 6], ["coal", 4], ["emerald", 1]], { gold: 130, upgradesFrom: "iron_dagger" }),
  r("iron_maul", "forge", "weapons", ["iron_maul", 1], [["iron_bar", 6], ["hardwood", 2], ["stone_brick", 2]], { gold: 35 }),
  r("steel_maul", "forge", "weapons", ["steel_maul", 1], [["iron_bar", 10], ["coal", 6], ["hardwood", 3]], { gold: 160, upgradesFrom: "iron_maul" }),
  r("iron_spear", "forge", "weapons", ["iron_spear", 1], [["iron_bar", 3], ["hardwood", 2], ["leather", 1]], { gold: 30 }),
  r("steel_spear", "forge", "weapons", ["steel_spear", 1], [["iron_bar", 7], ["coal", 4], ["antler", 1]], { gold: 150, upgradesFrom: "iron_spear" }),
  r("knights_oath", "forge", "weapons", ["knights_oath", 1], [["gold_bar", 4], ["ruby", 1], ["bone", 10]], { gold: 500, upgradesFrom: "silver_sword" }),
  r("mithril_blade", "forge", "weapons", ["mithril_blade", 1], [["mithril_bar", 6], ["ancient_wood", 2], ["ruby", 1]], { gold: 700, upgradesFrom: "knights_oath" }),

  // --- Bram's forge: armour ------------------------------------------------------------
  r("iron_armor", "forge", "armor", ["iron_armor", 1], [["iron_bar", 5], ["leather", 4]], { gold: 40 }),
  r("steel_armor", "forge", "armor", ["steel_armor", 1], [["iron_bar", 10], ["coal", 6], ["leather", 8]], { gold: 180, upgradesFrom: "iron_armor" }),
  r("silver_mail", "forge", "armor", ["silver_mail", 1], [["silver_bar", 8], ["leather", 6], ["copper_bar", 2]], { gold: 260, upgradesFrom: "steel_armor" }),
  r("mithril_plate", "forge", "armor", ["mithril_plate", 1], [["mithril_bar", 8], ["silver_bar", 4], ["leather", 6]], { gold: 800, upgradesFrom: "silver_mail" }),

  // --- Bram's forge: helms + boots -----------------------------------------------
  r("iron_helm", "forge", "armor", ["iron_helm", 1], [["iron_bar", 3], ["leather", 2]], { gold: 25 }),
  r("iron_boots", "forge", "armor", ["iron_boots", 1], [["iron_bar", 3], ["leather", 2]], { gold: 25, upgradesFrom: "leather_boots" }),
  r("steel_helm", "forge", "armor", ["steel_helm", 1], [["iron_bar", 6], ["coal", 4], ["copper_bar", 2]], { gold: 110, upgradesFrom: "iron_helm" }),
  r("steel_boots", "forge", "armor", ["steel_boots", 1], [["iron_bar", 6], ["coal", 4], ["hide", 2]], { gold: 110, upgradesFrom: "iron_boots" }),
  r("mithril_helm", "forge", "armor", ["mithril_helm", 1], [["mithril_bar", 4], ["silver_bar", 2], ["sapphire", 1]], { gold: 450, upgradesFrom: "steel_helm" }),
  r("mithril_boots", "forge", "armor", ["mithril_boots", 1], [["mithril_bar", 4], ["silver_bar", 2], ["antler", 2]], { gold: 420, upgradesFrom: "steel_boots" }),

  // --- Bram's forge: trinkets ------------------------------------------------------------
  r("stag_crown", "forge", "armor", ["stag_crown", 1], [["golden_antler", 1], ["gold_bar", 2], ["sapphire", 1]], { gold: 200 }),
  r("gold_ring", "forge", "utility", ["gold_ring", 1], [["gold_bar", 2]], { gold: 40 }),
];

export const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  tools: "Tools",
  weapons: "Weapons",
  armor: "Armour",
  consumables: "Consumables",
  materials: "Materials",
  utility: "Utility",
};

export function recipesFor(station: StationId): Recipe[] {
  return RECIPES.filter((r) => r.station === station);
}
