import { create } from "zustand";

interface TownState {
  buildingLevels: Record<string, number>;
  upgradeBuilding: (id: string) => void;
  loadFrom: (levels: Record<string, number>) => void;
}

export const useTownStore = create<TownState>((set) => ({
  buildingLevels: {},
  upgradeBuilding: (id) =>
    set((state) => ({
      buildingLevels: {
        ...state.buildingLevels,
        [id]: (state.buildingLevels[id] ?? 1) + 1,
      },
    })),
  loadFrom: (levels) => set({ buildingLevels: { ...levels } }),
}));
