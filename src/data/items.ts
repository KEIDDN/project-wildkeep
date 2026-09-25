import type { Rarity, Stats } from "../game/core/types";
import { WEAPONS, type WeaponKind, type WeaponProfile } from "./combat";

export type ItemCategory = "resource" | "weapon" | "armor" | "tool" | "accessory" | "relic" | "consumable" | "utility";

export type EquipSlot = "weapon" | "head" | "armor" | "boots" | "accessory" | "tool" | "relic";

/** Every slot, in paper-doll order. */
export const EQUIP_SLOTS: EquipSlot[] = ["head", "weapon", "armor", "tool", "boots", "accessory", "relic"];

export type ToolKind = "axe" | "pickaxe" | "hoe" | "can" | "rod";

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
  value: number; // base sell value
  icon: string; // icon id in /icons and /icons16
  stackable: boolean;
  maxStack: number;
  equipSlot?: EquipSlot;
  toolKind?: ToolKind;
  toolPower?: number; // gathering tier + damage per swing on nodes
  statBonus?: Partial<Stats>;
  relicEffects?: RelicEffects;
  healAmount?: number;
  /** Consumable with a special effect handled by game/actions useItem. */
  useEffect?: "return_home" | "open_box" | "repair_kit" | "whetstone";
  /** Extra light radius while worn (Miner's Lantern). */
  lightBonus?: number;
  /** Resource progression tier (1 = starter, higher = deeper areas / better
   * tools). Future resources (copper, silver, ancient wood…) slot in here. */
  tier?: number;
  /** How worn gear looks on the character: tint for its equipment layer
   * (armour → tunic, head → helmet, boots, weapon → blade, tool → head). */
  look?: number;
  /** Key / quest items: can't be sold, dropped on death or melted down. */
  keyItem?: boolean;
  /** Ranged weapons (the bow) fire this item. */
  ammo?: string;
  /** Weapon family (swing speed, reach, damage type — data/combat.ts). Swords by default. */
  weapon?: WeaponKind;
  /** Extra damage against a creature family (silver vs the undead). */
  bane?: "undead";
  /** Boss-only unique: only this enemy ever drops it. */
  uniqueFrom?: string;
  /** Mana a potion gives back (magic). */
  mana?: number;
  /** Energy a meal gives back (see game/systems/vitals.ts). */
  energy?: number;
  /** Extra maximum stamina while worn (boots, light armour). */
  stamina?: number;
}

type Def = Omit<ItemDef, "id" | "stackable" | "maxStack"> & { stackable?: boolean; maxStack?: number };

const resource = (d: Omit<Def, "category">): Def => ({ ...d, category: "resource", stackable: true, maxStack: 999 });
const gear = (d: Def): Def => ({ ...d, stackable: false, maxStack: 1 });
const helm = (d: Omit<Def, "category" | "equipSlot">): Def => gear({ ...d, category: "armor", equipSlot: "head" });
const boots = (d: Omit<Def, "category" | "equipSlot">): Def => gear({ ...d, category: "armor", equipSlot: "boots" });

const DEFS: Record<string, Def> = {
  // --- resources ---------------------------------------------------------
  wood: resource({ name: "Wood", description: "Rough-cut logs from the forest.", rarity: "common", value: 2, icon: "wood", tier: 1 }),
  stone: resource({ name: "Stone", description: "A chunk of quarried stone.", rarity: "common", value: 2, icon: "stone", tier: 1 }),
  herb: resource({ name: "Wild Herb", description: "A fragrant herb with faint magic.", rarity: "common", value: 3, icon: "herb", tier: 1 }),
  mushroom: resource({ name: "Glowcap", description: "A mushroom that hums faintly at night.", rarity: "common", value: 4, icon: "mushroom", tier: 1 }),
  hardwood: resource({ name: "Hardwood", description: "Dense, dark timber from the Deepwood.", rarity: "uncommon", value: 9, icon: "hardwood", tier: 2 }),
  ancient_wood: resource({ name: "Ancient Wood", description: "Heartwood from a tree older than the village.", rarity: "rare", value: 30, icon: "ancient_wood", tier: 3 }),
  healroot: resource({ name: "Healroot", description: "A knotted medicinal root. Brewers prize it.", rarity: "uncommon", value: 8, icon: "healroot", tier: 2 }),
  moonpetal: resource({ name: "Moonpetal", description: "Only blooms under the night sky. Faintly magical.", rarity: "rare", value: 28, icon: "moonpetal", tier: 3 }),
  copper_ore: resource({ name: "Copper Ore", description: "Soft, bright ore from the middle depths of the mine.", rarity: "common", value: 6, icon: "copper_ore", tier: 2 }),
  silver_ore: resource({ name: "Silver Ore", description: "Cool, pale ore from deep in the mine.", rarity: "uncommon", value: 15, icon: "silver_ore", tier: 3 }),
  mithril_ore: resource({ name: "Mithril Ore", description: "Light as a feather, hard as a dragon's tooth.", rarity: "epic", value: 60, icon: "mithril_ore", tier: 5 }),
  coal: resource({ name: "Coal", description: "Black, dusty, and burns hot. Smelters need it.", rarity: "common", value: 4, icon: "coal", tier: 1 }),
  iron_ore: resource({ name: "Iron Ore", description: "Raw ore. Smelt it with coal into ingots.", rarity: "uncommon", value: 7, icon: "iron_ore", tier: 2 }),
  gold_ore: resource({ name: "Gold Ore", description: "Heavy, warm, and worth every swing.", rarity: "rare", value: 22, icon: "gold_ore", tier: 3 }),
  crystal: resource({ name: "Frost Crystal", description: "Cold to the touch. Mages pay well.", rarity: "rare", value: 26, icon: "crystal", tier: 3 }),
  emberbloom: resource({ name: "Emberbloom", description: "A deep-forest flower that smoulders.", rarity: "uncommon", value: 9, icon: "emberbloom", tier: 2 }),
  leather: resource({ name: "Leather Scrap", description: "Tough hide, salvaged from a beast.", rarity: "common", value: 4, icon: "leather" }),
  bone: resource({ name: "Old Bone", description: "Rattled loose from a skeleton.", rarity: "common", value: 3, icon: "bone" }),
  orc_tusk: resource({ name: "Orc Tusk", description: "A trophy. Collectors love these.", rarity: "uncommon", value: 12, icon: "orc_tusk" }),
  // Crafted materials. (`iron_bar` keeps its id so old saves still load.)
  iron_bar: resource({ name: "Iron Ingot", description: "Smelted iron, ready for the anvil.", rarity: "uncommon", value: 20, icon: "iron_bar" }),
  copper_bar: resource({ name: "Copper Ingot", description: "Warm-coloured metal for fittings and lanterns.", rarity: "common", value: 14, icon: "copper_bar" }),
  silver_bar: resource({ name: "Silver Ingot", description: "Bright metal that bites the undead.", rarity: "uncommon", value: 36, icon: "silver_bar" }),
  gold_bar: resource({ name: "Gold Ingot", description: "Pure, heavy, and very persuasive.", rarity: "rare", value: 55, icon: "gold_bar" }),
  mithril_bar: resource({ name: "Mithril Ingot", description: "The metal of legends.", rarity: "epic", value: 140, icon: "mithril_bar" }),
  plank: resource({ name: "Plank", description: "Sawn timber. Builders go through piles of these.", rarity: "common", value: 6, icon: "plank" }),
  stone_brick: resource({ name: "Cut Stone", description: "A squared block, ready for a mason.", rarity: "common", value: 6, icon: "stone_brick" }),
  sapphire: resource({ name: "Sapphire", description: "A deep blue gem.", rarity: "rare", value: 45, icon: "sapphire" }),
  emerald: resource({ name: "Emerald", description: "Green as the old forest.", rarity: "rare", value: 45, icon: "emerald" }),
  ruby: resource({ name: "Ruby", description: "It glows like a coal.", rarity: "epic", value: 90, icon: "ruby" }),
  amethyst: resource({ name: "Amethyst", description: "A violet gem, faintly singing.", rarity: "epic", value: 90, icon: "amethyst" }),
  // Hunting (animals in the woods).
  meat_raw: resource({ name: "Raw Meat", description: "Fresh from the woods. Cook it at home, or sell it to the tavern kitchen.", rarity: "common", value: 5, icon: "meat_raw", tier: 1 }),
  hide: resource({ name: "Hide", description: "A whole pelt. Tanners pay more than for scraps.", rarity: "common", value: 8, icon: "hide", tier: 1 }),
  feather: resource({ name: "Feather", description: "Fletching for arrows. Or a very small hat.", rarity: "common", value: 2, icon: "feather", tier: 1 }),
  antler: resource({ name: "Antler", description: "Shed by a proud stag. Carvers love these.", rarity: "uncommon", value: 16, icon: "antler", tier: 2 }),
  diamond: resource({ name: "Diamond", description: "Flawless. Absurdly valuable.", rarity: "legendary", value: 260, icon: "diamond" }),

  // --- weapons -----------------------------------------------------------
  wooden_sword: gear({
    name: "Training Blade", description: "Blunt, light, and better than fists.",
    category: "weapon", rarity: "common", value: 8, icon: "sword_wood", equipSlot: "weapon", statBonus: { attack: 3 }, look: 0xc8935a,
  }),
  iron_sword: gear({
    name: "Iron Sword", description: "A well-balanced blade of forged iron.",
    category: "weapon", rarity: "uncommon", value: 45, icon: "sword_iron", equipSlot: "weapon", statBonus: { attack: 8 }, look: 0xffffff,
  }),
  steel_sword: gear({
    name: "Steel Longsword", description: "Tempered steel that holds a vicious edge.",
    category: "weapon", rarity: "rare", value: 140, icon: "sword_steel", equipSlot: "weapon", statBonus: { attack: 14, crit: 0.03 }, look: 0xd8e6ff,
  }),
  silver_sword: gear({
    name: "Silversteel Sabre", description: "Quick and bright. The dead hate it.",
    category: "weapon", rarity: "rare", value: 220, icon: "sword_silver", equipSlot: "weapon", statBonus: { attack: 18, crit: 0.05 }, look: 0xeaf6ff, bane: "undead",
  }),
  // Other weapon families: daggers (fast, crits), mauls (slow, crushing),
  // spears (long reach). See data/combat.ts.
  iron_dagger: gear({
    name: "Iron Dirk", description: "Short, quick and rude. Four cuts before a sword finishes one. Crits love it.",
    category: "weapon", rarity: "uncommon", value: 40, icon: "dagger_iron", equipSlot: "weapon", statBonus: { attack: 6, crit: 0.06 }, look: 0xffffff, weapon: "dagger",
  }),
  steel_dagger: gear({
    name: "Nightfang", description: "A steel fang for people who prefer to be behind their enemies.",
    category: "weapon", rarity: "rare", value: 150, icon: "dagger_steel", equipSlot: "weapon", statBonus: { attack: 11, crit: 0.12 }, look: 0xd8e6ff, weapon: "dagger",
  }),
  iron_maul: gear({
    name: "Iron Maul", description: "Slow. Heavy. Skeletons fall apart just looking at it. Breaks guards.",
    category: "weapon", rarity: "uncommon", value: 55, icon: "maul_iron", equipSlot: "weapon", statBonus: { attack: 10 }, look: 0xffffff, weapon: "maul",
  }),
  steel_maul: gear({
    name: "Steel Warhammer", description: "Every swing is a decision. Every hit is a conclusion.",
    category: "weapon", rarity: "rare", value: 170, icon: "maul_steel", equipSlot: "weapon", statBonus: { attack: 18, defense: 1 }, look: 0xd8e6ff, weapon: "maul",
  }),
  iron_spear: gear({
    name: "Boar Spear", description: "Long reach, narrow point. Keep the angry end between you and them.",
    category: "weapon", rarity: "uncommon", value: 45, icon: "spear_iron", equipSlot: "weapon", statBonus: { attack: 8 }, look: 0xffffff, weapon: "spear",
  }),
  steel_spear: gear({
    name: "Steel Partisan", description: "A guardsman's spear. Pierces armour, and brutes hate it.",
    category: "weapon", rarity: "rare", value: 160, icon: "spear_steel", equipSlot: "weapon", statBonus: { attack: 15, crit: 0.03 }, look: 0xd8e6ff, weapon: "spear",
  }),
  bonebreaker: gear({
    name: "Bonebreaker", description: "A spiked morningstar that hums near the dead. Found, never forged.",
    category: "weapon", rarity: "epic", value: 420, icon: "mace_spiked", equipSlot: "weapon", statBonus: { attack: 22, defense: 2 }, look: 0xd0e8e0, weapon: "maul", bane: "undead",
  }),
  duelist_rapier: gear({
    name: "Duelist's Rapier", description: "Belonged to someone very fast who is now very dead. Crits sing.",
    category: "weapon", rarity: "epic", value: 440, icon: "rapier", equipSlot: "weapon", statBonus: { attack: 17, crit: 0.16, luck: 0.02 }, look: 0xc8b8c8, weapon: "dagger",
  }),
  mithril_blade: gear({
    name: "Mithril Blade", description: "So light it seems to swing itself.",
    category: "weapon", rarity: "epic", value: 700, icon: "sword_mithril", equipSlot: "weapon", statBonus: { attack: 27, crit: 0.08, luck: 0.02 }, look: 0x8ff0e0,
  }),
  knights_oath: gear({
    name: "Knight's Oath", description: "An old blade that remembers its vows.",
    category: "weapon", rarity: "epic", value: 380, icon: "sword_epic", equipSlot: "weapon", statBonus: { attack: 22, crit: 0.06, defense: 2 }, look: 0xffe7a0,
  }),
  sunfire_brand: gear({
    name: "Sunfire Brand", description: "Wreathed in a flame that never gutters.",
    category: "weapon", rarity: "legendary", value: 1200, icon: "sword_legendary", equipSlot: "weapon",
    statBonus: { attack: 34, crit: 0.12, luck: 0.05 }, look: 0xffa040,
  }),

  // --- boss uniques: one boss drops each, rarely. The things you remember. ---
  grukks_cleaver: gear({
    name: "Grukk's Cleaver", description: "The Warboss's own. Still has his teeth marks on the handle. Heavy, and hungry for more.",
    category: "weapon", rarity: "epic", value: 520, icon: "cleaver_grukk", equipSlot: "weapon", statBonus: { attack: 24, maxHp: 15 }, look: 0xffb070, weapon: "maul", uniqueFrom: "orc_warrior",
  }),
  hollow_crown: helm({
    name: "The Hollow Crown", description: "The Hollow Knight's helm. Something inside it is still keeping watch. Crits come easier.",
    rarity: "epic", value: 480, icon: "crown_hollow", statBonus: { defense: 7, maxHp: 20, crit: 0.06 }, look: 0xffd060, uniqueFrom: "skeleton_warrior",
  }),
  golem_heart: gear({
    name: "Heart of the Colossus", description: "A mossy stone that beats once a minute. Holding it makes you feel very, very sturdy.",
    category: "relic", rarity: "epic", value: 500, icon: "heart_golem", equipSlot: "relic", statBonus: { defense: 6, maxHp: 40 }, uniqueFrom: "stone_golem",
  }),
  morwens_ring: gear({
    name: "Morwen's Grave Ring", description: "It was on her finger. Then it was in the dirt. Now it's on yours. The dead take a moment to notice you.",
    category: "accessory", rarity: "legendary", value: 900, icon: "ring_grave", equipSlot: "accessory", statBonus: { crit: 0.12, luck: 0.06, attack: 6 }, uniqueFrom: "necromancer",
  }),
  emberscale_mail: gear({
    name: "Emberscale Mail", description: "Scales the Old Flame shed, stitched into a coat by someone brave. Warm in winter. Warm always.",
    category: "armor", rarity: "legendary", value: 1400, icon: "mail_emberscale", equipSlot: "armor", statBonus: { defense: 28, maxHp: 70, attack: 4 }, look: 0xff8a40, uniqueFrom: "dragon",
  }),

  // --- armor -------------------------------------------------------------
  cloth_tunic: gear({
    name: "Traveler's Tunic", description: "Simple garb. Barely blocks a scratch.",
    category: "armor", rarity: "common", value: 8, icon: "armor_cloth", equipSlot: "armor", statBonus: { defense: 2 },
  }),
  leather_armor: gear({
    name: "Leather Jerkin", description: "Stitched hide. Light and dependable.",
    category: "armor", rarity: "uncommon", value: 40, icon: "armor_leather", equipSlot: "armor", statBonus: { defense: 5, maxHp: 6 }, look: 0xb07a48,
  }),
  iron_armor: gear({
    name: "Iron Mail", description: "Sturdy plating, forged for real danger.",
    category: "armor", rarity: "uncommon", value: 65, icon: "armor_iron", equipSlot: "armor", statBonus: { defense: 8, maxHp: 12 }, look: 0xa8b0b8,
  }),
  steel_armor: gear({
    name: "Steel Plate", description: "Heavy, loud, and very hard to kill.",
    category: "armor", rarity: "rare", value: 180, icon: "armor_steel", equipSlot: "armor", statBonus: { defense: 13, maxHp: 25 }, look: 0xc8d4e4,
  }),
  silver_mail: gear({
    name: "Silvered Mail", description: "Fine rings of silver over steel.",
    category: "armor", rarity: "rare", value: 280, icon: "armor_silver", equipSlot: "armor", statBonus: { defense: 17, maxHp: 35 }, look: 0xf0f4ff,
  }),
  mithril_plate: gear({
    name: "Mithril Plate", description: "Armour that weighs less than a cloak.",
    category: "armor", rarity: "epic", value: 820, icon: "armor_mithril", equipSlot: "armor", statBonus: { defense: 23, maxHp: 55 }, look: 0x7fe8d8,
  }),

  // --- tools -------------------------------------------------------------
  rusty_axe: gear({
    name: "Rusty Axe", description: "Barely holds an edge, but it cuts.",
    category: "tool", rarity: "common", value: 6, icon: "axe_rusty", equipSlot: "tool", toolKind: "axe", toolPower: 1, look: 0xc88a60,
  }),
  iron_axe: gear({
    name: "Iron Axe", description: "Cuts deep, cuts fast.",
    category: "tool", rarity: "uncommon", value: 40, icon: "axe_iron", equipSlot: "tool", toolKind: "axe", toolPower: 2, look: 0xffffff,
  }),
  steel_axe: gear({
    name: "Steel Axe", description: "Fells an oak in a handful of swings.",
    category: "tool", rarity: "rare", value: 120, icon: "axe_steel", equipSlot: "tool", toolKind: "axe", toolPower: 3, look: 0xd8e6ff,
  }),
  mithril_axe: gear({
    name: "Mithril Axe", description: "Parts ancient heartwood like butter.",
    category: "tool", rarity: "epic", value: 400, icon: "axe_mithril", equipSlot: "tool", toolKind: "axe", toolPower: 4, look: 0x8ff0e0,
  }),
  rusty_pickaxe: gear({
    name: "Rusty Pickaxe", description: "Chips away at stone, slowly.",
    category: "tool", rarity: "common", value: 6, icon: "pickaxe_rusty", equipSlot: "tool", toolKind: "pickaxe", toolPower: 1, look: 0xc88a60,
  }),
  iron_pickaxe: gear({
    name: "Iron Pickaxe", description: "Breaks stone and iron ore alike.",
    category: "tool", rarity: "uncommon", value: 40, icon: "pickaxe_iron", equipSlot: "tool", toolKind: "pickaxe", toolPower: 2, look: 0xffffff,
  }),
  steel_pickaxe: gear({
    name: "Steel Pickaxe", description: "Bites through gold veins and crystal.",
    category: "tool", rarity: "rare", value: 120, icon: "pickaxe_steel", equipSlot: "tool", toolKind: "pickaxe", toolPower: 3, look: 0xd8e6ff,
  }),

  mithril_pickaxe: gear({
    name: "Mithril Pickaxe", description: "Rings like a bell on every swing.",
    category: "tool", rarity: "epic", value: 400, icon: "pickaxe_mithril", equipSlot: "tool", toolKind: "pickaxe", toolPower: 4, look: 0x8ff0e0,
  }),

  // --- head + boots --------------------------------------------------------
  leather_cap: helm({ name: "Leather Cap", description: "Keeps the rain off. Mostly.", rarity: "common", value: 14, icon: "helm_leather", statBonus: { defense: 1, maxHp: 4 }, look: 0xe0a868 }),
  iron_helm: helm({ name: "Iron Helm", description: "Dented, honest, heavy.", rarity: "uncommon", value: 55, icon: "helm_iron", statBonus: { defense: 3, maxHp: 8 }, look: 0xa8b0b8 }),
  steel_helm: helm({ name: "Steel Helm", description: "A proper helmet. Your skull says thank you.", rarity: "rare", value: 150, icon: "helm_steel", statBonus: { defense: 5, maxHp: 14 }, look: 0xd0dcec }),
  mithril_helm: helm({ name: "Mithril Crown-Helm", description: "Weighs nothing. Looks like everything.", rarity: "epic", value: 520, icon: "helm_mithril", statBonus: { defense: 8, maxHp: 24, crit: 0.02 }, look: 0x7fe8d8 }),
  leather_boots: boots({ name: "Leather Boots", description: "Soft soles for long walks.", rarity: "common", value: 12, icon: "boots_leather", statBonus: { defense: 1 }, look: 0x8a5a36 }),
  iron_boots: boots({ name: "Iron Greaves", description: "Clank. Clank. Clank.", rarity: "uncommon", value: 50, icon: "boots_iron", statBonus: { defense: 3, maxHp: 4 }, look: 0x98a0a8 }),
  steel_boots: boots({ name: "Steel Sabatons", description: "Kick doors. Kick skeletons. Kick on.", rarity: "rare", value: 140, icon: "boots_steel", statBonus: { defense: 4, maxHp: 10 }, look: 0xc0ccdc }),
  mithril_boots: boots({ name: "Mithril Striders", description: "You could dance in these. You won't, but you could.", rarity: "epic", value: 480, icon: "boots_mithril", statBonus: { defense: 6, maxHp: 16, luck: 0.02 }, look: 0x7fe8d8 }),

  // --- accessories & relics ---------------------------------------------
  miners_lantern: gear({
    name: "Miner's Lantern", description: "Brass and copper, clipped to your belt. Lights the dark places.",
    category: "accessory", rarity: "uncommon", value: 70, icon: "lantern_item", equipSlot: "accessory", lightBonus: 50, statBonus: { luck: 0.01 },
  }),
  gold_ring: gear({
    name: "Gold Ring", description: "A plain band. Merchants treat you better.",
    category: "accessory", rarity: "uncommon", value: 60, icon: "ring_gold", equipSlot: "accessory", statBonus: { luck: 0.04 },
  }),
  amethyst_ring: gear({
    name: "Amethyst Ring", description: "Your strikes find the gaps in armor.",
    category: "accessory", rarity: "epic", value: 320, icon: "ring_amethyst", equipSlot: "accessory", statBonus: { crit: 0.1, attack: 3 },
  }),
  lucky_charm: gear({
    name: "Four-Leaf Charm", description: "Fortune nudges your way.",
    category: "relic", rarity: "rare", value: 110, icon: "clover", equipSlot: "relic",
    relicEffects: { rareLootChanceBonus: 0.1, sellValueBonus: 0.1 },
  }),
  lucky_horseshoe: gear({
    name: "Gambler's Horseshoe", description: "Found under a tavern table. Still warm.",
    category: "relic", rarity: "epic", value: 300, icon: "horseshoe", equipSlot: "relic",
    relicEffects: { rareLootChanceBonus: 0.18, sellValueBonus: 0.05 }, statBonus: { luck: 0.08 },
  }),
  phoenix_pendant: gear({
    name: "Phoenix Pendant", description: "Warm as a heartbeat. Everything sells for more.",
    category: "relic", rarity: "legendary", value: 900, icon: "pendant_phoenix", equipSlot: "relic",
    relicEffects: { sellValueBonus: 0.3, rareLootChanceBonus: 0.12, gatherSpeedBonus: 0.25 }, statBonus: { maxHp: 20 },
  }),

  rabbit_foot: gear({
    name: "Rabbit's Foot", description: "Lucky for you. Less so for the rabbit.",
    category: "relic", rarity: "uncommon", value: 45, icon: "rabbit_foot", equipSlot: "relic",
    relicEffects: { rareLootChanceBonus: 0.05 }, statBonus: { luck: 0.03 },
  }),

  // --- ranged (hunting foundation) ------------------------------------------
  hunting_bow: gear({
    name: "Hunting Bow", description: "Yew and gut-string. Aims at the cursor, or wherever you're facing; every shot uses an arrow.",
    category: "weapon", rarity: "uncommon", value: 60, icon: "bow_wood", equipSlot: "weapon", statBonus: { attack: 5 }, ammo: "arrow", look: 0xc8935a,
  }),
  arrow: resource({ name: "Arrow", description: "Pointy end goes toward the deer.", rarity: "common", value: 1, icon: "arrow" }),

  // --- farming: seeds and crops (data/crops.ts) -----------------------------
  turnip_seed: resource({ name: "Turnip Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_turnip" }),
  turnip: resource({ name: "Turnip", description: "Hob says turnips are the future. Hob may be right.", rarity: "common", value: 12, icon: "crop_turnip", tier: 1 }),
  carrot_seed: resource({ name: "Carrot Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_carrot" }),
  carrot: resource({ name: "Carrot", description: "Crunchy. Good for the eyes, according to people with glasses.", rarity: "common", value: 16, icon: "crop_carrot", tier: 1 }),
  potato_seed: resource({ name: "Potato Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_potato" }),
  potato: resource({ name: "Potato", description: "Humble, versatile, and apparently a whole personality for some people.", rarity: "common", value: 20, icon: "crop_potato", tier: 1 }),
  strawberry_seed: resource({ name: "Strawberry Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_strawberry" }),
  strawberry: resource({ name: "Strawberry", description: "Sweet, red, and gone suspiciously fast.", rarity: "uncommon", value: 18, icon: "crop_strawberry", tier: 1 }),
  tomato_seed: resource({ name: "Tomato Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_tomato" }),
  tomato: resource({ name: "Tomato", description: "Fruit or vegetable? The tavern has come to blows over it.", rarity: "common", value: 15, icon: "crop_tomato", tier: 1 }),
  corn_seed: resource({ name: "Corn Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_corn" }),
  corn: resource({ name: "Corn", description: "A proud cob. Pops if you look at it wrong near a fire.", rarity: "uncommon", value: 34, icon: "crop_corn", tier: 1 }),
  pumpkin_seed: resource({ name: "Pumpkin Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_pumpkin" }),
  pumpkin: resource({ name: "Pumpkin", description: "Enormous. Took three days and all your patience.", rarity: "rare", value: 62, icon: "crop_pumpkin", tier: 1 }),
  melon_seed: resource({ name: "Melon Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_melon" }),
  melon: resource({ name: "Melon", description: "A whole summer in one heavy green ball.", rarity: "rare", value: 80, icon: "crop_melon", tier: 1 }),
  onion_seed: resource({ name: "Onion Sets", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_onion", tier: 1 }),
  onion: resource({ name: "Onion", description: "Makes grown adventurers cry. Quick to grow, easy to sell.", rarity: "common", value: 14, icon: "crop_onion", tier: 1 }),
  cabbage_seed: resource({ name: "Cabbage Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_cabbage", tier: 1 }),
  cabbage: resource({ name: "Cabbage", description: "One big, stubborn head. Greta turns them into something nobody asks about.", rarity: "common", value: 30, icon: "crop_cabbage", tier: 1 }),
  firepepper_seed: resource({ name: "Firepepper Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_pepper", tier: 1 }),
  firepepper: resource({ name: "Firepepper", description: "Eat one raw. Go on. Everybody at the tavern is watching. (Sobers you up. Hurts.)", rarity: "uncommon", value: 11, icon: "crop_pepper", tier: 1, energy: 12 }),
  grape_seed: resource({ name: "Grape Cuttings", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_grape", tier: 1 }),
  grapes: resource({ name: "Grapes", description: "Greta pays well for these. She says it's for “the good barrel”.", rarity: "uncommon", value: 22, icon: "crop_grape", tier: 1 }),
  duskberry_seed: resource({ name: "Duskberry Seeds", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "common", value: 1, icon: "seed_duskberry", tier: 1 }),
  duskberry: resource({ name: "Duskberries", description: "Blue-black and tart. Birds go quiet when you pick them.", rarity: "common", value: 12, icon: "crop_duskberry", tier: 1 }),
  healroot_seed: resource({ name: "Healroot Cuttings", description: "Hoe a plot, plant these, then water them every day. (Your garden is across the street from your cottage.)", rarity: "uncommon", value: 2, icon: "seed_healroot", tier: 1 }),
  moonroot_seed: resource({ name: "Moonroot Seed", description: "Plant it, water it, and wait. It glows when the moon is up. Nobody at the market will say where it came from.", rarity: "rare", value: 4, icon: "seed_moonroot", tier: 1 }),
  moonroot: resource({ name: "Moonroot", description: "Cold to the touch and faintly humming. Worth a small fortune to the right buyer.", rarity: "rare", value: 140, icon: "crop_moonroot", tier: 1 }),
  vegetable_stew: {
    name: "Garden Stew", description: "Everything from the patch in one pot. Restores 70 HP and plenty of energy.", category: "consumable",
    rarity: "uncommon", value: 38, icon: "stew", stackable: true, maxStack: 20, healAmount: 70, energy: 30,
  },
  pumpkin_pie: {
    name: "Pumpkin Pie", description: "Three days of growing, one hour of baking, eight seconds of eating. Restores 120 HP and lots of energy.", category: "consumable",
    rarity: "rare", value: 110, icon: "apple_pie", stackable: true, maxStack: 20, healAmount: 120, energy: 45,
  },
  berry_tart: {
    name: "Strawberry Tart", description: "Sticky, sweet, gone. Restores 50 HP and some energy.", category: "consumable",
    rarity: "uncommon", value: 45, icon: "apple_pie", stackable: true, maxStack: 20, healAmount: 50, energy: 20,
  },
  // --- hunting trophies (rare quarry) -------------------------------------------
  golden_antler: resource({ name: "Golden Antler", description: "Shed by the Golden Stag, or rather, not shed. Collectors will fight over it. Bram can work it into something grand.", rarity: "epic", value: 220, icon: "antler" }),
  white_pelt: resource({ name: "White Hare Pelt", description: "Soft as snow and twice as rare. Makes a very warm, very lucky hood.", rarity: "rare", value: 45, icon: "hide" }),
  dire_tusk: resource({ name: "Old Tusker's Tusk", description: "Longer than your forearm, and it was using it. The tanners will want the hide too.", rarity: "rare", value: 90, icon: "orc_tusk" }),
  hunters_hood: helm({ name: "Snow-Hare Hood", description: "A hood of white hare pelt. Nothing sees you coming. Everything feels lucky.", rarity: "rare", value: 160, icon: "helm_leather", statBonus: { defense: 3, maxHp: 10, luck: 0.05 }, look: 0xf0f0f8 }),
  tusker_jerkin: gear({
    name: "Tusker-Hide Jerkin", description: "Boar hide over a frame of tusk. Smells like victory, and boar.",
    category: "armor", rarity: "rare", value: 210, icon: "armor_leather", equipSlot: "armor", statBonus: { defense: 10, maxHp: 22, attack: 2 }, look: 0x8a5a3a,
  }),
  stag_crown: helm({ name: "Crown of the Golden Stag", description: "Gilded antlers set on a circlet. Absurd. Magnificent. The forest bows, a little.", rarity: "epic", value: 520, icon: "helm_mithril", statBonus: { defense: 5, maxHp: 25, luck: 0.08, crit: 0.04 }, look: 0xffd060 }),
  // --- quest items ------------------------------------------------------------
  iron_crate: {
    name: "Bram's Iron Crate", description: "A crate of iron ingots stamped BRAM — DO NOT DROP. Somebody dropped it.",
    category: "utility", rarity: "uncommon", value: 0, icon: "chest", stackable: false, maxStack: 1, keyItem: true,
  },
  rattles_femur: {
    name: "Rattles' Femur", description: "A left thigh bone with RATTLES scratched on it. It looks embarrassed.",
    category: "utility", rarity: "uncommon", value: 0, icon: "femur", stackable: false, maxStack: 1, keyItem: true,
  },
  otto_shoe: {
    name: "Otto's Shoe", description: "A left shoe. Or a right one. Smells of lake and ale in equal measure.",
    category: "utility", rarity: "common", value: 0, icon: "boots_leather", stackable: false, maxStack: 1, keyItem: true,
  },
  shrine_bell: {
    name: "The Shrine Bell", description: "A small bronze bell with an angel stamped on it. Goblins love shiny things that go ding.",
    category: "utility", rarity: "uncommon", value: 0, icon: "amulet", stackable: false, maxStack: 1, keyItem: true,
  },
  // --- key items --------------------------------------------------------------
  cottage_key: {
    name: "Aunt Wren's Key", description: "The key to your cottage, still on Wren's lucky string. Not for sale. Not for anything, really, except the door.",
    category: "utility", rarity: "rare", value: 0, icon: "key", stackable: false, maxStack: 1, keyItem: true,
  },

  // --- consumables -------------------------------------------------------
  health_potion: {
    name: "Health Potion", description: "Restores 30 HP. ({k:potion} to drink)", category: "consumable",
    rarity: "common", value: 8, icon: "potion_health", stackable: true, maxStack: 20, healAmount: 30,
  },
  forest_stew: {
    name: "Forest Stew", description: "Glowcaps and herbs, slow-simmered. Restores 55 HP.", category: "consumable",
    rarity: "uncommon", value: 18, icon: "stew", stackable: true, maxStack: 20, healAmount: 55, energy: 20,
  },
  healroot_salve: {
    name: "Healroot Salve", description: "Restores 90 HP. Smells like a forest floor.", category: "consumable",
    rarity: "uncommon", value: 30, icon: "potion_salve", stackable: true, maxStack: 20, healAmount: 90,
  },
  moon_elixir: {
    name: "Moonpetal Elixir", description: "Restores 200 HP. Glows faintly in the dark.", category: "consumable",
    rarity: "rare", value: 90, icon: "potion_moon", stackable: true, maxStack: 20, healAmount: 200,
  },
  return_scroll: {
    name: "Return Scroll", description: "Read it anywhere below ground to step home safely — with everything you found.",
    category: "utility", rarity: "uncommon", value: 30, icon: "scroll_return", stackable: true, maxStack: 20, useEffect: "return_home",
  },
  roast_meat: {
    name: "Roast Haunch", description: "Charred outside, juicy inside. Restores 45 HP.", category: "consumable",
    rarity: "common", value: 14, icon: "meat_roast", stackable: true, maxStack: 20, healAmount: 45, energy: 15,
  },
  apple_pie: {
    name: "Apple Pie", description: "Still warm. Somebody left it out to cool. Restores 35 HP.", category: "consumable",
    rarity: "common", value: 10, icon: "apple_pie", stackable: true, maxStack: 20, healAmount: 35, energy: 15,
  },
  greta_tankard: {
    name: "Greta's Tankard", description: "A pewter tankard with GRETA scratched into it with a knife. Nobody in town will buy this.",
    category: "utility", rarity: "uncommon", value: 25, icon: "tankard", stackable: false, maxStack: 1,
  },
  mystery_box: {
    name: "Mystery Box", description: "Bought from a stranger for fifty gold. Rattles. Open it and see. (Could be anything. Could be a sock.)",
    category: "utility", rarity: "rare", value: 5, icon: "chest", stackable: true, maxStack: 20, useEffect: "open_box",
  },
  // --- odd things travelling merchants sell ------------------------------
  suspicious_potion: {
    name: "Suspicious Potion", description: "Heals 45 HP. Probably. The label has been peeled off and replaced with a drawing of a thumbs-up.",
    category: "consumable", rarity: "common", value: 6, icon: "potion_greater", stackable: true, maxStack: 20, healAmount: 45,
  },
  goblin_bread: {
    name: "Goblin Bread", description: "Dense enough to use as a doorstop. Restores 25 HP and some of your will to live.",
    category: "consumable", rarity: "common", value: 4, icon: "stew", stackable: true, maxStack: 20, healAmount: 25, energy: 10,
  },
  loaded_dice: gear({
    name: "Loaded Dice", description: "They always roll six. Nobody at the tavern needs to know. Luck +5%.",
    category: "relic", rarity: "rare", value: 95, icon: "dice", equipSlot: "relic",
    statBonus: { luck: 0.05 },
  }),
  singing_horseshoe: gear({
    name: "Humming Horseshoe", description: "Hums a little tune when you find something good. Also when you don't. Better loot, worse silence.",
    category: "relic", rarity: "uncommon", value: 60, icon: "horseshoe", equipSlot: "relic",
    relicEffects: { rareLootChanceBonus: 0.06 },
  }),
  old_sock: resource({ name: "Old Sock", description: "One sock. Slightly damp. Deeply disappointing. Worth exactly one gold.", rarity: "common", value: 1, icon: "leather" }),
  mana_potion: {
    name: "Mana Draught", description: "Blue, fizzy, tastes of thunderstorms. Restores 40 mana.", category: "consumable",
    rarity: "uncommon", value: 30, icon: "mana_potion", stackable: true, maxStack: 20, mana: 40,
  },
  // --- v0.0.7: upkeep -------------------------------------------------------
  whetstone: {
    name: "Whetstone", description: "A few minutes of scraping and your blade and tool bite again. Restores 30% of their durability.",
    category: "utility", rarity: "common", value: 6, icon: "whetstone", stackable: true, maxStack: 20, useEffect: "whetstone",
  },
  repair_kit: {
    name: "Repair Kit", description: "Rivets, straps, oil and optimism. Restores 40% durability to everything you're wearing.",
    category: "utility", rarity: "uncommon", value: 24, icon: "repair_kit", stackable: true, maxStack: 10, useEffect: "repair_kit",
  },
  // --- v0.0.7: farming and fishing tools --------------------------------------
  hoe: gear({
    name: "Hoe", description: "Turns hard ground into a garden bed. Face a plot of your garden and press {k:interact}.",
    category: "tool", rarity: "common", value: 12, icon: "hoe", equipSlot: "tool", toolKind: "hoe", toolPower: 1, look: 0xb0b0b8,
  }),
  watering_can: gear({
    name: "Watering Can", description: "Holds 20 waterings; one soaks a plot and its neighbours. Refill it at any well, trough or water barrel.",
    category: "tool", rarity: "common", value: 14, icon: "watering_can", equipSlot: "tool", toolKind: "can", toolPower: 1,
  }),
  fishing_rod: gear({
    name: "Fishing Rod", description: "Willow and line. Cast at open water, wait for the bite, pull at the right moment.",
    category: "tool", rarity: "common", value: 18, icon: "rod_wood", equipSlot: "tool", toolKind: "rod", toolPower: 1,
  }),
  angler_rod: gear({
    name: "Angler's Rod", description: "A springy rod with a brass reel. Bigger fish, fewer escapes.",
    category: "tool", rarity: "uncommon", value: 70, icon: "rod_iron", equipSlot: "tool", toolKind: "rod", toolPower: 2,
  }),
  bait: resource({ name: "Worm", description: "Bait. Fish bite much sooner if there's a worm on the hook. Turns up when you dig.", rarity: "common", value: 1, icon: "bait_worm" }),
  // --- v0.0.7: fish (Mirror Lake) --------------------------------------------
  fish_minnow: resource({ name: "Minnow", description: "Tiny, silver, mostly bones. Good bait, bad dinner.", rarity: "common", value: 3, icon: "fish_minnow" }),
  fish_perch: resource({ name: "Perch", description: "Striped and grumpy. Grills nicely.", rarity: "common", value: 8, icon: "fish_perch" }),
  fish_carp: resource({ name: "Carp", description: "A fat, patient fish. Lives forever, tastes of pond.", rarity: "common", value: 10, icon: "fish_carp" }),
  fish_trout: resource({ name: "Trout", description: "Speckled and quick. The tavern kitchen pays well for these.", rarity: "uncommon", value: 16, icon: "fish_trout" }),
  fish_salmon: resource({ name: "Lake Salmon", description: "Pink, strong and delicious. Put up a real fight.", rarity: "uncommon", value: 24, icon: "fish_salmon" }),
  fish_pike: resource({ name: "Pike", description: "All teeth and bad temper. Lurks in the reeds.", rarity: "rare", value: 42, icon: "fish_pike" }),
  fish_rainbow: resource({ name: "Rainbowfin", description: "Shimmers every colour at once. Collectors adore it.", rarity: "rare", value: 58, icon: "fish_rainbow" }),
  fish_moon: resource({ name: "Moonscale", description: "Only rises at night. Its scales glow faintly, like the Ancient Grove.", rarity: "epic", value: 120, icon: "fish_moon" }),
  fish_golden: resource({ name: "Golden Carp", description: "The lake's legend. Old Tobin swears he caught one in '42. Nobody believed him either.", rarity: "legendary", value: 320, icon: "fish_golden" }),
  grilled_fish: {
    name: "Grilled Fish", description: "Charred skin, flaky middle, a squeeze of something. Restores 40 HP and some energy.", category: "consumable",
    rarity: "common", value: 18, icon: "fish_cooked", stackable: true, maxStack: 20, healAmount: 40, energy: 25,
  },
  fish_stew: {
    name: "Fisherman's Stew", description: "Fish, potato, a lot of pepper. Restores 75 HP and plenty of energy.", category: "consumable",
    rarity: "uncommon", value: 40, icon: "stew", stackable: true, maxStack: 20, healAmount: 75, energy: 40,
  },
  greater_potion: {
    name: "Greater Potion", description: "Restores 80 HP. Drunk after regular potions run out.", category: "consumable",
    rarity: "uncommon", value: 25, icon: "potion_greater", stackable: true, maxStack: 20, healAmount: 80,
  },
};

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  Object.entries(DEFS).map(([id, d]) => [
    id,
    { stackable: false, maxStack: 1, ...d, id } as ItemDef,
  ]),
);

export function getItem(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item id: ${id}`);
  return def;
}

export function hasItemDef(id: string): boolean {
  return id in ITEMS;
}

/** How the weapon in hand swings (bows shoot; everything else defaults to sword). */
export function weaponProfile(itemId: string | undefined): WeaponProfile {
  if (!itemId) return WEAPONS.sword;
  const def = getItem(itemId);
  if (def.ammo) return WEAPONS.bow;
  return WEAPONS[def.weapon ?? "sword"];
}

export function isEquipment(def: ItemDef): boolean {
  return def.equipSlot !== undefined;
}

/** Extra maximum stamina from worn gear. */
export function gearStamina(eq: Partial<Record<EquipSlot, string>>): number {
  let n = 0;
  for (const id of Object.values(eq)) if (id) n += getItem(id).stamina ?? 0;
  return n;
}
