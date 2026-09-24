import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useTownStore } from "../../store/townStore";
import { useWorldStore } from "../../store/worldStore";
import { useTimeStore } from "../../store/timeStore";
import { useTutorialStore } from "../../store/tutorialStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useSocialStore } from "../../store/socialStore";
import { useQuestStore } from "../../store/questStore";
import { useFarmStore } from "../../store/farmStore";
import { resetFarmClock } from "../farming";
import { persistence, type SaveSlot } from "./saveManager";
import { DEFAULT_SAVE, type SaveData } from "./schema";
import { SAVE_VERSION } from "../core/constants";

/** Collects every persistent store into one SaveData blob. */
export function collectSave(): SaveData {
  const world = useWorldStore.getState();
  // Underground areas are regenerated per visit, so saves made there resume
  // at their entrance in the village.
  const surfaceSpawn = world.area === "dungeon" ? useDungeonStore.getState().surface : world.area === "mine" ? { area: "town" as const, spawn: "mine" } : null;
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: usePlayerStore.getState().serialize(),
    inventory: useInventoryStore.getState().stacks,
    world: {
      area: surfaceSpawn ? surfaceSpawn.area : world.area,
      x: surfaceSpawn ? -1 : world.position.x,
      y: surfaceSpawn ? -1 : world.position.y,
      spawn: surfaceSpawn && typeof surfaceSpawn.spawn === "string" ? surfaceSpawn.spawn : undefined,
      nodeRespawns: world.nodeRespawns,
    },
    town: { buildingLevels: useTownStore.getState().buildingLevels, stash: useTownStore.getState().stash },
    progress: world.progress,
    stats: world.stats,
    time: useTimeStore.getState().serialize(),
    tutorial: useTutorialStore.getState().serialize(),
    social: useSocialStore.getState().serialize(),
    quests: useQuestStore.getState().serialize(),
    farm: { plots: useFarmStore.getState().plots, can: useFarmStore.getState().can },
  };
}

/** The slot the current game saves to (null on the title screen). */
let activeSlot: SaveSlot | null = null;

export function currentSlot(): SaveSlot | null {
  return activeSlot;
}

export function saveGame(): void {
  if (activeSlot === null) return;
  persistence.save(activeSlot, collectSave());
}

/** Loads a slot (or a fresh game if it's empty) into every store and makes
 * it the active slot. */
export function loadGame(slot: SaveSlot): SaveData {
  const data = persistence.load(slot) ?? structuredClone(DEFAULT_SAVE);
  applySave(data);
  activeSlot = slot;
  return data;
}

/** A brand-new game in a slot (overwrites it). */
export function newGame(slot: SaveSlot): void {
  persistence.clear(slot);
  applySave(structuredClone(DEFAULT_SAVE));
  activeSlot = slot;
  saveGame();
}

/** Back to the title screen: stop saving to the slot. */
export function closeGame(): void {
  saveGame();
  activeSlot = null;
}

export function deleteSlot(slot: SaveSlot): void {
  persistence.clear(slot);
}

export function lastSavedAt(): number | null {
  return activeSlot === null ? null : (persistence.load(activeSlot)?.savedAt ?? null);
}

function applySave(data: SaveData) {
  usePlayerStore.getState().loadFrom(data.player);
  useInventoryStore.getState().loadFrom(data.inventory);
  useTownStore.getState().loadFrom(data.town);
  useWorldStore.getState().loadFrom(data.world, data.progress, data.stats);
  useTimeStore.getState().loadFrom(data.time);
  useTutorialStore.getState().loadFrom(data.tutorial);
  useSocialStore.getState().loadFrom(data.social);
  useQuestStore.getState().loadFrom(data.quests);
  useFarmStore.getState().loadFrom(data.farm);
  resetFarmClock();
  useDungeonStore.getState().reset();
}
