import type { Rarity, Stats } from "../game/core/types";

export type ItemCategory =
  | "resource"
  | "weapon"
  | "armor"
  | "tool"
  | "relic"
  | "consumable";

export type EquipSlot = "weapon" | "armor" | "accessory" | "tool" | "relic";

export type ToolKind = "axe" | "pickaxe";

export interface RelicEffects {
  rareLootChanceBonus?: number; // additive, 0-1
  sellValueBonus?: number; // multiplicative, e.g. 0.15 = +15%
  gatherSpeedBonus?: number; // multiplicative
  cropGrowthBonus?: number; // multiplicative (future farming hook)
  dungeonRoomRewardBonus?: number; // flat extra rewards per dungeon
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: Rarity;
  value: number;
  icon: string;
  stackable: boolean;
  maxStack: number;
  equipSlot?: EquipSlot;
  toolKind?: ToolKind;
  toolPower?: number; // gathering tier this tool can reach
  statBonus?: Partial<Stats>;
  relicEffects?: RelicEffects;
  healAmount?: number;
}

const icon = (name: string) => `/icons/${name}.png`;

export const ITEMS: Record<string, ItemDef> = {
  wood: {
    id: "wood",
    name: "Wood",
    description: "Rough-cut logs from the forest.",
    category: "resource",
    rarity: "common",
    value: 2,
    icon: icon("wood"),
    stackable: true,
    maxStack: 99,
  },
  stone: {
    id: "stone",
    name: "Stone",
    description: "A chunk of quarried stone.",
    category: "resource",
    rarity: "common",
    value: 2,
    icon: icon("stone"),
    stackable: true,
    maxStack: 99,
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    description: "Raw ore, ready for the furnace.",
    category: "resource",
    rarity: "uncommon",
    value: 6,
    icon: icon("ore_iron"),
    stackable: true,
    maxStack: 99,
  },
  herb: {
    id: "herb",
    name: "Wild Herb",
    description: "A fragrant herb with faint magic.",
    category: "resource",
    rarity: "common",
    value: 3,
    icon: icon("herb"),
    stackable: true,
    maxStack: 99,
  },
  leather: {
    id: "leather",
    name: "Leather Scrap",
    description: "Tough hide, salvaged from a beast.",
    category: "resource",
    rarity: "uncommon",
    value: 5,
    icon: icon("leather"),
    stackable: true,
    maxStack: 99,
  },

  wooden_sword: {
    id: "wooden_sword",
    name: "Wooden Sword",
    description: "A simple training blade. Better than fists.",
    category: "weapon",
    rarity: "common",
    value: 10,
    icon: icon("sword_iron"),
    stackable: false,
    maxStack: 1,
    equipSlot: "weapon",
    statBonus: { attack: 3 },
  },
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    description: "A well-balanced blade of forged iron.",
    category: "weapon",
    rarity: "uncommon",
    value: 60,
    icon: icon("sword_iron"),
    stackable: false,
    maxStack: 1,
    equipSlot: "weapon",
    statBonus: { attack: 8 },
  },

  cloth_tunic: {
    id: "cloth_tunic",
    name: "Cloth Tunic",
    description: "Simple traveler's garb. Barely blocks a scratch.",
    category: "armor",
    rarity: "common",
    value: 10,
    icon: icon("armor_leather"),
    stackable: false,
    maxStack: 1,
    equipSlot: "armor",
    statBonus: { defense: 3 },
  },
  iron_armor: {
    id: "iron_armor",
    name: "Iron Armor",
    description: "Sturdy plating, forged for real danger.",
    category: "armor",
    rarity: "uncommon",
    value: 65,
    icon: icon("armor_iron"),
    stackable: false,
    maxStack: 1,
    equipSlot: "armor",
    statBonus: { defense: 8, maxHp: 10 },
  },

  rusty_axe: {
    id: "rusty_axe",
    name: "Rusty Axe",
    description: "Barely holds an edge, but it cuts.",
    category: "tool",
    rarity: "common",
    value: 8,
    icon: icon("axe"),
    stackable: false,
    maxStack: 1,
    equipSlot: "tool",
    toolKind: "axe",
    toolPower: 1,
  },
  iron_axe: {
    id: "iron_axe",
    name: "Iron Axe",
    description: "Cuts deep, cuts fast.",
    category: "tool",
    rarity: "uncommon",
    value: 55,
    icon: icon("axe"),
    stackable: false,
    maxStack: 1,
    equipSlot: "tool",
    toolKind: "axe",
    toolPower: 2,
  },
  rusty_pickaxe: {
    id: "rusty_pickaxe",
    name: "Rusty Pickaxe",
    description: "Chips away at stone, slowly.",
    category: "tool",
    rarity: "common",
    value: 8,
    icon: icon("pickaxe"),
    stackable: false,
    maxStack: 1,
    equipSlot: "tool",
    toolKind: "pickaxe",
    toolPower: 1,
  },
  iron_pickaxe: {
    id: "iron_pickaxe",
    name: "Iron Pickaxe",
    description: "Breaks stone and ore alike with ease.",
    category: "tool",
    rarity: "uncommon",
    value: 55,
    icon: icon("pickaxe"),
    stackable: false,
    maxStack: 1,
    equipSlot: "tool",
    toolKind: "pickaxe",
    toolPower: 2,
  },

  lucky_charm: {
    id: "lucky_charm",
    name: "Lucky Charm",
    description: "A trinket that seems to nudge fortune your way.",
    category: "relic",
    rarity: "rare",
    value: 120,
    icon: icon("relic_charm"),
    stackable: false,
    maxStack: 1,
    equipSlot: "relic",
    relicEffects: { rareLootChanceBonus: 0.1, sellValueBonus: 0.1 },
  },

  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    description: "Restores a modest amount of HP.",
    category: "consumable",
    rarity: "common",
    value: 15,
    icon: icon("potion_health"),
    stackable: true,
    maxStack: 20,
    healAmount: 30,
  },
};

export function getItem(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item id: ${id}`);
  return def;
}

export function isEquipment(def: ItemDef): boolean {
  return def.equipSlot !== undefined;
}
