import { create } from "zustand";
import type { Rarity } from "../game/core/types";
import type { Action } from "../game/input/bindings";

export type PanelId =
  | "inventory"
  | "shop"
  | "crafting"
  | "stash"
  | "tavern"
  | "blackjack"
  | "roulette"
  | "backRoom"
  | "house"
  | "skills"
  | "dungeonResult"
  | "death"
  | "settings"
  | "dialogue"
  | "dungeonGate"
  | "floorCleared"
  | "mineLift"
  | "journal"
  | "help"
  | "debug"
  | "board"
  | "intro"
  | "character"
  | "map"
  | "repair";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "loot" | "levelup" | "warning" | "gold";
  icon?: string;
  rarity?: Rarity;
  /** Item pickups of the same kind collapse into one running total. */
  itemId?: string;
  qty?: number;
}

export interface LootReveal {
  id: number;
  itemId: string;
  quantity: number;
}

export interface Dialogue {
  speaker: string;
  portrait?: string; // icon id
  lines: string[];
  /** Optional panel to open when the dialogue ends. */
  next?: PanelId;
  nextData?: Record<string, unknown>;
  /** Buttons shown on the last line (quest offers, choices, gifts…). */
  choices?: DialogueChoice[];
  /** Runs when the last line is dismissed (not when a choice is picked). */
  onEnd?: () => void;
}

export interface DialogueChoice {
  label: string;
  /** Tints the button: good deeds green, shady ones red. */
  tone?: "good" | "bad" | "neutral";
  disabled?: boolean;
  /** May open another dialogue; otherwise the dialogue closes. */
  onChoose: () => void;
}

export interface InteractionPrompt {
  verb: string;
  target: string;
  blocked?: string; // reason it can't be done (e.g. "Needs an Iron Pickaxe")
  /** A second action on another key (G: give a gift). Stored as the action so
   * the hint follows remaps and keyboard ↔ controller switches. */
  alt?: { action: Action; label: string };
  /** The target explains its own block when used (resource nodes shake and
   * say which tool they need), so E still goes to it. */
  selfHandled?: boolean;
}

interface UiState {
  activePanel: PanelId | null;
  panelData: Record<string, unknown>;
  prompt: InteractionPrompt | null;
  toasts: Toast[];
  lootReveals: LootReveal[];
  dialogue: Dialogue | null;
  areaBanner: { title: string; subtitle?: string; id: number } | null;
  bossBar: { name: string; hp: number; maxHp: number } | null;
  fading: boolean;
  /** Enemies close by (set by the game): tips wait, the HUD stays clear. */
  combat: boolean;

  openPanel: (panel: PanelId, data?: Record<string, unknown>) => void;
  closePanel: () => void;
  setPrompt: (prompt: InteractionPrompt | null) => void;
  pushToast: (text: string, kind?: Toast["kind"], extra?: { icon?: string; rarity?: Rarity }) => void;
  pushItemToast: (itemId: string, name: string, qty: number, icon: string, rarity: Rarity) => void;
  dismissToast: (id: number) => void;
  pushLootReveal: (itemId: string, quantity: number) => void;
  dismissLootReveal: (id: number) => void;
  showDialogue: (d: Dialogue) => void;
  showAreaBanner: (title: string, subtitle?: string) => void;
  setBossBar: (bar: UiState["bossBar"]) => void;
  setFading: (fading: boolean) => void;
}

let nextId = 0;

export const useUiStore = create<UiState>((set, get) => ({
  activePanel: null,
  panelData: {},
  prompt: null,
  toasts: [],
  lootReveals: [],
  dialogue: null,
  areaBanner: null,
  bossBar: null,
  fading: false,
  combat: false,

  openPanel: (panel, data = {}) => set({ activePanel: panel, panelData: data }),
  closePanel: () => set({ activePanel: null, panelData: {}, dialogue: get().activePanel === "dialogue" ? null : get().dialogue }),

  setPrompt: (prompt) => {
    const cur = get().prompt;
    if (cur?.verb === prompt?.verb && cur?.target === prompt?.target && cur?.blocked === prompt?.blocked) return;
    set({ prompt });
  },

  pushToast: (text, kind = "info", extra) =>
    set((state) => ({ toasts: [...state.toasts.slice(-5), { id: ++nextId, text, kind, ...extra }] })),
  pushItemToast: (itemId, name, qty, icon, rarity) =>
    set((state) => {
      const last = state.toasts[state.toasts.length - 1];
      if (last?.itemId === itemId) {
        const total = (last.qty ?? 0) + qty;
        const merged = { ...last, id: ++nextId, qty: total, text: `+${total} ${name}` };
        return { toasts: [...state.toasts.slice(0, -1), merged] };
      }
      return { toasts: [...state.toasts.slice(-5), { id: ++nextId, text: `+${qty} ${name}`, kind: "loot", icon, rarity, itemId, qty }] };
    }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  pushLootReveal: (itemId, quantity) =>
    set((state) => ({ lootReveals: [...state.lootReveals, { id: ++nextId, itemId, quantity }] })),
  dismissLootReveal: (id) => set((state) => ({ lootReveals: state.lootReveals.filter((l) => l.id !== id) })),

  showDialogue: (d) => set({ dialogue: d, activePanel: "dialogue", panelData: {} }),
  showAreaBanner: (title, subtitle) => set({ areaBanner: { title, subtitle, id: ++nextId } }),
  setBossBar: (bar) => {
    const cur = get().bossBar;
    if (cur === bar || (cur && bar && cur.hp === bar.hp && cur.name === bar.name && cur.maxHp === bar.maxHp)) return;
    set({ bossBar: bar });
  },
  setFading: (fading) => set({ fading }),
}));

/** True when a modal UI should freeze player control. */
export function isUiBlocking(): boolean {
  const s = useUiStore.getState();
  return s.activePanel !== null;
}
