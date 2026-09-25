import { create } from "zustand";
import type { SocialSaveState } from "../game/save/schema";
import { DEFAULT_SAVE } from "../game/save/schema";
import type { Rumor } from "../game/social/rumors";

/**
 * How Wildkeep sees you: Honor (−100 menace … +100 local hero), how well you
 * know each NPC, the deeds people gossip about, and today's world event.
 *
 * Deliberately small. It's the foundation for quests, romance, rivalries
 * and crime, not a morality simulator: being a saint and being a menace are
 * both valid ways to play; people just treat you differently.
 */
export interface Relationship {
  /** 0..100. Grows by talking (once a day), gifts and favours later. */
  friendship: number;
  /** Last day you talked (friendship grows once per day). */
  lastTalkDay: number;
  /** Future: "friend" | "dating" | "partner" | "rival"… */
  status?: string;
  /** Gifts you've learned they love. */
  known?: string[];
  /** Friendship rewards already given (40, 80). */
  claimed?: number[];
}

export type RepGroup = "village" | "watch" | "underworld";

export interface Deeds {
  stolen: number;
  caught: number;
  roundsBought: number;
  helped: number;
  animalsHunted: number;
  npcsHit: number;
}

interface SocialState extends SocialSaveState {
  /** Returns the honor actually applied (clamped). */
  changeHonor: (delta: number) => number;
  /** First chat of the day with an NPC. Returns true if friendship grew. */
  talkedTo: (npcId: string, day: number) => boolean;
  addDeed: (key: keyof Deeds, amount?: number) => void;
  remember: (npcId: string, itemId: string) => void;
  claim: (npcId: string, at: number) => void;
  /** Returns the change actually applied (clamped). */
  changeRep: (group: RepGroup, delta: number) => number;
  addBounty: (gold: number) => void;
  clearBounty: () => void;
  setDrunk: (v: number) => void;
  /** Change friendship with someone (clamped 0..100). Returns the new value. */
  addFriendship: (npcId: string, amount: number) => number;
  /** Once-a-day things (steal spots, shrines, the pantry…). */
  useToday: (key: string, day: number) => void;
  usedToday: (key: string, day: number) => boolean;
  setEvent: (day: number, id: string | null) => void;
  setRumors: (rumors: Rumor[]) => void;
  loadFrom: (save: SocialSaveState) => void;
  serialize: () => SocialSaveState;
}

export const HONOR_MIN = -100;
export const HONOR_MAX = 100;

export const useSocialStore = create<SocialState>((set, get) => ({
  ...structuredClone(DEFAULT_SAVE.social),

  changeHonor: (delta) => {
    const before = get().honor;
    const honor = Math.max(HONOR_MIN, Math.min(HONOR_MAX, before + delta));
    set({ honor });
    return honor - before;
  },

  talkedTo: (npcId, day) => {
    const cur = get().relationships[npcId] ?? { friendship: 0, lastTalkDay: 0 };
    if (cur.lastTalkDay === day) return false;
    set((s) => ({ relationships: { ...s.relationships, [npcId]: { ...cur, friendship: Math.min(100, cur.friendship + 2), lastTalkDay: day } } }));
    return true;
  },

  changeRep: (group, delta) => {
    const before = get().rep[group];
    const v = Math.max(-100, Math.min(100, before + delta));
    set((s) => ({ rep: { ...s.rep, [group]: v } }));
    return v - before;
  },
  addBounty: (gold) => set((s) => ({ bounty: Math.max(0, Math.round(s.bounty + gold)) })),
  clearBounty: () => set({ bounty: 0 }),
  setDrunk: (v) => set({ drunk: Math.max(0, Math.min(100, v)) }),
  remember: (npcId, itemId) => {
    const cur = get().relationships[npcId] ?? { friendship: 0, lastTalkDay: 0 };
    if (cur.known?.includes(itemId)) return;
    set((s) => ({ relationships: { ...s.relationships, [npcId]: { ...cur, known: [...(cur.known ?? []), itemId] } } }));
  },
  claim: (npcId, at) => {
    const cur = get().relationships[npcId] ?? { friendship: 0, lastTalkDay: 0 };
    set((s) => ({ relationships: { ...s.relationships, [npcId]: { ...cur, claimed: [...(cur.claimed ?? []), at] } } }));
  },
  addFriendship: (npcId, amount) => {
    const cur = get().relationships[npcId] ?? { friendship: 0, lastTalkDay: 0 };
    const friendship = Math.max(0, Math.min(100, cur.friendship + amount));
    set((s) => ({ relationships: { ...s.relationships, [npcId]: { ...cur, friendship } } }));
    return friendship;
  },

  addDeed: (key, amount = 1) => set((s) => ({ deeds: { ...s.deeds, [key]: s.deeds[key] + amount } })),

  useToday: (key, day) =>
    set((s) => {
      // Drop entries from past days so the save stays small.
      const used: Record<string, number> = {};
      for (const [k, d] of Object.entries(s.used)) if (d === day) used[k] = d;
      used[key] = day;
      return { used };
    }),
  usedToday: (key, day) => get().used[key] === day,

  setEvent: (day, id) => set({ event: { day, id } }),

  setRumors: (rumors) => set({ rumors }),
  // Older saves have no rumours: don't keep the last game's.
  loadFrom: (save) => set({ rumors: [], ...structuredClone(save) }),
  serialize: () => {
    const s = get();
    return { honor: s.honor, relationships: s.relationships, deeds: s.deeds, used: s.used, event: s.event, rep: s.rep, bounty: s.bounty, drunk: s.drunk, rumors: s.rumors ?? [] };
  },
}));
