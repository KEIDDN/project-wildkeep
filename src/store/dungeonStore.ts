import { create } from "zustand";
import { generateDungeon } from "../game/dungeon/DungeonGenerator";
import type { DungeonData } from "../game/dungeon/types";
import type { InventoryStack } from "../game/save/schema";
import { addToStacks } from "./inventoryStore";
import type { TravelRequest } from "./worldStore";

/** A fresh, human-readable run seed ("582931"). Same seed + floor = same
 * layout, which keeps runs reproducible and bugs debuggable. */
export function newRunSeed(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

/**
 * State of the current dungeon run. A run is a descent: floor after floor,
 * all generated from one run seed. Each floor's layout is regenerated from
 * (seed, floor), so the store only tracks what changed on the current floor,
 * plus the loot carried since the run began.
 */
interface DungeonState {
  dungeon: DungeonData | null;
  seed: string | null;
  floor: number;
  /** Floor the run started on (1, or a checkpoint). */
  startFloor: number;
  /** Where you come back up (the entrance you went in by). */
  surface: TravelRequest;
  exploredRooms: number[];
  playerTile: { x: number; y: number };
  defeatedEnemies: string[];
  openedChests: string[];
  usedFountains: string[];
  /** The floor's guardian is dead: the stairs are open. */
  guardianDefeated: boolean;
  outcome: "active" | "cleared" | "retreated" | "died" | null;

  runGold: number;
  runXp: number;
  runItems: InventoryStack[];
  enemiesSlain: number;
  floorsCleared: number;

  start: (floor: number, surface: TravelRequest, seed?: string) => DungeonData;
  /** Next floor down, same run. */
  descend: () => DungeonData;
  exploreRoom: (roomId: number) => void;
  setPlayerTile: (x: number, y: number) => void;
  markEnemyDefeated: (id: string, guardian: boolean) => void;
  markChestOpened: (id: string) => void;
  markFountainUsed: (key: string) => void;
  addRunLoot: (gold: number, xp: number, items: InventoryStack[]) => void;
  finish: (outcome: "cleared" | "retreated" | "died") => void;
  reset: () => void;
}

const FLOOR_STATE = {
  exploredRooms: [0],
  defeatedEnemies: [],
  openedChests: [],
  usedFountains: [],
  guardianDefeated: false,
} satisfies Partial<DungeonState>;

const EMPTY = {
  ...FLOOR_STATE,
  exploredRooms: [],
  dungeon: null,
  seed: null,
  floor: 1,
  startFloor: 1,
  surface: { area: "town", spawn: "barrow" } as TravelRequest,
  playerTile: { x: 0, y: 0 },
  outcome: null,
  runGold: 0,
  runXp: 0,
  runItems: [],
  enemiesSlain: 0,
  floorsCleared: 0,
} satisfies Partial<DungeonState>;

export const useDungeonStore = create<DungeonState>((set, get) => ({
  ...EMPTY,

  start: (floor, surface, seed) => {
    const usedSeed = seed ?? newRunSeed();
    const dungeon = generateDungeon(usedSeed, floor);
    set({ ...EMPTY, ...FLOOR_STATE, dungeon, seed: usedSeed, floor, startFloor: floor, surface, outcome: "active", playerTile: dungeon.spawn });
    return dungeon;
  },

  descend: () => {
    const s = get();
    const floor = s.floor + 1;
    const dungeon = generateDungeon(s.seed!, floor);
    set({ ...FLOOR_STATE, dungeon, floor, playerTile: dungeon.spawn, floorsCleared: s.floorsCleared + 1 });
    return dungeon;
  },

  exploreRoom: (roomId) => {
    if (get().exploredRooms.includes(roomId)) return;
    set((s) => ({ exploredRooms: [...s.exploredRooms, roomId] }));
  },

  setPlayerTile: (x, y) => {
    const cur = get().playerTile;
    if (cur.x !== x || cur.y !== y) set({ playerTile: { x, y } });
  },

  markEnemyDefeated: (id, guardian) =>
    set((s) => ({
      defeatedEnemies: [...s.defeatedEnemies, id],
      enemiesSlain: s.enemiesSlain + 1,
      guardianDefeated: s.guardianDefeated || guardian,
    })),

  markChestOpened: (id) => set((s) => ({ openedChests: [...s.openedChests, id] })),
  markFountainUsed: (key) => set((s) => ({ usedFountains: [...s.usedFountains, key] })),

  addRunLoot: (gold, xp, items) =>
    set((s) => {
      let runItems = s.runItems;
      for (const it of items) runItems = addToStacks(runItems, it.itemId, it.quantity);
      return { runGold: s.runGold + gold, runXp: s.runXp + xp, runItems };
    }),

  finish: (outcome) => set({ outcome }),
  reset: () => set({ ...EMPTY }),
}));
