/**
 * Relationships, as data: what each person likes to be given, and what
 * being their friend is worth. Friendship is 0..100 (socialStore); it grows
 * by chatting (once a day), gifts (once a day each), quests and favours,
 * and shrinks when you treat people badly.
 *
 * Gift preferences use item ids or tags:
 *   #gem #flower #crop #food #meat #ore #bar #junk #bone #trophy
 */
export interface GiftPrefs {
  loves: string[];
  likes: string[];
  hates: string[];
}

const DEFAULT_PREFS: GiftPrefs = { loves: [], likes: ["#food", "#flower"], hates: ["#junk", "#bone"] };

export const GIFT_PREFS: Record<string, GiftPrefs> = {
  mira: { loves: ["#gem", "gold_bar"], likes: ["#bar", "strawberry"], hates: ["#junk", "#meat"] },
  bram: { loves: ["mithril_bar", "silver_bar", "gold_bar"], likes: ["#ore", "iron_bar", "coal", "roast_meat"], hates: ["#flower", "berry_tart"] },
  greta: { loves: ["pumpkin_pie", "apple_pie"], likes: ["#food", "#meat", "#crop"], hates: ["#junk", "greta_tankard"] },
  may: { loves: ["healroot", "moonpetal", "healroot_salve"], likes: ["herb", "#flower", "#crop"], hates: ["#bone", "#meat"] },
  hob: { loves: ["turnip", "pumpkin", "melon"], likes: ["#crop", "#food"], hates: ["meat_raw", "roast_meat"] },
  finn: { loves: ["loaded_dice", "#gem"], likes: ["gold_bar", "mystery_box"], hates: ["#crop", "herb"] },
  rattles: { loves: ["bone", "rattles_femur"], likes: ["#junk", "antler"], hates: ["#food", "#meat"] },
  tam: { loves: ["orc_tusk", "old_sock", "dire_tusk"], likes: ["feather", "antler", "strawberry"], hates: ["#crop", "herb"] },
  ingrid: { loves: ["ancient_wood", "crystal", "golden_antler"], likes: ["#gem", "moonpetal", "bone"], hates: ["#meat"] },
  rowan: { loves: ["dire_tusk", "golden_antler"], likes: ["#bar", "roast_meat", "#trophy"], hates: ["#junk", "#flower"] },
  lyra: { loves: ["strawberry", "berry_tart", "feather"], likes: ["#flower", "#food"], hates: ["#ore", "#bone"] },
  silas: { loves: ["gold_bar", "diamond"], likes: ["#gem", "loaded_dice"], hates: ["#crop", "#junk"] },
  tomas: { loves: ["hide", "white_pelt"], likes: ["#meat", "feather", "arrow"], hates: ["#flower"] },
  bella: { loves: ["moonpetal", "emberbloom", "melon"], likes: ["#flower", "#crop"], hates: ["#bone", "#ore"] },
  barnaby: { loves: ["vegetable_stew", "goblin_bread"], likes: ["#food", "#junk"], hates: [] },
  mags: { loves: ["apple_pie", "pumpkin_pie"], likes: ["#food", "herb"], hates: ["#bone"] },
  bryn: { loves: ["roast_meat", "iron_helm"], likes: ["#meat", "#food"], hates: ["#flower"] },
  dorrin: { loves: ["#gem", "crystal"], likes: ["coal", "#ore"], hates: ["#flower"] },
  hooded: { loves: ["moonpetal", "amethyst"], likes: ["#bone", "crystal"], hates: ["#food"] },
  morg: { loves: ["roast_meat", "meat_raw"], likes: ["#meat", "orc_tusk"], hates: ["bone"] },
  pip: { loves: ["strawberry", "berry_tart"], likes: ["#food", "#flower"], hates: ["#bone"] },
  cook: { loves: ["mushroom", "pumpkin"], likes: ["#crop", "#meat", "herb"], hates: ["#junk"] },
  gus: { loves: ["gold_ore", "#gem"], likes: ["#ore", "coal"], hates: ["#flower"] },
};

export const prefsFor = (npcId: string): GiftPrefs => GIFT_PREFS[npcId] ?? DEFAULT_PREFS;

/** Friendship tiers (lower bounds). */
export const FRIEND_TIERS = [
  { id: "stranger", min: 0 },
  { id: "acquaintance", min: 15 },
  { id: "friend", min: 40 },
  { id: "good", min: 60 },
  { id: "close", min: 80 },
] as const;

export type FriendTier = (typeof FRIEND_TIERS)[number]["id"];

export function friendTier(friendship: number): FriendTier {
  let tier: FriendTier = "stranger";
  for (const t of FRIEND_TIERS) if (friendship >= t.min) tier = t.id;
  return tier;
}

/**
 * What friendship is worth: a one-time present when you reach a threshold,
 * and sometimes a lasting perk (read by the systems through
 * game/relationships.ts `hasPerk`).
 */
export type FriendPerk = "mira_discount" | "bram_discount" | "greta_discount" | "may_potions" | "silas_limit";

export interface FriendReward {
  at: 40 | 80;
  items?: { item: string; count: number }[];
  gold?: number;
  talentPoints?: number;
  perk?: FriendPerk;
}

export const FRIEND_REWARDS: Record<string, FriendReward[]> = {
  mira: [{ at: 40, perk: "mira_discount" }, { at: 80, items: [{ item: "gold_ring", count: 1 }] }],
  bram: [{ at: 40, perk: "bram_discount" }, { at: 80, items: [{ item: "steel_helm", count: 1 }] }],
  greta: [{ at: 40, perk: "greta_discount" }, { at: 80, items: [{ item: "greta_tankard", count: 1 }], gold: 50 }],
  may: [{ at: 40, perk: "may_potions", items: [{ item: "healroot_salve", count: 3 }] }, { at: 80, items: [{ item: "moon_elixir", count: 2 }] }],
  hob: [{ at: 40, items: [{ item: "melon_seed", count: 3 }] }, { at: 80, items: [{ item: "pumpkin_seed", count: 4 }, { item: "strawberry_seed", count: 4 }] }],
  rowan: [{ at: 40, items: [{ item: "iron_spear", count: 1 }] }, { at: 80, talentPoints: 1 }],
  ingrid: [{ at: 40, items: [{ item: "return_scroll", count: 3 }] }, { at: 80, talentPoints: 1 }],
  silas: [{ at: 40, perk: "silas_limit" }, { at: 80, items: [{ item: "loaded_dice", count: 1 }] }],
  finn: [{ at: 40, items: [{ item: "loaded_dice", count: 1 }] }, { at: 80, gold: 150 }],
  rattles: [{ at: 40, items: [{ item: "bone", count: 5 }] }, { at: 80, items: [{ item: "bonebreaker", count: 1 }] }],
  tam: [{ at: 40, items: [{ item: "feather", count: 5 }] }, { at: 80, items: [{ item: "rabbit_foot", count: 1 }] }],
  lyra: [{ at: 40, gold: 30 }, { at: 80, items: [{ item: "singing_horseshoe", count: 1 }] }],
};

/** How an item fits a tag. */
export function itemHasTag(itemId: string, tag: string, info: { category: string; healAmount?: number; tier?: number }): boolean {
  switch (tag) {
    case "#gem":
      return ["ruby", "sapphire", "emerald", "amethyst", "diamond", "crystal"].includes(itemId);
    case "#flower":
      return ["herb", "moonpetal", "emberbloom", "healroot"].includes(itemId);
    case "#crop":
      return ["turnip", "carrot", "potato", "strawberry", "tomato", "corn", "pumpkin", "melon"].includes(itemId);
    case "#food":
      return info.category === "consumable" && !!info.healAmount && !itemId.includes("potion") && !itemId.includes("elixir") && !itemId.includes("salve");
    case "#meat":
      return ["meat_raw", "roast_meat"].includes(itemId);
    case "#ore":
      return itemId.endsWith("_ore") || itemId === "coal" || itemId === "stone";
    case "#bar":
      return itemId.endsWith("_bar");
    case "#junk":
      return ["old_sock", "goblin_bread", "suspicious_potion"].includes(itemId);
    case "#bone":
      return itemId === "bone";
    case "#trophy":
      return ["antler", "golden_antler", "dire_tusk", "orc_tusk", "white_pelt"].includes(itemId);
    default:
      return tag === itemId;
  }
}
