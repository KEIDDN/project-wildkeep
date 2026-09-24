import { usePlayerStore } from "../store/playerStore";
import { useInventoryStore } from "../store/inventoryStore";
import { useTimeStore } from "../store/timeStore";
import { anglerBite, anglerRare } from "../data/talents";
import { bestTool } from "./systems/toolSystem";
import { spendEnergy } from "./systems/vitals";
import { wearTool } from "./systems/durability";
import { isNight } from "./time/clock";
import { awardSkillXp, grantXp } from "./actions";
import { gameEvents } from "./events";
import { useWorldStore } from "../store/worldStore";

/**
 * Fishing: cast, wait for the bite, strike in time. Which fish depends on
 * the rod, the hour (some only rise at night), luck and the Angler talent.
 * Pure rules; the engine side is Player's "fish" state.
 */
export interface FishDef {
  id: string;
  weight: number;
  /** Rod tier needed to land it (bigger fish break cheap rods). */
  rod?: number;
  night?: boolean;
  rare?: boolean;
  /** Seconds you have to strike (bigger fish = shorter). */
  window: number;
}

export const FISH: FishDef[] = [
  { id: "fish_minnow", weight: 24, window: 0.75 },
  { id: "fish_perch", weight: 22, window: 0.7 },
  { id: "fish_carp", weight: 18, window: 0.7 },
  { id: "fish_trout", weight: 13, window: 0.6 },
  { id: "fish_salmon", weight: 8, window: 0.55 },
  { id: "fish_pike", weight: 5, rod: 2, rare: true, window: 0.5 },
  { id: "fish_rainbow", weight: 3.5, rare: true, window: 0.45 },
  { id: "fish_moon", weight: 3, night: true, rare: true, window: 0.45 },
  { id: "fish_golden", weight: 0.4, rod: 2, rare: true, window: 0.38 },
  // Not every tug is a fish.
  { id: "old_sock", weight: 3, window: 0.8 },
];

export function rodTier(): number {
  const p = usePlayerStore.getState();
  return bestTool("rod", p.equipment, useInventoryStore.getState().stacks)?.toolPower ?? 0;
}

export const hasRod = () => rodTier() > 0;

/** Seconds until a fish bites (bait and Angler shorten it). */
export function biteDelay(): number {
  const bait = useInventoryStore.getState().hasItem("bait");
  const base = 2.2 + Math.random() * 4.5;
  return base * (bait ? 0.55 : 1) * anglerBite(usePlayerStore.getState().talents);
}

/** What's on the line this time. */
export function rollFish(): FishDef {
  const p = usePlayerStore.getState();
  const tier = rodTier();
  const night = isNight(useTimeStore.getState().minute);
  const rareMult = 1 + anglerRare(p.talents) + (tier >= 2 ? 0.5 : 0);
  const pool = FISH.filter((f) => !f.night || night).map((f) => ({ f, w: f.weight * (f.rare ? rareMult : 1) }));
  const total = pool.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.f;
  }
  return FISH[0];
}

/** Casting costs energy (and a worm, if you have one — used on the bite). */
export function castLine(): void {
  spendEnergy("fish");
}

/** You struck in time. Returns the catch, or null if the rod was too light for it. */
export function landFish(f: FishDef): { itemId: string; escaped: boolean } {
  const inv = useInventoryStore.getState();
  if (inv.hasItem("bait")) inv.removeItem("bait", 1);
  const rod = bestTool("rod", usePlayerStore.getState().equipment, inv.stacks);
  if (rod) wearTool(rod.id, 1);
  if ((f.rod ?? 1) > rodTier() && Math.random() < 0.7) return { itemId: f.id, escaped: true };
  inv.addItem(f.id, 1);
  awardSkillXp("gathering", f.rare ? 12 : 4);
  grantXp(f.rare ? 20 : 4);
  useWorldStore.getState().bumpStat("fishCaught");
  gameEvents.emit("fished", { fishId: f.id });
  return { itemId: f.id, escaped: false };
}
