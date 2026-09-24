import { BOARD_TEMPLATES, QUESTS, QUEST_BY_ID, type Objective, type QuestChoice, type QuestDef, type QuestReward, type QuestText } from "../data/quests";
import { getItem } from "../data/items";
import { getNpc, NPCS } from "../data/npcs";
import { useQuestStore } from "../store/questStore";
import { usePlayerStore } from "../store/playerStore";
import { useInventoryStore } from "../store/inventoryStore";
import { useWorldStore } from "../store/worldStore";
import { useDungeonStore } from "../store/dungeonStore";
import { useMineStore } from "../store/mineStore";
import { useTimeStore } from "../store/timeStore";
import { useSocialStore } from "../store/socialStore";
import { useUiStore, type Dialogue } from "../store/uiStore";
import { gameEvents } from "./events";
import { grantItems, grantXp } from "./actions";
import { adjustHonor } from "./social/honor";
import { changeFriendship } from "./relationships";
import { audio } from "./audio/AudioManager";
import { SeededRandom } from "./core/rng";
import type { AreaId } from "./core/types";
import { ES_QUESTS } from "../i18n/quests-es";
import { currentLanguage, interpolate, t } from "../i18n";
import { areaName, itemName, npcName } from "../i18n/content";

/**
 * The quest rules: who offers what, what counts as progress, what you get.
 * Everything is driven by the event bus (kills, hunts, thefts, bets…) and
 * by talking to people, so quests are pure data (data/quests.ts).
 *
 * Flow: offered (giver's dialogue: Accept / Not now) → stages, one
 * objective each → back to the giver → rewards. Talk stages can branch
 * (pay / threaten / gamble…); choices have consequences on the spot.
 */

// ---- definitions -------------------------------------------------------------------

/** A quest by id: hand-written, or a notice-board contract (built from its id). */
export function questDef(id: string): QuestDef | null {
  return QUEST_BY_ID[id] ?? parseBoard(id);
}

/** Localized text (board contracts are generated in the current language). */
export function questText(def: QuestDef): QuestText {
  const raw = def.kind === "board" || currentLanguage() === "en" ? def.text : (ES_QUESTS[def.id] ?? def.text);
  // Lines may mention keys ({k:cast}): fill them with the player's bindings.
  if (!JSON.stringify(raw).includes("{k:")) return raw;
  const fill = (lines: string[]) => lines.map((l) => interpolate(l));
  return { ...raw, offer: fill(raw.offer), stages: fill(raw.stages), remind: fill(raw.remind), complete: fill(raw.complete) };
}

function met(def: QuestDef): boolean {
  const r = def.requires;
  if (!r) return true;
  const done = useQuestStore.getState().done;
  if (r.level && usePlayerStore.getState().level < r.level) return false;
  if (r.quests?.some((q) => !done.includes(q))) return false;
  const flags = useWorldStore.getState().progress.flags;
  if (r.flags?.some((f) => !flags[f])) return false;
  return true;
}

export function isAvailable(def: QuestDef): boolean {
  const s = useQuestStore.getState();
  return !s.active[def.id] && !s.done.includes(def.id) && met(def);
}

const returnTo = (def: QuestDef) => def.returnTo ?? def.giver;

// ---- progress --------------------------------------------------------------------------

function countOf(item: string): number {
  return useInventoryStore.getState().quantityOf(item);
}

function stageDone(obj: Objective | undefined, count: number): boolean {
  if (!obj) return true;
  switch (obj.kind) {
    case "kill":
    case "hunt":
    case "steal":
    case "harvest":
    case "drink":
      return count >= obj.count;
    case "gamble":
      return count >= obj.win;
    case "boss":
    case "reach":
    case "craft":
      return count >= 1;
    case "gather":
      return obj.items.every((i) => countOf(i.item) >= i.count);
    case "find":
      return countOf(obj.item) >= 1;
    case "talk":
      return false;
  }
}

/** All objectives done: go back and hand it in. */
export function isReady(id: string): boolean {
  const def = questDef(id);
  const st = useQuestStore.getState().active[id];
  if (!def || !st) return false;
  if (st.stage >= def.stages.length) return true;
  const last = st.stage === def.stages.length - 1;
  const obj = def.stages[st.stage];
  return last && (obj.kind === "gather" || obj.kind === "find") && stageDone(obj, st.count);
}

/** "2/4", "1/3 Hide · 0/3 Raw Meat"… for the current stage (null when ready). */
export function progressLabel(id: string): string | null {
  const def = questDef(id);
  const st = useQuestStore.getState().active[id];
  if (!def || !st || isReady(id)) return null;
  const obj = def.stages[st.stage];
  if (!obj) return null;
  switch (obj.kind) {
    case "kill":
    case "hunt":
    case "steal":
    case "harvest":
    case "drink":
      return `${Math.min(st.count, obj.count)}/${obj.count}`;
    case "gamble":
      return t("quests.netWon", { n: Math.max(0, st.count), total: obj.win });
    case "gather":
      return obj.items.map((i) => `${Math.min(countOf(i.item), i.count)}/${i.count} ${itemName(i.item)}`).join(" · ");
    default:
      return null;
  }
}

/** What to do right now, in words (tracker + journal). */
export function objectiveText(id: string): string {
  const def = questDef(id);
  const st = useQuestStore.getState().active[id];
  if (!def || !st) return "";
  const text = questText(def);
  if (isReady(id)) {
    const who = returnTo(def);
    return who === "board" ? t("quests.returnBoard") : t("quests.returnTo", { name: npcName(getNpc(who)) });
  }
  return text.stages[Math.min(st.stage, text.stages.length - 1)] ?? "";
}

const announcedReady = new Set<string>();

/** Advances finished stages and announces "go back" once. */
function check(id: string) {
  const def = questDef(id);
  const store = useQuestStore.getState();
  const st = store.active[id];
  if (!def || !st) return;
  const obj = def.stages[st.stage];
  const last = st.stage === def.stages.length - 1;
  const handIn = obj && (obj.kind === "gather" || obj.kind === "find");
  if (obj && obj.kind !== "talk" && stageDone(obj, st.count) && !(last && handIn)) {
    store.nextStage(id);
    audio.sfx("levelup", { pitch: 1.3 });
    useUiStore.getState().pushToast(t("quests.objectiveDone", { title: questText(def).title }), "levelup", { icon: "journal" });
  }
  if (isReady(id)) {
    if (!announcedReady.has(id)) {
      announcedReady.add(id);
      useUiStore.getState().pushToast(`${questText(def).title}: ${objectiveText(id)}`, "info", { icon: "journal" });
    }
  } else announcedReady.delete(id);
}

function checkAll() {
  for (const id of Object.keys(useQuestStore.getState().active)) check(id);
}

/** Bumps every active quest whose current objective matches. */
function progress(match: (obj: Objective) => number | null) {
  const s = useQuestStore.getState();
  for (const [id, st] of Object.entries(s.active)) {
    const def = questDef(id);
    const obj = def?.stages[st.stage];
    if (!obj) continue;
    const n = match(obj);
    if (n === null) continue;
    if (obj.kind === "gamble") s.setCount(id, Math.max(0, st.count + n));
    else s.bump(id, n);
    check(id);
  }
}

let wired = false;

/** Hooks quest progress to the event bus (once per session). */
export function initQuests(): void {
  if (wired) return;
  wired = true;
  gameEvents.on("enemyKilled", ({ enemyId }) => {
    const area = useWorldStore.getState().area;
    progress((o) => (o.kind === "kill" && (!o.enemies || o.enemies.includes(enemyId)) && (!o.area || o.area === area) ? 1 : o.kind === "boss" && o.enemy === enemyId ? 1 : null));
  });
  gameEvents.on("animalHunted", ({ animalId }) => progress((o) => (o.kind === "hunt" && (!o.animals || o.animals.includes(animalId)) ? 1 : null)));
  gameEvents.on("stole", ({ noticed }) => progress((o) => (o.kind === "steal" && !noticed ? 1 : null)));
  gameEvents.on("gambled", ({ net }) => progress((o) => (o.kind === "gamble" ? net : null)));
  gameEvents.on("crafted", ({ itemId }) => progress((o) => (o.kind === "craft" && o.item === itemId ? 1 : null)));
  gameEvents.on("harvested", ({ cropId, quantity }) => progress((o) => (o.kind === "harvest" && (!o.crop || o.crop === cropId) ? quantity : null)));
  gameEvents.on("drank", () => progress((o) => (o.kind === "drink" ? 1 : null)));
  gameEvents.on("areaEntered", ({ area }) =>
    progress((o) => {
      if (o.kind !== "reach" || o.area !== area) return null;
      if (!o.floor) return 1;
      const floor = area === "dungeon" ? useDungeonStore.getState().floor : area === "mine" ? useMineStore.getState().floor : 0;
      return floor >= o.floor ? 1 : null;
    }),
  );
  // Gather / find objectives follow the bag.
  useInventoryStore.subscribe((s, prev) => {
    if (s.stacks !== prev.stacks) checkAll();
  });
}

// ---- accepting, finishing ------------------------------------------------------------

export function acceptQuest(id: string): void {
  const def = questDef(id);
  if (!def) return;
  useQuestStore.getState().start(id);
  audio.sfx("rare", { pitch: 1.2 });
  useUiStore.getState().pushToast(t("quests.accepted", { title: questText(def).title }), "levelup", { icon: "journal" });
  gameEvents.emit("questAccepted", { questId: id });
  // Already have what it asks for? Count it.
  check(id);
}

function applyReward(r: QuestReward) {
  const ui = useUiStore.getState();
  if (r.gold) {
    usePlayerStore.getState().earnGold(r.gold);
    ui.pushToast(t("quests.rewardGold", { n: r.gold }), "gold", { icon: "coin_bag" });
    audio.sfx("coin");
  }
  if (r.xp) ui.pushToast(t("quests.rewardXp", { n: grantXp(r.xp) }), "info", { icon: "skill_strength" });
  if (r.items?.length) grantItems(r.items.map((i) => ({ itemId: i.item, quantity: i.count })));
  if (r.talentPoints) {
    usePlayerStore.getState().addTalentPoints(r.talentPoints);
    ui.pushToast(t("quests.rewardTalent", { n: r.talentPoints }), "levelup", { icon: "skill_strength" });
  }
  if (r.honor) adjustHonor(r.honor);
  for (const [npc, n] of Object.entries(r.friendship ?? {})) changeFriendship(npc, n);
  for (const f of r.flags ?? []) useWorldStore.getState().setFlag(f);
}

export function completeQuest(id: string): void {
  const def = questDef(id);
  if (!def || !isReady(id)) return;
  const inv = useInventoryStore.getState();
  // Hand over what was asked for, and any quest items found along the way.
  for (const obj of def.stages) {
    if (obj.kind === "gather") for (const i of obj.items) inv.removeItem(i.item, i.count);
    if (obj.kind === "find") inv.removeItem(obj.item, 1);
  }
  useQuestStore.getState().finish(id);
  announcedReady.delete(id);
  audio.sfx("levelup");
  useUiStore.getState().pushToast(t("quests.completed", { title: questText(def).title }), "levelup", { icon: "journal" });
  applyReward(def.rewards);
  if (def.kind === "story" || def.kind === "side") useSocialStore.getState().addDeed("helped");
  gameEvents.emit("questCompleted", { questId: id });
}

function applyChoice(id: string, c: QuestChoice): boolean {
  const player = usePlayerStore.getState();
  let won = true;
  if (c.gamble !== undefined) won = Math.random() < c.gamble;
  const gold = won ? (c.gold ?? 0) : -(c.loseGold ?? 0);
  if (gold < 0 && !player.spendGold(-gold)) {
    // Can't pay: take what there is.
    player.loseGold(-gold);
  } else if (gold > 0) player.earnGold(gold);
  if (gold) useUiStore.getState().pushToast(gold > 0 ? t("quests.rewardGold", { n: gold }) : t("quests.paid", { n: -gold }), gold > 0 ? "gold" : "warning", { icon: "coin_bag" });
  if (c.honor) adjustHonor(c.honor);
  for (const [npc, n] of Object.entries(c.friendship ?? {})) changeFriendship(npc, n);
  if (c.drunk) gameEvents.emit("drank", { drink: "quest" });
  useQuestStore.getState().setChoice(id, c.id);
  useQuestStore.getState().nextStage(id);
  check(id);
  return won;
}

// ---- dialogue --------------------------------------------------------------------------

/** Offers turned down today (asked again tomorrow). */
const declined = new Map<string, number>();

/** Turned down today? (Offers come back the next day — nothing is lost for saying no.) */
export const declinedToday = (id: string) => declined.get(id) === useTimeStore.getState().day;

/**
 * Quests you could pick up right now from people you've already met: so a
 * "not now" is never a "never", and the journal can remind you who to ask.
 */
export function openOffers(): QuestDef[] {
  const met = useSocialStore.getState().relationships;
  return QUESTS.filter((d) => d.kind !== "board" && isAvailable(d) && !!met[d.giver]);
}

/** Something an NPC has to say about quests, if anything (checked before
 * their usual lines). */
export function questDialogue(npcId: string): Dialogue | null {
  const npc = NPCS[npcId];
  if (!npc) return null;
  const speaker = npcName(npc);
  const portrait = npc.portrait;
  const store = useQuestStore.getState();
  const day = useTimeStore.getState().day;
  const ui = () => useUiStore.getState();

  // 1. Someone a quest sent you to talk to.
  for (const [id, st] of Object.entries(store.active)) {
    const def = questDef(id);
    const obj = def?.stages[st.stage];
    if (!def || !obj || obj.kind !== "talk" || obj.npc !== npcId) continue;
    const text = questText(def);
    const lines = text.talk?.[st.stage] ?? ["…"];
    if (!obj.choices?.length) return { speaker, portrait, lines, onEnd: () => (useQuestStore.getState().nextStage(id), check(id)) };
    return {
      speaker,
      portrait,
      lines,
      choices: obj.choices.map((c) => ({
        label: text.choices?.[c.id]?.label ?? c.id,
        tone: (c.honor ?? 0) < 0 ? "bad" : (c.honor ?? 0) > 0 ? "good" : "neutral",
        disabled: (c.gold ?? 0) < 0 && usePlayerStore.getState().gold < -(c.gold ?? 0),
        onChoose: () => {
          const won = applyChoice(id, c);
          const reply = [...(text.choices?.[c.id]?.reply ?? [])];
          if (c.gamble !== undefined) reply.push(t(won ? "quests.gambleWon" : "quests.gambleLost"));
          ui().showDialogue({ speaker, portrait, lines: reply });
        },
      })),
    };
  }

  // 2. Handing a finished quest in.
  for (const id of Object.keys(store.active)) {
    const def = questDef(id);
    if (!def || returnTo(def) !== npcId || !isReady(id)) continue;
    return { speaker, portrait, lines: questText(def).complete, onEnd: () => completeQuest(id) };
  }

  // 3. A new quest to offer.
  const offer = QUESTS.find((d) => d.giver === npcId && isAvailable(d) && declined.get(d.id) !== day);
  if (offer) {
    const text = questText(offer);
    return {
      speaker,
      portrait,
      lines: text.offer,
      choices: [
        { label: t("quests.accept"), tone: offer.kind === "shady" ? "bad" : "good", onChoose: () => (acceptQuest(offer.id), ui().closePanel()) },
        { label: t("quests.decline"), tone: "neutral", onChoose: () => (declined.set(offer.id, day), ui().closePanel()) },
      ],
    };
  }

  // 4. A nudge about something still in progress (not every time).
  for (const [id] of Object.entries(store.active)) {
    const def = questDef(id);
    if (!def || def.giver !== npcId || Math.random() > 0.45) continue;
    const text = questText(def);
    return { speaker, portrait, lines: [text.remind[Math.floor(Math.random() * text.remind.length)] ?? text.remind[0]] };
  }
  return null;
}

/** "!" (has a quest for you) or "?" (ready to hand in) over someone's head. */
export function questMarker(npcId: string): "!" | "?" | null {
  const store = useQuestStore.getState();
  for (const [id, st] of Object.entries(store.active)) {
    const def = questDef(id);
    if (!def) continue;
    if (returnTo(def) === npcId && isReady(id)) return "?";
    const obj = def.stages[st.stage];
    if (obj?.kind === "talk" && obj.npc === npcId) return "?";
  }
  const day = useTimeStore.getState().day;
  return QUESTS.some((d) => d.giver === npcId && isAvailable(d) && declined.get(d.id) !== day) ? "!" : null;
}

// ---- the world: quest items to find, where to point the arrow -------------------------

/** Quest items that should be lying somewhere in this area right now. */
export function pendingFinds(area: AreaId): { questId: string; item: string; guards: string[] }[] {
  const out: { questId: string; item: string; guards: string[] }[] = [];
  for (const [id, st] of Object.entries(useQuestStore.getState().active)) {
    const obj = questDef(id)?.stages[st.stage];
    if (!obj || obj.kind !== "find" || obj.area !== area || countOf(obj.item) > 0) continue;
    if (obj.minFloor && area === "dungeon" && useDungeonStore.getState().floor < obj.minFloor) continue;
    out.push({ questId: id, item: obj.item, guards: obj.guards ?? [] });
  }
  return out;
}

/** Where the guide arrow should point for the tracked quest (named spawn in this area). */
export function questGuide(area: AreaId): { area: AreaId; spawn: string } | null {
  const id = useQuestStore.getState().tracked;
  const def = id ? questDef(id) : null;
  if (!id || !def) return null;
  if (isReady(id)) return def.returnSpot && def.returnSpot.area === area ? def.returnSpot : null;
  const obj = def.stages[useQuestStore.getState().active[id]?.stage ?? 0];
  if (obj?.kind === "find" && obj.area === area) return { area, spawn: `quest_${id}` };
  return null;
}

// ---- the notice board ------------------------------------------------------------------

const BOARD_MAX_ACTIVE = 2;

/** Today's contracts (rolled once a day). */
export function boardOffers(): string[] {
  const day = useTimeStore.getState().day;
  const s = useQuestStore.getState();
  if (s.board.day === day) return s.board.offers;
  const rng = SeededRandom.fromString(`board:${day}`);
  const deepest = useWorldStore.getState().progress.dungeonDeepest;
  const level = usePlayerStore.getState().level;
  const offers: string[] = [];
  const culls = BOARD_TEMPLATES.cull.filter((c) => c.minFloor <= Math.max(1, deepest));
  for (let i = 0; i < 3; i++) {
    if (i < 2 && culls.length) {
      const c = rng.pick(culls);
      offers.push(`board:cull:${c.key}:${rng.int(4, 6) + Math.floor(level / 4)}:${day}:${i}`);
    } else if (rng.bool(0.35)) {
      offers.push(`board:hunt:any:${rng.int(3, 5)}:${day}:${i}`);
    } else {
      const sp = rng.pick([...BOARD_TEMPLATES.supply, ...(useWorldStore.getState().progress.flags.farm_unlocked ? BOARD_TEMPLATES.crops : [])]);
      offers.push(`board:supply:${sp.item}:${rng.int(sp.count[0], sp.count[1])}:${day}:${i}`);
    }
  }
  s.setBoard(day, offers);
  return offers;
}

export function boardActiveCount(): number {
  return Object.keys(useQuestStore.getState().active).filter((id) => id.startsWith("board:")).length;
}

export function canTakeBoard(): boolean {
  return boardActiveCount() < BOARD_MAX_ACTIVE;
}

function parseBoard(id: string): QuestDef | null {
  const p = id.split(":");
  if (p[0] !== "board") return null;
  const n = Number(p[3]);
  if (p[1] === "cull") {
    const tpl = BOARD_TEMPLATES.cull.find((c) => c.key === p[2]);
    if (!tpl) return null;
    const what = t(`quests.board.foes.${tpl.key}` as "quests.board.foes.orcs");
    return {
      id,
      kind: "board",
      giver: "board",
      stages: [{ kind: "kill", enemies: [...tpl.enemies], count: n }],
      rewards: { gold: 12 + n * 7, xp: 30 + n * 16 },
      text: board("cull", { n, what }),
    };
  }
  if (p[1] === "hunt") {
    return {
      id,
      kind: "board",
      giver: "board",
      stages: [{ kind: "hunt", count: n }],
      rewards: { gold: 15 + n * 9, xp: 30 + n * 14 },
      text: board("hunt", { n, what: "" }),
    };
  }
  if (p[1] === "supply") {
    const item = p[2];
    if (!getItem(item)) return null;
    const value = getItem(item).value;
    return {
      id,
      kind: "board",
      giver: "board",
      stages: [{ kind: "gather", items: [{ item, count: n }] }],
      rewards: { gold: Math.round(10 + value * n * 0.9), xp: 20 + n * 4 },
      text: board("supply", { n, what: itemName(item) }),
    };
  }
  return null;
}

function board(kind: "cull" | "supply" | "hunt", p: { n: number; what: string }): QuestText {
  const title = interpolate(t(`quests.board.${kind}.title`), p);
  const stage = interpolate(t(`quests.board.${kind}.stage`), p);
  return { title, summary: interpolate(t(`quests.board.${kind}.summary`), p), offer: [], stages: [stage], remind: [], complete: [] };
}

/** Area name for the journal ("Whisperwood"). */
export function questAreaName(area: AreaId): string {
  return areaName(area);
}
