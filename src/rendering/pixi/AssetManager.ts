import { Assets, Rectangle, Texture } from "pixi.js";

const sheetCache = new Map<string, Texture>();
const frameCache = new Map<string, Texture[]>();

async function loadSheet(path: string): Promise<Texture> {
  const cached = sheetCache.get(path);
  if (cached) return cached;
  const texture = await Assets.load<Texture>(path);
  texture.source.scaleMode = "nearest";
  sheetCache.set(path, texture);
  return texture;
}

/** Loads a horizontal sprite-sheet and slices it into `frameCount` square
 * frames of `frameSize`px, caching the result per path+size. */
export async function loadFrames(
  path: string,
  frameSize: number,
  frameCount: number,
): Promise<Texture[]> {
  const cacheKey = `${path}:${frameSize}:${frameCount}`;
  const cached = frameCache.get(cacheKey);
  if (cached) return cached;

  const sheet = await loadSheet(path);
  const frames: Texture[] = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push(
      new Texture({
        source: sheet.source,
        frame: new Rectangle(i * frameSize, 0, frameSize, frameSize),
      }),
    );
  }
  frameCache.set(cacheKey, frames);
  return frames;
}

/** Loads a single whole-image texture (props, icons, station markers). */
export async function loadTexture(path: string): Promise<Texture> {
  return loadSheet(path);
}

/** Slices a tile out of a tileset sheet at (tileX, tileY) in tile units. */
export async function loadTile(
  path: string,
  tileX: number,
  tileY: number,
  tileSize = 16,
): Promise<Texture> {
  const cacheKey = `${path}:tile:${tileX}:${tileY}:${tileSize}`;
  const cached = frameCache.get(cacheKey);
  if (cached) return cached[0];
  const sheet = await loadSheet(path);
  const tex = new Texture({
    source: sheet.source,
    frame: new Rectangle(tileX * tileSize, tileY * tileSize, tileSize, tileSize),
  });
  frameCache.set(cacheKey, [tex]);
  return tex;
}
