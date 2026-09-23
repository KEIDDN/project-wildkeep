import { Container, Graphics, Sprite, Text } from "pixi.js";
import { loadTexture, loadTile } from "../AssetManager";
import { buildTileGridLayer } from "../TileLayer";
import { TILE_ATLAS } from "../tileAtlas";
import { TILE_DISPLAY } from "../../../game/core/constants";
import { getEnemy } from "../../../data/enemies";
import { EnemyVisual } from "../../sprites/EnemyVisual";
import { useDungeonStore } from "../../../store/dungeonStore";
import type { DungeonData } from "../../../game/dungeon/types";
import type { Interactable, WorldSceneHandle } from "./sceneTypes";

export async function createDungeonScene(
  dungeon: DungeonData,
): Promise<WorldSceneHandle> {
  const container = new Container();

  const floorTex = await loadTile(
    TILE_ATLAS.floors.sheet,
    TILE_ATLAS.floors.cobble.x,
    TILE_ATLAS.floors.cobble.y,
  );
  const wallTex = await loadTile(
    TILE_ATLAS.walls.sheet,
    TILE_ATLAS.walls.fill.x,
    TILE_ATLAS.walls.fill.y,
  );
  container.addChild(buildTileGridLayer(dungeon.tileGrid, floorTex, wallTex));

  const interactables: Interactable[] = [];
  const enemySprites = new Map<string, { visual: EnemyVisual; label: Text }>();
  const chestSprites = new Map<string, Sprite>();
  let exitMarker: Container | null = null;

  const chestTex = await loadTexture("/icons/chest_icon.png");

  for (const room of dungeon.rooms) {
    for (const enemy of room.enemies) {
      const def = getEnemy(enemy.enemyDefId);
      const visual = new EnemyVisual();
      await visual.load(def);
      visual.update("idle");
      const px = enemy.tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = enemy.tileY * TILE_DISPLAY + TILE_DISPLAY;
      visual.setPosition(px, py);
      if (enemy.isElite) {
        visual.sprite.tint = 0xffb347;
        visual.sprite.scale.set(visual.sprite.scale.x * 1.3, visual.sprite.scale.y * 1.3);
      }
      container.addChild(visual.sprite);

      const label = new Text({
        text: enemy.isElite ? `Elite ${def.name}` : def.name,
        style: { fill: 0xff8888, fontSize: 10, fontFamily: "monospace" },
      });
      label.anchor.set(0.5, 1);
      label.position.set(px, py - visual.sprite.height - 4);
      container.addChild(label);

      enemySprites.set(enemy.instanceId, { visual, label });
      interactables.push({
        id: `enemy-${enemy.instanceId}`,
        x: px,
        y: py - 12,
        radius: 30,
        kind: "enemy",
        label: `Fight ${def.name}`,
        data: { enemyInstanceId: enemy.instanceId },
      });
    }

    if (room.chest) {
      const sprite = new Sprite(chestTex);
      sprite.anchor.set(0.5, 0.8);
      sprite.scale.set(1.6);
      const px = room.chest.tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = room.chest.tileY * TILE_DISPLAY + TILE_DISPLAY / 2;
      sprite.position.set(px, py);
      if (room.chest.isRare) sprite.tint = 0xffd54f;
      container.addChild(sprite);
      chestSprites.set(room.chest.instanceId, sprite);

      interactables.push({
        id: `chest-${room.chest.instanceId}`,
        x: px,
        y: py,
        radius: 32,
        kind: "chest",
        label: room.chest.isRare ? "Open Rare Chest" : "Open Chest",
        data: { chestInstanceId: room.chest.instanceId },
      });
    }
  }

  const bossRoom = dungeon.rooms.find((r) => r.id === dungeon.bossRoomId)!;
  const exitPx = bossRoom.tileOriginX * TILE_DISPLAY + (bossRoom.width * TILE_DISPLAY) / 2;
  const exitPy = bossRoom.tileOriginY * TILE_DISPLAY + (bossRoom.height * TILE_DISPLAY) / 2;

  const widthPx = dungeon.width * TILE_DISPLAY;
  const heightPx = dungeon.height * TILE_DISPLAY;

  const isWalkable = (x: number, y: number) => {
    const tx = Math.floor(x / TILE_DISPLAY);
    const ty = Math.floor(y / TILE_DISPLAY);
    return !useDungeonStore.getState().isWallAt(tx, ty);
  };

  return {
    container,
    widthPx,
    heightPx,
    isWalkable,
    interactables,
    update: () => {
      const state = useDungeonStore.getState();
      for (const [instanceId, { visual, label }] of enemySprites) {
        const enemy = findEnemy(dungeon, instanceId);
        if (!enemy) continue;
        if (enemy.defeated && visual.sprite.visible) {
          visual.update("death");
          label.visible = false;
          const idx = interactables.findIndex((i) => i.id === `enemy-${instanceId}`);
          if (idx >= 0) interactables.splice(idx, 1);
          setTimeout(() => {
            visual.sprite.visible = false;
          }, 700);
        }
      }
      for (const [instanceId, sprite] of chestSprites) {
        const room = dungeon.rooms.find((r) => r.chest?.instanceId === instanceId);
        if (room?.chest?.opened && sprite.alpha === 1) {
          sprite.tint = 0x888888;
          sprite.alpha = 0.6;
          const idx = interactables.findIndex((i) => i.id === `chest-${instanceId}`);
          if (idx >= 0) interactables.splice(idx, 1);
        }
      }
      if (state.bossDefeated && !exitMarker) {
        exitMarker = buildExitMarker();
        exitMarker.position.set(exitPx, exitPy - 40);
        container.addChild(exitMarker);
        interactables.push({
          id: "dungeon-exit",
          x: exitPx,
          y: exitPy,
          radius: 40,
          kind: "exit",
          label: "Leave Dungeon",
          data: {},
        });
      }
    },
    destroy: () => container.destroy({ children: true }),
  };
}

function findEnemy(dungeon: DungeonData, instanceId: string) {
  for (const room of dungeon.rooms) {
    const found = room.enemies.find((e) => e.instanceId === instanceId);
    if (found) return found;
  }
  return undefined;
}

function buildExitMarker(): Container {
  const c = new Container();
  const g = new Graphics();
  g.star(0, 0, 5, 14, 6).fill(0xffd54f);
  c.addChild(g);
  const label = new Text({
    text: "EXIT",
    style: { fill: 0xffd54f, fontSize: 12, fontFamily: "monospace", fontWeight: "bold" },
  });
  label.anchor.set(0.5, 1);
  label.position.set(0, -18);
  c.addChild(label);
  return c;
}
