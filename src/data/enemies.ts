import type { Stats } from "../game/core/types";

export interface LootEntry {
  itemId: string;
  min: number;
  max: number;
  weight: number;
  chance: number; // 0-1 independent roll chance
}

export interface EnemyDef {
  id: string;
  name: string;
  sheets: {
    idle: string;
    run: string;
    death: string;
  };
  idleFrames: number;
  runFrames: number;
  deathFrames: number;
  frameSize: number;
  stats: Stats;
  xpReward: number;
  goldReward: [number, number];
  loot: LootEntry[];
  minDungeonTier: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  orc: {
    id: "orc",
    name: "Orc Raider",
    sheets: {
      idle: "/sprites/enemies/orc/idle.png",
      run: "/sprites/enemies/orc/run.png",
      death: "/sprites/enemies/orc/death.png",
    },
    idleFrames: 4,
    runFrames: 6,
    deathFrames: 6,
    frameSize: 64,
    stats: { maxHp: 32, attack: 6, defense: 2, crit: 0.05, luck: 0.05 },
    xpReward: 14,
    goldReward: [4, 9],
    loot: [
      { itemId: "leather", min: 1, max: 2, weight: 1, chance: 0.5 },
      { itemId: "wooden_sword", min: 1, max: 1, weight: 1, chance: 0.05 },
    ],
    minDungeonTier: 1,
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    sheets: {
      idle: "/sprites/enemies/skeleton/idle.png",
      run: "/sprites/enemies/skeleton/run.png",
      death: "/sprites/enemies/skeleton/death.png",
    },
    idleFrames: 4,
    runFrames: 6,
    deathFrames: 12,
    frameSize: 64,
    stats: { maxHp: 24, attack: 7, defense: 1, crit: 0.08, luck: 0.05 },
    xpReward: 12,
    goldReward: [3, 8],
    loot: [
      { itemId: "iron_ore", min: 1, max: 1, weight: 1, chance: 0.3 },
      { itemId: "health_potion", min: 1, max: 1, weight: 1, chance: 0.15 },
    ],
    minDungeonTier: 1,
  },
};

export function getEnemy(id: string): EnemyDef {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy id: ${id}`);
  return def;
}

export function enemiesForTier(tier: number): EnemyDef[] {
  return Object.values(ENEMIES).filter((e) => e.minDungeonTier <= tier);
}
