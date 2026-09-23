import { create } from "zustand";
import type { Direction, Stats, Vector2 } from "../game/core/types";
import type { EquipmentSaveState, PlayerSaveState } from "../game/save/schema";
import { DEFAULT_SAVE } from "../game/save/schema";
import {
  computeEffectiveStats,
  computeRelicEffects,
  statGainsForLevel,
  xpForLevel,
} from "../game/systems/statsSystem";
import type { EquipSlot } from "../data/items";
import { getItem } from "../data/items";

export type PlayerAction = "idle" | "walk" | "gather" | "attack" | "hit" | "dead";

interface PlayerState {
  level: number;
  xp: number;
  hp: number;
  baseStats: Stats;
  gold: number;
  skills: PlayerSaveState["skills"];
  equipment: EquipmentSaveState;

  // Runtime (not persisted)
  position: Vector2;
  direction: Direction;
  facingLeft: boolean;
  action: PlayerAction;

  effectiveStats: () => Stats;
  relicEffects: () => ReturnType<typeof computeRelicEffects>;

  setPosition: (pos: Vector2) => void;
  setDirection: (dir: Direction, facingLeft: boolean) => void;
  setAction: (action: PlayerAction) => void;

  gainXp: (amount: number) => { leveledUp: boolean; newLevel: number };
  gainSkillXp: (skill: keyof PlayerSaveState["skills"], amount: number) => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  fullHeal: () => void;
  spendGold: (amount: number) => boolean;
  earnGold: (amount: number) => void;
  equip: (slot: EquipSlot, itemId: string | undefined) => void;

  loadFrom: (save: PlayerSaveState) => void;
  serialize: () => PlayerSaveState;
  resetRuntimePosition: (pos: Vector2) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  level: DEFAULT_SAVE.player.level,
  xp: DEFAULT_SAVE.player.xp,
  hp: DEFAULT_SAVE.player.hp,
  baseStats: { ...DEFAULT_SAVE.player.baseStats },
  gold: DEFAULT_SAVE.player.gold,
  skills: { ...DEFAULT_SAVE.player.skills },
  equipment: { ...DEFAULT_SAVE.player.equipment },

  position: { x: 160, y: 160 },
  direction: "down",
  facingLeft: false,
  action: "idle",

  effectiveStats: () => computeEffectiveStats(get().baseStats, get().equipment),
  relicEffects: () => computeRelicEffects(get().equipment),

  setPosition: (pos) => set({ position: pos }),
  setDirection: (dir, facingLeft) => set({ direction: dir, facingLeft }),
  setAction: (action) => set({ action }),

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
      const gains = statGainsForLevel();
      baseStats = {
        maxHp: baseStats.maxHp + (gains.maxHp ?? 0),
        attack: baseStats.attack + (gains.attack ?? 0),
        defense: baseStats.defense + (gains.defense ?? 0),
        crit: baseStats.crit,
        luck: baseStats.luck,
      };
    }
    set({
      xp,
      level,
      baseStats,
      hp: leveledUp ? baseStats.maxHp : state.hp,
    });
    return { leveledUp, newLevel: level };
  },

  gainSkillXp: (skill, amount) => {
    set((state) => {
      const level = state.skills[skill];
      const nextLevel = Math.min(50, level + (Math.random() < amount / 10 ? 1 : 0));
      return { skills: { ...state.skills, [skill]: nextLevel } };
    });
  },

  takeDamage: (amount) => {
    set((state) => ({ hp: Math.max(0, state.hp - amount) }));
  },

  heal: (amount) => {
    set((state) => ({
      hp: Math.min(state.effectiveStats().maxHp, state.hp + amount),
    }));
  },

  fullHeal: () => set((state) => ({ hp: state.effectiveStats().maxHp })),

  spendGold: (amount) => {
    const state = get();
    if (state.gold < amount) return false;
    set({ gold: state.gold - amount });
    return true;
  },

  earnGold: (amount) => set((state) => ({ gold: state.gold + amount })),

  equip: (slot, itemId) => {
    if (itemId) {
      const def = getItem(itemId);
      if (def.equipSlot !== slot) return;
    }
    set((state) => ({ equipment: { ...state.equipment, [slot]: itemId } }));
  },

  loadFrom: (save) =>
    set({
      level: save.level,
      xp: save.xp,
      hp: save.hp,
      baseStats: { ...save.baseStats },
      gold: save.gold,
      skills: { ...save.skills },
      equipment: { ...save.equipment },
    }),

  serialize: () => {
    const state = get();
    return {
      level: state.level,
      xp: state.xp,
      hp: state.hp,
      baseStats: state.baseStats,
      gold: state.gold,
      skills: state.skills,
      equipment: state.equipment,
    };
  },

  resetRuntimePosition: (pos) => set({ position: pos }),
}));
