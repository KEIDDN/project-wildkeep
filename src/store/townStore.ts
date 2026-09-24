import { create } from "zustand";
import type { InventoryStack, TownSaveState } from "../game/save/schema";
import { addToStacks, removeFromStacks } from "./inventoryStore";

interface TownState {
  buildingLevels: Record<string, number>;
  /** The storage chest in the player's cottage. */
  stash: InventoryStack[];
  upgradeBuilding: (id: string) => void;
  setBuildingLevel: (id: string, level: number) => void;
  depositToStash: (itemId: string, quantity: number, stolen?: boolean) => void;
  withdrawFromStash: (itemId: string, quantity: number, stolen?: boolean) => boolean;
  loadFrom: (save: TownSaveState) => void;
}

export const useTownStore = create<TownState>((set, get) => ({
  buildingLevels: { house: 1 },
  stash: [],
  upgradeBuilding: (id) =>
    set((state) => ({
      buildingLevels: { ...state.buildingLevels, [id]: (state.buildingLevels[id] ?? 1) + 1 },
    })),
  setBuildingLevel: (id, level) => set((state) => ({ buildingLevels: { ...state.buildingLevels, [id]: level } })),
  depositToStash: (itemId, quantity, stolen = false) => set((state) => ({ stash: addToStacks(state.stash, itemId, quantity, stolen) })),
  withdrawFromStash: (itemId, quantity, stolen = false) => {
    const next = removeFromStacks(get().stash, itemId, quantity, stolen ? "stolen" : "clean");
    if (!next) return false;
    set({ stash: next });
    return true;
  },
  loadFrom: (save) => set({ buildingLevels: { ...save.buildingLevels }, stash: [...save.stash] }),
}));
