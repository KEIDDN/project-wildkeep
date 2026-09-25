import { useSocialStore, type RepGroup } from "../../store/socialStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore, type Dialogue } from "../../store/uiStore";
import { getNpc } from "../../data/npcs";
import { adjustHonor } from "./honor";
import { changeFriendship } from "../relationships";
import { audio } from "../audio/AudioManager";
import { gameEvents } from "../events";
import { t } from "../../i18n";
import { itemName, npcName } from "../../i18n/content";

/**
 * Reputation is more than one number. Honor is your conscience, as the
 * village judges it; on top of it, three groups keep their own opinion:
 *
 *   village     the townsfolk: helping, quests, returning what you took
 *   watch       the guards: theft, hitting people, unpaid bounties
 *   underworld  Finn and friends: clean thefts, shady jobs, big gambles
 *
 * The same act moves them differently — a theft nobody saw costs you
 * nothing with the village, pleases the underworld, and the watch never
 * knows. Get caught and the watch puts a bounty on you: Guard Bryn will
 * come and collect.
 */

export const REP_GROUPS: RepGroup[] = ["village", "watch", "underworld"];

/** Shifts a group's opinion (clamped −100…100), with a quiet notice. */
export function adjustRep(group: RepGroup, n: number, quiet = false): void {
  if (!n) return;
  const applied = useSocialStore.getState().changeRep(group, n);
  if (applied && !quiet) useUiStore.getState().pushToast(t(applied > 0 ? "rep.up" : "rep.down", { group: t(`rep.name.${group}`) }), applied > 0 ? "info" : "warning", { icon: group === "underworld" ? "dice" : group === "watch" ? "helm_iron" : "house" });
}

export type RepRank = "hated" | "disliked" | "neutral" | "liked" | "revered";

export function repRank(v: number): RepRank {
  if (v <= -50) return "hated";
  if (v <= -15) return "disliked";
  if (v < 15) return "neutral";
  if (v < 50) return "liked";
  return "revered";
}

export function repOf(group: RepGroup): number {
  return useSocialStore.getState().rep[group];
}

/** Caught red-handed: the watch adds to your bounty. */
export function addBounty(gold: number): void {
  useSocialStore.getState().addBounty(gold);
}

/** Can Finn fence for you? (Underworld standing or the Fence talent.) */
export function finnFences(): boolean {
  return repOf("underworld") >= 20;
}

/** What the fence pays for stolen goods (fraction of the honest price). */
export const FENCE_RATE = 0.45;

// ---- Guard Bryn collects ---------------------------------------------------------------

/** Bryn stops you in the street when there's a bounty on your head. */
export function bountyDialogue(): Dialogue | null {
  const s = useSocialStore.getState();
  if (s.bounty <= 0) return null;
  const bryn = getNpc("bryn");
  const speaker = npcName(bryn);
  const fine = s.bounty;
  const gold = usePlayerStore.getState().gold;
  const honor = s.honor;
  return {
    speaker,
    portrait: bryn.portrait,
    lines: [t("rep.bounty.stop"), t("rep.bounty.amount", { n: fine })],
    choices: [
      {
        label: t("rep.bounty.pay", { n: fine }),
        tone: "good",
        disabled: gold < fine,
        onChoose: () => {
          if (!usePlayerStore.getState().spendGold(fine)) return;
          useSocialStore.getState().clearBounty();
          adjustRep("watch", 10);
          audio.sfx("coin");
          useUiStore.getState().showDialogue({ speaker, portrait: bryn.portrait, lines: [t("rep.bounty.paid")] });
        },
      },
      {
        // Talking your way out works better if people generally like you.
        label: t("rep.bounty.talk"),
        tone: "neutral",
        onChoose: () => {
          const chance = 0.25 + Math.max(0, honor) / 200 + Math.max(0, repOf("village")) / 250;
          const ok = Math.random() < chance;
          if (ok) {
            useSocialStore.getState().clearBounty();
            adjustRep("watch", -3);
          } else {
            useSocialStore.getState().addBounty(Math.round(fine * 0.5));
            adjustRep("watch", -5);
          }
          audio.sfx(ok ? "rare" : "deny");
          useUiStore.getState().showDialogue({ speaker, portrait: bryn.portrait, lines: [t(ok ? "rep.bounty.talkOk" : "rep.bounty.talkFail")] });
        },
      },
      {
        label: t("rep.bounty.refuse"),
        tone: "bad",
        onChoose: () => {
          adjustRep("watch", -10);
          adjustRep("underworld", 4);
          adjustHonor(-3);
          useUiStore.getState().showDialogue({ speaker, portrait: bryn.portrait, lines: [t("rep.bounty.refused")] });
        },
      },
    ],
  };
}

// ---- giving things back ------------------------------------------------------------------

/** Honest folk who'll take their things back (and think better of you). */
const OWNERS = new Set(["mira", "greta", "bella", "tomas", "bram", "may", "hob"]);

/** "Is that… mine?" — offered when you talk to an honest NPC carrying stolen goods. */
export function returnStolenDialogue(npcId: string): Dialogue | null {
  if (!OWNERS.has(npcId)) return null;
  const stolen = useInventoryStore.getState().stacks.filter((s) => s.stolen);
  if (!stolen.length) return null;
  const def = getNpc(npcId);
  const speaker = npcName(def);
  const what = stolen.map((s) => `${s.quantity > 1 ? `${s.quantity}× ` : ""}${itemName(s.itemId)}`).join(", ");
  return {
    speaker,
    portrait: def.portrait,
    lines: [t("rep.return.notice", { items: what })],
    choices: [
      {
        label: t("rep.return.give"),
        tone: "good",
        onChoose: () => {
          let n = 0;
          for (const s of stolen) {
            if (useInventoryStore.getState().removeItem(s.itemId, s.quantity, "stolen")) n += s.quantity;
          }
          adjustHonor(Math.min(12, 2 + n * 2));
          adjustRep("village", Math.min(8, 2 + n));
          adjustRep("watch", 3);
          useSocialStore.getState().addDeed("helped");
          const bounty = useSocialStore.getState().bounty;
          if (bounty > 0) useSocialStore.getState().addBounty(-Math.min(bounty, 20 * n));
          changeFriendship(npcId, 6);
          audio.sfx("levelup");
          useUiStore.getState().showDialogue({ speaker, portrait: def.portrait, lines: [t("rep.return.thanks")] });
        },
      },
      { label: t("rep.return.keep"), tone: "bad", onChoose: () => useUiStore.getState().closePanel() },
    ],
  };
}

// ---- consequences of what you do ------------------------------------------------------------

let wired = false;

/** Reputation follows the event bus: quests, gambling, bosses. */
export function initReputation(questKind: (id: string) => string | null): void {
  if (wired) return;
  wired = true;
  gameEvents.on("questCompleted", ({ questId }) => {
    const kind = questKind(questId);
    if (kind === "shady") adjustRep("underworld", 5);
    else if (kind === "board") adjustRep("village", 1, true);
    else adjustRep("village", 4);
  });
  gameEvents.on("gambled", ({ net }) => {
    // Losing your shirt is the talk of the village; big wins, the talk of the back room.
    if (net <= -150) adjustRep("village", -2, true);
    if (net >= 150) adjustRep("underworld", 2, true);
  });
  gameEvents.on("enemyKilled", ({ boss }) => {
    if (boss) adjustRep("village", 5);
  });
}

/** An unpaid bounty grows this much a night (plus 5g), up to the cap. */
export const BOUNTY_INTEREST = 0.1;
export const BOUNTY_CAP = 400;

/** A night passed (slept or passed out): an unpaid bounty doesn't go away. */
export function bountyMorning(): void {
  const bounty = useSocialStore.getState().bounty;
  if (bounty <= 0 || bounty >= BOUNTY_CAP) return;
  const next = Math.min(BOUNTY_CAP, Math.round(bounty * (1 + BOUNTY_INTEREST)) + 5);
  useSocialStore.getState().addBounty(next - bounty);
  useUiStore.getState().pushToast(t("rep.bounty.grew", { n: next }), "warning", { icon: "helm_iron" });
}
