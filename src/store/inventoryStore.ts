import { create } from "zustand";
import { getItem } from "../data/items";
import type { InventoryStack } from "../game/save/schema";
import { useWorldStore } from "./worldStore";

/** Which copies a removal may take: any, only honest ones, or only stolen. */
export type StolenFilter = "any" | "clean" | "stolen";

interface InventoryState {
  stacks: InventoryStack[];
  addItem: (itemId: string, quantity?: number, opts?: { stolen?: boolean; dur?: number }) => void;
  /** Takes out one particular stack (a specific piece of gear). */
  takeStack: (index: number) => InventoryStack | null;
  setStackDur: (index: number, dur: number | undefined) => void;
  removeItem: (itemId: string, quantity?: number, filter?: StolenFilter) => boolean;
  quantityOf: (itemId: string, filter?: StolenFilter) => number;
  hasItem: (itemId: string, quantity?: number) => boolean;
  loadFrom: (stacks: InventoryStack[]) => void;
}

const matches = (s: InventoryStack, itemId: string, filter: StolenFilter) =>
  s.itemId === itemId && (filter === "any" || (filter === "stolen") === !!s.stolen);

export function addToStacks(stacks: InventoryStack[], itemId: string, quantity: number, stolen = false, dur?: number): InventoryStack[] {
  if (quantity <= 0) return stacks;
  const def = getItem(itemId);
  const next = [...stacks];
  const extra = stolen ? { stolen: true } : {};
  if (def.stackable) {
    // Stolen goods keep their own stack.
    const idx = next.findIndex((s) => s.itemId === itemId && !!s.stolen === stolen);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: Math.min(def.maxStack, next[idx].quantity + quantity) };
    } else {
      next.push({ itemId, quantity: Math.min(def.maxStack, quantity), ...extra });
    }
    return next;
  }
  for (let i = 0; i < quantity; i++) next.push({ itemId, quantity: 1, ...extra, ...(dur !== undefined ? { dur } : {}) });
  return next;
}

/** Removes `quantity` copies (honest ones first unless filtered). Returns
 * null, changing nothing, if there aren't enough. */
export function removeFromStacks(stacks: InventoryStack[], itemId: string, quantity: number, filter: StolenFilter = "any"): InventoryStack[] | null {
  const owned = stacks.reduce((sum, s) => (matches(s, itemId, filter) ? sum + s.quantity : sum), 0);
  if (owned < quantity) return null;
  let remaining = quantity;
  const take = new Map<InventoryStack, number>();
  // Spend honest copies before stolen ones.
  for (const pass of [false, true]) {
    for (const stack of stacks) {
      if (remaining <= 0 || !matches(stack, itemId, filter) || !!stack.stolen !== pass) continue;
      const n = Math.min(stack.quantity, remaining);
      take.set(stack, n);
      remaining -= n;
    }
  }
  const next: InventoryStack[] = [];
  for (const stack of stacks) {
    const n = take.get(stack) ?? 0;
    if (n === 0) {
      next.push(stack);
      continue;
    }
    if (stack.quantity > n) next.push({ ...stack, quantity: stack.quantity - n });
  }
  return next;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stacks: [],

  addItem: (itemId, quantity = 1, opts) => {
    // Everything that passes through your bag goes in the journal collection.
    if (quantity > 0) useWorldStore.getState().discover(`item:${itemId}`);
    set((state) => ({ stacks: addToStacks(state.stacks, itemId, quantity, !!opts?.stolen, opts?.dur) }));
  },

  takeStack: (index) => {
    const st = get().stacks[index];
    if (!st) return null;
    if (st.quantity > 1) {
      set({ stacks: get().stacks.map((x, i) => (i === index ? { ...x, quantity: x.quantity - 1 } : x)) });
      return { ...st, quantity: 1 };
    }
    set({ stacks: get().stacks.filter((_, i) => i !== index) });
    return st;
  },

  setStackDur: (index, dur) =>
    set((state) => ({
      stacks: state.stacks.map((x, i) => {
        if (i !== index) return x;
        const { dur: _old, ...rest } = x;
        void _old;
        return dur === undefined ? rest : { ...rest, dur: Math.round(dur * 10) / 10 };
      }),
    })),

  removeItem: (itemId, quantity = 1, filter = "any") => {
    const next = removeFromStacks(get().stacks, itemId, quantity, filter);
    if (!next) return false;
    set({ stacks: next });
    return true;
  },

  quantityOf: (itemId, filter = "any") => get().stacks.reduce((sum, s) => (matches(s, itemId, filter) ? sum + s.quantity : sum), 0),

  hasItem: (itemId, quantity = 1) => get().quantityOf(itemId) >= quantity,

  loadFrom: (stacks) => set({ stacks: [...stacks] }),
}));
