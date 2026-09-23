import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { TILE_DISPLAY } from "../../game/core/constants";
import type { TileType } from "../../game/dungeon/types";

/** A large open flat area (town / forest ground) tiled from one texture. */
export function buildFlatGround(
  tilesWide: number,
  tilesHigh: number,
  texture: Texture,
): TilingSprite {
  const sprite = new TilingSprite({
    texture,
    width: tilesWide * TILE_DISPLAY,
    height: tilesHigh * TILE_DISPLAY,
  });
  sprite.tileScale.set(TILE_DISPLAY / texture.width, TILE_DISPLAY / texture.height);
  return sprite;
}

/** A grid-based layer (dungeon floor/wall) built from a TileType grid. */
export function buildTileGridLayer(
  grid: TileType[][],
  floorTex: Texture,
  wallTex: Texture,
): Container {
  const container = new Container();
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const tex = grid[y][x] === "wall" ? wallTex : floorTex;
      const sprite = new Sprite(tex);
      sprite.width = TILE_DISPLAY;
      sprite.height = TILE_DISPLAY;
      sprite.x = x * TILE_DISPLAY;
      sprite.y = y * TILE_DISPLAY;
      container.addChild(sprite);
    }
  }
  return container;
}
