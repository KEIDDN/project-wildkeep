import { Assets, Rectangle, Texture, type Renderer } from "pixi.js";
import { ASSETS, animPath, characterPath, type SheetMeta } from "../data/assets";

/**
 * Texture cache. Everything is nearest-neighbor (set globally in Game) and
 * sliced lazily from sheets; slices are cached so tile maps with thousands
 * of cells share a handful of Texture objects.
 */

const sheets = new Map<string, Texture>();
const slices = new Map<string, Texture>();
const frameCache = new Map<string, Texture[]>();

export async function preload(paths: string[]): Promise<void> {
  const todo = [...new Set(paths)].filter((p) => !sheets.has(p));
  if (!todo.length) return;
  const loaded = await Assets.load<Texture>(todo);
  for (const p of todo) {
    const tex = loaded[p];
    tex.source.scaleMode = "nearest";
    sheets.set(p, tex);
  }
}

/** Pushes every preloaded image to the GPU up front, so nothing is uploaded
 * (with a hitch) the first time it comes on screen. */
export function uploadAllTextures(renderer: Renderer): void {
  for (const t of sheets.values()) renderer.texture.initSource(t.source);
}

/** A whole image. Must have been preloaded. */
export function tex(path: string): Texture {
  const t = sheets.get(path);
  if (!t) throw new Error(`Texture not preloaded: ${path}`);
  return t;
}

export function hasTex(path: string): boolean {
  return sheets.has(path);
}

export function slice(path: string, x: number, y: number, w: number, h: number): Texture {
  const key = `${path}|${x},${y},${w},${h}`;
  let t = slices.get(key);
  if (!t) {
    t = new Texture({ source: tex(path).source, frame: new Rectangle(x, y, w, h) });
    slices.set(key, t);
  }
  return t;
}

/** 16px tile at (tx, ty) in tile units. */
export function tile(path: string, tx: number, ty: number, size = 16): Texture {
  return slice(path, tx * size, ty * size, size, size);
}

export function frames(path: string, frameW: number, frameH: number, count: number, row = 0): Texture[] {
  const key = `${path}|${frameW}x${frameH}x${count}@${row}`;
  let list = frameCache.get(key);
  if (!list) {
    list = [];
    for (let i = 0; i < count; i++) list.push(slice(path, i * frameW, row * frameH, frameW, frameH));
    frameCache.set(key, list);
  }
  return list;
}

export function characterFrames(id: string, anim: string): { frames: Texture[]; meta: SheetMeta } {
  const meta = ASSETS.characters[id]?.[anim];
  if (!meta) throw new Error(`No ${anim} strip for character ${id}`);
  return { frames: frames(characterPath(id, anim), meta.frameW, meta.frameH, meta.frames), meta };
}

export function characterPaths(id: string): string[] {
  return Object.keys(ASSETS.characters[id] ?? {}).map((anim) => characterPath(id, anim));
}

export function animFrames(id: string): Texture[] {
  const meta = ASSETS.anims[id];
  return frames(animPath(id), meta.frameW, meta.frameH, meta.frames);
}
