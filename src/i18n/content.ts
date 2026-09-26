import { currentLanguage, interpolate } from "./index";
import { ES_CONTENT } from "./content-es";
import { getItem } from "../data/items";
import { AREAS } from "../data/areas";
import { SKILLS, type SkillId } from "../data/skills";
import { houseLevelInfo } from "../data/house";
import { STATIONS, type StationId } from "../data/recipes";
import type { NpcDef } from "../data/npcs";
import type { AreaId } from "../game/core/types";

/**
 * Localized game content. The English text is the source and stays in the
 * data files (items.ts, npcs.ts, …); other languages supply a ContentTable.
 * Anything missing falls back to English, and dev builds log the gap once.
 */
export interface ContentTable {
  items: Record<string, readonly [name: string, description: string]>;
  nodes: Record<string, string>;
  enemies: Record<string, string>;
  /** Patterns with {name}. */
  enemyRank: { elite: string; boneCrowned: string; abyssal: string };
  areas: Partial<Record<AreaId, readonly [name: string, subtitle?: string]>>;
  skills: Record<SkillId, readonly [name: string, trainedBy: string]>;
  house: Record<number, { name: string; description: string; perks: readonly string[] }>;
  stations: Record<StationId, readonly [name: string, subtitle: string]>;
  /** Keyed by the English name. */
  floorThemes: Record<string, string>;
  mineBands: Record<string, string>;
  /** Index = tool power ("an Iron Axe"). */
  tools: { axe: readonly string[]; pickaxe: readonly string[] };
  thickets: Record<string, string>;
  npcs: Record<string, { name?: string; talk?: readonly (readonly string[])[]; night?: readonly (readonly string[])[]; lines?: Record<string, readonly string[]> }>;
  barks: Record<string, readonly string[]>;
  animals: Record<string, string>;
}

const TABLES: Partial<Record<string, ContentTable>> = { es: ES_CONTENT };

if (import.meta.env.DEV) void import("./glossary").then(async (g) => g.checkGlossary([ES_CONTENT, (await import("./es")).es, await import("./npcs-es"), await import("./quests-es")]));

const warned = new Set<string>();
function table(): ContentTable | null {
  const lang = currentLanguage();
  return lang === "en" ? null : (TABLES[lang] ?? null);
}

function pick<T>(value: T | undefined, fallback: T, what: string): T {
  if (value !== undefined) return value;
  if (import.meta.env.DEV && !warned.has(what)) {
    warned.add(what);
    console.warn(`[i18n] missing ${currentLanguage()} content: ${what}`);
  }
  return fallback;
}

export function itemName(id: string): string {
  const def = getItem(id);
  const tb = table();
  return tb ? pick(tb.items[id]?.[0], def.name, `item ${id}`) : def.name;
}

export function itemDesc(id: string, rich = false): string {
  const def = getItem(id);
  const tb = table();
  // Descriptions may mention keys ({k:potion}); `rich` draws them as glyphs (RichText).
  return interpolate(tb ? pick(tb.items[id]?.[1], def.description, `item desc ${id}`) : def.description, undefined, rich);
}

export function nodeName(id: string, english: string): string {
  const tb = table();
  return tb ? pick(tb.nodes[id], english, `node ${id}`) : english;
}

export function enemyName(id: string, english: string): string {
  const tb = table();
  return tb ? pick(tb.enemies[id], english, `enemy ${id}`) : english;
}

/** "Elite Orc Grunt", "Abyssal Grukk…" — rank dressing around a name. */
export function enemyRankTitle(kind: "elite" | "boneCrowned" | "abyssal", name: string): string {
  const tb = table();
  const en = { elite: "Elite {name}", boneCrowned: "Bone-Crowned {name}", abyssal: "Abyssal {name}" }[kind];
  return interpolate(tb ? tb.enemyRank[kind] : en, { name });
}

export function areaName(id: AreaId): string {
  const tb = table();
  return tb ? pick(tb.areas[id]?.[0], AREAS[id].name, `area ${id}`) : AREAS[id].name;
}

export function areaSubtitle(id: AreaId): string | undefined {
  const tb = table();
  return tb ? (tb.areas[id]?.[1] ?? AREAS[id].subtitle) : AREAS[id].subtitle;
}

export function skillName(id: SkillId): string {
  const tb = table();
  return tb ? tb.skills[id][0] : SKILLS[id].name;
}

export function skillTrainedBy(id: SkillId): string {
  const tb = table();
  return tb ? tb.skills[id][1] : SKILLS[id].trainedBy;
}

export function houseName(level: number): string {
  const tb = table();
  return tb?.house[level]?.name ?? houseLevelInfo(level).name;
}

export function houseDescription(level: number): string {
  const tb = table();
  return tb?.house[level]?.description ?? houseLevelInfo(level).description;
}

export function housePerks(level: number): readonly string[] {
  const tb = table();
  return tb?.house[level]?.perks ?? houseLevelInfo(level).perkText;
}

export function stationName(id: StationId): string {
  const tb = table();
  return tb ? tb.stations[id][0] : STATIONS[id].name;
}

export function stationSubtitle(id: StationId): string {
  const tb = table();
  return tb ? tb.stations[id][1] : STATIONS[id].subtitle;
}

export function floorThemeName(english: string): string {
  const tb = table();
  return tb ? pick(tb.floorThemes[english], english, `theme ${english}`) : english;
}

export function mineBandName(english: string): string {
  const tb = table();
  return tb ? pick(tb.mineBands[english], english, `mine band ${english}`) : english;
}

const EN_TOOLS = {
  axe: ["", "an Axe", "an Iron Axe", "a Steel Axe", "a Mithril Axe"],
  pickaxe: ["", "a Pickaxe", "an Iron Pickaxe", "a Steel Pickaxe", "a Mithril Pickaxe"],
};

export function toolName(kind: "axe" | "pickaxe", power: number): string {
  const tb = table();
  return (tb ? tb.tools[kind] : EN_TOOLS[kind])[power] ?? EN_TOOLS[kind][power] ?? "";
}

export function thicketLabel(english: string): string {
  const tb = table();
  return tb ? pick(tb.thickets[english], english, `thicket ${english}`) : english;
}

export function animalName(id: string, english: string): string {
  const tb = table();
  return tb ? pick(tb.animals[id], english, `animal ${id}`) : english;
}

// ---- NPCs --------------------------------------------------------------------

export function npcName(def: NpcDef): string {
  const tb = table();
  return tb?.npcs[def.id]?.name ?? def.name;
}

/** The NPC's rotating talk sets (or night sets) in the current language. */
export function npcTalk(def: NpcDef, night: boolean): readonly (readonly string[])[] {
  const tb = table();
  const own = tb?.npcs[def.id];
  if (night && def.night?.length) return own?.night ?? def.night;
  return tb ? pick(own?.talk, def.talk, `npc talk ${def.id}`) : def.talk;
}

/** Named situational lines (honor reactions, events, gossip…). */
export function npcLines(def: NpcDef, key: string): readonly string[] | undefined {
  const tb = table()?.npcs[def.id];
  return tb?.lines?.[key] ?? def.lines?.[key];
}

export function npcBarks(def: NpcDef): readonly string[] {
  const tb = table();
  return tb?.barks[def.id] ?? def.barks ?? [];
}
