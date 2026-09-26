import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { getItem } from "../../data/items";

/**
 * Pointer-driven drag & drop for item slots (no HTML5 DnD: its ghost image
 * blurs pixel art and it can't show a red "no" on a slot).
 *
 * A press only becomes a drag after the pointer travels a few pixels, so
 * clicks and double-clicks on slots keep working. Drop targets are plain
 * elements with `data-drop="<id>"`; while hovered they get
 * `data-drop-over="ok" | "bad"` for styling.
 */
export interface DragSpec {
  itemId: string;
  quantity?: number;
  /** Is `target` (a data-drop id) somewhere this item may go? */
  accepts: (target: string) => boolean;
  /** Drop on a valid target. */
  onDrop: (target: string) => void;
  /** Released over an invalid target (not over nothing). */
  onReject?: (target: string) => void;
}

interface Active {
  spec: DragSpec;
  x: number;
  y: number;
}

let active: Active | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

let overEl: HTMLElement | null = null;
function setOver(el: HTMLElement | null, state?: "ok" | "bad") {
  if (overEl && overEl !== el) delete overEl.dataset.dropOver;
  overEl = el;
  if (el && state) el.dataset.dropOver = state;
}

function targetAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return (el?.closest("[data-drop]") as HTMLElement | null) ?? null;
}

/** Start tracking a press on a slot. Call from onPointerDown. */
export function beginItemDrag(e: ReactPointerEvent, spec: DragSpec): void {
  if (e.button !== 0) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let dragging = false;

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      dragging = true;
      document.body.classList.add("dragging-item");
    }
    active = { spec, x: ev.clientX, y: ev.clientY };
    const t = targetAt(ev.clientX, ev.clientY);
    setOver(t, t ? (spec.accepts(t.dataset.drop!) ? "ok" : "bad") : undefined);
    emit();
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    if (!dragging) return;
    const t = targetAt(ev.clientX, ev.clientY);
    finish();
    // The click that follows a drag must not select / trigger the slot.
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    const id = t?.dataset.drop;
    if (!id) return;
    if (spec.accepts(id)) spec.onDrop(id);
    else spec.onReject?.(id);
  };
  const cancel = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    if (dragging) finish();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}

const swallow = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
};

function finish() {
  active = null;
  setOver(null);
  document.body.classList.remove("dragging-item");
  emit();
}

// ---- controller: pick up → move → place --------------------------------------

/**
 * The controller version of a drag: the item is lifted from the focused slot,
 * the ghost hops from slot to slot with the focus, and ✕ drops it using the
 * very same `accepts` / `onDrop` rules as the mouse.
 */
export function beginCarry(spec: DragSpec, at: HTMLElement | null): void {
  active = { spec, x: 0, y: 0 };
  carryTo(at);
}

/** Moves the carried item over `el` (a slot, or anything else). */
export function carryTo(el: HTMLElement | null): void {
  if (!active || !el) return;
  const r = el.getBoundingClientRect();
  active = { ...active, x: r.left + r.width * 0.7, y: r.top + r.height * 0.7 };
  const t = (el.closest("[data-drop]") as HTMLElement | null) ?? null;
  setOver(t, t ? (active.spec.accepts(t.dataset.drop!) ? "ok" : "bad") : undefined);
  emit();
}

/** Drops the carried item on `el`. Returns the drop id it landed on (or null). */
export function dropCarry(el: HTMLElement | null): string | null {
  if (!active) return null;
  const spec = active.spec;
  const id = (el?.closest("[data-drop]") as HTMLElement | null)?.dataset.drop ?? null;
  if (id && !spec.accepts(id)) {
    spec.onReject?.(id);
    return null;
  }
  finish();
  if (id) spec.onDrop(id);
  return id;
}

export function cancelCarry(): void {
  if (active) finish();
}

export const carrying = (): boolean => active !== null;

/** The item being dragged right now, if any (to light up where it fits). */
export const useDraggedItem = () => useSyncExternalStore(subscribe, () => active?.spec.itemId ?? null);

/** The item under the cursor while dragging. Mount once per panel. */
export function DragGhost() {
  const a = useSyncExternalStore(subscribe, () => active);
  if (!a) return null;
  const def = getItem(a.spec.itemId);
  return createPortal(
    <div className="drag-ghost" style={{ left: a.x, top: a.y }}>
      <img src={`/icons/${def.icon}.png`} alt="" />
      {a.spec.quantity !== undefined && a.spec.quantity > 1 && <span className="slot-qty">{a.spec.quantity}</span>}
    </div>,
    document.body,
  );
}
