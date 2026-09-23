import { create } from "zustand";
import { getItem } from "../data/items";
import type { InventoryStack } from "../game/save/schema";

interface InventoryState {
  stacks: InventoryStack[];
  addItem: (itemId: string, quantity?: number) => void;
  removeItem: (itemId: string, quantity?: number) => boolean;
  quantityOf: (itemId: string) => number;
  hasItem: (itemId: string, quantity?: number) => boolean;
  loadFrom: (stacks: InventoryStack[]) => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stacks: [],

  addItem: (itemId, quantity = 1) => {
    if (quantity <= 0) return;
    const def = getItem(itemId);
    set((state) => {
      const stacks = [...state.stacks];
      if (def.stackable) {
        const idx = stacks.findIndex((s) => s.itemId === itemId);
        if (idx >= 0) {
          stacks[idx] = {
            ...stacks[idx],
            quantity: Math.min(def.maxStack, stacks[idx].quantity + quantity),
          };
          return { stacks };
        }
        stacks.push({ itemId, quantity: Math.min(def.maxStack, quantity) });
        return { stacks };
      }
      for (let i = 0; i < quantity; i++) {
        stacks.push({ itemId, quantity: 1 });
      }
      return { stacks };
    });
  },

  removeItem: (itemId, quantity = 1) => {
    const current = get().quantityOf(itemId);
    if (current < quantity) return false;
    set((state) => {
      let remaining = quantity;
      const stacks: InventoryStack[] = [];
      for (const stack of state.stacks) {
        if (stack.itemId !== itemId || remaining <= 0) {
          stacks.push(stack);
          continue;
        }
        if (stack.quantity > remaining) {
          stacks.push({ ...stack, quantity: stack.quantity - remaining });
          remaining = 0;
        } else {
          remaining -= stack.quantity;
        }
      }
      return { stacks };
    });
    return true;
  },

  quantityOf: (itemId) =>
    get().stacks.reduce(
      (sum, s) => (s.itemId === itemId ? sum + s.quantity : sum),
      0,
    ),

  hasItem: (itemId, quantity = 1) => get().quantityOf(itemId) >= quantity,

  loadFrom: (stacks) => set({ stacks: [...stacks] }),
}));
