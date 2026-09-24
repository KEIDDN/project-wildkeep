import { create } from "zustand";
import type { FarmSaveState } from "../game/save/schema";

/** Waterings a full can holds. */
export const CAN_SIZE = 20;

export type Plot = FarmSaveState["plots"][string];

/** Garden plot state. Rules (growth, watering, harvest) live in game/farming.ts. */
interface FarmState extends FarmSaveState {
  can: number;
  setCan: (n: number) => void;
  setPlot: (key: string, plot: Plot) => void;
  /** Adds growth minutes to every plot the predicate accepts. */
  grow: (accept: (p: Plot) => number) => void;
  loadFrom: (save: FarmSaveState) => void;
}

export const useFarmStore = create<FarmState>((set) => ({
  plots: {},
  can: 20,
  setCan: (n) => set({ can: Math.max(0, Math.min(CAN_SIZE, n)) }),
  setPlot: (key, plot) => set((s) => ({ plots: { ...s.plots, [key]: plot } })),
  grow: (accept) =>
    set((s) => {
      let changed = false;
      const plots: Record<string, Plot> = {};
      for (const [k, p] of Object.entries(s.plots)) {
        const add = p.crop ? accept(p) : 0;
        if (add > 0) changed = true;
        plots[k] = add > 0 ? { ...p, growth: p.growth + add } : p;
      }
      return changed ? { plots } : {};
    }),
  loadFrom: (save) => set({ plots: structuredClone(save?.plots ?? {}), can: save?.can ?? CAN_SIZE }),
}));
