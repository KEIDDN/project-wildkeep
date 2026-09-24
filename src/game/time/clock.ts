/**
 * Game-time rules, independent of rendering and React. Everything that
 * cares about the time of day (lighting, music, sleep, future NPC schedules,
 * shop hours, events…) asks these helpers instead of doing its own maths.
 *
 * Time is stored as `day` (1-based) + `minute` of the day (0..1439).
 */

export const MINUTES_PER_DAY = 24 * 60;
/** Game minutes that pass per real second: a full day takes 20 real minutes. */
export const GAME_MINUTES_PER_SECOND = 1.2;
/** When a new game starts and when you wake up. */
export const START_MINUTE = 8 * 60;
export const WAKE_MINUTE = 6 * 60;

export type TimeOfDay = "morning" | "day" | "evening" | "night";

export function hourOf(minute: number): number {
  return Math.floor(minute / 60) % 24;
}

export function timeOfDay(minute: number): TimeOfDay {
  const h = minute / 60;
  if (h >= 5 && h < 9) return "morning";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

/** Night for music/NPC purposes: slightly later/earlier than the light fully
 * fades so the night theme lands once it actually looks dark. */
export function isNight(minute: number): boolean {
  return minute >= 20 * 60 + 30 || minute < 5 * 60;
}

export function formatClock(minute: number): string {
  const h = hourOf(minute);
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Outdoor light colour (a multiply tint, 1 = untouched daylight) through the
 * day. Keyframes are in hours; values are interpolated so every transition
 * is gradual. Night is properly dark and blue (lamps, windows and your
 * lantern carry it), but never black.
 */
const DAYLIGHT: [number, [number, number, number]][] = [
  [0, [0.22, 0.27, 0.48]],
  [4.5, [0.22, 0.27, 0.48]],
  [6, [0.72, 0.6, 0.68]], // dawn: rosy
  [7.5, [1, 0.97, 0.93]],
  [9, [1, 1, 1]],
  [16.5, [1, 1, 1]],
  [18.5, [1, 0.82, 0.62]], // golden hour
  [20, [0.58, 0.48, 0.64]], // dusk: violet
  [21.5, [0.24, 0.29, 0.5]],
  [24, [0.22, 0.27, 0.48]],
];

export function daylight(minute: number): [number, number, number] {
  const h = (minute / 60) % 24;
  for (let i = 0; i < DAYLIGHT.length - 1; i++) {
    const [h0, c0] = DAYLIGHT[i];
    const [h1, c1] = DAYLIGHT[i + 1];
    if (h >= h0 && h <= h1) {
      const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
      // Smoothstep so transitions ease in and out.
      const k = t * t * (3 - 2 * t);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return [1, 1, 1];
}

/** Where sleeping takes you: the next 6:00 (same day if it's past midnight). */
export function wakeTime(day: number, minute: number): { day: number; minute: number } {
  return minute < WAKE_MINUTE ? { day, minute: WAKE_MINUTE } : { day: day + 1, minute: WAKE_MINUTE };
}
