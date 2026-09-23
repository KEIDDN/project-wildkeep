import type { Stats } from "../core/types";

export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export interface EquipmentSaveState {
  weapon?: string;
  armor?: string;
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
  skills: {
    woodcutting: number;
    mining: number;
    gathering: number;
    combat: number;
  };
  equipment: EquipmentSaveState;
}

export interface TownSaveState {
  buildingLevels: Record<string, number>;
}

export interface DungeonProgressSaveState {
  highestTierCleared: number;
  runsCompleted: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  player: PlayerSaveState;
  inventory: InventoryStack[];
  town: TownSaveState;
  dungeonProgress: DungeonProgressSaveState;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  savedAt: 0,
  player: {
    level: 1,
    xp: 0,
    hp: 30,
    baseStats: { maxHp: 30, attack: 4, defense: 2, crit: 0.05, luck: 0.05 },
    gold: 20,
    skills: { woodcutting: 1, mining: 1, gathering: 1, combat: 1 },
    equipment: {
      weapon: "wooden_sword",
      armor: "cloth_tunic",
      tool: "rusty_axe",
    },
  },
  inventory: [{ itemId: "rusty_pickaxe", quantity: 1 }],
  town: { buildingLevels: {} },
  dungeonProgress: { highestTierCleared: 0, runsCompleted: 0 },
};
