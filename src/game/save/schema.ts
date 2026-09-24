import type { TalentRanks } from "../../data/talents";
import type { AreaId, Stats } from "../core/types";
import { freshSkills, type SkillState } from "../systems/skills";
import { START_MINUTE } from "../time/clock";

export interface InventoryStack {
  itemId: string;
  quantity: number;
  /** Pocketed from someone: stacks separately, and honest shops won't buy it. */
  stolen?: boolean;
  /** Durability of a carried piece of gear (missing = like new). */
  dur?: number;
}

export interface EquipmentSaveState {
  weapon?: string;
  head?: string;
  armor?: string;
  boots?: string;
  accessory?: string;
  tool?: string;
  relic?: string;
}

export interface PlayerSaveState {
  level: number;
  xp: number;
  hp: number;
  baseStats: Stats;
  gold: number;
  skills: SkillState;
  equipment: EquipmentSaveState;
  /** Talent ranks (data/talents.ts). Missing in pre-talent saves. */
  talents?: TalentRanks;
  /** Talent points from quests and deeds, on top of those from levels. */
  bonusTalentPoints?: number;
  /** Daily energy left (v6). */
  energy?: number;
  /** Durability of worn gear per slot (v6; missing = like new). */
  wear?: Partial<Record<string, number>>;
}

export interface WorldSaveState {
  area: AreaId;
  x: number;
  y: number;
  /** Named spawn to use when x/y are unset (-1). */
  spawn?: string;
  /** Resource node id -> epoch ms when it regrows. */
  nodeRespawns: Record<string, number>;
}

export interface TownSaveState {
  /** Building id -> level. `house` is the player's home (1..4). */
  buildingLevels: Record<string, number>;
  stash: InventoryStack[];
}

/** Permanent world progress: how deep you've been, what you've found. */
export interface ProgressSaveState {
  dungeonDeepest: number;
  /** Highest boss floor beaten (runs can start just below it). */
  dungeonCheckpoint: number;
  mineDeepest: number;
  /** Deepest mine lift stop unlocked (every 5 floors). */
  mineCheckpoint: number;
  runsCompleted: number;
  bossesSlain: string[];
  /** Places / secrets found (Ancient Grove, hidden glades…). */
  discoveries: string[];
  flags: Record<string, boolean>;
}

export interface StatsSaveState {
  goldWonGambling: number;
  goldLostGambling: number;
  deaths: number;
  enemiesSlain: number;
  /** v6 */
  fishCaught?: number;
}

export interface TimeSaveState {
  day: number;
  minute: number;
  restedDay: number | null;
}

export interface TutorialSaveState {
  /** Guided "first day" objectives. */
  step: number;
  completed: boolean;
  /** Contextual help topics already shown (never shown twice). */
  seenTopics: string[];
  introSeen: boolean;
}

/** How the village sees you (see store/socialStore.ts). */
export interface SocialSaveState {
  honor: number;
  relationships: Record<string, { friendship: number; lastTalkDay: number; status?: string; known?: string[]; claimed?: number[] }>;
  deeds: { stolen: number; caught: number; roundsBought: number; helped: number; animalsHunted: number; npcsHit: number };
  /** Once-a-day things used today: key -> day. */
  used: Record<string, number>;
  /** Today's world event (rolled each morning). */
  event: { day: number; id: string | null };
  /** What each group thinks of you (−100…100): see game/social/reputation.ts. */
  rep: { village: number; watch: number; underworld: number };
  /** Gold the watch wants from you for being caught. */
  bounty: number;
  /** Tipsiness 0..100 (the tavern; wears off). */
  drunk: number;
}

/** Your garden plots, keyed "tx,ty" (see game/farming.ts). */
export interface FarmSaveState {
  /** `tilled`: turned with a hoe (planted plots are always tilled). */
  plots: Record<string, { crop: string | null; growth: number; watered: number; tilled?: boolean }>;
  /** Water left in the watering can (v6). */
  can?: number;
}

/** Quests in progress and done (see game/quests.ts). */
export interface QuestSaveState {
  active: Record<string, { stage: number; count: number; choice?: string }>;
  done: string[];
  tracked: string | null;
  /** Today's notice-board contracts. */
  board: { day: number; offers: string[] };
}

/**
 * Everything a save holds. Versioned: saveManager.migrate() upgrades older
 * saves field by field, so adding a section never invalidates old games.
 * (The language is a device preference and lives in settings instead.)
 */
export interface SaveData {
  version: number;
  savedAt: number;
  player: PlayerSaveState;
  inventory: InventoryStack[];
  world: WorldSaveState;
  town: TownSaveState;
  progress: ProgressSaveState;
  stats: StatsSaveState;
  time: TimeSaveState;
  tutorial: TutorialSaveState;
  social: SocialSaveState;
  quests: QuestSaveState;
  farm: FarmSaveState;
}

export const DEFAULT_SAVE: SaveData = {
  version: 6,
  savedAt: 0,
  player: {
    level: 1,
    xp: 0,
    hp: 40,
    baseStats: { maxHp: 40, attack: 4, defense: 1, crit: 0.05, luck: 0.03 },
    gold: 25,
    skills: freshSkills(),
    equipment: {
      weapon: "wooden_sword",
      armor: "cloth_tunic",
      tool: "rusty_axe",
    },
  },
  inventory: [
    { itemId: "rusty_pickaxe", quantity: 1 },
    { itemId: "health_potion", quantity: 2 },
    { itemId: "cottage_key", quantity: 1 },
  ],
  // New games start inside the player's cottage.
  world: { area: "house", x: 72, y: 128, nodeRespawns: {} },
  town: { buildingLevels: { house: 1 }, stash: [] },
  progress: {
    dungeonDeepest: 0,
    dungeonCheckpoint: 0,
    mineDeepest: 0,
    mineCheckpoint: 0,
    runsCompleted: 0,
    bossesSlain: [],
    discoveries: [],
    flags: {},
  },
  stats: { goldWonGambling: 0, goldLostGambling: 0, deaths: 0, enemiesSlain: 0, fishCaught: 0 },
  time: { day: 1, minute: START_MINUTE, restedDay: null },
  tutorial: { step: 0, completed: false, seenTopics: [], introSeen: false },
  social: {
    honor: 0,
    relationships: {},
    deeds: { stolen: 0, caught: 0, roundsBought: 0, helped: 0, animalsHunted: 0, npcsHit: 0 },
    used: {},
    event: { day: 0, id: null },
    rep: { village: 0, watch: 0, underworld: 0 },
    bounty: 0,
    drunk: 0,
  },
  quests: { active: {}, done: [], tracked: null, board: { day: 0, offers: [] } },
  farm: { plots: {} },
};
