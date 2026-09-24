import { create } from "zustand";
import { useSettingsStore } from "./settingsStore";
import type { TutorialSaveState } from "../game/save/schema";
import { COVERED_BY_INTRO, TUTORIAL_STEPS, type HelpTopicId } from "../data/tutorial";

interface TutorialState {
  step: number;
  completed: boolean;
  /** Bumped whenever a step completes (drives the little "done!" flash). */
  justCompleted: number;
  seenTopics: string[];
  introSeen: boolean;
  /** Tip cards waiting to be shown (contextual help). */
  queue: HelpTopicId[];

  advance: () => void;
  skip: () => void;
  restart: () => void;
  /** Queue a help topic unless it's been shown before. Returns true if new. */
  show: (topic: HelpTopicId) => boolean;
  dismissTip: () => void;
  finishIntro: () => void;
  loadFrom: (save: TutorialSaveState) => void;
  serialize: () => TutorialSaveState;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  step: 0,
  completed: false,
  justCompleted: 0,
  seenTopics: [],
  introSeen: false,
  queue: [],

  advance: () => {
    const next = get().step + 1;
    set({ step: next, completed: next >= TUTORIAL_STEPS.length, justCompleted: get().justCompleted + 1 });
  },
  skip: () => set({ completed: true }),
  restart: () => set({ step: 0, completed: false, seenTopics: [], queue: [] }),
  show: (topic) => {
    const s = get();
    if (s.seenTopics.includes(topic) || !useSettingsStore.getState().tips) return false;
    // The introduction already teaches these; their cards wait until it's done.
    if (!s.completed && COVERED_BY_INTRO.includes(topic)) return false;
    set({ seenTopics: [...s.seenTopics, topic], queue: [...s.queue, topic] });
    return true;
  },
  dismissTip: () => set((s) => ({ queue: s.queue.slice(1) })),
  finishIntro: () => set({ introSeen: true }),
  loadFrom: (save) => set({ step: save.step, completed: save.completed, seenTopics: [...save.seenTopics], introSeen: save.introSeen, queue: [] }),
  serialize: () => {
    const s = get();
    return { step: s.step, completed: s.completed, seenTopics: s.seenTopics, introSeen: s.introSeen };
  },
}));

export function currentTutorialStep() {
  const s = useTutorialStore.getState();
  return s.completed || !useSettingsStore.getState().tips ? null : (TUTORIAL_STEPS[s.step] ?? null);
}
