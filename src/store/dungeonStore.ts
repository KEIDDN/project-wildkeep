import { create } from "zustand";
import { SeededRandom, makeSeed } from "../game/core/rng";
import { generateDungeon } from "../game/dungeon/DungeonGenerator";
import type {
  DungeonChest,
  DungeonData,
  DungeonEnemyInstance,
  DungeonRoomData,
} from "../game/dungeon/types";

interface DungeonState {
  dungeon: DungeonData | null;
  rng: SeededRandom | null;
  playerTileX: number;
  playerTileY: number;
  activeCombatEnemyId: string | null;
  bossDefeated: boolean;
  runComplete: boolean;
  runGoldEarned: number;
  runXpEarned: number;
  runItemsFound: { itemId: string; quantity: number }[];

  start: (tier: number, seed?: string) => void;
  addRunReward: (gold: number, xp: number, items: { itemId: string; quantity: number }[]) => void;
  reset: () => void;
  movePlayerTile: (x: number, y: number) => void;
  isWallAt: (x: number, y: number) => boolean;
  roomAt: (x: number, y: number) => DungeonRoomData | undefined;
  enemyAt: (x: number, y: number) => DungeonEnemyInstance | undefined;
  chestAt: (x: number, y: number) => DungeonChest | undefined;
  enterCombat: (instanceId: string) => void;
  clearCombat: () => void;
  damageEnemy: (instanceId: string, amount: number) => number;
  markEnemyDefeated: (instanceId: string) => void;
  markChestOpened: (instanceId: string) => void;
  markRunComplete: () => void;
}

export const useDungeonStore = create<DungeonState>((set, get) => ({
  dungeon: null,
  rng: null,
  playerTileX: 0,
  playerTileY: 0,
  activeCombatEnemyId: null,
  bossDefeated: false,
  runComplete: false,
  runGoldEarned: 0,
  runXpEarned: 0,
  runItemsFound: [],

  start: (tier, seed) => {
    const usedSeed = seed ?? makeSeed();
    const dungeon = generateDungeon(usedSeed, tier);
    set({
      dungeon,
      rng: SeededRandom.fromString(`${usedSeed}:combat`),
      playerTileX: dungeon.entranceTile.x,
      playerTileY: dungeon.entranceTile.y,
      activeCombatEnemyId: null,
      bossDefeated: false,
      runComplete: false,
      runGoldEarned: 0,
      runXpEarned: 0,
      runItemsFound: [],
    });
  },

  addRunReward: (gold, xp, items) =>
    set((state) => {
      const found = [...state.runItemsFound];
      for (const item of items) {
        const idx = found.findIndex((f) => f.itemId === item.itemId);
        if (idx >= 0) found[idx] = { ...found[idx], quantity: found[idx].quantity + item.quantity };
        else found.push({ ...item });
      }
      return {
        runGoldEarned: state.runGoldEarned + gold,
        runXpEarned: state.runXpEarned + xp,
        runItemsFound: found,
      };
    }),

  reset: () =>
    set({
      dungeon: null,
      rng: null,
      activeCombatEnemyId: null,
      bossDefeated: false,
      runComplete: false,
      runGoldEarned: 0,
      runXpEarned: 0,
      runItemsFound: [],
    }),

  movePlayerTile: (x, y) => set({ playerTileX: x, playerTileY: y }),

  isWallAt: (x, y) => {
    const d = get().dungeon;
    if (!d) return true;
    if (x < 0 || y < 0 || x >= d.width || y >= d.height) return true;
    return d.tileGrid[y][x] === "wall";
  },

  roomAt: (x, y) => {
    const d = get().dungeon;
    if (!d) return undefined;
    return d.rooms.find(
      (r) =>
        x >= r.tileOriginX &&
        x < r.tileOriginX + r.width &&
        y >= r.tileOriginY &&
        y < r.tileOriginY + r.height,
    );
  },

  enemyAt: (x, y) => {
    const d = get().dungeon;
    if (!d) return undefined;
    for (const room of d.rooms) {
      const found = room.enemies.find(
        (e) => !e.defeated && e.tileX === x && e.tileY === y,
      );
      if (found) return found;
    }
    return undefined;
  },

  chestAt: (x, y) => {
    const d = get().dungeon;
    if (!d) return undefined;
    for (const room of d.rooms) {
      if (room.chest && room.chest.tileX === x && room.chest.tileY === y) {
        return room.chest;
      }
    }
    return undefined;
  },

  enterCombat: (instanceId) => set({ activeCombatEnemyId: instanceId }),
  clearCombat: () => set({ activeCombatEnemyId: null }),

  damageEnemy: (instanceId, amount) => {
    const d = get().dungeon;
    if (!d) return 0;
    let remaining = 0;
    for (const room of d.rooms) {
      const enemy = room.enemies.find((e) => e.instanceId === instanceId);
      if (enemy) {
        enemy.currentHp = Math.max(0, enemy.currentHp - amount);
        remaining = enemy.currentHp;
      }
    }
    set({ dungeon: { ...d } });
    return remaining;
  },

  markEnemyDefeated: (instanceId) => {
    const d = get().dungeon;
    if (!d) return;
    let bossDefeated = get().bossDefeated;
    for (const room of d.rooms) {
      const enemy = room.enemies.find((e) => e.instanceId === instanceId);
      if (enemy) {
        enemy.defeated = true;
        room.cleared = room.enemies.every((e) => e.defeated);
        if (room.id === d.bossRoomId && room.cleared) bossDefeated = true;
      }
    }
    set({ dungeon: { ...d }, activeCombatEnemyId: null, bossDefeated });
  },

  markChestOpened: (instanceId) => {
    const d = get().dungeon;
    if (!d) return;
    for (const room of d.rooms) {
      if (room.chest?.instanceId === instanceId) room.chest.opened = true;
    }
    set({ dungeon: { ...d } });
  },

  markRunComplete: () => set({ runComplete: true }),
}));
