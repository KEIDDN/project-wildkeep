import { useSocialStore } from "../../store/socialStore";
import { useTimeStore } from "../../store/timeStore";
import { tl, interpolate, type TListKey } from "../../i18n";
import { gameEvents } from "../events";
import { FISH } from "../fishing";
import { enemyName, itemName } from "../../i18n/content";
import { getEnemy } from "../../data/enemies";

/**
 * The town talks. Notable things you do (a big night at the tables, a
 * golden carp, getting caught with your hand in the tip jar, passing out on
 * the tavern floor) become rumours for a few days, and people bring them up:
 * in passing (barks) and when you talk to them. Whoever was involved has
 * their own take (Silas on your luck, Greta on your drinking).
 *
 * Small on purpose: a capped list of recent deeds, no simulation. It's what
 * makes the village feel like it noticed.
 */
export type RumorKind =
  | "bigWin"
  | "bigLoss"
  | "caughtStealing"
  | "passedOut"
  | "rareFish"
  | "bossKill"
  | "deepDive"
  | "bigHarvest"
  | "roundBought"
  | "hitNpc"
  | "firepepper";

export interface Rumor {
  kind: RumorKind;
  day: number;
  /** Template params ({n}, {item}, {enemy}, {floor}, {name}). */
  p?: Record<string, string | number>;
  /** NPC with a personal stake in it (their own lines). */
  about?: string;
}

/** Rumours fade after a few days. */
const FRESH_DAYS = 3;
const MAX = 10;

/** The town heard about something. Replaces an older rumour of the same kind. */
export function recordRumor(kind: RumorKind, p?: Rumor["p"], about?: string): void {
  const day = useTimeStore.getState().day;
  const s = useSocialStore.getState();
  const rest = ((s.rumors ?? []) as Rumor[]).filter((r) => r.kind !== kind);
  s.setRumors([{ kind, day, p, about }, ...rest].slice(0, MAX));
}

export function freshRumors(): Rumor[] {
  const day = useTimeStore.getState().day;
  return ((useSocialStore.getState().rumors ?? []) as Rumor[]).filter((r) => day - r.day <= FRESH_DAYS);
}

// Who has already brought up what (so nobody repeats themselves all day).
const told = new Set<string>();
let toldDay = -1;

/**
 * Something `npcId` might say about what you've been up to, or null. Their
 * own stake in a rumour comes first; otherwise the freshest one they
 * haven't mentioned yet.
 */
export function rumorLine(npcId: string): string | null {
  const day = useTimeStore.getState().day;
  if (day !== toldDay) {
    told.clear();
    toldDay = day;
  }
  const fresh = freshRumors().filter((r) => !told.has(`${npcId}:${r.kind}:${r.day}`));
  if (!fresh.length) return null;
  const own = fresh.find((r) => r.about === npcId);
  const r = own ?? fresh[0];
  const key = (own ? `rumors.own.${r.kind}` : `rumors.${r.kind}`) as TListKey;
  const lines = tl(key);
  if (!lines?.length) return null;
  told.add(`${npcId}:${r.kind}:${r.day}`);
  return interpolate(lines[Math.floor(Math.random() * lines.length)], localize(r.p ?? {}));
}

/** Item and enemy ids in params become names in the current language. */
function localize(p: Record<string, string | number>): Record<string, string | number> {
  const out: Record<string, string | number> = { ...p };
  if (typeof p.item === "string") out.item = itemName(p.item);
  if (typeof p.enemy === "string") out.enemy = enemyName(p.enemy, getEnemy(p.enemy).name);
  return out;
}

/** Hook the rumour mill up to what the game already announces. */
export function initRumors(): void {
  gameEvents.on("gambled", ({ game, net }) => {
    const about = game === "roulette" ? "vex" : "silas";
    if (net >= 100) recordRumor("bigWin", { n: net }, about);
    else if (net <= -80) recordRumor("bigLoss", { n: -net }, about);
  });
  gameEvents.on("stole", ({ noticed }) => {
    if (noticed) recordRumor("caughtStealing");
  });
  gameEvents.on("fished", ({ fishId }) => {
    if (FISH.find((f) => f.id === fishId)?.rare) recordRumor("rareFish", { item: fishId });
  });
  gameEvents.on("enemyKilled", ({ enemyId, boss }) => {
    if (boss) recordRumor("bossKill", { enemy: enemyId });
  });
  gameEvents.on("harvested", ({ cropId }) => {
    if (["pumpkin", "melon", "moonroot"].includes(cropId)) recordRumor("bigHarvest", { item: cropId }, "hob");
  });
  gameEvents.on("drank", ({ drink }) => {
    if (drink === "round") recordRumor("roundBought", undefined, "greta");
  });
}
