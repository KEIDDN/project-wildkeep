import { useUiStore } from "../store/uiStore";
import { repairables } from "./systems/durability";
import { getNpc, npcPresent, type NpcDef } from "../data/npcs";
import { isNight } from "./time/clock";
import { useTimeStore } from "../store/timeStore";
import { useSocialStore } from "../store/socialStore";
import { useWorldStore } from "../store/worldStore";
import type { Dialogue } from "../store/uiStore";
import { gameEvents } from "./events";
import { interpolate, t, tl } from "../i18n";
import { npcBarks, npcLines, npcName, npcTalk } from "../i18n/content";
import { questDialogue } from "./quests";
import { afterChange } from "./relationships";
import { rumorLine } from "./social/rumors";
import { bountyDialogue, finnFences, returnStolenDialogue } from "./social/reputation";

/**
 * What NPCs say. In priority order a conversation can be about:
 *   1. where they've been (back from a mysterious absence)
 *   2. today's world event
 *   3. gossip — what the village knows you've done
 *   4. your Honor (heroes and menaces get different treatment)
 *   5. their usual rotating lines (night lines after dark)
 * Talking also grows friendship once a day (the relationship foundation).
 */

/** How many times each NPC has been talked to this session (rotation). */
const talkCounts = new Map<string, number>();
/** Situational lines already heard this session (so they don't repeat). */
const heard = new Set<string>();

/** Mysterious absences: some NPCs vanish for a few days now and then. */
export function isAway(def: NpcDef, day: number): boolean {
  const a = def.awayEvery;
  return !!a && a.days.includes(day % a.period);
}

/** Around right now (hours + absences)? */
export function npcAvailable(def: NpcDef): boolean {
  const { minute, day } = useTimeStore.getState();
  return npcPresent(def, minute) && !isAway(def, day);
}

/** Values the lines can mention ({deaths}, {lost}…). */
function lineParams(): Record<string, string | number> {
  const w = useWorldStore.getState();
  const s = useSocialStore.getState();
  return {
    player: t("common.stranger"),
    deaths: w.stats.deaths,
    lost: w.stats.goldLostGambling,
    won: w.stats.goldWonGambling,
    stolen: s.deeds.stolen,
    floor: w.progress.dungeonDeepest,
  };
}

function situational(def: NpcDef): { key: string; lines: readonly string[] } | null {
  const { day } = useTimeStore.getState();
  const social = useSocialStore.getState();
  const world = useWorldStore.getState();
  const tryKey = (key: string, chance = 1) => {
    const once = `${def.id}:${key}:${day}`;
    if (heard.has(once) || Math.random() > chance) return null;
    const lines = npcLines(def, key);
    if (!lines?.length) return null;
    heard.add(once);
    return { key, lines };
  };
  // Back from wherever they went.
  if (def.awayEvery && isAway(def, day - 1) && !isAway(def, day)) {
    const r = tryKey("returned");
    if (r) return r;
  }
  if (social.event.day === day && social.event.id) {
    const r = tryKey(`event:${social.event.id}`);
    if (r) return r;
  }
  const notorious = world.stats.deaths > 0 || world.stats.goldLostGambling >= 60 || social.deeds.stolen > 0;
  if (notorious) {
    const r = tryKey("gossip", 0.4);
    if (r) return r;
  }
  // You've had a few, and it shows.
  if (social.drunk >= 50 && Math.random() < 0.5) {
    const own = npcLines(def, "drunk");
    const lines = own?.length ? own : tl("drunk.react");
    return { key: "drunk", lines: [lines[Math.floor(Math.random() * lines.length)]] };
  }
  // Friends talk to you like friends.
  const f = social.relationships[def.id]?.friendship ?? 0;
  if (f >= 40 && Math.random() < 0.35) {
    const own = npcLines(def, f >= 80 ? "close" : "friend");
    const lines = own?.length ? own : tl(f >= 80 ? "gift.closeLines" : "gift.friendLines");
    return { key: "friend", lines: [lines[Math.floor(Math.random() * lines.length)]] };
  }
  if (social.honor >= 50) return tryKey("honorHigh", 0.6);
  if (social.honor <= -30) return tryKey("honorLow", 0.7);
  return null;
}

/** A plain line from someone (their usual rotation). */
function npcDialogueBase(def: NpcDef): Dialogue {
  const sets = npcTalk(def, isNight(useTimeStore.getState().minute));
  const n = talkCounts.get(def.id) ?? 0;
  talkCounts.set(def.id, n + 1);
  return { speaker: npcName(def), portrait: def.portrait, lines: [...sets[n % sets.length]].map((l) => interpolate(l, lineParams())) };
}

/** The next thing an NPC says when you talk to them. */
export function dialogueFor(def: NpcDef): Dialogue {
  const { day, minute } = useTimeStore.getState();
  const before = useSocialStore.getState().relationships[def.id]?.friendship ?? 0;
  if (useSocialStore.getState().talkedTo(def.id, day)) {
    gameEvents.emit("npcTalked", { npcId: def.id });
    afterChange(def.id, before, before + 2);
  }
  // Quests come first: offers, hand-ins, conversations a quest sent you to.
  const quest = questDialogue(def.id);
  if (quest) return quest.choices ? quest : { ...quest, next: def.next?.panel, nextData: def.next?.data };
  // Carrying stolen goods to an honest person: own up, or don't.
  const returned = returnStolenDialogue(def.id);
  if (returned && Math.random() < 0.7) return returned;
  // Bryn, when there's a bounty.
  if (def.id === "bryn") {
    const stop = bountyDialogue();
    if (stop) return stop;
  }
  // Bram mends worn gear (and still forges when you'd rather).
  if (def.id === "bram" && repairables().length) {
    const base = npcDialogueBase(def);
    return {
      ...base,
      lines: [...base.lines, t("durability.bramNotices")],
      choices: [
        { label: t("durability.askRepair"), tone: "good", onChoose: () => useUiStore.getState().openPanel("repair") },
        { label: t("durability.askForge"), onChoose: () => useUiStore.getState().openPanel("crafting", { station: "forge" }) },
        { label: t("durability.askNothing"), onChoose: () => undefined },
      ],
    };
  }
  // Finn fences for people the underworld trusts.
  if (def.id === "finn" && finnFences()) return { ...npcDialogueBase(def), next: "shop", nextData: { stock: "fence" } };
  const special = situational(def);
  let lines: readonly string[];
  if (special) lines = special.lines;
  else {
    const sets = npcTalk(def, isNight(minute));
    const n = talkCounts.get(def.id) ?? 0;
    talkCounts.set(def.id, n + 1);
    lines = sets[n % sets.length];
  }
  const params = lineParams();
  // They've heard what you've been up to, and they'd like you to know it.
  const rumor = Math.random() < 0.6 ? rumorLine(def.id) : null;
  if (rumor) lines = [rumor, ...lines];
  return {
    speaker: npcName(def),
    portrait: def.portrait,
    lines: lines.map((l) => interpolate(l, params)),
    next: def.next?.panel,
    nextData: def.next?.data,
  };
}

export function talkTo(id: string): Dialogue {
  return dialogueFor(getNpc(id));
}

/** A random bark (ambient one-liner) in the current language. */
export function randomBark(def: NpcDef): string | null {
  const barks = npcBarks(def);
  if (!barks.length) return null;
  return interpolate(barks[Math.floor(Math.random() * barks.length)], lineParams());
}

/** What an NPC says when you hit them. */
export function hitLine(def: NpcDef): string {
  const own = npcLines(def, "hit");
  if (own?.length) return own[Math.floor(Math.random() * own.length)];
  const generic = [t("npc.ow1"), t("npc.ow2"), t("npc.ow3")];
  return generic[Math.floor(Math.random() * generic.length)];
}

/** What a witness shouts when they catch you stealing. */
export function caughtLine(): string {
  const lines = [t("npc.caught1"), t("npc.caught2"), t("npc.caught3")];
  return lines[Math.floor(Math.random() * lines.length)];
}
