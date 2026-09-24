import { FRIEND_REWARDS, friendTier, itemHasTag, prefsFor, type FriendPerk, type FriendTier } from "../data/relationships";
import { getItem } from "../data/items";
import { getNpc, NPCS } from "../data/npcs";
import { useSocialStore } from "../store/socialStore";
import { useInventoryStore } from "../store/inventoryStore";
import { usePlayerStore } from "../store/playerStore";
import { useTimeStore } from "../store/timeStore";
import { useUiStore, type Dialogue } from "../store/uiStore";
import { grantItems } from "./actions";
import { audio } from "./audio/AudioManager";
import { gameEvents } from "./events";
import { interpolate, t, tl } from "../i18n";
import { itemName, npcLines, npcName } from "../i18n/content";

/**
 * Friendship, made to matter. Gifts (once a day per person; loves, likes,
 * hates — you learn someone's loves by trying), friendship tiers that
 * change how people talk to you, one-time presents at 40 and 80, and a
 * few lasting perks (a discount, a cheaper forge…).
 *
 * The foundation for romance/marriage later: Relationship.status and
 * NpcDef.romanceable already exist; tiers and rewards are data.
 */

export type GiftReaction = "love" | "like" | "neutral" | "hate";

export function friendshipOf(npcId: string): number {
  return useSocialStore.getState().relationships[npcId]?.friendship ?? 0;
}

export function tierOf(npcId: string): FriendTier {
  return friendTier(friendshipOf(npcId));
}

export function giftReaction(npcId: string, itemId: string): GiftReaction {
  const def = getItem(itemId);
  const prefs = prefsFor(npcId);
  const has = (tags: string[]) => tags.some((tag) => itemHasTag(itemId, tag, def));
  if (has(prefs.loves)) return "love";
  if (has(prefs.hates)) return "hate";
  if (has(prefs.likes)) return "like";
  // Valuable things are appreciated by anyone.
  return def.value >= 40 ? "like" : "neutral";
}

const GIFT_DELTA: Record<GiftReaction, number> = { love: 10, like: 5, neutral: 2, hate: -6 };

/** Can you give this person something today? */
export function canGiftToday(npcId: string): boolean {
  return !useSocialStore.getState().usedToday(`gift:${npcId}`, useTimeStore.getState().day);
}

/** Things in the bag worth offering (no key items, no quest items). */
export function giftable(): string[] {
  const seen = new Set<string>();
  return useInventoryStore
    .getState()
    .stacks.filter((s) => {
      const d = getItem(s.itemId);
      if (d.keyItem || seen.has(s.itemId)) return false;
      seen.add(s.itemId);
      return true;
    })
    .map((s) => s.itemId);
}

/** The gift menu for someone (G while facing them). */
export function giftDialogue(npcId: string): Dialogue {
  const def = getNpc(npcId);
  const speaker = npcName(def);
  if (!canGiftToday(npcId)) return { speaker, portrait: def.portrait, lines: [t("gift.already", { name: speaker })] };
  const items = giftable();
  if (!items.length) return { speaker, portrait: def.portrait, lines: [t("gift.nothing")] };
  const known = useSocialStore.getState().relationships[npcId]?.known ?? [];
  // Known loves first, then the most valuable things.
  items.sort((a, b) => Number(known.includes(b)) - Number(known.includes(a)) || getItem(b).value - getItem(a).value);
  return {
    speaker,
    portrait: def.portrait,
    lines: [t("gift.pick", { name: speaker })],
    choices: items.slice(0, 7).map((id) => ({
      label: `${itemName(id)}${known.includes(id) ? " ♥" : ""}`,
      onChoose: () => giveGift(npcId, id),
    })),
  };
}

export function giveGift(npcId: string, itemId: string): void {
  const social = useSocialStore.getState();
  const day = useTimeStore.getState().day;
  if (!canGiftToday(npcId) || !useInventoryStore.getState().removeItem(itemId, 1)) return;
  social.useToday(`gift:${npcId}`, day);
  const reaction = giftReaction(npcId, itemId);
  // Remember loves, so the menu can point them out next time.
  if (reaction === "love") social.remember(npcId, itemId);
  changeFriendship(npcId, GIFT_DELTA[reaction], true);
  const def = getNpc(npcId);
  const own = npcLines(def, `gift:${reaction}`);
  const lines = own?.length ? own : tl(`gift.${reaction}`);
  const line = interpolate(lines[Math.floor(Math.random() * lines.length)], { item: itemName(itemId) });
  audio.sfx(reaction === "hate" ? "deny" : reaction === "love" ? "rare" : "ui");
  useUiStore.getState().showDialogue({ speaker: npcName(def), portrait: def.portrait, lines: [line] });
  gameEvents.emit("npcTalked", { npcId });
}

/** Changes friendship, announces it, and pays out any threshold rewards. */
export function changeFriendship(npcId: string, n: number, quiet = false): void {
  if (!NPCS[npcId] || !n) return;
  const before = friendshipOf(npcId);
  const after = useSocialStore.getState().addFriendship(npcId, n);
  if (!quiet) useUiStore.getState().pushToast(t(n > 0 ? "quests.friendUp" : "quests.friendDown", { name: npcName(getNpc(npcId)) }), n > 0 ? "info" : "warning", { icon: "clover" });
  afterChange(npcId, before, after);
}

/** Call after friendship moved by other means (daily chat). */
export function afterChange(npcId: string, before: number, after: number): void {
  const name = npcName(getNpc(npcId));
  const ui = useUiStore.getState();
  if (friendTier(after) !== friendTier(before) && after > before) {
    ui.pushToast(t("gift.tierUp", { name, tier: t(`gift.tier.${friendTier(after)}`) }), "levelup", { icon: "clover" });
  }
  const claimed = useSocialStore.getState().relationships[npcId]?.claimed ?? [];
  for (const r of FRIEND_REWARDS[npcId] ?? []) {
    if (after < r.at || claimed.includes(r.at)) continue;
    useSocialStore.getState().claim(npcId, r.at);
    ui.pushToast(t("gift.reward", { name }), "levelup", { icon: "clover" });
    if (r.items?.length) grantItems(r.items.map((i) => ({ itemId: i.item, quantity: i.count })));
    if (r.gold) usePlayerStore.getState().earnGold(r.gold);
    if (r.talentPoints) {
      usePlayerStore.getState().addTalentPoints(r.talentPoints);
      ui.pushToast(t("quests.rewardTalent", { n: r.talentPoints }), "levelup", { icon: "skill_strength" });
    }
    if (r.perk) ui.pushToast(t(`gift.perk.${r.perk}`), "levelup", { icon: "coin_bag" });
    audio.sfx("levelup");
  }
}

/** Is a friendship perk active? */
export function hasPerk(perk: FriendPerk): boolean {
  for (const [npc, rewards] of Object.entries(FRIEND_REWARDS)) {
    for (const r of rewards) if (r.perk === perk && friendshipOf(npc) >= r.at) return true;
  }
  return false;
}

/** Perks you have, for the journal. */
export function perksOf(npcId: string): FriendPerk[] {
  return (FRIEND_REWARDS[npcId] ?? []).filter((r) => r.perk && friendshipOf(npcId) >= r.at).map((r) => r.perk!);
}
