import { getItem, type EquipSlot } from "../../data/items";
import type { Rarity } from "../core/types";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useUiStore } from "../../store/uiStore";
import { rank } from "../../data/talents";
import { itemName } from "../../i18n/content";
import { t } from "../../i18n";
import { showTutorial } from "../tutorial";
import { gameEvents } from "../events";

/**
 * Wear and tear. Weapons, armour and tools slowly wear out with use and get
 * worse as they do — never lost, just blunt, dented and eventually broken
 * until a smith (or a kit) sets them right.
 *
 *   USE → wears down → REPAIR (gold, materials) → keep adventuring
 *
 * Durability lives with the item: in `playerStore.wear[slot]` while worn,
 * in `InventoryStack.dur` while carried. Missing means "like new", so
 * older saves need no migration.
 */
export const DURABLE_SLOTS: EquipSlot[] = ["weapon", "head", "armor", "boots", "tool"];

const BY_RARITY: Record<Rarity, number> = { common: 150, uncommon: 220, rare: 300, epic: 400, legendary: 520 };

export type WearState = "fine" | "worn" | "damaged" | "broken";

/** 0 for things that don't wear (relics, rings, materials). */
export function maxDurability(itemId: string): number {
  const def = getItem(itemId);
  if (!def.equipSlot || !DURABLE_SLOTS.includes(def.equipSlot) || def.keyItem) return 0;
  return BY_RARITY[def.rarity];
}

export function wearState(cur: number, max: number): WearState {
  if (max <= 0) return "fine";
  if (cur <= 0) return "broken";
  if (cur < max * 0.25) return "damaged";
  if (cur < max * 0.5) return "worn";
  return "fine";
}

/** How much of a piece's stat bonus still works. */
export const WEAR_STAT: Record<WearState, number> = { fine: 1, worn: 0.9, damaged: 0.75, broken: 0.4 };
/** How well a tool still bites. */
export const WEAR_TOOL: Record<WearState, number> = { fine: 1, worn: 1, damaged: 0.85, broken: 0.5 };

/** Current durability of what's in a slot (max if unworn / not durable). */
export function durabilityOf(slot: EquipSlot): number {
  const s = usePlayerStore.getState();
  const id = s.equipment[slot];
  if (!id) return 0;
  const max = maxDurability(id);
  return Math.min(max, s.wear[slot] ?? max);
}

export function slotWearState(slot: EquipSlot): WearState {
  const id = usePlayerStore.getState().equipment[slot];
  return id ? wearState(durabilityOf(slot), maxDurability(id)) : "fine";
}

/** Stat multiplier per slot, for computeEffectiveStats. */
export function wearFactors(equipment: Partial<Record<EquipSlot, string>>, wear: Partial<Record<EquipSlot, number>> | undefined): Partial<Record<EquipSlot, number>> {
  const out: Partial<Record<EquipSlot, number>> = {};
  for (const slot of DURABLE_SLOTS) {
    const id = equipment[slot];
    if (!id) continue;
    const max = maxDurability(id);
    if (!max) continue;
    out[slot] = WEAR_STAT[wearState(Math.min(max, wear?.[slot] ?? max), max)];
  }
  return out;
}

const wearMult = () => 1 - rank(usePlayerStore.getState().talents, "tinkerer") * 0.25;

function announce(itemId: string, before: WearState, after: WearState) {
  if (before !== after && after !== "fine") showTutorial("durability");
  if (before === after || after === "fine" || after === "worn") return;
  const name = itemName(itemId);
  useUiStore.getState().pushToast(after === "broken" ? t("durability.broke", { name }) : t("durability.damaged", { name }), "warning", { icon: getItem(itemId).icon });
}

/** Wears down whatever is in a slot. */
export function wearSlot(slot: EquipSlot, amount: number): void {
  const s = usePlayerStore.getState();
  const id = s.equipment[slot];
  if (!id) return;
  const max = maxDurability(id);
  if (!max) return;
  const cur = Math.min(max, s.wear[slot] ?? max);
  const next = Math.max(0, cur - amount * wearMult());
  s.setWear(slot, next);
  announce(id, wearState(cur, max), wearState(next, max));
}

/** Wears a tool wherever it is: the tool slot, or carried in the bag. */
export function wearTool(itemId: string, amount: number): void {
  const s = usePlayerStore.getState();
  if (s.equipment.tool === itemId) return wearSlot("tool", amount);
  const inv = useInventoryStore.getState();
  const idx = inv.stacks.findIndex((st) => st.itemId === itemId);
  if (idx < 0) return;
  const max = maxDurability(itemId);
  if (!max) return;
  const cur = Math.min(max, inv.stacks[idx].dur ?? max);
  const next = Math.max(0, cur - amount * wearMult());
  inv.setStackDur(idx, next);
  announce(itemId, wearState(cur, max), wearState(next, max));
}

/** Durability of a carried tool (the first copy in the bag, or the tool slot). */
export function toolDurability(itemId: string): { cur: number; max: number } {
  const max = maxDurability(itemId);
  const s = usePlayerStore.getState();
  if (s.equipment.tool === itemId) return { cur: durabilityOf("tool"), max };
  const st = useInventoryStore.getState().stacks.find((x) => x.itemId === itemId);
  return { cur: Math.min(max, st?.dur ?? max), max };
}

/** A hit taken dents one piece of worn armour. */
export function wearArmorFromHit(): void {
  const eq = usePlayerStore.getState().equipment;
  const worn = (["armor", "armor", "head", "boots"] as EquipSlot[]).filter((s) => eq[s]);
  if (worn.length) wearSlot(worn[Math.floor(Math.random() * worn.length)], 1);
}

// ---- repairs -------------------------------------------------------------------------

export interface RepairQuote {
  gold: number;
  mats: { itemId: string; quantity: number }[];
}

/** Rare and better gear that's badly worn needs a matching ingot too. */
const REPAIR_MAT: Partial<Record<Rarity, string>> = { rare: "iron_bar", epic: "silver_bar", legendary: "mithril_bar" };

export function repairQuote(itemId: string, cur: number): RepairQuote | null {
  const max = maxDurability(itemId);
  if (!max || cur >= max) return null;
  const def = getItem(itemId);
  const missing = (max - cur) / max;
  const discount = 1 - rank(usePlayerStore.getState().talents, "tinkerer") * 0.2;
  const gold = Math.max(2, Math.ceil((4 + def.value * 0.3) * missing * discount));
  const mat = REPAIR_MAT[def.rarity];
  return { gold, mats: mat && missing > 0.5 ? [{ itemId: mat, quantity: 1 }] : [] };
}

export function canAfford(q: RepairQuote): boolean {
  const s = usePlayerStore.getState();
  const inv = useInventoryStore.getState();
  return s.gold >= q.gold && q.mats.every((m) => inv.hasItem(m.itemId, m.quantity));
}

function pay(q: RepairQuote): boolean {
  if (!canAfford(q)) return false;
  const inv = useInventoryStore.getState();
  for (const m of q.mats) inv.removeItem(m.itemId, m.quantity);
  return usePlayerStore.getState().spendGold(q.gold);
}

/** Something that could use a smith: equipped slot or bag stack. */
export interface Repairable {
  key: string;
  itemId: string;
  cur: number;
  max: number;
  slot?: EquipSlot;
  stackIndex?: number;
}

export function repairables(): Repairable[] {
  const s = usePlayerStore.getState();
  const out: Repairable[] = [];
  for (const slot of DURABLE_SLOTS) {
    const id = s.equipment[slot];
    if (!id) continue;
    const max = maxDurability(id);
    const cur = durabilityOf(slot);
    if (max && cur < max) out.push({ key: `slot:${slot}`, itemId: id, cur, max, slot });
  }
  useInventoryStore.getState().stacks.forEach((st, i) => {
    const max = maxDurability(st.itemId);
    if (!max || st.dur === undefined || st.dur >= max) return;
    out.push({ key: `bag:${i}`, itemId: st.itemId, cur: st.dur, max, stackIndex: i });
  });
  return out;
}

/** Repair one thing fully (at the forge). */
export function repair(r: Repairable): boolean {
  const q = repairQuote(r.itemId, r.cur);
  if (!q || !pay(q)) return false;
  restore(r, r.max);
  gameEvents.emit("repaired", { itemId: r.itemId });
  return true;
}

function restore(r: Repairable, to: number) {
  if (r.slot) usePlayerStore.getState().setWear(r.slot, Math.min(r.max, to));
  else if (r.stackIndex !== undefined) useInventoryStore.getState().setStackDur(r.stackIndex, Math.min(r.max, to));
}

/** Field repair: a kit or whetstone restores a share of what's worn. */
export function fieldRepair(kind: "kit" | "whetstone"): number {
  const s = usePlayerStore.getState();
  const slots: EquipSlot[] = kind === "whetstone" ? ["weapon", "tool"] : DURABLE_SLOTS;
  let n = 0;
  for (const slot of slots) {
    const id = s.equipment[slot];
    if (!id) continue;
    const max = maxDurability(id);
    const cur = durabilityOf(slot);
    if (!max || cur >= max) continue;
    usePlayerStore.getState().setWear(slot, Math.min(max, cur + max * (kind === "kit" ? 0.4 : 0.3)));
    n++;
  }
  return n;
}
