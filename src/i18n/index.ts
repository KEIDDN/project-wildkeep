import { useSettingsStore, type Language } from "../store/settingsStore";
import { en } from "./en";
import { es } from "./es";
import { isAction, keyLabel, moveLabel, padLabel } from "../game/input/bindings";
import { usingGamepad } from "../game/input/gamepad";
import { actionCode, glyphToken } from "../game/input/glyphs";

/**
 * Localization.
 *
 *  - UI text: `t("inventory.title")`, with `{name}` placeholders. Keys are
 *    type-checked against the English dictionary (en.ts), and es.ts must
 *    have exactly the same shape, so a missing translation fails to compile.
 *  - Game content (item names, NPC lines, places…) keeps its English source
 *    text in the data files; translations live in content-*.ts and are read
 *    through the helpers in ./content.ts.
 *
 * Adding a language = one dictionary + one content file + one entry in
 * LANGUAGES. Translations should be written, not transliterated: jokes and
 * voices are adapted to sound natural (see es.ts).
 */

export type { Language };

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

type Leaf = string | readonly string[];
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type StringLeaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly string[] ? never : StringLeaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type ListLeaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends readonly string[] ? `${P}${K}` : T[K] extends string ? never : ListLeaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** A dictionary with the same shape as the English one. */
export type Dict<T = typeof en> = { [K in keyof T]: T[K] extends string ? string : T[K] extends readonly string[] ? readonly string[] : Dict<T[K]> };

export type TKey = StringLeaves<typeof en>;
export type TListKey = ListLeaves<typeof en>;
export type AnyKey = Leaves<typeof en>;

const DICTS: Record<Language, Dict> = { en, es };

/** Texts that say "click" / "double-click" read differently with a controller in hand. */
const PAD_TEXT: Partial<Record<AnyKey, AnyKey>> = {
  "intro.continue": "padText.introContinue",
  "inventory.selectHint": "padText.selectHint",
  "tutorial.steps.bag.hint": "padText.bagHint",
  "tutorial.topics.movement.lines": "padText.movement",
  "tutorial.topics.inventory.lines": "padText.inventory",
  "tutorial.topics.combat.lines": "padText.combat",
  "talents.hover": "padText.talentHover",
  "talents.clickToLearn": "padText.clickToLearn",
  "stash.subtitle": "padText.stash",
};
const variant = (key: string): string => (usingGamepad() ? (PAD_TEXT[key as AnyKey] ?? key) : key);

export function currentLanguage(): Language {
  return useSettingsStore.getState().language;
}

export function setLanguage(lang: Language): void {
  useSettingsStore.getState().update({ language: lang });
  document.documentElement.lang = lang;
}

/** React: re-render when the language changes. */
export function useLanguage(): Language {
  return useSettingsStore((s) => s.language);
}

function lookup(dict: unknown, key: string): unknown {
  let cur = dict;
  for (const part of key.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Fills `{name}` placeholders from params, and `{k:action}` with the key (or
 * controller button) the player has bound to that action ("Press {k:map} for
 * the map"), so hints stay right after remapping and follow the device in
 * use. `{p:a}` is a fixed controller button (menus: ✕ / A).
 */
export function interpolate(text: string, params?: Record<string, string | number>, rich = false): string {
  if (text.includes("{k:")) {
    // "WASD" on a controller is just "Left stick".
    if (usingGamepad()) text = text.replace("{k:moveUp}{k:moveLeft}{k:moveDown}{k:moveRight}", rich ? glyphToken("pad:lstick") : moveLabel());
    text = text.replace(/\{k:(\w+)\}/g, (m, a) => (isAction(a) ? (rich ? glyphToken(actionCode(a)) : keyLabel(a)) : m));
  }
  if (text.includes("{p:")) text = text.replace(/\{p:(\w+)\}/g, (_, c) => (rich ? glyphToken(`pad:${c}`) : padLabel(`pad:${c}`)));
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Translate a UI string. Falls back to English, then to the key. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const k = variant(key);
  const v = lookup(DICTS[currentLanguage()], k) ?? lookup(en, k);
  return interpolate(typeof v === "string" ? v : key, params);
}

/**
 * Rich variants: inputs come out as glyph tokens for `<RichText>` to draw as
 * real buttons / keycaps. Only for text rendered through RichText.
 */
export function tr(key: TKey, params?: Record<string, string | number>): string {
  const k = variant(key);
  const v = lookup(DICTS[currentLanguage()], k) ?? lookup(en, k);
  return interpolate(typeof v === "string" ? v : key, params, true);
}
export const tDynR = (key: string, params?: Record<string, string | number>) => tr(key as TKey, params);
export function tlr(key: TListKey, params?: Record<string, string | number>): string[] {
  const k = variant(key);
  const v = lookup(DICTS[currentLanguage()], k) ?? lookup(en, k);
  return Array.isArray(v) ? v.map((line) => interpolate(line, params, true)) : [];
}

/** Translate a list of lines (tutorial cards, intro…). */
export function tl(key: TListKey, params?: Record<string, string | number>): string[] {
  const k = variant(key);
  const v = lookup(DICTS[currentLanguage()], k) ?? lookup(en, k);
  return Array.isArray(v) ? v.map((line) => interpolate(line, params)) : [];
}

/** Dynamic keys built at runtime (e.g. `danger.${level}`); unchecked. */
export function tDyn(key: string, params?: Record<string, string | number>): string {
  return t(key as TKey, params);
}

const NUMBER_LOCALE: Record<Language, string> = { en: "en-US", es: "es-ES" };

/** Numbers with the language's grouping (1,250 / 1.250). */
export function fmt(n: number): string {
  // es-ES doesn't group four-digit numbers by default; force it for clarity.
  return new Intl.NumberFormat(NUMBER_LOCALE[currentLanguage()], { useGrouping: "always" } as Intl.NumberFormatOptions).format(n);
}
