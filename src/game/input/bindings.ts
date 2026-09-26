import { useSettingsStore } from "../../store/settingsStore";
import { currentDevice, currentFamily, isPadCode, type PadFamily } from "./gamepad";

/**
 * Actions, not keys. Gameplay asks "is ATTACK held?", never "is Space
 * held?", so players can remap anything from Settings → Controls, and a
 * controller feeds the very same actions.
 *
 * A binding is a list of input codes: a lowercased `KeyboardEvent.key`
 * (" " for Space, "arrowup", "shift", "e"…), a mouse button ("mouse0" left,
 * "mouse2" right) or a controller button ("pad:a", "pad:lb", "pad:lsup" — see
 * game/input/gamepad.ts). Keyboard and controller lists are stored and
 * remapped separately; `bindingOf` joins them. The first code of the device
 * in use is the one shown in hints.
 */
export type Action =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "sprint"
  | "attack"
  | "heavy"
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
  // Holding attack still charges a heavy; this is the one-button version.
  heavy: ["b"],
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

/**
 * The controller layout (positional: pad:a is ✕ on PlayStation, A on Xbox).
 * One meaning per button everywhere — exploring, fighting, farming, menus:
 *
 *   □ / X   primary action: swing, or the tool at a tree / rock / plot / water
 *   △ / Y   heavy blow (secondary)          ✕ / A   interact · confirm
 *   ○ / B   dodge · back / cancel           L1 / R1 parry · Whirlwind (menus: pages)
 *   L2 / LT run                             R2 / RT spell (menus: tabs)
 *   d-pad   ↑ potion · ↓ gift · ← map · → quests
 *   Create / View  bag                      Options / Menu  pause (fixed)
 *   touchpad  map                           R3  skills
 *
 * Menu meanings (confirm / back / pages / tabs) are fixed in ui/nav/padNav.
 */
export const DEFAULT_PAD: Record<Action, string[]> = {
  moveUp: ["pad:lsup"],
  moveDown: ["pad:lsdown"],
  moveLeft: ["pad:lsleft"],
  moveRight: ["pad:lsright"],
  sprint: ["pad:lt", "pad:ls"],
  attack: ["pad:x"],
  heavy: ["pad:y"],
  dodge: ["pad:b"],
  parry: ["pad:lb"],
  ability: ["pad:rb"],
  cast: ["pad:rt"],
  interact: ["pad:a"],
  gift: ["pad:down"],
  potion: ["pad:up"],
  inventory: ["pad:select"],
  character: [],
  skills: ["pad:rs"],
  journal: ["pad:right"],
  map: ["pad:left", "pad:touchpad"],
  help: [],
};

/** Grouped for the Controls screen. */
export const ACTION_GROUPS: { id: "movement" | "combat" | "world" | "menus"; actions: Action[] }[] = [
  { id: "movement", actions: ["moveUp", "moveDown", "moveLeft", "moveRight", "sprint"] },
  { id: "combat", actions: ["attack", "heavy", "dodge", "parry", "ability", "cast", "potion"] },
  { id: "world", actions: ["interact", "gift"] },
  { id: "menus", actions: ["inventory", "character", "skills", "journal", "map", "help"] },
];

/** Keys that can never be bound (Escape / Options / Start are always the menu / back key). */
export const RESERVED = new Set(["escape", "`", "meta", "os", "contextmenu", "pad:start", "pad:home"]);

export type BindDevice = "keyboard" | "gamepad";
const deviceOfCode = (code: string): BindDevice => (isPadCode(code) ? "gamepad" : "keyboard");

/** One device's codes for an action (player overrides on top of the defaults). */
export function bindingFor(action: Action, dev: BindDevice): string[] {
  const s = useSettingsStore.getState();
  if (dev === "gamepad") return s.padBindings?.[action] ?? DEFAULT_PAD[action];
  // Older settings could hold mixed lists; keep only keyboard/mouse here.
  return (s.bindings?.[action] ?? DEFAULT_BINDINGS[action]).filter((c) => !isPadCode(c));
}

/** Every code that triggers the action, keyboard and controller alike. */
export function bindingOf(action: Action): string[] {
  return [...bindingFor(action, "keyboard"), ...bindingFor(action, "gamepad")];
}

/** Every action → codes, resolved. */
export function allBindings(): Record<Action, string[]> {
  const out = {} as Record<Action, string[]>;
  for (const a of Object.keys(DEFAULT_BINDINGS) as Action[]) out[a] = bindingOf(a);
  return out;
}

const storeKey = (dev: BindDevice) => (dev === "gamepad" ? "padBindings" : "bindings");

/**
 * Binds `code` to `action` in place of `replace` (or as an extra input when
 * `replace` is omitted). If another action already used that code, it's taken
 * from it (and that action gets the replaced input instead, so nothing is left
 * without a key when possible). Only lists of the same device are touched.
 */
export function rebind(action: Action, code: string, replace?: string): void {
  const dev = deviceOfCode(code);
  const next: Partial<Record<Action, string[]>> = { ...useSettingsStore.getState()[storeKey(dev)] };
  for (const a of Object.keys(DEFAULT_BINDINGS) as Action[]) {
    const list = bindingFor(a, dev);
    if (a === action || !list.includes(code)) continue;
    const rest = list.filter((c) => c !== code);
    // Swap: give the other action the input we're replacing, if it has nothing left.
    if (!rest.length && replace && replace !== code) rest.push(replace);
    next[a] = rest;
  }
  const mine = [...bindingFor(action, dev)];
  const at = replace ? mine.indexOf(replace) : -1;
  if (at >= 0) mine[at] = code;
  else mine.push(code);
  next[action] = [...new Set(mine)];
  useSettingsStore.getState().update({ [storeKey(dev)]: next });
}

/** Removes one input from an action (a keyboard action keeps at least one key). */
export function unbind(action: Action, code: string): void {
  const dev = deviceOfCode(code);
  const cur = bindingFor(action, dev);
  if (dev === "keyboard" && cur.length <= 1) return;
  const next = { ...useSettingsStore.getState()[storeKey(dev)], [action]: cur.filter((c) => c !== code) };
  useSettingsStore.getState().update({ [storeKey(dev)]: next });
}

export function resetBindings(dev?: BindDevice): void {
  if (!dev) useSettingsStore.getState().update({ bindings: {}, padBindings: {} });
  else useSettingsStore.getState().update({ [storeKey(dev)]: {} });
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
  escape: "Esc",
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

/**
 * Controller glyphs. The same physical button reads ✕ on PlayStation and A on
 * Xbox; anything we can't identify gets neutral names. Face buttons of
 * unknown pads use Xbox letters — the layout the standard mapping follows.
 */
const PAD_COMMON: Record<string, string> = {
  "pad:up": "✚↑",
  "pad:down": "✚↓",
  "pad:left": "✚←",
  "pad:right": "✚→",
  "pad:lsup": "L ↑",
  "pad:lsdown": "L ↓",
  "pad:lsleft": "L ←",
  "pad:lsright": "L →",
  "pad:touchpad": "Touchpad",
  "pad:rstick": "R-stick",
  "pad:lstick": "L-stick",
  "pad:home": "Home",
};
const PAD_LABELS: Record<PadFamily, Record<string, string>> = {
  playstation: {
    "pad:a": "✕", "pad:b": "○", "pad:x": "□", "pad:y": "△",
    "pad:lb": "L1", "pad:rb": "R1", "pad:lt": "L2", "pad:rt": "R2",
    "pad:ls": "L3", "pad:rs": "R3", "pad:select": "Create", "pad:start": "Options", "pad:home": "PS",
  },
  xbox: {
    "pad:a": "A", "pad:b": "B", "pad:x": "X", "pad:y": "Y",
    "pad:lb": "LB", "pad:rb": "RB", "pad:lt": "LT", "pad:rt": "RT",
    "pad:ls": "LS", "pad:rs": "RS", "pad:select": "View", "pad:start": "Menu", "pad:home": "Xbox",
  },
  generic: {
    "pad:a": "A", "pad:b": "B", "pad:x": "X", "pad:y": "Y",
    "pad:lb": "L1", "pad:rb": "R1", "pad:lt": "L2", "pad:rt": "R2",
    "pad:ls": "L3", "pad:rs": "R3", "pad:select": "Select", "pad:start": "Start",
  },
};
const PAD_ES: Record<string, string> = {
  "pad:touchpad": "Panel táctil",
  "pad:rstick": "Stick der.",
  "pad:lstick": "Stick izq.",
};

/** Button label for the given (or detected) controller family. */
export function padLabel(code: string, family: PadFamily = currentFamily()): string {
  const es = useSettingsStore.getState().language === "es";
  return (es ? PAD_ES[code] : undefined) ?? PAD_LABELS[family][code] ?? PAD_COMMON[code] ?? code.replace("pad:", "").toUpperCase();
}

/** Human label of one code ("Space", "E", "Left click", "✕"). */
export function codeLabel(code: string): string {
  if (isPadCode(code)) return padLabel(code);
  const table = useSettingsStore.getState().language === "es" ? LABELS_ES : LABELS_EN;
  return table[code] ?? (code.length === 1 ? code.toUpperCase() : code[0].toUpperCase() + code.slice(1));
}

/** Label of an action's main input on the device being used — what hints show. */
/** Menu pages without a button of their own live in the pause menu (Options). */
export const MENU_ACTIONS: ReadonlySet<Action> = new Set(["inventory", "character", "skills", "journal", "map", "help"]);

export function keyLabel(action: Action): string {
  if (currentDevice() === "gamepad") {
    const code = bindingFor(action, "gamepad")[0] ?? (MENU_ACTIONS.has(action) ? "pad:start" : undefined);
    return code ? padLabel(code) : "—";
  }
  const b = bindingFor(action, "keyboard");
  // Prefer a keyboard key over a mouse button for hints.
  const code = b.find((c) => !c.startsWith("mouse")) ?? b[0];
  return code ? codeLabel(code) : "—";
}

/** "Left stick" / "Stick izq." — movement as one word on a controller. */
export function moveLabel(): string {
  const es = useSettingsStore.getState().language === "es";
  const stick = bindingFor("moveUp", "gamepad")[0] === "pad:lsup";
  if (stick) return es ? "Stick izq." : "Left stick";
  return ["moveUp", "moveLeft", "moveDown", "moveRight"].map((a) => keyLabel(a as Action)).join("");
}

export function isAction(s: string): s is Action {
  return s in DEFAULT_BINDINGS;
}
