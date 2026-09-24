import type { AreaId } from "./core/types";

/**
 * Tiny typed event bus for "something happened in the world" notifications.
 * Gameplay code emits; listeners (tutorial, achievements, quests later) react
 * — without the systems importing each other.
 */
export interface GameEventMap {
  moved: { distance: number };
  areaEntered: { area: AreaId };
  panelOpened: { panel: string };
  panelClosed: { panel: string };
  resourceGathered: { nodeId: string; skill: string };
  itemSold: { itemId: string; quantity: number; gold: number };
  itemBought: { itemId: string };
  enemyKilled: { enemyId: string; boss: boolean };
  pickupCollected: { itemId: string; gold: boolean };
  crafted: { recipeId: string; itemId: string };
  slept: { day: number };
  gambled: { game: string; stake: number; net: number };
  houseUpgraded: { level: number };
  animalHunted: { animalId: string };
  stole: { itemId: string; noticed: boolean };
  npcTalked: { npcId: string };
  /** Pressed E on something. */
  interacted: { what: string };
  questAccepted: { questId: string };
  questCompleted: { questId: string };
  /** Picked a crop. */
  harvested: { cropId: string; quantity: number };
  planted: { cropId: string };
  tilled: { key: string };
  fished: { fishId: string };
  repaired: { itemId: string };
  /** Had a drink (tavern). */
  drank: { drink: string };
  /** Put a piece of gear on. */
  equipped: { slot: string; itemId: string };
}

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

const handlers = new Map<keyof GameEventMap, Set<Handler<never>>>();

export const gameEvents = {
  on<K extends keyof GameEventMap>(type: K, fn: Handler<K>): () => void {
    let set = handlers.get(type);
    if (!set) handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  },

  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
    const set = handlers.get(type);
    if (!set) return;
    // Snapshot: a listener may subscribe or unsubscribe others while running.
    for (const fn of Array.from(set)) {
      // A broken listener must never take the game loop down with it.
      try {
        (fn as Handler<K>)(payload);
      } catch (err) {
        console.error(`Error in "${type}" listener`, err);
      }
    }
  },
};
