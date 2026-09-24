import { create } from "zustand";
import { MINUTES_PER_DAY, START_MINUTE, wakeTime } from "../game/time/clock";
import type { TimeSaveState } from "../game/save/schema";

/**
 * The world clock — the single source of truth for day and time. The engine
 * advances it (whole minutes only, so React re-renders about once a second);
 * everything else reads it or uses the helpers in `game/time/clock.ts`.
 */
interface TimeState {
  day: number;
  /** Minute of the day, 0..1439. */
  minute: number;
  /** Day on which the player is Well Rested (slept in a good bed). */
  restedDay: number | null;

  advance: (minutes: number) => void;
  set: (day: number, minute: number) => void;
  /** Skip to the next morning. Returns the new day. */
  sleep: (wellRested: boolean) => number;
  loadFrom: (save: TimeSaveState) => void;
  serialize: () => TimeSaveState;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  day: 1,
  minute: START_MINUTE,
  restedDay: null,

  advance: (minutes) => {
    if (minutes <= 0) return;
    const s = get();
    let minute = s.minute + minutes;
    let day = s.day;
    while (minute >= MINUTES_PER_DAY) {
      minute -= MINUTES_PER_DAY;
      day++;
    }
    set({ day, minute });
  },

  set: (day, minute) => set({ day: Math.max(1, day), minute: ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY }),

  sleep: (wellRested) => {
    const s = get();
    const next = wakeTime(s.day, s.minute);
    set({ day: next.day, minute: next.minute, restedDay: wellRested ? next.day : null });
    return next.day;
  },

  loadFrom: (save) => set({ day: save.day, minute: save.minute, restedDay: save.restedDay ?? null }),
  serialize: () => {
    const s = get();
    return { day: s.day, minute: Math.floor(s.minute), restedDay: s.restedDay };
  },
}));

export function isWellRested(): boolean {
  const s = useTimeStore.getState();
  return s.restedDay === s.day;
}
