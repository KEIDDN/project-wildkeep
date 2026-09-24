import { create } from "zustand";
import type { Stats } from "../game/core/types";
import type { EquipmentSaveState, PlayerSaveState } from "../game/save/schema";
import { DEFAULT_SAVE } from "../game/save/schema";
import { statGainsForLevel, xpForLevel } from "../game/systems/statsSystem";
import { playerEffectiveStats } from "../game/systems/playerStats";
import { addSkillXp, type SkillState } from "../game/systems/skills";
import type { SkillId } from "../data/skills";
import type { EquipSlot } from "../data/items";
import { getItem } from "../data/items";
import { TALENTS, canLearn, respecCost, type TalentId, type TalentRanks } from "../data/talents";
import { useWorldStore } from "./worldStore";

/**
 * Persistent character state. Per-frame runtime state (position, facing,
 * animation) lives on the Player entity in the engine, not here, so moving
 * around never triggers React renders.
 */
interface PlayerState {
  level: number;
  xp: number;
  hp: number;
  baseStats: Stats;
  gold: number;
  skills: SkillState;
  equipment: EquipmentSaveState;
  talents: TalentRanks;
  bonusTalentPoints: number;
  /** Daily energy (see game/systems/vitals.ts): hard work spends it, sleep restores it. */
  energy: number;
  /** Durability of each worn piece (see game/systems/durability.ts). */
  wear: Partial<Record<EquipSlot, number>>;

  setWear: (slot: EquipSlot, value: number | undefined) => void;

  /** Sets energy (never below 0; see vitals.ts for spending and the maximum). */
  setEnergy: (energy: number) => void;

  /** Grant extra talent points (quests, deeds). */
  addTalentPoints: (n: number) => void;
  /** Unlearn every talent for gold. Returns false if you can't afford it. */
  respecTalents: () => boolean;
  /** Spend a talent point. Returns false if it can't be learned. */
  learnTalent: (id: TalentId) => boolean;
  gainXp: (amount: number) => { leveledUp: boolean; newLevel: number };
  /** Raw skill XP. Prefer `awardSkillXp` (game/actions) which adds
   * bonuses and level-up fanfare. Returns levels gained. */
  gainSkillXp: (skill: SkillId, amount: number) => number;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => number;
  fullHeal: () => void;
  spendGold: (amount: number) => boolean;
  earnGold: (amount: number) => void;
  loseGold: (amount: number) => void;
  equip: (slot: EquipSlot, itemId: string | undefined) => void;

  loadFrom: (save: PlayerSaveState) => void;
  serialize: () => PlayerSaveState;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ...structuredClone(DEFAULT_SAVE.player),
  talents: {},
  bonusTalentPoints: 0,
  energy: 100,
  wear: {},

  setWear: (slot, value) =>
    set((s) => {
      const wear = { ...s.wear };
      if (value === undefined) delete wear[slot];
      else wear[slot] = Math.round(value * 10) / 10;
      return { wear };
    }),

  setEnergy: (energy) => set({ energy: Math.max(0, Math.round(energy * 10) / 10) }),

  addTalentPoints: (n) => set((s) => ({ bonusTalentPoints: s.bonusTalentPoints + n })),

  respecTalents: () => {
    const s = get();
    const cost = respecCost(s.level);
    if (s.gold < cost || Object.keys(s.talents).length === 0) return false;
    const talents = {};
    const maxHp = playerEffectiveStats({ ...s, talents }).maxHp;
    set({ talents, gold: s.gold - cost, hp: Math.min(s.hp, maxHp) });
    return true;
  },

  learnTalent: (id) => {
    const s = get();
    const def = TALENTS.find((d) => d.id === id);
    const magicOpen = !!useWorldStore.getState().progress.flags.magic_learned;
    if (!def || canLearn(def, s.talents, s.level, s.bonusTalentPoints, magicOpen) !== "ok") return false;
    const talents = { ...s.talents, [id]: (s.talents[id] ?? 0) + 1 };
    // Toughness talents raise max HP; top up by the difference.
    const before = playerEffectiveStats(s).maxHp;
    const after = playerEffectiveStats({ ...s, talents }).maxHp;
    set({ talents, hp: s.hp + Math.max(0, after - before) });
    return true;
  },

  gainXp: (amount) => {
    const state = get();
    let xp = state.xp + amount;
    let level = state.level;
    let leveledUp = false;
    let baseStats = state.baseStats;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
      leveledUp = true;
      const gains = statGainsForLevel(level);
      baseStats = {
        ...baseStats,
        maxHp: baseStats.maxHp + (gains.maxHp ?? 0),
        attack: baseStats.attack + (gains.attack ?? 0),
        defense: baseStats.defense + (gains.defense ?? 0),
      };
    }
    const maxHp = playerEffectiveStats({ ...state, baseStats }).maxHp;
    set({ xp, level, baseStats, hp: leveledUp ? maxHp : state.hp });
    return { leveledUp, newLevel: level };
  },

  gainSkillXp: (skill, amount) => {
    const { skills, gained } = addSkillXp(get().skills, skill, amount);
    set({ skills });
    return gained;
  },

  takeDamage: (amount) => set((state) => ({ hp: Math.max(0, state.hp - amount) })),

  heal: (amount) => {
    const state = get();
    const max = playerEffectiveStats(state).maxHp;
    const next = Math.min(max, state.hp + amount);
    set({ hp: next });
    return next - state.hp;
  },

  fullHeal: () => {
    const state = get();
    set({ hp: playerEffectiveStats(state).maxHp });
  },

  spendGold: (amount) => {
    const state = get();
    if (state.gold < amount) return false;
    set({ gold: state.gold - amount });
    return true;
  },

  earnGold: (amount) => set((state) => ({ gold: state.gold + Math.max(0, Math.round(amount)) })),
  loseGold: (amount) => set((state) => ({ gold: Math.max(0, state.gold - Math.round(amount)) })),

  equip: (slot, itemId) => {
    if (itemId && getItem(itemId).equipSlot !== slot) return;
    set((state) => {
      const equipment = { ...state.equipment, [slot]: itemId };
      const maxHp = playerEffectiveStats({ ...state, equipment }).maxHp;
      return { equipment, hp: Math.min(state.hp, maxHp) };
    });
  },

  loadFrom: (save) =>
    set({
      level: save.level,
      xp: save.xp,
      hp: save.hp,
      baseStats: { ...save.baseStats },
      gold: save.gold,
      skills: structuredClone(save.skills),
      equipment: { ...save.equipment },
      talents: { ...save.talents },
      bonusTalentPoints: save.bonusTalentPoints ?? 0,
      energy: save.energy ?? 100,
      wear: { ...save.wear } as Partial<Record<EquipSlot, number>>,
    }),

  serialize: () => {
    const s = get();
    return {
      level: s.level,
      xp: s.xp,
      hp: s.hp,
      baseStats: s.baseStats,
      gold: s.gold,
      skills: s.skills,
      equipment: s.equipment,
      talents: s.talents,
      bonusTalentPoints: s.bonusTalentPoints,
      energy: s.energy,
      wear: s.wear,
    };
  },
}));
