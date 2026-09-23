import { Container, Sprite, Text } from "pixi.js";
import { loadTexture, loadTile } from "../AssetManager";
import { buildFlatGround } from "../TileLayer";
import { TILE_ATLAS } from "../tileAtlas";
import { TILE_DISPLAY } from "../../../game/core/constants";
import { TOWN_BUILDINGS } from "../../../data/buildings";
import type { Interactable, WorldSceneHandle } from "./sceneTypes";

const TOWN_TILES_WIDE = 24;
const TOWN_TILES_HIGH = 16;

export async function createTownScene(): Promise<WorldSceneHandle> {
  const container = new Container();

  const grassTex = await loadTile(
    TILE_ATLAS.floors.sheet,
    TILE_ATLAS.floors.grass.x,
    TILE_ATLAS.floors.grass.y,
  );
  const ground = buildFlatGround(TOWN_TILES_WIDE, TOWN_TILES_HIGH, grassTex);
  container.addChild(ground);

  const pathTex = await loadTile(
    TILE_ATLAS.floors.sheet,
    TILE_ATLAS.floors.dirtPath.x,
    TILE_ATLAS.floors.dirtPath.y,
  );
  // A simple path strip connecting the buildings row for readability.
  for (let x = 2; x < TOWN_TILES_WIDE - 2; x++) {
    const tile = new Sprite(pathTex);
    tile.width = TILE_DISPLAY;
    tile.height = TILE_DISPLAY;
    tile.x = x * TILE_DISPLAY;
    tile.y = 6 * TILE_DISPLAY;
    container.addChild(tile);
  }

  const interactables: Interactable[] = [];

  for (const building of TOWN_BUILDINGS) {
    const tex = await loadTexture(building.sprite);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(building.spriteScale);
    const px = building.position.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const py = building.position.y * TILE_DISPLAY + TILE_DISPLAY;
    sprite.position.set(px, py);
    container.addChild(sprite);

    const label = new Text({
      text: building.name,
      style: { fill: 0xffffff, fontSize: 11, fontFamily: "monospace" },
    });
    label.anchor.set(0.5, 1);
    label.position.set(px, py - sprite.height - 4);
    container.addChild(label);

    interactables.push({
      id: building.id,
      x: px,
      y: py - sprite.height / 3,
      radius: building.interactRadius,
      kind: "building",
      label: building.promptLabel,
      data: building,
    });
  }

  const widthPx = TOWN_TILES_WIDE * TILE_DISPLAY;
  const heightPx = TOWN_TILES_HIGH * TILE_DISPLAY;

  return {
    container,
    widthPx,
    heightPx,
    isWalkable: (x, y) => x >= 8 && y >= 8 && x <= widthPx - 8 && y <= heightPx - 8,
    interactables,
    update: () => {},
    destroy: () => container.destroy({ children: true }),
  };
}
