import { create } from "zustand";
import type { QuestSaveState } from "../game/save/schema";
import { DEFAULT_SAVE } from "../game/save/schema";

/**
 * Quest bookkeeping only (what's active, at which stage, what's done). The
 * rules — what counts as progress, rewards, dialogue — live in game/quests.ts.
 */
interface QuestState extends QuestSaveState {
  start: (id: string) => void;
  /** Adds to the current stage's counter. */
  bump: (id: string, n?: number) => void;
  setCount: (id: string, count: number) => void;
  nextStage: (id: string) => void;
  setChoice: (id: string, choice: string) => void;
  finish: (id: string) => void;
  abandon: (id: string) => void;
  track: (id: string | null) => void;
  setBoard: (day: number, offers: string[]) => void;
  loadFrom: (save: QuestSaveState) => void;
  serialize: () => QuestSaveState;
}

export const useQuestStore = create<QuestState>((set, get) => ({
  ...structuredClone(DEFAULT_SAVE.quests),

  start: (id) => set((s) => ({ active: { ...s.active, [id]: { stage: 0, count: 0 } }, tracked: s.tracked ?? id })),
  bump: (id, n = 1) =>
    set((s) => {
      const q = s.active[id];
      return q ? { active: { ...s.active, [id]: { ...q, count: q.count + n } } } : {};
    }),
  setCount: (id, count) =>
    set((s) => {
      const q = s.active[id];
      return q ? { active: { ...s.active, [id]: { ...q, count } } } : {};
    }),
  nextStage: (id) =>
    set((s) => {
      const q = s.active[id];
      return q ? { active: { ...s.active, [id]: { ...q, stage: q.stage + 1, count: 0 } } } : {};
    }),
  setChoice: (id, choice) =>
    set((s) => {
      const q = s.active[id];
      return q ? { active: { ...s.active, [id]: { ...q, choice } } } : {};
    }),
  finish: (id) =>
    set((s) => {
      const active = { ...s.active };
      delete active[id];
      const rest = Object.keys(active);
      return { active, done: s.done.includes(id) ? s.done : [...s.done, id], tracked: s.tracked === id ? (rest[0] ?? null) : s.tracked };
    }),
  abandon: (id) =>
    set((s) => {
      const active = { ...s.active };
      delete active[id];
      const rest = Object.keys(active);
      return { active, tracked: s.tracked === id ? (rest[0] ?? null) : s.tracked };
    }),
  track: (id) => set({ tracked: id }),
  setBoard: (day, offers) => set({ board: { day, offers } }),

  loadFrom: (save) => set(structuredClone(save)),
  serialize: () => {
    const s = get();
    return { active: s.active, done: s.done, tracked: s.tracked, board: s.board };
  },
}));
