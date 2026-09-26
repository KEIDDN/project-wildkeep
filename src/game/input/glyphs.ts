import { MENU_ACTIONS, bindingFor, codeLabel, type Action } from "./bindings";
import { currentDevice, currentFamily, isPadCode, type PadFamily } from "./gamepad";

/**
 * One answer to "what does this input look like?", for every place that shows
 * one: HUD prompts, the marker over NPCs (Pixi), hint bars, tutorial text,
 * Controls. UI asks for a logical *action*; this picks the device in use, the
 * player's binding and the controller family, and returns a drawable
 * description — never a device-specific string baked into a component.
 */

export type FaceShape = "cross" | "circle" | "square" | "triangle";
export type GlyphDir = "up" | "down" | "left" | "right";

export type Glyph =
  | { kind: "key"; label: string }
  | { kind: "mouse"; button: number }
  | { kind: "face"; family: PadFamily; shape?: FaceShape; label: string; color: string }
  | { kind: "bumper" | "trigger"; label: string }
  | { kind: "dpad"; dir?: GlyphDir }
  | { kind: "stick"; side: "L" | "R"; dir?: GlyphDir; click?: boolean }
  | { kind: "menu"; label: string; lines?: boolean }
  | { kind: "touchpad" }
  | { kind: "none" };

/** Face button colours: PlayStation symbols, Xbox letters. */
const PS: Record<string, { shape: FaceShape; color: string }> = {
  "pad:a": { shape: "cross", color: "#7fa8ff" },
  "pad:b": { shape: "circle", color: "#ff6f6f" },
  "pad:x": { shape: "square", color: "#f08ce0" },
  "pad:y": { shape: "triangle", color: "#5fe0b0" },
};
const XBOX_COLOR: Record<string, string> = { "pad:a": "#6fd46f", "pad:b": "#ff6a5e", "pad:x": "#62a4ff", "pad:y": "#ffd24a" };
const LETTER: Record<string, string> = { "pad:a": "A", "pad:b": "B", "pad:x": "X", "pad:y": "Y" };

const MENU: Record<PadFamily, Record<string, string>> = {
  playstation: { "pad:select": "CREATE", "pad:start": "OPTIONS", "pad:home": "PS" },
  xbox: { "pad:select": "VIEW", "pad:start": "MENU", "pad:home": "XBOX" },
  generic: { "pad:select": "SELECT", "pad:start": "START", "pad:home": "HOME" },
};
const SHOULDER: Record<PadFamily, Record<string, string>> = {
  playstation: { "pad:lb": "L1", "pad:rb": "R1", "pad:lt": "L2", "pad:rt": "R2" },
  xbox: { "pad:lb": "LB", "pad:rb": "RB", "pad:lt": "LT", "pad:rt": "RT" },
  generic: { "pad:lb": "L1", "pad:rb": "R1", "pad:lt": "L2", "pad:rt": "R2" },
};

/** The glyph for one binding code, drawn for `family`. */
export function glyphOfCode(code: string | undefined, family: PadFamily = currentFamily()): Glyph {
  if (!code) return { kind: "none" };
  if (code.startsWith("mouse")) return { kind: "mouse", button: Number(code.slice(5)) || 0 };
  if (!isPadCode(code)) return { kind: "key", label: codeLabel(code) };
  if (code in LETTER) {
    if (family === "playstation") return { kind: "face", family, ...PS[code], label: LETTER[code] };
    return { kind: "face", family, label: LETTER[code], color: family === "xbox" ? XBOX_COLOR[code] : "#e8dcc4" };
  }
  if (code === "pad:lb" || code === "pad:rb") return { kind: "bumper", label: SHOULDER[family][code] };
  if (code === "pad:lt" || code === "pad:rt") return { kind: "trigger", label: SHOULDER[family][code] };
  if (code in MENU[family]) return { kind: "menu", label: MENU[family][code], lines: code === "pad:start" };
  switch (code) {
    case "pad:up":
    case "pad:down":
    case "pad:left":
    case "pad:right":
      return { kind: "dpad", dir: code.slice(4) as GlyphDir };
    case "pad:dpad":
      return { kind: "dpad" };
    case "pad:ls":
      return { kind: "stick", side: "L", click: true };
    case "pad:rs":
      return { kind: "stick", side: "R", click: true };
    case "pad:lstick":
      return { kind: "stick", side: "L" };
    case "pad:rstick":
      return { kind: "stick", side: "R" };
    case "pad:touchpad":
      return { kind: "touchpad" };
  }
  const m = /^pad:(l|r)s(up|down|left|right)$/.exec(code);
  if (m) return { kind: "stick", side: m[1] === "l" ? "L" : "R", dir: m[2] as GlyphDir };
  return { kind: "key", label: codeLabel(code) };
}

/** The input shown for an action right now: the device in use, its first binding. */
export function actionCode(action: Action): string | undefined {
  if (currentDevice() === "gamepad") {
    const codes = bindingFor(action, "gamepad");
    // A menu page with no button of its own is reached through Options.
    if (!codes.length) return MENU_ACTIONS.has(action) ? "pad:start" : undefined;
    // Movement on the stick reads as "the stick", not one direction of it.
    return codes[0].startsWith("pad:ls") && codes[0] !== "pad:ls" ? "pad:lstick" : codes[0];
  }
  const b = bindingFor(action, "keyboard");
  // Prefer a keyboard key over a mouse button for hints.
  return b.find((c) => !c.startsWith("mouse")) ?? b[0];
}

export function glyphOfAction(action: Action): Glyph {
  return glyphOfCode(actionCode(action));
}

/** Stable key for "would this glyph look different now?" (Pixi caches by it). */
export function glyphKey(g: Glyph): string {
  return JSON.stringify(g);
}

/**
 * Rich-text tokens: `interpolate(…, rich)` writes a glyph as
 * `code`; `<RichText>` draws it. Plain strings (toasts, Pixi
 * text) keep short text labels instead.
 */
export const GLYPH_OPEN = "";
export const GLYPH_CLOSE = "";
export const glyphToken = (code: string | undefined) => (code ? `${GLYPH_OPEN}${code}${GLYPH_CLOSE}` : "—");
