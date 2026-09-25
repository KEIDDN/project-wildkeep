import { useSocialStore } from "../../store/socialStore";
import { useTimeStore } from "../../store/timeStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore } from "../../store/uiStore";
import { gameEvents } from "../events";
import { audio } from "../audio/AudioManager";
import { adjustHonor } from "./honor";
import { addBounty, adjustRep } from "./reputation";
import { changeFriendship } from "../relationships";
import { getItem } from "../../data/items";
import { caughtLine } from "../npcs";
import { itemName } from "../../i18n/content";
import { t, type TKey } from "../../i18n";
import { Npc, setNpcHitHandler } from "../../engine/entities/Props";
import { recordRumor } from "./rumors";
import { npcName } from "../../i18n/content";
import type { Game } from "../../engine/Game";

/**
 * Petty crime, foundation edition. Some things in the world can be
 * pocketed (once a day). Anyone nearby who's looking your way might notice:
 * get caught and you lose Honor and the witness says so, loudly. Get away
 * with it and the goods are yours — marked stolen, so honest shops won't
 * buy them. Future: fences, guards, bounties, NPCs remembering grudges.
 */
export interface StealDef {
  /** Once-a-day key (also identifies the spot). */
  key: string;
  /** Prompt target (i18n key). */
  target: TKey;
  loot: { itemId: string; quantity: number } | { gold: [number, number] };
  /** Honor lost if seen. */
  honor: number;
}

/**
 * How closely people watch your hands: 1 for a stranger. A poor name with
 * the watch (every time you're caught) makes the village warier, up to
 * about half again; underworld know-how takes up to a quarter off.
 */
export function watchfulness(): number {
  const rep = useSocialStore.getState().rep;
  return (1 + Math.max(0, -rep.watch) / 200) * (1 - Math.min(0.25, Math.max(0, rep.underworld) / 240));
}

export function attemptSteal(game: Game, x: number, y: number, def: StealDef): void {
  const day = useTimeStore.getState().day;
  const social = useSocialStore.getState();
  if (social.usedToday(def.key, day)) return;
  social.useToday(def.key, day);

  // Everyone who might be watching gets a chance to notice — more so once
  // the watch knows your face, less once you know the trade.
  const wary = watchfulness();
  let unseen = 1;
  let witness: Npc | null = null;
  let best = 0;
  for (const e of game.area.entities) {
    if (!(e instanceof Npc) || e.removed) continue;
    const c = e.notices(x, y);
    unseen *= 1 - Math.min(0.95, c * 0.85 * wary);
    if (c > best) {
      best = c;
      witness = e;
    }
  }
  const noticed = Math.random() > unseen;

  let label: string;
  if ("gold" in def.loot) {
    const [a, b] = def.loot.gold;
    const gold = a + Math.floor(Math.random() * (b - a + 1));
    usePlayerStore.getState().earnGold(gold);
    label = t("common.goldShort", { n: gold });
    game.fx.text(game.player.x, game.player.y - 28, `+${gold}g`, 0xffd54f, { size: 8 });
  } else {
    useInventoryStore.getState().addItem(def.loot.itemId, def.loot.quantity, { stolen: true });
    label = itemName(def.loot.itemId);
  }
  social.addDeed("stolen");
  gameEvents.emit("stole", { itemId: "gold" in def.loot ? "gold" : def.loot.itemId, noticed });

  if (noticed && witness) {
    social.addDeed("caught");
    witness.say(game, caughtLine());
    useUiStore.getState().pushToast(t("toast.caught", { name: witness.displayName }), "warning");
    adjustHonor(-def.honor);
    // Witnesses remember; the watch writes it down.
    if (witness.def) changeFriendship(witness.def.id, -8, true);
    const worth = "gold" in def.loot ? 25 : Math.max(15, getItem(def.loot.itemId).value * def.loot.quantity * 2);
    addBounty(worth);
    adjustRep("watch", -6);
    adjustRep("village", -3, true);
    useUiStore.getState().pushToast(t("rep.bounty.added", { n: Math.round(worth) }), "warning", { icon: "helm_iron" });
    audio.sfx("deny");
  } else {
    adjustRep("underworld", 2, true);
    useUiStore.getState().pushToast(t("toast.stolen", { item: label }), "info", { icon: "coin_bag" });
    audio.sfx("coin");
  }
}

// Hitting villagers: no damage, but people remember.
setNpcHitHandler((npc) => {
  useSocialStore.getState().addDeed("npcsHit");
  adjustHonor(-2);
  adjustRep("watch", -2, true);
  if (npc.def) {
    changeFriendship(npc.def.id, -3, true);
    recordRumor("hitNpc", { name: npcName(npc.def) }, npc.def.id);
  }
});
