import { usePlayerStore } from "../../store/playerStore";
import { useUiStore } from "../../store/uiStore";
import { rank } from "../../data/talents";
import { currentHouseLevel } from "./playerStats";
import { useTimeStore } from "../../store/timeStore";
import { t } from "../../i18n";
import { showTutorial } from "../tutorial";

/**
 * Energy: the day's budget for hard work (chopping, mining, digging,
 * watering, fishing, delving). Stamina is the next ten seconds; energy is
 * today. Running around town costs none, so a day spent socialising or
 * gambling is always possible.
 *
 * At zero you're exhausted, not stopped: work is slow and clumsy and
 * stamina recovers at half speed until you eat or sleep. Pacing, not a wall.
 */
export const ENERGY_COST = {
  chop: 2,
  mine: 2,
  gather: 1,
  till: 2,
  water: 1,
  plant: 0.5,
  harvest: 0.5,
  fish: 3,
  dig: 2,
  /** Each new floor of the Depths or the mine. */
  delve: 4,
  skin: 1,
} as const;

export type EnergyUse = keyof typeof ENERGY_COST;

/** Maximum energy: grows a little with level, a talent, and a better home. */
export function maxEnergy(): number {
  const p = usePlayerStore.getState();
  const house = currentHouseLevel();
  return 100 + Math.min(40, (p.level - 1) * 2) + rank(p.talents, "early_riser") * 15 + (house >= 3 ? 10 : 0) + (house >= 4 ? 10 : 0);
}

export function energy(): number {
  return usePlayerStore.getState().energy;
}

export const isExhausted = () => energy() <= 0;

let warnedLow = -1;
let warnedOut = -1;

/**
 * Spends energy for a piece of work. Never refuses: returns whether you had
 * the energy (callers make exhausted work weaker).
 */
export function spendEnergy(use: EnergyUse, mult = 1): boolean {
  const p = usePlayerStore.getState();
  const cost = ENERGY_COST[use] * mult * (1 - rank(p.talents, "stout_heart") * 0.15);
  const had = p.energy > 0;
  const next = Math.max(0, p.energy - cost);
  p.setEnergy(next);
  const max = maxEnergy();
  const day = useTimeStore.getState().day;
  if (next < max * 0.85) showTutorial("energy");
  if (next <= 0 && had && warnedOut !== day) {
    warnedOut = day;
    useUiStore.getState().pushToast(t("energy.exhausted"), "warning", { icon: "sleep" });
  } else if (next < max * 0.2 && p.energy >= max * 0.2 && warnedLow !== day) {
    warnedLow = day;
    useUiStore.getState().pushToast(t("energy.low"), "info", { icon: "sleep" });
  }
  return had;
}

/** Food and drink give some back. */
export function restoreEnergy(n: number): number {
  const p = usePlayerStore.getState();
  const max = maxEnergy();
  const next = Math.min(max, p.energy + n);
  p.setEnergy(next);
  return next - p.energy;
}

/** A night's sleep. `fraction` < 1 for passing out or sleeping rough. */
export function refillEnergy(fraction = 1): void {
  usePlayerStore.getState().setEnergy(Math.round(maxEnergy() * fraction));
}
