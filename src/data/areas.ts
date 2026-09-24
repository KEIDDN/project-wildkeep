import type { AreaId } from "../game/core/types";

/**
 * - outdoor: lit by the sun — follows the day/night cycle.
 * - interior: fixed indoor lighting (house, tavern).
 * - underground: fixed dark lighting (mine, dungeon).
 */
export type AreaKind = "outdoor" | "interior" | "underground";

/** Which music "zone" an area belongs to (see data/audio.ts MUSIC_RULES). */
export type MusicZone = "world" | "tavern" | "underground";

export interface AreaInfo {
  id: AreaId;
  name: string;
  subtitle?: string;
  kind: AreaKind;
  music: MusicZone;
  /** Interior / underground brightness, or an extra dimming factor outdoors
   * (the Deepwood canopy). 0 (pitch black) .. 1 (untouched). */
  ambientLight?: number;
  townRegen?: boolean; // slowly regenerate HP here
}

export const AREAS: Record<AreaId, AreaInfo> = {
  town: { id: "town", name: "Wildkeep", subtitle: "A quiet village at the forest's edge", kind: "outdoor", music: "world", townRegen: true },
  forest: { id: "forest", name: "Whisperwood", subtitle: "Timber, stone and herbs", kind: "outdoor", music: "world" },
  deep_forest: { id: "deep_forest", name: "The Deepwood", subtitle: "Old roots. Older things.", kind: "outdoor", music: "world", ambientLight: 0.66 },
  ancient_grove: { id: "ancient_grove", name: "The Ancient Grove", subtitle: "Where the oldest trees keep their secrets", kind: "outdoor", music: "world", ambientLight: 0.8 },
  mine: { id: "mine", name: "The Old Mine", subtitle: "Stone, iron and coal", kind: "underground", music: "underground", ambientLight: 0.5 },
  house: { id: "house", name: "Your Cottage", kind: "interior", music: "world", ambientLight: 0.9, townRegen: true },
  shop: { id: "shop", name: "Mira's General Store", subtitle: "If Mira doesn't stock it, it doesn't exist", kind: "interior", music: "world", ambientLight: 0.9, townRegen: true },
  forge: { id: "forge", name: "Bram's Forge", subtitle: "Mind the sparks. And the smith.", kind: "interior", music: "world", ambientLight: 0.62, townRegen: true },
  tavern: { id: "tavern", name: "The Tipsy Wyvern", subtitle: "Tavern & Blackjack", kind: "interior", music: "tavern", ambientLight: 0.85, townRegen: true },
  dungeon: { id: "dungeon", name: "The Depths", kind: "underground", music: "underground", ambientLight: 0.3 },
  tower_hill: { id: "tower_hill", name: "The Crooked Tower", subtitle: "Somebody lives here. Somebody would rather you didn't.", kind: "outdoor", music: "world", ambientLight: 0.85 },
  lake: { id: "lake", name: "Mirror Lake", subtitle: "Still water, patient fish", kind: "outdoor", music: "world" },
};
