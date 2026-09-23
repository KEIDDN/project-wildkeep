import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useTownStore } from "../../store/townStore";
import { persistence } from "./saveManager";
import { DEFAULT_SAVE, type SaveData } from "./schema";
import { SAVE_VERSION } from "../core/constants";

let loadedProgress = { ...DEFAULT_SAVE.dungeonProgress };

export function saveGame(): void {
  const data: SaveData = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: usePlayerStore.getState().serialize(),
    inventory: useInventoryStore.getState().stacks,
    town: { buildingLevels: useTownStore.getState().buildingLevels },
    dungeonProgress: loadedProgress,
  };
  persistence.save(data);
}

export function loadGame(): void {
  const data = persistence.load() ?? DEFAULT_SAVE;
  usePlayerStore.getState().loadFrom(data.player);
  useInventoryStore.getState().loadFrom(data.inventory);
  useTownStore.getState().loadFrom(data.town.buildingLevels);
  loadedProgress = { ...data.dungeonProgress };
}

export function recordDungeonRunComplete(tier: number): void {
  loadedProgress = {
    highestTierCleared: Math.max(loadedProgress.highestTierCleared, tier),
    runsCompleted: loadedProgress.runsCompleted + 1,
  };
  saveGame();
}

export function getDungeonProgress() {
  return loadedProgress;
}

export function hasExistingSave(): boolean {
  return persistence.load() !== null;
}
