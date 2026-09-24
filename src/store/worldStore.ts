import { create } from "zustand";
import type { AreaId, Vector2 } from "../game/core/types";
import type { ProgressSaveState, StatsSaveState, WorldSaveState } from "../game/save/schema";
import { DEFAULT_SAVE } from "../game/save/schema";

export interface TravelRequest {
  area: AreaId;
  /** Named spawn point in the target area, or an exact position. */
  spawn: string | Vector2;
}

/**
 * Where the player is and where they're going, plus permanent world
 * progress (depth records, checkpoints, discoveries). The engine performs
 * the actual area switch (with a fade) when `pendingTravel` is set, so UI
 * panels and gameplay code can request travel without knowing about
 * rendering.
 */
interface WorldState {
  area: AreaId;
  pendingTravel: TravelRequest | null;
  /** Last known player position, written by the engine when saving. */
  position: Vector2;
  /** Spawn name to load at when there's no exact position (fresh game, or a
   * save made underground). */
  resumeSpawn: string;
  nodeRespawns: Record<string, number>;
  progress: ProgressSaveState;
  stats: StatsSaveState;

  requestTravel: (req: TravelRequest) => void;
  completeTravel: (area: AreaId) => void;
  setPosition: (pos: Vector2) => void;
  setNodeRespawn: (nodeKey: string, at: number) => void;
  /** Everything regrows overnight. */
  clearNodeRespawns: () => void;
  /** Reached a dungeon floor; returns true if it's a new record. */
  recordDungeonFloor: (floor: number) => boolean;
  unlockDungeonCheckpoint: (floor: number) => void;
  recordMineFloor: (floor: number) => boolean;
  recordRunComplete: () => void;
  recordBoss: (id: string) => void;
  /** Returns true the first time something is discovered. */
  discover: (id: string) => boolean;
  setFlag: (flag: string, value?: boolean) => void;
  bumpStat: (key: keyof StatsSaveState, amount?: number) => void;
  loadFrom: (world: WorldSaveState, progress: ProgressSaveState, stats: StatsSaveState) => void;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  area: DEFAULT_SAVE.world.area,
  pendingTravel: null,
  position: { x: DEFAULT_SAVE.world.x, y: DEFAULT_SAVE.world.y },
  resumeSpawn: "default",
  nodeRespawns: {},
  progress: structuredClone(DEFAULT_SAVE.progress),
  stats: { ...DEFAULT_SAVE.stats },

  requestTravel: (req) => set({ pendingTravel: req }),
  completeTravel: (area) => set({ area, pendingTravel: null }),
  setPosition: (pos) => set({ position: pos }),

  setNodeRespawn: (nodeKey, at) =>
    set((state) => {
      const now = Date.now();
      // Opportunistically drop long-expired entries so the save stays small.
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(state.nodeRespawns)) if (v > now) next[k] = v;
      next[nodeKey] = at;
      return { nodeRespawns: next };
    }),

  clearNodeRespawns: () => set({ nodeRespawns: {} }),

  recordDungeonFloor: (floor) => {
    const p = get().progress;
    if (floor <= p.dungeonDeepest) return false;
    set({ progress: { ...p, dungeonDeepest: floor } });
    return true;
  },
  unlockDungeonCheckpoint: (floor) =>
    set((s) => ({ progress: { ...s.progress, dungeonCheckpoint: Math.max(s.progress.dungeonCheckpoint, floor) } })),
  recordMineFloor: (floor) => {
    const p = get().progress;
    if (floor <= p.mineDeepest) return false;
    set({ progress: { ...p, mineDeepest: floor, mineCheckpoint: Math.max(p.mineCheckpoint, Math.floor(floor / 5) * 5) } });
    return true;
  },
  recordRunComplete: () => set((s) => ({ progress: { ...s.progress, runsCompleted: s.progress.runsCompleted + 1 } })),
  recordBoss: (id) =>
    set((s) => (s.progress.bossesSlain.includes(id) ? s : { progress: { ...s.progress, bossesSlain: [...s.progress.bossesSlain, id] } })),
  discover: (id) => {
    const p = get().progress;
    if (p.discoveries.includes(id)) return false;
    set({ progress: { ...p, discoveries: [...p.discoveries, id] } });
    return true;
  },
  setFlag: (flag, value = true) => set((s) => ({ progress: { ...s.progress, flags: { ...s.progress.flags, [flag]: value } } })),

  bumpStat: (key, amount = 1) => set((state) => ({ stats: { ...state.stats, [key]: (state.stats[key] ?? 0) + amount } })),

  loadFrom: (world, progress, stats) =>
    set({
      area: world.area,
      position: { x: world.x, y: world.y },
      resumeSpawn: world.spawn ?? "default",
      nodeRespawns: { ...world.nodeRespawns },
      progress: structuredClone(progress),
      stats: { ...stats },
      pendingTravel: null,
    }),
}));
