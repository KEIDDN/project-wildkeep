import { create } from "zustand";
import type { SceneId } from "../game/core/types";

export type PanelId =
  | "inventory"
  | "equipment"
  | "shop"
  | "blacksmith"
  | "house"
  | "combat"
  | "dungeonResult"
  | null;

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "loot" | "levelup" | "warning";
}

interface GameState {
  scene: SceneId;
  activePanel: PanelId;
  interactionPrompt: string | null;
  toasts: Toast[];

  setScene: (scene: SceneId) => void;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  setInteractionPrompt: (label: string | null) => void;
  pushToast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useGameStore = create<GameState>((set) => ({
  scene: "town",
  activePanel: null,
  interactionPrompt: null,
  toasts: [],

  setScene: (scene) => set({ scene, activePanel: null }),
  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null }),
  setInteractionPrompt: (label) => set({ interactionPrompt: label }),

  pushToast: (text, kind = "info") =>
    set((state) => ({
      toasts: [...state.toasts, { id: ++toastId, text, kind }],
    })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
