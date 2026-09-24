import { create } from "zustand";
import { newRunSeed } from "./dungeonStore";

/**
 * The current mine expedition. Every trip down from the village gets a new
 * seed, so the caves are different each time; permanent depth progress
 * (deepest floor, lift stops) lives in worldStore.progress.
 */
interface MineState {
  seed: string;
  floor: number;
  /** Start a new expedition at a floor (1 or a lift stop). */
  start: (floor: number, seed?: string) => void;
  descend: () => void;
}

export const useMineStore = create<MineState>((set) => ({
  seed: newRunSeed(),
  floor: 1,
  start: (floor, seed) => set({ floor: Math.max(1, floor), seed: seed ?? newRunSeed() }),
  descend: () => set((s) => ({ floor: s.floor + 1 })),
}));
