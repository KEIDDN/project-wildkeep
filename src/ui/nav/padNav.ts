import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { PAD_CONFIG, installNav, onDeviceChange, usingGamepad } from "../../game/input/gamepad";
import { audio } from "../../game/audio/AudioManager";
import { useUiStore, type PanelId } from "../../store/uiStore";

/**
 * Controller menus. Every window registers a *layer* (Panel does it for you);
 * the top layer owns the controller while it's open:
 *
 *   d-pad / left stick  move between buttons (spatially, like a TV remote)
 *   ✕ / A               press the focused thing
 *   ○ / B, Options      back / close
 *   □ / X               its right-click menu, if it has one
 *   L1 / R1             flip between Bag · Character · Skills · Journal · Map
 *                       (or the window's own tabs elsewhere)
 *   L2 / R2             the window's own tabs
 *   right stick         scroll
 *
 * It works on the real DOM (any <button>, [data-nav], input, <summary>), so
 * windows don't need a controller version: they only opt into extras
 * (inventory pick-up/place, sorting…) through layer options.
 */

export type NavDir = "up" | "down" | "left" | "right";

export interface NavHint {
  codes: string[];
  label: string;
}

export interface NavOptions {
  /** Pick something to focus as soon as the layer opens (default true). */
  autoFocus?: boolean;
  initial?: () => HTMLElement | null;
  /** ✕ / A. Return true when handled (skips the default click). */
  onConfirm?: (el: HTMLElement | null) => boolean | void;
  /** ○ / B. null = nothing (e.g. the death screen). Default: click [data-nav-back]. */
  onCancel?: (() => void) | null;
  /** Any other button (pad:x, pad:y…). Return true when handled. */
  onButton?: (code: string, el: HTMLElement | null) => boolean | void;
  /** Direction pressed; return true to take over (e.g. carrying an item). */
  onMove?: (dir: NavDir, el: HTMLElement | null) => boolean | void;
  onFocus?: (el: HTMLElement) => void;
  /** Extra button hints for the hint bar. */
  hints?: () => NavHint[];
  /** L1/R1 flip between the main menu pages. */
  pages?: boolean;
}

interface Layer {
  id: number;
  root: () => HTMLElement | null;
  opts: () => NavOptions;
  focus: HTMLElement | null;
  /** The focused button was usable when we landed on it (see frame()). */
  focusWasEnabled: boolean;
}

const stack: Layer[] = [];
let nextId = 1;
let version = 0;
const subs = new Set<() => void>();
function bump() {
  version++;
  subs.forEach((f) => f());
}

/** Registers a navigation layer; returns its remover. */
export function pushNavLayer(root: () => HTMLElement | null, opts: () => NavOptions): () => void {
  const layer: Layer = { id: nextId++, root, opts, focus: null, focusWasEnabled: false };
  stack.push(layer);
  bump();
  return () => {
    const i = stack.indexOf(layer);
    if (i >= 0) stack.splice(i, 1);
    layer.focus?.classList.remove("pad-focus");
    bump();
  };
}

/** React: make `ref` a navigation layer while mounted (and `enabled`). */
export function useNavLayer(ref: RefObject<HTMLElement | null>, opts: NavOptions = {}, enabled = true): void {
  const o = useRef(opts);
  o.current = opts;
  useEffect(() => {
    if (!enabled) return;
    return pushNavLayer(
      () => ref.current,
      () => o.current,
    );
  }, [ref, enabled]);
}

function topLayer(): Layer | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const r = stack[i].root();
    if (r?.isConnected) return stack[i];
  }
  return null;
}

export const navActive = () => topLayer() !== null;

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

const FOCUSABLE = "button, [data-nav], input:not([type=hidden]), select, summary, a[href]";

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
    // Off-screen but inside a scroller is fine: we'll scroll to it.
    if (!scrollParent(el)) return false;
  }
  return getComputedStyle(el).visibility !== "hidden";
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // The title-bar ✕ is ○'s job; [data-nav="off"] opts out (and its subtree).
    (el) => !el.classList.contains("panel-close") && !el.closest('[data-nav="off"]') && visible(el),
  );
}

const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";

function initialFocus(layer: Layer, root: HTMLElement): HTMLElement | null {
  const want = layer.opts().initial?.() ?? root.querySelector<HTMLElement>("[data-nav-default]");
  if (want && want.isConnected && visible(want)) return want;
  const list = focusables(root).filter((el) => !el.classList.contains("tab"));
  return list.find((el) => !isDisabled(el)) ?? list[0] ?? null;
}

function setFocus(layer: Layer, el: HTMLElement | null) {
  if (layer.focus === el) return;
  layer.focus?.classList.remove("pad-focus");
  layer.focus = el;
  layer.focusWasEnabled = !!el && !isDisabled(el);
  if (el) {
    el.classList.add("pad-focus");
    // Real focus too (map markers, talent nodes react to it) — never for text fields.
    if (!isDisabled(el) && !(el instanceof HTMLInputElement && el.type === "text")) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    layer.opts().onFocus?.(el);
  }
  bump();
}

/** The element the controller is on in the top window (for panels' own logic). */
export function navFocus(): HTMLElement | null {
  return topLayer()?.focus ?? null;
}

/** Point the controller at `el` (e.g. after a panel re-arranges itself). */
export function setNavFocus(el: HTMLElement | null): void {
  const top = topLayer();
  if (top) setFocus(top, el);
}

/** Closest element from `cur` in `dir`: things in line win, then distance. */
function spatial(cur: HTMLElement, list: HTMLElement[], dir: NavDir): HTMLElement | null {
  const a = cur.getBoundingClientRect();
  const acx = a.left + a.width / 2;
  const acy = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur || el.contains(cur) || cur.contains(el)) continue;
    const b = el.getBoundingClientRect();
    const bcx = b.left + b.width / 2;
    const bcy = b.top + b.height / 2;
    let along: number;
    let across: number;
    let overlap: boolean;
    if (dir === "right" || dir === "left") {
      if (dir === "right" ? bcx <= acx + 1 : bcx >= acx - 1) continue;
      along = dir === "right" ? b.left - a.right : a.left - b.right;
      across = Math.abs(bcy - acy);
      overlap = b.top < a.bottom - 2 && b.bottom > a.top + 2;
    } else {
      if (dir === "down" ? bcy <= acy + 1 : bcy >= acy - 1) continue;
      along = dir === "down" ? b.top - a.bottom : a.top - b.bottom;
      across = Math.abs(bcx - acx);
      overlap = b.left < a.right - 2 && b.right > a.left + 2;
    }
    along = Math.max(0, along);
    const score = overlap ? along + across * 0.25 : along + across * 2 + 30;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p && p !== document.body; p = p.parentElement) {
    if (p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

function scrollerIn(root: HTMLElement, from: HTMLElement | null): HTMLElement | null {
  const own = scrollParent(from);
  if (own && root.contains(own)) return own;
  if (root.scrollHeight > root.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(root).overflowY)) return root;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (el.scrollHeight > el.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const tick = () => audio.sfx("ui", { volume: 0.35, pitch: 1.5 });

function stepRange(el: HTMLInputElement, dir: number) {
  const step = Number(el.step) || 1;
  const v = Math.min(Number(el.max || 100), Math.max(Number(el.min || 0), Number(el.value) + dir * step));
  // React tracks the value itself: go through the native setter so onChange fires.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, String(v));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  tick();
}

function move(dir: NavDir) {
  const top = topLayer();
  const root = top?.root();
  if (!top || !root) return;
  const cur = top.focus;
  if (top.opts().onMove?.(dir, cur)) return;
  if (cur instanceof HTMLInputElement && cur.type === "range" && (dir === "left" || dir === "right")) return stepRange(cur, dir === "right" ? 1 : -1);
  if (!cur) return setFocus(top, initialFocus(top, root));
  const next = spatial(cur, focusables(root), dir);
  if (next) {
    setFocus(top, next);
    tick();
  }
}

function confirm() {
  const top = topLayer();
  const root = top?.root();
  if (!top || !root) return;
  const el = top.focus;
  if (top.opts().onConfirm?.(el)) return;
  if (!el) return setFocus(top, initialFocus(top, root));
  if (isDisabled(el)) return audio.sfx("deny");
  if (el instanceof HTMLInputElement && el.type === "range") return;
  if (el instanceof HTMLSelectElement) {
    el.selectedIndex = (el.selectedIndex + 1) % Math.max(1, el.options.length);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  el.click();
}

function cancel() {
  const top = topLayer();
  const root = top?.root();
  if (!top || !root) return;
  const o = top.opts();
  if (o.onCancel === null) return;
  if (o.onCancel) return o.onCancel();
  root.querySelector<HTMLElement>("[data-nav-back]")?.click();
}

/** □ / X on something with a right-click menu opens it, at the element. */
function contextMenu(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.bottom + 2, button: 2 }));
}

/** Clicks the next / previous `.tabs .tab` of the window. */
function cycleTabs(root: HTMLElement, delta: number): boolean {
  const group = root.querySelector(".tabs");
  if (!group) return false;
  const tabs = Array.from(group.querySelectorAll<HTMLElement>(".tab")).filter((el) => visible(el) && !isDisabled(el));
  if (tabs.length < 2) return false;
  const i = Math.max(0, tabs.findIndex((el) => el.classList.contains("active")));
  tabs[(i + delta + tabs.length) % tabs.length].click();
  tick();
  refocusSoon = true;
  return true;
}

/** The game menu, one strip of pages (see ui/components/MenuStrip):
 * Bag · Character · Skills · Journal · Map · Help · Menu. L1/R1 flip between them. */
export const MENU_PAGES: PanelId[] = ["inventory", "character", "skills", "journal", "map", "help", "settings"];

function cyclePage(delta: number): boolean {
  const ui = useUiStore.getState();
  const i = MENU_PAGES.indexOf(ui.activePanel as PanelId);
  if (i < 0) return false;
  ui.openPanel(MENU_PAGES[(i + delta + MENU_PAGES.length) % MENU_PAGES.length]);
  audio.sfx("ui");
  return true;
}

let refocusSoon = false;

/** One new controller press while a window is open. False = not ours (the game gets it). */
function press(code: string): boolean {
  const top = topLayer();
  const root = top?.root();
  if (!top || !root) return false;
  switch (code) {
    case "pad:up":
    case "pad:down":
    case "pad:left":
    case "pad:right":
    case "pad:lsup":
    case "pad:lsdown":
    case "pad:lsleft":
    case "pad:lsright":
      return true; // handled with repeat in frame()
    case "pad:a":
      confirm();
      return true;
    case "pad:b":
    case "pad:start":
      cancel();
      return true;
  }
  const o = top.opts();
  if (o.onButton?.(code, top.focus)) return true;
  switch (code) {
    case "pad:x":
      if (top.focus) contextMenu(top.focus);
      return true;
    case "pad:y":
      return true;
    case "pad:lb":
    case "pad:rb":
      if (!(o.pages && cyclePage(code === "pad:rb" ? 1 : -1))) cycleTabs(root, code === "pad:rb" ? 1 : -1);
      return true;
    case "pad:lt":
    case "pad:rt":
      cycleTabs(root, code === "pad:rt" ? 1 : -1);
      return true;
  }
  return false;
}

// Held-direction repeat.
let heldDir: NavDir | null = null;
let repeatIn = 0;
let lastTop = 0;

function dirFrom(held: ReadonlySet<string>, lx: number, ly: number): NavDir | null {
  if (held.has("pad:up")) return "up";
  if (held.has("pad:down")) return "down";
  if (held.has("pad:left")) return "left";
  if (held.has("pad:right")) return "right";
  const m = Math.hypot(lx, ly);
  if (m < PAD_CONFIG.navThreshold) return null;
  return Math.abs(lx) > Math.abs(ly) ? (lx < 0 ? "left" : "right") : ly < 0 ? "up" : "down";
}

function frame(dt: number, s: { lx: number; ly: number; rx: number; ry: number }, held: ReadonlySet<string>) {
  const top = topLayer();
  const root = top?.root();
  // Only the top window shows a focus ring.
  for (const l of stack) if (l !== top) l.focus?.classList.remove("pad-focus");
  if (!top || !root) return;
  top.focus?.classList.add("pad-focus");

  const dir = dirFrom(held, s.lx, s.ly);
  // Controller idle (keyboard / mouse in use): don't touch focus at all, or
  // Space / Enter would press whatever button we'd moved it to.
  if (!usingGamepad()) {
    lastTop = top.id;
    heldDir = dir;
    repeatIn = Infinity;
    return;
  }
  if (top.id !== lastTop) {
    // A new window: whatever direction is already held (you were walking)
    // must be let go before it steps through the menu.
    lastTop = top.id;
    heldDir = dir;
    repeatIn = Infinity;
  } else if (dir !== heldDir) {
    heldDir = dir;
    repeatIn = PAD_CONFIG.repeatDelay;
    if (dir) move(dir);
  } else if (dir) {
    repeatIn -= dt;
    if (repeatIn <= 0) {
      repeatIn = PAD_CONFIG.repeatRate;
      move(dir);
    }
  }

  // Keep the focus on something that exists (tabs switch, rows get sold…).
  const f = top.focus;
  // The button went grey under you (hand over, wheel spinning): hop to one that works.
  if (f && top.focusWasEnabled && isDisabled(f)) {
    const alt = initialFocus(top, root);
    if (alt && !isDisabled(alt)) setFocus(top, alt);
    else top.focusWasEnabled = false;
  }
  if (refocusSoon || (f && (!f.isConnected || !root.contains(f) || !visible(f)))) {
    // Same slot re-rendered (an item moved in or out of it): stay on it.
    const key = !refocusSoon && f ? (f.dataset.drop ?? f.dataset.navKey) : undefined;
    const again = key ? root.querySelector<HTMLElement>(`[data-drop="${key}"], [data-nav-key="${key}"]`) : null;
    refocusSoon = false;
    top.focus?.classList.remove("pad-focus");
    top.focus = null;
    if (again && visible(again)) setFocus(top, again);
  }
  if (!top.focus && top.opts().autoFocus !== false) setFocus(top, initialFocus(top, root));

  if (Math.abs(s.ry) > 0.25) {
    const sc = scrollerIn(root, top.focus);
    if (sc) sc.scrollTop += Math.sign(s.ry) * (Math.abs(s.ry) - 0.25) * PAD_CONFIG.scrollSpeed * dt;
  }
}

/** Hints for the bar at the bottom of the screen. */
export function navHints(labels: { select: string; back: string; tabs: string; pages: string; scroll: string }): NavHint[] {
  const top = topLayer();
  const root = top?.root();
  if (!top || !root) return [];
  const o = top.opts();
  const extra = o.hints?.() ?? [];
  // A window's own label for ✕ / ○ replaces the generic one.
  const own = (code: string) => extra.some((h) => h.codes.includes(code));
  const out: NavHint[] = [];
  if (!own("pad:a")) out.push({ codes: ["pad:a"], label: labels.select });
  if (o.onCancel !== null && !own("pad:b")) out.push({ codes: ["pad:b"], label: labels.back });
  out.push(...extra);
  const tabs = (root.querySelector(".tabs")?.querySelectorAll(".tab").length ?? 0) > 1;
  if (o.pages) out.push({ codes: ["pad:lb", "pad:rb"], label: labels.pages });
  if (tabs) out.push({ codes: o.pages ? ["pad:lt", "pad:rt"] : ["pad:lb", "pad:rb"], label: labels.tabs });
  if (scrollerIn(root, top.focus)) out.push({ codes: ["pad:rstick"], label: labels.scroll });
  return out;
}

/** React: re-render when layers or focus change. */
export function useNavVersion(): number {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => version,
  );
}

installNav({ active: navActive, press, frame });

// Back on the keyboard: drop DOM focus so Space / Enter don't press whatever
// button the controller left focused.
onDeviceChange((d) => {
  if (d !== "keyboard") return;
  const a = document.activeElement as HTMLElement | null;
  if (a?.classList.contains("pad-focus")) a.blur();
});
