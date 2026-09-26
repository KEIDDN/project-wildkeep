import { useSocialStore } from "../../store/socialStore";
import { useTimeStore } from "../../store/timeStore";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useUiStore } from "../../store/uiStore";
import { gameEvents } from "../events";
import { adjustHonor } from "../social/honor";
import { adjustRep } from "../social/reputation";
import { changeFriendship } from "../relationships";
import { audio } from "../audio/AudioManager";
import { t, tl } from "../../i18n";

/**
 * A little too much at the Tipsy Wyvern. Tipsiness (0..100) rises with each
 * drink and wears off with time:
 *
 *   tipsy   25+  a warm glow and a lazy camera drift; luckier at the tables
 *   drunk   50+  your steps weave a little, you swing harder and guard
 *                worse, the dealer lets you bet bigger ("you feel invincible")
 *   wasted  80+  the odd small stumble (never in a fight), dodging tires you;
 *                at 100 you wake up at home with a story
 *
 * Tuned to read as "haha, I'm drunk", never "I can't play". Going to bed
 * drunk still means a hangover (Game.sleep).
 *
 * Fun, fictional, never punishing for long: it wears off in a few minutes.
 */
export type DrunkTier = "sober" | "tipsy" | "drunk" | "wasted";

export function drunkLevel(): number {
  return useSocialStore.getState().drunk;
}

export function drunkTier(level = drunkLevel()): DrunkTier {
  if (level >= 80) return "wasted";
  if (level >= 50) return "drunk";
  if (level >= 25) return "tipsy";
  return "sober";
}

export const DRINKS = {
  ale: { drunk: 14, heal: 15 },
  stout: { drunk: 26, heal: 30 },
  spirits: { drunk: 42, heal: 0 },
  round: { drunk: 10, heal: 0 },
} as const;

export type DrinkId = keyof typeof DRINKS;

/** Knock one back. Returns true if you passed out. */
export function drink(id: DrinkId): boolean {
  const s = useSocialStore.getState();
  const before = s.drunk;
  s.setDrunk(before + DRINKS[id].drunk);
  if (DRINKS[id].heal) usePlayerStore.getState().heal(DRINKS[id].heal);
  gameEvents.emit("drank", { drink: id });
  const tier = drunkTier();
  if (tier !== drunkTier(before)) useUiStore.getState().pushToast(t(`drunk.enter.${tier}`), tier === "sober" ? "info" : "warning", { icon: "beer" });
  return useSocialStore.getState().drunk >= 100;
}

/** Stew and sleep sober you up a bit. */
export function soberUp(amount: number): void {
  const s = useSocialStore.getState();
  s.setDrunk(s.drunk - amount);
}

let last: { day: number; minute: number } | null = null;
let wired = false;

/** It wears off as the clock runs (half a point per game minute). */
export function initDrink(): void {
  if (wired) return;
  wired = true;
  useTimeStore.subscribe((st) => {
    const prev = last;
    last = { day: st.day, minute: st.minute };
    if (!prev) return;
    const delta = (st.day - prev.day) * 1440 + (st.minute - prev.minute);
    if (delta <= 0 || delta > 1500) return;
    const s = useSocialStore.getState();
    if (s.drunk <= 0) return;
    const before = drunkTier(s.drunk);
    s.setDrunk(s.drunk - delta * 0.5);
    const after = drunkTier();
    if (after !== before && after === "sober") useUiStore.getState().pushToast(t("drunk.enter.sober"), "info", { icon: "beer" });
  });
}

// ---- stats and table effects ---------------------------------------------------------------

/** Extra "lucky push" chance at blackjack while merry. */
export const drunkLuck = (level = drunkLevel()) => (level >= 25 ? 0.03 : 0);
/** Table limits while drunk: you feel invincible. */
export const drunkLimitMult = (level = drunkLevel()) => (level >= 50 ? 1.5 : 1);
/** Dodging is harder with a few in you. */
export const drunkDodgeCost = (level = drunkLevel()) => (level >= 80 ? 1.4 : level >= 50 ? 1.2 : 1);

// ---- the morning after ---------------------------------------------------------------------

type Morning = { id: string; apply: () => void };

/** What happened last night. One of these, at random. */
const MORNINGS: Morning[] = [
  { id: "pigpen", apply: () => changeFriendship("hob", 3, true) },
  { id: "round", apply: () => (usePlayerStore.getState().loseGold(30), adjustRep("village", 3, true)) },
  { id: "goose", apply: () => useInventoryStore.getState().addItem("feather", 6) },
  { id: "face", apply: () => adjustHonor(-1) },
  { id: "bestfriend", apply: () => changeFriendship("barnaby", 12, true) },
  { id: "won", apply: () => usePlayerStore.getState().earnGold(45) },
  { id: "sock", apply: () => useInventoryStore.getState().addItem("old_sock", 1) },
  { id: "song", apply: () => (changeFriendship("lyra", 8, true), adjustRep("village", -1, true)) },
  { id: "bet", apply: () => usePlayerStore.getState().loseGold(20) },
  { id: "morg", apply: () => (changeFriendship("morg", 10, true), adjustRep("underworld", 3, true)) },
];

/** Pick last night's story and apply it. Returns the story text. */
export function morningAfter(): string {
  const m = MORNINGS[Math.floor(Math.random() * MORNINGS.length)];
  m.apply();
  useSocialStore.getState().setDrunk(0);
  audio.sfx("deny", { pitch: 0.6 });
  const lines = tl(`drunk.morning.${m.id}` as "drunk.morning.pigpen");
  return lines.join(" ");
}
