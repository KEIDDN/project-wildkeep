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
 * Fishing: cast, wait for the bite, strike in time, then play the fish.
 * Which fish depends on the rod, the hour (some only rise at night), luck
 * and the Angler talent. Pure rules; the engine side is Player's "fish"
 * state and the HUD's FishingMeter.
 *
 * The fight ("the tug"): hold interact to reel. Reeling raises the line's
 * tension and only lands the fish while tension sits in the green zone.
 * Every so often the fish runs (telegraphed): it hauls on the line, so
 * keep reeling through a run and it snaps. Leaning against the run (the
 * other direction key) halves the pull. Let the line go slack too long and
 * it slips the hook.
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
  /** How hard it hauls when it runs (0 = a sock). */
  pull: number;
  /** Average seconds between runs. */
  gap: number;
  /** Width of the green tension zone (out of 100). */
  zone: number;
}

export const FISH: FishDef[] = [
  { id: "fish_minnow", weight: 24, window: 0.75, pull: 0.35, gap: 3.4, zone: 46 },
  { id: "fish_perch", weight: 22, window: 0.7, pull: 0.45, gap: 3, zone: 42 },
  // Carp: slow, stubborn hauls.
  { id: "fish_carp", weight: 18, window: 0.7, pull: 0.62, gap: 2.8, zone: 40 },
  // Trout: quick little dashes, often.
  { id: "fish_trout", weight: 13, window: 0.6, pull: 0.5, gap: 1.9, zone: 36 },
  { id: "fish_salmon", weight: 8, window: 0.55, pull: 0.72, gap: 2, zone: 32 },
  { id: "fish_pike", weight: 5, rod: 2, rare: true, window: 0.5, pull: 0.92, gap: 1.8, zone: 28 },
  // Rainbow: jumpy, runs all the time but not hard.
  { id: "fish_rainbow", weight: 3.5, rare: true, window: 0.45, pull: 0.6, gap: 1.2, zone: 30 },
  { id: "fish_moon", weight: 3, night: true, rare: true, window: 0.45, pull: 0.8, gap: 1.6, zone: 28 },
  { id: "fish_golden", weight: 0.4, rod: 2, rare: true, window: 0.38, pull: 1, gap: 1.2, zone: 24 },
  // Not every tug is a fish.
  { id: "old_sock", weight: 3, window: 0.8, pull: 0, gap: 99, zone: 56 },
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

export interface FightTuning {
  /** Green zone, tension 0..100. */
  lo: number;
  hi: number;
  /** Tension added per second while a run is on (before leaning). */
  pull: number;
  /** Seconds between runs, on average. */
  gap: number;
  /** Progress per second while reeling in the zone. */
  reel: number;
  /** The rod is lighter than this fish wants. */
  underRodded: boolean;
}

/** How this fish fights on your current rod. A better rod widens the zone
 * and softens the runs; too light a rod makes it a real struggle (it used
 * to be a coin flip). */
export function fightTuning(f: FishDef): FightTuning {
  const tier = rodTier();
  const need = f.rod ?? 1;
  const under = need > tier;
  const spare = Math.max(0, tier - need);
  const zone = Math.max(16, f.zone + spare * 6 - (under ? 10 : 0));
  const mid = 56;
  return {
    lo: mid - zone / 2,
    hi: mid + zone / 2,
    pull: f.pull * 95 * (under ? 1.35 : 1) * Math.pow(0.85, spare),
    gap: f.gap,
    reel: 40 / (1 + f.pull * 0.9),
    underRodded: under,
  };
}

/** Line snapped or the fish slipped: the worm's gone either way. */
export function loseFish(): void {
  const inv = useInventoryStore.getState();
  if (inv.hasItem("bait")) inv.removeItem("bait", 1);
}

/** Landed it. */
export function landFish(f: FishDef): { itemId: string } {
  const inv = useInventoryStore.getState();
  if (inv.hasItem("bait")) inv.removeItem("bait", 1);
  const rod = bestTool("rod", usePlayerStore.getState().equipment, inv.stacks);
  if (rod) wearTool(rod.id, 1);
  inv.addItem(f.id, 1);
  awardSkillXp("gathering", f.rare ? 12 : 4);
  grantXp(f.rare ? 20 : 4);
  useWorldStore.getState().bumpStat("fishCaught");
  gameEvents.emit("fished", { fishId: f.id });
  return { itemId: f.id };
}
