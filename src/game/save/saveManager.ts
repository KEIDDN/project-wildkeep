import { SAVE_KEY, SAVE_VERSION } from "../core/constants";
import { DEFAULT_SAVE, type SaveData } from "./schema";

/**
 * Thin persistence abstraction. Swapping localStorage for IndexedDB later
 * only requires changing the bodies of these three functions.
 */
export const persistence = {
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      return migrate(parsed);
    } catch (err) {
      console.warn("Failed to load save data", err);
      return null;
    }
  },

  save(data: SaveData): void {
    try {
      const toSave: SaveData = { ...data, savedAt: Date.now() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn("Failed to save game", err);
    }
  },

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  },
};

function migrate(data: SaveData): SaveData {
  if (data.version === SAVE_VERSION) return data;
  // Future migrations go here, keyed off data.version.
  return { ...DEFAULT_SAVE, ...data, version: SAVE_VERSION };
}
