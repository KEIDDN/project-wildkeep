import manifest from "./generated/assets.json";
import type { Rect } from "../game/core/types";

/**
 * Typed view over `generated/assets.json`, which `tools/build_assets.py`
 * writes alongside the curated sprites in `public/`. Anything that needs a
 * sprite's size, a building's collision footprint or a character's foot
 * anchor reads it from here rather than hard-coding numbers.
 */

export interface SheetMeta {
  frameW: number;
  frameH: number;
  frames: number;
  anchorX: number;
  anchorY: number;
  bodyH: number;
}

export interface BuildingMeta {
  w: number;
  h: number;
  solid: Rect;
  door?: Rect;
  /** Has a `<id>_glow.png` (lit windows, drawn at night). */
  glow?: boolean;
}

export interface InteriorMeta {
  w: number;
  h: number;
  cell: number;
  overlay: boolean;
  collision: string[];
}

interface Manifest {
  props: Record<string, { w: number; h: number }>;
  anims: Record<string, { frameW: number; frameH: number; frames: number }>;
  buildings: Record<string, BuildingMeta>;
  characters: Record<string, Record<string, SheetMeta>>;
  interiors: Record<string, InteriorMeta>;
  animals: Record<string, { frameW: number; frameH: number; frames: number; anchorX: number; anchorY: number }>;
}

export const ASSETS = manifest as Manifest;

export type PropId = keyof typeof manifest.props;

export const propPath = (id: string) => `/sprites/props/${id}.png`;
export const animPath = (id: string) => `/sprites/anims/${id}.png`;
export const buildingPath = (id: string) => `/sprites/buildings/${id}.png`;
export const buildingGlowPath = (id: string) => `/sprites/buildings/${id}_glow.png`;
export const characterPath = (id: string, anim: string) => `/sprites/characters/${id}/${anim}.png`;
export const interiorPath = (id: string) => `/sprites/interiors/${id}.png`;
export const animalPath = (id: string) => `/sprites/animals/${id}.png`;
export const iconPath = (id: string) => `/icons/${id}.png`;
export const icon16Path = (id: string) => `/icons16/${id}.png`;

export const TILESETS = {
  floors: "/sprites/tiles/floors.png",
  dungeon: "/sprites/tiles/dungeon.png",
  cliffs: "/sprites/tiles/cliffs.png",
} as const;

export function propSize(id: string): { w: number; h: number } {
  const size = ASSETS.props[id];
  if (!size) throw new Error(`Unknown prop sprite: ${id}`);
  return size;
}
