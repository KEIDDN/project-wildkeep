import { CROP_BY_ID, CROP_BY_SEED, CROPS, type CropDef } from "../data/crops";
import { useFarmStore, type Plot } from "../store/farmStore";
import { useTimeStore } from "../store/timeStore";
import { usePlayerStore } from "../store/playerStore";
import { useInventoryStore } from "../store/inventoryStore";
import { useWorldStore } from "../store/worldStore";
import { useTownStore } from "../store/townStore";
import { bonusHarvestChance, cropGrowthMult } from "../data/talents";
import { eventActive } from "./social/worldEvents";
import { gameEvents } from "./events";
import { awardSkillXp, grantXp } from "./actions";
import { spendEnergy } from "./systems/vitals";
import { wearTool } from "./systems/durability";
import { bestTool } from "./systems/toolSystem";
import { CAN_SIZE } from "../store/farmStore";

/**
 * The farming loop: plant → water → (time passes) → harvest → sell / cook /
 * hand in. Plots only grow on days they've been watered (storms water them
 * for you), measured in in-game minutes, so sleeping on a watered field is
 * the classic "come back tomorrow" satisfaction.
 *
 * The patch is the fenced garden across the street from your cottage. Hob
 * turns the soil (quest "hob_seeds"); every house upgrade adds a row.
 */

export const FARM_FLAG = "farm_unlocked";

/** Plot tiles, in the order they unlock (8 per house level). */
const LAYOUT: [number, number][][] = [
  [4, 5, 6, 7].flatMap((x) => [22, 23].map((y) => [x, y] as [number, number])),
  [9, 10, 11, 12].flatMap((x) => [22, 23].map((y) => [x, y] as [number, number])),
  [4, 5, 6, 7].flatMap((x) => [25, 26].map((y) => [x, y] as [number, number])),
  [9, 10, 11, 12].flatMap((x) => [25, 26].map((y) => [x, y] as [number, number])),
];

export const ALL_PLOT_TILES = LAYOUT.flat();

export function farmUnlocked(): boolean {
  return !!useWorldStore.getState().progress.flags[FARM_FLAG];
}

/** Plot tiles you can use right now (more with every house level). */
export function openPlots(): [number, number][] {
  if (!farmUnlocked()) return [];
  const level = useTownStore.getState().buildingLevels.house ?? 1;
  return LAYOUT.slice(0, Math.max(1, Math.min(LAYOUT.length, level))).flat();
}

export const plotKey = (tx: number, ty: number) => `${tx},${ty}`;

const EMPTY: Plot = { crop: null, growth: 0, watered: 0 };

/** Tilled soil (a planted plot is always tilled). */
export const isTilled = (p: Plot) => !!p.tilled || !!p.crop;

export const hasHoe = () => ownsTool("hoe");
export const hasCan = () => ownsTool("can");
export const canWater = () => useFarmStore.getState().can;

function ownsTool(kind: "hoe" | "can"): boolean {
  const p = usePlayerStore.getState();
  return !!bestTool(kind, p.equipment, useInventoryStore.getState().stacks);
}

/** Turns a plot with the hoe. Sometimes a worm turns up (bait). */
export function till(key: string): { worm: boolean } | null {
  const p = plotAt(key);
  if (isTilled(p) || !hasHoe()) return null;
  useFarmStore.getState().setPlot(key, { ...p, tilled: true });
  const tool = bestTool("hoe", usePlayerStore.getState().equipment, useInventoryStore.getState().stacks);
  if (tool) wearTool(tool.id, 0.5);
  spendEnergy("till");
  awardSkillXp("gathering", 1);
  const worm = Math.random() < 0.22;
  if (worm) useInventoryStore.getState().addItem("bait", 1);
  gameEvents.emit("tilled", { key });
  return { worm };
}

/** Fills the watering can to the brim. */
export function refillCan(): boolean {
  if (!hasCan() || canWater() >= CAN_SIZE) return false;
  useFarmStore.getState().setCan(CAN_SIZE);
  return true;
}

export function plotAt(key: string): Plot {
  return useFarmStore.getState().plots[key] ?? EMPTY;
}

export function cropOf(p: Plot): CropDef | null {
  return p.crop ? (CROP_BY_ID[p.crop] ?? null) : null;
}

/** 0..1 how grown the plant is. */
export function growthOf(p: Plot): number {
  const c = cropOf(p);
  return c ? Math.min(1, p.growth / (c.hours * 60)) : 0;
}

export const isRipe = (p: Plot) => !!p.crop && growthOf(p) >= 1;
export const wateredToday = (p: Plot) => p.watered === useTimeStore.getState().day || eventActive("storm");

/** Growth stage for drawing: 0 seed, 1 sprout, 2 leafy, 3 budding, 4 ripe. */
export function stageOf(p: Plot): number {
  if (!p.crop) return -1;
  const g = growthOf(p);
  return g >= 1 ? 4 : g >= 0.66 ? 3 : g >= 0.33 ? 2 : g > 0.04 ? 1 : 0;
}

/** Hours of watered time left until ripe. */
export function hoursLeft(p: Plot): number {
  const c = cropOf(p);
  return c ? Math.max(0, Math.ceil((c.hours * 60 - p.growth) / 60 / cropGrowthMult(usePlayerStore.getState().talents))) : 0;
}

/** Seeds in the bag, in crop order. */
export function seedsOwned(): string[] {
  const inv = useInventoryStore.getState();
  return CROPS.map((c) => c.seed).filter((s) => inv.hasItem(s));
}

let lastSeed: string | null = null;
/** Choose which seed the next planting uses (inventory "Plant this"). */
export function selectSeed(seed: string): boolean {
  if (!CROP_BY_SEED[seed] || !useInventoryStore.getState().hasItem(seed)) return false;
  lastSeed = seed;
  return true;
}

export const lastSeedUsed = () => (lastSeed && useInventoryStore.getState().hasItem(lastSeed) ? lastSeed : (seedsOwned()[0] ?? null));

export function plant(key: string, seed: string): boolean {
  const crop = CROP_BY_SEED[seed];
  if (!crop || plotAt(key).crop || !isTilled(plotAt(key)) || !useInventoryStore.getState().removeItem(seed, 1)) return false;
  lastSeed = seed;
  const prev = plotAt(key);
  useFarmStore.getState().setPlot(key, { crop: crop.id, growth: 0, watered: prev.watered, tilled: true });
  spendEnergy("plant");
  awardSkillXp("gathering", 1);
  gameEvents.emit("planted", { cropId: crop.id });
  return true;
}

/** Watering soaks the plot and its neighbours (one use of the can). Returns how many got water. */
export function water(tx: number, ty: number): number {
  if (!hasCan() || canWater() <= 0) return 0;
  const day = useTimeStore.getState().day;
  const open = new Set(openPlots().map(([x, y]) => plotKey(x, y)));
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const k = plotKey(tx + dx, ty + dy);
      if (!open.has(k)) continue;
      const p = plotAt(k);
      if (p.watered === day) continue;
      useFarmStore.getState().setPlot(k, { ...p, watered: day });
      n++;
    }
  if (n > 0) {
    useFarmStore.getState().setCan(canWater() - 1);
    spendEnergy("water");
  }
  return n;
}

/** Picks a ripe plant. Returns what came off it. */
export function harvest(key: string): { itemId: string; quantity: number } | null {
  const p = plotAt(key);
  const c = cropOf(p);
  if (!c || !isRipe(p)) return null;
  const talents = usePlayerStore.getState().talents;
  let q = c.yield[0] + Math.floor(Math.random() * (c.yield[1] - c.yield[0] + 1));
  if (Math.random() < bonusHarvestChance(talents)) q++;
  useInventoryStore.getState().addItem(c.item, q);
  // Fruiting plants stay and set fruit again; the rest leave bare soil.
  useFarmStore.getState().setPlot(key, c.regrow ? { ...p, growth: (c.hours - c.regrow) * 60 } : { crop: null, growth: 0, watered: p.watered, tilled: true });
  spendEnergy("harvest");
  awardSkillXp("gathering", 3 + Math.round(c.hours / 10));
  grantXp(2 + Math.round(c.hours / 12));
  gameEvents.emit("harvested", { cropId: c.id, quantity: q });
  return { itemId: c.item, quantity: q };
}

// ---- time: growing ----------------------------------------------------------------------

let last: { day: number; minute: number } | null = null;
let wired = false;

/** Crops grow as the clock runs (and overnight while you sleep). */
export function initFarming(): void {
  if (wired) return;
  wired = true;
  useTimeStore.subscribe((s) => {
    const prev = last;
    last = { day: s.day, minute: s.minute };
    if (!prev) return;
    const delta = (s.day - prev.day) * 1440 + (s.minute - prev.minute);
    // Loading a save (or anything odd) jumps the clock: don't count it.
    if (delta <= 0 || delta > 1500) return;
    const mult = cropGrowthMult(usePlayerStore.getState().talents);
    const storm = eventActive("storm");
    useFarmStore.getState().grow((p) => (p.watered === prev.day || storm ? delta * mult : 0));
  });
}

/** After loading a save: start counting from the loaded time. */
export function resetFarmClock(): void {
  const s = useTimeStore.getState();
  last = { day: s.day, minute: s.minute };
}
