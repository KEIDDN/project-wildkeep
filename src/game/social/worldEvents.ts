import { QUIET_DAY_CHANCE, WORLD_EVENTS, type WorldEventDef, type WorldEventId } from "../../data/worldEvents";
import { useSocialStore } from "../../store/socialStore";
import { useTimeStore } from "../../store/timeStore";
import { useUiStore } from "../../store/uiStore";
import { t, tDyn } from "../../i18n";
import { showTutorial } from "../tutorial";

/**
 * Rolls today's world event (once per day, stored in the save so reloading
 * doesn't reroll) and answers "is X happening today?" for the rest of the
 * game.
 */
export function todayEvent(): WorldEventDef | null {
  const { event } = useSocialStore.getState();
  const day = useTimeStore.getState().day;
  if (event.day !== day || !event.id) return null;
  return WORLD_EVENTS.find((e) => e.id === event.id) ?? null;
}

export function eventActive(id: WorldEventId): boolean {
  return todayEvent()?.id === id;
}

/** Called each morning (and when a save is loaded on a new day). Returns
 * the event if one was rolled just now. */
export function rollDailyEvent(rand: () => number = Math.random): WorldEventDef | null {
  const day = useTimeStore.getState().day;
  const social = useSocialStore.getState();
  if (social.event.day === day) return null;
  const options = WORLD_EVENTS.filter((e) => day >= e.minDay);
  // Never the same event two days running.
  const pool = options.filter((e) => e.id !== social.event.id);
  if (!pool.length || rand() < QUIET_DAY_CHANCE) {
    social.setEvent(day, null);
    return null;
  }
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = rand() * total;
  let pick = pool[pool.length - 1];
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) {
      pick = e;
      break;
    }
  }
  social.setEvent(day, pick.id);
  return pick;
}

/** Morning announcement for a freshly rolled event. */
export function announceEvent(e: WorldEventDef): void {
  useUiStore.getState().pushToast(`${tDyn(`worldEvent.${e.id}.title`)} — ${tDyn(`worldEvent.${e.id}.desc`)}`, "levelup", { icon: e.icon });
  showTutorial("events");
}

export function eventTitle(e: WorldEventDef): string {
  return tDyn(`worldEvent.${e.id}.title`) || t("events.none");
}
