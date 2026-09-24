import { useSettingsStore } from "../../store/settingsStore";

/**
 * Actions, not keys. Gameplay asks "is ATTACK held?", never "is Space
 * held?", so players can remap anything from Settings → Controls and a
 * gamepad can later feed the same actions (codes like "pad:a" would slot in
 * next to "mouse0").
 *
 * A binding is a list of input codes: a lowercased `KeyboardEvent.key`
 * (" " for Space, "arrowup", "shift", "e"…) or a mouse button ("mouse0" left,
 * "mouse2" right). The first code is the one shown in hints.
 */
export type Action =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "sprint"
  | "attack"
  | "dodge"
  | "parry"
  | "ability"
  | "cast"
  | "interact"
  | "gift"
  | "potion"
  | "inventory"
  | "character"
  | "skills"
  | "journal"
  | "map"
  | "help";

/** Defaults — the controls the game has always had (plus M map, V parry, C character, X spell). */
export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  moveUp: ["w", "arrowup"],
  moveDown: ["s", "arrowdown"],
  moveLeft: ["a", "arrowleft"],
  moveRight: ["d", "arrowright"],
  sprint: ["shift"],
  attack: [" ", "j", "mouse0"],
  dodge: ["f", "mouse2"],
  parry: ["v"],
  ability: ["r"],
  cast: ["x"],
  interact: ["e", "enter"],
  gift: ["g"],
  potion: ["q"],
  inventory: ["i", "tab"],
  character: ["c"],
  skills: ["k"],
  journal: ["l"],
  map: ["m"],
  help: ["h"],
};

/** Grouped for the Controls screen. */
export const ACTION_GROUPS: { id: "movement" | "combat" | "world" | "menus"; actions: Action[] }[] = [
  { id: "movement", actions: ["moveUp", "moveDown", "moveLeft", "moveRight", "sprint"] },
  { id: "combat", actions: ["attack", "dodge", "parry", "ability", "cast", "potion"] },
  { id: "world", actions: ["interact", "gift"] },
  { id: "menus", actions: ["inventory", "character", "skills", "journal", "map", "help"] },
];

/** Keys that can never be bound (Escape is always the menu / back key). */
export const RESERVED = new Set(["escape", "`", "meta", "os", "contextmenu"]);

/** Current binding for an action (player overrides on top of the defaults). */
export function bindingOf(action: Action): string[] {
  return useSettingsStore.getState().bindings?.[action] ?? DEFAULT_BINDINGS[action];
}

/** Every action → codes, resolved. */
export function allBindings(): Record<Action, string[]> {
  const out = {} as Record<Action, string[]>;
  for (const a of Object.keys(DEFAULT_BINDINGS) as Action[]) out[a] = bindingOf(a);
  return out;
}

/**
 * Binds `code` as the primary input of `action`. If another action already
 * used that code, it's taken from it (and that action gets this one's old
 * primary instead, so nothing is left without a key when possible).
 */
export function rebind(action: Action, code: string, slot = 0): void {
  const cur = allBindings();
  const old = cur[action][slot];
  const next: Partial<Record<Action, string[]>> = { ...useSettingsStore.getState().bindings };
  for (const a of Object.keys(cur) as Action[]) {
    if (a === action || !cur[a].includes(code)) continue;
    const list = cur[a].filter((c) => c !== code);
    // Swap: give the other action the key we're replacing, if it has nothing left.
    if (!list.length && old && old !== code) list.push(old);
    next[a] = list;
  }
  const mine = [...cur[action]];
  if (slot >= mine.length) mine.push(code);
  else mine[slot] = code;
  next[action] = [...new Set(mine)];
  useSettingsStore.getState().update({ bindings: next });
}

/** Removes one input from an action (keeps at least one). */
export function unbind(action: Action, slot: number): void {
  const cur = bindingOf(action);
  if (cur.length <= 1) return;
  const next = { ...useSettingsStore.getState().bindings, [action]: cur.filter((_, i) => i !== slot) };
  useSettingsStore.getState().update({ bindings: next });
}

export function resetBindings(): void {
  useSettingsStore.getState().update({ bindings: {} });
}

/** Normalises a keyboard event into a binding code. */
export function codeOf(e: KeyboardEvent): string {
  if (e.key === "Shift") return "shift";
  if (e.key === "Control") return "control";
  if (e.key === "Alt") return "alt";
  return e.key.toLowerCase();
}

/** True if this keyboard event triggers the action (for React key handlers). */
export function eventIs(e: KeyboardEvent, action: Action): boolean {
  return bindingOf(action).includes(codeOf(e));
}

const LABELS_EN: Record<string, string> = {
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  shift: "Shift",
  control: "Ctrl",
  alt: "Alt",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  mouse0: "Left click",
  mouse1: "Middle click",
  mouse2: "Right click",
};
const LABELS_ES: Record<string, string> = {
  ...LABELS_EN,
  " ": "Espacio",
  shift: "Mayús",
  enter: "Intro",
  tab: "Tab",
  backspace: "Retroceso",
  mouse0: "Clic izq.",
  mouse1: "Clic central",
  mouse2: "Clic der.",
};

/** Human label of one code ("Space", "E", "Left click"). */
export function codeLabel(code: string): string {
  const table = useSettingsStore.getState().language === "es" ? LABELS_ES : LABELS_EN;
  return table[code] ?? (code.length === 1 ? code.toUpperCase() : code[0].toUpperCase() + code.slice(1));
}

/** Label of an action's main key — what hints should show. */
export function keyLabel(action: Action): string {
  const b = bindingOf(action);
  // Prefer a keyboard key over a mouse button for hints.
  const code = b.find((c) => !c.startsWith("mouse")) ?? b[0];
  return code ? codeLabel(code) : "—";
}

export function isAction(s: string): s is Action {
  return s in DEFAULT_BINDINGS;
}
