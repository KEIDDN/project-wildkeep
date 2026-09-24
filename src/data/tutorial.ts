import type { AreaId } from "../game/core/types";
import type { GameEventMap } from "../game/events";
import type { en } from "../i18n/en";

/**
 * The introduction: not a list of chores, but your first days in Wildkeep,
 * told by the people who live there. Aunt Wren's letter gets you out of
 * the cottage; Bram gives you your first job (the lost iron shipment), and
 * that one errand teaches the forest, gathering, fighting, loot, the bag
 * and the forge. Then the Barrow, the tavern, the tables — and Hob, who
 * gives you a garden.
 *
 * Each step: who's talking (`who`: an NPC id or "wren"), a line with a bit
 * of personality and a reason, and a hint. Steps complete on game events,
 * skip themselves if you've already done the thing (`alreadyDone`), and can
 * point the guide arrow (`target`). It never pauses the game. Text lives in
 * i18n (tutorial.steps.<id>).
 */
export interface TutorialStep {
  id: keyof typeof en.tutorial.steps;
  who: string;
  /** Event that may complete the step, and an optional filter on it. */
  on: keyof GameEventMap;
  test?: (payload: never) => boolean;
  /** Skip this step if it's already true when the step starts. */
  alreadyDone?: (ctx: TutorialCtx) => boolean;
  target?: { area: AreaId; spawn: string };
}

export interface TutorialCtx {
  area: AreaId;
  quests: { active: Record<string, unknown>; done: string[] };
  has: (itemId: string) => boolean;
  discovered: (id: string) => boolean;
}

const questStarted = (id: string) => (c: TutorialCtx) => !!c.quests.active[id] || c.quests.done.includes(id);

export const TUTORIAL_STEPS: TutorialStep[] = [
  // Wren's letter: the cottage, then out the door.
  { id: "letter", who: "wren", on: "interacted" },
  {
    id: "outside",
    who: "wren",
    on: "areaEntered",
    test: (p: GameEventMap["areaEntered"]) => p.area === "town",
    alreadyDone: (c) => c.area !== "house",
    target: { area: "house", spawn: "door" },
  },
  // Bram's lost shipment: your first job, and everything it teaches.
  { id: "bram", who: "bram", on: "questAccepted", test: (p: GameEventMap["questAccepted"]) => p.questId === "iron_shipment", alreadyDone: questStarted("iron_shipment"), target: { area: "town", spawn: "forge_door" } },
  { id: "woods", who: "bram", on: "areaEntered", test: (p: GameEventMap["areaEntered"]) => p.area === "forest", alreadyDone: (c) => c.area === "forest" || c.has("iron_crate") || c.quests.done.includes("iron_shipment"), target: { area: "town", spawn: "east" } },
  { id: "gather", who: "hale", on: "resourceGathered" },
  { id: "fight", who: "bram", on: "enemyKilled", target: { area: "forest", spawn: "quest_iron_shipment" } },
  { id: "crate", who: "bram", on: "pickupCollected", test: (p: GameEventMap["pickupCollected"]) => p.itemId === "iron_crate", alreadyDone: (c) => c.has("iron_crate") || c.quests.done.includes("iron_shipment"), target: { area: "forest", spawn: "quest_iron_shipment" } },
  { id: "bag", who: "wren", on: "panelOpened", test: (p: GameEventMap["panelOpened"]) => p.panel === "inventory" },
  { id: "deliver", who: "bram", on: "questCompleted", test: (p: GameEventMap["questCompleted"]) => p.questId === "iron_shipment", alreadyDone: (c) => c.quests.done.includes("iron_shipment"), target: { area: "town", spawn: "forge_door" } },
  { id: "forge", who: "bram", on: "crafted", target: { area: "town", spawn: "forge_door" } },
  { id: "talents", who: "wren", on: "panelOpened", test: (p: GameEventMap["panelOpened"]) => p.panel === "skills" },
  // The rest of the village: the Barrow, the tavern, the tables, the garden.
  { id: "barrow", who: "rowan", on: "areaEntered", test: (p: GameEventMap["areaEntered"]) => p.area === "dungeon", alreadyDone: (c) => c.discovered("area:dungeon"), target: { area: "town", spawn: "barrow" } },
  { id: "tavern", who: "greta", on: "areaEntered", test: (p: GameEventMap["areaEntered"]) => p.area === "tavern", target: { area: "town", spawn: "tavern_door" } },
  { id: "drink", who: "greta", on: "drank" },
  { id: "cards", who: "silas", on: "gambled" },
  { id: "garden", who: "hob", on: "questAccepted", test: (p: GameEventMap["questAccepted"]) => p.questId === "hob_seeds", alreadyDone: questStarted("hob_seeds") },
];

/** Help topics the introduction already covers (their cards wait until it's over). */
export const COVERED_BY_INTRO: HelpTopicId[] = ["movement", "home", "town", "forest", "gathering", "inventory", "equipment", "crafting", "combat", "tavern", "blackjack"];

/**
 * Contextual help: a short card the first time you meet a system, which
 * closes itself once you've done the thing it teaches (`doneOn`), and a Help
 * menu (H) to reread any of them. Text lives in i18n (tutorial.topics.<id>).
 */
export type HelpTopicId = keyof typeof en.tutorial.topics;

export interface HelpTopic {
  icon: string;
  /** The card dismisses itself when this happens ("understood"). */
  doneOn?: { event: keyof GameEventMap; count?: number };
}

export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  movement: { icon: "boots_leather", doneOn: { event: "moved", count: 12 } },
  home: { icon: "house", doneOn: { event: "areaEntered" } },
  town: { icon: "coin_bag", doneOn: { event: "areaEntered" } },
  forest: { icon: "axe_iron", doneOn: { event: "resourceGathered" } },
  gathering: { icon: "wood", doneOn: { event: "resourceGathered", count: 3 } },
  inventory: { icon: "chest", doneOn: { event: "panelClosed" } },
  equipment: { icon: "helm_iron", doneOn: { event: "panelClosed" } },
  selling: { icon: "gold_coin", doneOn: { event: "itemSold" } },
  crafting: { icon: "craft", doneOn: { event: "crafted" } },
  mining: { icon: "pickaxe_iron", doneOn: { event: "resourceGathered", count: 2 } },
  combat: { icon: "sword_iron", doneOn: { event: "enemyKilled" } },
  dungeon_floors: { icon: "key", doneOn: { event: "areaEntered" } },
  tavern: { icon: "beer", doneOn: { event: "panelOpened" } },
  blackjack: { icon: "coin_bag", doneOn: { event: "gambled" } },
  roulette: { icon: "dice", doneOn: { event: "gambled" } },
  skills: { icon: "skill_strength", doneOn: { event: "panelClosed" } },
  time: { icon: "sleep" },
  house: { icon: "house", doneOn: { event: "panelClosed" } },
  journal: { icon: "journal", doneOn: { event: "panelClosed" } },
  honor: { icon: "clover" },
  events: { icon: "scroll_return" },
  hunting: { icon: "bow_wood", doneOn: { event: "animalHunted" } },
  farming: { icon: "hoe", doneOn: { event: "planted" } },
  fishing: { icon: "rod_wood", doneOn: { event: "fished" } },
  energy: { icon: "glyph_sun" },
  durability: { icon: "repair_kit", doneOn: { event: "repaired" } },
  parry: { icon: "glyph_shield" },
  map: { icon: "map_scroll", doneOn: { event: "panelOpened" } },
};

export const HELP_TOPIC_ORDER = Object.keys(HELP_TOPICS) as HelpTopicId[];
